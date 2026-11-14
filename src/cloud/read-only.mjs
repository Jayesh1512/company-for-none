import {ContractError} from '../contracts.mjs';
import {readCloudJson} from './http.mjs';
const error=(code,message)=>{throw Object.assign(new ContractError(code,message),{httpStatus:code==='INVALID_INPUT'?400:code.startsWith('REPORTING_SCHEMA')?502:409});};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const amount=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)?x:Number.isSafeInteger(x)&&x>=0?String(x):null;
const price=p=>p&&amount(p.amount)!==null&&Number.isSafeInteger(p.scale)&&p.scale>=0&&p.scale<=30&&typeof p.currency==='string'?{amount:amount(p.amount),scale:p.scale,currency:p.currency}:null;
const strings=x=>Array.isArray(x)?x.filter(v=>typeof v==='string').slice(0,64):[];
function exactCosts(value){
 if(Array.isArray(value))return value.map(exactCosts);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>{
  if(/cost_nano_usd$/.test(key)){const n=amount(item);if(n===null)error('REPORTING_SCHEMA_INVALID','Reporting costs must be lossless nonnegative nanoUSD integers.');return [key,n];}
  return [key,exactCosts(item)];
 }));
}
export const REPORTING_MIGRATION=Object.freeze({deprecated:true,replacementBaseUrl:null,reasonCode:'REPORTING_MIGRATION_PENDING',documentation:'https://docs.near.ai/api-reference/introduction'});

export function usageWindow(input,{page=true}={}){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).some(k=>!(page?['startTime','endTime','cursor','limit']:['startTime','endTime']).includes(k)))error('INVALID_INPUT','Choose only an explicit reporting interval and returned cursor.');
 const {startTime,endTime,cursor,limit=100}=input,start=Date.parse(startTime),end=Date.parse(endTime);
 if(typeof startTime!=='string'||typeof endTime!=='string'||!Number.isFinite(start)||!Number.isFinite(end)||start>end||end-start>366*86400000||!Number.isSafeInteger(limit)||limit<1||limit>1000||cursor!==undefined&&(typeof cursor!=='string'||!cursor||cursor.length>2048))error('INVALID_INPUT','Use a valid interval of at most 366 days and a bounded page.');
 const query=new URLSearchParams({start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),source:'all'});
 if(page){query.set('limit',String(limit));if(cursor)query.set('cursor',cursor);}
 return query;
}
export function createCloudReadClient({transport=fetch,resolveSecret,reportingSecretRef,inferenceSecretRef,organizationId,allowDeprecatedReporting=false,clock=()=>new Date()}={}){
 const read=(path,token)=>readCloudJson({transport,path,token}),read_=(path,token,method,body)=>readCloudJson({transport,path,token,method,body});
 async function reporting(path,input,page){
  const query=usageWindow(input,{page});
  if(!allowDeprecatedReporting)error('REPORTING_MIGRATION_PENDING','The provider marked this reporting route deprecated. Select the documented legacy route explicitly before using it.');
  if(!uuid(organizationId)||typeof reportingSecretRef!=='string'||!reportingSecretRef)error('REPORTING_SCOPE_REQUIRED','Configure one organization and a separate reporting secret reference on the server.');
  const token=await resolveSecret?.(reportingSecretRef);
  if(typeof token!=='string'||!/^rpt-[a-zA-Z0-9_-]+$/.test(token))error('REPORTING_CREDENTIAL_REQUIRED','This route requires a protected read-only reporting token. An inference or management key is not accepted.');
  return read(`/organizations/${organizationId}/usage/${path}?${query}`,token);
 }
 return {
   // Public, unauthenticated service price read (deprecated-host notice applies; no replacement host is invented).
  async services(){
   const read=await readCloudJson({transport,path:'/services?limit=100&offset=0'}),d=read.data;
   if(!Array.isArray(d?.services)||!Number.isSafeInteger(d.total))error('PROVIDER_SCHEMA_INVALID','Service catalog has an unsupported shape.');
   const services=d.services.map(s=>{if(typeof s?.serviceName!=='string'||typeof s.unit!=='string'||amount(s.costPerUnit)===null)error('PROVIDER_SCHEMA_INVALID','Service price must be a lossless nonnegative nanoUSD integer.');return {serviceName:s.serviceName,displayName:typeof s.displayName==='string'?s.displayName:s.serviceName,unit:s.unit,costPerUnit:amount(s.costPerUnit),isActive:s.isActive!==false};});
   return {services,complete:d.total<=d.services.length,observedAt:new Date(clock()).toISOString(),grantsSpendingAuthority:false,raw:read.raw};
  },
  // Exact original inference IDs only. Needs the inference key (not a reporting token). Zero/warning is never a free request.
  async billingCosts({inferenceIds}={}){
   if(!allowDeprecatedReporting)error('REPORTING_MIGRATION_PENDING','The provider marked this billing route deprecated. Select it explicitly before using it.');
   if(!Array.isArray(inferenceIds)||!inferenceIds.length||inferenceIds.length>100||new Set(inferenceIds).size!==inferenceIds.length||!inferenceIds.every(uuid))error('INVALID_INPUT','Provide 1-100 distinct original inference IDs.');
   const token=typeof inferenceSecretRef==='string'&&inferenceSecretRef?await resolveSecret?.(inferenceSecretRef):null;
   if(typeof token!=='string'||!token||token.startsWith('rpt-'))error('REPORTING_CREDENTIAL_REQUIRED','Per-request cost needs the protected inference credential; a reporting token is not accepted.');
   const read=await read_(`/billing/costs`,token,'POST',{requestIds:inferenceIds}),d=read.data;
   if(!Array.isArray(d?.requests)||d.requests.length!==inferenceIds.length||d.warning!=null&&typeof d.warning!=='string')error('REPORTING_SCHEMA_INVALID','Billing response has an unsupported shape.');
   const requested=new Set(inferenceIds),seen=new Set();
   const costs=d.requests.map(r=>{if(!requested.has(r?.requestId)||seen.has(r.requestId)||amount(r.costNanoUsd)===null)error('REPORTING_SCHEMA_INVALID','Billing cost must be a lossless nonnegative nanoUSD integer for a requested ID.');seen.add(r.requestId);return {inferenceId:r.requestId,costNanoUsd:amount(r.costNanoUsd)};});
   return {costs,warning:d.warning??null,migration:REPORTING_MIGRATION,accountingApplied:false,observedAt:new Date(clock()).toISOString(),raw:read.raw};
  },
  async catalog(){
   // Independent public reads; there is no selected-model switch or attestation promotion.
   const settled=await Promise.allSettled([read('/models'),read('/model/list?limit=1000&offset=0')]);
   const models=settled[0].status==='fulfilled'?settled[0].value:null,pricing=settled[1].status==='fulfilled'?settled[1].value:null;
   const issues=[];
   if(!Array.isArray(models?.data?.data))issues.push('MODEL_CATALOG_UNAVAILABLE');
   if(!Array.isArray(pricing?.data?.models))issues.push('PRICING_CATALOG_UNAVAILABLE');
   const byId=new Map();
   for(const m of Array.isArray(models?.data?.data)?models.data.data:[]){if(typeof m?.id!=='string')continue;byId.set(m.id,{id:m.id,inputModalities:strings(m.input_modalities),outputModalities:strings(m.output_modalities),features:strings(m.supported_features),providerClaimedAttestation:m.attestation_supported===true,verified:false,chargeBoundsVerified:false});}
   for(const p of Array.isArray(pricing?.data?.models)?pricing.data.models:[]){if(typeof p?.modelId!=='string')continue;const old=byId.get(p.modelId)??{id:p.modelId,verified:false,chargeBoundsVerified:false};
    byId.set(p.modelId,{...old,name:typeof p.metadata?.modelDisplayName==='string'?p.metadata.modelDisplayName:p.modelId,
     inputModalities:strings(p.metadata?.architecture?.inputModalities??old.inputModalities),outputModalities:strings(p.metadata?.architecture?.outputModalities??old.outputModalities),
     features:strings(p.metadata?.supportedFeatures??old.features),providerClaimedAttestation:p.metadata?.attestationSupported===true||old.providerClaimedAttestation===true,
     pricing:{inputPerToken:price(p.inputCostPerToken),outputPerToken:price(p.outputCostPerToken),perImage:price(p.costPerImage),cacheReadPerToken:price(p.cacheReadCostPerToken)},
     deprecationDate:typeof p.metadata?.deprecationDate==='string'?p.metadata.deprecationDate:null});
   }
   return {observedAt:new Date(clock()).toISOString(),models:[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id)),issues,
    complete:!issues.length&&Number.isSafeInteger(pricing.data.total)&&pricing.data.total<=pricing.data.models.length,
    grantsSpendingAuthority:false,raw:[models?.raw,pricing?.raw].filter(Boolean)};
  },
  async usage(input){
   const read=await reporting('export',input,true),data=read.data;
   if(!Array.isArray(data?.data)||data.data.length>(input.limit??100)||data.next_cursor!=null&&typeof data.next_cursor!=='string')error('REPORTING_SCHEMA_INVALID','Reporting page has an unsupported shape.');
   const rows=data.data.map(row=>{
    if(!['inference','service'].includes(row.source)||typeof row.id!=='string'||amount(row.total_cost_nano_usd)===null)error('REPORTING_SCHEMA_INVALID','Usage cost must be a lossless nonnegative nanoUSD integer.');
    return {id:row.id,source:row.source,createdAt:row.created_at,costNanoUsd:amount(row.total_cost_nano_usd),
     inferenceId:row.inference?.inference_id??row.service?.inference_id??null,providerRequestId:row.inference?.response_id??null,
     model:row.inference?.model??null,service:row.service?.service_name??null,quantity:row.service?.quantity??null,
     tokens:row.inference?{input:row.inference.input_tokens,output:row.inference.output_tokens,cached:row.inference.cache_read_tokens}:null};
   });
   return {rows,nextCursor:data.next_cursor??null,window:{startTime:input.startTime,endTime:input.endTime},observedAt:new Date(clock()).toISOString(),migration:REPORTING_MIGRATION,accountingApplied:false,raw:read.raw};
  },
  async summary(input){const read=await reporting('summary',input,false);if(!read.data?.totals||amount(read.data.totals.total_cost_nano_usd)===null)error('REPORTING_SCHEMA_INVALID','Usage summary has an unsupported cost format.');return {summary:exactCosts(read.data),migration:REPORTING_MIGRATION,accountingApplied:false,observedAt:new Date(clock()).toISOString(),raw:read.raw};},
 };
}

// Exact provider-ID join only. Never match by question, model, time or estimated cost.
export function correlateUsage(rows,work){
 return rows.map(row=>{
  const matches=work.filter(w=>row.inferenceId&&row.inferenceId===w.inferenceId||row.providerRequestId&&row.providerRequestId===w.providerRequestId);
  return {...row,attribution:matches.length===1?{status:'matched',...matches[0]}:{status:matches.length?'ambiguous':'unmatched'},accountingApplied:false};
 });
}
