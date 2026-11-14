import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createInferenceAdapter} from '../../src/inference/index.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {config,NOW} from '../rules/fixtures.mjs';
import {sdkFinding,verificationSpec} from '../rules/verification-fixtures.mjs';

async function fixture(t,waitFirst=false){
 const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-preparation-')),journal=await createJournal({directory});
 t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 const request={model:'controlled-test-model',messages:[{role:'user',content:'Controlled test input'}],maxInputBytes:1000,maxOutputTokens:10,timeoutMs:1000,chargeBound:{maxCostNanoUsd:'10',verified:true,reference:'test-bound',completionTokensIncludeReasoning:true},verificationSpec:verificationSpec(config())};
 const action=fence=>({id:'internal:controlled:work:1',type:'agent_inference',workId:'work',runId:`run:${fence}`,fence,requestFingerprint:fingerprint(request),maxCostNanoUsd:'10'});
 let currentFence=1,prepares=0,sends=0,release;
 const wait=new Promise(r=>release=r);
 const adapter=createInferenceAdapter({journal,mode:'live',clock:()=>new Date(NOW),
   // Controlled private authority seam, not a production Rules implementation.
   authorizePreparation:({action})=>({status:action.fence===currentFence?'allow':'deny',reasonCode:'STALE_WORK_FENCE'}),
   dispatchAuthorized:({action},callback)=>action.fence===currentFence?callback():{status:'deny',reasonCode:'STALE_WORK_FENCE'},
   verification:{async prepare({action:a}){prepares++;if(waitFirst&&a.fence===1)await wait;const send=()=>{sends++;return Promise.resolve({status:'confirmed',mode:'live',provider:'near-ai-cloud',generation:{output:'Controlled test response'},cost:{status:'pending',actualCostNanoUsd:null}});};Object.assign(send,{preflight:sdkFinding(request),requestFingerprint:fingerprint(request)});return send;}}
 });
 const generate=a=>adapter.generate({action:a,request,credit:{status:'confirmed',availableNanoUsd:'100'},decision:{status:'allow',actionFingerprint:fingerprint(a),permit:{actionFingerprint:fingerprint(a)}}});
 return {adapter,journal,request,action,generate,release,get prepares(){return prepares;},get sends(){return sends;},setFence:n=>currentFence=n};
}

test('fenced read-only preparation can be replaced before any intent, never after a durable operation',async t=>{
 const f=await fixture(t);assert.equal((await f.adapter.prepare({action:f.action(1),request:f.request})).status,'confirmed');
 f.setFence(2);assert.equal((await f.adapter.prepare({action:f.action(2),request:f.request})).status,'confirmed');assert.equal(f.prepares,2);
 assert.equal((await f.generate(f.action(1))).status,'not_submitted');assert.equal(f.sends,0);
 assert.equal((await f.generate(f.action(2))).status,'confirmed');assert.equal(f.sends,1);
 f.setFence(3);assert.equal((await f.adapter.prepare({action:f.action(3),request:f.request})).code,'RECONCILIATION_REQUIRED');assert.equal(f.prepares,2);assert.equal(f.sends,1);
});

test('old asynchronous SDK preparation cannot overwrite the current worker callback',async t=>{
 const f=await fixture(t,true),old=f.adapter.prepare({action:f.action(1),request:f.request});
 f.setFence(2);assert.equal((await f.adapter.prepare({action:f.action(2),request:f.request})).status,'confirmed');
 f.release();assert.equal((await old).code,'STALE_WORK_FENCE');
 assert.equal((await f.generate(f.action(2))).status,'confirmed');assert.equal(f.sends,1);
});
