import {hash, integer} from './config.mjs';
import {allow,deny,hold,spend,inferenceAdmission} from './policies.mjs';
import {economicSafety} from './economic.mjs';
import {runtimeReadiness,requireCapabilities} from './runtime.mjs';
import {verificationSpec,requestVerification,verifyInferenceEvidence,inferenceMaximum} from './verification.mjs';
import {consumption} from './records.mjs';
import {generationInputBytes} from '../generation-contracts.mjs';

const text=x=>typeof x==='string'&&!!x.trim();
const finiteTime=x=>Number.isFinite(Date.parse(x));
export function componentGrant(grant,config,policyVersion,companyId,now) {
  if(!config||config.mode!=='live')return {blocked:hold('COMMERCIAL_POLICY_REQUIRED')};
  if(!grant||!text(grant.id)||grant.companyId!==companyId||grant.provider!=='near-ai-cloud'||grant.policyVersion!==policyVersion||grant.maxCalls!==1||grant.proofScope!=='wire-only'||!finiteTime(grant.notBefore)||Date.parse(grant.notBefore)>now||!finiteTime(grant.expiresAt)||Date.parse(grant.expiresAt)<=now)return {blocked:deny('COMPONENT_AUTHORIZATION_REQUIRED')};
  if(grant.verificationPolicyFingerprint!==verificationSpec(config).policyFingerprint)return {blocked:deny('COMPONENT_VERIFICATION_POLICY_MISMATCH')};
  for(const k of ['maxInputBytes','maxInputTokens','maxOutputTokens','timeoutMs'])if(!Number.isSafeInteger(grant[k])||grant[k]<=0)return {blocked:deny('COMPONENT_LIMITS_REQUIRED')};
  if(!Number.isSafeInteger(grant.maxReasoningTokens)||grant.maxReasoningTokens<0||!text(grant.creditId)||!text(grant.creditScopeId)||!text(grant.requestFingerprint)||integer(grant.maxCostNanoUsd)<=0n||integer(grant.dailyCapNanoUsd)<=0n)return {blocked:deny('COMPONENT_LIMITS_REQUIRED')};
  const request=grant.request;
  if(!request||hash(request)!==grant.requestFingerprint||request.model!==grant.model||grant.model!==config.research.model||requestVerification(request,config))return {blocked:deny('COMPONENT_REQUEST_MISMATCH')};
  if(!Array.isArray(request.messages)||!request.messages.length||request.messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||!Number.isSafeInteger(request.maxInputBytes)||request.maxInputBytes<=0||request.maxInputBytes>grant.maxInputBytes||generationInputBytes(request)>request.maxInputBytes||request.maxOutputTokens!==grant.maxOutputTokens||request.timeoutMs!==grant.timeoutMs||request.chargeBound?.maxCostNanoUsd!==grant.maxCostNanoUsd)return {blocked:deny('COMPONENT_REQUEST_BOUNDS_MISMATCH')};
  if(integer(grant.maxCostNanoUsd)>integer(config.spending.maxRequestNanoUsd)||integer(grant.dailyCapNanoUsd)>integer(config.spending.dailyInferenceCapNanoUsd)||integer(grant.maxCostNanoUsd)>integer(grant.dailyCapNanoUsd))return {blocked:deny('COMPONENT_CAP_EXCEEDED')};
  const action={id:`component:${grant.id}`,type:'component_inference',mode:'live',model:grant.model,requestFingerprint:grant.requestFingerprint,maxCostNanoUsd:grant.maxCostNanoUsd,bounds:{inputTokens:grant.maxInputTokens,outputTokens:grant.maxOutputTokens,reasoningTokens:grant.maxReasoningTokens}};
  return {grant,request,action};
}

export function componentPreflight(action,facts,{config,policyVersion,companyId,now,runtime,authorization,model}) {
  if(Object.keys(action).some(k=>!['id','type','model','requestFingerprint'].includes(k)))return deny('COMPONENT_PREFLIGHT_INPUT_DENIED');
  const selected=model??runtime?.componentModel??config?.research.model;
  if(!text(selected)||(action.model!=null&&action.model!==selected))return hold('COMPONENT_MODEL_REQUIRED');
  let request={model:selected,verificationSpec:verificationSpec(config)},extra={};
  if(facts.request||action.requestFingerprint){
    const checked=componentGrant(authorization,config,policyVersion,companyId,now);if(checked.blocked)return checked.blocked;
    if(hash(facts.request??null)!==authorization.requestFingerprint||action.requestFingerprint!==authorization.requestFingerprint||authorization.model!==selected)return deny('COMPONENT_REQUEST_MISMATCH');
    request=structuredClone(checked.request);extra={action:checked.action,creditId:authorization.creditId,proofScope:'wire-only'};
  }
  return allow({plan:{kind:'component_preflight',model:selected,request,requestFingerprint:hash(request),verificationSpec:verificationSpec(config),readOnly:true,timeoutMs:30000,grantsSpendingAuthority:false,...extra}});
}

export function componentInference(action,facts,{config,policyVersion,companyId,now,runtime,authorization,providerBounds,dispatch=false}) {
  const slot=inferenceAdmission(action.id,facts.financial,config);if(slot)return slot;
  const checked=componentGrant(authorization,config,policyVersion,companyId,now);if(checked.blocked)return checked.blocked;
  const a=checked.grant;
  if(hash(action)!==hash(checked.action)||hash(facts.request??null)!==a.requestFingerprint||facts.creditId!==a.creditId)return deny('COMPONENT_REQUEST_MISMATCH');
  // Only the exact already-applied intent may pass again at its final gate.
  if((facts.financial?.approvedPlans??[]).some(p=>p.authorizationId===a.id&&(!dispatch||p.actionId!==action.id||p.fingerprint!==hash(action))))return deny('COMPONENT_AUTHORIZATION_USED');
  if((facts.financial?.consumedPermits??[]).some(p=>p.authorizationId===a.id&&p.actionId!==action.id))return deny('COMPONENT_AUTHORIZATION_USED');
  const capabilities=requireCapabilities(runtimeReadiness(runtime,{companyId,config,policyVersion,now}),['inference_model','inference_bounds','inference_credit']);if(capabilities)return capabilities;
  const economic=economicSafety(facts.financial,runtime,config,companyId,['credit'],now);if(economic)return economic;
  const lot=facts.financial?.credits?.lots?.find(x=>x.id===a.creditId);
  if(!lot||lot.scopeId!==a.creditScopeId||hash(lot.binding??null)!==hash(runtime?.economicIdentity?.creditBinding??null)||!facts.financial?.openingRecords?.some(o=>o.resource==='credit'&&o.scopeId===a.creditScopeId))return hold('COMPONENT_SCOPED_CREDIT_REQUIRED');
  const bound=requestChargeBound(facts.request,providerBounds,now,action.bounds);if(bound)return bound;
  const proof=verifyInferenceEvidence('preflight',{request:facts.request,requestFingerprint:action.requestFingerprint,prepared:true},runtime,config,now);if(proof.status!=='allow')return proof;
  const day=new Date(now).toISOString().slice(0,10),financial=facts.financial;
  const current=financial.reservations?.find(x=>x.actionId===action.id&&!['failed','released','reconciled'].includes(x.status));
  const held=(financial.reservations??[]).filter(x=>!['failed','released','reconciled'].includes(x.status)&&x.purpose!=='funding').reduce((s,x)=>s+integer(x.upperBoundNanoUsd),0n);
  if(financial.dailyCosts?.[day]==null)return hold('DAILY_COST_FACTS_REQUIRED');
  if(integer(financial.dailyCosts[day])+held+(current?0n:integer(a.maxCostNanoUsd))>integer(a.dailyCapNanoUsd))return deny('COMPONENT_DAILY_CAP_EXCEEDED');
  if(current)return allow({authorizationId:a.id,plan:{kind:'component_dispatch',proofScope:'wire-only',creditId:a.creditId}});
  const result=spend({...action,type:'inference'},facts,config,now);
  if(result.status==='allow')Object.assign(result,{authorizationId:a.id,plan:{...result.plan,creditId:a.creditId,proofScope:'wire-only',requestFingerprint:action.requestFingerprint,requestBytesHash:proof.plan.requestBytesHash}});
  return result;
}

export function requestChargeBound(request,providerBounds,now,bounds) {
  if(!providerBounds||providerBounds.status!=='verified'||providerBounds.model!==request?.model||!text(providerBounds.reference)||providerBounds.reference!==request?.chargeBound?.reference||!finiteTime(providerBounds.validUntil)||Date.parse(providerBounds.validUntil)<=now||providerBounds.completionTokensIncludeReasoning!==true)return hold('BOUNDS_UNESTABLISHED');
  if(providerBounds.inputNanoUsdPerMillionTokens==null||providerBounds.outputNanoUsdPerMillionTokens==null)return hold('BOUNDS_UNESTABLISHED');
  if(inferenceMaximum(bounds,providerBounds)>integer(request.chargeBound.maxCostNanoUsd))return deny('BOUNDS_EXCEED_AUTHORIZED_CHARGE');
  return null;
}

export function componentConsumption(action,facts,runtime) {
  const r=(runtime?.componentResults??[]).filter(x=>x.id===action.resultId);
  if(r.length!==1||r[0].source!=='local-sdk'||!text(r[0].evidenceRef))return hold('COMPONENT_COST_EVIDENCE_REQUIRED');
  const record=r[0],approved=facts.financial?.approvedPlans?.find(p=>p.authorizationId===record.authorizationId&&p.actionId===record.actionId&&p.plan?.proofScope==='wire-only');
  if(!approved||record.requestFingerprint!==approved.plan.requestFingerprint)return hold('COMPONENT_COST_BINDING_REQUIRED');
  const creditId=approved.plan.creditId,lot=facts.financial.credits.lots.find(x=>x.id===creditId),receipt=record.result?.receipt;
  if(!lot||hash(receipt?.binding??null)!==hash(lot.binding??null)||!receipt?.watermark||!text(receipt.providerReference))return hold('COMPONENT_COST_SCOPE_REQUIRED');
  const decision=consumption(action,{financial:facts.financial,result:record.result,creditId,reservationId:approved.plan.reservation.id,receipt});
  if(decision.status==='allow'){
    delete decision.plan.orderPatch;
    Object.assign(decision.plan,{binding:structuredClone(receipt.binding),watermark:structuredClone(receipt.watermark),providerReference:receipt.providerReference,evidenceRef:record.evidenceRef,proofScope:'wire-only'});
  }
  return decision;
}
