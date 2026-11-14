import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreasury} from '../../src/treasury/index.mjs';
import {autonomyFixture,INTENT} from './autonomy-fixtures.mjs';
import {financial,NOW,order,inference} from './fixtures.mjs';
import {componentFixture} from './component-fixtures.mjs';

async function ready(t){const h=await autonomyFixture(t);await h.bootstrap();const root=h.getFacts().work[0].id;await h.claim(root);assert.equal((await h.accept(root,[{type:'complete_work',summary:'Controlled',deliverable:'Controlled output'}])).decision.status,'allow');
 const f=financial();await h.journal.transaction({actionId:'test-only-money-facts',fingerprint:'test-only-money-facts'},tx=>tx.put('treasury','financial',f));const treasury=createTreasury({journal:h.journal,clock:()=>NOW,getPolicyState:()=>h.rules.snapshot()});const action=h.journal.get('agentWork',root).inferenceAction;return {...h,root,treasury,action,facts:()=>({financial:treasury.snapshot(),creditId:'credit1',action})};}

test('internal inference uses actual M03 reservation/permit +2 and final current fence after consumption',async t=>{
 const h=await ready(t),before=h.treasury.snapshot().version,d=h.rules.evaluate(h.action,h.facts());assert.equal(d.status,'allow',JSON.stringify(d));assert.equal(d.plan.reservation.purpose,'inference');assert.equal(d.plan.workId,h.root);assert.equal(d.plan.reservation.orderId,undefined);
 await h.treasury.applyDecision({actionId:h.action.id,decision:d});assert.equal(h.treasury.snapshot().version,before+1);const pre=h.rules.validateDispatch(d.permit,h.facts());assert.equal(pre.status,'allow',JSON.stringify(pre));await h.treasury.consumePermit({actionId:h.action.id,permit:d.permit,decision:pre});assert.equal(h.treasury.snapshot().version,before+2);
 // This mutation stands for a lease expiring during the awaited consumption.
 const work=h.journal.get('agentWork',h.root);await h.write('agentWork',{...work,lease:{...work.lease,leaseUntil:new Date(NOW).toISOString()},version:work.version+1});let calls=0;
 assert.equal(h.rules.dispatch(d.permit,h.facts(),()=>calls++).reasonCode,'STALE_WORK_FENCE');assert.equal(calls,0);assert.equal(h.treasury.snapshot().reservations[0].status,'reserved');assert.equal(h.treasury.snapshot().consumedPermits.length,1);
});

test('internal final gate rejects pause, profile change and current kill without changing original effect identity',async t=>{
 for(const mutation of ['pause','profile','kill']){const h=await ready(t),d=h.rules.evaluate(h.action,h.facts());assert.equal(d.status,'allow');await h.treasury.applyDecision({actionId:h.action.id,decision:d});const pre=h.rules.validateDispatch(d.permit,h.facts());await h.treasury.consumePermit({actionId:h.action.id,permit:d.permit,decision:pre});
  if(mutation==='pause')await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});
  if(mutation==='profile'){const a=h.journal.get('agents',h.getFacts().company.managerId);await h.write('agents',{...a,status:'paused',version:a.version+1});}
  if(mutation==='kill')h.rules.updateConfig({...h.c,killSwitch:true});
  let calls=0;assert.notEqual(h.rules.dispatch(d.permit,h.facts(),()=>calls++).status,'allow');assert.equal(calls,0);assert.equal(h.journal.get('agentWork',h.root).effectId,h.action.id);
 }
});

test('all inference paths share the configured company slot and unknown costs remain held',async t=>{
 const h=await ready(t),f=h.treasury.snapshot();f.reservations.push({id:'foreign-pending',actionId:'customer-effect',purpose:'inference',status:'unknown',upperBoundNanoUsd:'1'});
 assert.equal(h.rules.evaluate(h.action,{...h.facts(),financial:f}).reasonCode,'COMMON_INFERENCE_BUSY');
 assert.equal(h.rules.evaluate(inference(),{financial:f,order:order()}).reasonCode,'COMMON_INFERENCE_BUSY');
 const component=componentFixture({autonomy:INTENT});component.financial.reservations.push({id:'internal-pending',actionId:'internal:company:work:1',purpose:'inference',status:'pending',upperBoundNanoUsd:'1'});assert.equal(component.rules.evaluate(component.action,component.facts).reasonCode,'COMMON_INFERENCE_BUSY');
});

test('frozen request preparation rechecks current profile/grants and wire-only proof accepts zero commands',async t=>{
 const h=await ready(t),w=h.journal.get('agentWork',h.root),frame={workId:w.id,runId:w.lease.runId,fence:w.lease.fence};
 const response=h.runtime.verificationResults.find(r=>r.stage==='response');response.status='unavailable';response.plaintextBindingStatus='unavailable';response.durableReplayStatus='unavailable';
 // A fresh proof-held work has no accepted commands; previous accepted findings
 // cannot be used as a new candidate just because wire verification succeeded.
 const run=h.journal.get('agentRuns',frame.runId);await h.write('agentRuns',{...run,state:'preparing',acceptedCommands:[],candidateHash:null,version:run.version+1});
 const result=h.getFacts().internalResults[0];const held=h.rules.evaluate({id:'wire-only',type:'agent_result',...frame,resultId:result.id});assert.equal(held.status,'hold');assert.equal(h.journal.get('agentRuns',frame.runId).acceptedCommands.length,0);
 const agent=h.journal.get('agents',w.actorId);await h.write('agents',{...agent,status:'paused',version:agent.version+1});assert.equal(h.rules.evaluate({id:'revoked-prepare',type:'agent_prepare',...frame},{financial:h.treasury.snapshot()}).reasonCode,'STALE_ACTOR_POLICY');
});

test('internal source-document reads require a real current work frame and admitted document intersection',async t=>{
 const h=await ready(t),w=h.journal.get('agentWork',h.root),agent=h.journal.get('agents',w.actorId),id=`companies/${h.companyId}/documents/private`;
 const facts={company:{id:h.companyId},agent,documents:[{id,companyId:h.companyId,visibility:'company'}],access:{role:'agent',companyId:h.companyId,workId:w.id,runId:w.lease.runId,fence:w.lease.fence}};
 const action={id:'internal-context',type:'knowledge_context',documentIds:[id]};assert.equal(h.rules.evaluate(action,facts).reasonCode,'KNOWLEDGE_ACCESS_DENIED');
 assert.equal(h.rules.evaluate(action,{...facts,access:{...facts.access,fence:999}}).reasonCode,'STALE_WORK_FENCE');
 assert.equal(h.rules.evaluate(action,{...facts,access:{role:'public'}}).reasonCode,'INTERNAL_SCOPE_REQUIRED');
});
