import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJournal } from '../../src/journal/index.mjs';
import { createTreasury } from '../../src/treasury/index.mjs';
import { usd, bootstrapPlan, allocationPlan, fundingReservation, fundingPlan, inferenceReservation, consumptionPlan, payoutPlan, payoutAction, approve, apply } from './fixtures.mjs';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'one-treasury-'));
  let journal = await createJournal({ directory });
  let treasury = createTreasury({ journal, ...options });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return { get journal() { return journal; }, get treasury() { return treasury; }, async restart() { await journal.close(); journal = await createJournal({ directory }); treasury = createTreasury({ journal, ...options }); return treasury; } };
}

test('one exact allocation and obligation for repeated plans or settlement callbacks', async t => {
  const f = await fixture(t); const treasury = f.treasury;
  await apply(treasury, 'bootstrap', bootstrapPlan);
  const decision = approve(treasury, { id: 'allocate:one' }, allocationPlan);
  const first = await treasury.applyDecision({ actionId: 'allocate:one', decision });
  assert.equal((await treasury.applyDecision({ actionId: 'allocate:one', decision })).replayed, true);
  assert.equal((await treasury.applyDecision({ actionId: 'repeated-callback', decision })).result.duplicate, true);
  const state = treasury.snapshot();
  assert.equal(state.obligations.length, 1); assert.equal(state.allocations.length, 1);
  assert.equal(state.obligations[0].money.amount, '1000000');
  assert.equal(state.balances[0].amount, '105000000');
  assert.deepEqual(state.protectedFunds.map(x => x.amount), ['1000000', '5000000']);
  assert.equal(first.result.financial.version, 2);
  assert.equal(f.journal.events().filter(x => x.type === 'sale.confirmed').length, 1);
  await assert.rejects(apply(treasury, 'altered-receipt', { ...allocationPlan, treasury: usd('3999999') }), { code: 'CONFLICT' });
  await f.restart();
  assert.equal(f.treasury.getObligation('obligation:one').recipient, 'contributor.fixture');
});

test('stale snapshots, policy epochs and denied decisions cannot write financial facts', async t => {
  const { treasury } = await fixture(t, { getPolicyState: () => ({ policyEpoch: 1 }) });
  const stale = approve(treasury, { id: 'stale' }, fundingReservation);
  await apply(treasury, 'bootstrap', bootstrapPlan);
  await assert.rejects(treasury.applyDecision({ actionId: 'stale', decision: stale, expectedVersion: treasury.snapshot().version }), { code: 'CONFLICT' });
  const fresh = approve(treasury, { id: 'denied' }, fundingReservation);
  for (const status of ['hold', 'deny']) await assert.rejects(treasury.applyDecision({ actionId: status, decision: { ...fresh, status } }), { code: 'POLICY_BLOCK' });
  await assert.rejects(treasury.applyDecision({ actionId: 'epoch', decision: { ...fresh, policyEpoch: 0 } }), { code: 'CONFLICT' });
  assert.equal(treasury.snapshot().reservations.length, 0);
});

test('cash-to-credit purchase and inference expense remain separate exact facts', async t => {
  const { treasury, journal } = await fixture(t);
  await apply(treasury, 'bootstrap', bootstrapPlan);
  await apply(treasury, 'allocate', allocationPlan);
  await apply(treasury, 'reserve-funding', fundingReservation);
  await apply(treasury, 'funding-record', fundingPlan);
  assert.equal(treasury.snapshot().dailyCosts['2026-11-11'] ?? '0', '0');
  assert.equal(treasury.snapshot().credits.availableNanoUsd, '1000000000');
  assert.equal(treasury.snapshot().balances[0].amount, '104000000');
  await apply(treasury, 'reserve-inference', inferenceReservation);
  await apply(treasury, 'consumption-record', consumptionPlan);
  const state = treasury.snapshot();
  assert.equal(state.dailyCosts['2026-11-11'], '100000000');
  assert.equal(state.credits.availableNanoUsd, '900000000');
  assert.equal(state.balances[0].amount, '104000000');
  assert.equal(state.reservations.find(x => x.id === 'reservation:inference').status, 'reconciled');
  const funding = journal.events().find(x => x.type === 'funding.confirmed').data;
  assert.equal(funding.expenseCategory, 'cash_to_credit'); assert.equal(funding.costNanoUsd, undefined);
  assert.equal(journal.events().find(x => x.type === 'inference.consumed').data.costNanoUsd, '100000000');
});

test('unknown reservations survive restart and UTC rollover with original accounting day', async t => {
  let now = new Date('2026-11-11T23:59:59Z');
  const f = await fixture(t, { clock: () => now });
  await apply(f.treasury, 'reserve', inferenceReservation);
  await apply(f.treasury, 'unknown', { kind: 'reconciliation', reservationId: 'reservation:inference', status: 'unknown' });
  now = new Date('2026-11-12T00:00:01Z');
  await f.restart();
  const state = f.treasury.snapshot();
  assert.equal(state.dailyCosts['2026-11-12'], '0');
  assert.equal(state.reservations[0].status, 'unknown');
  assert.equal(state.reservations[0].accountingDay, '2026-11-11');
  assert.equal(state.reservations[0].upperBoundNanoUsd, '200000000');
});

test('malformed approved funding cannot consume protected contributor cash', async t => {
  const { treasury } = await fixture(t);
  await apply(treasury, 'sale', { ...allocationPlan, refundReserve: usd('0') });
  const before = treasury.snapshot();
  const overspend = { ...fundingPlan, reservationId: undefined, cashSpent: usd('5000000') };
  await assert.rejects(apply(treasury, 'bad-funding', overspend), { code: 'CONFLICT' });
  await assert.rejects(apply(treasury, 'bad-reservation', { ...fundingReservation, reservation: { ...fundingReservation.reservation, resource: usd('5000000') } }), { code: 'CONFLICT' });
  assert.deepEqual(treasury.snapshot(), before);
});

test('permit consumption binds the latest exact plan and is versioned without blanket stale override', async t => {
  const { treasury } = await fixture(t);
  const action = { id: 'inference:one' };
  const decision = approve(treasury, action, inferenceReservation);
  await treasury.applyDecision({ actionId: action.id, decision });
  await assert.rejects(treasury.consumePermit({ actionId: action.id, permit: decision.permit, decision }), { code: 'CONFLICT' });
  const validated = { ...decision, financialVersion: 1 };
  const consumed = await treasury.consumePermit({ actionId: action.id, permit: decision.permit, decision: validated });
  assert.equal(consumed.result.financial.version, 2);
  const proof = treasury.snapshot().consumedPermits[0];
  assert.equal(proof.authorizedFinancialVersion, 0); assert.equal(proof.financialVersion, 2);
  assert.equal((await treasury.consumePermit({ actionId: action.id, permit: decision.permit, decision: validated })).replayed, true);
  assert.equal(treasury.snapshot().consumedPermits.length, 1);
});

test('confirmed refund releases exact reserves and reverses unpaid due only once', async t => {
  const { treasury, journal } = await fixture(t);
  await apply(treasury, 'bootstrap', bootstrapPlan); await apply(treasury, 'allocate', allocationPlan);
  const intent = { kind: 'refund_intent', orderId: 'order:one', recipient: 'customer.fixture', money: usd('5000000') };
  await apply(treasury, 'refund:one', intent);
  assert.equal(treasury.getObligation('obligation:one').status, 'due');
  const plan = { kind: 'refund', receiptId: 'refund:receipt:one', orderId: 'order:one', recipient: 'customer.fixture', money: usd('5000000'), status: 'confirmed', releaseProtected: [{ id: 'contributor:obligation:one', money: usd('1000000') }, { id: 'refund:order:one', money: usd('5000000') }], obligations: [{ id: 'obligation:one', status: 'reversed', completedAmount: '0', remainingDue: usd('0') }], refundExposure: usd('0'), clawbackContributor: false };
  await apply(treasury, 'refund-record', plan);
  await treasury.applyDecision({ actionId: 'duplicate-refund', decision: approve(treasury, { id: 'duplicate-refund' }, plan) });
  assert.equal(treasury.snapshot().balances[0].amount, '100000000');
  assert.equal(treasury.getObligation('obligation:one').status, 'reversed');
  assert.equal(treasury.snapshot().protectedFunds.every(x => x.amount === '0'), true);
  assert.equal(journal.events().filter(x => x.type === 'refund.confirmed').length, 1);
  const mutated = { ...plan, receiptId: 'refund:bad', obligations: [{ ...plan.obligations[0], completedAmount: '1' }] };
  await assert.rejects(apply(treasury, 'refund-invalid', mutated), { code: 'CONFLICT' });
});

test('refund after confirmed contribution preserves the paid amount without a clawback', async t => {
  const { treasury } = await fixture(t);
  await apply(treasury, 'bootstrap', bootstrapPlan); await apply(treasury, 'allocate', allocationPlan);
  await treasury.applyDecision({ actionId: payoutAction.id, decision: approve(treasury, payoutAction, payoutPlan) });
  await treasury.recordPayoutResult({ actionId: payoutAction.id, result: { status: 'confirmed', mode: 'fixture' } });
  const refund = { kind: 'refund', receiptId: 'refund:paid', orderId: 'order:one', recipient: 'customer.fixture', money: usd('5000000'), status: 'confirmed', releaseProtected: [{ id: 'refund:order:one', money: usd('5000000') }, { id: 'contributor:obligation:one', money: usd('0') }], obligations: [{ id: 'obligation:one', status: 'paid_before_refund', completedAmount: '1000000', remainingDue: usd('0') }], refundExposure: usd('0'), clawbackContributor: false };
  await apply(treasury, 'refund-record', refund);
  const obligation = treasury.getObligation('obligation:one');
  assert.equal(obligation.status, 'paid_before_refund'); assert.equal(obligation.completedAmount, '1000000');
  assert.equal(treasury.snapshot().balances[0].amount, '99000000');
});

test('late receipt records incoming cash and refund reserve once without a sale or obligation', async t => {
  const { treasury, journal } = await fixture(t);
  const late = { kind: 'late_payment', receiptId: 'late:receipt', orderId: 'late:order', revenue: usd('5000000'), refundReserve: usd('5000000'), refundExposure: usd('5000000'), mode: 'fixture' };
  await apply(treasury, 'late-record', late);
  await apply(treasury, 'late-duplicate', late);
  assert.equal(treasury.snapshot().balances[0].amount, '5000000');
  assert.equal(treasury.snapshot().protectedFunds[0].amount, '5000000');
  assert.equal(treasury.snapshot().obligations.length, 0); assert.equal(treasury.snapshot().allocations.length, 0);
  assert.equal(journal.events().filter(x => x.type === 'sale.confirmed').length, 0);
  assert.equal(journal.events().filter(x => x.type === 'payment.late').length, 1);
  await assert.rejects(apply(treasury, 'wrong-allocate', { ...allocationPlan, settlementId: late.receiptId }), { code: 'CONFLICT' });
  await apply(treasury, 'late-refund-intent', { kind: 'refund_intent', orderId: late.orderId, recipient: 'customer.fixture', money: usd('5000000') });
  await apply(treasury, 'late-refund', { kind: 'refund', receiptId: 'late:refund', orderId: late.orderId, recipient: 'customer.fixture', money: usd('5000000'), status: 'confirmed', releaseProtected: [{ id: 'refund:late:order', money: usd('5000000') }], obligations: [], refundExposure: usd('0'), clawbackContributor: false });
  assert.equal(treasury.snapshot().balances[0].amount, '0');
  assert.equal(treasury.snapshot().latePayments[0].status, 'refunded');
});
