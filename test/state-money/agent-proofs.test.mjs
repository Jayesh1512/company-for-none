import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as officialSdk from '@near-intents-agent-api/sdk';
import { fingerprint } from '../../src/contracts.mjs';
import { createJournal } from '../../src/journal/index.mjs';
import { createAgentProofs, DSTACK_VERIFIER_IMAGE } from '../../src/custody/proofs.mjs';

const digest = input => createHash('sha256').update(input).digest();
const sha = input => digest(input).toString('hex');
const copy = value => structuredClone(value);
const txHash = 'C'.repeat(44);

// Test-only signed c2sp/audit fixtures, following the official SDK's MIT-licensed
// generated audit/note/tlog format at commit a0bff55281d68e2e73a6b179fa2e4ca967a0b069.
// Node's Ed25519 signs; the real official SDK verifies. TDX/RPC ports below are
// synthetic service observations, never live hardware or settlement evidence.
function fixture({ evidence: supplied, prior = false, status = 'SUCCESS' } = {}) {
  const origin = 'agent-proof-test.invalid/log';
  const expected = { agentId: 'a'.repeat(64), accountId: 'agent.near', correlationId: 'op_test_execution', action: 'transfer', payload: { asset: 'near', amount: '100', recipient: 'payee.near', confidential: false }, requiredEvent: 'execute.completed' };
  expected.requestFingerprint = fingerprint(expected.payload);
  const evidence = supplied ?? { type: 'transfer', near_account_id: expected.accountId, request: copy(expected.payload), tx_hash: txHash };
  const evidenceJson = JSON.stringify(evidence);
  const fields = { agentId: expected.agentId, resourceId: expected.correlationId, action: expected.requiredEvent, createdAt: '2026-10-06T00:00:00.000Z', evidenceHash: sha(evidenceJson) };
  const openingObject = Object.fromEntries(Object.entries({ ...fields, salt: Buffer.alloc(32, 7).toString('base64') }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const opening = Buffer.from(`near-intents-agent-api/audit/v1\n${JSON.stringify(openingObject)}`);
  const leaf = digest(Buffer.concat([Buffer.from([0]), digest(opening)]));
  const earlier = digest('earlier test leaf');
  const root = prior ? digest(Buffer.concat([Buffer.from([1]), earlier, leaf])) : leaf;
  const size = prior ? 2n : 1n;
  const checkpointText = `${origin}\n${size}\n${root.toString('base64')}\n`;
  const log = generateKeyPairSync('ed25519'), notary = generateKeyPairSync('ed25519');
  const pub = pair => pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const keyId = (name, type, pair) => digest(Buffer.concat([Buffer.from(name), Buffer.from([10, type]), pub(pair)])).subarray(0, 4);
  const verifierKey = (name, type, pair) => `${name}+${keyId(name, type, pair).toString('hex')}+${Buffer.concat([Buffer.from([type]), pub(pair)]).toString('base64')}`;
  const logSignature = sign(null, Buffer.from(checkpointText), log.privateKey);
  const cosignedAt = 1791000000n, timestamp = Buffer.alloc(8); timestamp.writeBigUInt64BE(cosignedAt);
  const cosignature = Buffer.concat([timestamp, sign(null, Buffer.from(`cosignature/v1\ntime ${cosignedAt}\n${checkpointText}`), notary.privateKey)]);
  const logLine = `— ${origin} ${Buffer.concat([keyId(origin, 1, log), logSignature]).toString('base64')}\n`;
  const notaryName = 'agent-proof-test.invalid/notary';
  const notaryLine = `— ${notaryName} ${Buffer.concat([keyId(notaryName, 4, notary), cosignature]).toString('base64')}\n`;
  const note = `${checkpointText}\n${logLine}${notaryLine}`;
  const signingAddress = Buffer.concat([pub(log), pub(notary)]);
  const birthReportData = Buffer.concat([digest(Buffer.concat([Buffer.from('near-intents-agent-api/notary-birth/v1'), signingAddress])), Buffer.alloc(32)]).toString('hex');
  const document = { agent_id: expected.agentId, correlation_id: expected.correlationId, origin, checkpoint: note,
    consistency: prior ? { from_size: '1', hashes: [leaf.toString('base64')] } : null,
    notary: { log_key: verifierKey(origin, 1, log), notary_key: verifierKey(notaryName, 4, notary), signing_address: signingAddress.toString('hex'), birth: { report_data: birthReportData, previous: null, attestation: 'synthetic-not-a-live-TDX-quote' } },
    events: [{ action: fields.action, created_at: fields.createdAt, status: 'PROVEN', proof: `c2sp.org/tlog-proof@v1\nextra ${opening.toString('base64')}\nindex ${prior ? 1 : 0}\n${prior ? `${earlier.toString('base64')}\n` : ''}\n${note}`, evidence: evidenceJson }] };
  const trusted = { origin, size: prior ? 1n : 0n, root: Uint8Array.from(prior ? earlier : digest(Buffer.alloc(0))), extensions: [] };
  const kmsRoot = '02' + '7'.repeat(64);
  const compose = JSON.stringify({ key_provider: 'kms', key_provider_id: kmsRoot, gateway_enabled: false, docker_compose_file: 'synthetic fixture' });
  const trust = { origin, apiBaseUrl: 'https://agent-proof-test.invalid', witnessPublicKey: '1'.repeat(64), expectedAppId: 'test-app', allowedComposeHashes: [sha(compose)], allowedOsImageHashes: ['2'.repeat(64)], kmsRoot, dstackVerifierImage: DSTACK_VERIFIER_IMAGE, network: 'near:mainnet' };
  const info = { app_id: 'test-app', compose_hash: sha(compose), os_image_hash: '2'.repeat(64), app_compose: compose };
  const quoteReply = { source: 'dstack-verifier', verifierImage: DSTACK_VERIFIER_IMAGE, quoteHash: sha(document.notary.birth.attestation), verdict: { is_valid: true, details: { report_data: birthReportData, os_image_is_dev: null, tcb_status: 'UpToDate', advisory_ids: [], app_info: { app_id: info.app_id, compose_hash: info.compose_hash, os_image_hash: info.os_image_hash } } } };
  const finality = { source: 'near-rpc', network: 'near:mainnet', transactions: [{ hash: txHash, response: { result: { final_execution_status: 'FINAL', status: { SuccessValue: '' }, transaction: { hash: txHash }, receipts_outcome: [] } } }] };
  const input = { expected, proof: document, statusEvidence: { agent_id: expected.agentId, correlation_id: expected.correlationId, type: expected.action, status }, teeEvidence: { info } };
  return { expected, document, trusted, trust, input, quoteReply, finality };
}
async function setup(t, f, overrides = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'near1-agent-proofs-'));
  let journal = await createJournal({ directory });
  const ports = { trust: f.trust, getTrustedCheckpoint: async () => f.trusted, verifyTeeQuote: async () => copy(f.quoteReply), observeFinality: async () => copy(f.finality), ...overrides };
  let verifier = createAgentProofs({ journal, ...ports });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return { get journal() { return journal; }, get verifier() { return verifier; }, rebuild(extra = {}) { verifier = createAgentProofs({ journal, ...ports, ...extra }); return verifier; }, async restart(extra = {}) { await journal.close(); journal = await createJournal({ directory }); verifier = createAgentProofs({ journal, ...ports, ...extra }); } };
}

test('official SDK verifies real signed fixture; wrapper separates audit, payload, TDX and finality', async t => {
  const f = fixture({ prior: true }), h = await setup(t, f);
  assert.equal(officialSdk.verifyOperationProof(f.document, f.trust.origin, f.trusted).proven.length, 1);
  const result = await h.verifier.capture(f.input);
  assert.equal(result.status, 'verified', result.code);
  assert.deepEqual(Object.values(result.stages).map(stage => stage.status), ['verified', 'verified', 'verified', 'verified']);
  assert.match(result.evidenceRef, /^agent-proof:[a-f0-9]{64}$/);
  assert.equal(result.grantsSpendingAuthority, false); assert.equal(result.grantsDeliveryAuthority, false);
  assert.equal(h.journal.get('treasury', 'financial'), null); assert.equal(h.journal.events().length, 0);
});

test('private restart replay reruns SDK and quote/finality ports using retained independent head', async t => {
  const f = fixture({ prior: true }); let quoteChecks = 0, finalityChecks = 0;
  const h = await setup(t, f, { verifyTeeQuote: async () => { quoteChecks++; return copy(f.quoteReply); }, observeFinality: async () => { finalityChecks++; return copy(f.finality); } });
  const result = await h.verifier.capture(f.input);
  assert.equal(result.status, 'verified', result.code);
  await h.restart({ getTrustedCheckpoint: async () => { throw Error('Replay must use private retained head'); }, clock: () => new Date('2030-01-01T00:00:00Z') });
  const replayed = await h.verifier.replay({ evidenceRef: result.evidenceRef, expected: f.expected });
  assert.equal(replayed.status, 'verified', replayed.code); assert.equal(quoteChecks, 2); assert.equal(finalityChecks, 2);
  assert.equal(replayed.replayScope, 'retained-trusted-checkpoint');
  const missingTdx = h.rebuild({ verifyTeeQuote: undefined });
  const unavailable = await missingTdx.replay({ evidenceRef: result.evidenceRef, expected: f.expected });
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.stages.audit.status, 'verified');
});

test('wrong caller IDs, modified evidence, invalid signature and forked checkpoints fail', async t => {
  const f = fixture({ prior: true }), h = await setup(t, f);
  const cases = [
    { ...f.input, proof: { ...f.document, agent_id: 'other-agent' } },
    { ...f.input, proof: { ...f.document, correlation_id: 'op_other' } },
    { ...f.input, proof: { ...f.document, events: [{ ...f.document.events[0], evidence: f.document.events[0].evidence.replace('100', '101') }] } },
    { ...f.input, proof: { ...f.document, checkpoint: f.document.checkpoint.replace(/—.*\n/, '— forged AAAA\n') } },
    { ...f.input, proof: { ...f.document, consistency: null } },
  ];
  for (const input of cases) assert.equal((await h.verifier.capture(input)).status, 'invalid');
  const forked = h.rebuild({ getTrustedCheckpoint: async () => ({ ...f.trusted, root: new Uint8Array(32).fill(99) }) });
  assert.equal((await forked.capture(f.input)).status, 'invalid');
});

test('signed missing account/payload is unavailable; signed wrong payload is invalid', async t => {
  const base = fixture();
  const absent = fixture({ evidence: { type: 'transfer', request: base.expected.payload, tx_hash: txHash } }), h = await setup(t, absent);
  const noAccount = await h.verifier.capture(absent.input);
  assert.equal(noAccount.status, 'unavailable'); assert.equal(noAccount.code, 'ACCOUNT_BINDING_UNAVAILABLE');
  const wrong = fixture({ evidence: { type: 'transfer', near_account_id: base.expected.accountId, request: { ...base.expected.payload, amount: '101' }, tx_hash: txHash } });
  const denied = await h.rebuild({ trust: wrong.trust, getTrustedCheckpoint: async () => wrong.trusted }).capture(wrong.input);
  assert.equal(denied.status, 'invalid'); assert.equal(denied.code, 'COMMITTED_PAYLOAD_MISMATCH');
});

test('missing actual quote/finality ports and provider-style valid booleans never verify', async t => {
  const f = fixture(), h = await setup(t, f, { verifyTeeQuote: undefined });
  const noTdx = await h.verifier.capture(f.input);
  assert.equal(noTdx.status, 'unavailable'); assert.equal(noTdx.stages.audit.status, 'verified');
  const falsePort = await h.rebuild({ verifyTeeQuote: async () => ({ valid: true, verified: true }) }).capture(f.input);
  assert.equal(falsePort.status, 'unavailable'); assert.equal(falsePort.code, 'ACTUAL_TDX_VERIFIER_EVIDENCE_REQUIRED');
  const noFinality = await h.rebuild({ verifyTeeQuote: async () => copy(f.quoteReply), observeFinality: undefined }).capture(f.input);
  assert.equal(noFinality.status, 'unavailable'); assert.equal(noFinality.stages.tee.status, 'verified');
  const booleanFinality = await h.rebuild({ verifyTeeQuote: async () => copy(f.quoteReply), observeFinality: async () => ({ valid: true, final: true, source: 'provider' }) }).capture(f.input);
  assert.equal(booleanFinality.status, 'unavailable');
});

test('TDX report data, deployment, TCB, OS and KMS trust are mandatory independent checks', async t => {
  const f = fixture(), h = await setup(t, f);
  for (const change of [
    reply => { reply.verdict.details.report_data = '0'.repeat(128); },
    reply => { reply.verdict.details.tcb_status = 'OutOfDate'; },
    reply => { reply.verdict.details.advisory_ids = ['INTEL-SA-test']; },
    reply => { reply.verdict.details.app_info.app_id = 'other'; },
    reply => { reply.verdict.details.os_image_is_dev = true; },
  ]) {
    const reply = copy(f.quoteReply); change(reply);
    assert.equal((await h.rebuild({ verifyTeeQuote: async () => reply }).capture(f.input)).status, 'invalid');
  }
  const noPins = await h.rebuild({ trust: { ...f.trust, allowedComposeHashes: [] } }).capture(f.input);
  assert.equal(noPins.status, 'unavailable'); assert.equal(noPins.code, 'PINNED_TDX_DEPLOYMENT_REQUIRED');
  const wrongCompose = copy(f.input); wrongCompose.teeEvidence.info.app_compose = '{}';
  assert.equal((await h.rebuild().capture(wrongCompose)).status, 'unavailable');
});

test('confidential intent hash alone and provider SUCCESS are not independent settlement proof', async t => {
  const base = fixture(); let finalityCalled = false;
  const f = fixture({ evidence: { type: 'transfer', near_account_id: base.expected.accountId, request: base.expected.payload, intent_hash: 'provider-intent-hash' } });
  const h = await setup(t, f, { observeFinality: async () => { finalityCalled = true; return f.finality; } });
  const result = await h.verifier.capture(f.input);
  assert.equal(result.status, 'unavailable'); assert.equal(result.code, 'INDEPENDENT_SETTLEMENT_PROOF_UNAVAILABLE');
  assert.equal(result.stages.audit.status, 'verified'); assert.equal(finalityCalled, false);
});

test('pending/unlogged events and unfinished chain observations preserve separate states', async t => {
  const f = fixture(), h = await setup(t, f);
  for (const [status, expected] of [['PENDING', 'pending'], ['UNLOGGED', 'unavailable']]) {
    const input = copy(f.input); input.proof.events[0] = { ...input.proof.events[0], status, proof: null };
    assert.equal((await h.verifier.capture(input)).status, expected);
  }
  const pendingChain = copy(f.finality); pendingChain.transactions[0].response.result.final_execution_status = 'EXECUTED';
  const result = await h.rebuild({ observeFinality: async () => pendingChain }).capture(f.input);
  assert.equal(result.status, 'pending'); assert.equal(result.code, 'SETTLEMENT_NOT_FINAL');
  const failedChain = copy(f.finality); failedChain.transactions[0].response.result.status = { Failure: { ActionError: {} } };
  assert.equal((await h.rebuild({ observeFinality: async () => failedChain }).capture(f.input)).status, 'invalid');
});

test('private capture bounds, replay hash, expected identity and policy pins cannot be bypassed', async t => {
  const f = fixture(), h = await setup(t, f);
  const tooLarge = await h.rebuild({ limits: { maxCaptureBytes: 300 } }).capture(f.input);
  assert.equal(tooLarge.status, 'invalid'); assert.equal(tooLarge.evidenceRef, null);
  const result = await h.rebuild().capture(f.input); assert.equal(result.status, 'verified');
  const changedExpected = await h.verifier.replay({ evidenceRef: result.evidenceRef, expected: { ...f.expected, accountId: 'other.near' } });
  assert.equal(changedExpected.status, 'invalid');
  const changedPolicy = await h.rebuild({ trust: { ...f.trust, witnessPublicKey: '4'.repeat(64) } }).replay({ evidenceRef: result.evidenceRef, expected: f.expected });
  assert.equal(changedPolicy.status, 'unavailable'); assert.equal(changedPolicy.code, 'CAPTURE_TRUST_POLICY_CHANGED');
  const id = result.evidenceRef.slice('agent-proof:'.length), capture = h.journal.get('agentProofCaptures', id);
  const artifact = h.journal.getArtifact(capture.artifact);
  await h.journal.transaction({ actionId: 'simulate-corruption', fingerprint: 'local-only-test' }, tx => { tx.put('privateArtifacts', artifact.id, { ...artifact, content: artifact.content.replace('agent.near', 'forged.near') }); return null; });
  const corrupt = await h.rebuild().replay({ evidenceRef: result.evidenceRef, expected: f.expected });
  assert.equal(corrupt.status, 'invalid'); assert.equal(corrupt.code, 'PRIVATE_CAPTURE_HASH_MISMATCH');
});

test('bounded trusted-port errors return unavailable without issuing effects', async t => {
  const f = fixture(), h = await setup(t, f, { getTrustedCheckpoint: async () => { throw Error('no independent witness'); } });
  const missingHead = await h.verifier.capture(f.input); assert.equal(missingHead.status, 'unavailable');
  const timeout = await h.rebuild({ getTrustedCheckpoint: async () => f.trusted, verifyTeeQuote: async () => new Promise(() => {}), limits: { timeoutMs: 10 } }).capture(f.input);
  assert.equal(timeout.status, 'unavailable'); assert.equal(timeout.code, 'VERIFICATION_PORT_UNAVAILABLE');
});
