import {allow,deny,hold} from './policies.mjs';
import {cloudCostBound} from './cloud-cost.mjs';
import {ownerAccess} from './runtime.mjs';
import {CLOUD_PRODUCTS,describeCloudRequest} from '../cloud-contracts.mjs';

/** M01 deliberately makes no new trust-route or spending default for specialized APIs. */
export function cloudProductsDecision(action,facts,{companyId,mode,now}){
 if(!ownerAccess(facts.access,companyId,mode))return deny('ACCESS_DENIED');
 const base={grantsSpendingAuthority:false,businessDeliveryAllowed:false};
 if(action.type==='cloud_products_view')return allow({plan:{kind:'cloud_products_view',...base,products:Object.entries(CLOUD_PRODUCTS).map(([id,p])=>({id,name:p.name,use:p.use,implemented:true,executionAllowed:false,reasonCode:id==='web_search'?'SEARCH_TOTAL_BOUND_REQUIRED':'CLOUD_PRODUCT_VERIFICATION_REQUIRED'})),reporting:{deprecated:true,reasonCode:'REPORTING_MIGRATION_PENDING'}}});
 if(action.type==='cloud_catalog'){
  if(Object.keys(action).some(k=>!['id','type'].includes(k)))return deny('PROBE_INPUT_DENIED');
  return allow({plan:{kind:'cloud_catalog',...base,readOnly:true,timeoutMs:10000,maxResponseBytes:2097152}});
 }
 if(action.type==='cloud_usage')return allow({plan:{kind:'cloud_usage',...base,readOnly:true,accountingApplied:false}});
 if(['cloud_product_plan','cloud_product_execute'].includes(action.type)){
  let wire;try{wire=describeCloudRequest(facts.request);}catch{return deny('INVALID_CLOUD_REQUEST');}
  const plan={kind:'cloud_product_plan',...base,product:facts.request.product,request:structuredClone(facts.request),requestFingerprint:wire.requestFingerprint,method:wire.method,path:wire.path,encoding:wire.encoding,inputBytes:wire.inputBytes,costBound:cloudCostBound(facts.request,facts.pricing,now),executionAllowed:false,required:['Exact current owner authorization','Attributable prepaid credit and M03 reservation','Enforceable aggregate charge bound','Approved attestation and durable output-binding route'],reasonCode:facts.request.product==='web_search'?'SEARCH_TOTAL_BOUND_REQUIRED':'CLOUD_PRODUCT_VERIFICATION_REQUIRED'};
  if(action.type==='cloud_product_plan')return allow({plan});
  return hold(plan.reasonCode,{plan});
 }
 return deny('UNKNOWN_CLOUD_ACTION');
}
