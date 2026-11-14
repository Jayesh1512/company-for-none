import {randomUUID} from 'node:crypto';
import {ContractError} from '../contracts.mjs';
import {boundedBytes,bytesHash} from '../inference/capture.mjs';
export const CLOUD_BASE='https://cloud-api.near.ai/v1';
const fail=(code,message)=>{throw Object.assign(new ContractError(code,message),{httpStatus:code==='PROVIDER_ACCESS_DENIED'?403:502});};

// Pinned origin, no automatic redirects/retries or caller-supplied headers.
export async function readCloudJson({transport=fetch,path,token,method='GET',body,timeoutMs=10000,maxResponseBytes=2*1024*1024}){
 const response=await transport(CLOUD_BASE+path,{method,redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{accept:'application/json',...(token?{authorization:`Bearer ${token}`} :{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const bytes=await boundedBytes(response.body,maxResponseBytes);
 if(!response.ok)fail(response.status===401||response.status===403?'PROVIDER_ACCESS_DENIED':'PROVIDER_READ_FAILED','NEAR Cloud read failed. No retry was sent.');
 let data;try{data=JSON.parse(Buffer.from(bytes).toString('utf8'));}catch{fail('PROVIDER_SCHEMA_INVALID','NEAR Cloud returned invalid JSON.');}
 return {data,raw:{path,httpStatus:response.status,bodyBase64:Buffer.from(bytes).toString('base64'),bodyHash:bytesHash(bytes)},supportRequestId:response.headers.get('x-request-id')};
}
export async function prepareCloudPost({wire,request,transport=fetch,resolveSecret,secretRef}){
 const token=await resolveSecret?.(secretRef);
 if(typeof token!=='string'||!token||token.startsWith('rpt-'))fail('INFERENCE_CREDENTIAL_REQUIRED','A protected inference credential is required. Reporting tokens cannot infer.');
 const headers={authorization:`Bearer ${token}`,'x-request-id':randomUUID(),accept:'application/json'};let body;
 if(wire.encoding==='multipart'){
  body=new FormData();const i=wire.body;
  body.set('model',i.model);body.set('file',new Blob([Buffer.from(i.file.base64,'base64')],{type:i.file.mediaType}),i.file.name);if(i.language)body.set('language',i.language);
 }else {headers['content-type']='application/json';body=JSON.stringify(wire.body);}
 // Starting this callback invokes fetch immediately after the final M01 gate.
 let used=false;
 return ()=>{if(used)fail('REQUEST_ALREADY_DISPATCHED','A prepared Cloud request is single use.');used=true;
  return transport(CLOUD_BASE+wire.path,{method:'POST',redirect:'error',headers,body,signal:AbortSignal.timeout(request.timeoutMs)});
 };
}
