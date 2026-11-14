import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createInferenceAdapter} from '../../src/inference/index.mjs';
import {readAutonomyFacts} from '../../src/autonomy/facts.mjs';
import {createAutonomyWriter} from '../../src/autonomy/plans.mjs';
import {catalog as rawCatalog} from '../../src/workspace/catalog.mjs';
import {config,financial,NOW} from '../rules/fixtures.mjs';
import {sdkFinding} from '../rules/verification-fixtures.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {intent} from '../helpers/autonomy-fixtures.mjs';
import {startNativeJBrain} from '../helpers/native-jbrain.mjs';

// Actual M01/M03/M07/internal workflow and native JBrain. Only the SDK findings,
// response and billing transport below are controlled test ports, not real TEE.
async function fixture(t,{beforePrepared}={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-internal-')),brain=await startNativeJBrain(path.join(directory,'brain'));
 const companyId='internal',catalog=rawCatalog.map(x=>({...x,version:x.version??'1'})),policy=config();policy.autonomy=intent;policy.research.maxInputTokens=20000;
 let now=NOW,app,sends=0,prepares=0,lastRequest;
 const owner={verifiedLocal:true,role:'owner',companyId},clock=()=>new Date(now);
 const credit=()=>({creditId:'credit1'});
 async function open(){
   const rules=createRules({config:policy,companyId,clock,getAutonomyFacts:()=>readAutonomyFacts({journal:app?.journal,catalog,companyId}),getRuntimeFacts:()=>({verificationResults:app?.journal.list('verificationResults')??[]}),getAgentAuthorization:credit,getInferenceBounds:()=>({model:policy.research.model,status:'verified',reference:'controlled-provider-bound',completionTokensIncludeReasoning:true})});
   app=await createApp({directory:path.join(directory,'app'),rules,clock,companyId,catalog,jbrainUrl:brain.url,jbrainToken:brain.token,getAgentAuthorization:credit,
    createAdapters:({journal,dispatchAuthorized})=>({inference:createInferenceAdapter({journal,dispatchAuthorized,clock,mode:'live',secretRef:'TEST_ONLY',resolveSecret:async()=> 'not-a-real-key',transport:async()=>new Response(JSON.stringify({requests:[],warning:'controlled delayed bill'}),{status:200}),verification:{async prepare({request}){
     prepares++;lastRequest=request;await beforePrepared?.();
     const send=()=>{sends++;const output=JSON.stringify({commands:[{type:'complete_work',summary:'Controlled output',deliverable:'Test-only proposal'}]});const proof={...sdkFinding(request,'response',output),status:'unavailable',plaintextBindingStatus:'unavailable',durableReplayStatus:'unavailable'};return Promise.resolve({status:'confirmed',mode:'live',provider:'near-ai-cloud',generation:{output,inferenceId:'controlled-inference-id'},cost:{status:'pending',actualCostNanoUsd:null},proof});};
     Object.assign(send,{preflight:sdkFinding(request),requestFingerprint:fingerprint(request),requestBytesHash:sdkFinding(request).requestBytesHash,evidenceRef:'private:controlled-sdk-preparation'});return send;
    }}})})});
 }
 await open();
 t.after(async()=>{await app.close();await brain.close();await rm(directory,{recursive:true,force:true});});
 const seed=financial();await app.journal.transaction({actionId:'test-only-financial-observation',fingerprint:fingerprint(seed)},tx=>tx.put('treasury','financial',seed));
 const brief={name:'Controlled internal company',purpose:'Inspect a bounded context request.',industry:'Test',customer:'Small-company operators',outcome:'A selected-context work envelope',objective:'Review the selected company document'};
 await app.autonomy.configure({version:0,operatingMode:'none',brief,intent},owner,'configure');await app.autonomy.bootstrap({version:1},owner,'bootstrap');
 const document=(await app.knowledge.save({title:'Selected company reference',body:'SELECTED-COMPANY-MARKER',visibility:'restricted',agentIds:[`${companyId}:manager`]}, {requestId:'selected-doc',access:owner})).document;
 await app.knowledge.save({title:'Unselected company reference',body:'UNSELECTED-PRIVATE-MARKER',visibility:'company',agentIds:[]},{requestId:'not-selected-doc',access:owner});
 await app.autonomy.selectKnowledge({agentId:`${companyId}:manager`,version:app.journal.get('agents',`${companyId}:manager`).version,knowledgeIds:[document.id]},owner,'knowledge-scope');
 await app.workspace.bindResource(`${companyId}:manager`,{listingId:'soul-jobs',version:app.journal.get('agents',`${companyId}:manager`).version},owner);
 await app.autonomy.control({version:app.journal.get('autonomousCompanies',companyId).version,operation:'start'},owner,'start');
 const apply=createAutonomyWriter({journal:app.journal,rules:app.rules,companyId}),w=app.journal.list('agentWork')[0];
 const claimed=await apply({id:'test-claim',type:'autonomy_claim',workId:w.id});assert.equal(claimed.decision.status,'allow');
 const current=app.journal.get('agentWork',w.id),frame={workId:w.id,runId:current.lease.runId,fence:current.lease.fence};
 return {get app(){return app;},owner,document,frame,get sends(){return sends;},get prepares(){return prepares;},get request(){return lastRequest;},advanceTime(){now+=1000;},async restart(){await app.close();await open();}};
}

test('actual internal request contains selected native JBrain revision; unavailable durable proof holds commands and unchanged reconciliation replays across time/restart',async t=>{
 const f=await fixture(t);const result=await f.app.internalWork.execute(f.frame);
 assert.equal(f.sends,1,JSON.stringify(result));assert.equal(f.prepares,1);
 const serialized=JSON.stringify(f.request.messages);assert.match(serialized,/SELECTED-COMPANY-MARKER/);assert.match(serialized,new RegExp(f.document.revision));assert.doesNotMatch(serialized,/UNSELECTED-PRIVATE-MARKER/);
 assert.match(serialized,/Small-company operators/);assert.match(serialized,/selected-context work envelope/);
 const envelope=JSON.parse(f.request.messages.find(m=>m.role==='user').content),persona=envelope.context.resources.find(r=>r.id==='soul-jobs');
 assert.match(persona.instructions,/Craft and curiosity/);assert.equal(persona.untrusted,true);assert.equal(persona.contentHash,fingerprint(rawCatalog.find(c=>c.id==='soul-jobs')?{...rawCatalog.find(c=>c.id==='soul-jobs'),version:'1'}:{}));
 const run=f.app.journal.get('agentRuns',f.frame.runId);assert.equal(run.acceptedCommands.length,0);
 assert.equal(f.app.treasury.snapshot().reservations.filter(r=>r.purpose==='inference').length,1);
 const identities=f.app.journal.list('internalResults').map(r=>r.id);f.advanceTime();await f.app.internalWork.reconcile({workId:f.frame.workId});
 assert.deepEqual(f.app.journal.list('internalResults').map(r=>r.id),identities);assert.equal(f.sends,1);
 await f.restart();f.advanceTime();await f.app.internalWork.reconcile({workId:f.frame.workId});assert.equal(f.sends,1);assert.equal(f.prepares,1);assert.deepEqual(f.app.journal.list('internalResults').map(r=>r.id),identities);
});

test('revoked JBrain grant during asynchronous SDK preparation prevents dispatch',async t=>{
 let release,entered;const wait=new Promise(r=>release=r),preparing=new Promise(r=>entered=r);
 const f=await fixture(t,{beforePrepared:()=>{entered();return wait;}});
 const execution=f.app.internalWork.execute(f.frame);await preparing;
 const old=(await f.app.knowledge.read(f.document.id,f.owner)).document;
 await f.app.knowledge.save({id:old.id,title:old.title,body:old.body,visibility:'restricted',agentIds:[],expectedRevision:old.revision,version:old.version},{requestId:'revoke-during-preparation',access:f.owner});
 release();const result=await execution;assert.equal(f.sends,0);assert.equal(result.decision.status==='allow',false);assert.match(result.decision.reasonCode,/KNOWLEDGE|GRANT/);
});
