import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJournal } from '../../src/journal/index.mjs';
import { createTreasury } from '../../src/treasury/index.mjs';
import { createRules } from '../../src/rules/index.mjs';
import { NOW, config, financial, order, inference, cash, reportFacts } from './fixtures.mjs';

test('actual Treasury persisted plan + consumption roundtrip reaches one Rules-approved callback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'near-rules-roundtrip-'));
  const journal = await createJournal({ directory });
  try {
    const rules = createRules({ config: config(), clock: () => NOW });
    const treasury = createTreasury({ journal, clock: () => NOW, getPolicyState: () => rules.snapshot() });
    const seedAction = { id: 'bootstrap', type: 'bootstrap', mode: 'fixture' };
    const seed = rules.evaluate(seedAction, { financial: treasury.snapshot() });
    assert.equal(seed.status, 'allow');
    await treasury.applyDecision({ actionId: seedAction.id, decision: seed });
    const facts = { order: order(), financial: treasury.snapshot() };
    const next = rules.evaluate({ id: 'next', type: 'next', mode: 'fixture' }, { ...facts, order: { ...order(), creditReady: false } });
    const action = next.action;
    const decision = rules.evaluate(action, facts);
    assert.equal(decision.status, 'allow');
    await treasury.applyDecision({ actionId: action.id, decision });
    let fresh = { ...facts, action, financial: treasury.snapshot() };
    const pre = rules.validateDispatch(decision.permit, fresh);
    assert.equal(pre.status, 'allow');
    await treasury.consumePermit({ actionId: action.id, permit: decision.permit, decision: pre });
    fresh = { ...fresh, financial: treasury.snapshot() };
    let callbacks = 0;
    assert.equal(rules.dispatch(decision.permit, fresh, () => ++callbacks).status, 'allow');
    assert.equal(callbacks, 1);
    assert.equal(rules.dispatch(decision.permit, fresh, () => ++callbacks).reasonCode, 'PERMIT_CONSUMED');
    assert.equal(callbacks, 1);
    // Reservation survives a real close/reopen and has not become spendable cash.
    await journal.close();
    const reopened = await createJournal({ directory });
    try {
      const resumed = createTreasury({ journal: reopened, clock: () => NOW });
      assert.equal(resumed.snapshot().reservations[0].upperBoundNanoUsd, action.maxCostNanoUsd);
      assert.equal(resumed.snapshot().consumedPermits.length, 1);
      assert.equal(createRules({ config: config(), clock: () => NOW }).validateDispatch(decision.permit, { ...fresh, financial: resumed.snapshot() }).reasonCode, 'UNTRUSTED_PERMIT');
    } finally { await reopened.close(); }
  } finally { await journal.close(); await rm(directory, { recursive: true, force: true }); }
});

test('a second authorization from the same financial version cannot both reach dispatch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'near-rules-race-'));
  const journal = await createJournal({ directory });
  try {
    const state = financial(); state.version = 0;
    await journal.transaction({ actionId: 'facts', fingerprint: 'facts' }, tx => tx.put('treasury', 'financial', state));
    const treasury = createTreasury({ journal, clock: () => NOW });
    const rules = createRules({ config: config(), clock: () => NOW });
    const f = { order: order(), financial: treasury.snapshot() }, a = inference(), b = { ...a, id: 'second' };
    const one = rules.evaluate(a, f), two = rules.evaluate(b, f);
    assert.equal(one.status, 'allow'); assert.equal(two.status, 'allow');
    await treasury.applyDecision({ actionId: a.id, decision: one });
    await assert.rejects(treasury.applyDecision({ actionId: b.id, decision: two }), error => error.code === 'CONFLICT');
    assert.equal(rules.validateDispatch(two.permit, { ...f, financial: treasury.snapshot(), action: b }).reasonCode, 'PERSISTED_PLAN_REQUIRED');
  } finally { await journal.close(); await rm(directory, { recursive: true, force: true }); }
});

for (const late of [false, true]) test(`${late ? 'late receipt' : 'rejected report'} uses exact Rules refund plans through actual Treasury`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'near-rules-refund-'));
  const journal = await createJournal({ directory });
  try {
    const rules = createRules({ config: config(), clock: () => NOW });
    const treasury = createTreasury({ journal, clock: () => NOW, getPolicyState: () => rules.snapshot() });
    await treasury.applyDecision({ actionId: 'bootstrap', decision: rules.evaluate({ id: 'bootstrap', type: 'bootstrap', mode: 'fixture' }, { financial: treasury.snapshot() }) });
    let o = { ...order(), allocated: false, reportAccepted: false, reportAvailable: false, payoutConfirmed: false };
    const terms = rules.evaluate({ id: 'offer', type: 'offer', orderId: o.id, mode: 'fixture' }, { activeOrderCount: 0 }).offer;
    const payment = { id: `payment:${late}`, status: 'confirmed', verified: true, money: cash('5000000'), recipient: terms.treasuryAccount, settledAt: new Date(NOW).toISOString(), withinInvoiceWindow: !late, mode: 'fixture' };
    const facts = extra => ({ order: o, offer: terms, payment, financial: treasury.snapshot(), ...extra });
    const record = rules.evaluate({ id: late ? 'late' : 'allocate', type: late ? 'late_payment' : 'allocate', orderId: o.id, mode: 'fixture' }, facts());
    assert.equal(record.status, 'allow');
    await treasury.applyDecision({ actionId: late ? 'late' : 'allocate', decision: record });
    if (late) o = { ...o, ...record.plan.orderPatch };
    else {
      const rejected = rules.evaluate({ id: 'report', type: 'report', orderId: o.id, mode: 'fixture' }, facts({ report: { ...reportFacts(), hasUncertainty: false } }));
      assert.equal(rejected.status, 'hold'); o = { ...o, ...rejected.plan.orderPatch };
    }
    assert.equal(treasury.snapshot().obligations.length, late ? 0 : 1);
    const action = { id: 'refund', type: 'refund', orderId: o.id, mode: 'fixture', recipient: o.refundRecipient, money: payment.money };
    const refund = rules.evaluate(action, facts());
    assert.equal(refund.status, 'allow');
    await treasury.applyDecision({ actionId: action.id, decision: refund });
    const pre = rules.validateDispatch(refund.permit, facts({ action }));
    assert.equal(pre.status, 'allow');
    await treasury.consumePermit({ actionId: action.id, permit: refund.permit, decision: pre });
    const confirmed = { status: 'confirmed', mode: 'fixture', providerRequestId: `refunded:${late}`, receipt: { id: `refund-receipt:${late}`, recipient: o.refundRecipient, money: payment.money, status: 'confirmed' } };
    let calls = 0;
    assert.equal(rules.dispatch(refund.permit, facts({ action }), () => { calls++; return confirmed; }).status, 'allow');
    assert.equal(calls, 1);
    const reversal = rules.evaluate({ id: 'refund-record', type: 'refund_record', orderId: o.id, mode: 'fixture' }, facts({ result: confirmed }));
    assert.equal(reversal.status, 'allow');
    await treasury.applyDecision({ actionId: 'refund-record', decision: reversal });
    const final = treasury.snapshot();
    assert.equal(final.balances[0].amount, '100000000');
    assert.ok(final.protectedFunds.every(x => x.amount === '0'));
    if (!late) assert.equal(final.obligations[0].status, 'reversed');
    assert.equal(final.refunds[0].status, 'confirmed');
  } finally { await journal.close(); await rm(directory, { recursive: true, force: true }); }
});
