import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {createJournal} from '../../src/journal/index.mjs';
import {createCloudProductAdapter,describeCloudRequest,appendFunctionOutputs} from '../../src/cloud/index.mjs';
import {CLOUD_PRODUCTS} from '../../src/cloud-contracts.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {encodeGenerationRequest,generationInputBytes} from '../../src/generation-contracts.mjs';
import {commandResponseFormat} from '../../src/rules/command-format.mjs';
import {validateCommand} from '../../src/rules/autonomy.mjs';

const payloads={
 embeddings:{model:'test/embedding',input:['Controlled test input']},
 rerank:{model:'test/rerank',query:'Controlled query',documents:['Controlled excerpt A','Controlled excerpt B']},
 score:{model:'test/score',text_1:'One',text_2:'Two'},
 privacy_classify:{model:'test/privacy',input:'Fictional private@example.test',threshold:0.8},
 privacy_redact:{model:'test/privacy',input:['Fictional private@example.test']},
 responses:{model:'test/model',input:'Controlled function proposal',maxOutputTokens:20,tools:[{type:'function',name:'report_gap',description:'Propose a gap',parameters:{type:'object',properties:{summary:{type:'string'}}}}]},
 web_search:{model:'test/model',input:'Controlled public query',count:5,maxOutputTokens:20},
 image_generation:{model:'test/image',prompt:'Controlled test image',n:1},
 transcription:{model:'test/audio',file:{name:'upload.wav',mediaType:'audio/wav',base64:Buffer.from('test-only-audio').toString('base64')}},
 vision:{model:'test/vision',prompt:'Controlled image question',images:['data:image/png;base64,'+Buffer.from('test-only-image').toString('base64')],maxOutputTokens:20},
 system_one:{model:'test/decision',state:'Fictional backlog gap',questions:{urgency:{type:'choice',instructions:'Classify urgency',criteria:{normal:'No outage',urgent:'An outage'}}}},
};
const request=(product,extra={})=>({product,input:structuredClone(payloads[product]),timeoutMs:1000,maxInputBytes:65536,maxResponseBytes:10000,...extra});
async function journal(t){const directory=await mkdtemp('/tmp/near-cloud-products-');const j=await createJournal({directory});t.after(async()=>{await j.close();await rm(directory,{recursive:true,force:true});});return j;}
async function http(t,handler){
 const calls=[];const server=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks);const item={path:req.url,method:req.method,headers:req.headers,bytes};calls.push(item);await handler(req,res,item);});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 return {calls,transport:(url,init)=>{assert.equal(new URL(url).origin,'https://cloud-api.near.ai');return fetch(base+new URL(url).pathname+new URL(url).search,init);}};
}
// Explicit synthetic authority only for HTTP protocol tests. Product M01 never grants these routes.
function command(req,id=req.product){const action={id,type:'cloud_product_execute',requestFingerprint:fingerprint(req)};return {action,request:req,decision:{status:'allow',actionFingerprint:fingerprint(action),permit:{id:'test-permit:'+id,actionFingerprint:fingerprint(action)},plan:{kind:'cloud_product_dispatch',request:req,requestFingerprint:fingerprint(req)}}};}
const gate=(_command,start)=>start();

test('all eleven real request codecs use pinned provider paths, preserve exact inputs and leave proof/cost unaccepted',async t=>{
 const j=await journal(t);const wire=await http(t,(_req,res)=>{res.setHeader('inference-id','test-billing-id');res.setHeader('x-request-id','test-support-id');res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'test-provider-output',data:[{index:0,redacted:'Fictional contact'}],results:[{index:0,relevance_score:0.9},{index:1,relevance_score:0.1}]}));});
 const adapter=createCloudProductAdapter({journal:j,mode:'live',secretRef:'TEST_CLOUD_KEY',resolveSecret:async()=> 'sentinel-test-credential',transport:wire.transport,dispatchAuthorized:gate});
 for(const product of Object.keys(payloads))await t.test(product,async()=>{
  const req=request(product),before=wire.calls.length,result=await adapter.execute(command(req));assert.equal(wire.calls.length,before+1);assert.equal(result.status,'confirmed');assert.equal(result.accepted,false);assert.equal(result.proof.status,'unavailable');assert.equal(result.cost.status,'pending');assert.equal(result.inferenceId,'test-billing-id');assert.notEqual(result.inferenceId,result.supportRequestId);
  const sent=wire.calls.at(-1);assert.equal(sent.path,'/v1'+CLOUD_PRODUCTS[product].path);assert.equal(sent.headers.authorization,'Bearer sentinel-test-credential');
  if(product==='transcription'){assert.match(sent.headers['content-type'],/^multipart\/form-data; boundary=/);assert.match(sent.bytes.toString(),/test-only-audio/);assert.match(sent.bytes.toString(),/filename="upload.wav"/);}
  else{const parsed=JSON.parse(sent.bytes);assert.deepEqual(parsed,describeCloudRequest(req).body);if(['responses','web_search'].includes(product)){assert.equal(parsed.store,false);assert.equal(parsed.stream,false);}}
  assert.equal((await adapter.execute(command(req))).evidenceRef,result.evidenceRef);assert.equal(wire.calls.length,before+1);
 });
 assert.doesNotMatch(JSON.stringify(j.snapshot()),/sentinel-test-credential/);
 const restarted=createCloudProductAdapter({journal:j,mode:'live',transport:wire.transport,dispatchAuthorized:gate});const n=wire.calls.length;assert.equal((await restarted.reconcile(command(request('embeddings')))).status,'confirmed');assert.equal(wire.calls.length,n);
});

test('socket loss, response overflow and non-JSON errors remain unknown without a blind paid retry',async t=>{
 const j=await journal(t);const wire=await http(t,(req,res)=>{if(req.url==='/v1/embeddings')res.destroy();else if(req.url==='/v1/rerank'){res.setHeader('content-type','text/html');res.statusCode=503;res.end('<p>down</p>');}else res.end('x'.repeat(30));});
 const adapter=createCloudProductAdapter({journal:j,mode:'live',secretRef:'TEST',resolveSecret:async()=> 'test-only',transport:wire.transport,dispatchAuthorized:gate});
 for(const [product,maxResponseBytes]of [['embeddings',1000],['rerank',1000],['score',10]]){
  const c=command(request(product,{maxResponseBytes}));assert.equal((await adapter.execute(c)).status,'unknown');assert.equal((await adapter.execute(c)).status,'unknown');assert.equal((await adapter.reconcile(c)).status,'unknown');
 }
 assert.equal(wire.calls.length,3);
});

test('missing exact plan/permit, changed request, reporting credentials and final-gate rejection send zero provider calls',async t=>{
 const j=await journal(t);let calls=0,secretReads=0;const options={journal:j,mode:'live',secretRef:'TEST',resolveSecret:async()=>{secretReads++;return 'test-only';},transport:async()=>{calls++;throw Error('Must not send');},dispatchAuthorized:()=>({status:'deny',reasonCode:'KILL_SWITCH'})};const a=createCloudProductAdapter(options),c=command(request('privacy_redact'));
 assert.equal((await a.execute({...c,decision:undefined})).code,'EXACT_CLOUD_PLAN_REQUIRED');assert.equal(secretReads,0);
 assert.equal((await a.execute({...c,request:{...c.request,input:{...c.request.input,input:'changed'}}})).code,'EXACT_CLOUD_PLAN_REQUIRED');
 assert.equal((await a.execute({...c,decision:{...c.decision,permit:undefined}})).code,'POLICY_BLOCK');
 assert.equal((await a.execute(c)).code,'KILL_SWITCH');assert.equal(calls,0);
 const b=createCloudProductAdapter({...options,resolveSecret:async()=> 'rpt-test-reporting'});assert.equal((await b.execute(command(request('embeddings')))).code,'PROVIDER_UNAVAILABLE');assert.equal(calls,0);
});

test('unknown fields, storage, remote image fetches, management tools and invalid byte bounds reject before transport',()=>{
 const invalid=[{...request('embeddings'),url:'https://attacker.test'},request('responses',{input:{...payloads.responses,store:true}}),request('responses',{input:{...payloads.responses,tools:[{type:'computer_use'}]}}),request('vision',{input:{...payloads.vision,images:['http://127.0.0.1/private']}}),request('web_search',{input:{...payloads.web_search,count:21}}),request('embeddings',{maxInputBytes:1}),request('privacy_redact',{input:{...payloads.privacy_redact,threshold:1.1}}),request('transcription',{input:{...payloads.transcription,file:{...payloads.transcription.file,name:'../private.wav'}}})];
 for(const r of invalid)assert.throws(()=>describeCloudRequest(r));
});

test('function history retains original call metadata and requires a single matching output without executing anything',()=>{
 const call={type:'function_call',id:'call-item',call_id:'call-1',name:'report_gap',arguments:' {"summary":"gap"} ',thought_signature:'opaque-provider-signature',namespace:'company'};
 const original=structuredClone(call),result=appendFunctionOutputs([{role:'user',content:'Inspect gap'}],[call],[{call_id:'call-1',output:'{"admitted":false}'}]);assert.deepEqual(result[1],original);assert.deepEqual(call,original);
 assert.throws(()=>appendFunctionOutputs([], [call],[{call_id:'other',output:'{}'}]));assert.throws(()=>appendFunctionOutputs([], [call,call],[{call_id:'call-1',output:'{}'},{call_id:'call-1',output:'{}'}]));
});

test('M01 command schema reaches the exact SDK wire mapping and is included in the input byte bound',()=>{
 const responseFormat=commandResponseFormat(),request={model:'test',messages:[{role:'user',content:'One task'}],maxOutputTokens:20,responseFormat};const wire=encodeGenerationRequest(request);
 assert.deepEqual(wire.response_format,responseFormat);assert.ok(generationInputBytes(request)>Buffer.byteLength(JSON.stringify(request.messages)));assert.equal(wire.stream,false);
 for(const type of ['delegate','request_resource','propose_service','report_gap','propose_patch','complete_work'])assert.ok(responseFormat.json_schema.schema.properties.commands.items.anyOf.some(s=>s.properties.type.const===type));
 assert.equal(validateCommand({type:'complete_work',summary:'A',deliverable:'B',allow:true}),false);
 assert.throws(()=>encodeGenerationRequest({...request,responseFormat:{type:'json_schema',json_schema:{name:'bad',strict:true,schema:{type:'object'}},tools:[{type:'web_search'}]}}));
});

test('the actual verifier preparation hands the frozen command schema to SDK E2EE preparation, before any completion',async t=>{
 const {createCloudVerification,CLOUD_VERIFICATION_SDK}=await import('../../src/inference/verification.mjs');
 const j=await journal(t);let encryptedInputs=0,completions=0;
 const attestation={report:{nonce:'synthetic-test-nonce'},tcbStatus:'UpToDate',signer:{signingAlgo:'ed25519',signingAddress:'synthetic-test-signer'},deployment:{runtimeMeasurements:{}},tlsBinding:{kind:'attested'}};
 const verified={gateway:attestation,models:[attestation],verifiedAt:new Date().toISOString()};
 const spec={route:'near-tee-e2ee-chat',signingAlgo:'ed25519',allowedTcbStatuses:['UpToDate'],maxAttestationAgeMs:300000,sdk:CLOUD_VERIFICATION_SDK,attestationCacheTimeToLiveMs:0,signatureKind:'provider_tee',requireGatewayAttestation:true,requireModelAttestation:true,requireResponseSignature:true,policyFingerprint:'controlled-policy'};
 const r={model:'synthetic-test-model',messages:[{role:'user',content:'Controlled request'}],responseFormat:commandResponseFormat(),maxInputBytes:10000,maxOutputTokens:20,timeoutMs:1000,verificationSpec:spec};
 const engine=createCloudVerification({journal:j,secretRef:'TEST',resolveSecret:async()=> 'test-only',limits:{maxEvidenceBytes:100000,timeoutMs:1000},loadSdk:async()=>({AttestationClient:class {},InferenceClient:class {
  async verify(model){await this.createVerificationState(model);return verified;}
  async createVerificationState(){return {attestationResult:verified,transport:{fetch:()=>{completions++;throw Error('No completion');},fetchCompletionSignature:async()=>null}};}
 },async prepareE2eeChatRequest({request}){const body=await request.json();encryptedInputs++;assert.deepEqual(body.response_format,r.responseFormat);assert.equal(body.stream,false);throw Object.assign(Error('Stop after controlled SDK input'),{code:'CONTROLLED_INPUT_CAPTURED'});}})});
 await assert.rejects(engine.prepare({actionId:'controlled-schema-wire',request:r,verificationSpec:spec}),{code:'CONTROLLED_INPUT_CAPTURED'});assert.equal(encryptedInputs,1);assert.equal(completions,0);
});
