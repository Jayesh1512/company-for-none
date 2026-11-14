import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createJournal} from '../../src/journal/index.mjs';
import {createApp} from '../../src/app.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {createCloudProductAdapter} from '../../src/cloud/index.mjs';
import {createCloudReadClient} from '../../src/cloud/read-only.mjs';
import {cloudTechnicalFacts,validateRerankOutput} from '../../src/cloud/technical-facts.mjs';

const evidence=f=>new URL('./evidence/'+f,import.meta.url);
const companyId='cloud-tools-test',token='controlled-owner-token',owner={companyId,verified:true,role:'owner'};
const ID1='11111111-1111-4111-8111-111111111111',ID2='22222222-2222-4222-8222-222222222222';
async function server(t,handler){const calls=[];const s=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);calls.push({url:req.url,method:req.method,headers:req.headers,body:Buffer.concat(chunks)});await handler(req,res,calls.at(-1));});s.listen(0,'127.0.0.1');await once(s,'listening');t.after(()=>new Promise(r=>s.close(r)));
 return {calls,transport:(url,init)=>{assert.equal(new URL(url).origin,'https://cloud-api.near.ai');return fetch(`http://127.0.0.1:${s.address().port}${new URL(url).pathname}${new URL(url).search}`,init);}};}
const reqOf=(product,input)=>({product,input,timeoutMs:1000,maxInputBytes:65536,maxResponseBytes:100000});

test('captured public evidence is byte-identical to its manifest hashes and the live-shaped service list parses exactly',async t=>{
 const manifest=JSON.parse(await readFile(evidence('manifest.json'),'utf8'));
 for(const [file,meta] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(evidence(file))).digest('hex'),meta.sha256,file);
 const raw=await readFile(evidence('services.raw.json'));
 const h=await server(t,(req,res)=>{res.setHeader('content-type','application/json');res.end(raw);});
 const result=await createCloudReadClient({transport:h.transport,resolveSecret:()=>{throw Error('public read must not resolve a secret');}}).services();
 assert.equal(h.calls[0].method,'GET');assert.equal(h.calls[0].headers.authorization,undefined);
 const search=result.services.find(s=>s.serviceName==='web_search');assert.deepEqual([search.unit,search.costPerUnit,search.isActive],['request','5000000',true]);
 assert.equal(result.grantsSpendingAuthority,false);assert.equal(Buffer.from(result.raw.bodyBase64,'base64').equals(raw),true);
});

test('service list rejects unsafe or malformed prices instead of coercing them',async t=>{
 for(const body of [{services:[{serviceName:'x',unit:'request',costPerUnit:9007199254740993}],total:1},{services:[{serviceName:'x',unit:'request',costPerUnit:'-1'}],total:1},{services:{},total:1}]){
  const h=await server(t,(_r,res)=>res.end(JSON.stringify(body)));await assert.rejects(createCloudReadClient({transport:h.transport}).services(),{code:'PROVIDER_SCHEMA_INVALID'});
 }
});

test('technical facts describe exact bytes and billing dimensions but contain no money or cap, and unbounded routes say why',()=>{
 const rr=cloudTechnicalFacts(reqOf('rerank',{model:'m',query:'héllo',documents:['aa','bbbb']}));
 assert.equal(rr.queryBytes,6);assert.deepEqual(rr.documentBytes,[2,4]);assert.equal(rr.documentCount,2);assert.equal(rr.providerEnforcedBound,false);assert.deepEqual(rr.priceDimensions,['input_tokens','output_tokens']);
 assert.doesNotMatch(Object.keys(rr).join(','),/nano|cost|usd|amount/i);
 const search=cloudTechnicalFacts(reqOf('web_search',{model:'m',input:'q',count:20,maxOutputTokens:5}));
 assert.equal(search.localTokenCeilingSupported,false);assert.equal(search.unboundedReasonCode,'SEARCH_COUNT_IS_RESULTS_PER_SEARCH_NOT_SEARCH_CALLS');assert.equal(search.resultCountPerSearch,20);assert.ok(search.priceDimensions.includes('service:web_search/request'));
 for(const [p,input] of [['responses',{model:'m',input:'x',maxOutputTokens:5}],['system_one',{model:'m',state:'s',questions:{q:{type:'box',instructions:'i'}}}],['transcription',{model:'m',file:{name:'upload.wav',mediaType:'audio/wav',base64:'AAAA'}}]])assert.equal(cloudTechnicalFacts(reqOf(p,input)).localTokenCeilingSupported,false,p);
 assert.equal(cloudTechnicalFacts(reqOf('image_generation',{model:'m',prompt:'p',n:3})).images,3);
});

test('rerank output validation rejects duplicate/out-of-range indexes, ciphertext scores and altered echoed documents',()=>{
 const req=reqOf('rerank',{model:'m',query:'q',documents:['a','b']});
 const ok={results:[{index:1,relevance_score:0.9,document:{text:'b'}},{index:0,relevance_score:0.1,document:'a'}]};
 assert.deepEqual(validateRerankOutput(ok,req),[{index:1,score:0.9},{index:0,score:0.1}]);
 for(const bad of [{results:[{index:0,relevance_score:1},{index:0,relevance_score:0.5}]},{results:[{index:2,relevance_score:1}]},{results:[{index:0,relevance_score:'ciphertext'}]},{results:[{index:0,relevance_score:1,document:'tampered'}]},{results:[]},{results:[{index:0,relevance_score:NaN}]},{}])assert.equal(validateRerankOutput(bad,req),null);
});

test('billing cost read is explicit, uses only the inference key and exact original IDs; zero/warning is reported as provider data, never normalized to free',async t=>{
 const h=await server(t,(req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({requests:[{requestId:ID1,costNanoUsd:42},{requestId:ID2,costNanoUsd:0}],warning:'one ID matched no record'}));});
 const base={transport:h.transport,inferenceSecretRef:'INF',resolveSecret:async ref=>{assert.equal(ref,'INF');return 'sk-test-inference';}};
 await assert.rejects(createCloudReadClient(base).billingCosts({inferenceIds:[ID1]}),{code:'REPORTING_MIGRATION_PENDING'});assert.equal(h.calls.length,0);
 await assert.rejects(createCloudReadClient({...base,allowDeprecatedReporting:true,resolveSecret:async()=> 'rpt-reporting-token'}).billingCosts({inferenceIds:[ID1]}),{code:'REPORTING_CREDENTIAL_REQUIRED'});
 const c=createCloudReadClient({...base,allowDeprecatedReporting:true});
 for(const ids of [[],['not-a-uuid'],[ID1,ID1],Array.from({length:101},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`)])await assert.rejects(c.billingCosts({inferenceIds:ids}),{code:'INVALID_INPUT'});
 assert.equal(h.calls.length,0);
 const r=await c.billingCosts({inferenceIds:[ID1,ID2]});assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,'POST');assert.equal(h.calls[0].url,'/v1/billing/costs');assert.equal(h.calls[0].headers.authorization,'Bearer sk-test-inference');assert.deepEqual(JSON.parse(h.calls[0].body),{requestIds:[ID1,ID2]});
 assert.deepEqual(r.costs,[{inferenceId:ID1,costNanoUsd:'42'},{inferenceId:ID2,costNanoUsd:'0'}]);assert.equal(r.warning,'one ID matched no record');assert.equal(r.accountingApplied,false);assert.equal(r.migration.replacementBaseUrl,null);
});

test('billing cost schema failures: unrequested ID, unsafe integer, wrong count',async t=>{
 for(const body of [{requests:[{requestId:ID2,costNanoUsd:1}]},{requests:[{requestId:ID1,costNanoUsd:9007199254740993}]},{requests:[]}]){
  const h=await server(t,(_r,res)=>res.end(JSON.stringify(body)));
  await assert.rejects(createCloudReadClient({transport:h.transport,allowDeprecatedReporting:true,inferenceSecretRef:'I',resolveSecret:async()=> 'sk-x'}).billingCosts({inferenceIds:[ID1]}),{code:'REPORTING_SCHEMA_INVALID'});
 }
});

// --- adapter ---
function command(req,id,plan={}){const action={id,type:'cloud_product_execute',requestFingerprint:fingerprint(req)};return {action,request:req,decision:{status:'allow',actionFingerprint:fingerprint(action),permit:{id:'test-permit:'+id,actionFingerprint:fingerprint(action)},plan:{kind:'cloud_product_dispatch',request:req,requestFingerprint:fingerprint(req),...plan}}};}
const gate=(_c,start)=>start();
async function journal(t){const directory=await mkdtemp('/tmp/near-e2e-tools-');const j=await createJournal({directory});t.after(async()=>{await j.close();await rm(directory,{recursive:true,force:true});});return j;}

test('adapter keeps provider IDs as received, hashes exact bytes, records M01 planned bound verbatim, and never calls proof/cost final',async t=>{
 const j=await journal(t);const body=JSON.stringify({id:'rerank-provider-id',model:'m',results:[{index:1,relevance_score:0.8},{index:0,relevance_score:0.2}]});
 const h=await server(t,(_r,res)=>{res.setHeader('inference-id',ID1);res.setHeader('x-request-id','support-1');res.setHeader('content-type','application/json');res.end(body);});
 const adapter=createCloudProductAdapter({journal:j,mode:'live',secretRef:'K',resolveSecret:async()=> 'sk-test',transport:h.transport,dispatchAuthorized:gate});
 const req=reqOf('rerank',{model:'m',query:'q',documents:['a','b']}),planned={supplied:'by-m01',opaque:true};
 const r=await adapter.execute(command(req,'r1',{costBound:planned}));
 assert.equal(r.status,'confirmed');assert.equal(r.accepted,false);assert.equal(r.inferenceId,ID1);assert.equal(r.providerRequestId,'rerank-provider-id');assert.equal('derivedInferenceId' in r,false);
 assert.equal(r.exactBytes.responseHash,createHash('sha256').update(body).digest('hex'));assert.equal(r.exactBytes.requestHash,createHash('sha256').update(h.calls[0].body).digest('hex'));
 assert.deepEqual(r.cost,{status:'pending',actualCostNanoUsd:null,plannedBound:planned});assert.equal(r.proof.reasonCode,'SPECIALIZED_ENDPOINT_HAS_NO_DOCUMENTED_SIGNATURE');
 assert.equal((await adapter.execute(command(req,'r1',{costBound:planned}))).evidenceRef,r.evidenceRef);assert.equal(h.calls.length,1);
});

test('a malformed or tampered rerank output is unresolved (reservation stays), is not confirmed and is not retried',async t=>{
 const j=await journal(t);const h=await server(t,(_r,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'x',results:[{index:5,relevance_score:1}]}));});
 const adapter=createCloudProductAdapter({journal:j,mode:'live',secretRef:'K',resolveSecret:async()=> 'sk-test',transport:h.transport,dispatchAuthorized:gate});
 const req=reqOf('rerank',{model:'m',query:'q',documents:['a','b']}),c=command(req,'bad');
 const r=await adapter.execute(c);assert.equal(r.status,'unknown');assert.equal(r.code,'PROVIDER_OUTPUT_SCHEMA_INVALID');assert.equal(r.accepted,false);
 assert.equal((await adapter.execute(c)).status,'unknown');assert.equal((await adapter.reconcile(c)).status,'unknown');assert.equal(h.calls.length,1);
});

// --- company knowledge rerank bridge on the real app/JBrain-stand-in ---
const req=(route,body)=>new Request('http://localhost'+route,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...body?{body:JSON.stringify(body)}:{}});
async function app(t,extra={}){const directory=await mkdtemp('/tmp/near-e2e-tools-app-');let instance;const options={directory,companyId,configPath:null,ownerToken:token,...extra};instance=await createApp(options);t.after(async()=>{await instance.close();await rm(directory,{recursive:true,force:true});});return {get app(){return instance;},async reopen(){await instance.close();instance=await createApp(options);}};}
function jbrain(){const saved=new Map();return {health:async()=>({status:'ready'}),read:async id=>saved.get(id),write:async p=>{const revision='revision-'+(saved.size+1)+'-'+p.markdown.length;saved.set(p.id,{id:p.id,markdown:p.markdown,revision});return {id:p.id,requestId:p.requestId,revision};}};}

test('rerank bridge binds output to current grants, exact request and revisions; stale/removed/tampered fail closed; no data beyond selection; survives restart',async t=>{
 let cloud=0;const h=await app(t,{jbrainClient:jbrain(),cloudProductTransport:async()=>{cloud++;throw Error('no provider call in bridge');}});
 const a=(await h.app.workspace.create({name:'Analyst',role:'Analyst',instructions:'Use permitted context.',skillIds:[]},owner)).agent;
 const d1=(await h.app.knowledge.save({title:'One',body:'FIRST-DOC-BODY',visibility:'restricted',agentIds:[a.id]},{access:owner,requestId:'d1'})).document;
 const d2=(await h.app.knowledge.save({title:'Two',body:'SECOND-DOC-BODY',visibility:'restricted',agentIds:[a.id]},{access:owner,requestId:'d2'})).document;
 const hidden=(await h.app.knowledge.save({title:'Hidden',body:'HIDDEN-DOC-BODY',visibility:'restricted',agentIds:[]},{access:owner,requestId:'d3'})).document;
 const input={agentId:a.id,knowledgeIds:[d1.id,d2.id],query:'Which?',model:'rerank-model'};
 const plan=await h.app.cloudProducts.rankKnowledge(input,owner);
 assert.equal(plan.plan.technicalFacts.documentCount,2);assert.doesNotMatch(JSON.stringify(plan),/HIDDEN-DOC-BODY/);assert.equal(cloud,0);
 const output={id:'p',results:[{index:1,relevance_score:0.9},{index:0,relevance_score:0.3}]};
 const bind=extra=>h.app.cloudProducts.bindRanking({...input,requestFingerprint:plan.plan.requestFingerprint,documentRevisions:plan.documentRevisions,output,...extra},owner);
 const ok=await bind();assert.deepEqual(ok.rankings.map(r=>[r.rank,r.id,r.revision]),[[1,d2.id,d2.revision],[2,d1.id,d1.revision]]);assert.equal(ok.accepted,false);assert.equal(ok.advisoryOnly,true);assert.equal(ok.proof.status,'unavailable');assert.doesNotMatch(JSON.stringify(ok),/DOC-BODY/);
 await assert.rejects(bind({output:{results:[{index:0,relevance_score:1},{index:0,relevance_score:1}]}}),{code:'PROVIDER_OUTPUT_SCHEMA_INVALID'});
 await assert.rejects(bind({knowledgeIds:[d1.id,hidden.id]}),{code:'KNOWLEDGE_ACCESS_DENIED'});
 await assert.rejects(bind({query:'Different?'}),{code:'STALE_KNOWLEDGE_CONTEXT'});
 await assert.rejects(bind({documentRevisions:[{id:d1.id,revision:'forged'},{id:d2.id,revision:d2.revision}]}),{code:'STALE_KNOWLEDGE_CONTEXT'});
 await assert.rejects(h.app.cloudProducts.bindRanking({...input,requestFingerprint:plan.plan.requestFingerprint,documentRevisions:plan.documentRevisions,output,extra:1},owner),{code:'INVALID_INPUT'});
 await h.reopen();assert.equal((await bind()).rankings.length,2);
 // edit one document: old plan becomes stale (revision/content changed)
 await h.app.knowledge.save({id:d1.id,title:'One',body:'FIRST-DOC-BODY-EDITED',visibility:'restricted',agentIds:[a.id],expectedRevision:d1.revision,version:d1.version},{access:owner,requestId:'d1-edit'});
 await assert.rejects(bind(),{code:'STALE_KNOWLEDGE_CONTEXT'});
 // grant removed from the second document: current access denies, even with a previously valid plan
 const fresh=await h.app.cloudProducts.rankKnowledge(input,owner);
 await h.app.knowledge.save({id:d2.id,title:'Two',body:'SECOND-DOC-BODY',visibility:'restricted',agentIds:[],expectedRevision:d2.revision,version:d2.version},{access:owner,requestId:'d2-revoke'});
 await assert.rejects(h.app.cloudProducts.bindRanking({...input,requestFingerprint:fresh.plan.requestFingerprint,documentRevisions:fresh.documentRevisions,output},owner),{code:'KNOWLEDGE_ACCESS_DENIED'});
 assert.equal(cloud,0);assert.equal(h.app.treasury.snapshot().version,0);
});

test('execute passes observed price facts and technical facts to M01 but cannot bypass its hold; services read persists raw evidence across restart',async t=>{
 const raw=await readFile(evidence('services.raw.json'));let facts;
 const calls=[];const h=await app(t,{cloudProductTransport:async(url,init)=>{calls.push(url);assert.equal(init.method,'GET');assert.equal(init.headers.authorization,undefined);return new Response(raw);}});
 const view=await h.app.cloudProducts.services(owner);assert.equal(view.services[0].costPerUnit,'5000000');assert.equal(calls.length,1);
 await h.reopen();
 const wrapped={evaluate:(a,f)=>{facts=f;return h.app.rules.evaluate(a,f);},snapshot:()=>h.app.rules.snapshot()};
 const {createNearCloudProducts}=await import('../../src/runtime/cloud-products.mjs');
 const tools=createNearCloudProducts({journal:h.app.journal,rules:wrapped,knowledge:h.app.knowledge,providers:{resolveSecret:async()=>{throw Error('no secret');}},companyId,transport:async()=>{throw Error('no network');}});
 const request=reqOf('web_search',{model:'m',input:'public question',count:20,maxOutputTokens:10});
 const r=await tools.execute(request,owner,'k1');assert.equal(r.status,'not_submitted');assert.equal(r.completionSent,false);
 assert.equal(facts.pricing.services[0].serviceName,'web_search');assert.equal(facts.pricing.services[0].costPerUnit,'5000000');assert.equal(facts.technicalFacts.unboundedReasonCode,'SEARCH_COUNT_IS_RESULTS_PER_SEARCH_NOT_SEARCH_CALLS');
 assert.equal(JSON.stringify(h.app.journal.snapshot()).includes(raw.toString('base64')),true,'raw service bytes are retained');
});
