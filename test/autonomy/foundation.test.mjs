import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {renderAutonomy,AUTONOMY_INTENT} from '../../public/autonomy.js';
import {renderWorkspace,icon} from '../../public/workspace.js';

const owner='test-only-owner-access';
const brief={name:'Field Research',purpose:'Answer bounded research questions.',industry:'Research',customer:'Small businesses',outcome:'Useful sourced answers',objective:'Identify evidence gaps for our first service'};
async function fixture(t){const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-foundation-'));let app=await createApp({directory,configPath:'',companyId:'cfn',ownerToken:owner});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return {directory,get app(){return app;},async restart(){await app.close();app=await createApp({directory,configPath:'',companyId:'cfn',ownerToken:owner});}};}
async function request(app,route,{method='GET',body,key,auth=true}={}){const response=await app.web.handle(new Request(`http://localhost${route}`,{method,headers:{...(auth?{authorization:`Bearer ${owner}`}:{ }),...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,value:await response.json()};}

test('actual owner bootstrap is idempotent, persistent, private and causes zero provider/financial effects',async t=>{
 const f=await fixture(t);
 assert.equal((await request(f.app,'/api/workspace/autonomy',{auth:false})).status,403);
 const empty=await request(f.app,'/api/workspace/autonomy');assert.equal(empty.status,200);assert.equal(empty.value.company,null);
 const configured=await request(f.app,'/api/workspace/autonomy/configure',{method:'POST',key:'company-v1',body:{version:0,operatingMode:'none',brief,intent:AUTONOMY_INTENT}});assert.equal(configured.status,200,JSON.stringify(configured.value));
 const create={version:configured.value.company.version};
 const first=await request(f.app,'/api/workspace/autonomy/bootstrap',{method:'POST',key:'core-team',body:create});assert.equal(first.status,200,JSON.stringify(first.value));
 const again=await request(f.app,'/api/workspace/autonomy/bootstrap',{method:'POST',key:'core-team',body:create});assert.equal(again.status,200);assert.equal(again.value.replayed,true);
 assert.equal(f.app.journal.list('agents').length,2);assert.equal(f.app.journal.list('agentWork').length,1);
 let view=(await request(f.app,'/api/workspace/autonomy')).value;
 assert.equal(view.work[0].state,'blocked');assert.equal(view.work[0].reasonCode,'AUTONOMY_POLICY_REQUIRED');
 assert.equal(view.events.filter(e=>e.type==='agent.created').length,2);
 assert.equal(f.app.journal.list('orders').length,0);assert.equal(f.app.treasury.snapshot().version,0);assert.equal(Object.keys(f.app.journal.snapshot().operations).length,0);
 const count=view.events.length;await f.restart();view=(await request(f.app,'/api/workspace/autonomy')).value;
 assert.equal(view.events.length,count);assert.equal(view.agents.length,2);assert.equal(view.company.executionMode,'setup');
 const html=renderAutonomy({autonomy:view,route:{page:'autonomy',sub:'overview',params:new URLSearchParams()},data:f.app.workspace.view()},icon);
 assert.match(html,/What agents are working on/);assert.match(html,/No accepted manager proposal yet/);assert.doesNotMatch(html,/company is running/i);
 const mainAgents=renderWorkspace({data:f.app.workspace.view(),status:{mode:'setup'},route:{page:'agents',params:new URLSearchParams()}});assert.match(mainAgents,/Company manager/);
 const directReplay=f.app.autonomy.bootstrap(create,{verified:false,role:'public',companyId:'cfn'},'core-team');await assert.rejects(directReplay,{code:'ACCESS_DENIED'});
 assert.equal((await request(f.app,'/api/workspace/autonomy?cursor=-1')).status,409);
});

test('start stays blocked without policy; templates and deduplicated gaps are real local records',async t=>{
 const f=await fixture(t);
 await request(f.app,'/api/workspace/autonomy/configure',{method:'POST',key:'company',body:{version:0,operatingMode:'none',brief,intent:AUTONOMY_INTENT}});
 await request(f.app,'/api/workspace/autonomy/bootstrap',{method:'POST',key:'core',body:{version:1}});
 let view=(await request(f.app,'/api/workspace/autonomy')).value;
 const start=await request(f.app,'/api/workspace/autonomy/control',{method:'POST',key:'start',body:{version:view.company.version,operation:'start'}});assert.equal(start.status,200);
 const advanced=await request(f.app,'/api/workspace/autonomy/advance',{method:'POST',key:'advance',body:{}});assert.equal(advanced.status,200,JSON.stringify(advanced.value));assert.equal(advanced.value.decision.reasonCode,'AUTONOMY_POLICY_REQUIRED');
 const template=await request(f.app,'/api/workspace/autonomy/templates',{method:'POST',key:'names',body:{name:'Fictional document names',fields:[{name:'firstName',required:true},{name:'lastName',required:true}],requiredFields:['firstName','middleName','lastName']}});assert.equal(template.status,200,JSON.stringify(template.value));
 view=(await request(f.app,'/api/workspace/autonomy')).value;const targetId=view.heads[0].targetId;
 for(const key of ['gap1','gap2'])assert.equal((await request(f.app,'/api/workspace/autonomy/gaps',{method:'POST',key,body:{targetId,failureCode:'MISSING_MIDDLE_NAME',summary:'A fictional sample requires a middle-name field.'}})).status,200);
 view=(await request(f.app,'/api/workspace/autonomy')).value;assert.equal(view.improvements.length,1);assert.equal(view.improvements[0].occurrences.length,2);
 assert.equal(view.work.filter(w=>w.kind==='backlog').length,1);
 assert.equal(Object.keys(f.app.journal.snapshot().operations).length,0);assert.equal(f.app.treasury.snapshot().version,0);
 const pages=await request(f.app,`/api/workspace/autonomy?cursor=${view.events[0].sequence}&limit=2`);assert.equal(pages.status,200);assert.equal(pages.value.events.length,2);assert.equal(pages.value.events[0].sequence>view.events[0].sequence,true);
 const forged=await request(f.app,'/api/workspace/autonomy/advance',{method:'POST',key:'forged',body:{actor:{verified:true,role:'owner'}}});assert.equal(forged.status,400);
});
