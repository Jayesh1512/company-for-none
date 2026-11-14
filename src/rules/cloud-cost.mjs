import {isIntegerAmount} from './config.mjs';
import {cloudTechnicalFacts} from '../cloud/technical-facts.mjs';

/** Public unit prices are diagnostic facts. Missing tokenization/template/output or
 * service-call limits cannot be repaired by selecting an invented overhead. This
 * plan carries no executable monetary bound and never replaces attributable credit. */
export function cloudCostBound(request,pricing,now){
 const technical=cloudTechnicalFacts(request),observed=Date.parse(pricing?.observedAt),fresh=Number.isFinite(observed)&&observed<=now&&now-observed<=300000;
 const catalogStatus=!pricing?'missing':!Number.isFinite(observed)||observed>now?'invalid':!fresh?'stale':pricing.catalogComplete!==true?'incomplete':'current';
 const model=pricing?.models?.find(m=>m.id===technical.model),unitPrices=[];
 if(catalogStatus==='current')for(const [dimension,key] of [['input_tokens','inputPerToken'],['output_tokens','outputPerToken'],['images','perImage'],['cache_read_tokens','cacheReadPerToken']]){
  const p=model?.pricing?.[key];if(technical.priceDimensions.includes(dimension)&&p?.currency==='USD'&&isIntegerAmount(p.amount)&&Number.isSafeInteger(p.scale)&&p.scale>=0&&p.scale<=30)unitPrices.push({dimension,amount:p.amount,scale:p.scale,currency:'USD'});
 }
 if(catalogStatus==='current'&&technical.product==='web_search'){
  const p=pricing.services?.find(s=>s.serviceName==='web_search'&&s.unit==='request'&&s.isActive===true);if(p&&isIntegerAmount(p.costPerUnit))unitPrices.push({dimension:'service:web_search/request',amount:p.costPerUnit,scale:9,currency:'USD'});
 }
 const missing=technical.priceDimensions.filter(d=>!unitPrices.some(p=>p.dimension===d));
 const unresolved=['PROVIDER_ENFORCED_AGGREGATE_BOUND_REQUIRED',...(catalogStatus==='current'?[]:['CURRENT_COMPLETE_PRICE_CATALOG_REQUIRED']),...missing.length?['PRICE_DIMENSIONS_REQUIRED']:[],...technical.unboundedReasonCode?[technical.unboundedReasonCode]:[]];
 if(technical.product==='rerank')unresolved.push('PER_PAIR_TEMPLATE_AND_OUTPUT_TOKEN_LIMIT_REQUIRED');
 else if(technical.localTokenCeilingSupported)unresolved.push('PROVIDER_INPUT_AND_OUTPUT_TOKEN_LIMIT_REQUIRED');
 return {status:'unavailable',reasonCode:technical.product==='web_search'?'SEARCH_TOTAL_BOUND_REQUIRED':'PROVIDER_CHARGE_BOUND_REQUIRED',requestFingerprint:technical.requestFingerprint,providerEnforced:false,maxCostNanoUsd:null,catalogStatus,observedAt:Number.isFinite(observed)?new Date(observed).toISOString():null,unitPrices,missingDimensions:missing,unresolved,grantsSpendingAuthority:false};
}
