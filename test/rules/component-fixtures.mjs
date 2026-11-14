// Explicit synthetic observations/SDK findings: no providers or money are used.
import {createRules} from '../../src/rules/index.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {config,NOW,financial} from './fixtures.mjs';
import {verificationSpec,sdkFinding} from './verification-fixtures.mjs';
export function componentFixture({autonomy}={}){
  const companyId='component-test',access={verified:true,role:'owner',companyId},c=config();c.mode='live';
  if(autonomy)c.autonomy=structuredClone(autonomy);
  const policyVersion=createRules({config:c}).snapshot().policyVersion,spec=verificationSpec(c);
  const binding={provider:'near-ai-cloud',companyId,accountId:'controlled-billing-account',organizationId:null,credentialId:null,network:'cloud:controlled',asset:'nanoUSD',decimals:0,bucket:'controlled-prepaid'};
  const scopeId=fingerprint({resource:'credit',binding}),identity={companyId,network:c.settlementAsset.network,treasuryAccount:c.treasuryAccount,bucket:'confidential'};
  const runtime={economicIdentity:{...identity,creditBinding:binding},observations:['inference_model','inference_bounds','inference_credit'].map(capability=>({id:capability,capability,provider:'near-ai-cloud',status:'verified',identity,policyVersion,observedAt:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),evidenceRef:'private:controlled-provider-fact'}))};
  const request={model:c.research.model,messages:[{role:'user',content:'Return one short fact for a controlled policy test.'}],maxInputBytes:1000,maxOutputTokens:32,timeoutMs:1000,chargeBound:{maxCostNanoUsd:'1000000',reference:'controlled-price',verified:true,completionTokensIncludeReasoning:true},verificationSpec:spec};
  let authorization={id:'controlled-component-grant',companyId,provider:'near-ai-cloud',model:request.model,policyVersion,verificationPolicyFingerprint:spec.policyFingerprint,requestFingerprint:fingerprint(request),request,creditId:'credit1',creditScopeId:scopeId,notBefore:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),maxCalls:1,maxCostNanoUsd:'1000000',dailyCapNanoUsd:'2000000',maxInputBytes:1000,maxInputTokens:1000,maxOutputTokens:32,maxReasoningTokens:0,timeoutMs:1000,proofScope:'wire-only'};
  let clock=NOW;
  const providerBounds={status:'verified',model:request.model,reference:'controlled-price',validUntil:new Date(NOW+60000).toISOString(),completionTokensIncludeReasoning:true,inputNanoUsdPerMillionTokens:'1000',outputNanoUsdPerMillionTokens:'1000'};
  const rules=createRules({config:c,companyId,clock:()=>clock,getRuntimeFacts:()=>runtime,getComponentAuthorization:()=>authorization,getInferenceBounds:()=>providerBounds});
  const f=financial();f.credits.lots[0]={...f.credits.lots[0],provider:binding.provider,owner:binding.accountId,binding,scopeId,expiresAt:new Date(NOW+60000).toISOString()};
  f.openingRecords=[{resource:'credit',scopeId,binding,watermark:{stream:'controlled-billing',position:'1'}}];
  f.providerObservations=[{id:'controlled-credit-balance',resource:'credit',scopeId,binding,watermark:{stream:'controlled-billing',position:'2'},observedAt:new Date(NOW).toISOString(),evidenceRef:'private:controlled-balance',availableNanoUsd:f.credits.availableNanoUsd}];
  f.balanceReconciliations=[{resource:'credit',scopeId,observationId:'controlled-credit-balance',status:'matched',expectedAmount:f.credits.availableNanoUsd,observedAmount:f.credits.availableNanoUsd,watermark:f.providerObservations[0].watermark,unresolvedOperationIds:[]}];
  runtime.economicObservations=f.providerObservations.map(x=>({...x,status:'verified'}));runtime.verificationResults=[sdkFinding(request)];
  const preflightAction={id:'controlled-component-preflight',type:'component_preflight',requestFingerprint:fingerprint(request)};
  const plan=rules.evaluate(preflightAction,{access,request}).plan;
  return {rules,c,companyId,access,runtime,authorization,providerBounds,request,binding,scopeId,financial:f,action:plan?.action,facts:{access,request,creditId:'credit1',financial:f},setAuthorization:a=>authorization=a,setTime:t=>clock=t};
}
