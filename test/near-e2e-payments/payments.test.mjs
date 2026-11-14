import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { adapter, finding, openJournal, provider, quoteCommand, settlementCommand, successStatus, clock, SOURCE, PRICE } from './harness.mjs';
import { createPaymentSignatureVerifier } from '../../src/payments/index.mjs';

async function quoted(t, { evidence, overrides, id = 'one', clockFn } = {}) {
  const { journal, dir } = await openJournal(t); const http = await provider(t, overrides);
  const a = adapter({ journal, http, settlementEvidence: evidence ? { verify: evidence } : undefined, clock: clockFn });
  const outcome = await a.quote(quoteCommand(id));
  return { journal, dir, http, a, outcome, quote: outcome.quote };
}

test('quote freezes signed envelope, minAmountIn/fees and a provider-priced service refund route before returning deposit instructions', async t => {
  const { outcome, http, quote, journal } = await quoted(t);
  assert.equal(outcome.status, 'confirmed'); assert.equal(quote.depositAddress, 'deposit-1');
  assert.equal(quote.signedQuote.minAmountIn, '5020000'); assert.equal(quote.signedQuote.refundFee, '2000'); assert.equal(quote.refundType, 'ORIGIN_CHAIN');
  const route = quote.serviceRefundRoute;
  assert.equal(route.status, 'provider_estimate_only'); assert.equal(route.custodyExecutionVerified, false); assert.equal(route.executableProof, 'unavailable');
  assert.equal(route.principal.amount, PRICE.amount); assert.equal(route.deliver.amount, '5100000'); assert.equal(route.feeTreatment, 'shop_pays');
  assert.equal(route.fees[0].money.asset, SOURCE.asset); assert.equal(route.fees[0].money.amount, '1000'); assert.equal(route.feesComplete, true);
  assert.equal(route.inputMinusPrincipal, '5150000'.replace('5150000', String(5100000 + 50000 - 5000000)));
  const [, real, dry] = http.requests.filter(r => r.path === '/v0/quote' || r.path === '/v0/tokens');
  assert.equal(real.body.dry, false); assert.equal(dry.body.dry, true); assert.equal(dry.body.depositType, 'CONFIDENTIAL_INTENTS'); assert.equal(dry.body.recipient, '0xCustomerRefund');
  assert.equal(dry.body.originAsset, PRICE.asset); assert.equal(dry.body.destinationAsset, SOURCE.asset); assert.equal(dry.body.refundTo, 'treasury.near');
  assert.equal(quote.signatureProof.trustRoot, 'caller-supplied-test-root'); // synthetic test root, never the product root
  assert.equal(journal.list('privateArtifacts').length, 2);
});

for (const [name, overrides, code] of [['provider error', { dryFail: true }, 'REFUND_ROUTE_UNAVAILABLE'], ['invalid signature', { dryBadSignature: true }, 'REFUND_ROUTE_UNAVAILABLE'], ['no fee fact', { dryNoFee: true }, 'REFUND_ROUTE_UNPRICED']]) {
  test(`missing/invalid reverse route (${name}) withholds deposit instructions and stores no quote`, async t => {
    const { outcome, journal, a } = await quoted(t, { overrides });
    assert.equal(outcome.status, 'not_submitted'); assert.equal(outcome.code, code); assert.equal(outcome.quote, undefined);
    assert.ok(!journal.get('adapters:m05', 'invoice-one'));
    assert.equal(JSON.stringify(outcome).includes('deposit-1'), false);
    assert.ok(a);
  });
}

test('SUCCESS and updatedAt without independent evidence stay unknown: no settledAt, no verification, mutable fields exposed only as provider facts', async t => {
  const { a, quote, http } = await quoted(t, { overrides: { statusBody: undefined } });
  http.state.statusBody = successStatus();
  const out = await a.verifySettlement(settlementCommand(quote));
  assert.equal(out.status, 'unknown'); assert.equal(out.code, 'SETTLEMENT_PROOF_UNAVAILABLE');
  const s = out.settlement; assert.equal(s.verified, false); assert.equal(s.settledAt, null); assert.equal(s.withinInvoiceWindow, null);
  assert.equal(s.assurance, 'provider-status-only'); assert.equal(s.statusUpdatedAt, '2026-11-10T20:03:00.000Z'); assert.equal(s.onchainMovementProven, false);
  assert.match(s.settledAtSource, /not-settlement-time/); assert.equal(out.providerFacts.authenticated, false);
});

test('status identity is bound by the nested signed payload hash: tampered or substituted nested quotes cannot confirm', async t => {
  const { a, quote, http } = await quoted(t, { evidence: async () => finding() });
  // 1. nested field tampered => signature invalid
  http.state.statusBody = envelope => { const e = successStatus()(envelope); e.quoteResponse = structuredClone(envelope); e.quoteResponse.quote.amountOut = '1'; return e; };
  let out = await a.verifySettlement(settlementCommand(quote));
  assert.equal(out.status, 'unknown'); assert.equal(out.code, 'QUOTE_SIGNATURE_INVALID');
  // 2. mutable status fields rewritten do not alter the signed hash (so hash binding alone is insufficient: evidence still required)
  http.state.statusBody = envelope => ({ ...successStatus()(envelope), updatedAt: '2030-01-01T00:00:00Z', swapDetails: { intentHashes: [], nearTxHashes: [], originChainTxHashes: [], destinationChainTxHashes: [], amountOut: '999' } });
  out = await a.verifySettlement(settlementCommand(quote));
  assert.equal(out.providerFacts.amounts.amountOut, '999'); // surfaced as unauthenticated, never as money
  assert.equal(out.settlement.money.amount, PRICE.amount);
});

test('another validly signed quote for the same deposit address cannot be substituted', async t => {
  const { a, quote, http } = await quoted(t);
  const other = await (await provider(t)).transport; assert.ok(other);
  const { signEnvelope } = await import('./harness.mjs');
  http.state.statusBody = envelope => { const e = successStatus()(envelope); const swapped = structuredClone(envelope); swapped.quote.amountIn = '5100001'; e.quoteResponse = signEnvelope(swapped); return e; };
  const out = await a.verifySettlement(settlementCommand(quote));
  assert.equal(out.status, 'unknown'); assert.equal(out.code, 'STATUS_QUOTE_IDENTITY_MISMATCH');
});

test('independent onchain-final evidence exactly bound to the frozen quote verifies; port pass flag alone is irrelevant', async t => {
  let seen;
  const { a, quote, http } = await quoted(t, { evidence: async input => { seen = input; return finding(); } });
  http.state.statusBody = successStatus();
  const out = await a.verifySettlement(settlementCommand(quote));
  assert.equal(out.status, 'confirmed'); assert.equal(out.settlement.verified, true); assert.equal(out.settlement.onchainMovementProven, true);
  assert.equal(out.settlement.settledAt, '2026-11-10T20:02:00.000Z'); assert.equal(out.settlement.withinInvoiceWindow, true); assert.equal(out.settlement.settledAtSource, 'independent-evidence:agent-receipt-log');
  assert.deepEqual(out.settlement.money, PRICE); assert.equal(out.settlement.recipient, 'treasury.near');
  assert.deepEqual(seen.expected, { account: 'treasury.near', asset: PRICE.asset, amount: PRICE.amount, recipientType: 'CONFIDENTIAL_INTENTS',
    references: ['corr-1', 'deposit-1', 'intent-hash-1', 'origin-tx'] });
  assert.equal(out.settlement.independentEvidence.matchedReferences[0], 'intent-hash-1');
});

const variants = [
  ['wrong account', { account: 'attacker.near' }, 'unknown', 'SETTLEMENT_EVIDENCE_UNBOUND'],
  ['unrelated reference', { references: ['someone-else'], terms: { destination_asset: PRICE.asset, amount_out: PRICE.amount, confidential: true } }, 'unknown', 'SETTLEMENT_EVIDENCE_UNBOUND'],
  ['settled before quote', { settledAt: '2026-11-10T19:00:00.000Z' }, 'unknown', 'SETTLEMENT_EVIDENCE_UNBOUND'],
  ['settled in the future', { settledAt: '2026-11-10T21:00:00.000Z' }, 'unknown', 'SETTLEMENT_EVIDENCE_UNBOUND'],
  ['no settled time', { settledAt: null }, 'unknown', 'SETTLEMENT_EVIDENCE_UNBOUND'],
  ['wrong amount', { terms: { destination_asset: PRICE.asset, amount_out: '4999999', confidential: true }, references: ['deposit-1'] }, 'confirmed', 'SETTLEMENT_MISMATCH'],
  ['wrong asset', { terms: { destination_asset: 'nep141:other', amount_out: PRICE.amount, confidential: true }, references: ['deposit-1'] }, 'confirmed', 'SETTLEMENT_MISMATCH'],
  ['public not confidential', { terms: { destination_asset: PRICE.asset, amount_out: PRICE.amount, confidential: false }, references: ['deposit-1'] }, 'confirmed', 'SETTLEMENT_MISMATCH'],
  ['evidence rejected', { status: 'failed' }, 'unknown', 'SETTLEMENT_EVIDENCE_REJECTED'],
  ['log-attested, finality not established', { assurance: 'log-attested-exact-terms', finality: 'not_established' }, 'unknown', 'SETTLEMENT_ASSURANCE_NOT_ONCHAIN_FINAL'],
  ['onchain claim without finality', { finality: 'not_established' }, 'unknown', 'SETTLEMENT_ASSURANCE_NOT_ONCHAIN_FINAL'],
];
for (const [name, change, status, code] of variants) {
  test(`independent evidence variant: ${name}`, async t => {
    const { a, quote, http } = await quoted(t, { evidence: async () => finding(change) });
    http.state.statusBody = successStatus();
    const out = await a.verifySettlement(settlementCommand(quote));
    assert.equal(out.status, status); assert.equal(out.code, code); assert.equal(out.settlement?.verified ?? false, false);
    assert.equal(out.settlement?.onchainMovementProven ?? false, false);
  });
}

test('log-attested exact terms are exposed as bound facts with distinct assurance; the adapter never promotes them', async t => {
  const { a, quote, http } = await quoted(t, { evidence: async () => finding({ assurance: 'log-attested-exact-terms', finality: 'not_established' }) });
  http.state.statusBody = successStatus();
  const out = await a.verifySettlement(settlementCommand(quote));
  assert.equal(out.status, 'unknown'); assert.equal(out.settlement.assurance, 'log-attested-exact-terms'); assert.equal(out.settlement.finality, 'not_established');
  assert.equal(out.settlement.verificationLevel, 'independent-evidence-bound-not-onchain-final');
  assert.equal(out.settlement.bindings.account && out.settlement.bindings.amount && out.settlement.bindings.reference, true);
  assert.equal(out.settlement.settledAt, '2026-11-10T20:02:00.000Z'); assert.deepEqual(out.settlement.independentEvidence.provenance.checkpoint, { origin: 'test', size: 8, root: 'r' });
  assert.equal(out.settlement.verified, false);
});

test('late settlement is a fact (withinInvoiceWindow=false + service refund candidate), not a mismatch; port errors leave unknown', async t => {
  let now = clock(); const { a, quote, http } = await quoted(t, { clockFn: () => now, evidence: async () => finding({ settledAt: '2026-11-10T20:16:00.000Z' }) });
  http.state.statusBody = successStatus(); now = new Date('2026-11-10T20:17:00.000Z');
  const late = await a.verifySettlement(settlementCommand(quote));
  assert.equal(late.status, 'confirmed'); assert.equal(late.settlement.verified, true); assert.equal(late.settlement.withinInvoiceWindow, false);
  assert.deepEqual(late.refund.service.candidate.reasons, ['late_after_quote_deadline']);
  const b = await quoted(t, { id: 'two', evidence: async () => { throw new Error('port down'); } });
  b.http.state.statusBody = successStatus();
  const down = await b.a.verifySettlement(settlementCommand(b.quote, 'two'));
  assert.equal(down.status, 'unknown'); assert.equal(down.code, 'SETTLEMENT_PROOF_UNAVAILABLE');
});

test('provider refund classes (partial, excess, REFUNDED, FAILED) are provider-reported facts to the SIGNED refundTo, distinct from service refund', async t => {
  const { a, quote, http } = await quoted(t);
  const cases = [
    [{ status: 'INCOMPLETE_DEPOSIT' }, { depositedAmount: '1000' }, 'pending', 'partial_deposit', 'expected_by_quote_deadline'],
    [{ status: 'REFUNDED' }, { refundedAmount: '5100000', refundReason: 'PARTIAL_DEPOSIT' }, 'failed', 'swap_not_completed', 'reported'],
    [{ status: 'FAILED' }, {}, 'failed', 'swap_failed', 'unknown'],
    [{ status: 'SUCCESS' }, { depositedAmount: '5300000', refundedAmount: '200000' }, 'unknown', 'excess_deposit', 'reported'],
  ];
  for (const [patch, swap, status, klass, state] of cases) {
    http.state.statusBody = envelope => successStatus(patch, swap)(envelope);
    const out = await a.verifySettlement(settlementCommand(quote, klass));
    const r = out.refund.provider;
    assert.equal(out.status, status); assert.equal(r.class, klass); assert.equal(r.state, state);
    assert.deepEqual(r.destination, { address: '0xCustomerRefund', type: 'ORIGIN_CHAIN', source: 'signed-quote' });
    assert.equal(r.authenticated, false); assert.equal(r.independentlyVerified, false); assert.equal(r.signedRefundFee, '2000');
    assert.equal(out.refund.service.route.custodyExecutionVerified, false);
    assert.notEqual(out.refund.service.candidate.state, 'candidate');
  }
  assert.equal((await a.verifySettlement(settlementCommand(quote, 'excess'))).providerFacts.amounts.excessDeposit, '200000');
});

test('verified settlement is sticky and never re-fetched; altered quote conflicts; unknown provider status stays unknown', async t => {
  const { a, quote, http } = await quoted(t, { evidence: async () => finding() });
  http.state.statusBody = successStatus();
  const first = await a.verifySettlement(settlementCommand(quote));
  const polls = () => http.requests.filter(r => r.path.startsWith('/v0/status')).length;
  const before = polls(); const again = await a.verifySettlement(settlementCommand(quote, 'other-action'));
  assert.deepEqual(again, first); assert.equal(polls(), before);
  assert.equal((await a.verifySettlement(settlementCommand({ ...quote, recipient: 'attacker' }))).code, 'CONFLICT');
  const c = await quoted(t, { id: 'weird' }); c.http.state.statusBody = envelope => ({ ...successStatus()(envelope), status: 'MADE_UP' });
  assert.equal((await c.a.verifySettlement(settlementCommand(c.quote, 'weird'))).code, 'PROVIDER_STATUS_UNKNOWN');
});

test('raw status bytes and independent evidence are persisted privately; offline replay after restart reproduces the verdict without network', async t => {
  const { createJournal } = await import('../../src/journal/index.mjs');
  const { journal, dir, http, a, quote } = await quoted(t, { evidence: async () => finding({ assurance: 'log-attested-exact-terms', finality: 'not_established' }) });
  http.state.statusBody = successStatus();
  const out = await a.verifySettlement(settlementCommand(quote));
  const id = out.observation.statusEvidenceRef.slice(8); const exchange = JSON.parse(journal.getArtifact({ id, hash: id }).content);
  const bytes = Buffer.from(exchange.response.bodyBase64, 'base64'); assert.equal(createHash('sha256').update(bytes).digest('hex'), exchange.response.bodyHash);
  assert.equal(JSON.parse(bytes).status, 'SUCCESS'); assert.match(out.observation.findingRef, /^private:[a-f0-9]{64}$/);
  await journal.close();
  const reopened = await createJournal({ directory: dir, clock });
  t.after(async () => { await reopened.close().catch(() => {}); });
  const offline = adapter({ journal: reopened, transport: () => { throw new Error('network must not be used during replay'); } });
  const replayed = await offline.replay(settlementCommand(quote, 'replay'));
  assert.equal(replayed.status, 'unknown'); assert.equal(replayed.code, 'SETTLEMENT_ASSURANCE_NOT_ONCHAIN_FINAL');
  assert.equal(replayed.settlement.assurance, 'log-attested-exact-terms'); assert.equal(replayed.settlement.settledAt, '2026-11-10T20:02:00.000Z');
  void http;
});

test('default signature verifier uses the SDK pinned production root: a test-signed quote is rejected', async t => {
  const { journal } = await openJournal(t); const http = await provider(t);
  const { createPaymentsAdapter } = await import('../../src/payments/index.mjs');
  const real = createPaymentsAdapter({ mode: 'live', journal, clock, transport: http.transport, slippageTolerance: 100 });
  const out = await real.quote(quoteCommand('prod-root'));
  assert.equal(out.code, 'QUOTE_SIGNATURE_INVALID'); assert.equal(out.proof.trustRoot, 'sdk-default-manager-public-key');
  assert.equal(createPaymentSignatureVerifier({ journal, clock }).trustRoot, 'sdk-default-manager-public-key');
  assert.equal(real.capabilities().settlementVerificationRequires, 'onchain-final'); assert.equal(real.capabilities().independentSettlementEvidencePort, false);
});
