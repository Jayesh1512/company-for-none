import {ContractError} from './contracts.mjs';

// Technical mapping shared by M01's byte bound and M07's actual encrypted body.
// NEAR documents max_completion_tokens as INCLUDING reasoning; max_tokens is legacy.
export function generationInputBytes(request){
 return Buffer.byteLength(JSON.stringify(request.responseFormat?{messages:request.messages,response_format:request.responseFormat}:request.messages),'utf8');
}
export function encodeGenerationRequest(request){
 if(request.responseFormat){
  const f=request.responseFormat,j=f.json_schema;
  if(f.type!=='json_schema'||Object.keys(f).some(k=>!['type','json_schema'].includes(k))||!j||Object.keys(j).some(k=>!['name','strict','schema'].includes(k))||typeof j.name!=='string'||typeof j.strict!=='boolean'||!j.schema||j.schema.type!=='object')throw new ContractError('INVALID_RESPONSE_FORMAT','Only an admitted JSON Schema response format is supported.');
 }
 return {model:request.model,messages:request.messages,max_completion_tokens:request.maxOutputTokens,n:1,stream:false,...request.responseFormat?{response_format:request.responseFormat}:{}};
}
