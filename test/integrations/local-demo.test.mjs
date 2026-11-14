import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {startServer} from '../../server.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createRuntimeProviders} from '../../src/runtime/providers.mjs';

test('real local demo is isolated, concurrent-open idempotent, fully usable without paid prerequisites and durable across restart',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'near-real-demo-')),demoDirectory=path.join(dir,'demo');let main;
 const actualFetch=globalThis.fetch,external=[];globalThis.fetch=(target,options)=>{const u=new URL(typeof target==='string'?target:target.url??target);if(u.hostname!=='127.0.0.1'){external.push(u.origin);throw Error('Unexpected external request in local demo');}return actualFetch(target,options);};t.after(()=>{globalThis.fetch=actualFetch;});
 t.after(async()=>{await main?.close();await rm(dir,{recursive:true,force:true});});
 const make=async()=>startServer({app:await createApp({directory:path.join(dir,'main'),configPath:'',companyId:'main-company'}),port:0,demoDirectory});
 main=await make();const before=main.app.journal.snapshot();
 const request=async(base,route,body,token)=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:base,'Sec-Fetch-Site':'same-origin','content-type':'application/json','idempotency-key':'local-demo-test',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 const [a,b]=await Promise.all([request(main.url,'/api/workspace/local-demo/open',{}),request(main.url,'/api/workspace/local-demo/open',{})]);assert.equal(a.status,200,JSON.stringify(a));assert.equal(b.status,200);assert.equal(a.body.url,b.body.url);
 let demo=new URL(a.body.url).origin;const status=await request(demo,'/api/workspace/local-demo');assert.equal(status.body.active,true);assert.equal(status.body.agentCount,4);assert.equal(status.body.documentCount,4);assert.equal(status.body.serviceCount,2);assert.equal(status.body.knowledgeStatus,'connected');assert.equal(status.body.financialVersion,0);assert.equal(status.body.providerOperations,0);
 const catalog=(await request(demo,'/api/support/services')).body.services,opened=(await request(demo,'/api/support/conversations',{serviceId:catalog[0].id})).body;
 const reply=await request(demo,`/api/support/conversations/${opened.conversation.id}/messages`,{text:'What is the auto collision deductible?'},opened.accessToken);assert.equal(reply.status,200);assert.match(reply.body.reply.text,/500 demo dollars/);assert.ok(reply.body.reply.citations.length);
 // Use a different stable identity for the second message.
 const reviewed=await fetch(demo+`/api/support/conversations/${opened.conversation.id}/messages`,{method:'POST',headers:{Origin:demo,'content-type':'application/json','idempotency-key':'claim-decision',authorization:'Bearer '+opened.accessToken},body:JSON.stringify({text:'Please approve my insurance claim.'})});assert.equal(reviewed.status,200);assert.ok((await reviewed.json()).ticket);
 const inbox=(await request(demo,'/api/workspace/support')).body;assert.equal(inbox.tickets.length,1);
 const final=(await request(demo,'/api/workspace/local-demo')).body;assert.equal(final.replyCount,2);assert.equal(final.ticketCount,1);assert.ok(final.eventCount>status.body.eventCount);assert.equal(final.financialVersion,0);assert.equal(final.providerOperations,0);
 const company=(await request(demo,'/api/workspace/autonomy')).body.company;const denied=await request(demo,'/api/workspace/autonomy/control',{version:company.version,operation:'start'});assert.equal(denied.status,409);assert.equal(denied.body.error.code,'LOCAL_DEMO_SCOPE');
 const cross=await fetch(main.url+'/api/workspace/local-demo/open',{method:'POST',headers:{Origin:'https://other.invalid','content-type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 assert.deepEqual(main.app.journal.snapshot(),before,'opening/using demo must not change original company');
 await main.close();main=await make();const reopened=await request(main.url,'/api/workspace/local-demo/open',{});assert.equal(reopened.status,200,JSON.stringify(reopened));demo=new URL(reopened.body.url).origin;
 const persisted=(await request(demo,'/api/workspace/local-demo')).body;assert.equal(persisted.agentCount,4);assert.equal(persisted.documentCount,4);assert.equal(persisted.ticketCount,1);assert.equal(persisted.replyCount,2);assert.equal(persisted.returnUrl,main.url);
 const transcript=await request(demo,'/api/support/conversations/'+opened.conversation.id,undefined,opened.accessToken);assert.equal(transcript.status,200);assert.equal(transcript.body.messages.length,4);
 assert.deepEqual(external,[],'no external provider request during the complete local demo');
});
test('local-demo private context denies paid/provisioning/preflight/start paths and cannot be supplied through request facts',()=>{
 const companyId='real-local-demo',owner={companyId,role:'owner',verified:true},rules=createRules({companyId,setupOnly:true,localDemoContext:{kind:'real-local-demo',returnUrl:'http://127.0.0.1:4173'}});
 for(const type of ['agent_inference','component_inference','integration_execute','ledger_chain_publish','funding','payout','refund','runtime_probe','component_preflight','cloud_catalog'])assert.equal(rules.evaluate({id:type,type},{access:owner}).reasonCode,'LOCAL_DEMO_SCOPE',type);
 assert.equal(rules.evaluate({id:'start',type:'autonomy_control'},{access:owner,input:{operation:'start'}}).reasonCode,'LOCAL_DEMO_SCOPE');
 assert.equal(rules.evaluate({id:'status',type:'local_demo_status'},{access:owner,input:{}}).plan.active,true);
 assert.equal(rules.evaluate({id:'status',type:'local_demo_status'},{access:{role:'public'},input:{}}).reasonCode,'ACCESS_DENIED');
 const normal=createRules({companyId,setupOnly:true});assert.equal(normal.evaluate({id:'status',type:'local_demo_status'},{access:owner,localDemoContext:{kind:'real-local-demo'},input:{}}).plan.active,false);
});
test('explicit null authorization and binding isolation never fall back to the main environment',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'near-demo-env-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'owner.json');await writeFile(file,JSON.stringify({id:'MAIN-OWNER-AUTHORIZATION'}),{mode:0o600});
 const p=createRuntimeProviders({aiDemoAuthorizationPath:file,integrationAuthorizationPath:file,ledgerAuthorizationPath:file,getAiDemoAuthorization:()=>null,getIntegrationAuthorization:()=>null,getLedgerAuthorization:()=>null});assert.equal(p.getAiDemoAuthorization(),null);assert.equal(p.getIntegrationAuthorization(),null);assert.equal(p.getLedgerAuthorization(),null);
 const parent=path.join(dir,'existing');await mkdir(parent);await assert.rejects((await import('../../src/demo/local.mjs')).createLocalDemoLauncher({directory:parent,binary:path.resolve('.runtime/dependencies/jbrain/target/release/jbrain'),returnUrl:'http://127.0.0.1:4173',serve:startServer}).open(),{code:'ENOENT'});
});
