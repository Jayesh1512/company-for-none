import {createHash} from 'node:crypto';
import {ContractError} from '../contracts.mjs';

export async function readExchange(response,maxBytes=262144){
 const chunks=[];let bytes=0;const reader=response.body?.getReader();
 if(!reader)throw new ContractError('PROVIDER_EMPTY_RESPONSE','Provider returned no body.');
 while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new ContractError('PROVIDER_RESPONSE_LIMIT','Provider response exceeds its byte limit.');}chunks.push(r.value);}
 const raw=Buffer.concat(chunks),wireHash=createHash('sha256').update(raw).digest('hex');
 let value,parseError=null;try{value=JSON.parse(raw.toString('utf8'));}catch{parseError='PROVIDER_INVALID_JSON';}
 return {httpStatus:response.status,ok:response.ok,value,parseError,wireHash,raw};
}
export function fixedOrigin(value,allowed){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!allowed.includes(u.origin))throw new ContractError('PROVIDER_ORIGIN_DENIED','Use a supported explicitly selected provider origin.');return u.origin;
}
export async function credential(resolveSecret,ref){const value=await resolveSecret?.(ref);if(typeof value!=='string'||!value||/[\r\n]/.test(value))throw new ContractError('CREDENTIAL_UNAVAILABLE','Configure the protected provider credential.');return value;}
export function jsonRequest(transport,url,headers,payload,{method='POST',timeoutMs=30000}={}){
 // STARTS transport synchronously. Call only from the final Rules dispatch callback.
 return transport(url,{method,headers:{...headers,'content-type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
}
