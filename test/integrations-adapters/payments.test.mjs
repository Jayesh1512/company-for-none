import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixturePaymentsAdapter as createPaymentsAdapter } from './fixture-adapters.mjs';
import { createPaymentsAdapter as createRealPaymentsAdapter } from '../../src/payments/index.mjs';
import { clock, journalFor, quoteCommand } from './fixtures.mjs';

test('two fixture source assets quote exact destination with explicit conversion facts', async t => {
  const journal = await journalFor(t);
  const a = createPaymentsAdapter({ mode: 'fixture', journal, clock,
    fixtureQuotes: { 'demo-near': { network: 'fixture', asset: 'demo-near', decimals: 24, amount: '2500000000000000000000000' } } });
  const c1 = quoteCommand('usdc');
  const q1 = await a.quote(c1);
  assert.equal(q1.quote.destination.amount, '5000000');
  assert.equal(q1.quote.requiredInput.asset, 'demo-usdc');
  assert.equal(q1.quote.simulated, true);
  const c2 = { ...quoteCommand('near'), sourceAsset: { network: 'fixture', asset: 'demo-near', decimals: 24 } };
  const q2 = await a.quote(c2);
  assert.equal(q2.quote.requiredInput.amount, '2500000000000000000000000');
  assert.deepEqual(q2.quote.destination, q1.quote.destination);
  assert.deepEqual((await a.quote(c2)).quote, q2.quote);
  assert.equal((await a.quote({ ...c2, recipient: 'different' })).status, 'not_submitted');
  assert.equal((await a.quote({ ...quoteCommand('unsupported'), sourceAsset: { network: 'fixture', asset: 'made-up', decimals: 6 } })).code, 'UNSUPPORTED_ASSET');
});

test('stale quote cannot issue deposit instructions; late settlement retains facts for Rules remedy', async t => {
  const journal = await journalFor(t);
  let date = clock();
  const a = createPaymentsAdapter({ mode: 'fixture', journal, clock: () => date });
  const command = quoteCommand('late');
  const { quote } = await a.quote(command);
  date = new Date('2026-11-10T20:16:00Z');
  assert.equal((await a.quote(command)).code, 'QUOTE_EXPIRED');
  const paid = await a.verifySettlement({ action: { id: 'late-payment' }, quote, observation: { status: 'confirmed' } });
  assert.equal(paid.status, 'confirmed'); assert.equal(paid.settlement.verified, true);
  assert.equal(paid.settlement.withinInvoiceWindow, false);
});

for (const [field, value] of [['network', 'wrong-network'], ['asset', 'wrong-asset'], ['recipient', 'attacker'], ['amount', '1'], ['finality', 'unknown']]) {
  test(`settlement factual mismatch ${field} is preserved and cannot verify sale`, async t => {
    const journal = await journalFor(t);
    const a = createPaymentsAdapter({ mode: 'fixture', journal, clock });
    const { quote } = await a.quote(quoteCommand(field));
    const seen = await a.verifySettlement({ action: { id: `pay-${field}` }, quote,
      observation: { status: 'confirmed', [field]: value } });
    assert.equal(seen.status, 'confirmed'); assert.equal(seen.settlement.verified, false);
    assert.equal(seen.code, 'SETTLEMENT_MISMATCH'); assert.ok(seen.settlement.mismatches.includes(field));
  });
}

test('payment pending/unknown survive then reconcile once; untrusted altered quote conflicts', async t => {
  const journal = await journalFor(t);
  const a = createPaymentsAdapter({ mode: 'fixture', journal, clock });
  const { quote } = await a.quote(quoteCommand('progress'));
  const command = { action: { id: 'payment-progress' }, quote };
  assert.equal((await a.verifySettlement(command)).status, 'pending');
  assert.equal((await a.verifySettlement({ ...command, observation: { status: 'unknown' } })).status, 'unknown');
  assert.equal((await a.verifySettlement({ ...command, quote: { ...quote, recipient: 'attacker' } })).code, 'CONFLICT');
  const paid = await a.verifySettlement({ ...command, observation: { status: 'confirmed' } });
  const duplicate = await a.verifySettlement({ ...command, observation: { status: 'confirmed', reference: 'different-reference' } });
  assert.deepEqual(duplicate, paid);
});

test('official testnet payments and live funding remain unsupported', async () => {
  const a = createRealPaymentsAdapter({ mode: 'testnet' });
  const outcome = await a.quote(quoteCommand('testnet'));
  assert.equal(outcome.code, 'UNSUPPORTED_CAPABILITY'); assert.equal(outcome.simulated, false);
});
