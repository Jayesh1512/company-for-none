import test from 'node:test';
import assert from 'node:assert/strict';
import {createRules,validateConfig} from '../../src/rules/index.mjs';
import {verificationSpec,verifyInferenceEvidence} from '../../src/rules/verification.mjs';
import {config,NOW,persisted,order,reportFacts} from './fixtures.mjs';
import {sdkFinding} from './verification-fixtures.mjs';
import {componentFixture} from './component-fixtures.mjs';

test('verification policy defaults strictly and only explicit validated config can loosen TCB or freshness',()=>{
  const c=config(),strict=verificationSpec(c);assert.deepEqual(strict.allowedTcbStatuses,['UpToDate']);assert.equal(strict.signingAlgo,'ed25519');assert.equal(strict.route,'near-tee-e2ee-chat');assert.equal(strict.attestationCacheTimeToLiveMs,0);assert.equal(strict.requireResponseSignature,true);
  c.inferenceVerification={allowedTcbStatuses:['UpToDate','OutOfDate'],maxAttestationAgeMs:1000};validateConfig(c);assert.notEqual(verificationSpec(c).policyFingerprint,strict.policyFingerprint);
  for(const policy of [{allowedTcbStatuses:['Unknown'],maxAttestationAgeMs:1000},{allowedTcbStatuses:[],maxAttestationAgeMs:1000},{allowedTcbStatuses:['UpToDate'],maxAttestationAgeMs:0},{allowedTcbStatuses:['UpToDate'],maxAttestationAgeMs:1000,requireResponseSignature:false}])assert.throws(()=>validateConfig({...c,inferenceVerification:policy}));
});

test('read-only preflight is owner-only in setup, exact server model, and grants neither readiness nor spending',()=>{
  const companyId='setup-proof',access={verified:true,role:'owner',companyId};
  const r=createRules({setupOnly:true,companyId,componentModel:'server-selected-model',clock:()=>NOW});
  const d=r.evaluate({id:'preflight',type:'component_preflight'},{access});assert.equal(d.status,'allow');assert.equal(d.plan.model,'server-selected-model');assert.equal(d.plan.readOnly,true);assert.equal(d.plan.grantsSpendingAuthority,false);assert.equal(d.permit,undefined);assert.equal(d.plan.action,undefined);
  assert.equal(r.evaluate({id:'public-preflight',type:'component_preflight'}).reasonCode,'ACCESS_DENIED');
  assert.equal(r.evaluate({id:'other',type:'component_preflight',model:'unapproved-model'},{access}).reasonCode,'COMPONENT_MODEL_REQUIRED');
  assert.equal(r.evaluate({id:'effect',type:'component_inference'},{access}).reasonCode,'COMMERCIAL_POLICY_REQUIRED');
  assert.equal(r.evaluate({id:'readiness',type:'runtime_readiness'},{access}).plan.ready,false);
  const c=config();c.mode='live';c.killSwitch=true;const stopped=createRules({config:c,companyId,clock:()=>NOW});
  assert.equal(stopped.evaluate({id:'stopped-preflight',type:'component_preflight'},{access}).status,'allow');
});

test('public readiness is freshly derived and exposes only Rules-owned safe fields and codes',()=>{
  const identity={companyId:'public-test',network:null,treasuryAccount:null,bucket:null};let clock=NOW;
  const runtime={economicIdentity:identity,observations:[{id:'private-id',capability:'jbrain',provider:'private-provider',status:'verified',identity,observedAt:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+1).toISOString(),evidenceRef:'private:secret-path',reasonCode:'SECRET_GRANT_ID'}]};
  const r=createRules({setupOnly:true,companyId:identity.companyId,clock:()=>clock,getRuntimeFacts:()=>runtime}),action={id:'public-status',type:'public_readiness'};
  const d=r.evaluate(action);assert.equal(d.status,'allow');assert.equal(d.plan.setupRequired,true);assert.equal(d.plan.ready,false);assert.equal(d.plan.capabilities.find(x=>x.capability==='jbrain').status,'verified');
  for(const row of d.plan.capabilities)assert.deepEqual(Object.keys(row).sort(),['capability','expiresAt','reasonCode','status']);
  assert.doesNotMatch(JSON.stringify(d.plan),/private-id|private-provider|secret-path|SECRET_GRANT_ID|treasuryAccount/);
  clock=NOW+1;assert.equal(r.evaluate(action).plan.capabilities.find(x=>x.capability==='jbrain').reasonCode,'OBSERVATION_EXPIRED');
  clock=NOW;runtime.observations[0].status='unavailable';runtime.observations[0].reasonCode='PRIVATE_REFERENCE_AS_REASON';assert.equal(r.evaluate(action).plan.capabilities.find(x=>x.capability==='jbrain').reasonCode,'CAPABILITY_NOT_VERIFIED');
});

test('provider JSON booleans cannot supply local SDK proof, and strict UpToDate blocks SDK-compatible OutOfDate',()=>{
  const h=componentFixture(),finding=h.runtime.verificationResults[0],args={request:h.request,requestFingerprint:h.action.requestFingerprint,prepared:true};
  const verify=()=>verifyInferenceEvidence('preflight',args,h.runtime,h.c,NOW);assert.equal(verify().status,'allow');
  finding.models[0].tcbStatus='OutOfDate';assert.equal(verify().reasonCode,'TCB_STATUS_NOT_APPROVED');finding.models[0].tcbStatus='UpToDate';
  finding.source='provider-json';assert.equal(verify().reasonCode,'LOCAL_SDK_VERIFICATION_REQUIRED');finding.source='local-sdk';
  finding.sdk.nodeEntry=false;assert.equal(verify().reasonCode,'LOCAL_SDK_VERIFICATION_REQUIRED');finding.sdk.nodeEntry=true;
  finding.models[0].nonceVerified=false;assert.equal(verify().reasonCode,'FRESH_NONCE_ATTESTATION_REQUIRED');finding.models[0].nonceVerified=true;
  finding.gateway.verifiedAt=new Date(NOW-300000).toISOString();assert.equal(verify().reasonCode,'FRESH_NONCE_ATTESTATION_REQUIRED');
  h.runtime.verificationResults=[];assert.equal(verify().reasonCode,'INFERENCE_PREFLIGHT_REQUIRED');
});

test('missing/revoked/unprepared attestations prevent the paid component and final dispatch',()=>{
  const h=componentFixture(),d=h.rules.evaluate(h.action,h.facts);assert.equal(d.status,'allow',JSON.stringify(d));
  const financial=persisted(d,h.financial),facts={...h.facts,financial,action:h.action};let calls=0;
  h.runtime.verificationResults[0].status='failed';assert.equal(h.rules.dispatch(d.permit,facts,()=>calls++).reasonCode,'INFERENCE_VERIFICATION_FAILED');assert.equal(calls,0);
  h.runtime.verificationResults[0].status='verified';delete h.runtime.verificationResults[0].requestBytesHash;assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'PREPARED_REQUEST_EVIDENCE_REQUIRED');
});

test('wire signatures alone cannot authorize plaintext report acceptance or delivery; artifact hash must bind',()=>{
  const h=componentFixture(),output='Controlled test report';
  const response=sdkFinding(h.request,'response',output);h.runtime.verificationResults.push(response);
  const args={request:h.request,requestFingerprint:h.action.requestFingerprint,output};
  assert.equal(verifyInferenceEvidence('response',args,h.runtime,h.c,NOW).status,'allow');
  for(const [field,value,reason] of [['signatureKind','gateway','MODEL_RESPONSE_SIGNATURE_REQUIRED'],['wireSignatureVerified',false,'MODEL_RESPONSE_SIGNATURE_REQUIRED'],['plaintextBindingStatus','unavailable','DURABLE_PLAINTEXT_BINDING_REQUIRED'],['durableReplayStatus','unavailable','DURABLE_PLAINTEXT_BINDING_REQUIRED']]){const old=response[field];response[field]=value;assert.equal(verifyInferenceEvidence('response',args,h.runtime,h.c,NOW).reasonCode,reason);response[field]=old;}
  assert.equal(verifyInferenceEvidence('response',{...args,output:output+' mutated'},h.runtime,h.c,NOW).reasonCode,'VERIFIED_OUTPUT_BINDING_REQUIRED');
  response.status='unavailable';response.plaintextBindingStatus='unavailable';response.durableReplayStatus='unavailable';assert.equal(verifyInferenceEvidence('response',args,h.runtime,h.c,NOW).status,'hold');
});

test('actual live report/delivery gates require current trusted replay-bound artifact bytes and cannot publish component output',()=>{
  const h=componentFixture(),output='Controlled accepted content',response=sdkFinding(h.request,'response',output);h.runtime.verificationResults.push(response);
  const authorization={id:'separate-business-auth',companyId:h.companyId,mode:'live',policyVersion:h.rules.snapshot().policyVersion,expiresAt:new Date(NOW+60000).toISOString(),actions:['report','deliver'],dailyInferenceCapNanoUsd:h.c.spending.dailyInferenceCapNanoUsd};
  const rules=createRules({config:h.c,companyId:h.companyId,clock:()=>NOW,getRuntimeFacts:()=>h.runtime,getAuthorization:()=>authorization});
  const facts={financial:h.financial,request:h.request,order:{...order(),mode:'live'},report:{...reportFacts(),mode:'live'},artifact:{content:output}};
  for(const type of ['report','deliver']){
    const action={id:`business:${type}`,type,orderId:'o1'};assert.equal(rules.evaluate(action,facts).status,'allow');
    response.status='unavailable';response.plaintextBindingStatus='unavailable';response.durableReplayStatus='unavailable';assert.equal(rules.evaluate(action,facts).status,'hold');
    response.status='verified';response.plaintextBindingStatus='verified';response.durableReplayStatus='verified';facts.artifact.content+=' changed';assert.equal(rules.evaluate(action,facts).reasonCode,'VERIFIED_OUTPUT_BINDING_REQUIRED');facts.artifact.content=output;
  }
  const d=h.rules.evaluate(h.action,h.facts);assert.equal(d.status,'allow');facts.financial=persisted(d,h.financial);assert.equal(rules.evaluate({id:'component-as-report',type:'report'},facts).reasonCode,'COMPONENT_OUTPUT_NOT_FOR_DELIVERY');assert.equal(rules.evaluate({id:'component-as-delivery',type:'deliver'},facts).reasonCode,'COMPONENT_OUTPUT_NOT_FOR_DELIVERY');
});
