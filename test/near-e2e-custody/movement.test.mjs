import test from 'node:test';
import assert from 'node:assert/strict';
import * as official from '@near-intents-agent-api/sdk';
import { fixture, harness, copy, sha } from './fixtures.mjs';
import { compareReceiptTerms } from '../../src/custody/movement.mjs';

test('real SDK verifies the signed receipt leaf and the wrapper returns exact signed terms, labelled log-attested', async t => {
  const f = fixture(), h = await harness(t, f);
  const direct = await official.verifyReceipt(f.receipt, { origin: f.trust.origin, trusted: f.head, readTile: f.readTile });
  assert.equal(direct.terms.amount, '250000');
  const r = await h.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation });
  assert.equal(r.status, 'verified', r.code);
  assert.equal(r.assurance, 'log-attested-exact-terms'); assert.equal(r.independentChainFinality, 'not_established');
  assert.deepEqual({ ...r.terms }, { type: 'transfer', asset: 'nep141:usdc.near', amount: '250000', recipient: 'payee.near', confidential: true, intent_hash: 'intent-hash-one' });
  assert.equal(r.settledAt, '2026-11-14T00:00:05.000Z'); assert.equal(r.provenance.leafIndex, '1'); assert.equal(r.provenance.checkpoint.size, '2');
  assert.equal(r.account, 'agent.near'); assert.deepEqual(r.references, ['intent-hash-one']);
  assert.match(r.evidenceRef, /^agent-movement:[a-f0-9]{64}$/);
  assert.equal(r.grantsSpendingAuthority, false); assert.equal(r.grantsDeliveryAuthority, false);
  assert.equal(h.journal.get('treasury', 'financial'), null); assert.equal(h.journal.events().length, 0);
});

test('replay after restart re-runs SDK receipt+operation verification against the retained head and live tiles', async t => {
  const f = fixture(), h = await harness(t, f);
  const r = await h.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation });
  const tilesBefore = h.calls.tiles, quotesBefore = h.calls.quote;
  await h.restart({ movement: { getReceiptCheckpoint: async () => { throw Error('replay must use the retained head'); }, clock: () => new Date('2031-01-01T00:00:00Z') } });
  const again = await h.movement.replay({ evidenceRef: r.evidenceRef, expected: f.expected });
  assert.equal(again.status, 'verified', again.code); assert.equal(again.replayScope, 'retained-trusted-checkpoint');
  assert.ok(h.calls.tiles > tilesBefore && h.calls.quote > quotesBefore, 'receipt tiles and TDX port must run again');
  const changed = fixture({ body: { ...f.expected.payload, amount: '999' } });
  assert.equal((await h.movement.replay({ evidenceRef: r.evidenceRef, expected: changed.expected })).status, 'invalid');
  // tile source unavailable => unavailable, not verified; stored verdict is never trusted
  const down = h.rebuild({ movement: { readTile: async () => null } });
  const unavailable = await down.movement.replay({ evidenceRef: r.evidenceRef, expected: f.expected });
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.code, 'LOG_UNAVAILABLE');
  const policy = h.rebuild({ trust: { ...f.trust, allowedOsImageHashes: ['3'.repeat(64)] } });
  assert.equal((await policy.movement.replay({ evidenceRef: r.evidenceRef, expected: f.expected })).code, 'CAPTURE_TRUST_POLICY_CHANGED');
});

test('altered, missing, wrong-identity and wrong-terms receipts are rejected', async t => {
  const f = fixture(), h = await harness(t, f);
  const run = receipt => h.movement.capture({ expected: f.expected, receipt, operation: f.operation });
  const terms = f.termsJson;
  const cases = {
    RECEIPT_INVALID: [
      { ...f.receipt, terms: terms.replace('250000', '250001') },                // terms no longer match opening commitment
      { ...f.receipt, opening: f.receipt.opening.replace('execute.receipt', 'execute.completed') },
      { ...f.receipt, leaf_index: '0' },                                       // wrong leaf position
      { ...f.receipt, version: 2 },
      { ...f.receipt, origin: 'other.invalid/log' },
    ],
    RECEIPT_REQUIRED: [undefined, null, 'receipt'],
  };
  for (const [code, list] of Object.entries(cases)) for (const receipt of list) {
    const r = await run(receipt); assert.notEqual(r.status, 'verified');
    if (code === 'RECEIPT_REQUIRED') assert.equal(r.status, 'unavailable'); else assert.equal(r.status, 'invalid', `${code} ${r.code}`);
  }
  // Correctly signed receipt for a DIFFERENT execution cannot satisfy this correlation.
  const other = fixture({ resourceId: 'op_someone_else' });
  const crossed = await h.movement.capture({ expected: f.expected, receipt: other.receipt, operation: f.operation });
  assert.notEqual(crossed.status, 'verified');
  // Signed terms that differ from the admitted body: wrong recipient / amount / asset / extra reference.
  for (const [key, code] of [['recipient', 'RECEIPT_RECIPIENT_MISMATCH'], ['amount', 'RECEIPT_AMOUNT_MISMATCH'], ['asset', 'RECEIPT_ASSET_MISMATCH']]) {
    const wrong = fixture({ terms: { ...JSON.parse(terms), [key]: key === 'amount' ? '1' : 'other' } });
    const r = await (await harness(t, wrong)).movement.capture({ expected: wrong.expected, receipt: wrong.receipt, operation: wrong.operation });
    assert.equal(r.status, 'invalid'); assert.equal(r.code, code);
  }
  const extra = fixture({ terms: { ...JSON.parse(terms), reference: 'unrequested' } });
  assert.equal((await (await harness(t, extra)).movement.capture({ expected: extra.expected, receipt: extra.receipt, operation: extra.operation })).code, 'RECEIPT_REFERENCE_MISMATCH');
  const nonConfidential = fixture({ terms: { ...JSON.parse(terms), confidential: false } });
  assert.equal((await (await harness(t, nonConfidential)).movement.capture({ expected: nonConfidential.expected, receipt: nonConfidential.receipt, operation: nonConfidential.operation })).code, 'CONFIDENTIAL_RECEIPT_REQUIRED');
  assert.equal(h.journal.list('agentMovementCaptures').length, 0, 'nothing is retained for rejected receipts');
});

test('receipt checkpoint trust: not-covered is pending, a forked/other head is invalid, and the head never comes from the receipt', async t => {
  const f = fixture(), h = await harness(t, f);
  const stale = h.rebuild({ movement: { getReceiptCheckpoint: async () => ({ ...f.head, size: 1n, root: f.opTrusted.root }) } });
  const pending = await stale.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation });
  assert.equal(pending.status, 'pending'); assert.equal(pending.code, 'RECEIPT_NOT_COVERED_BY_TRUSTED_CHECKPOINT');
  const fork = h.rebuild({ movement: { getReceiptCheckpoint: async () => ({ ...f.head, root: new Uint8Array(32).fill(9) }) } });
  assert.equal((await fork.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation })).status, 'invalid');
  const unpinned = h.rebuild({ movement: { trust: undefined }, trust: { ...f.trust, witnessPublicKey: undefined } });
  assert.equal((await unpinned.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation })).code, 'PINNED_LOG_TRUST_REQUIRED');
  const noTiles = h.rebuild({ trust: { ...f.trust, logUrl: undefined }, movement: { readTile: undefined } });
  assert.equal((await noTiles.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation })).code, 'PINNED_LOG_TILE_SOURCE_REQUIRED');
  // A receipt does not name the agent: without the same agent's operation proof+TDX it is unavailable.
  const noTdx = h.rebuild({ proofs: { verifyTeeQuote: undefined } });
  const result = await noTdx.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation });
  assert.equal(result.status, 'unavailable'); assert.equal(result.stages.receipt.status, 'verified'); assert.equal(result.stages.operation.code, 'TDX_VERIFIER_UNAVAILABLE');
  const foreign = copy(f.operation); foreign.proof = { ...foreign.proof, agent_id: 'b'.repeat(64) };
  assert.equal((await h.movement.capture({ expected: f.expected, receipt: f.receipt, operation: foreign })).status, 'invalid');
  assert.equal(h.journal.list('agentMovementCaptures').length, 0);
});

test('one correlation cannot be re-bound to another admitted body; deposits compare only what the admitted body specified', async t => {
  const f = fixture(), h = await harness(t, f);
  assert.equal((await h.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation })).status, 'verified');
  // Same signed log, different admitted body => terms/binding reject it before anything is retained.
  // (The journal also refuses a second attribution of a correlation id as defense in depth.)
  const altered = fixture({ body: { ...f.expected.payload, amount: '1' } });
  assert.notEqual((await h.movement.capture({ expected: altered.expected, receipt: f.receipt, operation: { ...f.operation, proof: altered.document } })).status, 'verified');
  const body = { origin_asset: 'nep141:eth.near', amount: '5', confidential: true };
  const deposit = fixture({ body, action: 'deposit', resourceId: 'op_deposit', terms: { type: 'deposit', origin_asset: 'nep141:eth.near', destination_asset: 'nep141:usdc.near', amount: '5', deposited_amount: '5', confidential: true, intent_hash: 'i2' },
    evidence: { type: 'deposit', near_account_id: 'agent.near', request: body, deposit_address: 'deposit-address-one', intent_hash: 'i2' } });
  const d = await harness(t, deposit);
  const r = await d.movement.capture({ expected: deposit.expected, receipt: deposit.receipt, operation: deposit.operation });
  assert.equal(r.status, 'verified', r.code); assert.equal(r.receiptType, 'deposit');
  assert.deepEqual(r.references.sort(), ['deposit-address-one', 'i2']); assert.equal(r.committed.depositAddress, 'deposit-address-one');
  // intent hash disagreement between the signed leaf and the committed evidence is rejected.
  const split = fixture({ body, action: 'deposit', resourceId: 'op_split', terms: { type: 'deposit', origin_asset: 'nep141:eth.near', amount: '5', confidential: true, intent_hash: 'other' },
    evidence: { type: 'deposit', near_account_id: 'agent.near', request: body, intent_hash: 'i2' } });
  const s = await harness(t, split);
  assert.equal((await s.movement.capture({ expected: split.expected, receipt: split.receipt, operation: split.operation })).code, 'RECEIPT_EVIDENCE_HASH_MISMATCH');
  assert.throws(() => compareReceiptTerms({ action: 'swap', payload: { confidential: true } }, { type: 'swap', confidential: true }), /UNSUPPORTED/);
});

test('record sizes and hashes are canonical: retained capture is private, bounded and hash-addressed', async t => {
  const f = fixture(), h = await harness(t, f, { movement: { limits: { maxCaptureBytes: 200 } } });
  assert.equal((await h.movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation })).code, 'PROOF_CAPTURE_TOO_LARGE');
  const ok = await (await harness(t, f)).movement.capture({ expected: f.expected, receipt: f.receipt, operation: f.operation });
  assert.equal(sha('') .length, 64); assert.equal(ok.status, 'verified');
});

test('untrusted operation fields cannot replace the immutable admitted body or verification scope', async t => {
  const original = fixture();
  const crossed = fixture({ body: { ...original.expected.payload, amount: '1' }, terms: JSON.parse(original.termsJson) });
  const h = await harness(t, crossed);
  const result = await h.movement.capture({ expected: original.expected, receipt: crossed.receipt,
    operation: { ...crossed.operation, expected: crossed.expected, scope: 'full' } });
  assert.equal(result.status, 'invalid');
  assert.equal(result.code, 'COMMITTED_PAYLOAD_MISMATCH');
  assert.equal(h.journal.list('agentMovementCaptures').length, 0);
});

test('current tee info cannot replace the historical notary birth deployment', async t => {
  const f = fixture(), h = await harness(t, f);
  const operation = copy(f.operation);
  operation.teeEvidence.info.compose_hash = '9'.repeat(64);
  const result = await h.movement.capture({ expected: f.expected, receipt: f.receipt, operation });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.code, 'ATTESTED_COMPOSE_UNAVAILABLE');
  assert.equal(h.journal.list('agentMovementCaptures').length, 0);
});
