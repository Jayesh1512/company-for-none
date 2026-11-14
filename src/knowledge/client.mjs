import {ContractError} from '../contracts.mjs';
export function createJBrainClient({url,token='',timeoutMs=5000,fetch:transport=globalThis.fetch}={}) {
 if(!url)return null;
 const base=new URL(url);
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new ContractError('INVALID_INPUT','Use an HTTP JBrain service URL without credentials.');
 async function request(path,body) {
  let response;
  try{response=await transport(new URL(path,base),{method:body?'POST':'GET',headers:{...(token?{authorization:`Bearer ${token}`} :{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeoutMs),redirect:'error'});}catch{throw Object.assign(new ContractError('JBRAIN_UNAVAILABLE','JBrain could not be reached. The original write identity is retained for retry.'),{httpStatus:503});}
  const raw=await response.text();if(raw.length>2_000_000)throw new ContractError('JBRAIN_RESPONSE_INVALID','JBrain response exceeded the transport bound.');
  let value;try{value=JSON.parse(raw);}catch{throw new ContractError('JBRAIN_RESPONSE_INVALID','JBrain returned an invalid response.');}
  if(!response.ok)throw Object.assign(new ContractError(value.error?.code??'JBRAIN_ERROR',response.status===409?'JBrain revision conflict. Reload the latest document before merging changes.':response.status===401?'JBrain service authentication failed.':value.error?.message??'JBrain request failed.'),{httpStatus:response.status===409?409:response.status===404?404:503});
  return value;
 }
 return {health:()=>request('/health'),read:id=>request('/v1/concept?id='+encodeURIComponent(id)),write:input=>request('/v1/operations',input),operation:id=>request('/v1/operations/'+encodeURIComponent(id))};
}
