import test from 'node:test';
import assert from 'node:assert/strict';
import {autonomyFixture} from './autonomy-fixtures.mjs';
import {NOW,financial} from './fixtures.mjs';

test('expired local preparation with proved absent SDK/financial intent fences old worker and preserves effect/request identity',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const id=h.getFacts().work[0].id;await h.claim(id);assert.equal((await h.prepare(id)).decision.status,'allow');const old=h.journal.get('agentWork',id),before=h.getFacts().objectives[0].counters;
 h.setTime(NOW+30001);const claimed=await h.claim(id);assert.equal(claimed.decision.status,'allow',JSON.stringify(claimed.decision));assert.equal(claimed.decision.plan.noIntentRecovery,true);
 const current=h.journal.get('agentWork',id);assert.equal(current.effectId,old.effectId);assert.equal(current.logicalStep,old.logicalStep);assert.equal(current.requestFingerprint,old.requestFingerprint);assert.equal(current.inferenceAction.runId,current.lease.runId);assert.notEqual(current.lease.fence,old.lease.fence);assert.equal(h.journal.get('agentRuns',old.lease.runId).state,'superseded');
 assert.equal(h.rules.evaluate({id:'old-prepare',type:'agent_prepare',workId:id,runId:old.lease.runId,fence:old.lease.fence}).reasonCode,'STALE_WORK_FENCE');assert.equal((await h.prepare(id)).decision.status,'allow');assert.equal(h.getFacts().objectives[0].counters.calls,before.calls);assert.equal(h.getFacts().operations.length,0);
});

test('any original SDK intent or financial admission prevents new preparation/recovery assumptions',async t=>{
 for(const kind of ['operation','financial']){
  const h=await autonomyFixture(t);await h.bootstrap();const id=h.getFacts().work[0].id;await h.claim(id);await h.prepare(id);const w=h.journal.get('agentWork',id);
  if(kind==='operation')await h.journal.registerOperation({actionId:`adapters:m07:${w.effectId}`,externalActionId:w.effectId,fingerprint:'controlled-intent',purpose:'agent_inference',status:'unknown'});
  else{const f=financial();f.approvedPlans.push({actionId:w.effectId});await h.write('treasury',{...f,id:'financial'});}
  if(kind==='financial')assert.equal(h.rules.evaluate({id:'reprepare',type:'agent_prepare',workId:id,runId:w.lease.runId,fence:w.lease.fence}).reasonCode,'RECONCILIATION_REQUIRED');
  h.setTime(NOW+30001);const d=await h.claim(id);assert.equal(d.decision.reasonCode,'RECONCILE_REQUIRED');assert.equal(h.journal.get('agentWork',id).effectId,w.effectId);assert.equal(h.getFacts().runs.length,1);
 }
});

test('read-only recovery accepts only verified original output and resumes a partial canonical batch without duplicate writes',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const id=h.getFacts().work[0].id;await h.claim(id);await h.accept(id,[{type:'propose_service',baseListingId:'known-service',title:'Controlled draft',inputs:['Question'],deliverable:'A sourced answer'},{type:'complete_work',summary:'Controlled done',deliverable:'Controlled result'}]);
 assert.equal((await h.command(id,0)).decision.status,'allow');const old=h.journal.get('agentWork',id),result=h.getFacts().internalResults[0],resultBytes=h.getFacts().objectives[0].counters.resultBytes,calls=h.getFacts().objectives[0].counters.calls;
 h.setTime(NOW+30001);const action={id:'recover-original',type:'autonomy_recover_result',workId:id,resultId:result.id},response=h.runtime.verificationResults.find(r=>r.stage==='response');response.plaintextBindingStatus='unavailable';assert.equal(h.rules.evaluate(action).status,'hold');assert.equal(h.getFacts().runs.length,1);response.plaintextBindingStatus='verified';
 const recovery=await h.apply(action,{}, {allowHold:true});assert.equal(recovery.decision.status,'allow',JSON.stringify(recovery.decision));const w=h.journal.get('agentWork',id),frame={workId:id,runId:w.lease.runId,fence:w.lease.fence};assert.equal(recovery.decision.plan.recoveryOnly,true);assert.equal(h.journal.get('agentRuns',frame.runId).commandOutcomes.length,1);
 assert.equal(h.rules.evaluate({id:'no-new-prepare',type:'agent_prepare',...frame}).reasonCode,'RECOVERY_SCOPE_READ_ONLY');
 assert.equal(h.rules.evaluate({...old.inferenceAction,runId:frame.runId,fence:frame.fence}).reasonCode,'RECOVERY_SCOPE_READ_ONLY');
 const accepted=await h.apply({id:'accept-recovery',type:'agent_result',...frame,resultId:result.id},{},{allowHold:true});assert.equal(accepted.decision.status,'allow');assert.equal(h.getFacts().objectives[0].counters.resultBytes,resultBytes);assert.equal(h.getFacts().objectives[0].counters.calls,calls);
 const replay=await h.command(id,0);assert.equal(replay.decision.status,'allow');assert.equal(replay.replayed,true);assert.equal(h.getFacts().serviceDrafts.length,1);assert.equal((await h.command(id,1)).decision.status,'allow');assert.equal(h.getFacts().company.state,'completed');
});

test('owner knowledge selection grants only existing document access to paused, unfrozen actor work',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});let agent=h.getFacts().agents.find(a=>a.autonomyRole==='manager');const doc={id:`companies/${h.companyId}/documents/source`,companyId:h.companyId,visibility:'restricted',agentIds:[],version:1};await h.write('companyKnowledgeDocuments',doc);
 assert.equal((await h.owner('autonomy_knowledge',{agentId:agent.id,version:agent.version,knowledgeIds:[doc.id]})).decision.reasonCode,'KNOWLEDGE_GRANT_REQUIRED');await h.write('companyKnowledgeDocuments',{...doc,agentIds:[agent.id]});
 const selected=await h.owner('autonomy_knowledge',{agentId:agent.id,version:agent.version,knowledgeIds:[doc.id]});assert.equal(selected.decision.status,'allow');agent=h.journal.get('agents',agent.id);assert.deepEqual(agent.scope.knowledgeIds,[doc.id]);const w=h.getFacts().work[0];assert.deepEqual(w.scope.knowledgeIds,[doc.id]);
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'resume'});await h.claim(w.id);const current=h.journal.get('agentWork',w.id),access={role:'agent',companyId:h.companyId,workId:w.id,runId:current.lease.runId,fence:current.lease.fence};
 const allowed=h.rules.evaluate({id:'read-selected',type:'knowledge_context',documentIds:[doc.id]},{access,agent,company:{id:h.companyId},documents:[{...doc,agentIds:[agent.id]}]});assert.equal(allowed.status,'allow');assert.deepEqual(allowed.plan.documentIds,[doc.id]);
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});assert.equal((await h.owner('autonomy_knowledge',{agentId:agent.id,version:agent.version,knowledgeIds:[]})).decision.status,'allow');
 const events=h.journal.events();for(const type of ['agent.created','agent.started','agent.stopped','agent.updated'])assert.ok(events.some(e=>e.type===type),type);assert.ok(events.filter(e=>e.type==='agent.stopped').every(e=>e.data.remoteCancelled===false));
});

test('two consecutive result recoveries preserve the latest canonical prefix and never duplicate drafts or accounting',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const id=h.getFacts().work[0].id;await h.claim(id);const draft=n=>({type:'propose_service',baseListingId:'known-service',title:`Draft ${n}`,inputs:['Question'],deliverable:'Evidence'});await h.accept(id,[draft(1),draft(2),{type:'complete_work',summary:'Done',deliverable:'Combined result'}]);
 await h.command(id,0);const result=h.getFacts().internalResults[0],before=structuredClone(h.getFacts().objectives[0].counters);
 for(const [i,at] of [[1,NOW+30001],[2,NOW+60002]]){
  h.setTime(at);const recovery=await h.apply({id:`second-recovery:${i}`,type:'autonomy_recover_result',workId:id,resultId:result.id},{},{allowHold:true});assert.equal(recovery.decision.status,'allow',JSON.stringify(recovery.decision));const w=h.journal.get('agentWork',id),frame={workId:id,runId:w.lease.runId,fence:w.lease.fence};assert.equal(h.journal.get('agentRuns',frame.runId).commandOutcomes.length,i);
  assert.equal((await h.apply({id:`accept-recovery:${i}`,type:'agent_result',...frame,resultId:result.id},{},{allowHold:true})).decision.status,'allow');assert.equal((await h.command(id,i-1)).replayed,true);assert.equal((await h.command(id,i)).decision.status,'allow');
 }
 assert.equal(h.getFacts().serviceDrafts.length,2);assert.equal(h.getFacts().company.state,'completed');assert.equal(h.getFacts().objectives[0].counters.calls,before.calls);assert.equal(h.getFacts().objectives[0].counters.resultBytes,before.resultBytes);assert.equal(h.getFacts().operations.length,0);
});

test('unchanged missing live authority cannot burn objective steps while a genuine trusted change rechecks once',async t=>{
 const h=await autonomyFixture(t,{live:true});await h.bootstrap();const id=h.getFacts().work[0].id;await h.claim(id);const missing=await h.prepare(id);assert.equal(missing.decision.reasonCode,'AGENT_AUTHORIZATION_REQUIRED');let w=h.journal.get('agentWork',id);const frozenFingerprint=w.requestFingerprint,before=structuredClone(h.getFacts().objectives[0].counters);assert.equal(w.lease,null);assert.ok(w.admissionConditionHash);assert.equal(w.callAdmitted,false);
 for(let i=1;i<=5;i++){h.setTime(NOW+30001*i);assert.equal((await h.claim(id)).decision.reasonCode,'AGENT_AUTHORIZATION_REQUIRED');assert.deepEqual(h.getFacts().objectives[0].counters,before);}
 assert.equal(h.getFacts().runs.length,1);assert.equal(before.calls,0);
 h.setAgentAuthorization({id:'controlled-agent-grant',mode:'live',companyId:h.companyId,policyVersion:h.rules.snapshot().policyVersion,workId:id,objectiveId:w.objectiveId,effectId:w.effectId,requestFingerprint:frozenFingerprint,model:w.request.model,actions:['agent_inference'],maxRequestNanoUsd:h.c.spending.maxRequestNanoUsd,dailyInferenceCapNanoUsd:h.c.spending.dailyInferenceCapNanoUsd,expiresAt:new Date(NOW+3600000).toISOString(),creditId:'not-funded',creditScopeId:'not-funded'});
 const claimed=await h.claim(id);assert.equal(claimed.decision.status,'allow');w=h.journal.get('agentWork',id);assert.equal(w.requestFingerprint,frozenFingerprint);assert.equal((await h.prepare(id)).decision.reasonCode,'RUNTIME_NOT_READY');const after=structuredClone(h.getFacts().objectives[0].counters);assert.equal(after.steps,before.steps+1);assert.equal(after.calls,0);
 for(let i=6;i<=8;i++){h.setTime(NOW+30001*i);assert.equal((await h.claim(id)).decision.reasonCode,'RUNTIME_NOT_READY');assert.deepEqual(h.getFacts().objectives[0].counters,after);}
 assert.equal(h.getFacts().runs.length,2);assert.equal(h.getFacts().operations.length,0);
});
