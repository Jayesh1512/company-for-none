import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {config} from '../rules/fixtures.mjs';
import {renderCloudProducts} from '../../public/cloud-products.js';

const companyId='cloud-workspace-test',token='controlled-owner-token',owner={companyId,verified:true,role:'owner'};
const request={product:'privacy_redact',input:{model:'test/privacy',input:'Fictional contact@example.test'},timeoutMs:1000,maxInputBytes:65536,maxResponseBytes:10000};
const req=(route,body,auth=true)=>new Request('http://localhost'+route,{method:body?'POST':'GET',headers:{...(auth?{authorization:`Bearer ${token}`} :{}),'content-type':'application/json','idempotency-key':'controlled-request'},...body?{body:JSON.stringify(body)}:{}});
async function app(t,extra={}){const directory=await mkdtemp('/tmp/near-cloud-workspace-');let instance;const options={directory,companyId,configPath:null,ownerToken:token,...extra};instance=await createApp(options);t.after(async()=>{await instance.close();await rm(directory,{recursive:true,force:true});});return {get app(){return instance;},async reopen(){await instance.close();instance=await createApp(options);}};}

test('owner can inspect and plan tools in setup without keys or paid effects; anonymous/cross-origin/oversized requests cannot',async t=>{
 let network=0,secrets=0;const h=await app(t,{cloudProductTransport:async()=>{network++;throw Error('No external call authorized');},resolveSecret:async()=>{secrets++;throw Error('No credentials allowed');}});
 assert.equal((await h.app.web.handle(req('/api/workspace/cloud',undefined,false))).status,403);
 const view=await (await h.app.web.handle(req('/api/workspace/cloud'))).json();assert.equal(view.products.length,11);assert.ok(view.products.every(p=>p.implemented&&!p.executionAllowed));assert.equal(view.grantsSpendingAuthority,false);assert.equal(network,0);
 const plan=await (await h.app.web.handle(req('/api/workspace/cloud/plan',request))).json();assert.equal(plan.kind,'cloud_product_plan');assert.equal(plan.executionAllowed,false);assert.equal(plan.inputBytes>0,true);
 const execution=await (await h.app.web.handle(req('/api/workspace/cloud/execute',request))).json();assert.equal(execution.status,'not_submitted');assert.equal(execution.code,'CLOUD_PRODUCT_VERIFICATION_REQUIRED');assert.equal(execution.completionSent,false);
 const reporting=await h.app.web.handle(req('/api/workspace/cloud/usage',{startTime:'2026-11-01T00:00:00Z',endTime:'2026-11-02T00:00:00Z'}));assert.equal(reporting.status,409);
 const evil=req('/api/workspace/cloud/catalog',{});evil.headers.set('origin','https://untrusted.invalid');assert.equal((await h.app.web.handle(evil)).status,403);
 assert.equal((await h.app.web.handle(req('/api/workspace/cloud/plan',{...request,proof:{verified:true}}))).status,409);
 assert.equal((await h.app.web.handle(req('/api/workspace/cloud/plan',{...request,input:{...request.input,input:'a'.repeat(262144)}}))).status,413);
 assert.equal(network,0);assert.equal(secrets,0);assert.equal(Object.keys(h.app.journal.snapshot().operations).length,0);assert.equal(h.app.treasury.snapshot().version,0);
 const publicStatus=JSON.stringify(await (await h.app.web.handle(req('/api/status',undefined,false))).json());assert.doesNotMatch(publicStatus,/Fictional contact|test\/privacy/);
});

test('explicit public catalog read persists observed facts across restart but never grants readiness or model selection',async t=>{
 const urls=[];const h=await app(t,{cloudProductTransport:async(url,init)=>{urls.push(url);assert.equal(init.method,'GET');assert.equal(init.headers.authorization,undefined);return new Response(JSON.stringify(url.endsWith('/models')?{data:[{id:'observed/model'}]}:{models:[{modelId:'observed/model',metadata:{modelDisplayName:'Observed model',attestationSupported:true}}],total:1}));}});
 const before=h.app.rules.snapshot();const response=await h.app.web.handle(req('/api/workspace/cloud/catalog',{}));assert.equal(response.status,200);assert.equal((await response.json()).models[0].verified,false);assert.equal(urls.length,2);assert.equal(h.app.journal.list('runtimeFacts').length,0);assert.equal(h.app.rules.snapshot().policyEpoch,before.policyEpoch);
 await h.reopen();const view=h.app.cloudProducts.view(owner);assert.equal(view.catalog.models[0].id,'observed/model');assert.equal(urls.length,2);assert.equal(h.app.treasury.snapshot().version,0);
});

test('M01 holds specialized execution even with live commercial config and fabricated proof/budget facts',()=>{
 const c=config();c.mode='live';const rules=createRules({config:c,companyId,getRuntimeFacts:()=>({observations:[]})});
 const d=rules.evaluate({id:'attempt',type:'cloud_product_execute',mode:'live'},{access:owner,request,financial:{version:0},proof:{verified:true},authorization:{maxCalls:100,allow:true}});assert.equal(d.status,'hold');assert.equal(d.permit,undefined);assert.equal(d.reasonCode,'CLOUD_PRODUCT_VERIFICATION_REQUIRED');
 const search=rules.evaluate({id:'search',type:'cloud_product_execute'},{access:owner,request:{...request,product:'web_search',input:{model:'test/model',input:'Question',count:1,maxOutputTokens:20}}});assert.equal(search.reasonCode,'SEARCH_TOTAL_BOUND_REQUIRED');
});

test('JBrain rerank plan captures only explicit agent grants and exact revisions, with no egress or automatic write',async t=>{
 const saved=new Map();let cloudCalls=0;
 const client={health:async()=>({status:'ready'}),read:async id=>saved.get(id),write:async p=>{const revision='revision-'+(saved.size+1);saved.set(p.id,{id:p.id,markdown:p.markdown,revision});return {id:p.id,requestId:p.requestId,revision};}};
 const h=await app(t,{jbrainClient:client,cloudProductTransport:async()=>{cloudCalls++;throw Error('No paid calls');}});
 const a=(await h.app.workspace.create({name:'Selected analyst',role:'Analyst',instructions:'Use permitted company context.',skillIds:[]},owner)).agent;
 const selected=(await h.app.knowledge.save({title:'Selected',body:'SELECTED-PRIVATE-CONTEXT',visibility:'restricted',agentIds:[a.id]},{access:owner,requestId:'selected'})).document;
 const other=(await h.app.knowledge.save({title:'Other',body:'UNSELECTED-PRIVATE-CONTEXT',visibility:'restricted',agentIds:[]},{access:owner,requestId:'other'})).document;
 const plan=await h.app.cloudProducts.rankKnowledge({agentId:a.id,knowledgeIds:[selected.id],query:'Find guidance',model:'test/rerank'},owner);
 assert.deepEqual(plan.documentRevisions,[{id:selected.id,revision:selected.revision}]);assert.match(JSON.stringify(plan.plan.request),/SELECTED-PRIVATE-CONTEXT/);assert.doesNotMatch(JSON.stringify(plan),/UNSELECTED-PRIVATE-CONTEXT/);assert.equal(plan.providerCalled,false);assert.equal(cloudCalls,0);
 await assert.rejects(h.app.cloudProducts.rankKnowledge({agentId:a.id,knowledgeIds:[other.id],query:'Find',model:'test/rerank'},owner),{code:'KNOWLEDGE_ACCESS_DENIED'});assert.equal(cloudCalls,0);assert.equal(h.app.journal.list('orders').length,0);
});

test('usage cursor is bound to the saved time interval and exact original IDs; financial records stay untouched',async t=>{
 const org='11111111-1111-4111-8111-111111111111',window={startTime:'2026-11-01T00:00:00Z',endTime:'2026-11-02T00:00:00Z'};let calls=0;
 const h=await app(t,{reportingOrganizationId:org,reportingSecretRef:'TEST',allowDeprecatedReporting:true,resolveSecret:async()=> 'rpt-controlled-only',cloudProductTransport:async()=>{calls++;return new Response(JSON.stringify({data:[{id:'r1',source:'service',total_cost_nano_usd:7,service:{inference_id:'original-inference',service_name:'web_search',quantity:1}}],next_cursor:'same-opaque-cursor'}));}});
 await h.app.journal.transaction({actionId:'controlled-id-correlation',fingerprint:'test-only'},tx=>tx.put('internalResults','original',{id:'original',workId:'original-work',effectId:'original-effect',result:{inferenceId:'original-inference'}}));
 const view=await h.app.cloudProducts.usage(window,owner);assert.equal(view.rows[0].attribution.workId,'original-work');assert.equal(view.rows[0].costNanoUsd,'7');assert.equal(calls,1);
 await h.reopen();await h.app.cloudProducts.usage({...window,cursor:view.nextCursor},owner);assert.equal(calls,2);
 await assert.rejects(h.app.cloudProducts.usage({...window,startTime:'2026-10-31T00:00:00Z',cursor:view.nextCursor},owner),{code:'INVALID_INPUT'});assert.equal(calls,2);assert.equal(h.app.treasury.snapshot().version,0);
 assert.doesNotMatch(JSON.stringify(h.app.journal.snapshot()),/rpt-controlled-only/);
});

test('settings escapes model/provider values and shows a factual local plan without an execution button',()=>{
 const view={products:[{id:'privacy_redact',name:'<script>bad</script>',use:'Owner review',executionAllowed:false}],reporting:{enabled:false},catalog:{models:[{id:'bad" onmouseover="x',name:'<img src=x>',inputModalities:['text']}],observedAt:'2026-11-14',issues:[]}};
 const html=renderCloudProducts({nearCloud:view,nearCloudPlan:{reasonCode:'CLOUD_PRODUCT_VERIFICATION_REQUIRED',required:['Approved proof route'],product:'privacy_redact'}});assert.doesNotMatch(html,/<script>|<img src=x>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/No spending authority/);assert.doesNotMatch(html,/data-action="cloud-execute"/);
});
