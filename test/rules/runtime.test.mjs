import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createRules} from '../../src/rules/index.mjs';
import {CAPABILITIES} from '../../src/rules/runtime.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {config,NOW,financial,order,inference,persisted,evidencePack} from './fixtures.mjs';
import {verificationSpec,sdkFinding} from './verification-fixtures.mjs';

const companyId='rules-test-company';
const access={verified:true,role:'owner',companyId};
const owner={access};
const action=(type,extra={})=>({id:`test:${type}`,type,...extra});
function livePolicy(){const c=config();c.mode='live';c.settlementRecipientType='CONFIDENTIAL_INTENTS';return c;}
function context(){
  const c=livePolicy(),policyVersion=createRules({config:c}).snapshot().policyVersion;
  const economicIdentity={companyId,provider:'custody-test',accountId:c.treasuryAccount,treasuryAccount:c.treasuryAccount,network:c.settlementAsset.network,bucket:'confidential',settlementAsset:c.settlementAsset};
  const creditBinding={provider:'near-ai-cloud',companyId,accountId:'test-billing-account',organizationId:null,credentialId:null,network:'cloud:test',asset:'nanoUSD',decimals:0,bucket:'prepaid'};
  economicIdentity.creditBinding=creditBinding;
  const identity={companyId,network:economicIdentity.network,treasuryAccount:economicIdentity.treasuryAccount,bucket:economicIdentity.bucket};
  const runtime={economicIdentity,observations:CAPABILITIES.map(capability=>({id:`observed:${capability}`,capability,provider:'controlled-observer',status:'verified',observedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),identity:{...identity},policyVersion,evidenceRef:`test-evidence:${capability}`}))};
  let authorization={id:'test-budget',mode:'live',companyId,policyVersion,expiresAt:new Date(NOW+60000).toISOString(),actions:['company_activate','service_order','offer','inference','agent_task','next'],maxRequestNanoUsd:c.spending.maxRequestNanoUsd,dailyInferenceCapNanoUsd:c.spending.dailyInferenceCapNanoUsd};
  let clock=NOW;
  const engine=createRules({config:c,companyId,clock:()=>clock,getRuntimeFacts:()=>runtime,getAuthorization:()=>authorization,getOperationState:()=>({state:'live_ready',policyVersion})});
  const f=financial();f.credits.lots[0].expiresAt=new Date(NOW+60000).toISOString();
  const scopeId=fingerprint({resource:'credit',binding:creditBinding});
  f.providerObservations=[{id:'balance:credit',resource:'credit',binding:creditBinding,watermark:{stream:'billing',position:'3'},availableNanoUsd:f.credits.availableNanoUsd,observedAt:new Date(NOW).toISOString(),evidenceRef:'test-balance',scopeId}];
  runtime.economicObservations=f.providerObservations.map(o=>({...o,status:'verified'}));
  f.balanceReconciliations=[{scopeId,observationId:'balance:credit',resource:'credit',watermark:{stream:'billing',position:'3'},status:'matched',observedAmount:f.credits.availableNanoUsd,expectedAmount:f.credits.availableNanoUsd,unresolvedOperationIds:[]}];
  const request={model:c.research.model,verificationSpec:verificationSpec(c),chargeBound:{verified:true,completionTokensIncludeReasoning:true,reference:'test-pricing'}};
  runtime.verificationResults=[sdkFinding(request)];
  const a={...inference(),mode:'live',requestFingerprint:fingerprint(request)},o={...order(),mode:'live'};
  const facts={financial:f,order:o,evidencePack:evidencePack(),creditId:'credit1',request};
  return {c,engine,runtime,facts,a,policyVersion,setAuthorization:a=>authorization=a,setTime:t=>clock=t};
}

test('setupOnly has no commercial defaults and permits authenticated metadata/import/read-only setup without a budget',()=>{
  const r=createRules({setupOnly:true,companyId,clock:()=>NOW});
  const s=r.snapshot();assert.equal(s.mode,'setup');assert.equal(s.config,null);assert.equal(s.policyVersion,null);assert.equal(s.safety.dailyInferenceCapNanoUsd,null);
  for(const type of ['agent_manage','runtime_readiness','organization_setup']){
    assert.equal(r.evaluate(action(type),owner).status,'allow',type);
    assert.equal(r.evaluate(action(type)).reasonCode,'ACCESS_DENIED',type);
    assert.equal(r.evaluate(action(type),{access:{verifiedLocal:true,role:'owner',companyId}}).reasonCode,'ACCESS_DENIED');
  }
  assert.equal(r.evaluate(action('organization_manage'),{...owner,input:{name:'Real company',purpose:'Prepare a company'}}).plan.grantsSpendingAuthority,false);
  const imported=r.evaluate(action('knowledge_import'),{...owner,company:{id:companyId},source:{kind:'text'}});assert.equal(imported.status,'allow');assert.equal(imported.plan.grantsSpendingAuthority,false);
  const bound=r.evaluate(action('resource_bind'),{...owner,agent:{id:'a'},listing:{id:'written-skill',kind:'skill',instructions:'Independently authored free instructions'}});assert.equal(bound.status,'allow');assert.equal(bound.plan.grantsSpendingAuthority,false);
  for(const type of ['offer','company_activate','service_order','agent_task','inference','funding','payout','refund','procurement','bootstrap','disclosure','knowledge_context'])assert.equal(r.evaluate(action(type),owner).reasonCode,'COMMERCIAL_POLICY_REQUIRED',type);
  for(const resource of ['status','storefront']){const d=r.evaluate(action('access',{resource}));assert.equal(d.status,'allow');assert.equal(d.accessPlan.setupRequired,true);assert.deepEqual(d.accessPlan.permittedActions,[]);}
  assert.equal(r.evaluate(action('access',{resource:'workspace'}),owner).status,'allow');
  assert.equal(r.evaluate(action('access',{resource:'workspace'})).reasonCode,'ACCESS_DENIED');
});

test('missing or invalid explicit commercial config never silently becomes setup or fixture policy',async t=>{
  assert.equal(createRules({companyId}).snapshot().mode,'unavailable');
  const invalid=createRules({setupOnly:true,companyId,config:{}});assert.equal(invalid.snapshot().mode,'unavailable');assert.equal(invalid.evaluate(action('agent_manage'),owner).reasonCode,'INVALID_CONFIG');
  const directory=await mkdtemp('/tmp/rules-explicit-config-');t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=directory+'/missing.yaml',r=createRules({setupOnly:true,companyId,configPath:path});assert.equal(r.snapshot().mode,'unavailable');assert.equal(r.evaluate(action('offer')).reasonCode,'INVALID_CONFIG');
  await writeFile(path,'not: a commercial policy');assert.equal(r.evaluate(action('organization_manage'),owner).reasonCode,'INVALID_CONFIG');
  const fixture=createRules({setupOnly:true,companyId,config:config()});assert.equal(fixture.snapshot().mode,'fixture');
});

test('zero-budget live setup requires real company-scoped owner identity, never verifiedLocal or funded authorization',()=>{
  const c=livePolicy(),r=createRules({config:c,companyId,clock:()=>NOW});
  for(const type of ['agent_manage','organization_setup','runtime_readiness','runtime_probe']){
    const a=action(type,type==='runtime_probe'?{capability:'jbrain'}:{});
    assert.equal(r.evaluate(a,owner).status,'allow');
    assert.equal(r.evaluate(a,{access:{verifiedLocal:true,role:'owner',companyId}}).reasonCode,'ACCESS_DENIED');
    assert.equal(r.evaluate(a,{access:{...access,companyId:'other'}}).reasonCode,'ACCESS_DENIED');
  }
  const d=r.evaluate(action('company_pause'),owner);assert.equal(d.status,'allow');assert.equal(d.plan.activation.state,'paused');
  assert.equal(r.evaluate(action('offer'),owner).reasonCode,'LIVE_AUTHORIZATION_REQUIRED');
  assert.equal(r.evaluate(action('knowledge_import'),{...owner,company:{id:'other'},source:{kind:'text'}}).reasonCode,'COMPANY_SCOPE_MISMATCH');
  assert.equal(r.evaluate(action('access',{resource:'owner'}),{access:{...access,companyId:'other'}}).reasonCode,'ACCESS_DENIED');
});

test('live knowledge management and setup review work with owner authentication while mode-only infrastructure stays unready',()=>{
  const r=createRules({config:livePolicy(),companyId,clock:()=>NOW});
  const agent={id:'a',companyId,name:'Writer',role:'Researcher',instructions:'Write sourced reports',skillIds:['free-guidance']};
  const knowledge={...owner,company:{id:companyId},agents:[agent],documents:[],document:{title:'Internal context',body:'Company-private facts',visibility:'restricted',agentIds:['a']}};
  assert.equal(r.evaluate(action('knowledge_manage'),knowledge).status,'allow');
  assert.equal(r.evaluate(action('knowledge_manage'),{...knowledge,access:{role:'owner',verifiedLocal:true,companyId}}).reasonCode,'ACCESS_DENIED');
  assert.equal(r.evaluate(action('knowledge_read'),knowledge).status,'allow');
  const facts={...owner,companyId,organization:{name:'Company',purpose:'Prepare real research'},agents:[agent],infrastructure:['M04','M05','M07'].map(module=>({module,mode:'live',configured:true})),brain:{status:'connected',documents:[{visibility:'company'}]}};
  const setup=r.evaluate(action('organization_setup'),facts);assert.equal(setup.status,'allow');assert.equal(setup.plan.steps.find(x=>x.id==='infra').ready,false);assert.equal(setup.plan.steps.find(x=>x.id==='brain').ready,false);
  assert.equal(r.evaluate(action('organization_setup_review',{stepId:'agents'}),facts).status,'allow');
  assert.equal(r.evaluate(action('resource_bind'),{...owner,agent,listing:{id:'cloud',kind:'inference',mode:'live',availability:'available'}}).reasonCode,'RUNTIME_NOT_READY');
});

test('authenticated agent-filtered reads retain agent grants even for an owner; unscoped owner view may list all',()=>{
  const r=createRules({setupOnly:true,companyId,clock:()=>NOW});
  const document=(name,agentIds)=>({id:`companies/${companyId}/documents/${name}`,companyId,visibility:'restricted',agentIds});
  const facts={...owner,company:{id:companyId},documents:[document('A',['a']),document('B',['b'])]};
  assert.equal(r.evaluate(action('knowledge_read'),facts).plan.documentIds.length,2);
  const scoped=r.evaluate(action('knowledge_read'),{...facts,agent:{id:'a',companyId}});assert.equal(scoped.status,'allow');assert.deepEqual(scoped.plan.documentIds,[facts.documents[0].id]);
});

test('explicit owner metadata update can move a setup profile to the attached live policy without granting provider readiness',()=>{
  const r=createRules({config:livePolicy(),companyId,clock:()=>NOW}),agent={id:'a',companyId,runtime:'setup',status:'ready'};
  const change=r.evaluate(action('agent_manage'),{...owner,agent,input:{runtime:'live'}});assert.equal(change.status,'allow');assert.deepEqual(change.plan.agentPatch,{runtime:'live'});assert.equal(change.plan.grantsSpendingAuthority,false);
  const unchanged=r.evaluate(action('agent_manage'),{...owner,agent,input:{name:'Updated profile'}});assert.equal(unchanged.plan.agentPatch,undefined);
  assert.equal(r.evaluate(action('agent_manage'),{...owner,agent:{...agent,runtime:'fixture'},input:{runtime:'live'}}).reasonCode,'RUNTIME_METADATA_CHANGE_DENIED');
  assert.equal(r.evaluate(action('agent_task'),{...owner,agent:{...agent,runtime:'live'}}).reasonCode,'LIVE_AUTHORIZATION_REQUIRED');
  assert.equal(r.evaluate(action('runtime_readiness'),owner).plan.ready,false);
});

test('read-only probe scopes and technical limits are exact and cannot authorize caller-selected effects',()=>{
  const r=createRules({setupOnly:true,companyId});
  for(const capability of CAPABILITIES){const d=r.evaluate(action('runtime_probe',{capability}),owner);assert.equal(d.status,'allow');assert.equal(d.plan.ttlMs,capability==='jbrain'?300000:60000);assert.equal(d.plan.readOnly,true);assert.equal(d.plan.grantsSpendingAuthority,false);assert.equal(d.permit,undefined);}
  const p=r.evaluate(action('runtime_probe',{capability:'public_retrieval'}),owner).plan;
  assert.deepEqual({maxBytes:p.maxBytes,timeoutMs:p.timeoutMs,maxRedirects:p.maxRedirects},{maxBytes:65536,timeoutMs:5000,maxRedirects:2});
  for(const extra of [{capability:'funding'},{capability:'jbrain',url:'https://caller.example'},{capability:'inference_model',maxCostNanoUsd:'1'},{capability:'custody_grant',method:'POST'}])assert.equal(r.evaluate(action('runtime_probe',extra),owner).status,'deny');
});

test('setup can display isolated verified health without a fabricated commercial identity',()=>{
  const identity={companyId,network:null,treasuryAccount:null,bucket:null};
  const observations=['jbrain','public_retrieval','custody_identity'].map(capability=>({id:capability,capability,provider:'controlled-test',status:'verified',identity,observedAt:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),evidenceRef:'test:health'}));
  const r=createRules({setupOnly:true,companyId,clock:()=>NOW,getRuntimeFacts:()=>({economicIdentity:identity,observations})});
  const p=r.evaluate(action('runtime_readiness'),owner).plan;assert.equal(p.ready,false);assert.equal(p.commercialPolicyRequired,true);
  assert.equal(p.requirements.find(x=>x.capability==='jbrain').status,'verified');assert.equal(p.requirements.find(x=>x.capability==='public_retrieval').status,'verified');assert.equal(p.requirements.find(x=>x.capability==='custody_identity').reasonCode,'OBSERVATION_IDENTITY_MISMATCH');
});

test('live readiness accepts only current trusted observation records, not request JSON or mode',()=>{
  const h=context();assert.equal(h.engine.evaluate(action('runtime_readiness'),owner).plan.ready,true);
  const unconfigured=createRules({config:h.c,companyId,clock:()=>NOW});
  const spoof=unconfigured.evaluate(action('runtime_readiness'),{...owner,observations:h.runtime.observations,runtimeFacts:h.runtime,infrastructure:CAPABILITIES.map(capability=>({capability,mode:'live',configured:true}))});assert.equal(spoof.plan.ready,false);
  const target=h.runtime.observations[0];
  for(const [patch,reason] of [[{status:'configured'},'CAPABILITY_NOT_VERIFIED'],[{expiresAt:new Date(NOW).toISOString()},'OBSERVATION_EXPIRED'],[{observedAt:new Date(NOW+1).toISOString()},'OBSERVATION_EXPIRED'],[{identity:{...target.identity,bucket:'public'}},'OBSERVATION_IDENTITY_MISMATCH'],[{evidenceRef:null},'OBSERVATION_EVIDENCE_REQUIRED']]){
    const original=structuredClone(target);Object.assign(target,patch);const d=h.engine.evaluate(action('runtime_readiness'),owner);assert.equal(d.plan.ready,false);assert.equal(d.plan.requirements[0].reasonCode,reason);Object.assign(target,original);
  }
  h.runtime.observations.find(x=>x.capability==='refund_route').policyVersion='old-policy';assert.equal(h.engine.evaluate(action('runtime_readiness'),owner).plan.requirements.find(x=>x.capability==='refund_route').reasonCode,'OBSERVATION_POLICY_MISMATCH');
});

test('new unavailable observations and timestamp conflicts never fall back to older verified readiness',()=>{
  const h=context(),first=h.runtime.observations[0];h.runtime.observations.push({...first,id:'revoked',observedAt:new Date(NOW).toISOString(),status:'unavailable',reasonCode:'GRANT_REVOKED'});
  assert.equal(h.engine.evaluate(action('runtime_readiness'),owner).plan.requirements[0].reasonCode,'GRANT_REVOKED');
  h.runtime.observations.pop();h.runtime.observations.push({...first,id:'conflicting'});assert.equal(h.engine.evaluate(action('runtime_readiness'),owner).plan.requirements[0].reasonCode,'OBSERVATION_CONFLICT');
});

test('a selected public custody bucket cannot make the confidential live route ready',()=>{
  const h=context();h.runtime.economicIdentity.bucket='public';for(const record of h.runtime.observations)record.identity.bucket='public';
  const readiness=h.engine.evaluate(action('runtime_readiness'),owner).plan;assert.equal(readiness.ready,false);assert.equal(readiness.requirements.find(x=>x.capability==='custody_identity').reasonCode,'OBSERVATION_IDENTITY_MISMATCH');
  assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'RUNTIME_NOT_READY');
});

test('activation and paid dispatch require fresh readiness independently of funded authorization',()=>{
  const h=context(),d=h.engine.evaluate(h.a,h.facts);assert.equal(d.status,'allow',JSON.stringify(d));
  const state=persisted(d,h.facts.financial),facts={...h.facts,action:h.a,financial:state};
  h.runtime.observations.find(x=>x.capability==='inference_proof').status='unavailable';
  assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'RUNTIME_NOT_READY');let started=0;assert.equal(h.engine.dispatch(d.permit,facts,()=>started++).reasonCode,'RUNTIME_NOT_READY');assert.equal(started,0);
  h.runtime.observations.find(x=>x.capability==='inference_proof').status='verified';
  h.setAuthorization(null);assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'LIVE_AUTHORIZATION_REQUIRED');
  assert.equal(h.engine.evaluate(action('agent_manage'),owner).status,'allow');
});

test('live local checklist procurement cannot enable a paid entitlement; authored free instructions remain usable',()=>{
  const h=context();h.c.procurement={enabled:true,listingId:'checklist',recipient:'supplier',money:{...h.c.settlementAsset,amount:'1'},maxCostNanoUsd:'1'};
  h.engine.updateConfig(h.c);
  for(const type of ['procurement','procurement_record'])assert.equal(h.engine.evaluate(action(type),owner).reasonCode,'LIVE_PROCUREMENT_UNAVAILABLE');
  const facts={...owner,agent:{id:'a'},listing:{id:'checklist',kind:'skill',purchaseRequired:true},licenses:[{listingId:'checklist',version:'1'}]};
  assert.equal(h.engine.evaluate(action('resource_bind'),facts).reasonCode,'LIVE_PROCUREMENT_UNAVAILABLE');
  delete facts.listing.purchaseRequired;assert.equal(h.engine.evaluate(action('resource_bind'),facts).status,'allow');
});

test('public service private knowledge is denied while internal historical selection retains current read-grant semantics',()=>{
  const h=context(),ids=[`companies/${companyId}/documents/private`];
  assert.equal(h.engine.evaluate(action('company_activate'),{...owner,knowledgeIds:ids}).reasonCode,'CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
  assert.equal(h.engine.evaluate(action('service_order'),{organization:{activation:{knowledgeIds:ids}}}).reasonCode,'CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
  const facts={company:{id:companyId},agent:{id:'a',companyId},documents:[{id:ids[0],companyId,visibility:'restricted',agentIds:['a'],revision:'B'}]};
  const decision=h.engine.evaluate(action('knowledge_context',{documentIds:ids}),facts);assert.equal(decision.status,'allow');assert.equal(decision.plan.publicEvidence,false);
  facts.documents[0].agentIds=[];assert.equal(h.engine.evaluate(action('knowledge_context',{documentIds:ids}),facts).reasonCode,'KNOWLEDGE_ACCESS_DENIED');
  const publicFacts={...h.facts,order:{...h.facts.order,agentContext:{service:{id:'market-opportunity'},companyKnowledge:{documents:[{id:ids[0],revision:'A'}]}}}};
  assert.equal(h.engine.evaluate(h.a,publicFacts).reasonCode,'CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
});

test('matched economic facts are rechecked at dispatch; deficit, pending and stale amounts keep spending held',()=>{
  for(const status of ['deficit','surplus','pending','unreconciled']){const h=context();h.facts.financial.balanceReconciliations[0].status=status;assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'BALANCE_RECONCILIATION_REQUIRED');}
  const h=context(),d=h.engine.evaluate(h.a,h.facts);assert.equal(d.status,'allow');const f=persisted(d,h.facts.financial);f.balanceReconciliations[0].status='deficit';let calls=0;
  assert.equal(h.engine.dispatch(d.permit,{...h.facts,financial:f,action:h.a},()=>calls++).reasonCode,'BALANCE_RECONCILIATION_REQUIRED');assert.equal(calls,0);
  f.balanceReconciliations[0].status='matched';f.credits.availableNanoUsd='999999999';assert.equal(h.engine.validateDispatch(d.permit,{...h.facts,financial:f,action:h.a}).reasonCode,'BALANCE_RECONCILIATION_STALE');
});

test('newer unpublished provider observations and expired snapshots block a previously approved permit',()=>{
  const h=context(),d=h.engine.evaluate(h.a,h.facts),f=persisted(d,h.facts.financial);assert.equal(d.status,'allow');
  const original=h.runtime.economicObservations[0];h.runtime.economicObservations.push({...original,id:'newer-deficit',watermark:{stream:'billing',position:'4'},observedAt:new Date(NOW+1).toISOString(),availableNanoUsd:'1'});h.setTime(NOW+1);
  assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'ECONOMIC_OBSERVATION_NOT_RECONCILED');
  let calls=0;assert.equal(h.engine.dispatch(d.permit,{...h.facts,action:h.a,financial:f},()=>calls++).reasonCode,'ECONOMIC_OBSERVATION_NOT_RECONCILED');assert.equal(calls,0);
  h.runtime.economicObservations.pop();h.setTime(NOW);original.status='unavailable';assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'ECONOMIC_OBSERVATION_UNVERIFIED');
  original.status='verified';original.observedAt=new Date(NOW-60000).toISOString();assert.equal(h.engine.evaluate(h.a,h.facts).reasonCode,'ECONOMIC_OBSERVATION_EXPIRED');
});

test('malformed trusted safety observations produce a structured denial at the last dispatch gate',()=>{
  const h=context(),d=h.engine.evaluate(h.a,h.facts);assert.equal(d.status,'allow');
  const financial=persisted(d,h.facts.financial);h.runtime.economicObservations[0].watermark.position='not-an-integer';let calls=0;
  const blocked=h.engine.dispatch(d.permit,{...h.facts,financial,action:h.a},()=>calls++);assert.equal(blocked.status,'deny');assert.equal(blocked.reasonCode,'INVALID_SAFETY_FACTS');assert.equal(calls,0);
});
