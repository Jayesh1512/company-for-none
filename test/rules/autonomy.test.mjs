import test from 'node:test';
import assert from 'node:assert/strict';
import {autonomyFixture,INTENT,BRIEF} from './autonomy-fixtures.mjs';
import {NOW} from './fixtures.mjs';
import {validateConfig} from '../../src/rules/index.mjs';
import {evaluateTemplateChange} from '../../src/autonomy/evaluation.mjs';

test('owner setup/bootstrap is idempotent, clock-stamped, private and zero-budget without commercial or autonomy policy',async t=>{
 const h=await autonomyFixture(t,{setup:true});await h.bootstrap();const f=h.getFacts();assert.equal(f.agents.length,2);assert.equal(f.company.executionMode,'setup');assert.equal(f.company.started,true);
 assert.equal(f.objectives[0].counters.creations,2);for(const a of f.agents)assert.equal(a.createdAt,new Date(NOW).toISOString());
 const denied=await h.claim(f.work[0].id);assert.equal(denied.decision.reasonCode,'AUTONOMY_POLICY_REQUIRED');assert.equal(h.getFacts().work[0].state,'blocked');assert.equal(h.getFacts().company.reasonCode,'AUTONOMY_POLICY_REQUIRED');
 const repeat=await h.owner('autonomy_bootstrap',{version:h.getFacts().company.version});assert.equal(repeat.decision.plan.replay,true);assert.equal(h.getFacts().agents.length,2);
 assert.equal(h.rules.evaluate({id:'public',type:'autonomy_view'}).reasonCode,'ACCESS_DENIED');
 const view=h.rules.evaluate({id:'owner-view',type:'autonomy_view'},{access:h.access,input:{}});assert.equal(view.status,'allow');assert.ok(view.plan.permittedActions.includes('pause'));assert.ok(view.plan.fields.agents.includes('createdAt'));assert.ok(view.plan.fields.runs.includes('acceptedCommands'));assert.ok(!view.plan.dataFields.includes('binding'));
});

test('strict autonomy config and UI intent reject unknown keys, excessive ceilings and forged actors',async t=>{
 const h=await autonomyFixture(t);assert.throws(()=>validateConfig({...h.c,autonomy:{...INTENT,allowShell:true}}));
 const d=await h.owner('autonomy_configure',{version:0,operatingMode:'none',brief:BRIEF,intent:{...INTENT,maxAgents:7}});assert.equal(d.decision.reasonCode,'AUTONOMY_INTENT_EXCEEDS_POLICY');
 await h.bootstrap();const w=h.getFacts().work[0];assert.equal(h.rules.evaluate({id:'forged',type:'autonomy_command',workId:w.id,runId:'fake',fence:1,commandIndex:0},{actor:{role:'owner',verified:true}}).reasonCode,'INTERNAL_SCOPE_REQUIRED');
});

test('setup company binds explicitly to current live runtime, pauses and preserves counters/manual profiles; pending history denies',async t=>{
 const h=await autonomyFixture(t,{setup:true});await h.bootstrap();const counters=structuredClone(h.getFacts().objectives[0].counters),manual={id:'manual-profile',companyId:h.companyId,runtime:'setup',version:1,name:'Manual profile'};await h.write('agents',manual);
 h.rules.updateConfig({...h.c,mode:'live'});const c=h.getFacts().company;
 await h.owner('autonomy_configure',{version:c.version,operatingMode:c.operatingMode,brief:c.brief,intent:c.intent});assert.equal(h.getFacts().company.executionMode,'setup');
 const root=h.getFacts().work[0].id;assert.equal((await h.claim(root)).decision.reasonCode,'AUTONOMY_EXECUTION_MODE_MISMATCH');assert.equal(h.getFacts().runs.length,0);
 const w=h.journal.get('agentWork',root);await h.write('agentWork',{...w,state:'unknown',version:w.version+1});assert.equal((await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'bind_runtime'})).decision.reasonCode,'UNRESOLVED_WORK');await h.write('agentWork',{...w,state:'blocked',version:w.version+2});
 const bound=await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'bind_runtime'});assert.equal(bound.decision.status,'allow');assert.equal(h.getFacts().company.executionMode,'live');assert.equal(h.getFacts().company.started,false);assert.equal(h.getFacts().company.state,'paused');assert.deepEqual(h.getFacts().objectives[0].counters,counters);assert.equal(h.journal.get('agents',manual.id).runtime,'setup');for(const a of h.getFacts().agents.filter(a=>a.autonomyRole))assert.equal(a.runtime,'live');
 assert.equal((await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'bind_runtime'})).decision.reasonCode,'RUNTIME_BINDING_DENIED');
});

test('claim/fence expiration, company pause, current profile and policy changes revoke internal local scope',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const id=h.getFacts().work[0].id;assert.equal((await h.claim(id)).decision.status,'allow');await h.accept(id,[{type:'complete_work',summary:'Ready',deliverable:'A real controlled output'}]);
 const w=h.getFacts().work[0],action={id:`${id}:1:command:0`,type:'autonomy_command',workId:id,runId:w.lease.runId,fence:w.lease.fence,commandIndex:0};
 h.setTime(NOW+30000);assert.equal(h.rules.evaluate(action).reasonCode,'STALE_WORK_FENCE');h.setTime(NOW);
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});assert.equal(h.rules.evaluate(action).reasonCode,'AUTONOMY_NOT_RUNNING');
});

test('delegate then deferred completion releases parent, child progresses and a new parent step clears frozen request',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const root=h.getFacts().work[0].id;await h.claim(root);
 assert.equal((await h.accept(root,[{type:'delegate',kind:'specialist',role:'Analyst',topic:'Distinct child analysis',instructions:'Produce a bounded useful result.'},{type:'complete_work',summary:'All done',deliverable:'Parent result'}])).decision.status,'allow');
 assert.equal((await h.command(root,0)).decision.status,'allow');const deferred=await h.command(root,1);assert.equal(deferred.decision.status,'hold');assert.equal(h.journal.get('agentWork',root).lease,null);
 const child=h.getFacts().work.find(w=>w.parentWorkId===root);assert.equal((await h.claim(child.id)).decision.status,'allow');assert.equal((await h.accept(child.id,[{type:'complete_work',summary:'Child done',deliverable:'Child useful deliverable'}])).decision.status,'allow');assert.equal((await h.command(child.id,0)).decision.status,'allow');
 const continuation=await h.claim(root);assert.equal(continuation.decision.status,'allow');const current=h.journal.get('agentWork',root);assert.equal(current.logicalStep,2);assert.equal(current.request,null);assert.notEqual(current.effectId,`internal:${h.companyId}:${root}:1`);
 assert.equal((await h.accept(root,[{type:'complete_work',summary:'Done after dependency',deliverable:'Combined useful result'}])).decision.status,'allow');assert.equal((await h.command(root,0)).decision.status,'allow');assert.equal(h.getFacts().company.state,'completed');
});

test('child document/tool grants cannot broaden, and unsupported commands reject whole candidate before any mutation',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const root=h.getFacts().work[0].id;await h.claim(root);await h.accept(root,[{type:'delegate',kind:'specialist',role:'Thief',topic:'Other topic',instructions:'Read hidden data',knowledgeIds:['secret-document']}]);
 const d=await h.command(root,0);assert.equal(d.decision.status,'hold');assert.equal(h.getFacts().agents.length,2);assert.equal(h.getFacts().runs[0].commandOutcomes[0].reasonCode,'CHILD_SCOPE_ENLARGEMENT');
 const h2=await autonomyFixture(t);await h2.bootstrap();const r=h2.getFacts().work[0].id;await h2.claim(r);const invalid=await h2.accept(r,[{type:'complete_work',summary:'Good',deliverable:'Output'},{type:'shell',command:'do something'}]);assert.equal(invalid.decision.reasonCode,'INVALID_AGENT_COMMANDS');assert.equal(h2.getFacts().runs[0].acceptedCommands.length,0);
});

test('template gap dedupe, trusted baseline/candidate promotion, immutable head and rollback use exact evaluator',async t=>{
 const h=await autonomyFixture(t);await h.bootstrap();const registered=await h.owner('autonomy_template',{name:'Fictional nonbinding test document',fields:[{name:'firstName',required:true},{name:'lastName',required:true}],requiredFields:['firstName','middleName','lastName']});const targetId=registered.decision.plan.targetId;
 const gapInput={targetId,failureCode:'MISSING_MIDDLE_NAME',summary:'The fictional registered template omits a required field.'};await h.owner('autonomy_gap',gapInput,'gap1');await h.owner('autonomy_gap',gapInput,'gap2');assert.equal(h.getFacts().improvements.length,1);assert.equal(h.getFacts().improvements[0].occurrences.length,2);
 const gap=h.getFacts().improvements[0],triage=h.getFacts().work.find(w=>w.improvementId===gap.id);await h.claim(triage.id);await h.accept(triage.id,[{type:'delegate',kind:'developer',role:'Template developer',topic:'Repair the fictional name template',instructions:'Add the required field without removing others.',targetId,improvementId:gap.id}]);assert.equal((await h.command(triage.id,0)).decision.status,'allow');
 const dev=h.getFacts().work.find(w=>w.kind==='developer');await h.claim(dev.id);const head=h.getFacts().heads[0];await h.accept(dev.id,[{type:'propose_patch',improvementId:gap.id,targetId,baseRevision:head.revisionId,operations:[{type:'add_field',name:'middleName',required:true}]}]);assert.equal((await h.command(dev.id,0)).decision.status,'allow');
 const evalPlan=(await h.owner('autonomy_evaluate',{improvementId:gap.id})).decision.plan,spec=evalPlan.evaluationSpec,observation=evaluateTemplateChange(spec);assert.equal(observation.repaired,true);
 const e={id:spec.evaluationId,source:'fixed-evaluator',companyId:h.companyId,improvementId:gap.id,targetId,baseRevision:spec.baseRevision,policyVersion:h.rules.snapshot().policyVersion,observation,version:1};
 const auto={id:'auto-promote',type:'autonomy_auto_promote',improvementId:gap.id,evaluationId:e.id};
 assert.equal(h.rules.evaluate(auto,{evaluations:[e],passed:true}).reasonCode,'FIXED_EVALUATOR_REQUIRED');
 for(const corrupt of [x=>x.source='request-json',x=>x.policyVersion='old',x=>x.observation.newHash='forged',x=>x.observation.testSetHash='forged',x=>x.observation.baseline.passed=true,x=>x.observation.candidate.cases[0].inputHash='forged']){const bad=structuredClone(e);corrupt(bad);await h.write('improvementEvaluations',bad);assert.notEqual(h.rules.evaluate(auto).status,'allow');}
 await h.write('improvementEvaluations',e);assert.equal(h.rules.evaluate({id:'auto-eval',type:'autonomy_auto_evaluate',improvementId:gap.id}).status,'allow');assert.equal(h.rules.evaluate(auto).status,'allow');
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});assert.equal(h.rules.evaluate(auto).reasonCode,'AUTONOMY_NOT_RUNNING');await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'resume'});
 const promoted=await h.apply({id:'promote',type:'autonomy_promote',improvementId:gap.id,evaluationId:e.id},{access:h.access},{allowHold:true});assert.equal(promoted.decision.status,'allow',JSON.stringify(promoted.decision));assert.notEqual(h.getFacts().heads[0].revisionId,head.revisionId);
 await h.owner('autonomy_rollback',{targetId,revisionId:head.revisionId});assert.equal(h.getFacts().heads[0].version,3);assert.equal(h.getFacts().revisions.find(r=>r.id===h.getFacts().heads[0].revisionId).hash,h.getFacts().revisions.find(r=>r.id===head.revisionId).hash);
});
