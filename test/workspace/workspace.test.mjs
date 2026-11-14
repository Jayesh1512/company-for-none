import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {renderWorkspace,renderAgentForm,renderMarketplace} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';
const req=(path,method='GET',body)=>new Request('http://localhost'+path,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
async function fixture(t) {const directory=await mkdtemp('/tmp/near-workspace-');let app=await createApp({directory});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return {get app(){return app;},restart:async()=>{await app.close();app=await createApp({directory});return app;}};}
const profile={name:'Growth partner',role:'Growth researcher',instructions:'Research the assigned market question. Cite evidence and explain uncertainty.',skillIds:[],status:'ready'};
test('create and list multiple agents persists metadata and skills across restart without granting financial authority',async t=>{
 const f=await fixture(t);assert.equal(f.app.workspace.view().agents.length,1);
 const c=await f.app.web.handle(req('/api/agents','POST',profile));assert.equal(c.status,201);const {agent}=await c.json();
 assert.equal(agent.role,profile.role);assert.equal(agent.runtime,'fixture');assert.equal(f.app.workspace.view().agents.length,2);
 await f.app.workspace.install(agent.id,'positioning-framework');await f.app.workspace.install(agent.id,'positioning-framework');
 await f.restart();const saved=f.app.workspace.get(agent.id).agent;assert.deepEqual(saved.skillIds,['positioning-framework']);assert.equal(saved.instructions,profile.instructions);
 assert.equal(f.app.treasury.snapshot().allocations.length,0);assert.equal(f.app.journal.events().filter(e=>e.type==='fixture.bootstrap').length,1);
 assert.equal((await f.app.web.handle(req('/api/agents','POST',{...profile,permit:{},runtime:'live'}))).status,400);
});
test('agent pause/draft and kill gates are decided by Rules; stale metadata edits conflict',async t=>{
 const f=await fixture(t),{agent}=await f.app.workspace.create(profile);
 await f.app.workspace.update(agent.id,{version:agent.version,status:'paused'});
 await assert.rejects(f.app.workspace.createTask(agent.id,{question:'Research evidence'}),/AGENT_PAUSED/);
 await assert.rejects(f.app.workspace.update(agent.id,{version:agent.version,name:'Stale'}),{code:'CONFLICT'});
 const baseline=f.app.rules.snapshot().config;const rules=createRules({config:baseline});rules.updateConfig({...baseline,killSwitch:true});
 assert.equal(rules.evaluate({id:'agent-create',type:'agent_manage',mode:'fixture'},{}).reasonCode,'KILL_SWITCH');
 assert.equal(f.app.rules.evaluate({id:'draft-task',type:'agent_task',mode:'fixture'},{agent:{...agent,status:'draft'}}).reasonCode,'AGENT_DRAFT');
});
test('template creation and service task feed immutable agent guidance into existing Rules-governed report execution',async t=>{
 const f=await fixture(t),{agent}=await f.app.workspace.create({templateId:'launch-strategist'});
 const created=await f.app.workspace.createTask(agent.id,{question:'What research evidence should a small business validate?',serviceId:'positioning-review'});
 const raw=f.app.journal.get('orders',created.order.id);assert.equal(raw.agentContext.id,agent.id);assert.equal(raw.agentContext.service.id,'positioning-review');
 await f.app.workflow.confirmFixturePayment(created.order.id);const finished=await f.app.workflow.run(created.order.id);assert.equal(finished.order.status,'complete');
 const report=await f.app.workflow.getReport(created.order.id,{token:created.accessToken});assert.match(report.content,/DETERMINISTIC FIXTURE/);
 const task=f.app.workspace.view().tasks[0];assert.equal(task.agentId,agent.id);assert.equal(task.status,'complete');assert.equal(task.serviceName,'Positioning review');
 assert.equal(f.app.journal.get('orders',created.order.id).request.evidence.agentContext.instructions,agent.instructions);
 await f.restart();assert.equal(f.app.workspace.get(agent.id).tasks[0].status,'complete');
 assert.equal((await f.app.web.handle(req('/api/orders/'+created.order.id+'/report'))).status,403);
});
test('workspace API validates local access, mutation origin and unsupported profile/capability fields',async t=>{
 const f=await fixture(t);assert.equal((await f.app.web.handle(req('/api/workspace'))).status,200);
 assert.equal((await f.app.web.handle(new Request('http://public.example/api/workspace'))).status,403);
 const cross=new Request('http://localhost/api/agents',{method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},body:JSON.stringify(profile)});assert.equal((await f.app.web.handle(cross)).status,403);
 assert.equal((await f.app.web.handle(req('/api/agents','POST',{...profile,skillIds:['invented-tool']}))).status,400);
 assert.equal((await f.app.web.handle(req('/api/agents','POST',{...profile,role:{}}))).status,400);
});
test('agent workspace and marketplace render user-supplied text inertly with real create/assign/install routes',async t=>{
 const f=await fixture(t);await f.app.workspace.create({...profile,name:'<script>alert(1)</script>',instructions:'<img src=x onerror=alert(1)>'});
 const data=f.app.workspace.view(),base={data,status:f.app.workflow.status(),route:parseRoute('#agents'),agentFilter:'all',marketTab:'all',category:'All categories',agentTab:'overview'};
 const html=renderWorkspace(base);assert.ok(html.includes('Create agent'));assert.ok(html.includes('Marketplace'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 const form=renderAgentForm({...base,route:parseRoute('#agents/new/launch-strategist')});assert.ok(form.includes('Launch strategist'));assert.ok(form.includes('Working instructions'));
 const market=renderMarketplace(base);for(const title of ['Agent templates','Inference','Knowledge Base','Skills','Industry Leaders’ SOUL.md','External Services','Agentic Wallet Services'])assert.ok(market.includes(title));assert.ok(market.includes('No real expert'));
 assert.equal(parseRoute('#agents/abc/task?service=positioning-review').params.get('service'),'positioning-review');
});
