import {fingerprint,ContractError} from '../contracts.mjs';
import {credential,jsonRequest,readExchange} from './http.mjs';

const ORIGIN=Object.freeze({mainnet:'https://api.outlayer.ai',testnet:'https://testnet-api.outlayer.ai'});
const fail=code=>{throw new ContractError(code,code);};
export function outlayerRequest({projectOwner,projectName,versionHash,networkId='mainnet',computeMicroUsd='1000',evaluationSpec,jobId,paymentKeyOwner,paymentKeyNonce}){
 if(!ORIGIN[networkId]||!/^([a-z0-9]+[-_.])*[a-z0-9]+$/.test(projectOwner??'')||!/^[a-zA-Z0-9_-]{1,100}$/.test(projectName??'')||!/^[a-f0-9]{64}$/.test(versionHash??'')||!/^[1-9]\d*$/.test(computeMicroUsd)||BigInt(computeMicroUsd)<1000n)fail('OUTLAYER_PROJECT_BINDING_REQUIRED');
 if(!evaluationSpec?.baseline||!evaluationSpec.candidate||!Array.isArray(evaluationSpec.contract?.requiredFields)||typeof jobId!=='string'||!jobId||jobId.length>256)fail('FIXED_EVALUATION_SPEC_REQUIRED');
 if(!/^([a-z0-9]+[-_.])*[a-z0-9]+$/.test(paymentKeyOwner??'')||!Number.isSafeInteger(paymentKeyNonce)||paymentKeyNonce<0)fail('OUTLAYER_PAYER_BINDING_REQUIRED');
 return {binding:{provider:'outlayer',networkId,projectOwner,projectName,versionHash,paymentKeyOwner,paymentKeyNonce},path:`/call/${encodeURIComponent(projectOwner)}/${encodeURIComponent(projectName)}`,
  headers:{'X-Compute-Limit':computeMicroUsd,'X-Attached-Deposit':'0'},
  body:{input:{operation:'evaluate_template',jobId,spec:evaluationSpec},version_key:versionHash,async:true,resource_limits:{max_instructions:1000000000,max_memory_mb:128,max_execution_seconds:60}},maxCostNanoUsd:(BigInt(computeMicroUsd)*1000n).toString()};
}
export function createOutlayerEvaluator({resolveSecret,secretRef='OUTLAYER_PAYMENT_KEY',transport=fetch,verifyExecution}={}){
 async function keyFor(request){const key=await credential(resolveSecret,secretRef),parts=key.split(':');if(parts.length<3||parts[0]!==request.binding.paymentKeyOwner||parts[1]!==String(request.binding.paymentKeyNonce))fail('OUTLAYER_PAYER_BINDING_MISMATCH');return key;}
 async function prepare(request){
  if(request?.binding?.provider!=='outlayer'||!ORIGIN[request.binding.networkId]||request.body?.version_key!==request.binding.versionHash||request.headers?.['X-Attached-Deposit']!=='0')fail('OUTLAYER_REQUEST_MISMATCH');
  const key=await keyFor(request),origin=ORIGIN[request.binding.networkId];
  return {start:()=>jsonRequest(transport,origin+request.path,{'X-Payment-Key':key,...request.headers},request.body),request};
 }
 async function decode(exchange,request){
  const v=exchange.value,id=v.call_id;
  if(!/^[a-f0-9-]{36}$/i.test(id??'')||!['pending','completed','failed'].includes(v.status))return {status:'unknown',code:'OUTLAYER_RESPONSE_UNCORRELATED'};
  const billed=/^(0|[1-9]\d*)$/.test(v.compute_cost??'')?(BigInt(v.compute_cost)*1000n).toString():null;
  if(billed!==null&&BigInt(billed)>BigInt(request.maxCostNanoUsd))return {status:'unknown',providerRequestId:id,code:'PROVIDER_COST_EXCEEDED',reportedCostNanoUsd:billed};
  let proof=null;
  if(v.status==='completed'&&verifyExecution)proof=await verifyExecution({callId:id,request,output:v.output,exchangeHash:exchange.wireHash});
  // Raw stdin/stdout byte hashes belong to the attestation verifier. They are
  // distinct from our canonical JSON fingerprints; neither an URL nor a hash
  // supplied alongside an output is cryptographic execution evidence.
  const matches=proof?.source==='outlayer-execution-verifier'&&proof.callId===id&&proof.wasmHash===request.binding.versionHash&&proof.inputFingerprint===fingerprint(request.body.input)&&proof.outputFingerprint===fingerprint(v.output)&&/^[a-f0-9]{64}$/.test(proof.inputHash??'')&&/^[a-f0-9]{64}$/.test(proof.outputHash??'')&&proof.evidenceRef;
  return {status:v.status==='pending'?'pending':v.status==='failed'?'failed':matches?'confirmed':'unknown',providerRequestId:id,
   code:v.status==='completed'&&!matches?'OUTLAYER_EXECUTION_PROOF_REQUIRED':null,output:v.output??null,
   reportedCostNanoUsd:billed,cost:{status:'pending',actualCostNanoUsd:null},proof:matches?proof:null,attestationPath:`/attestations/by-call/${id}`};
 }
 return {prepare,decode,
  async observe(id,request){if(!/^[a-f0-9-]{36}$/i.test(id??''))fail('ORIGINAL_CALL_ID_REQUIRED');const key=await keyFor(request);return readExchange(await jsonRequest(transport,ORIGIN[request.binding.networkId]+'/calls/'+id,{'X-Payment-Key':key},undefined,{method:'GET'}));},
  async balance(request){const key=await keyFor(request),exchange=await readExchange(await jsonRequest(transport,ORIGIN[request.binding.networkId]+'/payment-keys/balance',{'X-Payment-Key':key},undefined,{method:'GET'})),v=exchange.value;if(!exchange.ok||v?.owner!==request.binding.paymentKeyOwner||v.nonce!==request.binding.paymentKeyNonce||v.trial||!['initial_balance','spent','reserved','available'].every(k=>/^(0|[1-9]\d*)$/.test(v[k]??''))||BigInt(v.available)+BigInt(v.spent)+BigInt(v.reserved)>BigInt(v.initial_balance))fail('OUTLAYER_RESOURCE_UNVERIFIED');return {...exchange,availableNanoUsd:(BigInt(v.available)*1000n).toString(),resourceId:fingerprint({provider:'outlayer',networkId:request.binding.networkId,owner:v.owner,nonce:v.nonce})};},
  async attestation(id,request){if(!/^[a-f0-9-]{36}$/i.test(id??''))fail('ORIGINAL_CALL_ID_REQUIRED');const key=await keyFor(request);return readExchange(await jsonRequest(transport,ORIGIN[request.binding.networkId]+'/attestations/by-call/'+id,{'X-Payment-Key':key},undefined,{method:'GET'}),2*1024*1024);},
 };
}
