import test from 'node:test';
import assert from 'node:assert/strict';
import {autonomyFixture} from './autonomy-fixtures.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {NOW} from './fixtures.mjs';

const actionFor=(h,w,type,extra={})=>({id:`${type}:${w.id}:${w.version}`,type,workId:w.id,runId:w.lease.runId,fence:w.lease.fence,...extra});
async function started(t){const h=await autonomyFixture(t);await h.bootstrap();await h.claim(h.getFacts().work[0].id);return h;}
function assertStable(h,w){
 const before=structuredClone(h.getFacts().objectives[0].counters),effectId=w.effectId;
 // Reconstruct Rules with persisted facts and advance past the local lease.
 const rules=createRules({config:h.c,companyId:h.companyId,clock:()=>NOW+60000,getAutonomyFacts:h.getFacts,getInferenceBounds:()=>h.bounds});
 for(let i=0;i<4;i++)assert.notEqual(rules.evaluate({id:`claim-again:${i}`,type:'autonomy_claim',workId:w.id}).status,'allow');
 assert.deepEqual(h.getFacts().objectives[0].counters,before);assert.equal(h.journal.get('agentWork',w.id).effectId,effectId);
}

test('trusted SDK no-submission releases local claim and persists an unchanged-condition blocker; explicit resume rechecks once',async t=>{
 const h=await started(t),root=h.getFacts().work[0].id;await h.prepare(root);let w=h.journal.get('agentWork',root);
 const result={id:'prepare:no-cloud-access',source:'local-sdk',companyId:h.companyId,workId:root,runId:w.lease.runId,fence:w.lease.fence,effectId:w.effectId,requestFingerprint:w.requestFingerprint,result:{status:'not_submitted',code:'MISSING_CREDENTIAL',cost:{status:'pending'}},observedAt:new Date(NOW).toISOString()};await h.write('internalResults',result);
 const d=await h.apply({id:'observe:no-access',type:'agent_observe',workId:root,resultId:result.id},{},{allowHold:true});assert.equal(d.decision.status,'allow');w=h.journal.get('agentWork',root);assert.equal(w.lease,null);assert.ok(w.admissionConditionHash);assertStable(h,w);
 const before=h.getFacts().objectives[0].counters.steps;for(let i=0;i<3;i++)assert.equal((await h.claim(root)).decision.reasonCode,'INFERENCE_NOT_SUBMITTED');assert.equal(h.getFacts().objectives[0].counters.steps,before);
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'resume'});assert.equal((await h.claim(root)).decision.status,'allow');assert.equal(h.getFacts().objectives[0].counters.steps,before+1);
 // A late observation from the old run cannot release the new lease.
 const newer=h.journal.get('agentWork',root);const late=await h.apply({id:'observe:late',type:'agent_observe',workId:root,resultId:result.id},{},{allowHold:true});assert.equal(late.decision.status,'allow');assert.deepEqual(h.journal.get('agentWork',root).lease,newer.lease);
});

test('knowledge preparation failures require an exact private record and no intent; caller facts cannot provide it',async t=>{
 const h=await started(t),w=h.getFacts().work[0],action=actionFor(h,w,'agent_preparation_blocked',{observationId:'failed:knowledge'}),r={id:'failed:knowledge',source:'internal-knowledge-capture',companyId:h.companyId,workId:w.id,runId:w.lease.runId,fence:w.lease.fence,stage:'knowledge_capture',reasonCode:'JBRAIN_UNAVAILABLE',observedAt:new Date(NOW).toISOString()};
 assert.equal(h.rules.evaluate(action,{preparationFailures:[r],verified:true}).reasonCode,'PREPARATION_OBSERVATION_REQUIRED');
 await h.write('internalPreparationFailures',r);assert.equal(h.rules.evaluate({...action,fence:999}).reasonCode,'STALE_WORK_FENCE');
 const blocked=await h.apply(action,{},{allowHold:true});assert.equal(blocked.decision.reasonCode,'JBRAIN_UNAVAILABLE');const current=h.journal.get('agentWork',w.id);assert.equal(current.lease,null);assert.ok(current.admissionConditionHash);assertStable(h,current);
 assert.equal(h.journal.events().filter(e=>e.type==='agent.stopped'&&e.data.runId===r.runId).length,1);
});

test('recorded financial/SDK intents prevent not_submitted from creating a no-intent retry claim',async t=>{
 for(const kind of ['operation','reservation','approved']){
  const h=await started(t),root=h.getFacts().work[0].id;await h.prepare(root);const w=h.journal.get('agentWork',root);
  if(kind==='operation')await h.journal.registerOperation({actionId:`adapters:m07:${w.effectId}`,externalActionId:w.effectId,fingerprint:'controlled-intent',purpose:'agent_inference',status:'unknown'});
  else await h.write('treasury',{id:'financial',version:1,reservations:kind==='reservation'?[{actionId:w.effectId,status:'reserved',upperBoundNanoUsd:'1'}]:[],approvedPlans:kind==='approved'?[{actionId:w.effectId}]:[],consumedPermits:[]});
  const r={id:'capture-failure',source:'internal-knowledge-capture',companyId:h.companyId,workId:root,runId:w.lease.runId,fence:w.lease.fence,stage:'knowledge_capture',reasonCode:'JBRAIN_UNAVAILABLE',observedAt:new Date(NOW).toISOString()};await h.write('internalPreparationFailures',r);
  assert.equal(h.rules.evaluate(actionFor(h,w,'agent_preparation_blocked',{observationId:r.id})).reasonCode,'RECONCILIATION_REQUIRED');assert.deepEqual(h.journal.get('agentWork',root).lease,w.lease);
 }
});
