import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fingerprint } from '../../src/contracts.mjs';
import { createJournal } from '../../src/journal/index.mjs';
import { createTreasury } from '../../src/treasury/index.mjs';
import { createRules } from '../../src/rules/index.mjs';
import { economicSafety } from '../../src/rules/economic.mjs';
import { usd, allocationPlan, inferenceReservation, approve, apply } from './fixtures.mjs';

const cashBinding = { provider: 'isolated-custody', companyId: 'company:one', accountId: 'agent.fixture', organizationId: null, credentialId: 'credential-ref:cash', network: 'fixture', asset: 'usdc', decimals: 6, bucket: 'confidential' };
const creditBinding = { provider: 'isolated-cloud', companyId: 'company:one', accountId: 'agent.fixture', organizationId: 'cloud-org:one', credentialId: 'credential-ref:cloud', network: 'offchain', asset: 'nano-usd', decimals: 9, bucket: 'dedicated-allocation:one' };
const stamp = position => ({ stream: 'verified-test-provider-ledger', position });
const cashOpening = { kind: 'cash_opening', receiptId: 'opening:cash', binding: cashBinding, watermark: stamp('100'), money: usd('10000000'), provenance: 'dedicated-opening', evidenceRef: 'verified-opening:cash' };
const creditOpening = { kind: 'credit_opening', receiptId: 'opening:credit', binding: creditBinding, watermark: stamp('100'), credit: { id: 'credit:opening', owner: 'agent.fixture', provider: 'isolated-cloud', availableNanoUsd: '1000000000', provenance: 'dedicated-owner-prepaid' }, provenance: 'dedicated-owner-prepaid', evidenceRef: 'verified-opening:credit' };
function observation(resource, id, value, position = '101') {
  return { id, resource, binding: resource === 'cash' ? cashBinding : creditBinding, watermark: stamp(position), observedAt: '2026-11-13T00:00:00Z', evidenceRef: `provider-evidence:${id}`, ...(resource === 'cash' ? { money: usd(value) } : { availableNanoUsd: value }) };
}
function snapshotPlan(o, status, expectedAmount, unresolvedOperationIds = []) {
  return { kind: 'balance_snapshot', observation: o, reconciliation: { status, expectedAmount, observedAmount: o.resource === 'cash' ? o.money.amount : o.availableNanoUsd, unresolvedOperationIds } };
}
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'one-observations-'));
  let journal = await createJournal({ directory }); let treasury = createTreasury({ journal });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return { get journal() { return journal; }, get treasury() { return treasury; }, async restart() { await journal.close(); journal = await createJournal({ directory }); treasury = createTreasury({ journal }); } };
}

test('absolute cash snapshots under repeated/fresh IDs never create cash or opening records', async t => {
  const f = await fixture(t);
  const plan = snapshotPlan(observation('cash', 'snapshot:one', '10000000'), 'unreconciled', '0');
  await apply(f.treasury, 'observe:one', plan); await apply(f.treasury, 'observe:repeat-command', plan);
  await apply(f.treasury, 'observe:fresh-id', { ...plan, observation: { ...plan.observation, id: 'snapshot:fresh', evidenceRef: 'provider-evidence:fresh' } });
  const financial = f.treasury.snapshot();
  assert.deepEqual(financial.balances, []); assert.equal(financial.credits.availableNanoUsd, '0'); assert.deepEqual(financial.credits.lots, []);
  assert.equal(financial.openingRecords.length, 0); assert.equal(financial.economicMovements.length, 0); assert.equal(financial.providerObservations.length, 2);
  assert.equal(financial.balanceReconciliations[0].scopeId, fingerprint({ resource: 'cash', binding: cashBinding }));
  assert.equal(financial.balanceReconciliations[0].status, 'unreconciled');
  for (const event of f.journal.events()) {
    assert.equal(event.type, 'balance.observed');
    for (const field of ['money', 'binding', 'availableNanoUsd', 'expectedAmount', 'observedAmount', 'credentialId']) assert.equal(event.data[field], undefined);
  }
  await f.restart(); assert.equal(f.treasury.snapshot().providerObservations.length, 2); assert.deepEqual(f.treasury.snapshot().balances, []);
});

test('cash snapshots record exact surplus/deficit facts without automatic balancing', async t => {
  const { treasury } = await fixture(t);
  await apply(treasury, 'opening', cashOpening);
  await apply(treasury, 'same', snapshotPlan(observation('cash', 'same', '10000000'), 'matched', '10000000'));
  await apply(treasury, 'higher', snapshotPlan(observation('cash', 'higher', '12000000', '102'), 'surplus', '10000000'));
  await apply(treasury, 'lower', snapshotPlan(observation('cash', 'lower', '8000000', '103'), 'deficit', '10000000'));
  assert.equal(treasury.snapshot().balances[0].amount, '10000000');
  assert.equal(treasury.snapshot().balanceReconciliations[0].status, 'deficit');
  assert.equal(treasury.snapshot().balanceReconciliations[0].expectedAmount, '10000000');
  assert.equal(treasury.snapshot().balanceReconciliations[0].observedAmount, '8000000');
  assert.equal(treasury.snapshot().reconciliationHistory.length, 3);
  assert.equal(treasury.snapshot().economicMovements.length, 0);
});

test('watermarks and immutable observation IDs reject inconsistent/stale snapshots', async t => {
  const { treasury } = await fixture(t);
  const o = observation('cash', 'latest', '10000000', '102');
  await apply(treasury, 'latest', snapshotPlan(o, 'unreconciled', '0'));
  await assert.rejects(apply(treasury, 'backdated', snapshotPlan(observation('cash', 'old', '10000000', '101'), 'unreconciled', '0')), { code: 'CONFLICT' });
  await assert.rejects(apply(treasury, 'inconsistent', snapshotPlan(observation('cash', 'new-id', '11000000', '102'), 'unreconciled', '0')), { code: 'CONFLICT' });
  await assert.rejects(apply(treasury, 'changed-id-payload', snapshotPlan({ ...o, evidenceRef: 'different' }, 'unreconciled', '0')), { code: 'CONFLICT' });
  await assert.rejects(apply(treasury, 'wrong-stream', snapshotPlan({ ...o, id: 'different-stream', watermark: { stream: 'other', position: '102' } }, 'unreconciled', '0')), { code: 'CONFLICT' });
  assert.equal(treasury.snapshot().providerObservations.length, 1);
});

test('opening overlap cannot add a sale already covered by the opening watermark', async t => {
  const { treasury } = await fixture(t);
  await apply(treasury, 'opening', cashOpening);
  const sale = { ...allocationPlan, binding: cashBinding, watermark: stamp('100'), providerReference: 'sale:provider-tx', evidenceRef: 'sale:evidence' };
  await assert.rejects(apply(treasury, 'overlap-sale', sale), { code: 'CONFLICT' });
  await assert.rejects(apply(treasury, 'unbound-sale', allocationPlan), { code: 'CONFLICT' });
  await apply(treasury, 'separate-sale', { ...sale, watermark: stamp('101') });
  assert.equal(treasury.snapshot().balances[0].amount, '15000000');
  assert.equal(treasury.snapshot().economicMovements.length, 1); assert.equal(treasury.snapshot().obligations.length, 1);
  const duplicatedReceipt = { kind: 'cash_receipt', receiptId: 'different-receipt-id', binding: cashBinding, watermark: stamp('101'), providerReference: 'sale:provider-tx', money: usd('5000000'), provenance: 'verified-transfer', evidenceRef: 'same-tx-evidence' };
  await assert.rejects(apply(treasury, 'duplicate-via-other-kind', duplicatedReceipt), { code: 'CONFLICT' });
  assert.equal(treasury.snapshot().balances[0].amount, '15000000');
});

test('opening cannot overlap preexisting legacy cash or be repeated under a fresh ID', async t => {
  const f = await fixture(t);
  await apply(f.treasury, 'sale-first', { ...allocationPlan, refundReserve: usd('0') });
  const history = f.journal.snapshot();
  await assert.rejects(apply(f.treasury, 'overlap-opening', cashOpening), { code: 'CONFLICT' });
  assert.deepEqual(f.journal.snapshot(), history);
  await f.restart(); assert.equal(f.treasury.snapshot().balances[0].amount, '5000000');
  await assert.rejects(apply(f.treasury, 'still-overlap', { ...cashOpening, receiptId: 'opening:fresh' }), { code: 'CONFLICT' });
  assert.equal(f.journal.events().filter(e => e.type === 'sale.confirmed').length, 1);
});

test('cash receipts require matching account/org/key/asset/bucket and opening boundary', async t => {
  const { treasury } = await fixture(t); await apply(treasury, 'opening', cashOpening);
  const receipt = { kind: 'cash_receipt', receiptId: 'cash:receipt', binding: cashBinding, watermark: stamp('101'), providerReference: 'cash:tx', money: usd('1000000'), provenance: 'verified-deposit', evidenceRef: 'cash:tx:evidence' };
  for (const [field, value] of [['accountId', 'other-agent'], ['organizationId', 'other-org'], ['credentialId', 'other-key-ref'], ['bucket', 'public'], ['provider', 'other-provider']]) {
    await assert.rejects(apply(treasury, `wrong-${field}`, { ...receipt, binding: { ...cashBinding, [field]: value } }), { code: 'CONFLICT' });
  }
  await assert.rejects(apply(treasury, 'wrong-asset', { ...receipt, money: { ...receipt.money, asset: 'other' } }), { code: 'INVALID_INPUT' });
  await assert.rejects(apply(treasury, 'covered-receipt', { ...receipt, watermark: stamp('100') }), { code: 'CONFLICT' });
  await apply(treasury, 'cash-receipt', receipt);
  await assert.rejects(apply(treasury, 'fresh-receipt-id', { ...receipt, receiptId: 'fresh-id' }), { code: 'CONFLICT' });
  assert.equal(treasury.snapshot().balances[0].amount, '11000000');
  await assert.rejects(apply(treasury, 'reopen', { ...cashOpening, receiptId: 'opening:new', watermark: stamp('200') }), { code: 'CONFLICT' });
});

test('spent/shared credit is never replenished by fresh-ID absolute snapshots or re-openings', async t => {
  const { treasury } = await fixture(t);
  await apply(treasury, 'opening', creditOpening);
  await apply(treasury, 'reservation', inferenceReservation);
  await apply(treasury, 'consumed', { kind: 'consumption', receiptId: 'usage:receipt', reservationId: 'reservation:inference', creditId: 'credit:opening', actualCostNanoUsd: '100000000', remainingCreditNanoUsd: '900000000', accountingDay: '2026-11-11', watermark: stamp('101'), providerReference: 'usage:provider-id', evidenceRef: 'usage:bill' });
  await apply(treasury, 'reported-spent', snapshotPlan(observation('credit', 'spent', '900000000', '102'), 'matched', '900000000'));
  await apply(treasury, 'reported-external-use', snapshotPlan(observation('credit', 'external-use', '800000000', '103'), 'deficit', '900000000'));
  await apply(treasury, 'reported-higher', snapshotPlan(observation('credit', 'higher', '1000000000', '104'), 'surplus', '900000000'));
  assert.equal(treasury.snapshot().credits.availableNanoUsd, '900000000');
  assert.equal(treasury.snapshot().credits.lots.length, 1); assert.equal(treasury.snapshot().credits.lots[0].availableNanoUsd, '900000000');
  assert.equal(treasury.snapshot().dailyCosts['2026-11-11'], '100000000');
  await assert.rejects(apply(treasury, 'replenish-opening', { ...creditOpening, receiptId: 'new-opening', credit: { ...creditOpening.credit, id: 'new-credit' } }), { code: 'CONFLICT' });
  assert.equal(treasury.snapshot().credits.availableNanoUsd, '900000000');
});

test('only discrete verified credit receipts add credit, uniquely by provider transaction', async t => {
  const { treasury } = await fixture(t); await apply(treasury, 'opening', creditOpening);
  const receipt = { kind: 'credit_receipt', receiptId: 'credit:receipt', binding: creditBinding, watermark: stamp('101'), providerReference: 'credit:purchase:provider', provenance: 'owner-purchase', evidenceRef: 'credit:purchase:receipt', credit: { id: 'credit:purchase', owner: creditBinding.accountId, provider: creditBinding.provider, availableNanoUsd: '100000000', provenance: 'owner-purchase' } };
  await apply(treasury, 'credit-receipt', receipt);
  await apply(treasury, 'same-exact-receipt', receipt);
  assert.equal(treasury.snapshot().credits.availableNanoUsd, '1100000000'); assert.equal(treasury.snapshot().credits.lots.length, 2);
  await assert.rejects(apply(treasury, 'fresh-receipt', { ...receipt, receiptId: 'credit:fresh', credit: { ...receipt.credit, id: 'credit:fresh' } }), { code: 'CONFLICT' });
  await apply(treasury, 'observe-after-purchase', snapshotPlan(observation('credit', 'observed-purchase', '1100000000', '102'), 'matched', '1100000000'));
  assert.equal(treasury.snapshot().credits.availableNanoUsd, '1100000000');
});

test('pending cost/effect, lower absolute credit, and exact Rules status survive restart without release', async t => {
  const f = await fixture(t); await apply(f.treasury, 'opening', creditOpening); await apply(f.treasury, 'reserve', inferenceReservation);
  await f.journal.registerOperation({ actionId: 'inference:one', fingerprint: 'paid-request-fp', purpose: 'inference', status: 'unknown' });
  await apply(f.treasury, 'unknown-reservation', { kind: 'reconciliation', reservationId: 'reservation:inference', status: 'unknown' });
  await apply(f.treasury, 'pending-bill', snapshotPlan(observation('credit', 'pending-bill', '850000000', '102'), 'pending', '1000000000', ['inference:one']));
  await f.restart();
  const financial = f.treasury.snapshot();
  assert.equal(financial.credits.availableNanoUsd, '1000000000'); assert.equal(financial.reservations[0].status, 'unknown');
  assert.equal(financial.reservations[0].upperBoundNanoUsd, '200000000'); assert.equal(financial.reservations[0].accountingDay, '2026-11-11');
  assert.equal(financial.balanceReconciliations[0].status, 'pending'); assert.deepEqual(financial.balanceReconciliations[0].unresolvedOperationIds, ['inference:one']);
  assert.equal(f.journal.recoverableOperations()[0].status, 'unknown'); assert.equal(financial.dailyCosts['2026-11-11'] ?? '0', '0');
  await apply(f.treasury, 'late-actual-cost', { kind: 'consumption', receiptId: 'late:bill', reservationId: 'reservation:inference', creditId: 'credit:opening', actualCostNanoUsd: '150000000', remainingCreditNanoUsd: '850000000', accountingDay: '2026-11-11', watermark: stamp('101'), providerReference: 'inference:one:actual-bill', evidenceRef: 'actual:bill:evidence' });
  assert.equal(f.treasury.snapshot().credits.availableNanoUsd, '850000000'); assert.equal(f.treasury.snapshot().dailyCosts['2026-11-11'], '150000000');
  assert.equal(f.treasury.snapshot().balanceReconciliations[0].status, 'pending'); // Only M01's next approved reconciliation may clear it.
});

test('legacy provider/owner balance import plans cannot mutate a nonfixture or opened store', async t => {
  const { treasury } = await fixture(t);
  const capital = { kind: 'capital', receiptId: 'old:capital', money: usd('10000000'), reference: 'owner-json', provenance: 'owner_capital' };
  await assert.rejects(treasury.applyDecision({ actionId: 'unsafe-live-capital', decision: { ...approve(treasury, { id: 'unsafe-live-capital' }, capital), mode: 'live' } }), { code: 'CONFLICT' });
  const credit = { kind: 'credit_observation', receiptId: 'old:credit', credit: { id: 'old:lot', reference: 'owner-json', availableNanoUsd: '1000000000' } };
  await assert.rejects(treasury.applyDecision({ actionId: 'unsafe-live-credit', decision: { ...approve(treasury, { id: 'unsafe-live-credit' }, credit), mode: 'live' } }), { code: 'CONFLICT' });
  await apply(treasury, 'opening', creditOpening);
  await assert.rejects(apply(treasury, 'fixture-alias-bypass', credit), { code: 'CONFLICT' });
  assert.equal(treasury.snapshot().credits.availableNanoUsd, '1000000000');
});

test('actual M01 trusted snapshot plan records a deficit which its spend gate holds', async t => {
  const { treasury } = await fixture(t);
  const prototype = createRules({ configPath: new URL('../../config.example.yaml', import.meta.url).pathname });
  const config = structuredClone(prototype.snapshot().config);
  config.treasuryAccount = cashBinding.accountId;
  config.settlementAsset = { network: 'fixture', asset: 'usdc', decimals: 6 };
  config.customerAssets = [structuredClone(config.settlementAsset)]; config.fixtureBootstrap = usd('10000000');
  const runtime = { economicIdentity: { companyId: cashBinding.companyId, cashBinding, creditBinding }, economicObservations: [], economicReceipts: [] };
  const now = Date.parse('2026-11-13T00:00:01Z');
  const rules = createRules({ config, companyId: cashBinding.companyId, clock: () => new Date(now), getRuntimeFacts: () => runtime });
  assert.equal(rules.snapshot().valid, true);
  runtime.economicReceipts.push({ ...cashOpening, id: cashOpening.receiptId, status: 'verified', ownerBindingApproval: { id: 'approval:one', companyId: cashBinding.companyId, scopeId: fingerprint({ resource: 'cash', binding: cashBinding }), policyVersion: rules.snapshot().policyVersion } });
  const openAction = { id: 'rules:opening', type: 'cash_opening', receiptId: cashOpening.receiptId, mode: 'fixture' };
  const opening = rules.evaluate(openAction, { financial: treasury.snapshot() }); assert.equal(opening.status, 'allow', opening.reasonCode);
  await treasury.applyDecision({ actionId: openAction.id, decision: opening });
  const record = async (id, value, position) => {
    runtime.economicObservations.push({ ...observation('cash', id, value, position), status: 'verified' });
    const action = { id: `record:${id}`, type: 'balance_snapshot', observationId: id, mode: 'fixture' };
    const decision = rules.evaluate(action, { financial: treasury.snapshot() });
    assert.equal(decision.status, 'allow', decision.reasonCode);
    await treasury.applyDecision({ actionId: action.id, decision }); return decision;
  };
  assert.equal((await record('trusted:matched', '10000000', '101')).plan.reconciliation.status, 'matched');
  assert.equal(economicSafety(treasury.snapshot(), runtime, rules.snapshot().config, cashBinding.companyId, ['cash'], now), null);
  assert.equal((await record('trusted:deficit', '8000000', '102')).plan.reconciliation.status, 'deficit');
  const block = economicSafety(treasury.snapshot(), runtime, rules.snapshot().config, cashBinding.companyId, ['cash'], now);
  assert.equal(block.status, 'hold'); assert.equal(block.reasonCode, 'BALANCE_RECONCILIATION_REQUIRED'); assert.equal(block.reconciliationStatus, 'deficit');
  assert.equal(treasury.snapshot().balances[0].amount, '10000000');
  const spoof = rules.evaluate({ id: 'untrusted', type: 'balance_snapshot', observationId: 'request-json-only' }, { financial: treasury.snapshot(), observation: { ...observation('cash', 'request-json-only', '10000000', '103'), status: 'verified' } });
  assert.equal(spoof.status, 'hold'); assert.equal(spoof.reasonCode, 'ECONOMIC_EVIDENCE_REQUIRED');
});

test('reading historical fixture financial facts does not persist a migration or relabel history', async t => {
  const f = await fixture(t);
  await apply(f.treasury, 'historical-sale', { ...allocationPlan, refundReserve: usd('0') });
  const raw = f.journal.snapshot();
  const financial = f.treasury.snapshot();
  assert.deepEqual(financial.providerObservations, []); assert.deepEqual(financial.openingRecords, []);
  assert.deepEqual(f.journal.snapshot(), raw);
  await f.restart(); f.treasury.snapshot();
  assert.deepEqual(f.journal.snapshot(), raw);
  assert.equal(f.journal.events().find(e => e.type === 'sale.confirmed').data.mode, 'fixture');
});
