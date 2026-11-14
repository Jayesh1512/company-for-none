import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRules, validateConfig, calculateSplit, parseConfigYaml } from '../../src/rules/index.mjs';
import { fingerprint } from '../../src/contracts.mjs';
import { NOW, config, cash, financial, order, inference, reportFacts, evidencePack, persisted } from './fixtures.mjs';

const rules = (c = config(), clock = () => NOW) => createRules({ config: c, clock });
const act = (type, extra = {}) => ({ id: `o1:${type}`, type, orderId: 'o1', mode: 'fixture', ...extra });
const facts = extra => ({ financial: financial(), order: order(), ...extra });
const offer = engine => engine.evaluate(act('offer'), { activeOrderCount: 0 }).offer;
const payment = terms => ({ id: 'settlement1', verified: true, status: 'confirmed', money: cash('5000000'), recipient: terms.treasuryAccount, settledAt: new Date(NOW).toISOString(), withinInvoiceWindow: true });

test('demonstration config validates, is immutable, and missing/invalid config fails closed', () => {
  const parsed = config(); const checked = validateConfig(parsed);
  parsed.revenue.contributors[0].bps = 9000;
  assert.equal(checked.revenue.contributors[0].bps, 2000);
  assert.ok(Object.isFrozen(checked.research));
  for (const mutate of [c => delete c.pricing, c => c.revenue.treasuryBps++, c => c.pricing.minimumAtomic = 5, c => c.spending.maxRequestNanoUsd = '-1', c => c.settlementAsset.decimals = 2.1, c => c.secret = 'not-allowed', c => c.access.publicLedger = 'true', c => c.customerAssets.push(c.customerAssets[0]), c => c.revenue.contributors[0].bps = 0, c => c.liveAuthorized = true]) {
    const c = config(); mutate(c); const engine = rules(c);
    assert.equal(engine.snapshot().valid, false);
    assert.equal(engine.evaluate(act('offer')).reasonCode, 'INVALID_CONFIG');
  }
  assert.equal(createRules().evaluate(act('offer')).status, 'deny');
});

test('YAML parser rejects duplicate keys, aliases and unsupported schema without spending', () => {
  assert.throws(() => parseConfigYaml('mode: fixture\nmode: live\n'));
  assert.throws(() => parseConfigYaml('a: &a [one]\nb: *a\n'));
  const c = config(); c.schemaVersion = 2;
  assert.throws(() => validateConfig(c));
});

test('price floor is exact at boundary; two source assets supported; active order rule centralized', () => {
  const engine = rules();
  assert.equal(engine.evaluate(act('offer', { money: cash('4999999') }), { activeOrderCount: 0 }).reasonCode, 'PRICE_BELOW_FLOOR');
  assert.equal(engine.evaluate(act('offer', { money: cash('5000000') }), { activeOrderCount: 0 }).status, 'allow');
  for (const sourceAsset of config().customerAssets) assert.equal(engine.evaluate(act('offer', { sourceAsset }), { activeOrderCount: 0 }).status, 'allow');
  assert.equal(engine.evaluate(act('offer', { sourceAsset: { network: 'wrong', asset: 'demo-usdc', decimals: 6 } }), { activeOrderCount: 0 }).reasonCode, 'UNSUPPORTED_ASSET');
  assert.equal(engine.evaluate(act('offer'), { activeOrderCount: 1 }).reasonCode, 'ACTIVE_ORDER_LIMIT');
  assert.equal(engine.evaluate(act('offer')).reasonCode, 'ACTIVE_ORDER_FACTS_REQUIRED');
});

test('basis-point splits round contributor down and conserve even huge atomic amounts', () => {
  const terms = offer(rules());
  const five = calculateSplit(cash('5000000'), terms);
  assert.equal(five.contributors[0].money.amount, '1000000');
  assert.equal(five.treasury.amount, '4000000');
  const odd = calculateSplit(cash('7'), terms);
  assert.equal(odd.contributors[0].money.amount, '1');
  assert.equal(odd.treasury.amount, '6');
  const huge = '999999999999999999999999999999';
  const split = calculateSplit(cash(huge), terms);
  assert.equal(BigInt(split.treasury.amount) + BigInt(split.contributors[0].money.amount), BigInt(huge));
  assert.throws(() => calculateSplit({ ...cash('1'), network: 'testnet' }, terms));
  const c = config(); c.revenue = { contributors: [{ account: 'a', bps: 3333 }, { account: 'b', bps: 3333 }], treasuryBps: 3334 };
  const multi = calculateSplit(cash('11'), offer(rules(c)));
  assert.deepEqual(multi.contributors.map(x => x.money.amount), ['3', '3']);
  assert.equal(multi.treasury.amount, '5');
});

test('change ONLY config changes new pricing/split/cap while old offer and recipient stay frozen', () => {
  const engine = rules(), old = offer(engine);
  const c = config(); c.pricing.minimumAtomic = '9000000'; c.revenue.contributors = [{ account: 'new-recipient', bps: 3000 }]; c.revenue.treasuryBps = 7000; c.spending.dailyInferenceCapNanoUsd = '100000000';
  engine.updateConfig(c);
  const fresh = offer(engine);
  assert.equal(fresh.price.amount, '9000000'); assert.equal(fresh.contributors[0].account, 'new-recipient');
  assert.equal(calculateSplit(cash('5000000'), old).contributors[0].recipient, 'fixture-contributor');
  assert.equal(calculateSplit(cash('5000000'), old).contributors[0].money.amount, '1000000');
  const state = financial(); state.dailyCosts['2026-11-11'] = '1';
  assert.equal(engine.evaluate(inference(), facts({ financial: state, offer: old })).reasonCode, 'DAILY_CAP_EXCEEDED');
  assert.notEqual(fresh.policyVersion, old.policyVersion);
});

test('settlement policies reject wrong/underpaid/unverified, hold unknown/late, and freeze old price', () => {
  const engine = rules(), terms = offer(engine), paid = payment(terms);
  const state = facts({ offer: terms, payment: paid, order: { ...order(), allocated: false } });
  assert.equal(engine.evaluate(act('settlement'), state).status, 'allow');
  for (const [patch, code] of [[{ money: cash('4999999') }, 'UNDERPAID'], [{ recipient: 'attacker' }, 'SETTLEMENT_MISMATCH'], [{ verified: false }, 'UNVERIFIED_PAYMENT'], [{ status: 'unknown' }, 'PAYMENT_UNRESOLVED'], [{ withinInvoiceWindow: false }, 'LATE_PAYMENT_REMEDY']]) assert.equal(engine.evaluate(act('settlement'), facts({ offer: terms, payment: { ...paid, ...patch } })).reasonCode, code);
  const c = config(); c.pricing.minimumAtomic = '10000000'; engine.updateConfig(c);
  assert.equal(engine.evaluate(act('settlement'), state).status, 'allow');
});

test('allocation computes exact disjoint funded reserves or holds without refund backing', () => {
  const engine = rules(), terms = offer(engine), paid = payment(terms), o = { ...order(), allocated: false };
  const decision = engine.evaluate(act('allocate'), facts({ offer: terms, payment: paid, order: o }));
  assert.equal(decision.status, 'allow');
  assert.equal(decision.plan.kind, 'allocation');
  assert.equal(decision.plan.contributorReserve.amount, '1000000');
  assert.equal(decision.plan.refundReserve.amount, '5000000');
  assert.equal(decision.plan.refundExposure.amount, '5000000');
  const state = financial(); state.balances = [];
  assert.equal(engine.evaluate(act('allocate'), facts({ financial: state, order: o, offer: terms, payment: paid })).reasonCode, 'REFUND_RESERVE_UNFUNDED');
});

test('daily cap counts actual + all still held upper bounds; exact edge allows', () => {
  const engine = rules(), state = financial();
  state.dailyCosts['2026-11-11'] = '800000000';
  state.reservations.push({ id: 'older', actionId: 'old', purpose: 'inference', accountingDay: '2026-11-10', status: 'pending', upperBoundNanoUsd: '100000000' });
  assert.equal(engine.evaluate(inference(), facts({ financial: state })).status, 'allow');
  state.dailyCosts['2026-11-11'] = '800000001';
  assert.equal(engine.evaluate(inference(), facts({ financial: state })).reasonCode, 'DAILY_CAP_EXCEEDED');
  state.dailyCosts['2026-11-11'] = '0'; state.reservations[0].status = 'unknown';
  assert.equal(engine.evaluate(inference(), facts({ financial: state })).reasonCode, 'UNRESOLVED_SPEND');
  assert.equal(engine.evaluate(inference(), facts({ financial: state, operation: { status: 'unknown' } })).reasonCode, 'EXTERNAL_OUTCOME_UNRESOLVED');
});

test('affordability, bounded inputs and resource restrictions all return structured policy decisions', () => {
  const engine = rules(), state = financial(); state.credits.availableNanoUsd = '99999999';
  assert.equal(engine.evaluate(inference(), facts({ financial: state })).reasonCode, 'INSUFFICIENT_CREDIT');
  assert.equal(engine.evaluate({ ...inference(), maxCostNanoUsd: undefined }, facts()).reasonCode, 'COST_BOUND_UNKNOWN');
  assert.equal(engine.evaluate({ ...inference(), maxCostNanoUsd: '100000001' }, facts()).reasonCode, 'REQUEST_CAP_EXCEEDED');
  assert.equal(engine.evaluate({ ...inference(), bounds: { inputTokens: 10001, outputTokens: 1, reasoningTokens: 0 } }, facts()).reasonCode, 'TOKEN_BOUND_EXCEEDED');
  const funding = act('funding', { agentId: 'fixture-treasury', recipient: 'fixture-cloud', money: cash('100000'), maxCostNanoUsd: '100000000', requiredCreditNanoUsd: '100000000' });
  assert.equal(engine.evaluate(funding, facts()).status, 'allow');
  assert.equal(engine.evaluate({ ...funding, recipient: 'attacker' }, facts()).reasonCode, 'RECIPIENT_NOT_ALLOWED');
  state.protectedFunds = [cash('99999999')];
  assert.equal(engine.evaluate(funding, facts({ financial: state })).reasonCode, 'INSUFFICIENT_FUNDS');
});

test('permits bind shared fingerprint, policy/financial/order versions, exact plan and consumption proof', () => {
  const engine = rules(), a = inference(), f = facts(), decision = engine.evaluate(a, f);
  assert.equal(decision.actionFingerprint, fingerprint(a));
  assert.equal(engine.validateDispatch(decision.permit, { ...f, action: a }).reasonCode, 'PERSISTED_PLAN_REQUIRED');
  const applied = persisted(decision, f.financial, false);
  const pre = engine.validateDispatch(decision.permit, { ...f, financial: applied, action: a });
  assert.equal(pre.status, 'allow'); assert.equal(pre.financialVersion, applied.version);
  assert.equal(engine.dispatch(decision.permit, { ...f, financial: applied, action: a }, () => assert.fail('not consumed')).reasonCode, 'PERMIT_CONSUMPTION_REQUIRED');
  const ready = persisted(decision, f.financial);
  assert.equal(engine.validateDispatch(decision.permit, { ...f, financial: ready, action: { ...a, maxCostNanoUsd: '1' } }).reasonCode, 'ACTION_MISMATCH');
  assert.equal(engine.validateDispatch(decision.permit, { ...f, financial: { ...ready, version: ready.version + 1 }, action: a }).reasonCode, 'STALE_FINANCIAL_STATE');
  assert.equal(engine.validateDispatch(decision.permit, { ...f, financial: ready, action: a, order: { ...f.order, version: 2 } }).reasonCode, 'STALE_ORDER_STATE');
  let calls = 0;
  assert.equal(engine.dispatch(decision.permit, { ...f, financial: ready, action: a }, () => ++calls).status, 'allow');
  assert.equal(calls, 1);
  assert.equal(engine.dispatch(decision.permit, { ...f, financial: ready, action: a }, () => ++calls).reasonCode, 'PERMIT_CONSUMED');
  assert.equal(calls, 1);
  assert.equal(engine.validateDispatch({ ...decision.permit, recipient: 'attacker' }, { ...f, financial: ready }).reasonCode, 'UNTRUSTED_PERMIT');
  assert.equal(rules().validateDispatch(decision.permit, { ...f, financial: ready }).reasonCode, 'UNTRUSTED_PERMIT');
});

test('kill/lower cap/malformed reload deny next effect; read-only reconciliation remains allowed during kill', () => {
  for (const mutate of [c => c.killSwitch = true, c => c.spending.dailyInferenceCapNanoUsd = '100000000', c => delete c.spending]) {
    const engine = rules(), a = inference(), f = facts(), decision = engine.evaluate(a, f), c = config();
    mutate(c); engine.updateConfig(c);
    const final = engine.dispatch(decision.permit, { ...f, financial: persisted(decision, f.financial), action: a }, () => assert.fail('stale effect dispatched'));
    assert.equal(final.status, 'deny');
  }
  const c = config(); c.killSwitch = true; const engine = rules(c);
  assert.equal(engine.evaluate(act('offer')).reasonCode, 'KILL_SWITCH');
  assert.equal(engine.evaluate(act('reconcile')).status, 'allow');
  c.killSwitch = false; engine.updateConfig(c);
  assert.equal(engine.evaluate(inference(), facts()).status, 'allow');
});

test('file kill detection is under one second at the next dispatch gate, with invalid reload failing closed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'near-rules-'));
  try {
    const path = join(directory, 'rules.yaml'), source = readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8');
    writeFileSync(path, source);
    const engine = createRules({ configPath: path, clock: () => NOW }), a = inference(), f = facts(), decision = engine.evaluate(a, f);
    const started = performance.now(); writeFileSync(path, source.replace('killSwitch: false', 'killSwitch: true'));
    assert.equal(engine.dispatch(decision.permit, { ...f, financial: persisted(decision, f.financial), action: a }, () => assert.fail('kill bypass')).reasonCode, 'KILL_SWITCH');
    assert.ok(performance.now() - started < 1000);
    writeFileSync(path, 'schemaVersion: [bad');
    assert.equal(engine.evaluate(a, f).reasonCode, 'INVALID_CONFIG');
    writeFileSync(path, source);
    assert.equal(engine.evaluate(a, f).status, 'allow');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('permit expiry and ambiguous dispatch never release or reuse authorization', () => {
  let now = NOW; const engine = rules(config(), () => now), a = inference(), f = facts(), d = engine.evaluate(a, f), ready = persisted(d, f.financial);
  now += config().spending.permitTtlMs;
  assert.equal(engine.validateDispatch(d.permit, { ...f, financial: ready, action: a }).reasonCode, 'PERMIT_EXPIRED');
  now = NOW; const d2 = engine.evaluate({ ...a, id: 'second' }, f), ready2 = persisted(d2, f.financial);
  assert.throws(() => engine.dispatch(d2.permit, { ...f, financial: ready2, action: { ...a, id: 'second' } }, () => { throw new Error('lost response'); }));
  assert.equal(engine.validateDispatch(d2.permit, { ...f, financial: ready2 }).reasonCode, 'PERMIT_CONSUMED');
});

test('retry requires definitive no-effect and reconciled costs; unknown/pending never blindly repeat', () => {
  const engine = rules();
  for (const status of ['unknown', 'pending', 'failed']) assert.equal(engine.evaluate(act('retry'), { operation: { status, attempts: 1 } }).reasonCode, 'RECONCILE_REQUIRED');
  assert.equal(engine.evaluate(act('retry'), { operation: { id: 'op', status: 'not_submitted', attempts: 1 } }).status, 'allow');
  assert.equal(engine.evaluate(act('retry'), { operation: { id: 'op', status: 'failed', attempts: 1, definitiveNoEffect: true, costReconciled: true } }).status, 'allow');
  assert.equal(engine.evaluate(act('retry'), { operation: { id: 'op', status: 'not_submitted', attempts: 3 } }).reasonCode, 'RETRY_EXHAUSTED');
});

test('report acceptance consumes technical facts; config-only thresholds change decisions', () => {
  const engine = rules(), good = reportFacts();
  assert.equal(engine.evaluate(act('report'), facts({ report: good })).status, 'allow');
  for (const patch of [{ wordCount: 399 }, { citationCount: 2 }, { sourceCount: 2 }, { hasUncertainty: false }, { questionOverlapTokens: [] }, { excerptCount: 2 }, { unknownSourceReferences: ['S9'] }, { sources: [{ ...good.sources[0], paid: true }, ...good.sources.slice(1)] }, { sourceErrors: ['missing'] }]) assert.equal(engine.evaluate(act('report'), facts({ report: { ...good, ...patch } })).status, 'hold');
  const c = config(); c.research.minWords = 501; engine.updateConfig(c);
  assert.equal(engine.evaluate(act('report'), facts({ report: good })).status, 'hold');
  assert.equal(engine.evaluate(act('report'), facts({ report: { ...good, wordCount: 501 } })).status, 'allow');
  const spec = engine.evaluate(act('research'), facts()).plan.researchSpec;
  assert.equal(spec.reportRequirements.minWords, 501);
  assert.equal(spec.generationBounds.chargeBound.maxCostNanoUsd, c.spending.maxRequestNanoUsd);
});

test('access is based on verified facts; disclosure excludes private payloads and obeys config', () => {
  const engine = rules();
  assert.equal(engine.evaluate(act('access', { resource: 'report' }), facts({ access: { verified: true, customerId: 'c1' } })).status, 'allow');
  for (const access of [{ verified: false, customerId: 'c1' }, { verified: true, customerId: 'someone' }, { role: 'owner' }]) assert.equal(engine.evaluate(act('access', { resource: 'report' }), facts({ access })).status, 'deny');
  assert.equal(engine.evaluate(act('access', { resource: 'owner' }), { access: { role: 'owner', verified: true } }).status, 'allow');
  const disclosure = engine.evaluate(act('disclosure')).plan;
  for (const key of ['question', 'accessToken', 'content', 'credentials', 'evidence']) assert.ok(!disclosure.eventFields.includes(key));
  assert.ok(disclosure.eventFields.includes('expenseCategory'));
  const c = config(); c.access.publicLedger = false; engine.updateConfig(c);
  assert.equal(engine.evaluate(act('disclosure')).status, 'deny');
  assert.equal(engine.evaluate(act('access', { resource: 'ledger' })).status, 'deny');
});

test('old contributor obligation remains exact; partial payout cannot reset owed amount', () => {
  const engine = rules(), obligation = { id: 'ob1', recipient: 'old-recipient', money: cash('1000000'), completedAmount: '250000' };
  const c = config(); c.revenue.contributors[0].account = 'new-recipient'; engine.updateConfig(c);
  const f = financial(); f.protectedFunds = [{ ...cash('750000'), id: 'contributor:ob1', obligationId: 'ob1', purpose: 'contributor' }];
  const d = engine.evaluate(act('payout'), facts({ obligation, financial: f }));
  assert.equal(d.plan.money.amount, '750000'); assert.equal(d.plan.recipient, 'old-recipient');
  assert.equal(d.plan.completedAmount, '1000000');
  assert.equal(engine.evaluate(act('payout', { recipient: 'new-recipient' }), facts({ obligation })).reasonCode, 'FROZEN_OBLIGATION_MISMATCH');
  assert.equal(engine.evaluate(act('payout'), facts({ obligation, order: { ...order(), reportAvailable: false } })).status, 'hold');
});

test('refund decisions hold ambiguous effects and use exact frozen settled asset without clawback', () => {
  const engine = rules(), terms = offer(engine), paid = payment(terms), o = { ...order(), remedyRequired: true };
  const f = financial(); f.protectedFunds = [{ ...cash('5000000'), id: 'refund:o1', orderId: 'o1', purpose: 'refund' }];
  const d = engine.evaluate(act('refund'), facts({ offer: terms, payment: paid, order: o, financial: f }));
  assert.equal(d.status, 'allow'); assert.equal(d.plan.money.amount, '5000000'); assert.equal(d.plan.clawbackContributor, false);
  assert.equal(engine.evaluate(act('refund'), facts({ offer: terms, payment: paid, order: o, operation: { status: 'unknown' } })).status, 'hold');
  assert.equal(engine.evaluate(act('refund'), facts({ offer: terms, payment: paid, order: order() })).reasonCode, 'REFUND_NOT_ELIGIBLE');
});

test('Rules owns next actions, exact funding conversion, fixture bootstrap and completion requirements', () => {
  const engine = rules();
  const seed = financial(); Object.assign(seed, { version: 0, balances: [], receipts: [] });
  assert.equal(engine.evaluate(act('bootstrap'), { financial: seed }).plan.money.amount, '100000000');
  assert.equal(engine.evaluate(act('bootstrap'), facts()).reasonCode, 'ALREADY_BOOTSTRAPPED');
  const paid = order(); paid.creditReady = false; const state = financial(); state.credits.availableNanoUsd = '0';
  const next = engine.evaluate(act('next'), facts({ order: paid, financial: state }));
  assert.equal(next.nextAction, 'funding'); assert.equal(next.action.money.amount, '100000'); assert.equal(next.action.requiredCreditNanoUsd, '100000000');
  assert.equal(next.action.agentId, 'fixture-treasury'); assert.ok(next.permittedActions.includes('run'));
  assert.equal(engine.evaluate(act('next'), facts()).nextAction, 'complete');
  assert.equal(engine.evaluate(act('complete'), facts({ order: { ...order(), costReconciled: false } })).status, 'hold');
  assert.equal(engine.evaluate(act('next'), facts({ order: { ...order(), fundingOutcome: { status: 'unknown' } } })).nextAction, 'reconcile');
  assert.equal(engine.evaluate({ ...inference(), mode: 'live' }, facts()).status, 'deny');
  const c = config(); c.mode = 'live'; const live = rules(c);
  assert.equal(live.evaluate({ ...inference(), mode: 'live' }, facts()).reasonCode, 'LIVE_AUTHORIZATION_REQUIRED');
});

test('confirmed funding and actual usage produce exact bookkeeping plans, uncertain costs stay held', () => {
  const engine = rules(), state = financial();
  state.reservations = [{ id: 'reservation:fund', actionId: 'fund', purpose: 'funding', resource: cash('100000'), status: 'reserved', accountingDay: '2026-11-11', upperBoundNanoUsd: '100000000' }];
  const result = { status: 'confirmed', mode: 'fixture', provider: 'fixture-cloud', receipt: { id: 'receipt:fund', creditId: 'c2', agentId: 'fixture-treasury', cashSpent: cash('100000'), purchasedCreditNanoUsd: '100000000', availableCreditNanoUsd: '100000000', fundingOperationId: 'fund', fundingProvenance: 'agent_funded' } };
  const d = engine.evaluate(act('funding_record'), facts({ financial: state, result, reservationId: 'reservation:fund' }));
  assert.equal(d.plan.kind, 'funding'); assert.equal(d.plan.credit.availableNanoUsd, '100000000');
  state.reservations = [{ id: 'res1', actionId: 'infer', purpose: 'inference', status: 'reserved', accountingDay: '2026-11-11', upperBoundNanoUsd: '100000000' }];
  const actual = { status: 'confirmed', providerRequestId: 'req1', operation: { actionId: 'infer' }, cost: { status: 'actual', actualCostNanoUsd: '10000000' } };
  const used = engine.evaluate(act('consumption'), facts({ financial: state, result: actual, reservationId: 'res1', creditId: 'credit1' }));
  assert.equal(used.plan.remainingCreditNanoUsd, '990000000');
  assert.equal(used.plan.actualCostNanoUsd, '10000000');
  assert.equal(engine.evaluate(act('consumption'), facts({ financial: state, result: { ...actual, cost: { status: 'pending' } } })).reasonCode, 'COST_UNRECONCILED');
  const hold = engine.evaluate(act('reservation_update'), facts({ financial: state, reservationId: 'res1', result: { status: 'unknown' } }));
  assert.equal(hold.plan.status, 'unknown'); assert.equal(hold.plan.retainUpperBoundNanoUsd, '100000000');
});

test('report rejection and definitive service failure provide approved remedy patches without inventing success', () => {
  const engine = rules();
  const rejected = engine.evaluate(act('report'), facts({ report: { ...reportFacts(), wordCount: 1 } }));
  assert.equal(rejected.status, 'hold'); assert.equal(rejected.plan.orderPatch.remedyRequired, true);
  assert.equal(engine.evaluate(act('next'), facts({ order: { ...order(), ...rejected.plan.orderPatch } })).action.type, 'refund');
  const actual = { status: 'failed', cost: { status: 'actual', actualCostNanoUsd: '20' } };
  const decision = engine.evaluate(act('remedy'), facts({ result: actual }));
  assert.equal(decision.status, 'allow'); assert.equal(decision.plan.orderPatch.remedyRequired, true);
  assert.equal(engine.evaluate(act('remedy'), facts({ result: { status: 'unknown' } })).nextAction, 'reconcile');
  assert.equal(engine.evaluate(act('remedy'), facts({ result: { status: 'failed', cost: { status: 'pending' } } })).status, 'hold');
});

test('publication unknown is explicit, configurable, and missing source records never bypass acceptance', () => {
  const engine = rules(), report = reportFacts();
  report.sources = report.sources.map(x => ({ ...x, publishedAt: null, retrievedAt: '2026-10-01', date: '2026-10-01' }));
  const accepted = engine.evaluate(act('report'), facts({ report }));
  assert.equal(accepted.status, 'allow'); assert.equal(accepted.reportAcceptance.qualifications.length, 3);
  const c = config(); c.research.allowUnknownPublicationDates = false; engine.updateConfig(c);
  assert.equal(engine.evaluate(act('report'), facts({ report })).reasonCode, 'REPORT_PUBLICATION_DATE_REQUIRED');
  delete report.sources;
  assert.equal(engine.evaluate(act('report'), facts({ report })).status, 'hold');
});

test('late settlement gets exact refund-only recording and unknown refund leaves allocations intact', () => {
  const engine = rules(), terms = offer(engine), paid = { ...payment(terms), withinInvoiceWindow: false };
  const o = { ...order(), allocated: false };
  const late = engine.evaluate(act('late_payment'), facts({ offer: terms, payment: paid, order: o }));
  assert.equal(late.status, 'allow'); assert.equal(late.plan.kind, 'late_payment');
  assert.equal(late.plan.revenue.amount, '5000000'); assert.equal(late.plan.refundReserve.amount, '5000000');
  assert.equal(late.plan.obligations, undefined);
  assert.equal(engine.evaluate(act('refund_record'), facts({ order: { ...o, remedyRequired: true }, result: { status: 'unknown' } })).status, 'hold');
  const financialState = financial(); financialState.reservations = [{ id: 'res1', purpose: 'inference', actionId: 'infer', status: 'reserved', accountingDay: '2026-11-11', upperBoundNanoUsd: '1' }];
  const consumed = engine.evaluate(act('consumption'), facts({ financial: financialState, result: { status: 'failed', cost: { status: 'actual', actualCostNanoUsd: '2' } }, reservationId: 'res1', creditId: 'credit1' }));
  assert.equal(consumed.status, 'allow'); assert.equal(consumed.plan.boundExceeded, true); assert.equal(consumed.plan.orderPatch.remedyRequired, true);
});

test('insufficient/failed/unbounded evidence cannot authorize inference even with evidenceReady true', () => {
  const engine = rules();
  const cases = [
    pack => { pack.sources = []; pack.errors = [{ code: 'SOURCE_UNAVAILABLE' }]; },
    pack => { pack.sources.pop(); },
    pack => { pack.errors = [{ code: 'PARTIAL_RETRIEVAL_FAILURE' }]; },
    pack => { pack.sources[0].text = ''; },
    pack => { pack.sources[0].bytes = config().research.maxBytesPerSource + 1; },
    pack => { pack.sources[0].retrievedAt = null; },
    pack => { pack.sources[0].publishedAt = '2030-01-01'; },
    pack => { pack.sources[0].paid = true; },
    pack => { pack.sources[1].id = pack.sources[0].id; },
    pack => { pack.orderId = 'another-order'; },
  ];
  for (const mutate of cases) {
    const pack = evidencePack(); mutate(pack);
    const f = facts({ evidencePack: pack, order: { ...order(), evidenceReady: true } });
    const checked = engine.evaluate(act('evidence'), f);
    assert.equal(checked.status, 'hold'); assert.equal(checked.plan.kind, 'evidence');
    assert.equal(checked.plan.accepted, false); assert.equal(checked.plan.orderPatch.remedyRequired, true);
    assert.equal(checked.plan.nextAction, 'refund');
    const paid = engine.evaluate(inference(), f);
    assert.equal(paid.status, 'hold'); assert.equal(paid.permit, undefined); assert.equal(paid.plan.reservation, undefined);
  }
  const missing = facts({ order: { ...order(), evidenceReady: true, evidencePack: undefined } });
  assert.equal(engine.evaluate(inference(), missing).status, 'hold');
});

test('evidence gate accepts bounded explicit source dates under the same configured report policy', () => {
  const engine = rules(), pack = evidencePack();
  pack.sources = pack.sources.map(source => ({ ...source, publishedAt: null }));
  const accepted = engine.evaluate(act('evidence'), facts({ evidencePack: pack, order: { ...order(), evidenceReady: false } }));
  assert.equal(accepted.status, 'allow'); assert.equal(accepted.plan.accepted, true);
  assert.equal(accepted.plan.qualifications.length, 3);
  const strict = config(); strict.research.allowUnknownPublicationDates = false; engine.updateConfig(strict);
  assert.equal(engine.evaluate(act('evidence'), facts({ evidencePack: pack })).reasonCode, 'EVIDENCE_PUBLICATION_DATE_REQUIRED');
  const bounded = config(); bounded.research.maxInputChars = 1; engine.updateConfig(bounded);
  assert.ok(engine.evaluate(act('evidence'), facts({ evidencePack: pack })).plan.failures.includes('input_bound'));
  const more = config(); more.research.minSources = 4; engine.updateConfig(more);
  assert.ok(engine.evaluate(act('evidence'), facts({ evidencePack: pack })).plan.failures.includes('source_count'));
});

test('final inference gate rechecks evidence before dispatch as well as order readiness', () => {
  const engine = rules(), a = inference(), f = facts(), decision = engine.evaluate(a, f);
  assert.equal(decision.status, 'allow');
  const ready = persisted(decision, f.financial);
  let callbacks = 0;
  const gate = engine.dispatch(decision.permit, { ...f, action: a, financial: ready, evidencePack: { orderId: 'o1', sources: [], errors: [] } }, () => ++callbacks);
  assert.equal(gate.status, 'hold'); assert.equal(callbacks, 0);
});

test('invalid reload retains only previously accepted public ledger reads with degraded safety metadata', () => {
  const engine = rules(), acceptedVersion = engine.snapshot().policyVersion;
  const c = config(); c.pricing.minimumAtomic = 'invalid'; engine.updateConfig(c);
  assert.equal(engine.snapshot().valid, false);
  for (const action of [act('access', { resource: 'ledger' }), act('disclosure'), act('disclosure', { resource: 'ledger' })]) {
    const read = engine.evaluate(action);
    assert.equal(read.status, 'allow'); assert.equal(read.reasonCode, 'LAST_ACCEPTED_LEDGER_POLICY');
    assert.equal(read.degraded, true); assert.equal(read.currentSafetyValid, false);
    assert.equal(read.businessEffectsAllowed, false); assert.equal(read.readPolicyVersion, acceptedVersion);
    const plan = read.plan ?? read.accessPlan;
    assert.equal(plan.degraded, true); assert.equal(plan.currentSafetyValid, false);
    if (read.accessPlan) assert.deepEqual(read.accessPlan.permittedActions, []);
  }
  for (const action of [act('offer'), inference(), act('funding'), act('payout'), act('refund'), act('access', { resource: 'report' }), act('access', { resource: 'owner' }), act('access', { resource: 'storefront' }), act('disclosure', { resource: 'report' })]) {
    assert.equal(engine.evaluate(action, facts({ access: { verified: true, role: 'owner', customerId: 'c1' } })).reasonCode, 'INVALID_CONFIG');
  }
  const disabled = config(); disabled.access.publicLedger = false; const privateEngine = rules(disabled);
  const invalidGrant = config(); invalidGrant.pricing.minimumAtomic = 'invalid'; // publicLedger:true remains UNACCEPTED.
  privateEngine.updateConfig(invalidGrant);
  for (const action of [act('access', { resource: 'ledger' }), act('disclosure')]) {
    assert.equal(privateEngine.evaluate(action).status, 'deny');
    assert.equal(createRules().evaluate(action).status, 'deny');
    assert.equal(rules(invalidGrant).evaluate(action).status, 'deny');
  }
  privateEngine.updateConfig(config());
  assert.equal(privateEngine.evaluate(act('disclosure')).status, 'allow');
  assert.equal(privateEngine.evaluate(act('disclosure')).degraded, undefined);
});

test('malformed YAML hot reload leaves accepted ledger disclosure readable but denies new orders', () => {
  const directory = mkdtempSync(join(tmpdir(), 'near-rules-degraded-'));
  try {
    const path = join(directory, 'rules.yaml');
    writeFileSync(path, readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
    const engine = createRules({ configPath: path, clock: () => NOW });
    const version = engine.snapshot().policyVersion;
    writeFileSync(path, 'schemaVersion: [invalid');
    const disclosure = engine.evaluate(act('disclosure'));
    assert.equal(disclosure.status, 'allow'); assert.equal(disclosure.readPolicyVersion, version);
    assert.equal(disclosure.currentSafetyValid, false);
    assert.equal(engine.evaluate(act('access', { resource: 'ledger' })).status, 'allow');
    assert.equal(engine.evaluate(act('offer'), { activeOrderCount: 0 }).reasonCode, 'INVALID_CONFIG');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
