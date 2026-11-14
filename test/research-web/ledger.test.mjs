import test from 'node:test';
import assert from 'node:assert/strict';
import { projectLedger, createLedger } from '../../src/ledger/index.mjs';
import { createRules } from '../../src/rules/index.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const money = (amount, asset = 'usdc', network = 'fixture') => ({ amount, asset, network, decimals: 6 });
const plan = { eventFields: ['id','sequence','type','at'], publicFields: ['id','sequence','type','at','category','status','mode','money','costNanoUsd','costStatus','expenseCategory','creditNanoUsd','obligationId','evidenceRef','reversesId','reservationId','upperBoundNanoUsd','actionId'], financialFields: [] };
const event = (sequence, type, data) => ({ sequence, type, at: '2026-11-11T00:00:00Z', data: { id: `e${sequence}`, mode: 'fixture', ...data } });
const events = [
  event(1, 'sale.confirmed', { money: money('5000000'), question: 'PRIVATE QUESTION', accessToken: 'SECRET', report: '<script>secret()</script>' }),
  event(2, 'obligation.due', { money: money('1000000'), obligationId: 'o1' }),
  event(3, 'funding.confirmed', { money: money('1000000'), costNanoUsd: '1000000000', expenseCategory: 'cash_to_credit', creditNanoUsd: '1000000000' }),
  event(4, 'inference.consumed', { costNanoUsd: '100000000', expenseCategory: 'inference', costStatus: 'actual' }),
  event(5, 'payout.unknown', { money: money('1000000'), obligationId: 'o1' }),
  event(6, 'fee.recorded', { money: money('10', 'near'), costNanoUsd: '1000', costStatus: 'pending', status: 'provisional' }),
  event(7, 'sale.confirmed', { money: money('999999999999999999999999999', 'usdc', 'other-network') }),
  event(8, 'refund.confirmed', { money: money('5000000') }),
  event(9, 'accounting.correction', { money: money('1000000'), reversesId: 'e2' }),
];

test('rebuild sums exact recorded categories per asset; funding is distinct from usage expense', () => {
  const first = projectLedger(events, plan), replay = projectLedger([...events], plan);
  assert.deepEqual(first, replay);
  assert.equal(first.entries.length, 9);
  const stable = first.totals.find(t => t.asset === 'usdc' && t.network === 'fixture');
  assert.equal(stable.amounts['sale:confirmed'], '5000000'); assert.equal(stable.amounts['obligation:due'], '1000000');
  assert.equal(stable.amounts['payout:unknown'], '1000000'); assert.equal(stable.amounts['payout:confirmed'], undefined);
  assert.equal(first.costs['funding:confirmed'], '1000000000'); assert.equal(first.costs['consumption:actual'], '100000000');
  assert.equal(first.reconciliation, 'unresolved');
  assert.equal(first.totals.find(t => t.network === 'other-network').amounts['sale:confirmed'], '999999999999999999999999999');
  assert.equal(first.totals.filter(t => t.asset === 'near').length, 1);
});

test('late facts append transparently and repeated observations do not count twice', () => {
  const duplicate = { ...events[0], sequence: 10 };
  const confirmed = event(11, 'payout.confirmed', { money: money('1000000'), obligationId: 'o1' });
  const result = projectLedger([...events, duplicate, confirmed], plan);
  assert.equal(result.entries.length, 10); assert.equal(result.checkpoint, 11);
  assert.equal(result.totals.find(t => t.asset === 'usdc' && t.network === 'fixture').amounts['payout:confirmed'], '1000000');
  assert.throws(() => projectLedger([...events, { ...duplicate, data: { ...duplicate.data, money: money('1') } }], plan), { code: 'CONFLICT' });
});

test('only disclosed typed facts appear publicly and hidden money cannot leak through totals', () => {
  const result = projectLedger(events, plan);
  for (const secret of ['PRIVATE QUESTION', 'SECRET', '<script>', 'accessToken']) assert.equal(JSON.stringify(result).includes(secret), false);
  const hidden = projectLedger(events, { publicFields: ['type', 'category', 'status'], eventFields: ['type'], financialFields: [] });
  assert.deepEqual(hidden.totals, []); assert.deepEqual(hidden.costs, {});
  const denied = projectLedger(events, { status: 'deny', plan });
  assert.deepEqual(denied.entries, []); assert.deepEqual(denied.totals, []);
  assert.equal(projectLedger(events, undefined).disclosureStatus, 'unavailable');
});

test('wrapper obtains disclosure decision from Rules with a stable action identity', async () => {
  let action;
  const ledger = createLedger({ journal: { events: () => events }, rules: { evaluate: input => { action = input; return { status: 'allow', plan }; } } });
  assert.equal((await ledger.view()).entries.length, 9); assert.equal(action.type, 'disclosure'); assert.ok(action.id);
});

test('unknown spend remains reserved; later evidence resolves state without deleting history', () => {
  const records = [
    event(1, 'reservation.recorded', { reservationId: 'r1', status: 'reserved', upperBoundNanoUsd: '100' }),
    event(2, 'reservation.updated', { reservationId: 'r1', status: 'unknown' }),
    event(3, 'payout.unknown', { obligationId: 'o1', money: money('100') }),
  ];
  const unknown = projectLedger(records, plan);
  assert.equal(unknown.reconciliation, 'unresolved'); assert.deepEqual(unknown.costs, {});
  const resolved = projectLedger([...records,
    event(4, 'inference.consumed', { reservationId: 'r1', costNanoUsd: '50', status: 'confirmed' }),
    event(5, 'payout.confirmed', { obligationId: 'o1', money: money('100') }),
  ], plan);
  assert.equal(resolved.reconciliation, 'recorded'); assert.equal(resolved.entries.length, 5);
  assert.equal(resolved.costs['consumption:confirmed'], '50');
});

test('seed and late settlement receipts are separate from approved sales', () => {
  const result = projectLedger([event(1, 'fixture.bootstrap', { money: money('1000') }), event(2, 'payment.late', { money: money('500'), status: 'confirmed' })], plan);
  assert.equal(result.totals[0].amounts['seed:confirmed'], '1000');
  assert.equal(result.totals[0].amounts['late_payment:confirmed'], '500');
  assert.equal(result.totals[0].amounts['sale:confirmed'], undefined);
});

test('M01 malformed hot reload forwards only its approved degraded ledger metadata', async () => {
  const accepted = createRules({ configPath: new URL('../../config.yaml', import.meta.url) }).snapshot().config;
  const directory = await mkdtemp(join(tmpdir(), 'research-ledger-reload-'));
  const configPath = join(directory, 'config.yaml');
  try {
    await writeFile(configPath, JSON.stringify(accepted));
    const rules = createRules({ configPath });
    const readPolicyVersion = rules.snapshot().policyVersion;
    assert.equal(rules.snapshot().valid, true);
    const ledger = createLedger({ rules, journal: { events: () => events } });
    const normal = await ledger.view();
    assert.equal(normal.degraded, undefined);
    await writeFile(configPath, 'pricing: [malformed');
    const degraded = await ledger.view();
    assert.equal(degraded.disclosureStatus, 'approved');
    assert.equal(degraded.degraded, true);
    assert.equal(degraded.currentSafetyValid, false);
    assert.equal(degraded.businessEffectsAllowed, false);
    assert.equal(degraded.readPolicyVersion, readPolicyVersion);
    assert.deepEqual(degraded.entries, normal.entries);
    assert.equal(JSON.stringify(degraded).includes('PRIVATE QUESTION'), false);
    const decision = rules.evaluate({ type: 'disclosure', id: 'read-degraded' });
    const fromPlan = projectLedger(events, decision.plan);
    assert.equal(fromPlan.degraded, true);
    assert.equal(fromPlan.currentSafetyValid, false);
    assert.equal(fromPlan.readPolicyVersion, readPolicyVersion);
    assert.equal(fromPlan.businessEffectsAllowed, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
