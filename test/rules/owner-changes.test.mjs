import test from 'node:test';
import assert from 'node:assert/strict';
import {autonomyFixture} from './autonomy-fixtures.mjs';
import {validateCommand,setupFingerprint} from '../../src/rules/autonomy.mjs';
import {commandResponseFormat} from '../../src/rules/command-format.mjs';
import {hash} from '../../src/rules/config.mjs';

async function developer(t,kind='instructions',target){
 const h=await autonomyFixture(t);await h.bootstrap();
 const registered=await h.owner('autonomy_template',{name:'Bounded improvement target',fields:[{name:'answer',required:true}],requiredFields:['answer']}),targetId=registered.decision.plan.targetId;
 await h.owner('autonomy_gap',{targetId,failureCode:'GUIDANCE_MISSING',summary:'An instruction or host change needs owner review.'});
 const gap=h.getFacts().improvements[0],triage=h.getFacts().work.find(w=>w.improvementId===gap.id);
 await h.claim(triage.id);await h.accept(triage.id,[{type:'delegate',kind:'developer',role:'Improvement developer',topic:'Draft a bounded owner change',instructions:'Propose text for owner review.',targetId,improvementId:gap.id}]);assert.equal((await h.command(triage.id,0)).decision.status,'allow');
 const dev=h.getFacts().work.find(w=>w.kind==='developer');await h.claim(dev.id);
 const proposal={type:'propose_change',improvementId:gap.id,kind,targetId:target??`agent:${h.getFacts().company.managerId}`,rationale:'Make the working text clearer.',proposedText:'Use concrete evidence and list unresolved questions.'};
 await h.accept(dev.id,[proposal]);return {h,gap,dev,proposal};
}

test('developer instruction proposal is admitted inertly; only paused owner acceptance creates an immutable text revision',async t=>{
 const {h,gap,dev,proposal}=await developer(t),before=h.getFacts(),manager=before.agents.find(a=>a.id===before.company.managerId),retries=before.objectives[0].counters.retries;
 assert.equal((await h.command(dev.id,0)).decision.status,'allow');let pending=h.getFacts().improvements.find(i=>i.id===gap.id);
 assert.equal(pending.state,'owner_review');assert.equal(pending.changeProposal.proposedTextHash,hash(proposal.proposedText));assert.equal(h.getFacts().objectives[0].counters.retries,retries);assert.deepEqual(h.getFacts().agents.find(a=>a.id===manager.id),manager);
 assert.equal(h.getFacts().heads.some(x=>x.targetId===proposal.targetId),false);
 for(const type of ['autonomy_auto_evaluate','autonomy_auto_promote'])assert.equal(h.rules.evaluate({id:type,type,improvementId:gap.id}).reasonCode,'ADMITTED_IMPROVEMENT_REQUIRED');
 const review={improvementId:gap.id,version:pending.version,decision:'accept'};
 assert.equal(h.rules.evaluate({id:'agent-review',type:'autonomy_review_change'},{input:review}).reasonCode,'ACCESS_DENIED');
 assert.equal((await h.owner('autonomy_review_change',{...review,version:0})).decision.reasonCode,'AUTONOMY_VERSION_CONFLICT');
 assert.equal((await h.owner('autonomy_review_change',review)).decision.reasonCode,'PAUSE_REQUIRED');
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});
 const reviewBasis=setupFingerprint(h.getFacts().company,h.getFacts());
 assert.equal((await h.owner('autonomy_review_change',review)).decision.status,'allow');
 assert.notEqual(setupFingerprint(h.getFacts().company,h.getFacts()),reviewBasis,'An accepted instructions revision invalidates the current local setup review');
 const head=h.getFacts().heads.find(x=>x.targetId===proposal.targetId),revision=h.getFacts().revisions.find(r=>r.id===head.revisionId);
 assert.equal(revision.kind,'instructions');assert.equal(revision.scope,'agent');assert.equal(revision.agentId,manager.id);assert.deepEqual(revision.body,{text:proposal.proposedText});assert.equal(revision.hash,hash(revision.body));
 assert.deepEqual(h.getFacts().agents.find(a=>a.id===manager.id),manager);assert.equal(h.getFacts().improvements.find(i=>i.id===gap.id).state,'owner_accepted');
 assert.equal((await h.owner('autonomy_review_change',review)).decision.reasonCode,'CHANGE_NOT_PENDING');
 assert.equal(h.journal.events().filter(e=>e.type==='improvement.owner_accepted').length,1);
 const view=h.rules.evaluate({id:'view',type:'autonomy_view'},{access:h.access});assert.ok(view.plan.fields.improvements.includes('changeProposal'));
});

test('host proposals only acknowledge manual work, and rejection needs no policy relaxation or execution',async t=>{
 for(const decision of ['accept','reject']){
  const {h,gap,dev}=await developer(t,'host_code','host:src/new-feature.mjs');assert.equal((await h.command(dev.id,0)).decision.status,'allow');
  const before=h.getFacts(),pending=before.improvements.find(i=>i.id===gap.id),result=await h.owner('autonomy_review_change',{improvementId:gap.id,version:pending.version,decision,reviewNote:'Reviewed inert proposal.'});
  assert.equal(result.decision.status,'allow');assert.deepEqual(h.getFacts().heads,before.heads);assert.deepEqual(h.getFacts().revisions,before.revisions);assert.deepEqual(h.getFacts().agents,before.agents);assert.equal(h.getFacts().improvements.find(i=>i.id===gap.id).state,decision==='accept'?'owner_acknowledged_manual':'rejected');
 }
});

test('policy targets, foreign/retired agents, reused improvements and killed owner accept remain denied',async t=>{
 for(const target of ['rules:spending','agent:foreign','host:../rules']){
  const {h,dev}=await developer(t,'instructions',target);assert.equal((await h.command(dev.id,0)).decision.plan.events.find(e=>e.type==='command.rejected').data.reasonCode,'SAFETY_TARGET_DENIED');assert.ok(h.getFacts().improvements.every(i=>i.state!=='owner_review'));
 }
 const {h,gap,dev}=await developer(t);await h.command(dev.id,0);const pending=h.getFacts().improvements.find(i=>i.id===gap.id),review={improvementId:gap.id,version:pending.version,decision:'accept'};
 await h.owner('autonomy_control',{version:h.getFacts().company.version,operation:'pause'});h.rules.updateConfig({...h.c,killSwitch:true});assert.equal((await h.owner('autonomy_review_change',review)).decision.reasonCode,'KILL_SWITCH');assert.equal((await h.owner('autonomy_review_change',{...review,decision:'reject'})).decision.status,'allow');
});

test('new formatting schema and strict command admission agree on bounded owner-review text',()=>{
 const proposal={type:'propose_change',improvementId:'gap',targetId:'agent:manager',kind:'instructions',rationale:'Explain the change',proposedText:'Working guidance'};
 assert.equal(validateCommand(proposal),true);for(const patch of [{kind:'shell'},{rationale:' '},{proposedText:'x'.repeat(12001)},{verified:true}])assert.equal(validateCommand({...proposal,...patch}),false);
 const schemas=commandResponseFormat().json_schema.schema.properties.commands.items.anyOf;assert.ok(schemas.some(s=>s.properties.type.const==='propose_change'));
});
