import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createJournal} from '../../src/journal/index.mjs';
import {createTreasury} from '../../src/treasury/index.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {componentFixture} from './component-fixtures.mjs';
import {NOW,persisted} from './fixtures.mjs';
import {plaintextHash} from './verification-fixtures.mjs';

test('one-shot component permits use exact existing Treasury +2 protocol without company activation or fabricated order/payment',async t=>{
  const h=componentFixture(),directory=await mkdtemp('/tmp/near-rules-component-'),journal=await createJournal({directory});t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
  await journal.transaction({actionId:'isolated-test-state',fingerprint:'isolated-test-state'},tx=>tx.put('treasury','financial',h.financial));
  const treasury=createTreasury({journal,clock:()=>NOW,getPolicyState:()=>h.rules.snapshot()}),facts=()=>({...h.facts,financial:treasury.snapshot(),action:h.action});
  const before=treasury.snapshot().version,d=h.rules.evaluate(h.action,facts());assert.equal(d.status,'allow',JSON.stringify(d));assert.equal(d.authorizationId,h.authorization.id);assert.equal(d.permit.authorizationId,h.authorization.id);assert.equal(d.plan.reservation.purpose,'inference');assert.equal(d.plan.reservation.orderId,undefined);
  await treasury.applyDecision({actionId:h.action.id,decision:d});assert.equal(treasury.snapshot().version,before+1);assert.equal(treasury.snapshot().approvedPlans.at(-1).authorizationId,h.authorization.id);
  assert.equal(h.rules.evaluate(h.action,facts()).reasonCode,'COMPONENT_AUTHORIZATION_USED');
  const pre=h.rules.validateDispatch(d.permit,facts());assert.equal(pre.status,'allow',JSON.stringify(pre));await treasury.consumePermit({actionId:h.action.id,permit:d.permit,decision:pre});assert.equal(treasury.snapshot().version,before+2);assert.equal(treasury.snapshot().consumedPermits[0].authorizationId,h.authorization.id);
  let calls=0;assert.equal(h.rules.dispatch(d.permit,facts(),()=>{calls++;return {status:'unknown'};}).status,'allow');assert.equal(calls,1);assert.equal(h.rules.dispatch(d.permit,facts(),()=>calls++).reasonCode,'PERMIT_CONSUMED');
  assert.equal(journal.list('orders').length,0);assert.equal(journal.list('allocations').length,0);
  const restarted=componentFixture();assert.equal(restarted.rules.evaluate(restarted.action,{...restarted.facts,financial:treasury.snapshot()}).reasonCode,'COMPONENT_AUTHORIZATION_USED');assert.equal(restarted.rules.validateDispatch(d.permit,facts()).reasonCode,'UNTRUSTED_PERMIT');
});

test('component limits, owner/credit scope, request and grants cannot be supplied or enlarged in request facts',()=>{
  const h=componentFixture();assert.equal(h.rules.evaluate(h.action,h.facts).status,'allow');
  assert.equal(h.rules.evaluate(h.action,{...h.facts,access:{verifiedLocal:true,role:'owner',companyId:h.companyId}}).reasonCode,'ACCESS_DENIED');
  assert.equal(h.rules.evaluate({...h.action,maxCostNanoUsd:'2000000'},h.facts).reasonCode,'COMPONENT_REQUEST_MISMATCH');
  assert.equal(h.rules.evaluate(h.action,{...h.facts,request:{...h.request,timeoutMs:2}}).reasonCode,'COMPONENT_REQUEST_MISMATCH');
  h.setAuthorization(null);assert.equal(h.rules.evaluate(h.action,{...h.facts,componentAuthorization:h.authorization}).reasonCode,'COMPONENT_AUTHORIZATION_REQUIRED');
  h.setAuthorization({...h.authorization,maxCalls:2});assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'COMPONENT_AUTHORIZATION_REQUIRED');
  h.setAuthorization({...h.authorization,dailyCapNanoUsd:'999999999999999999'});assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'COMPONENT_CAP_EXCEEDED');
  h.setAuthorization(h.authorization);h.financial.credits.lots[0].scopeId='wrong-scope';assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'COMPONENT_SCOPED_CREDIT_REQUIRED');
});

test('current kill, owner grant revocation/expiry, exact prepared bytes and unknown costs stop final component dispatch',()=>{
  for(const change of ['kill','revoke','expire','wire-change','unknown-cost','lower-cap']){
    const h=componentFixture(),d=h.rules.evaluate(h.action,h.facts);assert.equal(d.status,'allow');const f=persisted(d,h.financial),facts={...h.facts,action:h.action,financial:f};let calls=0;
    if(change==='kill')h.rules.updateConfig({...h.c,killSwitch:true});
    if(change==='revoke')h.setAuthorization(null);
    if(change==='expire')h.setAuthorization({...h.authorization,expiresAt:new Date(NOW).toISOString()});
    if(change==='wire-change')h.runtime.verificationResults[0].requestBytesHash=plaintextHash('different prepared ciphertext');
    if(change==='unknown-cost')f.reservations.push({id:'unknown-prior',actionId:'unknown-prior',purpose:'inference',status:'unknown',upperBoundNanoUsd:'1'});
    if(change==='lower-cap')h.setAuthorization({...h.authorization,dailyCapNanoUsd:'1'});
    assert.notEqual(h.rules.dispatch(d.permit,facts,()=>calls++).status,'allow',change);assert.equal(calls,0,change);
  }
});

test('component paid proof bypasses only sales readiness, never fresh bounds or reconciled attributable credit',()=>{
  const h=componentFixture();assert.equal(h.rules.evaluate(h.action,h.facts).status,'allow');
  assert.equal(h.rules.evaluate({id:'business-offer',type:'offer'},{}).reasonCode,'LIVE_AUTHORIZATION_REQUIRED');
  h.runtime.observations.find(x=>x.capability==='inference_bounds').status='configured';assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'RUNTIME_NOT_READY');h.runtime.observations.find(x=>x.capability==='inference_bounds').status='verified';
  h.providerBounds.status='configured';assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'BOUNDS_UNESTABLISHED');h.providerBounds.status='verified';
  h.providerBounds.inputNanoUsdPerMillionTokens='100000000000000000000';assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'BOUNDS_EXCEED_AUTHORIZED_CHARGE');h.providerBounds.inputNanoUsdPerMillionTokens='1000';
  h.financial.balanceReconciliations[0].status='deficit';assert.equal(h.rules.evaluate(h.action,h.facts).reasonCode,'BALANCE_RECONCILIATION_REQUIRED');
});

test('orderless component costs require trusted actual billing and bound receipt metadata, unknown never frees its reserve',()=>{
  const h=componentFixture(),d=h.rules.evaluate(h.action,h.facts);assert.equal(d.status,'allow');const f=persisted(d,h.financial),a={id:'actual-component-cost',type:'component_consumption',resultId:'controlled-bill'};
  const result={status:'confirmed',providerRequestId:'controlled-provider-request',cost:{status:'pending',actualCostNanoUsd:null},receipt:{id:'controlled-cost',binding:h.binding,watermark:{stream:'controlled-billing',position:'3'},providerReference:'controlled-provider-inference-id'}};
  const record={id:a.resultId,source:'local-sdk',authorizationId:h.authorization.id,actionId:h.action.id,requestFingerprint:h.action.requestFingerprint,evidenceRef:'private:controlled-actual-bill',result};h.runtime.componentResults=[record];
  let cost=h.rules.evaluate(a,{access:h.access,financial:f});assert.equal(cost.reasonCode,'COST_UNRECONCILED');assert.equal(f.reservations[0].status,'reserved');
  result.cost={status:'actual',actualCostNanoUsd:'100'};cost=h.rules.evaluate(a,{access:h.access,financial:f});assert.equal(cost.status,'allow',JSON.stringify(cost));assert.equal(cost.plan.kind,'consumption');assert.equal(cost.plan.actualCostNanoUsd,'100');assert.equal(cost.plan.remainingCreditNanoUsd,'999999900');assert.equal(cost.plan.orderPatch,undefined);assert.equal(cost.plan.providerReference,result.receipt.providerReference);
  h.runtime.componentResults=[];assert.equal(h.rules.evaluate(a,{access:h.access,financial:f,result,componentResults:[record]}).reasonCode,'COMPONENT_COST_EVIDENCE_REQUIRED');
});
