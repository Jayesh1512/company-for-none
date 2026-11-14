import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fingerprint} from '../../src/contracts.mjs';
import {readExchange} from '../../src/integrations/http.mjs';
import {outlayerRequest,createOutlayerEvaluator} from '../../src/integrations/outlayer.mjs';
import {pingRequest,createPingPay} from '../../src/integrations/pingpay.mjs';
import {ownerIntentRequest,validateOwnerIntent,signedOwnerRequest,createOwnerSigning} from '../../src/integrations/owner-signing.mjs';
import {accountPlan,checkpointFeedPlan} from '../../src/integrations/accounts.mjs';
import {nativeFeeReceipt} from '../../src/onchain/fees.mjs';
import {evaluateTemplateChange} from '../../src/autonomy/evaluation.mjs';
import {ledgerBindingHash} from '../../src/rules/onchain-ledger.mjs';

const spec={baseline:{fields:[{name:'answer',required:false}]},candidate:{fields:[{name:'answer',required:true},{name:'evidence',required:true}]},contract:{requiredFields:['answer','evidence']}};
const outRequest=()=>outlayerRequest({projectOwner:'company.near',projectName:'evaluate',versionHash:'a'.repeat(64),paymentKeyOwner:'payer.near',paymentKeyNonce:1,evaluationSpec:spec,jobId:'exact-job-1'});
const requirement={scheme:'exact',network:'eip155:1',asset:'asset-id',extra:{assetTransferMethod:'near-intents',paymentFlow:'upfront',destination:'merchant.near'}};
const quoteRequest=()=>pingRequest({kind:'pingpay_quote',resourceId:'report:v1',requirements:requirement,refundTo:'origin-refund-address'});
const now=Date.parse('2026-11-14T16:00:00Z');
const generated=request=>({type:request.body.type,status:'PENDING_SIGNATURE',correlation_id:'intent_'+'a'.repeat(43),agent_id:'a'.repeat(64),expires_at:new Date(now+60000).toISOString(),preview:{summary:'Exact provider operation'},signer:request.body.owner??{type:'near',account_id:'owner.near'},intent:{standard:'nep413',payload:{message:'EXACT provider message',recipient:'agentsonintents.com',nonce:Buffer.alloc(32,1).toString('base64')}}});
const exchange=async(value,status=200)=>readExchange(new Response(JSON.stringify(value),{status}));

test('OutLayer request pins payer, code, unique input, compute/deposit and resource limits',()=>{
 const p=outRequest();assert.equal(p.body.version_key,p.binding.versionHash);assert.equal(p.headers['X-Attached-Deposit'],'0');assert.equal(p.maxCostNanoUsd,'1000000');assert.equal(p.body.input.jobId,'exact-job-1');assert.equal(p.body.async,true);assert.equal(p.body.resource_limits.max_execution_seconds,60);
 for(const patch of [{versionHash:'latest'},{networkId:'other'},{paymentKeyNonce:-1},{paymentKeyOwner:undefined},{computeMicroUsd:'999'},{jobId:''}])assert.throws(()=>outlayerRequest({...p.binding,evaluationSpec:spec,computeMicroUsd:'1000',jobId:'job',...patch}));
});
test('OutLayer resolves credentials before final transport; original reads stay on the fixed origin',async()=>{
 const p=outRequest(),calls=[];const client=createOutlayerEvaluator({resolveSecret:async()=> 'payer.near:1:PRIVATE-NOT-LOGGED',transport:(url,options)=>{calls.push({url,options});return Promise.resolve(new Response('{}'));}});
 const handle=await client.prepare(p);assert.equal(calls.length,0);await handle.start();assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.outlayer.ai/call/company.near/evaluate');assert.equal(calls[0].options.redirect,'error');
 await assert.rejects(createOutlayerEvaluator({resolveSecret:async()=> 'other.near:1:secret'}).prepare(p),{code:'OUTLAYER_PAYER_BINDING_MISMATCH'});
 await assert.rejects(client.observe('https://evil.example',p),{code:'ORIGINAL_CALL_ID_REQUIRED'});
});
test('OutLayer success and attestation URL never replace execution proof or verified cost',async()=>{
 const client=createOutlayerEvaluator(),p=outRequest(),v={call_id:'550e8400-e29b-41d4-a716-446655440000',status:'completed',output:evaluateTemplateChange(spec),compute_cost:'12',attestation_url:'https://evil.example'};
 const r=await client.decode(await exchange(v),p);assert.equal(r.status,'unknown');assert.equal(r.reportedCostNanoUsd,'12000');assert.equal(r.cost.status,'pending');assert.equal(r.proof,null);
 assert.equal((await client.decode(await exchange({...v,compute_cost:'1001'}),p)).code,'PROVIDER_COST_EXCEEDED');
});
test('OutLayer byte hashes are separate from semantic fingerprints and bind this exact job',async()=>{
 const p=outRequest(),v={call_id:'550e8400-e29b-41d4-a716-446655440000',status:'completed',output:{x:1},compute_cost:'12'};
 // Explicit test-only verifier port. This is not vendor proof.
 const proof={source:'outlayer-execution-verifier',callId:v.call_id,wasmHash:p.binding.versionHash,inputHash:'b'.repeat(64),outputHash:'c'.repeat(64),inputFingerprint:fingerprint(p.body.input),outputFingerprint:fingerprint(v.output),evidenceRef:'private:test-only-proof'};
 const client=createOutlayerEvaluator({verifyExecution:async()=>proof});assert.equal((await client.decode(await exchange(v),p)).status,'confirmed');
 p.body.input.jobId='different-job';assert.equal((await client.decode(await exchange(v),p)).status,'unknown');
});
test('OutLayer real balance codec attributes the presented payer and excludes trial/call grants from money',async()=>{
 let body={owner:'payer.near',nonce:1,initial_balance:'100',spent:'20',reserved:'30',available:'50'};
 const client=createOutlayerEvaluator({resolveSecret:async()=> 'payer.near:1:secret',transport:async url=>{assert.equal(url,'https://api.outlayer.ai/payment-keys/balance');return new Response(JSON.stringify(body));}});
 const r=await client.balance(outRequest());assert.equal(r.availableNanoUsd,'50000');assert.ok(r.resourceId);
 for(const patch of [{owner:'other.near'},{nonce:2},{available:'51'},{trial:{calls_left:100}}]){const old=body;body={...body,...patch};await assert.rejects(client.balance(outRequest()),{code:'OUTLAYER_RESOURCE_UNVERIFIED'});body=old;}
});
test('Ping uses the documented quote/deposit protocol and exact original requirements/refund',async()=>{
 const q=quoteRequest(),calls=[];const client=createPingPay({resolveSecret:async()=> 'private-key',transport:(url,options)=>{calls.push({url,options});return Promise.resolve(new Response('{}'));}});
 const h=await client.prepare(q);assert.equal(calls.length,0);await h.start();assert.equal(calls[0].url,'https://pay.pingpay.io/agentpay/x402/verify');assert.equal(JSON.parse(calls[0].options.body).paymentPayload.payload.refundTo,'origin-refund-address');
 const r=await client.decode(await exchange({isValid:true,extra:{operationToken:'original-token',depositAddress:'original-address',amountIn:'123',refundDeadline:new Date(now+60000).toISOString()}}),q);
 const settle=pingRequest({kind:'pingpay_settle',resourceId:'report:v1',requirements:requirement,quote:r.quote,txHash:'original-origin-tx'});assert.equal(settle.body.paymentPayload.payload.operationToken,'original-token');assert.equal(settle.path,'/agentpay/x402/settle');
 assert.throws(()=>pingRequest({kind:'pingpay_settle',resourceId:'other',requirements:{...requirement,asset:'changed'},quote:r.quote,txHash:'tx'}),{code:'PINGPAY_ORIGINAL_QUOTE_REQUIRED'});
 assert.throws(()=>pingRequest({kind:'pingpay_quote',resourceId:'r',requirements:requirement,refundTo:'x',origin:'https://evil.example'}),{code:'PROVIDER_ORIGIN_DENIED'});
});
test('Ping pending/short/terminal/provider-success remain separate and never imply payment evidence',async()=>{
 const client=createPingPay(),q=quoteRequest();
 const r=pingRequest({kind:'pingpay_settle',resourceId:'report:v1',requirements:requirement,quote:{operationToken:'t',depositAddress:'a',requirementsHash:fingerprint(requirement)},txHash:'original'});
 assert.equal((await client.decode(await exchange({success:false,errorReason:'settlement_pending'}),r)).status,'pending');
 assert.equal((await client.decode(await exchange({success:false,extra:{status:'INCOMPLETE_DEPOSIT'}}),r)).status,'pending');
 assert.equal((await client.decode(await exchange({success:false,errorReason:'refunded'},402),r)).status,'failed');
 const success=await client.decode(await exchange({success:true,network:'near:mainnet',transaction:'hash'}),r);assert.equal(success.status,'unknown');assert.equal(success.settlementVerified,false);
 assert.equal((await client.decode(await exchange({accepts:[requirement]},503),pingRequest({kind:'pingpay_offers',resourceId:'r',amountOut:'1'}))).status,'unknown');
 assert.equal((await client.decode(await exchange({isValid:true,extra:{}},503),q)).status,'unknown');
});
test('Agent API owner signing keeps the exact provider payload and correlation through all standards',()=>{
 const req=ownerIntentRequest({type:'agent_create',owner:{type:'near',account_id:'owner.near'},name:'Company',policy:{}}),v=validateOwnerIntent(generated(req),req,now),signed={standard:'nep413',payload:v.intent.payload,public_key:'ed25519:'+'2'.repeat(44),signature:'a'.repeat(88)};
 const submitted=signedOwnerRequest(v,signed,now);assert.equal(submitted.body.correlation_id,v.correlation_id);assert.deepEqual(submitted.body.signed_data.payload,v.intent.payload);
 assert.throws(()=>signedOwnerRequest(v,{...signed,payload:{...signed.payload,message:'reconstructed'}},now),{code:'OWNER_SIGNED_PAYLOAD_MISMATCH'});
 assert.throws(()=>signedOwnerRequest(v,signed,now+60001),{code:'OWNER_INTENT_EXPIRED'});
 for(const [standard,extra]of [['nep366',{signed_delegate:'encoded-original'}],['eip712',{signature:'0x'+'a'.repeat(130)}],['webauthn',{credential:{type:'public-key',response:{signature:'assertion'}}}]]){
  const original={...v,intent:{standard,payload:{exact:standard}},payloadHash:fingerprint({exact:standard})};assert.equal(signedOwnerRequest(original,{standard,payload:original.intent.payload,...extra},now).body.signed_data.standard,standard);
 }
 assert.throws(()=>validateOwnerIntent({...generated(req),signer:{type:'near',account_id:'attacker.near'}},req,now),{code:'OWNER_INTENT_SIGNER_MISMATCH'});
});
test('owner intent success remains provider observation, never a grant or cash observation',async()=>{
 const r={...signedOwnerRequest(validateOwnerIntent(generated(ownerIntentRequest({type:'agent_freeze',agent_id:'a'.repeat(64)})),ownerIntentRequest({type:'agent_freeze',agent_id:'a'.repeat(64)}),now),{standard:'nep413',payload:generated(ownerIntentRequest({type:'agent_freeze'})).intent.payload,public_key:'ed25519:abc',signature:'a'.repeat(88)},now)};
 const client=createOwnerSigning();const v=await client.decode(await exchange({correlation_id:r.body.correlation_id,type:r.body.type,status:'SUCCESS'}),r);assert.equal(v.status,'confirmed');assert.equal(v.authorityGranted,false);
 assert.equal((await client.decode(await exchange({correlation_id:'wrong',type:r.body.type,status:'SUCCESS'}),r)).status,'unknown');
});
test('named/role account and function-call key plans allocate parent funding without changing custody',()=>{
 const p=accountPlan({parentId:'owner.near',companyLabel:'company',roles:['manager','backlog'],initialBalanceYocto:'100',ownerPublicKey:'ed25519:'+'2'.repeat(44),writerPublicKey:'ed25519:'+'3'.repeat(44),gasAllowanceYocto:'20',contractId:'ledger.near'});
 assert.equal(p.totalFundingYocto,'300');assert.equal(p.transactions[0].actions[1].params.deposit,'300');assert.equal(p.transactions[1].signerId,p.companyAccount);assert.equal(p.transactions[1].actions[1].params.deposit,'100');assert.equal(p.executionAllowed,false);assert.equal(p.routeChanged,false);assert.deepEqual(p.writerKey.actions[0].params.accessKey.permission.FunctionCall.method_names,['append']);assert.equal(p.writerKey.depositAllowed,false);
 assert.throws(()=>accountPlan({parentId:'owner.near',companyLabel:'company',roles:['manager','manager'],initialBalanceYocto:'100',ownerPublicKey:'ed25519:'+'2'.repeat(44)}));
});
test('checkpoint feed contains only an already confirmed commitment and cannot publish',()=>{
 assert.throws(()=>checkpointFeedPlan({checkpoint:null,destination:'near.social'}),{code:'CONFIRMED_CHECKPOINT_REQUIRED'});
 const binding={networkId:'mainnet',contractId:'ledger.near',signerId:'writer.near'},checkpoint={sequence:1,hash:'a'.repeat(64),companyHash:'b'.repeat(64),private:'NEVER',updatedAt:new Date(now).toISOString()};checkpoint.bindingHash=ledgerBindingHash(checkpoint.companyHash,binding);
 const p=checkpointFeedPlan({checkpoint,binding,destination:'near.social'});assert.equal(p.executionAllowed,false);assert.ok(!JSON.stringify(p).includes('NEVER'));assert.equal(p.content.confirmedAt,checkpoint.updatedAt);
 assert.throws(()=>checkpointFeedPlan({checkpoint,binding:{...binding,networkId:'testnet'},destination:'near.social'}),{code:'CONFIRMED_CHECKPOINT_REQUIRED'});
});
test('native fee receipts independently bind the final signer/contract/call and sum every outcome once',()=>{
 const binding={networkId:'mainnet',contractId:'ledger.near',signerId:'writer.near'},nativeCall={method_name:'append',gas:'30',deposit:'0',args:{a:1}},transactionHash='2'.repeat(44);
 const raw={final_execution_status:'FINAL',transaction:{hash:transactionHash,signer_id:binding.signerId,receiver_id:binding.contractId,actions:[{FunctionCall:{...nativeCall,args:Buffer.from(JSON.stringify(nativeCall.args)).toString('base64')}}]},transaction_outcome:{id:'tx',outcome:{tokens_burnt:'500000000000000000000000'}},receipts_outcome:[{id:'receipt',outcome:{tokens_burnt:'250000000000000000000000'}}],status:{Failure:{error:'actually failed but billed'}}};
 const options={operationId:'original',transactionHash,binding,nativeCall,settledBlockHeight:100,usdBound:{source:'native-usd-upper-bound',nanoUsdPerNear:'2000000000',reference:'private-fx-evidence',validUntil:new Date(now+60000).toISOString()},now,evidenceRef:'private:actual-receipt'};
 const r=nativeFeeReceipt(raw,options);assert.equal(r.actualFeeYocto,'750000000000000000000000');assert.equal(r.actualCostNanoUsd,'1500000000');assert.equal(r.executionSucceeded,false);
 for(const altered of [{...raw,final_execution_status:'EXECUTED'},{...raw,transaction:{...raw.transaction,signer_id:'other.near'}},{...raw,receipts_outcome:[raw.transaction_outcome]}])assert.throws(()=>nativeFeeReceipt(altered,options));
 assert.throws(()=>nativeFeeReceipt(raw,{...options,settledBlockHeight:undefined}),{code:'NATIVE_FEE_BLOCK_REQUIRED'});
});
test('Rust executable matches the actual fixed JS evaluator over repaired, regressed and invalid candidates',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../artifacts/mentor-implementation/evaluator-manifest.json',import.meta.url),'utf8'));assert.equal(manifest.deployed,false);
 try{await access('contracts/template-evaluator/target/release/company-template-evaluator');}catch{const built=spawnSync('cargo',['build','--locked','--release','--manifest-path','contracts/template-evaluator/Cargo.toml'],{encoding:'utf8',timeout:120000});assert.equal(built.status,0,built.stderr);}
 for(const candidate of [spec.candidate,spec.baseline,{fields:[{name:'answer',required:true}]},{fields:[{name:'answer',required:true},{name:'answer',required:true}]},{fields:[{name:'bad-name',required:true}]}]){
  const input={...spec,candidate},run=spawnSync('contracts/template-evaluator/target/release/company-template-evaluator',[],{input:JSON.stringify({operation:'evaluate_template',jobId:'test',spec:input}),encoding:'utf8',maxBuffer:262144});assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),evaluateTemplateChange(input));
 }
});
