import {createHash} from 'node:crypto';
import {describeCloudRequest} from '../cloud-contracts.mjs';

// Technical shape of an exact request only. No prices, no money arithmetic, no caps:
// M01 (Rules) alone turns these facts + observed provider prices into a bound plan.
const bytes=x=>Buffer.byteLength(typeof x==='string'?x:JSON.stringify(x),'utf8');
const list=x=>Array.isArray(x)?x:[x];
// Billing dimensions the provider's public catalog/service list expose per product. Anything not listed is undocumented.
const DIMENSIONS={
 rerank:['input_tokens','output_tokens'],embeddings:['input_tokens','output_tokens'],score:['input_tokens','output_tokens'],
 privacy_classify:['input_tokens','output_tokens'],privacy_redact:['input_tokens','output_tokens'],
 image_generation:['images','input_tokens','output_tokens'],
 web_search:['input_tokens','output_tokens','service:web_search/request'],
 responses:['input_tokens','output_tokens','cache_read_tokens'],vision:['input_tokens','output_tokens'],
 transcription:[],system_one:[],
};
// Technical limits M01 may weigh; never enforced by the provider and never a money value.
const UNBOUNDED={
 web_search:'SEARCH_COUNT_IS_RESULTS_PER_SEARCH_NOT_SEARCH_CALLS',
 responses:'ROUND_COUNT_AND_REASONING_NOT_DOCUMENTED_AS_CAPPED',
 vision:'IMAGE_TOKEN_COUNT_UNDOCUMENTED',
 transcription:'AUDIO_BILLING_UNIT_UNDOCUMENTED',
 system_one:'PRICE_UNIT_UNDOCUMENTED',
};
export function cloudTechnicalFacts(request){
 const wire=describeCloudRequest(request),i=request.input,p=request.product;
 const facts={product:p,model:i.model,requestFingerprint:wire.requestFingerprint,wireInputBytes:wire.inputBytes,priceDimensions:DIMENSIONS[p],
  localTokenCeilingSupported:!UNBOUNDED[p],unboundedReasonCode:UNBOUNDED[p]??null,providerEnforcedBound:false};
 if(p==='rerank')Object.assign(facts,{queryBytes:bytes(i.query),documentBytes:i.documents.map(bytes),documentCount:i.documents.length,pairsBilledAsSeparateModelInputs:true,note:'Query is evaluated once per document pair; provider template overhead per pair is not documented.'});
 else if(p==='embeddings'||p.startsWith('privacy_'))Object.assign(facts,{textBytes:list(i.input).map(bytes)});
 else if(p==='score')Object.assign(facts,{textBytes:[bytes(i.text_1),bytes(i.text_2)]});
 else if(p==='image_generation')Object.assign(facts,{promptBytes:bytes(i.prompt),images:i.n});
 else if(p==='web_search')Object.assign(facts,{inputBytes:bytes(i.input),resultCountPerSearch:i.count,maxOutputTokens:i.maxOutputTokens});
 else if(p==='responses')Object.assign(facts,{maxOutputTokens:i.maxOutputTokens});
 else if(p==='vision')Object.assign(facts,{promptBytes:bytes(i.prompt),images:i.images.length,maxOutputTokens:i.maxOutputTokens});
 return facts;
}

const sha=b=>createHash('sha256').update(b).digest('hex');
/** Exact-byte hashes for any later provider/gateway signature check. Specialized endpoints document no signature route. */
export function responseEvidence({product,requestBytes,responseBytes}){
 const signed=['responses','web_search'].includes(product);
 return {requestHash:sha(requestBytes),responseHash:sha(responseBytes),
  proof:{status:'unavailable',reasonCode:signed?'GATEWAY_SIGNATURE_NOT_VERIFIED_BY_THIS_ADAPTER':'SPECIALIZED_ENDPOINT_HAS_NO_DOCUMENTED_SIGNATURE'}};
}

/** Structural integrity only (not TEE proof). Returns ranked [{index,score}] or null if it does not match the exact request. */
export function validateRerankOutput(output,request){
 const docs=request.input.documents;
 if(!output||!Array.isArray(output.results)||!output.results.length||output.results.length>docs.length)return null;
 const seen=new Set(),ranked=[];
 for(const r of output.results){
  if(!r||!Number.isSafeInteger(r.index)||r.index<0||r.index>=docs.length||seen.has(r.index)||typeof r.relevance_score!=='number'||!Number.isFinite(r.relevance_score))return null;
  const d=r.document;if(d!==undefined&&d!==null&&(typeof d==='string'?d:d?.text)!==docs[r.index])return null;
  seen.add(r.index);ranked.push({index:r.index,score:r.relevance_score});
 }
 return ranked.sort((a,b)=>b.score-a.score||a.index-b.index);
}
