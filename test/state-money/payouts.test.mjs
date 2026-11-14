import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJournal } from '../../src/journal/index.mjs';
import { createTreasury } from '../../src/treasury/index.mjs';
import { createPayouts } from '../../src/payouts/index.mjs';
import { createRules } from '../../src/rules/index.mjs';
import { createFixtureCustodyAdapter } from '../integrations-adapters/fixture-adapters.mjs';
import { bootstrapPlan, allocationPlan, payoutPlan, payoutAction, approve, apply, usd } from './fixtures.mjs';

async function fixture(t, custody, journalOptions = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'one-payout-'));
  let journal = await createJournal({ directory, ...journalOptions });
  let treasury = createTreasury({ journal });
  let payouts = createPayouts({ journal, treasury, custody });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  await apply(treasury, 'bootstrap', bootstrapPlan); await apply(treasury, 'allocation', allocationPlan);
  return { get journal() { return journal; }, get treasury() { return treasury; }, get payouts() { return payouts; }, async restart() {
    await journal.close(); journal = await createJournal({ directory }); treasury = createTreasury({ journal }); payouts = createPayouts({ journal, treasury, custody });
  } };
}
const confirmed = action => ({ status: 'confirmed', mode: 'fixture', providerRequestId: `fixture:${action.id}`, receipt: { status: 'confirmed', recipient: action.recipient, money: action.money, network: action.money.network, reference: `fixture:${action.id}` }, evidence: [] });
const command = f => ({ action: payoutAction, decision: approve(f.treasury, payoutAction, payoutPlan), facts: { order: { reportAccepted: true, reportAvailable: true } }, obligation: f.treasury.getObligation('obligation:one') });

test('frozen payout confirmation atomically consumes reserve once despite concurrent/repeated fulfillment', async t => {
  let sends = 0;
  const f = await fixture(t, { async transfer({ action }) { sends++; return confirmed(action); } });
  const request = command(f);
  const results = await Promise.all([f.payouts.fulfill(request), f.payouts.fulfill(request)]);
  assert.equal(sends, 1);
  assert.ok(results.some(x => x.status === 'confirmed'));
  await f.payouts.fulfill(request);
  assert.equal(sends, 1);
  assert.equal(f.treasury.getObligation('obligation:one').status, 'paid');
  assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '1000000');
  assert.equal(f.treasury.snapshot().balances[0].amount, '104000000');
  assert.equal(f.treasury.snapshot().protectedFunds.find(x => x.obligationId === 'obligation:one').amount, '0');
  assert.equal(f.journal.events().filter(x => x.type === 'payout.confirmed').length, 1);
  assert.equal(f.journal.getOperation(payoutAction.id).status, 'confirmed');
});

test('lost custody response stays unknown across restart and never triggers another transfer', async t => {
  let sends = 0; let observations = 0;
  const custody = { async transfer() { sends++; throw Error('accepted, response lost'); }, async reconcile({ action }) { observations++; return confirmed(action); } };
  const f = await fixture(t, custody);
  const request = command(f);
  assert.equal((await f.payouts.fulfill(request)).status, 'unknown');
  assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '0');
  assert.equal(f.treasury.getObligation('obligation:one').status, 'unknown');
  await f.restart();
  assert.equal((await f.payouts.fulfill(request)).status, 'unknown');
  assert.equal(sends, 1);
  assert.equal(f.journal.recoverableOperations()[0].status, 'unknown');
  const newAction = { ...payoutAction, id: 'payout:replacement' };
  await assert.rejects(f.payouts.fulfill({ ...request, action: newAction, decision: approve(f.treasury, newAction, payoutPlan) }), { code: 'CONFLICT' });
  assert.equal(sends, 1);
  await assert.rejects(f.payouts.reconcile({ action: payoutAction }), { code: 'POLICY_BLOCK' });
  const reconciliation = { action: payoutAction, decision: { status: 'allow', plan: { kind: 'reconcile', readOnly: true, resubmit: false } } };
  assert.equal((await f.payouts.reconcile(reconciliation)).status, 'confirmed');
  await f.payouts.reconcile(reconciliation);
  assert.equal(sends, 1); assert.equal(observations, 1);
  assert.equal(f.treasury.getObligation('obligation:one').status, 'paid');
  assert.equal(f.journal.events().filter(x => x.type === 'payout.confirmed').length, 1);
});

test('pending response stays owed; changed recipient and invalid confirmation cannot pay', async t => {
  let sends = 0;
  const f = await fixture(t, { async transfer() { sends++; return { status: 'pending', mode: 'fixture', evidence: [] }; }, async reconcile({ action }) { return { ...confirmed(action), receipt: { ...confirmed(action).receipt, money: usd('999999') } }; } });
  const request = command(f);
  const changed = { ...payoutAction, recipient: 'someone-else' };
  await assert.rejects(f.payouts.fulfill({ ...request, action: changed, decision: approve(f.treasury, changed, payoutPlan) }), { code: 'CONFLICT' });
  assert.equal(sends, 0);
  assert.equal((await f.payouts.fulfill(request)).status, 'pending');
  assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '0');
  const result = await f.payouts.reconcile({ action: payoutAction, decision: { status: 'allow' } });
  assert.equal(result.status, 'unknown'); assert.equal(result.code, 'RECEIPT_MISMATCH');
  assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '0');
  assert.equal(f.treasury.snapshot().balances[0].amount, '105000000');
});

test('local persistence failure before dispatch prevents custody execution', async t => {
  let failWrites = false; let sends = 0;
  const f = await fixture(t, { async transfer({ action }) { sends++; return confirmed(action); } }, { fault(point) { if (failWrites && point === 'beforeRename') throw Error('disk unavailable'); } });
  const request = command(f); failWrites = true;
  await assert.rejects(f.payouts.fulfill(request), /disk unavailable/);
  assert.equal(sends, 0); assert.equal(f.treasury.getObligation('obligation:one').status, 'due');
});

test('accepted payout with failed local result commit recovers unknown and reconciles once', async t => {
  let failOnce = false; let sends = 0;
  const custody = { async transfer({ action }) { sends++; failOnce = true; return confirmed(action); }, async reconcile({ action }) { return confirmed(action); } };
  const f = await fixture(t, custody, { fault(point) { if (failOnce && point === 'beforeRename') { failOnce = false; throw Error('result commit interrupted'); } } });
  const request = command(f);
  await assert.rejects(f.payouts.fulfill(request), /result commit interrupted/);
  assert.equal(sends, 1); assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '0');
  await f.restart();
  assert.equal((await f.payouts.fulfill(request)).status, 'unknown'); assert.equal(sends, 1);
  await f.payouts.reconcile({ action: payoutAction, decision: { status: 'allow' } });
  assert.equal(f.treasury.getObligation('obligation:one').status, 'paid');
  assert.equal(f.journal.getOperation(payoutAction.id).status, 'confirmed');
});

test('partial authorized progress is preserved without resetting obligation on replay', async t => {
  const action = { ...payoutAction, money: usd('400000') };
  const plan = { ...payoutPlan, money: usd('400000'), completedAmount: '400000', status: 'partially_paid' };
  const f = await fixture(t, { async transfer({ action }) { return confirmed(action); } });
  const request = { action, decision: approve(f.treasury, action, plan) };
  await f.payouts.fulfill(request); await f.payouts.fulfill(request);
  assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '400000');
  assert.equal(f.treasury.getObligation('obligation:one').status, 'partially_paid');
  assert.equal(f.treasury.snapshot().protectedFunds.find(x => x.obligationId === 'obligation:one').amount, '600000');
  const remainder = { ...payoutAction, id: 'payout:remainder', money: usd('600000') };
  const remainingPlan = { ...payoutPlan, money: usd('600000') };
  await f.payouts.fulfill({ action: remainder, decision: approve(f.treasury, remainder, remainingPlan) });
  assert.equal(f.treasury.getObligation('obligation:one').completedAmount, '1000000');
  assert.equal(f.treasury.getObligation('obligation:one').status, 'paid');
});

for (const killAtDispatch of [false, true]) {
  test(`real M01/M03/M04 fixture gate ${killAtDispatch ? 'blocks kill after consumption' : 'confirms frozen payout'}`, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'one-gate-'));
    const journal = await createJournal({ directory });
    t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
    const rules = createRules({ configPath: new URL('../../config.example.yaml', import.meta.url).pathname });
    const treasury = createTreasury({ journal, getPolicyState: () => rules.snapshot() });
    const initial = rules.evaluate({ id: 'bootstrap', type: 'bootstrap', mode: 'fixture' }, { financial: treasury.snapshot() });
    assert.equal(initial.status, 'allow'); await treasury.applyDecision({ actionId: 'bootstrap', decision: initial });
    const convert = value => ({ ...value, asset: 'demo-usdc' });
    const allocation = { ...allocationPlan, revenue: convert(allocationPlan.revenue), treasury: convert(allocationPlan.treasury), contributorReserve: convert(allocationPlan.contributorReserve), refundReserve: convert(allocationPlan.refundReserve), obligations: [{ ...allocationPlan.obligations[0], recipient: 'fixture-contributor', money: convert(allocationPlan.obligations[0].money) }] };
    await apply(treasury, 'allocation', allocation);
    let dispatches = 0;
    const custody = createFixtureCustodyAdapter({ journal, dispatchAuthorized: async ({ action, decision, facts }, callback) => {
      const pre = rules.validateDispatch(decision.permit, { ...facts, action, financial: treasury.snapshot() });
      if (pre.status !== 'allow') return pre;
      await treasury.consumePermit({ actionId: action.id, permit: decision.permit, decision: pre });
      if (killAtDispatch) rules.updateConfig({ ...rules.snapshot().config, killSwitch: true });
      return rules.dispatch(decision.permit, { ...facts, action, financial: treasury.snapshot() }, () => { dispatches++; return callback(); });
    } });
    const payouts = createPayouts({ journal, treasury, custody, rules });
    const action = { ...payoutAction, recipient: 'fixture-contributor', money: convert(payoutAction.money) };
    const facts = { order: { id: 'order:one', version: 1, reportAccepted: true, reportAvailable: true }, obligation: treasury.getObligation('obligation:one'), financial: treasury.snapshot() };
    const decision = rules.evaluate(action, facts); assert.equal(decision.status, 'allow');
    const result = await payouts.fulfill({ action, decision, facts, obligation: facts.obligation });
    assert.equal(result.status, killAtDispatch ? 'not_submitted' : 'confirmed');
    assert.equal(dispatches, killAtDispatch ? 0 : 1);
    assert.equal(treasury.getObligation('obligation:one').completedAmount, killAtDispatch ? '0' : '1000000');
    assert.equal(treasury.snapshot().consumedPermits.length, 1);
  });
}
