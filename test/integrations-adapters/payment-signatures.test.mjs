import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { base58 } from '@scure/base';
import { quoteHash, verifyQuoteSignature } from '@defuse-protocol/one-click-sdk-typescript';
import { createPaymentSignatureVerifier } from '../../src/payments/signatures.mjs';
import { bytesHash } from '../../src/inference/capture.mjs';
import { journalFor, clock } from './fixtures.mjs';

function signedTestQuote() {
  const pair = generateKeyPairSync('ed25519'); const publicKey = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const envelope = { timestamp: '2026-11-13T00:00:00Z', quoteRequest: { dry: false, swapType: 'EXACT_OUTPUT', slippageTolerance: 100,
    originAsset: 'source', depositType: 'ORIGIN_CHAIN', destinationAsset: 'destination', amount: '10', refundTo: 'customer', refundType: 'ORIGIN_CHAIN',
    recipient: 'agent', recipientType: 'CONFIDENTIAL_INTENTS', deadline: '2026-11-13T00:01:00Z' },
    quote: { amountIn: '11', amountOut: '10', depositAddress: 'deposit', deadline: '2026-11-13T00:01:00Z' } };
  envelope.signature = `ed25519:${base58.encode(sign(null, Buffer.from(quoteHash(envelope)), pair.privateKey))}`;
  return { envelope, publicKey: `ed25519:${base58.encode(publicKey)}` };
}

test('official SDK verifies real Ed25519 test signature; signed recipient, output, deposit and timestamp mutations fail', () => {
  const { envelope, publicKey } = signedTestQuote();
  assert.equal(verifyQuoteSignature(envelope, publicKey), true);
  for (const change of [q => { q.quoteRequest.recipient = 'attacker'; }, q => { q.quote.amountOut = '100'; }, q => { q.quote.depositAddress = 'other'; }, q => { q.timestamp = '2027-01-01T00:00:00Z'; }]) {
    const mutated = structuredClone(envelope); change(mutated); assert.equal(verifyQuoteSignature(mutated, publicKey), false);
  }
  // A test key never replaces the SDK's production trust root.
  assert.equal(verifyQuoteSignature(envelope), false);
});

test('nested quote signature does not authenticate status/swapDetails or excluded request fields', () => {
  const { envelope, publicKey } = signedTestQuote();
  const status = { status: 'SUCCESS', swapDetails: { amountOut: '9999' }, quoteResponse: envelope };
  assert.equal(verifyQuoteSignature(status.quoteResponse, publicKey), true);
  status.status = 'FAILED'; status.swapDetails.amountOut = '0';
  assert.equal(verifyQuoteSignature(status.quoteResponse, publicKey), true);
  const changed = structuredClone(envelope); changed.quoteRequest.depositMode = 'MEMO'; changed.quoteRequest.appFees = [{ recipient: 'changed', fee: 1 }];
  assert.equal(verifyQuoteSignature(changed, publicKey), true);
});

test('private envelope replay uses SDK pinned production root and never trusts saved verified flags', async t => {
  const journal = await journalFor(t); const { envelope } = signedTestQuote();
  async function save(body) {
    const raw = Buffer.from(JSON.stringify(body));
    const artifact = await journal.putArtifact({ actionId: `signed-envelope:${bytesHash(raw)}`, content: JSON.stringify({ request: { method: 'GET', url: 'https://example.invalid/status' },
      response: { bodyBase64: raw.toString('base64'), bodyHash: bytesHash(raw) }, verified: true }) });
    return `private:${artifact.id}`;
  }
  const verifier = createPaymentSignatureVerifier({ journal, clock });
  const quote = await verifier.verifyQuote({ evidenceRef: await save(envelope) });
  assert.equal(quote.status, 'failed'); assert.equal(quote.reasonCode, 'QUOTE_SIGNATURE_INVALID');
  const status = await verifier.verifyStatus({ evidenceRef: await save({ status: 'SUCCESS', quoteResponse: envelope, swapDetails: { amountOut: '999' } }) });
  assert.equal(status.status, 'failed'); assert.equal(status.mutableStatusVerified, false); assert.equal(status.settlementVerified, false);
  assert.equal((await verifier.verifyQuote({ evidenceRef: 'https://not-private' })).status, 'unavailable');
});
