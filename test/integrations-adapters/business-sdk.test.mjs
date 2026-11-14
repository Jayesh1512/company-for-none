import test from 'node:test';
import assert from 'node:assert/strict';
import {createInferenceAdapter} from '../../src/inference/index.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {clock,decision,gate,journalFor} from './fixtures.mjs';

function command(id='business-sdk'){
  const request={model:'controlled-sdk-test',messages:[{role:'user',content:'Controlled transport test'}],maxInputBytes:1000,maxOutputTokens:20,timeoutMs:1000,
    chargeBound:{maxCostNanoUsd:'2000000',verified:true,completionTokensIncludeReasoning:true,reference:'controlled-bound'}};
  const action={id,type:'inference',mode:'live',maxCostNanoUsd:'2000000',requestFingerprint:fingerprint(request)};
  return {action,request,decision:decision(action),credit:{status:'confirmed',availableNanoUsd:'2000000'}};
}

test('business dispatch uses prepared verifier once and persists proof; restart returns original outcome',async t=>{
  const journal=await journalFor(t),c=command();let preparations=0,sends=0,legacyCalls=0;
  const proof={id:'controlled-proof',status:'unavailable',reasonCode:'DURABLE_PLAINTEXT_BINDING_REQUIRED'};
  const verification={prepare:async()=>{
    preparations++;
    const send=()=>{sends++;return Promise.resolve({status:'confirmed',mode:'live',provider:'controlled-sdk-test',generation:{output:'Controlled SDK test output'},proof,cost:{status:'pending',actualCostNanoUsd:null}});};
    Object.defineProperties(send,{preflight:{value:{id:'controlled-preflight',status:'verified',requestFingerprint:c.action.requestFingerprint}},requestFingerprint:{value:c.action.requestFingerprint}});
    return send;
  }};
  const options={mode:'live',journal,clock,verification,dispatchAuthorized:gate,transport:async()=>{legacyCalls++;throw Error('Legacy HTTP completion must not run');}};
  const adapter=createInferenceAdapter(options);
  assert.equal((await adapter.generate(c)).code,'PREPARED_INFERENCE_REQUIRED');
  assert.equal((await adapter.prepare(c)).completionSent,false);
  await adapter.prepare(c);assert.equal(preparations,1);
  assert.equal(journal.get('verificationResults','controlled-preflight').status,'verified');
  const generated=await adapter.generate(c);
  assert.equal(generated.proof.status,'unavailable');
  assert.equal(journal.get('verificationResults',proof.id).status,'unavailable');
  const restarted=createInferenceAdapter({...options,verification:{prepare:()=>{throw Error('No replacement preparation');}}});
  assert.equal((await restarted.generate(c)).status,'confirmed');
  assert.equal(sends,1);assert.equal(legacyCalls,0);
  assert.equal((await restarted.prepare(c)).code,'RECONCILIATION_REQUIRED');
});

test('failed preflight and mismatched request never dispatch; final Rules refusal preserves no-submit',async t=>{
  const journal=await journalFor(t),c=command('denied-sdk');let sends=0;
  const failed=createInferenceAdapter({mode:'live',journal,clock,verification:{prepare:async()=>{throw Object.assign(Error(),{code:'SDK_REQUIRED_PROOF_FAILED'});}}});
  assert.equal((await failed.prepare(c)).code,'SDK_REQUIRED_PROOF_FAILED');
  const verification={prepare:async()=>{
    const send=()=>{sends++;return Promise.resolve({status:'confirmed'});};
    Object.defineProperties(send,{preflight:{value:{id:'denied-preflight',requestFingerprint:c.action.requestFingerprint}},requestFingerprint:{value:c.action.requestFingerprint}});return send;
  }};
  const denied=createInferenceAdapter({mode:'live',journal,clock,verification,dispatchAuthorized:()=>({status:'deny',reasonCode:'CURRENT_KILL'})});
  const changed={...c,request:{...c.request,model:'changed'}};
  assert.equal((await denied.prepare(changed)).code,'CONFLICT');
  await denied.prepare(c);
  assert.equal((await denied.generate(c)).code,'CURRENT_KILL');
  assert.equal(sends,0);
});
