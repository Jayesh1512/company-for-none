import {hash,integer,isIntegerAmount} from './config.mjs';
import {allow,deny,hold} from './policies.mjs';
import {ownerAccess} from './runtime.mjs';
import {lifetimeExposure,totalCeiling} from './ceiling.mjs';

export const INTEGRATION_KINDS=Object.freeze(['outlayer_evaluate','pingpay_offers','pingpay_quote','pingpay_settle','owner_generate','owner_submit','checkpoint_feed']);
export const INTEGRATION_LIFETIME_MAX_NANO_USD='5000000000';
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).every(k=>keys.includes(k));
const fresh=(v,now)=>Number.isFinite(Date.parse(v))&&Date.parse(v)>now;
export function validateIntegrationPolicy(p){
 if(!exact(p,['operations','maxRequestNanoUsd'])||!Array.isArray(p.operations)||new Set(p.operations).size!==p.operations.length||p.operations.some(x=>!INTEGRATION_KINDS.includes(x))||!isIntegerAmount(p.maxRequestNanoUsd))throw new TypeError('Invalid nearIntegrations policy');
 return structuredClone(p);
}
export function integrationDecision(action,facts,ctx){
 if(!ownerAccess(facts.access,ctx.companyId,ctx.config?.mode??'setup'))return deny('ACCESS_DENIED');
 const data=ctx.data??{},input=facts.input??{};
 if(action.type==='integration_execute'&&data.incidents?.some(i=>i.companyId===ctx.companyId&&i.type==='provider_cost_bound_breach'))return hold('PROVIDER_COST_BOUND_BREACH');
 if(action.type==='integration_observed'){
  const p=data.plans?.find(p=>`${p.id}:execute`===action.operationId&&p.companyId===ctx.companyId),o=data.operations?.find(o=>o.actionId===`near-integrations:${action.operationId}`),r=facts.financial?.reservations?.find(r=>r.actionId===action.operationId);
  if(!p||!o||!r||['reconciled','released'].includes(r.status)||!o.result||!(['unknown','pending','failed'].includes(o.result.status)||o.result.cost?.status==='pending'))return hold('ORIGINAL_UNRESOLVED_OPERATION_REQUIRED');
  return allow({plan:{kind:'reconciliation',reservationId:r.id,status:'unknown',evidenceRef:`original-operation:${hash(o)}`}});
 }
 if(action.type==='integration_release'){
  const p=data.plans?.find(p=>`${p.id}:execute`===action.operationId&&p.companyId===ctx.companyId),o=data.operations?.find(o=>o.actionId===`near-integrations:${action.operationId}`),r=facts.financial?.reservations?.find(r=>r.actionId===action.operationId);
  if(!p||!o||!r||o.externalActionId!==action.operationId||o.payloadHash!==hash(p.request)||o.result?.status!=='not_submitted')return hold('PROVEN_NO_DISPATCH_REQUIRED');
  return allow({plan:{kind:'reconciliation',reservationId:r.id,status:'released',actualCostNanoUsd:'0',evidenceRef:`local-no-dispatch:${hash(o)}`}});
 }
 if(action.type==='integration_cost'){
  const c=data.costs?.find(c=>c.operationId===action.operationId&&c.source==='verified-provider-cost');
  const r=facts.financial?.reservations?.find(r=>r.actionId===action.operationId);
  if(!c||!r||c.requestHash!==r.requestHash||c.bindingHash!==r.providerBindingHash||!c.receiptId||!c.evidenceRef||!isIntegerAmount(c.actualCostNanoUsd)||integer(c.actualCostNanoUsd)>integer(r.upperBoundNanoUsd))return hold('VERIFIED_INTEGRATION_COST_REQUIRED');
  return allow({plan:{kind:'operational_cost',reservationId:r.id,actualCostNanoUsd:c.actualCostNanoUsd,receiptId:c.receiptId,evidenceRef:c.evidenceRef,accountingDay:r.accountingDay,expenseCategory:r.purpose}});
 }
 if(action.type==='integration_view')return allow({plan:{kind:'integration_view',grantsSpendingAuthority:false,executionAllowed:false,operations:INTEGRATION_KINDS,enabled:ctx.config?.nearIntegrations?.operations??[],maxRequestNanoUsd:ctx.config?.nearIntegrations?.maxRequestNanoUsd??'0'}});
 const p=data.plans?.find(p=>p.id===action.planId&&p.companyId===ctx.companyId);
 if(!p||p.hash!==hash({kind:p.kind,request:p.request,binding:p.binding,inputHash:p.inputHash})||!INTEGRATION_KINDS.includes(p.kind)||!fresh(p.expiresAt,ctx.now))return hold('INTEGRATION_PLAN_REQUIRED');
 if(action.type==='integration_review'){
  const gate=integrationDecision({...action,type:'integration_execute',requestHash:p.hash,maxCostNanoUsd:p.request.maxCostNanoUsd??'0'},facts,ctx);
  return allow({plan:{kind:'integration_review',grantsSpendingAuthority:false,executionAllowed:gate.status==='allow',preparedHash:p.hash,approvalStatus:gate.status,reasonCode:gate.reasonCode}});
 }
 if(action.type!=='integration_execute')return deny('UNKNOWN_INTEGRATION_ACTION');
 if(Object.keys(input).length||action.requestHash!==p.hash||!isIntegerAmount(action.maxCostNanoUsd))return deny('INTEGRATION_REQUEST_MISMATCH');
 if(!ctx.config?.nearIntegrations?.operations.includes(p.kind))return hold('INTEGRATION_POLICY_REQUIRED');
 if(ctx.config.mode!=='live')return hold('LIVE_POLICY_REQUIRED');
 if(ctx.config.killSwitch)return deny('KILL_SWITCH');
 const a=data.authorization;
 if(!a||a.companyId!==ctx.companyId||a.policyVersion!==ctx.policyVersion||a.planId!==p.id||a.requestHash!==p.hash||a.kind!==p.kind||a.maxCalls!==1||!a.id||!fresh(a.expiresAt,ctx.now)||!fresh(p.expiresAt,ctx.now)||!isIntegerAmount(a.maxCostNanoUsd))return hold('INTEGRATION_AUTHORIZATION_REQUIRED');
 const bound=data.bounds?.find(b=>b.requestHash===p.hash&&b.kind===p.kind);
 if(!bound||bound.source!=='integration-cost-bound'||bound.bindingHash!==hash(p.binding)||!fresh(bound.expiresAt,ctx.now)||!isIntegerAmount(bound.maxCostNanoUsd)||bound.maxCostNanoUsd!==action.maxCostNanoUsd)return hold('INTEGRATION_COST_BOUND_REQUIRED');
 const proposed=integer(action.maxCostNanoUsd);
 if(proposed>integer(a.maxCostNanoUsd)||proposed>integer(ctx.config.nearIntegrations.maxRequestNanoUsd))return deny('INTEGRATION_COST_CAP_EXCEEDED');
 const f=facts.financial;
 if(!f||!Number.isSafeInteger(f.version))return hold('FINANCIAL_FACTS_REQUIRED');
 const total=totalCeiling(ctx.config,[...(ctx.authorizations??[]),a,{maxTotalNanoUsd:INTEGRATION_LIFETIME_MAX_NANO_USD}]);
 if(total===null||total.invalid)return hold('TOTAL_CEILING_FACTS_REQUIRED');
 if(lifetimeExposure(f,action.id)+proposed>total)return deny('TOTAL_CEILING_EXCEEDED');
 const existing=f.reservations?.find(r=>r.actionId===action.id);
 if(existing&&!ctx.dispatch)return hold('RECONCILE_REQUIRED');
 // No provider balance or caller assertion is imported as Treasury cash/credit.
 // A paid prepaid service also requires an attributable private resource observation.
 let providerResourceId=null;
 if(proposed>0n){
  const r=data.resources?.find(r=>r.bindingHash===hash(p.binding)&&r.source==='provider-resource-observation'&&fresh(r.expiresAt,ctx.now));
  if(!r||!isIntegerAmount(r.availableNanoUsd))return hold('INTEGRATION_RESOURCE_REQUIRED');
  if(!r.resourceId)return hold('INTEGRATION_RESOURCE_REQUIRED');providerResourceId=r.resourceId;
  const held=(f.reservations??[]).filter(x=>x.actionId!==action.id&&x.providerResourceId===r.resourceId&&!['released','reconciled','failed'].includes(x.status)).reduce((s,x)=>s+integer(x.upperBoundNanoUsd),0n);
  if(integer(r.availableNanoUsd)<held+proposed)return hold('INSUFFICIENT_PROVIDER_RESOURCE');
  if(existing&&existing.providerResourceId!==r.resourceId)return hold('PROVIDER_RESOURCE_CHANGED');
 }
 if(existing&&ctx.dispatch)return allow({authorizationId:a.id,plan:{kind:'integration_dispatch'}});
 return allow({authorizationId:a.id,plan:{kind:'reservation',integrationKind:p.kind,requestHash:p.hash,providerBindingHash:hash(p.binding),reservation:{id:`reservation:${action.id}`,actionId:action.id,purpose:p.kind,requestHash:p.hash,providerBindingHash:hash(p.binding),providerResourceId,status:'reserved',upperBoundNanoUsd:action.maxCostNanoUsd,accountingDay:new Date(ctx.now).toISOString().slice(0,10)},executionAllowed:true,grantsSpendingAuthority:true}});
}
