import {fingerprint,ContractError} from '../contracts.mjs';
import {credential,jsonRequest,readExchange} from './http.mjs';
const BASE='https://api.agentsonintents.com';
const TYPES=new Set(['agent_create','policy_update','agent_freeze','agent_unfreeze','grant_issue','grant_revoke','execution_cancel','agent_archive','agent_restore','agent_delete','approval_vote']);
const fail=code=>{throw new ContractError(code,code);};
export function ownerIntentRequest(request){
 if(!request||!TYPES.has(request.type)||Buffer.byteLength(JSON.stringify(request))>65536)fail('OWNER_INTENT_INVALID');
 return {binding:{provider:'near-agent-api',origin:BASE,owner:request.owner??null,agentId:request.agent_id??null},path:'/v1/generate-intent',body:structuredClone(request)};
}
export function validateOwnerIntent(v,request,now=Date.now()){
 if(v?.type!==request.body.type||v.status!=='PENDING_SIGNATURE'||!/^intent_[A-Za-z0-9_-]{43}$/.test(v.correlation_id??'')||!/^[a-f0-9]{64}$/.test(v.agent_id??'')||!Number.isFinite(Date.parse(v.expires_at))||Date.parse(v.expires_at)<=now||!v.signer||typeof v.preview?.summary!=='string'||!['nep413','nep366','eip712','webauthn'].includes(v.intent?.standard)||!v.intent.payload)fail('OWNER_INTENT_RESPONSE_INVALID');
 if(request.body.agent_id&&v.agent_id!==request.body.agent_id)fail('OWNER_INTENT_AGENT_MISMATCH');
 if(request.body.owner&&fingerprint(v.signer)!==fingerprint(request.body.owner))fail('OWNER_INTENT_SIGNER_MISMATCH');
 if(v.intent.standard==='nep413'&&(!/^[A-Za-z0-9+/]{43}=$/.test(v.intent.payload.nonce??'')||!v.intent.payload.recipient||typeof v.intent.payload.message!=='string'))fail('OWNER_INTENT_NONCE_INVALID');
 return {...structuredClone(v),payloadHash:fingerprint(v.intent.payload)};
}
export function signedOwnerRequest(original,signedData,now=Date.now()){
 if(!original||Date.parse(original.expires_at)<=now)fail('OWNER_INTENT_EXPIRED');
 if(signedData?.standard!==original.intent.standard||fingerprint(original.intent.payload)!==original.payloadHash||fingerprint(signedData.payload)!==original.payloadHash)fail('OWNER_SIGNED_PAYLOAD_MISMATCH');
 const keys={nep413:['standard','payload','public_key','signature'],nep366:['standard','payload','signed_delegate'],eip712:['standard','payload','signature'],webauthn:['standard','payload','credential']}[signedData.standard];
 if(!keys||Object.keys(signedData).some(k=>!keys.includes(k)))fail('OWNER_SIGNED_DATA_INVALID');
 if(signedData.standard==='nep413'&&(!/^ed25519:/.test(signedData.public_key??'')||typeof signedData.signature!=='string'||signedData.signature.length<64))fail('OWNER_SIGNATURE_REQUIRED');
 if(signedData.standard==='nep413'&&original.signer.public_key&&signedData.public_key!==original.signer.public_key)fail('OWNER_SIGNER_KEY_MISMATCH');
 if(signedData.standard==='nep366'&&typeof signedData.signed_delegate!=='string')fail('OWNER_DELEGATE_REQUIRED');
 if(signedData.standard==='eip712'&&!/^0x[0-9a-fA-F]{130}$/.test(signedData.signature??''))fail('OWNER_SIGNATURE_REQUIRED');
 if(signedData.standard==='webauthn'&&(!signedData.credential?.response||signedData.credential.type!=='public-key'))fail('OWNER_PASSKEY_ASSERTION_REQUIRED');
 return {binding:{provider:'near-agent-api',origin:BASE,agentId:original.agent_id,intentId:original.correlation_id},path:'/v1/submit-intent',body:{type:original.type,correlation_id:original.correlation_id,signed_data:structuredClone(signedData)}};
}
export function createOwnerSigning({resolveSecret,secretRef='NEAR_INTENTS_AGENT_API_KEY',transport=fetch,clock=()=>new Date()}={}){
 return {
  async prepare(request){if(!['/v1/generate-intent','/v1/submit-intent'].includes(request.path)||request.binding?.origin!==BASE)fail('OWNER_PROVIDER_ROUTE_INVALID');const key=await credential(resolveSecret,secretRef);return {request,start:()=>jsonRequest(transport,BASE+request.path,{'X-API-Key':key,'Idempotency-Key':'owner:'+fingerprint(request)},request.body)};},
  async decode(exchange,request){
   if(!exchange.ok)return {status:exchange.httpStatus>=500?'unknown':'failed',code:'OWNER_PROVIDER_REFUSED'};
   if(request.path.endsWith('generate-intent'))return {status:'confirmed',intent:validateOwnerIntent(exchange.value,request,new Date(clock()).getTime()),authorityGranted:false};
   const v=exchange.value;
   if(v.correlation_id!==request.body.correlation_id||v.type!==request.body.type)return {status:'unknown',code:'OWNER_ORIGINAL_INTENT_REQUIRED'};
   return {status:['SUCCESS','REFUNDED','FAILED'].includes(v.status)?v.status==='SUCCESS'?'confirmed':'failed':'pending',providerRequestId:v.correlation_id,providerStatus:v.status,authorityGranted:false};
  },
  async observe(id){if(!/^intent_[A-Za-z0-9_-]{43}$/.test(id??''))fail('OWNER_ORIGINAL_INTENT_REQUIRED');const key=await credential(resolveSecret,secretRef);return readExchange(await jsonRequest(transport,BASE+'/v1/status?correlation_id='+id,{'X-API-Key':key},undefined,{method:'GET'}));},
 };
}
