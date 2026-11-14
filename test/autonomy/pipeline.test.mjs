import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createInferenceAdapter} from '../../src/inference/index.mjs';
import {readAutonomyFacts} from '../../src/autonomy/facts.mjs';
import {resolveEffectiveContext} from '../../src/autonomy/context.mjs';
import {catalog as rawCatalog} from '../../src/workspace/catalog.mjs';
import {config,financial,NOW} from '../rules/fixtures.mjs';
import {sdkFinding} from '../rules/verification-fixtures.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {intent} from '../helpers/autonomy-fixtures.mjs';
import {startNativeJBrain} from '../helpers/native-jbrain.mjs';

/** FULL REAL PIPELINE except the SDK transport. Real createApp, M01 Rules, Treasury
 * reservations/consumption, internalWork, native JBrain, command admission and the fixed
 * evaluator. The ONLY controlled parts are (a) the SDK preparation callback, which sees
 * just the exact serialized request and (b) the verified-response finding. This is NOT
 * vendor/TEE evidence. Live acceptance still needs a trusted durable-plaintext finding. */
export async function pipeline(t,{reason,proof='verified',policyTweak,prepareError,dispatchError,costStatus='actual'}={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-pipeline-')),brain=await startNativeJBrain(path.join(directory,'brain'));
 const companyId='pipeline',catalog=rawCatalog.map(x=>({...x,version:x.version??'1'})),policy=config();policy.autonomy=intent;policy.research.maxInputTokens=40000;policyTweak?.(policy);
 let now=NOW,app,sends=0,prepares=0;const requests=[],outputs=[];
 const owner={verifiedLocal:true,role:'owner',companyId},clock=()=>new Date(now),credit=()=>({creditId:'credit1'});
 async function open(){
  const rules=createRules({config:policy,companyId,clock,getAutonomyFacts:()=>readAutonomyFacts({journal:app?.journal,catalog,companyId}),getRuntimeFacts:()=>({verificationResults:app?.journal.list('verificationResults')??[]}),getAgentAuthorization:credit,getInferenceBounds:()=>({model:policy.research.model,status:'verified',reference:'controlled-provider-bound',completionTokensIncludeReasoning:true})});
  app=await createApp({directory:path.join(directory,'app'),rules,clock,companyId,catalog,jbrainUrl:brain.url,jbrainToken:brain.token,getAgentAuthorization:credit,
   createAdapters:({journal,dispatchAuthorized})=>({inference:createInferenceAdapter({journal,dispatchAuthorized,clock,mode:'live',secretRef:'TEST_ONLY',resolveSecret:async()=> 'not-a-real-key',transport:async()=>new Response(JSON.stringify({requests:[]}),{status:200}),verification:{async prepare({request}){
    prepares++;requests.push(structuredClone(request));
    if(prepareError)throw Object.assign(Error(prepareError),{code:prepareError});
    const send=async()=>{
     sends++;
     if(dispatchError)throw Object.assign(Error('Controlled transport response loss'),{code:dispatchError});
     // The reasoner receives only the serialized bounded request, never ambient state.
     const commands=await reason({request:structuredClone(request),call:sends});
     const output=JSON.stringify({commands});outputs.push(output);
     const finding={...sdkFinding(request,'response',output),...(proof==='unavailable'?{status:'unavailable',plaintextBindingStatus:'unavailable',durableReplayStatus:'unavailable'}:{})};
     return {status:'confirmed',mode:'live',provider:'near-ai-cloud',generation:{output,inferenceId:`controlled-inference-${sends}`},cost:{status:costStatus,actualCostNanoUsd:costStatus==='actual'?'1000000':null,reference:`controlled-inference-${sends}`},proof:finding};
    };
    return Object.assign(send,{preflight:sdkFinding(request),requestFingerprint:fingerprint(request),requestBytesHash:sdkFinding(request).requestBytesHash,evidenceRef:'private:controlled-sdk-preparation'});
   }}})})});
 }
 await open();
 t.after(async()=>{await app.close();await brain.close();await rm(directory,{recursive:true,force:true});});
 const seed=financial();await app.journal.transaction({actionId:'test-only-financial-observation',fingerprint:fingerprint(seed)},tx=>tx.put('treasury','financial',seed));
 return {get app(){return app;},policy,owner,companyId,catalog,requests,outputs,get sends(){return sends;},get prepares(){return prepares;},wait(ms){now+=ms;},tick(ms=1000){now+=ms;return app.autonomy.tick();},get now(){return now;},closeBrain:()=>brain.close(),async restart(){await app.close();await open();}};
}

const brief={name:'Pipeline schema company',purpose:'Prove the real internal loop with a controlled SDK port.',industry:'Test only',customer:'Fictional schema owners',outcome:'Repair one template schema gap',objective:'Review the name template and address its gap'};
const registerAndStart=async f=>{
 const {app,owner}=f;
 await app.autonomy.configure({version:0,operatingMode:'none',brief,intent},owner,'configure');
 await app.autonomy.registerTemplate({name:'Fictional names',fields:[{name:'firstName',required:true},{name:'lastName',required:true}],requiredFields:['firstName','middleName','lastName']},owner,'template');
 await app.autonomy.bootstrap({version:1},owner,'bootstrap');
 await app.autonomy.control({version:app.journal.get('autonomousCompanies',f.companyId).version,operation:'start'},owner,'start');
};
export const scenario=({request})=>{
 const e=JSON.parse(request.messages.find(m=>m.role==='user').content),{role,dependencies,context,targets,improvement,catalog}=e,target=targets[0];
 if(role==='manager'){
  if(!dependencies.some(w=>w.kind==='specialist'))return [{type:'delegate',kind:'specialist',role:'Document executive',topic:'Inspect the name template',instructions:'Report missing required template fields.',targetId:target.targetId}];
  return [{type:'complete_work',summary:'Template gap fixed',deliverable:'An evaluated additive template revision'}];
 }
 if(role==='specialist')return [{type:'report_gap',targetId:target.targetId,failureCode:'MISSING_MIDDLE_NAME',summary:'Contract requires middleName but the template has none.'},{type:'complete_work',summary:'Gap reported',deliverable:'Recorded gap'}];
 if(role==='backlog'){
  if(!dependencies.some(w=>w.kind==='developer'))return [{type:'delegate',kind:'developer',role:'Template developer',topic:'Add the missing field',instructions:'Propose an additive field patch only.',targetId:target.targetId,improvementId:improvement.id}];
  return [{type:'complete_work',summary:'Fix validated',deliverable:'Evaluated promoted revision'}];
 }
 if(improvement.state==='open'){const missing=target.contract.requiredFields.find(n=>!target.baseline.fields.some(f=>f.name===n));return [{type:'propose_patch',improvementId:improvement.id,targetId:target.targetId,baseRevision:target.baseRevision,operations:[{type:'add_field',name:missing,required:true}]}];}
 return [{type:'complete_work',summary:'Candidate evaluated',deliverable:'Additive template fix'}];
};

test('real pipeline: brief → manager → specialist → gap → backlog → developer → fixed evaluation → future context, with one causal lifecycle trace',async t=>{
 const f=await pipeline(t,{reason:scenario});await registerAndStart(f);
 const manager=()=>resolveEffectiveContext({journal:f.app.journal,catalog:f.catalog,companyId:f.companyId,agent:f.app.journal.get('agents','pipeline:manager')});
 const before=manager();
 const outcomes=[];for(let i=0;i<80;i++){outcomes.push(await f.tick());if(f.app.journal.get('autonomousCompanies',f.companyId).state==='completed')break;}
 const diag=()=>JSON.stringify({outcomes:outcomes.slice(-6).map(o=>o.decision?.reasonCode??o.progressed??Object.keys(o)),work:f.app.journal.list('agentWork').map(w=>[w.kind,w.state,w.reasonCode])});
 assert.equal(f.app.journal.get('autonomousCompanies',f.companyId).state,'completed',diag());
 assert.equal(f.app.journal.list('improvements')[0].state,'promoted');
 const after=manager();assert.equal(before.templates[0].body.fields.length,2);assert.equal(after.templates[0].body.fields.length,3);assert.notEqual(before.contextHash,after.contextHash);
 // Every model call used a real request containing the owner brief and the current objective.
 assert.ok(f.requests.length>=7);for(const r of f.requests){const e=JSON.parse(r.messages.find(m=>m.role==='user').content);assert.equal(e.companyBrief.customer,'Fictional schema owners');assert.match(e.objective.topic,/name template/);}
 // Later requests contain the fixed template revision, earlier ones the old one.
 const lastDev=f.requests.map(r=>JSON.parse(r.messages.find(m=>m.role==='user').content));
 assert.ok(lastDev.some(e=>e.role==='developer'&&e.targets[0].baseline.fields.length===2));
 // Cost was reconciled for each call; no orders, no unresolved reservations.
 const treasury=f.app.treasury.snapshot();assert.equal(treasury.reservations.filter(r=>r.purpose==='inference'&&!['reconciled','released'].includes(r.status)).length,0,JSON.stringify(treasury.reservations));
 assert.equal(f.app.journal.list('orders').length,0);
 assert.equal(f.sends,f.requests.length);
 // One causal, private lifecycle trace built only from owner-view allowlists.
 const trace=await f.app.autonomy.trace(f.owner);assert.equal(trace.causalOrder,true);
 const chain=trace.improvements[0];assert.equal(chain.complete,true,JSON.stringify(chain.missing));
 assert.deepEqual(chain.steps.map(s=>s.kind),['gap_reported','backlog_triage','developer_delegated','candidate_proposed','fixed_evaluation','head_promoted','future_context']);
 const [gap,,,proposed,evaluation,promotion,future]=chain.steps;
 assert.deepEqual(gap.origin.map(o=>o.kind),['manager','specialist']);assert.equal(gap.failureCode,'MISSING_MIDDLE_NAME');
 assert.ok(gap.sequence<proposed.sequence&&proposed.sequence<evaluation.sequence&&evaluation.sequence<promotion.sequence);
 assert.equal(evaluation.baselinePassed,false);assert.equal(evaluation.candidatePassed,true);assert.equal(evaluation.repaired,true);
 assert.equal(promotion.actorId,'M01','background promotion must not be attributed to an owner click');
 assert.equal(promotion.priorRevision!==promotion.newRevision,true);assert.equal(future.observed,true);assert.ok(future.workItems.some(w=>w.kind==='manager'));
 assert.ok(trace.agents.every(a=>a.runs.every(r=>r.stoppedSequence!==null)),'every run has a recorded stop');
 assert.equal(trace.blockers.length,0);
 if(process.env.NEAR_CONTROLLED_TRACE==='1')console.log('CONTROLLED_TEST_TRACE',JSON.stringify({evidenceLevel:'controlled-sdk-output-proof-and-billing',liveProviderEvidence:false,trace}));
});

test('without durable plaintext proof the same real pipeline accepts zero commands and holds visibly',async t=>{
 const f=await pipeline(t,{reason:scenario,proof:'unavailable'});await registerAndStart(f);
 const outcomes=[];for(let i=0;i<6;i++)outcomes.push(await f.tick());
 assert.equal(f.sends,1);const work=f.app.journal.list('agentWork').find(w=>w.kind==='manager');
 assert.equal(work.state,'proof_held');assert.equal(f.app.journal.list('agents').length,2);
 assert.equal(f.app.journal.list('improvements').length,0);
 assert.equal(f.app.journal.list('internalResults').length,1);
});

const boot=async f=>{const {app,owner,companyId}=f;await app.autonomy.configure({version:0,operatingMode:'none',brief,intent},owner,'c');await app.autonomy.bootstrap({version:1},owner,'b');await app.autonomy.control({version:app.journal.get('autonomousCompanies',companyId).version,operation:'start'},owner,'s');};
test('unchanged missing Cloud preparation access survives restart without burning counters; explicit owner resume rechecks once',async t=>{
 const f=await pipeline(t,{reason:scenario,prepareError:'CLOUD_ACCESS_REQUIRED'});await boot(f);
 const steps=()=>f.app.journal.list('companyObjectives')[0].counters.steps;
 const first=await f.tick(31000);assert.equal(first.decision.reasonCode,'INFERENCE_NOT_SUBMITTED');assert.equal(first.providerCode,'CLOUD_ACCESS_REQUIRED');assert.equal(first.retry.ownerActionRequired,true);
 const afterFirst=steps(),calls=f.app.journal.list('companyObjectives')[0].counters.calls;
 for(let i=0;i<10;i++){const o=await f.tick(5000);assert.equal(o.decision.reasonCode,'INFERENCE_NOT_SUBMITTED');}
 assert.equal(steps(),afterFirst);assert.equal(f.prepares,1);
 await f.restart();
 for(let i=0;i<8;i++)assert.equal((await f.tick(3600000)).decision.reasonCode,'INFERENCE_NOT_SUBMITTED');
 assert.equal(steps(),afterFirst);assert.equal(f.prepares,1);
 assert.equal(f.app.journal.list('companyObjectives')[0].counters.calls,calls,'call is admitted once, not per retry');
 await f.app.autonomy.advance(f.owner);assert.equal(f.prepares,1,'view/advance is not authority to reset a blocker');
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'resume'},f.owner,'explicit-resume');
 const owner=await f.app.autonomy.advance(f.owner);assert.equal(owner.retry.ownerActionRequired,true);assert.equal(f.prepares,2);assert.equal(steps(),afterFirst+1);
 assert.equal(f.sends,0);assert.equal(Object.keys(f.app.journal.snapshot().operations).length,0);
 const blocker=(await f.app.autonomy.trace(f.owner)).blockers.find(b=>b.kind==='external'||b.reasonCode==='INFERENCE_NOT_SUBMITTED');
 assert.equal(blocker.reasonCode,'INFERENCE_NOT_SUBMITTED');assert.equal(blocker.recoverable,true);
});

const done=f=>f.app.journal.get('autonomousCompanies',f.companyId).state==='completed';
const names=f=>f.app.journal.list('agents').map(a=>a.id).sort();
async function setup(f){await registerAndStart(f);}
// Simulate process loss before the selected command's real Journal commit. The accepted
// result, SDK evidence, bill and earlier command prefix remain exactly as production wrote them.
async function interruptBeforeCommand(f,index){
 const journal=f.app.journal,original=journal.transaction;
 let interrupted=false;
 journal.transaction=function(command,mutate){
  if(!interrupted&&command.actionId.endsWith(`:command:${index}`)){
   interrupted=true;throw Object.assign(Error('Controlled crash before command commit'),{code:'TEST_PROCESS_LOSS'});
  }
  return original.call(this,command,mutate);
 };
 try{const outcome=await f.tick().then(value=>({value}),error=>({error}));assert.equal(outcome.error?.code,'TEST_PROCESS_LOSS',JSON.stringify({reasonCode:outcome.value?.decision?.reasonCode,workId:outcome.value?.workId}));}finally{journal.transaction=original;}
 assert.equal(interrupted,true);
}
test('restart plus lease expiry between a verified result and command admission recovers the original result once: no resend, no duplicate agent, loop still completes',async t=>{
 const f=await pipeline(t,{reason:scenario});await setup(f);
 await interruptBeforeCommand(f,0);assert.equal(f.sends,1);assert.equal(names(f).length,2);
 const identities=f.app.journal.list('internalResults').map(r=>r.id);
 await f.restart();f.wait(31000);
 for(let i=0;i<90&&!done(f);i++)await f.tick();
 assert.equal(done(f),true);assert.equal(f.prepares,f.requests.length);
 assert.equal(f.app.journal.list('internalResults').filter(r=>r.workId==='pipeline:objective:1:root'&&identities.includes(r.id)).length,1);
 const specialists=f.app.journal.list('agents').filter(a=>a.autonomyRole==='specialist');assert.equal(specialists.length,1);
 const events=f.app.journal.events();assert.ok(events.some(e=>e.type==='work.recovery_claimed'),'result was recovered read-only');
 assert.equal(events.filter(e=>e.type==='gap.recorded').length,1);
 assert.equal(f.app.treasury.snapshot().reservations.filter(r=>!['reconciled','released'].includes(r.status)).length,0);
});

test('current kill between verified result and command admission stops all commands; unkill never resends and recovers the original result',async t=>{
 const f=await pipeline(t,{reason:scenario});await setup(f);
 await interruptBeforeCommand(f,0);assert.equal(f.sends,1);
 f.app.rules.updateConfig({...f.policy,killSwitch:true});
 for(let i=0;i<3;i++){const o=await f.tick();assert.notEqual(o.decision?.status,'allow');}
 assert.deepEqual(names(f),['pipeline:backlog','pipeline:manager']);assert.equal(f.sends,1);
 f.app.rules.updateConfig({...f.policy,killSwitch:false});
 for(let i=0;i<30&&!done(f);i++)await f.tick(31000);
 assert.equal(f.sends,f.requests.length);assert.equal(done(f),true,JSON.stringify(f.app.journal.list('agentWork').map(w=>[w.kind,w.state,w.reasonCode])));
 assert.equal(f.app.journal.list('agents').filter(a=>a.autonomyRole==='specialist').length,1);
});

test('successive crashes recover the latest admitted batch prefix without duplicate effects or repeated cost',async t=>{
 const reason=({request})=>{const e=JSON.parse(request.messages.find(m=>m.role==='user').content);
  if(e.role==='manager'&&!e.dependencies.length)return ['One','Two','Three'].map(n=>({type:'delegate',kind:'specialist',role:`Reviewer ${n}`,topic:`Review ${n}`,instructions:`Complete bounded review ${n}.`}));
  return [{type:'complete_work',summary:'Bounded review complete',deliverable:'Controlled test review'}];
 };
 const f=await pipeline(t,{reason});await boot(f);
 await interruptBeforeCommand(f,1);
 const root=f.app.journal.list('agentWork').find(w=>w.kind==='manager'),effectId=root.effectId;
 const bill=f.app.treasury.snapshot(),counters=f.app.journal.list('companyObjectives')[0].counters;
 assert.equal(names(f).length,3);assert.equal(f.sends,1);
 await f.restart();f.wait(31000);await interruptBeforeCommand(f,2);
 assert.equal(names(f).length,4);assert.equal(f.sends,1);
 await f.restart();f.wait(31000);await f.tick();
 assert.equal(names(f).length,5);assert.equal(f.sends,1);assert.equal(f.prepares,1);
 const recovered=f.app.journal.list('agentRuns').filter(r=>r.recoveryOnly);
 assert.deepEqual(recovered.map(r=>r.commandOutcomes.length),[2,3]);
 assert.equal(recovered.every(r=>r.recoveryOf.effectId===effectId),true);
 assert.equal(f.app.journal.list('internalResults').length,1);
 assert.deepEqual(f.app.treasury.snapshot(),bill,'local recovery never records a second consumption');
 const after=f.app.journal.list('companyObjectives')[0].counters;
 assert.equal(after.calls,counters.calls);assert.equal(after.resultBytes,counters.resultBytes);
 for(let i=0;i<30&&!done(f);i++)await f.tick(31000);
 assert.equal(done(f),true);assert.equal(names(f).length,5);
 assert.equal(f.app.journal.events().filter(e=>e.type==='agent.created').length,5);
 const trace=await f.app.autonomy.trace(f.owner);assert.ok(trace.agents.every(a=>a.runs.every(r=>r.stoppedSequence!==null)));
});

test('lost original output stays unknown and reserved across restart, kill and owner pause without resending',async t=>{
 const f=await pipeline(t,{reason:scenario,dispatchError:'ECONNRESET'});await boot(f);
 await f.tick();assert.equal(f.sends,1);
 const root=f.app.journal.list('agentWork')[0],operationIds=Object.keys(f.app.journal.snapshot().operations),bill=f.app.treasury.snapshot();
 assert.equal(root.state,'reconciling');assert.equal(operationIds.length,1);
 assert.ok(bill.reservations.some(r=>!['released','reconciled'].includes(r.status)));
 await f.restart();f.wait(31000);
 f.app.rules.updateConfig({...f.policy,killSwitch:true});
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'pause'},f.owner,'pause-unknown');
 for(let i=0;i<5;i++)await f.tick(31000);
 assert.equal(f.sends,1);assert.equal(f.prepares,1);
 assert.deepEqual(Object.keys(f.app.journal.snapshot().operations),operationIds);
 assert.deepEqual(f.app.treasury.snapshot(),bill);
 assert.equal(f.app.journal.get('agentWork',root.id).state,'reconciling');
 assert.ok(f.app.journal.list('agentRuns').every(r=>!r.acceptedCommands.length));
 const blocker=(await f.app.autonomy.trace(f.owner)).blockers[0];assert.equal(blocker.state,'reconciling');assert.equal(blocker.reasonCode,'OWNER_PAUSED');
});

test('delayed original bill keeps reservation and prevents complete_work after restart without replacement inference',async t=>{
 const f=await pipeline(t,{reason:()=>[{type:'complete_work',summary:'Controlled result',deliverable:'Await the actual bill'}],costStatus:'pending'});await boot(f);
 const first=await f.tick();assert.equal(first.decision.reasonCode,'WORK_DEPENDENCIES_UNRESOLVED');
 const bill=f.app.treasury.snapshot(),ids=Object.keys(f.app.journal.snapshot().operations);
 await f.restart();for(let i=0;i<5;i++)await f.tick(31000);
 assert.equal(f.sends,1);assert.equal(f.prepares,1);assert.equal(done(f),false);
 assert.deepEqual(Object.keys(f.app.journal.snapshot().operations),ids);
 assert.deepEqual(f.app.treasury.snapshot(),bill);
 assert.ok(bill.reservations.some(r=>!['released','reconciled'].includes(r.status)));
});

test('actual native JBrain outage records one trusted blocker and survives restart without burning a claim',async t=>{
 const f=await pipeline(t,{reason:scenario}),{owner}=f;
 await f.app.autonomy.configure({version:0,operatingMode:'none',brief,intent},owner,'c');await f.app.autonomy.bootstrap({version:1},owner,'b');
 const doc=(await f.app.knowledge.save({title:'Scoped reference',body:'PRIVATE-KNOWLEDGE-OUTAGE-MARKER',visibility:'restricted',agentIds:['pipeline:manager']},{requestId:'outage-doc',access:owner})).document;
 await f.app.autonomy.selectKnowledge({agentId:'pipeline:manager',version:f.app.journal.get('agents','pipeline:manager').version,knowledgeIds:[doc.id]},owner,'select-outage-doc');
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'start'},owner,'start');
 await f.closeBrain();const first=await f.tick();assert.equal(first.decision.reasonCode,'JBRAIN_UNAVAILABLE');
 const work=f.app.journal.list('agentWork')[0],before=f.app.journal.list('companyObjectives')[0].counters;
 assert.equal(work.lease,null);assert.ok(work.admissionConditionHash);
 const failures=f.app.journal.list('internalPreparationFailures');assert.equal(failures.length,1);assert.equal(failures[0].source,'internal-knowledge-capture');
 assert.doesNotMatch(JSON.stringify(failures),/PRIVATE-KNOWLEDGE-OUTAGE-MARKER|token|stack/);
 await f.restart();for(let i=0;i<5;i++)assert.equal((await f.tick(3600000)).decision.reasonCode,'JBRAIN_UNAVAILABLE');
 assert.deepEqual(f.app.journal.list('companyObjectives')[0].counters,before);assert.equal(f.prepares,0);assert.equal(f.sends,0);
 assert.equal(f.app.journal.list('internalPreparationFailures').length,1);
 const trace=await f.app.autonomy.trace(owner);assert.equal(trace.blockers[0].reasonCode,'JBRAIN_UNAVAILABLE');assert.ok(trace.agents.every(a=>a.runs.every(r=>r.stoppedSequence!==null)));
});

test('changed bound persona blocks before inference without counter burn and a real catalog repair rechecks once',async t=>{
 const f=await pipeline(t,{reason:()=>[{type:'complete_work',summary:'Scoped persona reviewed',deliverable:'Used the pinned current persona.'}]});
 await f.app.autonomy.configure({version:0,operatingMode:'none',brief,intent},f.owner,'c');await f.app.autonomy.bootstrap({version:1},f.owner,'b');
 await f.app.workspace.bindResource('pipeline:manager',{listingId:'soul-jobs',version:f.app.journal.get('agents','pipeline:manager').version},f.owner);
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'start'},f.owner,'start');
 const persona=f.catalog.find(c=>c.id==='soul-jobs'),original=persona.instructions;persona.instructions='Changed resource revision requiring review';
 const first=await f.tick();assert.equal(first.decision.reasonCode,'CATALOG_REVISION_CHANGED');
 const before=f.app.journal.list('companyObjectives')[0].counters;
 assert.equal(f.app.journal.list('agentWork')[0].lease,null);
 assert.equal(f.prepares,0);assert.equal(f.sends,0);
 await f.restart();for(let i=0;i<5;i++)assert.equal((await f.tick(31000)).decision.reasonCode,'CATALOG_REVISION_CHANGED');
 assert.deepEqual(f.app.journal.list('companyObjectives')[0].counters,before);
 persona.instructions=original;await f.restart();await f.tick();assert.equal(f.sends,1);assert.equal(done(f),true);
 const envelope=JSON.parse(f.requests[0].messages.find(m=>m.role==='user').content);
 assert.equal(envelope.context.resources.find(r=>r.id==='soul-jobs').instructions,original);
 assert.equal(f.app.journal.list('companyObjectives')[0].counters.steps,before.steps+1);
});

test('corrupt active revision records a context-resolution blocker without inference or repeated claims',async t=>{
 const f=await pipeline(t,{reason:()=>[{type:'complete_work',summary:'Valid revision observed',deliverable:'Used the repaired current revision.'}]});await registerAndStart(f);
 const revision=f.app.journal.list('companyRevisions')[0];
 async function setRevision(value,key){await f.app.journal.transaction({actionId:`test-only-corruption:${key}`,fingerprint:fingerprint(value)},tx=>{tx.put('companyRevisions',value.id,value);return null;});}
 await setRevision({...revision,hash:'invalid-controlled-corruption'},'corrupt');
 assert.equal((await f.tick()).decision.reasonCode,'REVISION_INTEGRITY_FAILED');
 const counters=f.app.journal.list('companyObjectives')[0].counters;
 assert.equal(f.app.journal.list('internalPreparationFailures')[0].source,'internal-context-resolution');
 await f.restart();for(let i=0;i<5;i++)assert.equal((await f.tick(31000)).decision.reasonCode,'REVISION_INTEGRITY_FAILED');
 assert.deepEqual(f.app.journal.list('companyObjectives')[0].counters,counters);assert.equal(f.prepares,0);assert.equal(f.sends,0);
 await setRevision(revision,'repair');await f.tick();assert.equal(f.sends,1);assert.equal(done(f),true);
});

async function pendingChange(t,kind){
 const proposedText=kind==='instructions'?'Ask for a source and state uncertainty in company work.':'console.log("INERT_HOST_PROPOSAL_MUST_NEVER_EXECUTE")';
 const reason=({request})=>{const e=JSON.parse(request.messages.find(m=>m.role==='user').content);
  if(e.context.instructionRevision)return [{type:'complete_work',summary:'Owner revision observed',deliverable:'Future context used the accepted profile revision.'}];
  if(e.role==='developer'&&e.improvement.state==='open')return [{type:'propose_change',improvementId:e.improvement.id,targetId:kind==='instructions'?`agent:${request.companyId}:manager`:'host:src/example.mjs',kind,rationale:'This change exceeds additive template evaluation and requires owner review.',proposedText}];
  return scenario({request});
 };
 const f=await pipeline(t,{reason});await registerAndStart(f);
 for(let i=0;i<15&&!f.app.journal.list('improvements').some(i=>i.state==='owner_review');i++)await f.tick();
 const improvement=f.app.journal.list('improvements')[0];assert.equal(improvement.state,'owner_review');
 assert.equal(improvement.changeProposal.proposedText,proposedText);assert.equal(f.app.journal.list('improvementEvaluations').length,0);
 return {f,improvement,proposedText};
}

test('unsupported instructions require current owner review and affect future named-profile context only',async t=>{
 const {f,improvement,proposedText}=await pendingChange(t,'instructions');
 const input={improvementId:improvement.id,version:improvement.version,decision:'accept',reviewNote:'Reviewed as untrusted company guidance.'};
 const manager=f.app.journal.get('agents','pipeline:manager'),before=resolveEffectiveContext({journal:f.app.journal,catalog:f.catalog,companyId:f.companyId,agent:manager});
 assert.equal(before.instructionRevision,null);
 await assert.rejects(f.app.autonomy.reviewChange(input,f.owner,'running-accept'),{code:'PAUSE_REQUIRED'});
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'pause'},f.owner,'review-pause');
 await assert.rejects(f.app.autonomy.reviewChange({...input,version:0},f.owner,'stale-review'),{code:'AUTONOMY_VERSION_CONFLICT'});
 const bill=f.app.treasury.snapshot(),counters=f.app.journal.list('companyObjectives')[0].counters;
 await f.app.autonomy.reviewChange(input,f.owner,'accept-guidance');
 assert.equal((await f.app.autonomy.reviewChange(input,f.owner,'accept-guidance')).replayed,true);
 await assert.rejects(f.app.autonomy.reviewChange(input,{role:'agent',companyId:f.companyId},'accept-guidance'),{code:'ACCESS_DENIED'});
 await assert.rejects(f.app.autonomy.trace({role:'public',companyId:f.companyId}),{code:'ACCESS_DENIED'});
 assert.deepEqual(f.app.treasury.snapshot(),bill);assert.deepEqual(f.app.journal.list('companyObjectives')[0].counters,counters);
 assert.deepEqual(f.app.journal.get('agents',manager.id),manager,'review changes no profile permission or runtime');
 const revision=f.app.journal.list('companyRevisions').find(r=>r.kind==='instructions');
 assert.equal(revision.status,'accepted');assert.equal(revision.scope,'agent');assert.equal(revision.agentId,manager.id);
 assert.equal(before.instructions,manager.instructions);assert.equal(before.instructionRevision,null);
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'replace_objective',objective:'Use the newly reviewed profile guidance'},f.owner,'future-objective');
 await f.app.autonomy.control({version:f.app.journal.get('autonomousCompanies',f.companyId).version,operation:'start'},f.owner,'future-start');
 await f.tick();
 const future=JSON.parse(f.requests.at(-1).messages.find(m=>m.role==='user').content);
 assert.equal(future.context.instructions,proposedText);assert.equal(future.context.untrusted,true);assert.equal(future.context.instructionRevision.revisionId,revision.id);
 const trace=await f.app.autonomy.trace(f.owner),chain=trace.improvements.find(i=>i.improvementId===improvement.id);
 assert.equal(chain.state,'owner_accepted');assert.ok(chain.steps.some(s=>s.kind==='owner_accepted'));
 assert.equal(chain.steps.find(s=>s.kind==='owner_reviewed').decision,'accept');
 assert.equal(chain.steps.find(s=>s.kind==='future_context').observed,true);assert.equal(chain.steps.some(s=>s.kind==='head_promoted'),false);
});

test('host-code proposals remain inert after explicit acknowledgement; rejection writes no active revision',async t=>{
 for(const decision of ['accept','reject']){
  const {f,improvement}=await pendingChange(t,'host_code'),heads=f.app.journal.list('companyTargetHeads'),revisions=f.app.journal.list('companyRevisions'),bill=f.app.treasury.snapshot();
  await f.app.autonomy.reviewChange({improvementId:improvement.id,version:improvement.version,decision},f.owner,`host-${decision}`);
  assert.equal(f.app.journal.get('improvements',improvement.id).state,decision==='accept'?'owner_acknowledged_manual':'rejected');
  assert.deepEqual(f.app.journal.list('companyTargetHeads'),heads);assert.deepEqual(f.app.journal.list('companyRevisions'),revisions);
  assert.deepEqual(f.app.treasury.snapshot(),bill);assert.equal(f.app.journal.list('improvementEvaluations').length,0);
 }
});
