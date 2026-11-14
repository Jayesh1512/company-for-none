import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createTreasury} from '../../src/treasury/index.mjs';
import {createNearIntegrations,readIntegrationFacts} from '../../src/integrations/index.mjs';
import {config} from '../rules/fixtures.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {integrationDecision} from '../../src/rules/integrations.mjs';
import {apply} from '../state-money/fixtures.mjs';

const companyId='integration-test',owner={companyId,verified:true,role:'owner'},NOW=Date.parse('2026-11-14T16:00:00Z');
async function fixture(t,{transport,resolveSecret,beforeGate}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'near-mentor-'));let journal=await createJournal({directory,clock:()=>new Date(NOW)}),api,authorization=null,bounds=[],clock=NOW;
 const policy={...config(),mode:'live',nearIntegrations:{operations:['owner_generate','owner_submit','pingpay_offers','pingpay_quote','pingpay_settle'],maxRequestNanoUsd:'1000000'}};
 let rules,treasury;
 function init(){
  rules=createRules({companyId,clock:()=>clock,totalCeilingNanoUsd:'5000000000',config:policy,getIntegrationFacts:()=>{const f=api?.facts()??{};return readIntegrationFacts({journal,companyId,authorization,...f,bounds:[...bounds,...f.bounds??[]]});}});
  treasury=createTreasury({journal,clock:()=>new Date(clock),getPolicyState:()=>rules.snapshot()});
  api=createNearIntegrations({journal,rules,treasury,companyId,clock:()=>new Date(clock),providers:{resolveSecret:resolveSecret??(async()=> 'local-stand-in-key')},transport,
   dispatchAuthorized:async({action,decision,facts},start)=>{beforeGate?.(rules);let d=rules.validateDispatch(decision.permit,{...facts,action,financial:treasury.snapshot()});if(d.status!=='allow')return d;await treasury.consumePermit({actionId:action.id,permit:decision.permit,decision:d});return rules.dispatch(decision.permit,{...facts,action,financial:treasury.snapshot()},start);}});
 }
 init();assert.equal(rules.snapshot().valid,true,rules.snapshot().error);
 t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 return {get api(){return api;},get rules(){return rules;},get treasury(){return treasury;},get journal(){return journal;},
  authorize(plan,maxCostNanoUsd='0'){authorization={id:'exact:'+plan.id,companyId,policyVersion:rules.snapshot().policyVersion,planId:plan.id,requestHash:plan.hash,kind:plan.kind,maxCalls:1,maxCostNanoUsd,maxTotalNanoUsd:'5000000000',expiresAt:new Date(clock+60000).toISOString()};bounds.push({source:'integration-cost-bound',requestHash:plan.hash,kind:plan.kind,bindingHash:fingerprint(plan.binding),expiresAt:new Date(clock+60000).toISOString(),maxCostNanoUsd});},
  async restart(){await journal.close();journal=await createJournal({directory,clock:()=>new Date(clock)});init();},setClock:t=>clock=t,authorization:()=>authorization};
}
const requirement={scheme:'exact',network:'eip155:1',asset:'asset',extra:{assetTransferMethod:'near-intents',paymentFlow:'upfront'}};
test('actual M01/M03 integration gate denies anonymous, unapproved and caller-supplied authority before HTTP',async t=>{
 let sends=0;const f=await fixture(t,{transport:async()=>{sends++;return new Response('{}');}});
 assert.throws(()=>f.api.view({role:'public'}),{code:'ACCESS_DENIED'});
 const {plan}=await f.api.prepare('pingpay_offers',{resourceId:'report:v1',amountOut:'100'},owner,'offer');assert.equal(sends,0);
 await assert.rejects(f.api.execute({planId:plan.id},owner),{code:'INTEGRATION_AUTHORIZATION_REQUIRED'});assert.equal(sends,0);assert.equal(f.treasury.snapshot().reservations.length,0);
 f.authorize(plan);assert.equal((await f.api.execute({planId:plan.id},owner)).status,'unknown');assert.equal(sends,1);assert.equal(f.treasury.snapshot().reservations.length,1);
});
test('real client composition persists exact exchange before decoding, restart never resubmits original effect',async t=>{
 let sends=0;const f=await fixture(t,{transport:async()=>{sends++;return new Response(JSON.stringify({accepts:[requirement]}));}});
 const {plan}=await f.api.prepare('pingpay_offers',{resourceId:'report:v1',amountOut:'100'},owner,'offers');f.authorize(plan);
 const first=await f.api.execute({planId:plan.id},owner);assert.equal(first.status,'confirmed');assert.equal(sends,1);assert.ok(f.journal.get('integrationExchanges',plan.id+':execute').raw.includes('accepts'));
 await f.restart();const again=await f.api.execute({planId:plan.id},owner);assert.equal(again.reasonCode,'ORIGINAL_OPERATION_RECONCILIATION_REQUIRED');assert.equal(sends,1);
 assert.equal((await f.api.prepare('pingpay_offers',{resourceId:'report:v1',amountOut:'100'},owner,'offers')).replayed,true);
 await assert.rejects(f.api.prepare('pingpay_offers',{resourceId:'different',amountOut:'100'},owner,'offers'),{code:'CONFLICT'});
});
test('invalid JSON after accepted effect remains durable unknown with its original raw bytes',async t=>{
 let sends=0;const f=await fixture(t,{transport:async()=>{sends++;return new Response('provider accepted but invalid JSON');}});
 const {plan}=await f.api.prepare('pingpay_offers',{resourceId:'r',amountOut:'1'},owner,'malformed');f.authorize(plan);assert.equal((await f.api.execute({planId:plan.id},owner)).status,'unknown');
 assert.equal(f.journal.get('integrationExchanges',plan.id+':execute').raw,'provider accepted but invalid JSON');await f.restart();await f.api.execute({planId:plan.id},owner);assert.equal(sends,1);
});
test('missing credentials cause no provider operation or financial reservation',async t=>{
 let sends=0;const f=await fixture(t,{resolveSecret:async()=>null,transport:async()=>{sends++;return new Response('{}');}});const {plan}=await f.api.prepare('pingpay_offers',{resourceId:'r',amountOut:'1'},owner,'missing');f.authorize(plan);
 await assert.rejects(f.api.execute({planId:plan.id},owner),{code:'CREDENTIAL_UNAVAILABLE'});assert.equal(sends,0);assert.equal(f.treasury.snapshot().reservations.length,0);assert.equal(f.journal.recoverableOperations().length,0);
});
test('current kill/policy and plan expiry rechecked after credential await prevent transport',async t=>{
 let sends=0,secretHook=()=>{};const f=await fixture(t,{resolveSecret:async()=>{secretHook();return 'secret';},transport:async()=>{sends++;return new Response('{}');}});const {plan}=await f.api.prepare('pingpay_offers',{resourceId:'r',amountOut:'1'},owner,'stop');f.authorize(plan);
 secretHook=()=>f.rules.updateConfig({...f.rules.snapshot().config,killSwitch:true});await assert.rejects(f.api.execute({planId:plan.id},owner),{code:'CONFLICT'});assert.equal(sends,0);
 assert.equal(f.treasury.snapshot().reservations.length,0);
});
test('customer quote cannot be attached to a different resource, and expired quotes cannot make a new deposit request',async t=>{
 const f=await fixture(t,{transport:async()=>new Response(JSON.stringify({isValid:true,extra:{operationToken:'original',depositAddress:'addr',amountIn:'10',refundDeadline:new Date(NOW+10000).toISOString()}}))});
 const {plan}=await f.api.prepare('pingpay_quote',{resourceId:'r:v1',requirements:requirement,refundTo:'refund'},owner,'q');f.authorize(plan);await f.api.execute({planId:plan.id},owner);
 await assert.rejects(f.api.prepare('pingpay_settle',{resourceId:'different:v1',requirements:requirement,quotePlanId:plan.id,txHash:'tx'},owner,'bad-resource'),{code:'PINGPAY_ORIGINAL_QUOTE_REQUIRED'});
 f.setClock(NOW+10001);await assert.rejects(f.api.prepare('pingpay_settle',{resourceId:'r:v1',requirements:requirement,quotePlanId:plan.id,txHash:'tx'},owner,'expired'),{code:'PINGPAY_QUOTE_EXPIRED'});
});
test('a current final stop releases only a locally proven unsubmitted reservation, never an unknown effect',async t=>{
 let sends=0;const f=await fixture(t,{beforeGate:rules=>rules.updateConfig({...rules.snapshot().config,killSwitch:true}),transport:async()=>{sends++;return new Response('{}');}});
 const {plan}=await f.api.prepare('pingpay_offers',{resourceId:'r',amountOut:'1'},owner,'final-stop');f.authorize(plan);assert.equal((await f.api.execute({planId:plan.id},owner)).status,'not_submitted');assert.equal(sends,0);assert.equal(f.treasury.snapshot().reservations[0].status,'released');assert.equal(f.treasury.snapshot().reservations[0].actualCostNanoUsd,'0');
});
test('native snapshots are absolute, monotone and replayable; actual fees reconcile once without credit creation',async t=>{
 const f=await fixture(t),n={source:'near-json-rpc-final-account',networkId:'mainnet',accountId:'writer.near',balanceYocto:'1000',blockHeight:10,blockHash:'block',reference:'rpc',observedAt:new Date(NOW).toISOString()};
 await apply(f.treasury,'snapshot-1',{kind:'native_balance_snapshot',observation:n});await apply(f.treasury,'snapshot-2',{kind:'native_balance_snapshot',observation:{...n,observedAt:new Date(NOW+1000).toISOString()}});
 assert.equal(f.treasury.snapshot().nativeAccounts.length,1);assert.equal(f.treasury.snapshot().nativeAccounts[0].balanceYocto,'1000');assert.equal(f.treasury.snapshot().balances.length,0);assert.equal(f.treasury.snapshot().credits.availableNanoUsd,'0');
 await assert.rejects(apply(f.treasury,'regress',{kind:'native_balance_snapshot',observation:{...n,blockHeight:9}}),{code:'CONFLICT'});
 await apply(f.treasury,'native',{kind:'reservation',reservation:{id:'reserve-native',actionId:'native',purpose:'native_ledger',accountingDay:'2026-11-14',upperBoundNanoUsd:'100',status:'reserved',nativeResource:{networkId:'mainnet',accountId:'writer.near',amountYocto:'50'}}});
 const plan={kind:'operational_cost',reservationId:'reserve-native',actualCostNanoUsd:'12',nativeFeeYocto:'4',nativeSettledBlockHeight:11,receiptId:'actual-final-tx',evidenceRef:'private:RPC',accountingDay:'2026-11-14',expenseCategory:'native_ledger'};
 await apply(f.treasury,'actual-native-cost',plan);await apply(f.treasury,'actual-native-cost',plan);await f.restart();assert.equal(f.treasury.snapshot().dailyCosts['2026-11-14'],'12');assert.equal(f.treasury.snapshot().reservations[0].actualNativeFeeYocto,'4');assert.equal(f.treasury.snapshot().nativeAccounts[0].balanceYocto,'1000');
 await assert.rejects(apply(f.treasury,'stale-new-native',{kind:'reservation',reservation:{id:'stale-reserve',actionId:'stale-new-native',purpose:'native_ledger',accountingDay:'2026-11-14',upperBoundNanoUsd:'100',status:'reserved',nativeResource:{networkId:'mainnet',accountId:'writer.near',amountYocto:'997'}}}),{code:'CONFLICT'});
});
test('all provider purposes share the lifetime ceiling and the same prepaid key across project bindings',()=>{
 const p={id:'plan',companyId,kind:'outlayer_evaluate',request:{maxCostNanoUsd:'20'},binding:{provider:'outlayer',project:'one'},inputHash:'i',expiresAt:new Date(NOW+60000).toISOString()};p.hash=fingerprint({kind:p.kind,request:p.request,binding:p.binding,inputHash:p.inputHash});
 const action={id:'operation',type:'integration_execute',planId:p.id,requestHash:p.hash,maxCostNanoUsd:'20'},ctx={companyId,policyVersion:'v',now:NOW,authorizations:[],config:{mode:'live',killSwitch:false,nearIntegrations:{operations:[p.kind],maxRequestNanoUsd:'100'},spending:{totalCeilingNanoUsd:'100'}},data:{plans:[p],authorization:{id:'a',companyId,policyVersion:'v',planId:p.id,requestHash:p.hash,kind:p.kind,maxCalls:1,maxCostNanoUsd:'20',expiresAt:p.expiresAt},bounds:[{source:'integration-cost-bound',requestHash:p.hash,kind:p.kind,bindingHash:fingerprint(p.binding),expiresAt:p.expiresAt,maxCostNanoUsd:'20'}],resources:[{source:'provider-resource-observation',bindingHash:fingerprint(p.binding),resourceId:'same-key',availableNanoUsd:'30',expiresAt:p.expiresAt}]}};
 const facts={access:owner,financial:{version:0,reservations:[]}};assert.equal(integrationDecision(action,facts,ctx).status,'allow');
 facts.financial.reservations=[{id:'other-project',actionId:'other',purpose:'outlayer_evaluate',providerBindingHash:'different-project',providerResourceId:'same-key',upperBoundNanoUsd:'20',status:'unknown'}];assert.equal(integrationDecision(action,facts,ctx).reasonCode,'INSUFFICIENT_PROVIDER_RESOURCE');
 facts.financial.reservations=[{actionId:'cloud',upperBoundNanoUsd:'90',status:'unknown'}];assert.equal(integrationDecision(action,facts,ctx).reasonCode,'TOTAL_CEILING_EXCEEDED');
});
test('a durable provider cost-bound incident blocks new spending while owner status remains readable',()=>{
 const data={companyId,plans:[],incidents:[{id:'original-incident',companyId,type:'provider_cost_bound_breach'}]},rules=createRules({companyId,totalCeilingNanoUsd:'5000000000',config:{...config(),mode:'live'},getIntegrationFacts:()=>data});
 assert.equal(rules.evaluate({id:'new-model',type:'component_inference'},{access:owner}).reasonCode,'PROVIDER_COST_BOUND_BREACH');
 assert.equal(rules.evaluate({id:'view',type:'integration_view'},{access:owner}).status,'allow');
});
