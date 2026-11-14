import test from 'node:test';
import assert from 'node:assert/strict';
import {createRules} from '../../src/rules/index.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {config,NOW,financial} from './fixtures.mjs';

const companyId='economic-test',access={verified:true,role:'owner',companyId};
function fixture(){
  const c=config();c.mode='live';
  const binding={provider:'controlled-custody',companyId,accountId:c.treasuryAccount,organizationId:null,credentialId:null,...c.settlementAsset,bucket:'confidential'};
  const runtime={economicIdentity:{companyId,treasuryAccount:c.treasuryAccount,network:c.settlementAsset.network,bucket:'confidential',cashBinding:binding},economicObservations:[],economicReceipts:[]};
  const rules=createRules({config:c,companyId,clock:()=>NOW,getRuntimeFacts:()=>runtime});
  const f=financial();f.balances=[];f.credits={availableNanoUsd:'0',lots:[]};f.openingRecords=[];f.economicMovements=[];f.providerObservations=[];f.balanceReconciliations=[];
  const scopeId=fingerprint({resource:'cash',binding});
  const record={id:'opening:cash',receiptId:'opening:cash',kind:'cash_opening',status:'verified',binding,watermark:{stream:'cash',position:'10'},money:{...c.settlementAsset,amount:'10000000'},provenance:'explicit-opening',evidenceRef:'test:opening-proof',ownerBindingApproval:{id:'owner-binding-approval',companyId,scopeId,policyVersion:rules.snapshot().policyVersion}};
  runtime.economicReceipts.push(record);
  const evaluate=(type,extra={})=>rules.evaluate({id:`action:${type}`,type,...extra},{access,financial:f});
  return {c,runtime,rules,f,binding,scopeId,record,evaluate};
}

test('nonfixture economic openings select trusted verified receipts and explicit owner binding approval, independently of spend authority',()=>{
  const h=fixture(),a={receiptId:h.record.receiptId};
  const good=h.evaluate('cash_opening',a);assert.equal(good.status,'allow');assert.equal(good.plan.kind,'cash_opening');assert.equal(good.plan.money.amount,'10000000');assert.equal(good.plan.grantsSpendingAuthority,false);assert.equal(good.permit,undefined);
  h.runtime.economicReceipts=[];
  assert.equal(h.rules.evaluate({id:'spoof',type:'cash_opening',...a},{access,financial:h.f,observation:h.record,receipt:h.record,runtimeFacts:{economicReceipts:[h.record]}}).reasonCode,'ECONOMIC_EVIDENCE_REQUIRED');
  h.runtime.economicReceipts=[h.record];delete h.record.ownerBindingApproval;assert.equal(h.evaluate('cash_opening',a).reasonCode,'OWNER_BINDING_APPROVAL_REQUIRED');
  h.record.ownerBindingApproval={id:'wrong-scope',companyId,scopeId:'different',policyVersion:h.rules.snapshot().policyVersion};assert.equal(h.evaluate('cash_opening',a).reasonCode,'OWNER_BINDING_APPROVAL_REQUIRED');
  assert.equal(h.rules.evaluate({id:'no-owner',type:'cash_opening',...a},{financial:h.f}).reasonCode,'ACCESS_DENIED');
});

test('opening refuses previously spent legacy resource and cannot be re-opened under a fresh receipt',()=>{
  const h=fixture(),a={receiptId:h.record.receiptId};h.f.balances=[{...h.record.money,amount:'0'}];assert.equal(h.evaluate('cash_opening',a).reasonCode,'LEGACY_RESOURCE_ALREADY_RECORDED');
  h.f.balances=[];h.f.openingRecords=[{...h.record,scopeId:h.scopeId,resource:'cash'}];assert.equal(h.evaluate('cash_opening',a).reasonCode,'ECONOMIC_OPENING_ALREADY_RECORDED');
  assert.equal(h.evaluate('capital_record').reasonCode,'LEGACY_ECONOMIC_IMPORT_DISABLED');assert.equal(h.evaluate('credit_record').reasonCode,'LEGACY_ECONOMIC_IMPORT_DISABLED');
});

test('absolute snapshot comparison preserves exact units and unknowns; no snapshot manufactures a movement',()=>{
  const h=fixture(),o={id:'observed:cash',status:'verified',resource:'cash',binding:h.binding,watermark:{stream:'cash',position:'11'},observedAt:new Date(NOW).toISOString(),evidenceRef:'test:balance',money:h.record.money};h.runtime.economicObservations=[o];
  const first=h.evaluate('balance_snapshot',{observationId:o.id});assert.equal(first.status,'allow');assert.equal(first.plan.reconciliation.status,'unreconciled');assert.equal(first.plan.reconciliation.expectedAmount,'0');assert.equal(first.plan.reconciliation.observedAmount,'10000000');assert.equal(first.plan.credit,undefined);
  h.f.openingRecords=[{...h.record,scopeId:h.scopeId,resource:'cash'}];h.f.balances=[h.record.money];
  for(const [value,status] of [['9999999','deficit'],['10000000','matched'],['10000001','surplus']]){o.money={...h.record.money,amount:value};const d=h.evaluate('balance_snapshot',{observationId:o.id});assert.equal(d.plan.reconciliation.status,status);assert.equal(d.plan.reconciliation.expectedAmount,'10000000');assert.equal(d.plan.reconciliation.observedAmount,value);}
  h.f.reservations=[{id:'r1',actionId:'ambiguous-effect',status:'unknown'}];const pending=h.evaluate('balance_snapshot',{observationId:o.id});assert.equal(pending.plan.reconciliation.status,'pending');assert.deepEqual(pending.plan.reconciliation.unresolvedOperationIds,['ambiguous-effect']);assert.deepEqual(h.f.balances,[h.record.money]);
  o.money={...o.money,asset:'wrong'};assert.equal(h.evaluate('balance_snapshot',{observationId:o.id}).reasonCode,'ECONOMIC_ASSET_MISMATCH');
});

test('comparison never accepts an older or same provider position as a new reconciliation',()=>{
  const h=fixture();h.f.providerObservations=[{...h.record,id:'old',resource:'cash',scopeId:h.scopeId}];
  const o={id:'next',status:'verified',resource:'cash',binding:h.binding,watermark:{stream:'cash',position:'10'},observedAt:new Date(NOW).toISOString(),evidenceRef:'test:balance',money:h.record.money};h.runtime.economicObservations=[o];
  for(const position of ['9','10']){o.watermark.position=position;assert.equal(h.evaluate('balance_snapshot',{observationId:o.id}).reasonCode,'ECONOMIC_OBSERVATION_STALE');}
  o.watermark={stream:'another-stream',position:'11'};assert.equal(h.evaluate('balance_snapshot',{observationId:o.id}).reasonCode,'ECONOMIC_OBSERVATION_STALE');
  o.watermark={stream:'cash',position:'11'};h.f.economicMovements=[{scopeId:h.scopeId,watermark:{stream:'cash',position:'12'}}];h.f.openingRecords=[{...h.record,scopeId:h.scopeId}];assert.equal(h.evaluate('balance_snapshot',{observationId:o.id}).plan.reconciliation.reasonCode,'ECONOMIC_SNAPSHOT_BEHIND_MOVEMENT');
});

test('discrete receipts require a unique post-opening provider transaction and exact account scope',()=>{
  const h=fixture();h.f.openingRecords=[{...h.record,resource:'cash',scopeId:h.scopeId}];
  const r={...h.record,kind:'cash_receipt',id:'receipt:cash',receiptId:'receipt:cash',providerReference:'provider-transaction-1',watermark:{stream:'cash',position:'11'}};h.runtime.economicReceipts=[r];
  assert.equal(h.evaluate('cash_receipt',{receiptId:r.receiptId}).status,'allow');
  h.f.economicMovements=[{providerReference:r.providerReference,scopeId:h.scopeId}];assert.equal(h.evaluate('cash_receipt',{receiptId:r.receiptId}).reasonCode,'ECONOMIC_REFERENCE_REUSED');h.f.economicMovements=[];
  r.watermark.position='10';assert.equal(h.evaluate('cash_receipt',{receiptId:r.receiptId}).reasonCode,'ECONOMIC_RECEIPT_STALE');r.watermark.position='11';
  h.runtime.economicObservations=[{id:'provider-observation-id'}];r.providerReference='provider-observation-id';assert.equal(h.evaluate('cash_receipt',{receiptId:r.receiptId}).reasonCode,'PROVIDER_TRANSACTION_REFERENCE_REQUIRED');r.providerReference='provider-transaction-1';
  r.binding={...h.binding,bucket:'public'};assert.equal(h.evaluate('cash_receipt',{receiptId:r.receiptId}).reasonCode,'ECONOMIC_BINDING_MISMATCH');
});
