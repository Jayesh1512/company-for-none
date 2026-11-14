import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createCloudReadClient,correlateUsage,usageWindow} from '../../src/cloud/read-only.mjs';
const org='11111111-1111-4111-8111-111111111111';
const window={startTime:'2026-11-01T00:00:00Z',endTime:'2026-11-02T00:00:00Z'};
async function server(t,handler){const calls=[];const s=createServer(async(req,res)=>{calls.push({url:req.url,method:req.method,headers:req.headers});res.setHeader('content-type','application/json');await handler(req,res);});s.listen(0,'127.0.0.1');await once(s,'listening');t.after(()=>new Promise(r=>s.close(r)));return {calls,transport:(url,init)=>{assert.equal(new URL(url).origin,'https://cloud-api.near.ai');return fetch(`http://127.0.0.1:${s.address().port}`+new URL(url).pathname+new URL(url).search,init);}};}
const pricing={modelId:'test/model',inputCostPerToken:{amount:'9007199254740993',scale:9,currency:'USD'},outputCostPerToken:{amount:12,scale:9,currency:'USD'},costPerImage:{amount:0,scale:9,currency:'USD'},metadata:{modelDisplayName:'Test model',attestationSupported:true,architecture:{inputModalities:['text','image'],outputModalities:['text']},supportedFeatures:['structured_outputs']}};
test('public catalog joins current IDs and integer pricing without selecting or verifying a model',async t=>{
 const h=await server(t,(req,res)=>res.end(JSON.stringify(req.url==='/v1/models'?{data:[{id:'test/model'}]}:{models:[pricing],total:1,limit:1000,offset:0})));
 const c=createCloudReadClient({transport:h.transport,resolveSecret:()=>{throw Error('Catalog must not resolve secrets');}});const result=await c.catalog();
 assert.equal(h.calls.length,2);assert.ok(h.calls.every(c=>c.method==='GET'&&!c.headers.authorization));assert.equal(result.models[0].pricing.inputPerToken.amount,'9007199254740993');assert.deepEqual(result.models[0].inputModalities,['text','image']);assert.equal(result.models[0].verified,false);assert.equal(result.models[0].chargeBoundsVerified,false);assert.equal(result.grantsSpendingAuthority,false);assert.equal(result.complete,true);
});
test('one catalog failure or malformed schema remains partial, without a cached verified fallback',async t=>{
 const h=await server(t,(req,res)=>{if(req.url==='/v1/models'){res.statusCode=503;res.end('down');}else res.end(JSON.stringify({models:[pricing],total:1}));});const result=await createCloudReadClient({transport:h.transport}).catalog();assert.ok(result.issues.includes('MODEL_CATALOG_UNAVAILABLE'));assert.equal(result.complete,false);assert.equal(result.models[0].verified,false);assert.equal(h.calls.length,2);
 const malformed=await createCloudReadClient({transport:async()=>new Response('{"data":{},"models":{}}')}).catalog();assert.equal(malformed.models.length,0);assert.equal(malformed.issues.length,2);
});
test('reporting is explicit, read-only, tenant-bound, paged and separate from the inference credential',async t=>{
 const h=await server(t,(req,res)=>{assert.equal(req.headers.authorization,'Bearer rpt-controlled-reporting');assert.ok(req.url.startsWith(`/v1/organizations/${org}/usage/`));assert.equal(req.headers['x-org-id'],undefined);res.end(JSON.stringify(req.url.includes('/summary?')?{totals:{total_cost_nano_usd:15,inference_cost_nano_usd:10,service_cost_nano_usd:5}}:{data:[{id:'row1',source:'inference',total_cost_nano_usd:10,inference:{inference_id:'inference-1',response_id:'output-1',model:'test/model',input_tokens:3,output_tokens:2,cache_read_tokens:0}},{id:'row2',source:'service',total_cost_nano_usd:5,service:{inference_id:'inference-1',service_name:'web_search',quantity:1}}],next_cursor:'opaque-next-cursor'}));});
 let secretCalls=0;const c=createCloudReadClient({transport:h.transport,organizationId:org,reportingSecretRef:'TEST_REPORTING',allowDeprecatedReporting:true,resolveSecret:async ref=>{secretCalls++;assert.equal(ref,'TEST_REPORTING');return 'rpt-controlled-reporting';}});
 const result=await c.usage({...window,limit:2});assert.equal(result.rows.length,2);assert.equal(result.rows[0].costNanoUsd,'10');assert.equal(result.rows[1].source,'service');assert.equal(result.nextCursor,'opaque-next-cursor');assert.equal(h.calls.length,1);assert.equal(result.migration.deprecated,true);assert.equal(result.accountingApplied,false);
 const parsed=new URL(h.calls[0].url,'http://localhost');assert.equal(parsed.searchParams.get('start_time'),'2026-11-01T00:00:00.000Z');assert.equal(parsed.searchParams.get('source'),'all');
 await c.usage({...window,cursor:result.nextCursor,limit:2});assert.match(h.calls[1].url,/cursor=opaque-next-cursor/);assert.equal((await c.summary(window)).summary.totals.total_cost_nano_usd,'15');assert.equal(secretCalls,3);
 const attributed=correlateUsage(result.rows,[{workId:'work1',agentId:'manager',inferenceId:'inference-1',providerRequestId:'output-1'}]);assert.equal(attributed[0].attribution.workId,'work1');assert.equal(attributed[1].attribution.workId,'work1');assert.equal(attributed[1].accountingApplied,false);
 assert.equal(correlateUsage(result.rows,[{workId:'a',inferenceId:'inference-1'},{workId:'b',inferenceId:'inference-1'}])[0].attribution.status,'ambiguous');assert.equal(correlateUsage(result.rows,[])[0].attribution.status,'unmatched');
});
test('deprecated reporting, wrong token class, arbitrary host/tenant/filter, invalid windows fail before I/O',async()=>{
 let calls=0;const options={transport:async()=>{calls++;throw Error('Must not call');},organizationId:org,reportingSecretRef:'TEST',resolveSecret:async()=> 'sk-not-a-reporting-token'};
 await assert.rejects(createCloudReadClient(options).usage(window),{code:'REPORTING_MIGRATION_PENDING'});
 await assert.rejects(createCloudReadClient({...options,allowDeprecatedReporting:true}).usage(window),{code:'REPORTING_CREDENTIAL_REQUIRED'});
 for(const input of [{...window,url:'https://other.invalid'}, {...window,organizationId:'other'}, {...window,startTime:'no-date'}, {...window,limit:1001}, {...window,startTime:'2024-01-01'}, {...window,cursor:''}])assert.throws(()=>usageWindow(input),{code:'INVALID_INPUT'});assert.equal(calls,0);
});
test('unsafe numeric costs and redirect responses do not become an actual zero or another-host read',async t=>{
 const h=await server(t,(req,res)=>res.end('{"data":[{"source":"inference","id":"unsafe","total_cost_nano_usd":9007199254740993}]}'));
 const c=createCloudReadClient({transport:h.transport,organizationId:org,reportingSecretRef:'TEST',allowDeprecatedReporting:true,resolveSecret:async()=> 'rpt-controlled'});await assert.rejects(c.usage(window),{code:'REPORTING_SCHEMA_INVALID'});assert.equal(h.calls.length,1);
 const redirects=await createCloudReadClient({transport:async(_url,init)=>{assert.equal(init.redirect,'error');throw Error('redirect rejected');}}).catalog();assert.equal(redirects.models.length,0);assert.equal(redirects.complete,false);
});
