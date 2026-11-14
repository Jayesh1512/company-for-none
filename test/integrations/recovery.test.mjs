import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createRecoveryRules,RECOVERY_LIMITS,RECOVERY_SPEC} from '../../src/rules/recovery.mjs';
import {createRecovery,RECOVERY_COMPANY,RECOVERY_SOURCE} from '../../src/demo/recovery.mjs';
import {readAutonomyFacts} from '../../src/autonomy/facts.mjs';
import {catalog} from '../../src/workspace/catalog.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {plaintextHash} from '../../src/rules/verification.mjs';
import {startNativeJBrain} from '../helpers/native-jbrain.mjs';

// Only these tests replace the model transport and SDK findings. Production
// composition imports no test helper, synthetic signature or reasoner.
async function fixture(t,{invalidPatch=false,invalidCitation=false,proofFailure=false,preflightFailure=false,pendingBill=false}={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'near-recovery-')),brain=await startNativeJBrain(path.join(directory,'brain'));let app,calls=0;
 const authorization={id:'test-only-owner-grant',enabled:true,companyId:RECOVERY_COMPANY,model:RECOVERY_LIMITS.model,maxTotalNanoUsd:RECOVERY_LIMITS.maxTotalNanoUsd,responseAcceptance:'live-verified-hold-on-loss',credentialHash:'TEST',expiresAt:new Date(Date.now()+3600000).toISOString()};
 const facts=()=>{const s=app?.journal.get('recoveryScenarios','intake'),head=s&&app.journal.get('companyTargetHeads',s.targetId);return {authorization,credentialHash:'TEST',runs:app?.journal.list('recoveryRuns')??[],agents:app?.journal.list('agents')??[],documents:app?.journal.list('companyKnowledgeDocuments')??[],verificationResults:app?.journal.list('inferenceVerification')??[],sourceId:s?.sourceId,pricing:app?.journal.get('recoveryPricing','current'),head,baseline:head&&app.journal.get('companyRevisions',head.revisionId),contract:app?.journal.list('companyTemplateContracts').find(c=>c.targetId===s?.targetId),candidate:app?.journal.get('recoveryCandidates','current'),evaluation:app?.journal.get('improvementEvaluations','recovery:fixed-evaluation')};};
 const rules=createRecoveryRules({base:createRules({companyId:RECOVERY_COMPANY,setupOnly:true,getAutonomyFacts:()=>readAutonomyFacts({journal:app?.journal,catalog,companyId:RECOVERY_COMPANY})}),companyId:RECOVERY_COMPANY,facts});
 app=await createApp({companyId:RECOVERY_COMPANY,directory:path.join(directory,'company'),configPath:'',rules,jbrainUrl:brain.url,jbrainToken:brain.token,ledgerWalletPublicFile:'',ledgerBinding:null,ownerToken:'',ownerTokenFile:''});
 t.after(async()=>{await app.close();await brain.close();await rm(directory,{recursive:true,force:true});});
 const verificationFactory=()=>({async prepare({action,request}){
  if(preflightFailure)throw Object.assign(Error('Test-only provider preflight rejection'),{code:'PROVIDER_ACCESS_DENIED'});
  const requestFingerprint=fingerprint(request),att={tcbStatus:'UpToDate',nonce:'test-nonce',nonceVerified:true,verifiedAt:new Date().toISOString(),signer:{signingAlgo:'ed25519',signingAddress:'test-only-signer'}};
  const pre={id:action.id+':pre',stage:'preflight',source:'local-sdk',sdkVersion:'0.3.0',sdk:RECOVERY_SPEC.sdk,status:'verified',model:request.model,policyFingerprint:RECOVERY_SPEC.policyFingerprint,verifiedAt:new Date().toISOString(),evidenceRef:'private:test-only',requestFingerprint,requestBytesHash:'a'.repeat(64),gateway:att,models:[att]};
  const persist=async proof=>app.journal.transaction({actionId:proof.id,fingerprint:fingerprint(proof)},tx=>{tx.put('inferenceVerification',proof.id,proof);return null;});await persist(pre);
  return async()=>{
   calls++;const role=app.journal.list('recoveryRuns').find(r=>r.id+':inference'===action.id).role,doc=JSON.parse(request.messages[1].content).documents[0];
   const values={manager:{summary:'Delegate the customer request.',delegate:['support']},support_before:{summary:'Runbook lacks contact instructions.',answer:'Owner review is required because the runbook does not document contact preference.',escalate:true,citations:[]},backlog:{summary:'The runbook and template need separate repairs.',delegate:['knowledge_curator','template_developer']},knowledge_curator:{summary:'Use the exact approved process.',excerpt:RECOVERY_SOURCE},template_developer:{summary:'Add the frozen mandatory field.',operations:[{type:'add_field',name:invalidPatch?'bankAccount':'contactPreference',required:true}]},support_after:{summary:'Current knowledge and template support a complete intake.',answer:'Record portal or email as contactPreference. This creates a local review ticket only.',escalate:false,citations:[{documentId:doc.id,quote:invalidCitation?'Invented provider statement':RECOVERY_SOURCE}],intake:{policyReference:'HM-AUTO-DEMO',incidentSummary:'Parked vehicle damage',contactPreference:'portal'}}};
   const output=JSON.stringify(values[role]),proof={...pre,id:action.id+':response',stage:'response',status:proofFailure?'unavailable':'verified',signatureKind:'provider_tee',wireSignatureVerified:true,responseBytesHash:'b'.repeat(64),plaintextBindingStatus:'verified',durableReplayStatus:'unavailable',processVerificationStatus:'verified',acceptanceScope:'live-process-e2ee',responsePlaintextHash:plaintextHash(output)};await persist(proof);
   return {status:'confirmed',provider:'near-ai-cloud',mode:'live',inferenceId:'TEST-'+role,providerRequestId:'TEST-'+role,proof,generation:{output}};
  };
 }});
 const recovery=createRecovery({app,authorization,credential:'TEST-ONLY',verificationFactory,cloudClient:{async costs(id){return {requests:[{requestId:id,costNanoUsd:pendingBill?'0':'1000'}]};}},readModels:async()=>({data:{data:[{id:RECOVERY_LIMITS.model,context_length:262144,max_output_length:65536,pricing:{input:0.04,output:1.35,request:'0'}}]}})});
 await recovery.seed();
 return {app,rules,recovery,authorization,facts,get calls(){return calls;},async run(){await recovery.start();const end=Date.now()+15000;while(recovery.busy&&Date.now()<end)await new Promise(r=>setTimeout(r,10));assert.equal(recovery.busy,false);return recovery.view();}};
}

test('live recovery mechanics: native knowledge revisions, actual fixed failure/repair, model-selected roles and causal ledger persist',async t=>{
 const f=await fixture(t),before=f.recovery.view(),result=await f.run();assert.equal(result.scenario.state,'completed',JSON.stringify(result.scenario));assert.equal(f.calls,6);assert.equal(result.runs.length,6);assert.equal(result.agents.length,5);assert.equal(result.financial.actualNanoUsd,'6000');assert.equal(result.financial.reservedNanoUsd,'0');
 assert.notEqual(result.scenario.knowledgeBefore,result.scenario.knowledgeAfter);assert.notEqual(result.scenario.templateBefore,result.scenario.templateAfter);
 const evaluation=f.app.journal.get('improvementEvaluations','recovery:fixed-evaluation');assert.equal(evaluation.observation.baseline.passed,false);assert.equal(evaluation.observation.candidate.passed,true);assert.equal(evaluation.observation.repaired,true);
 const retry=result.runs.find(r=>r.role==='support_after');assert.equal(retry.documents[0].revision,result.scenario.knowledgeAfter);assert.equal(result.runs.find(r=>r.role==='support_before').documents[0].revision,before.scenario.runbookId?result.scenario.knowledgeBefore:null);
 const types=result.events.map(e=>e.type);for(const type of ['gap.recorded','work.started','knowledge.revised','improvement.proposed','improvement.evaluated','improvement.promoted','recovery.completed'])assert.ok(types.includes(type),type);
 assert.ok(types.indexOf('recovery.failure_observed')<types.indexOf('knowledge.revised'));assert.ok(types.indexOf('improvement.evaluated')<types.indexOf('improvement.promoted'));assert.equal(f.app.journal.list('orders').length,0);
 await assert.rejects(f.recovery.start(),{code:'RECOVERY_ALREADY_ATTEMPTED'});assert.equal(f.calls,6);
 const ledger=await f.app.autonomy.view({role:'owner',verified:true,companyId:RECOVERY_COMPANY},{limit:100});assert.ok(ledger.events.some(e=>e.type==='recovery.completed'));assert.ok(ledger.events.some(e=>e.type==='knowledge.revised'));
});
test('unverified model response holds before delegation; repeated start does not pay or repair',async t=>{
 const f=await fixture(t,{proofFailure:true}),result=await f.run();assert.equal(result.scenario.state,'held');assert.equal(f.calls,1);assert.equal(f.app.journal.list('recoveryCandidates').length,0);assert.equal(f.app.journal.list('recoveryActors').length,3);await assert.rejects(f.recovery.start());assert.equal(f.calls,1);
});
test('model cannot replace the mandatory template field or activate an untested repair',async t=>{
 const f=await fixture(t,{invalidPatch:true}),result=await f.run();assert.equal(result.scenario.state,'held');assert.equal(result.scenario.reasonCode,'RECOVERY_PATCH_INVALID');assert.equal(f.calls,5);assert.equal(f.app.journal.list('recoveryCandidates').length,0);assert.equal(result.events.some(e=>e.type==='improvement.promoted'),false);
});
test('invented retry citation holds instead of reporting recovery success',async t=>{
 const f=await fixture(t,{invalidCitation:true}),result=await f.run();assert.equal(result.scenario.state,'held');assert.equal(result.scenario.reasonCode,'RECOVERY_CITATION_MISMATCH');assert.equal(result.events.some(e=>e.type==='recovery.completed'),false);
});
test('scope fails closed for missing grant and forged owner access',async t=>{
 const f=await fixture(t);f.authorization.enabled=false;const result=await f.run();assert.equal(f.calls,0);assert.equal(result.scenario.reasonCode,'RECOVERY_AUTHORIZATION_REQUIRED');
 const run=f.app.journal.list('recoveryRuns')[0],action={id:run.id+':inference',type:'recovery_inference',runId:run.id,requestFingerprint:run.requestFingerprint,maxCostNanoUsd:RECOVERY_LIMITS.maxRequestNanoUsd};
 assert.equal(f.rules.evaluate(action,{access:{role:'owner',companyId:RECOVERY_COMPANY,verified:false},financial:f.app.treasury.snapshot()}).reasonCode,'ACCESS_DENIED');
});
test('a preflight rejection can be retried explicitly without erasing the failed original or sending a completion',async t=>{
 const f=await fixture(t,{preflightFailure:true}),first=await f.run();assert.equal(first.canRetry,true);assert.equal(f.calls,0);const second=await f.run();assert.equal(second.scenario.attempt,2);assert.equal(second.runs.length,2);assert.equal(f.calls,0);assert.equal(second.events.filter(e=>e.type==='recovery.started').length,2);assert.equal(second.financial.reservedNanoUsd,'0');
});
test('pending zero bills retain every conservative reservation and prevent repeating the scenario',async t=>{
 const f=await fixture(t,{pendingBill:true}),result=await f.run();assert.equal(result.scenario.state,'completed');assert.equal(result.financial.reservedNanoUsd,RECOVERY_LIMITS.maxTotalNanoUsd);assert.equal(result.financial.actualNanoUsd,'0');await assert.rejects(f.recovery.start());assert.equal(f.calls,6);
});
test('private recovery HTTP routes reject unauthenticated and cross-origin requests and expose no credentials',async t=>{
 const f=await fixture(t),origin='http://127.0.0.1:4187';
 assert.equal((await f.recovery.handle(new Request(origin+'/api/workspace/recovery'),{})).status,403);
 assert.equal((await f.recovery.handle(new Request(origin+'/api/workspace/recovery/start',{method:'POST',headers:{origin:'https://other.invalid'},body:'{}'}),{localOwner:true})).status,403);
 assert.equal((await f.recovery.handle(new Request(origin+'/api/workspace/recovery/start',{method:'POST',body:'{"model":"other"}'}),{localOwner:true})).status,409);
 const response=await f.recovery.handle(new Request(origin+'/api/workspace/recovery'),{localOwner:true}),body=await response.text();assert.equal(response.status,200);assert.ok(!body.includes('TEST-ONLY'));assert.ok(!body.includes('credentialHash'));assert.equal(f.calls,0);
});
test('revoked live context prevents reuse, excessive bills are held, and a changed template head cannot be promoted',async t=>{
 const f=await fixture(t);await f.run();const owner={role:'owner',companyId:RECOVERY_COMPANY,verified:true},runs=f.app.journal.list('recoveryRuns'),support=runs.find(r=>r.role==='support_after'),developer=runs.find(r=>r.role==='template_developer');
 const doc=f.app.journal.get('companyKnowledgeDocuments',support.documents[0].id);
 await f.app.journal.transaction({actionId:'test-revoke-context',fingerprint:'test'},tx=>{tx.put('companyKnowledgeDocuments',doc.id,{...doc,agentIds:doc.agentIds.filter(id=>id!==support.actorId)});const run={...support,billing:{actualCostNanoUsd:'100000001',reference:support.result.inferenceId}};tx.put('recoveryRuns',run.id,run);return null;});
 assert.equal(f.rules.evaluate({id:'test-context',type:'recovery_accept',runId:support.id},{access:owner}).reasonCode,'RECOVERY_CONTEXT_CHANGED');
 assert.equal(f.rules.evaluate({id:'test-bill',type:'recovery_cost',runId:support.id},{access:owner,financial:f.app.treasury.snapshot()}).reasonCode,'PROVIDER_COST_BOUND_BREACH');
 assert.equal(f.rules.evaluate({id:'test-repromote',type:'recovery_promote',runId:developer.id},{access:owner}).reasonCode,'RECOVERY_REPAIR_NOT_PROVEN');
});
