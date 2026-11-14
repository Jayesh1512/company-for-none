import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRules,validateConfig} from '../../src/rules/index.mjs';
import {ceilingBlock,lifetimeExposure,totalCeiling,CEILING_ACTIONS} from '../../src/rules/ceiling.mjs';
import {createJournal} from '../../src/journal/index.mjs';
import {createTreasury} from '../../src/treasury/index.mjs';
import {componentFixture} from './component-fixtures.mjs';
import {NOW,config,persisted} from './fixtures.mjs';

const cap='5000000000',ledger=reservations=>({version:1,reservations}),reservation=(actionId,status,bound,actual)=>({id:`reservation:${actionId}`,actionId,status,purpose:'inference',accountingDay:'2026-11-10',upperBoundNanoUsd:bound,...actual!==undefined?{actualCostNanoUsd:actual}:{}});
function cappedFixture(){const h=componentFixture();h.authorization.maxTotalNanoUsd=cap;return h;}

test('lifetime USD exposure includes actual plus full pending across purposes, original identities, days and renewed grants',()=>{
 const financial=ledger([reservation('old-business','reconciled','4000000000','3000000000'),{...reservation('old-funding','pending','1000000000'),purpose:'funding'},reservation('unknown-agent','unknown','900000000'),reservation('released','released','9000000000'),reservation('failed-with-cost','failed','200000000','99000000')]);
 assert.equal(lifetimeExposure(financial),4999000000n);assert.equal(totalCeiling({spending:{totalCeilingNanoUsd:cap}},[{id:'new-day-new-grant',maxTotalNanoUsd:'10000000000'}]),5000000000n);
 for(const type of CEILING_ACTIONS){const action={id:`new:${type}`,type,maxCostNanoUsd:'1000000'};assert.equal(ceilingBlock(action,{financial},{spending:{totalCeilingNanoUsd:cap}},[]),null);assert.equal(ceilingBlock({...action,maxCostNanoUsd:'1000001'},{financial},{spending:{totalCeilingNanoUsd:cap}},[{id:'renewed',maxTotalNanoUsd:'10000000000'}]).reasonCode,'TOTAL_CEILING_EXCEEDED');}
 // Re-evaluating the exact reserved dispatch replaces only its own pending bound.
 assert.equal(lifetimeExposure(ledger([reservation('same','reserved','1000000000')]),'same'),0n);assert.equal(lifetimeExposure(ledger([reservation('same','reconciled','1000000000','900000000')]),'same'),900000000n);
});

test('ceiling refuses malformed or absent reservation facts and never converts external asset principal into USD',()=>{
 const c={spending:{totalCeilingNanoUsd:cap}},a={id:'new',type:'funding',maxCostNanoUsd:'1',money:{network:'near',asset:'NEAR',decimals:24,amount:'999999999999999999999999999999'}};
 assert.equal(ceilingBlock(a,{financial:ledger([])},c,[]),null); // Cash still requires its own exact asset authorization.
 for(const reservations of [undefined,[{actionId:'bad',status:'pending'}],[reservation('same','pending','1'),reservation('same','pending','1')]])assert.equal(ceilingBlock(a,{financial:ledger(reservations)},c,[]).reasonCode,'TOTAL_CEILING_FACTS_REQUIRED');
 assert.equal(ceilingBlock(a,{financial:ledger([])},c,[{maxTotalNanoUsd:'05'}]).reasonCode,'TOTAL_CEILING_INVALID');assert.equal(ceilingBlock({...a,maxCostNanoUsd:undefined},{financial:ledger([])},c,[]).reasonCode,'TOTAL_CEILING_BOUND_REQUIRED');
});

test('one common cap survives journal/Treasury restart and fresh grant IDs at a new UTC day',async t=>{
 const directory=await mkdtemp('/tmp/near-ceiling-restart-');t.after(()=>rm(directory,{recursive:true,force:true}));let journal=await createJournal({directory});
 try{
  const h=cappedFixture();h.financial.reservations.push(reservation('previous-business','reconciled','5000000000','4999500000'));await journal.transaction({actionId:'controlled-lifetime-cost',fingerprint:'controlled-lifetime-cost'},tx=>tx.put('treasury','financial',h.financial));
  await journal.close();journal=await createJournal({directory});const treasury=createTreasury({journal,clock:()=>NOW+86400000,getPolicyState:()=>h.rules.snapshot()});
  const next=cappedFixture();next.setAuthorization({...next.authorization,id:'new-day-component',maxTotalNanoUsd:'10000000000'});
  // Company-wide policy ceiling is retained independently of the renewed grant.
  const rules=createRules({config:next.c,totalCeilingNanoUsd:cap,companyId:next.companyId,clock:()=>NOW+86400000,getRuntimeFacts:()=>next.runtime,getComponentAuthorization:()=>({...next.authorization,id:'new-day-component',maxTotalNanoUsd:'10000000000'}),getInferenceBounds:()=>next.providerBounds});
  assert.equal(rules.evaluate({...next.action,id:'component:new-day-component'},{...next.facts,financial:treasury.snapshot()}).reasonCode,'TOTAL_CEILING_EXCEEDED');
 }finally{await journal.close();}
});

test('exact pending reservation passes at the ceiling, but post-consumption reductions, cap removal or changed policy stop dispatch',()=>{
 for(const mutation of ['none','reduce','remove','policy','extra-actual']){
  const h=cappedFixture();h.financial.reservations.push(reservation('historic','reconciled',cap,'4999000000'));const d=h.rules.evaluate(h.action,h.facts);assert.equal(d.status,'allow',JSON.stringify(d));const financial=persisted(d,h.financial),facts={...h.facts,financial,action:h.action};assert.equal(h.rules.validateDispatch(d.permit,facts).status,'allow');
  if(mutation==='reduce')h.setAuthorization({...h.authorization,maxTotalNanoUsd:'4999999999'});
  if(mutation==='remove'){const {maxTotalNanoUsd,...grant}=h.authorization;h.setAuthorization(grant);}
  if(mutation==='policy')h.rules.updateConfig({...h.c,spending:{...h.c.spending,totalCeilingNanoUsd:'4999999999'}});
  if(mutation==='extra-actual')financial.reservations[0].actualCostNanoUsd='4999000001';
  let calls=0;const final=h.rules.dispatch(d.permit,facts,()=>calls++);assert.equal(final.status,mutation==='none'?'allow':'deny',`${mutation}: ${JSON.stringify(final)}`);assert.equal(calls,mutation==='none'?1:0);
 }
});

test('runtime-only safety ceiling works in isolated setup without inventing a commercial policy or paid authority',()=>{
 const r=createRules({setupOnly:true,companyId:'local-demo',totalCeilingNanoUsd:cap});assert.equal(r.snapshot().config,null);assert.equal(r.snapshot().mode,'setup');assert.equal(r.snapshot().safety.totalCeilingNanoUsd,cap);assert.equal(r.evaluate({id:'paid',type:'inference'},{access:{companyId:'local-demo',role:'owner',verified:true}}).reasonCode,'COMMERCIAL_POLICY_REQUIRED');
 const c=config();c.spending.totalCeilingNanoUsd=cap;assert.equal(validateConfig(c).spending.totalCeilingNanoUsd,cap);for(const value of ['0','-1','05',5])assert.throws(()=>createRules({setupOnly:true,totalCeilingNanoUsd:value}));
});
