import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../helpers/create-fixture-app.mjs';
import { createRules } from '../../src/rules/index.mjs';
import { startServer } from '../../server.mjs';
import { projectLedger } from '../../src/ledger/index.mjs';

async function setup(t,options={}) {
  const directory=await mkdtemp(path.join(tmpdir(),'shop-integration-'));
  let app=await createApp({directory,...options});
  t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
  return {get app(){return app;},directory,async restart(extra={}){await app.close();app=await createApp({directory,...options,...extra});return app;}};
}
async function paid(app,extra={}) {
  const c=await app.workflow.createOrder({question:'What research evidence should a small business validate?',...extra});
  await app.workflow.quote(c.order.id);await app.workflow.confirmFixturePayment(c.order.id);return c;
}
const count=(app,purpose)=>Object.values(app.journal.snapshot().operations).filter(o=>o.purpose===purpose&&o.provider?.startsWith('fixture-')).length;

test('three fresh complete fixture sales, two customer assets, exact accounting, private report and rebuildable public ledger',async t=>{
  const h=await setup(t);let first;
  for(const sourceAsset of ['demo-usdc','demo-near','demo-usdc']) {
    const c=await paid(h.app,{sourceAsset});first??=c;
    assert.equal((await h.app.workflow.run(c.order.id)).order.status,'complete');
    const report=await h.app.workflow.getReport(c.order.id,{token:c.accessToken});
    assert.match(report.content,/DETERMINISTIC FIXTURE/);assert.equal(report.sources.length,3);
    await assert.rejects(h.app.workflow.getReport(c.order.id,{token:'outsider'}),{code:'ACCESS_DENIED'});
    assert.equal(h.app.workflow.verifyAccess(c.order.id,c.accessToken).verified,true);
  }
  const f=h.app.treasury.snapshot();
  assert.equal(f.allocations.length,3);assert.equal(f.obligations.length,3);
  assert.ok(f.obligations.every(o=>o.completedAmount==='1000000'&&o.status==='paid'));
  assert.equal(Object.values(f.dailyCosts).reduce((s,v)=>s+BigInt(v),0n),30000000n);
  assert.equal(f.reservations.filter(r=>r.status==='reconciled').length,6);
  assert.equal(f.balances.find(b=>b.asset==='demo-usdc').amount,'111880000');
  const ledger=await h.app.ledger.view();
  const disclosure=h.app.rules.evaluate({id:'test:disclosure',type:'disclosure'},{});
  assert.deepEqual(ledger,projectLedger(h.app.journal.events(),disclosure));
  assert.equal(ledger.totals.find(v=>v.asset==='demo-usdc').amounts['sale:confirmed'],'15000000');
  assert.equal(ledger.costs['consumption:confirmed'],'30000000');
  assert.equal(ledger.reconciliation,'recorded');
  const publicText=JSON.stringify(ledger);
  assert.ok(!publicText.includes(first.accessToken));assert.ok(!publicText.includes(first.order.question));assert.ok(!publicText.includes('Research question'));
  await h.restart();assert.equal(h.app.workflow.getOrder(first.order.id).status,'complete');
  assert.equal((await h.app.workflow.getReport(first.order.id,{token:first.accessToken})).orderId,first.order.id);
  assert.deepEqual(await h.app.ledger.view(),ledger);
});

for(const effect of ['funding','inference','payout'])test(`lost ${effect} response survives restart, reconciles original operation, and never re-submits`,async t=>{
  const scenarios={};const options=effect==='funding'?{fundingScenarios:scenarios}:effect==='inference'?{inferenceScenarios:scenarios}:{custodyScenarios:scenarios};
  const h=await setup(t,options),c=await paid(h.app);
  scenarios[`${c.order.id}:${effect}`]={lostResponse:true,reconcileStatus:'confirmed'};
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'held');
  const before=count(h.app,effect);assert.equal(before,1);
  if(effect!=='payout')assert.ok(h.app.treasury.snapshot().reservations.some(r=>r.status==='unknown'));
  await h.restart();
  const recovered=await h.app.workflow.recover();
  assert.equal(recovered[0].order.status,'complete');assert.equal(count(h.app,effect),before);
  assert.equal(h.app.treasury.snapshot().obligations[0].completedAmount,'1000000');
  assert.equal(h.app.treasury.snapshot().reservations.filter(r=>r.status==='unknown').length,0);
  assert.equal((await h.app.ledger.view()).reconciliation,'recorded');
});

for(const effect of ['funding','inference','payout'])test(`crash after durable ${effect} result before workflow transition resumes without a second effect`,async t=>{
  const h=await setup(t),c=await paid(h.app);
  const port=effect==='funding'?h.app.funding:effect==='inference'?h.app.inference:h.app.payouts;
  const method=effect==='funding'?'fund':effect==='inference'?'generate':'fulfill';
  const original=port[method];port[method]=async command=>{const result=await original(command);assert.equal(result.status,'confirmed');throw new Error('SIMULATED_PROCESS_CRASH');};
  await assert.rejects(h.app.workflow.run(c.order.id),/SIMULATED_PROCESS_CRASH/);
  const before=count(h.app,effect);await h.restart();
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'complete');assert.equal(count(h.app,effect),before);
  assert.equal(Object.values(h.app.treasury.snapshot().dailyCosts).reduce((s,v)=>s+BigInt(v),0n),10000000n);
});

test('rejected sourced report refunds the sale, preserves billed cost and reverses unpaid contributor obligation',async t=>{
  const h=await setup(t),c=await paid(h.app);
  const original=h.app.research.candidate;
  h.app.research.candidate=input=>{const result=original(input);result.reportFacts.unknownSourceReferences=['S99'];return result;};
  const result=await h.app.workflow.run(c.order.id);assert.equal(result.order.status,'refunded');assert.equal(result.order.reportAvailable,false);
  const f=h.app.treasury.snapshot();assert.equal(f.obligations[0].status,'reversed');assert.equal(f.obligations[0].completedAmount,'0');
  assert.equal(Object.values(f.dailyCosts)[0],'10000000');assert.equal(f.refunds.length,1);
  assert.equal(count(h.app,'payout'),0);assert.equal(count(h.app,'refund'),1);
  await h.restart();await h.app.workflow.run(c.order.id);assert.equal(count(h.app,'refund'),1);
});

test('definitively failed billed inference is accounted and refunded without contributor payout',async t=>{
  const scenarios={},h=await setup(t,{inferenceScenarios:scenarios}),c=await paid(h.app);
  scenarios[`${c.order.id}:inference`]={status:'failed',actualCostNanoUsd:'25000000'};
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'refunded');
  assert.equal(Object.values(h.app.treasury.snapshot().dailyCosts)[0],'25000000');assert.equal(count(h.app,'payout'),0);
});

test('late verified receipt is reserved and refunded; never allocated as a sale',async t=>{
  let clockMs=Date.now();const h=await setup(t,{clock:()=>new Date(clockMs)});
  const c=await h.app.workflow.createOrder({question:'What research evidence should be validated?'});await h.app.workflow.quote(c.order.id);
  clockMs+=16*60000;
  assert.equal((await h.app.workflow.confirmFixturePayment(c.order.id)).order.reasonCode,'LATE_PAYMENT_REMEDY');
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'refunded');
  assert.equal(h.app.treasury.snapshot().allocations.length,0);assert.equal(h.app.treasury.snapshot().obligations.length,0);assert.equal(count(h.app,'inference'),0);
});

test('current kill stops old paid order before new effects; frozen price and recipient survive config change',async t=>{
  const rules=createRules({configPath:path.resolve('config.yaml')}),h=await setup(t,{rules}),c=await paid(h.app);
  const config=structuredClone(rules.snapshot().config);config.killSwitch=true;rules.updateConfig(config);
  assert.equal((await h.app.workflow.run(c.order.id)).order.reasonCode,'KILL_SWITCH');assert.equal(count(h.app,'funding'),0);
  config.killSwitch=false;config.pricing.minimumAtomic='7000000';config.revenue.contributors[0].account='fixture-new-contributor';rules.updateConfig(config);
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'complete');
  const obligation=h.app.treasury.snapshot().obligations[0];assert.equal(obligation.recipient,'fixture-contributor');assert.equal(obligation.money.amount,'1000000');
  assert.equal(h.app.workflow.getOrder(c.order.id).offer.price.amount,'5000000');
});

test('actual HTTP enforces private capabilities, separate owner token, inert untrusted data and mutation origin',async t=>{
  const h=await setup(t,{ownerToken:'test-owner-secret'}),runtime=await startServer({app:h.app,port:0});
  t.after(()=>new Promise(resolve=>runtime.server.close(resolve)));
  const req=(url,options)=>fetch(runtime.url+url,options);
  assert.equal((await req('/api/status')).status,200);
  const created=await req('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Research <script>alert(1)</script> evidence sources'})});
  assert.equal(created.status,201);const c=await created.json();
  const auth={authorization:`Bearer ${c.accessToken}`};
  assert.equal((await req(`/api/orders/${c.order.id}`)).status,403);
  assert.equal((await req(`/api/orders/${c.order.id}`,{headers:auth})).status,200);
  assert.equal((await req(`/api/orders/${c.order.id}/run`,{method:'POST',headers:{...auth,origin:'https://untrusted.example'}})).status,403);
  for(const action of ['quote','fixture-payment','run'])assert.equal((await req(`/api/orders/${c.order.id}/${action}`,{method:'POST',headers:auth})).status,200);
  assert.equal((await req(`/api/orders/${c.order.id}/report`)).status,403);
  const report=await req(`/api/orders/${c.order.id}/report`,{headers:auth});assert.equal(report.status,200);
  const ledger=await (await req('/api/ledger')).text();assert.ok(!ledger.includes('alert(1)'));assert.ok(!ledger.includes(c.accessToken));
  assert.equal((await req('/api/owner/status',{headers:auth})).status,403);
  assert.equal((await req('/api/owner/status',{headers:{authorization:'Bearer test-owner-secret'}})).status,200);
});

test('delayed actual billing retains reservation and blocks delivery until original inference reconciles',async t=>{
  const scenarios={},h=await setup(t,{inferenceScenarios:scenarios}),c=await paid(h.app);
  scenarios[`${c.order.id}:inference`]={costPending:true,reconciledCostPending:false};
  const first=await h.app.workflow.run(c.order.id);assert.equal(first.order.status,'held');assert.equal(first.order.reportAvailable,false);
  assert.equal(h.app.treasury.snapshot().reservations.find(r=>r.purpose==='inference').status,'reserved');
  assert.equal(Object.values(h.app.treasury.snapshot().dailyCosts).reduce((s,v)=>s+BigInt(v),0n),0n);
  await h.restart();assert.equal((await h.app.workflow.recover())[0].order.status,'complete');assert.equal(count(h.app,'inference'),1);
  assert.equal(Object.values(h.app.treasury.snapshot().dailyCosts)[0],'10000000');
});

test('unresolved charge stays held across midnight and kill; repeated recovery never submits again',async t=>{
  let clockMs=Date.now();const scenarios={},h=await setup(t,{inferenceScenarios:scenarios,clock:()=>new Date(clockMs)}),c=await paid(h.app);
  scenarios[`${c.order.id}:inference`]={lostResponse:true,reconcileStatus:'unknown'};
  await h.app.workflow.run(c.order.id);const before=h.app.treasury.snapshot().reservations.find(r=>r.purpose==='inference');
  clockMs+=86400000;await h.restart();
  const config=structuredClone(h.app.rules.snapshot().config);config.killSwitch=true;h.app.rules.updateConfig(config);
  for(let i=0;i<2;i++)assert.equal((await h.app.workflow.recover())[0].order.status,'held');
  const after=h.app.treasury.snapshot().reservations.find(r=>r.id===before.id);
  assert.equal(after.status,'unknown');assert.equal(after.accountingDay,before.accountingDay);assert.equal(after.upperBoundNanoUsd,before.upperBoundNanoUsd);
  assert.equal(count(h.app,'inference'),1);assert.equal(count(h.app,'payout'),0);
});

test('simultaneous and repeated run commands serialize one obligation, one inference and one payout',async t=>{
  const h=await setup(t),c=await paid(h.app);
  const results=await Promise.all([h.app.workflow.run(c.order.id),h.app.workflow.run(c.order.id),h.app.workflow.run(c.order.id)]);
  assert.ok(results.every(r=>r.order.status==='complete'));assert.equal(count(h.app,'inference'),1);assert.equal(count(h.app,'payout'),1);assert.equal(h.app.treasury.snapshot().obligations.length,1);
});

test('wrong verified settlement facts cannot allocate revenue or start paid work',async t=>{
  const h=await setup(t),c=await h.app.workflow.createOrder({question:'Research evidence sources for a small business'});
  await h.app.workflow.quote(c.order.id);
  const original=h.app.payments.verifySettlement;
  h.app.payments.verifySettlement=command=>original({...command,observation:{status:'confirmed',amount:'1'}});
  const result=await h.app.workflow.confirmFixturePayment(c.order.id);assert.equal(result.order.paymentConfirmed,false);
  assert.equal(result.order.reasonCode,'UNVERIFIED_PAYMENT');
  await h.app.workflow.run(c.order.id);assert.equal(h.app.treasury.snapshot().allocations.length,0);assert.equal(count(h.app,'inference'),0);
});

test('all-failed source retrieval refunds before inference rather than trusting evidenceReady',async t=>{
  const h=await setup(t),c=await paid(h.app);
  h.app.research.collect=async()=>({schemaVersion:1,orderId:c.order.id,mode:'unavailable',sources:[],errors:[{code:'SOURCE_UNAVAILABLE'}]});
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'refunded');assert.equal(count(h.app,'inference'),0);assert.equal(count(h.app,'payout'),0);
});

test('bounded pure prompt assembly failure follows Rules remedy without charging inference',async t=>{
  const h=await setup(t),c=await paid(h.app);
  h.app.research.assemble=()=>{throw Object.assign(new Error('Input bound'),{code:'INPUT_BOUND_EXCEEDED'});};
  assert.equal((await h.app.workflow.run(c.order.id)).order.status,'refunded');assert.equal(count(h.app,'inference'),0);
});

test('valid kill at first startup resumes fixture initialization exactly once after owner turns it off',async t=>{
  const base=createRules({configPath:path.resolve('config.yaml')});
  const config=structuredClone(base.snapshot().config);config.killSwitch=true;
  const rules=createRules({config}),h=await setup(t,{rules});assert.equal(h.app.treasury.snapshot().balances.length,0);
  await assert.rejects(h.app.workflow.createOrder({question:'Research evidence'}),{code:'POLICY_BLOCK'});
  config.killSwitch=false;rules.updateConfig(config);
  const c=await paid(h.app);assert.equal((await h.app.workflow.run(c.order.id)).order.status,'complete');
  assert.equal(h.app.journal.events().filter(e=>e.type==='fixture.bootstrap').length,1);
});

test('invalid hot rules block business effects while last accepted redacted public ledger stays readable',async t=>{
  const baseline=createRules({configPath:path.resolve('config.yaml')});
  const rules=createRules({config:baseline.snapshot().config}),h=await setup(t,{rules});
  const c=await paid(h.app);await h.app.workflow.run(c.order.id);
  const runtime=await startServer({app:h.app,port:0});t.after(()=>new Promise(resolve=>runtime.server.close(resolve)));
  rules.updateConfig({schemaVersion:1,access:{publicLedger:true},invalidGrant:true});
  const response=await fetch(runtime.url+'/api/ledger');assert.equal(response.status,200);
  const view=await response.json();assert.equal(view.degraded,true);assert.equal(view.currentSafetyValid,false);assert.equal(view.businessEffectsAllowed,false);
  assert.ok(view.entries.length>0);assert.ok(!JSON.stringify(view).includes(c.order.question));
  const create=await fetch(runtime.url+'/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Research evidence'})});assert.equal(create.status,403);
  const privateRead=await fetch(runtime.url+`/api/orders/${c.order.id}/report`,{headers:{authorization:`Bearer ${c.accessToken}`}});assert.equal(privateRead.status,403);
});


test('order changed during permit consumption cannot dispatch using the earlier order snapshot',async t=>{
  const h=await setup(t),c=await paid(h.app),consume=h.app.treasury.consumePermit;
  let changed=false;
  h.app.treasury.consumePermit=async command=>{
    const result=await consume(command);
    if(!changed){changed=true;await h.app.journal.transaction({actionId:'test:order-race',fingerprint:'test:order-race'},tx=>{
      const order=tx.get('orders',c.order.id);tx.put('orders',order.id,{...order,version:order.version+1});return null;
    });}
    return result;
  };
  // The workflow may conflict while recording its stale transition; no provider effect is allowed.
  try{await h.app.workflow.run(c.order.id);}catch(error){assert.equal(error.code,'CONFLICT');}
  assert.equal(changed,true);
  const operation=h.app.journal.getOperation(`adapters:m06:${c.order.id}:funding`);
  assert.equal(operation.result.status,'not_submitted');
  assert.equal(operation.result.code,'STALE_ORDER_STATE');
  assert.equal(h.app.treasury.snapshot().credits.lots.length,0);
});
