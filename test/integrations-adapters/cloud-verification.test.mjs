import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createWireCapture, bytesHash, createPreparedDispatch } from '../../src/inference/capture.mjs';
import { createCloudVerification, loadCloudVerificationSdk, CLOUD_VERIFICATION_SDK } from '../../src/inference/verification.mjs';
import { journalFor, clock } from './fixtures.mjs';

const spec = { route: 'near-tee-e2ee-chat', signingAlgo: 'ed25519', allowedTcbStatuses: ['UpToDate'], maxAttestationAgeMs: 300000,
  sdk: CLOUD_VERIFICATION_SDK, attestationCacheTimeToLiveMs: 0, signatureKind: 'provider_tee',
  requireGatewayAttestation: true, requireModelAttestation: true, requireResponseSignature: true, policyFingerprint: 'M01-test-policy' };

test('actual pinned SDK Node entry and public attestation/signature helpers load without a provider call', async () => {
  const sdk = await loadCloudVerificationSdk();
  assert.equal(CLOUD_VERIFICATION_SDK.version, '0.3.0');
  for (const name of ['InferenceClient','AttestationClient','prepareE2eeChatRequest','verifyGatewayAttestation','verifyModelAttestation','verifyModelResponse','verifyGatewayResponse']) assert.equal(typeof sdk[name], 'function');
});

test('public attestation preflight needs no inference key; paid preparation still fails before SDK I/O', async t => {
  const journal = await journalFor(t);
  let verificationCalls = 0, loads = 0;
  const engine = createCloudVerification({ journal, clock, secretRef: 'missing-test-key', resolveSecret: async () => null,
    limits: { maxEvidenceBytes: 100000, timeoutMs: 1000 },
    loadSdk: async () => {
      loads++;
      return { AttestationClient: class {}, InferenceClient: class {
        constructor(options) { assert.equal(options.apiKey, undefined); }
        async verify(model) {
          verificationCalls++;
          assert.equal(model, 'test/model');
          throw Object.assign(Error(), { code: 'TEST_PUBLIC_ATTESTATION_REACHED' });
        }
      } };
    } });
  const observed = await engine.preflight({ model: 'test/model', verificationSpec: spec });
  assert.equal(observed.status, 'unavailable');
  assert.equal(observed.reasonCode, 'TEST_PUBLIC_ATTESTATION_REACHED');
  assert.equal(verificationCalls, 1);
  const request = { model: 'test/model', verificationSpec: spec };
  await assert.rejects(engine.prepare({ actionId: 'paid-missing-key', request, verificationSpec: spec }), { code: 'CREDENTIAL_UNAVAILABLE' });
  assert.equal(loads, 1);
  assert.equal(verificationCalls, 1);
  assert.equal(journal.get('inferencePrepared', 'paid-missing-key'), null);
});

test('private capture stores exact request/response/signature bytes before SDK parsing; excludes credentials', async () => {
  const saved = [];
  const capture = createWireCapture({ clock, maxEvidenceBytes: 10000, persist: async record => { saved.push(structuredClone(record)); return `private:${saved.length}`; } });
  const body = ' {"model":"model/one", "messages": []}\n';
  const req = new Request('https://cloud-api.near.ai/v1/chat/completions', { method: 'POST', body,
    headers: { Authorization: 'Bearer private-secret', 'x-api-key': 'private-secret', 'X-Grant-Token': 'private-grant', 'x-no-aliasing': 'true' } });
  const request = await capture.request(req, 'completion');
  assert.equal(Buffer.from(request.bodyBase64, 'base64').toString(), body);
  const raw = '{ "id":"one", "choices":[]}\r\n';
  const response = await capture.response(new Response(raw, { headers: { 'inference-id': 'billing-id', 'set-cookie': 'private-cookie' } }), 'completion', { requestRef: request.evidenceRef });
  assert.equal(saved.length, 2); assert.equal(await response.response.text(), raw);
  assert.equal(saved[1].bodyHash, bytesHash(Buffer.from(raw)));
  assert.ok(!JSON.stringify(saved).includes('private-secret')); assert.ok(!JSON.stringify(saved).includes('private-grant')); assert.ok(!JSON.stringify(saved).includes('private-cookie'));
  assert.equal(saved[1].headers['inference-id'], 'billing-id');
});

test('capture overflow or persistence failure prevents forwarding bytes for parsing', async () => {
  const small = createWireCapture({ maxEvidenceBytes: 10, persist: async () => 'private:ref' });
  await assert.rejects(small.response(new Response('x'.repeat(11)), 'completion'), { code: 'EVIDENCE_BYTE_BOUND' });
  const failed = createWireCapture({ maxEvidenceBytes: 1000, persist: async () => { throw Error('disk failed'); } });
  await assert.rejects(failed.response(new Response('{}'), 'completion'), /disk failed/);
});

test('prepared final-gate callback starts transport synchronously once and exposes immutable wire hash', async () => {
  let started = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const finding = { requestFingerprint: 'request', requestBytesHash: 'wire', evidenceRef: 'private:ref' };
  const send = createPreparedDispatch({ start: () => { started++; return pending; }, finish: p => p, preflight: finding, now: () => 10, expiresAt: 20 });
  const result = send(); assert.equal(started, 1); assert.equal(send.requestBytesHash, 'wire');
  assert.throws(() => send(), { code: 'PREPARED_CALLBACK_ALREADY_USED' });
  release('accepted'); assert.equal(await result, 'accepted');
  const expired = createPreparedDispatch({ start: () => { started++; }, finish: x => x, preflight: finding, now: () => 20, expiresAt: 20 });
  assert.throws(() => expired(), { code: 'PREFLIGHT_EXPIRED' }); assert.equal(started, 1);
});

async function recordedBundle(t) {
  const journal = await journalFor(t);
  const pair = generateKeyPairSync('ed25519');
  const publicBytes = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const signer = { signingAlgo: 'ed25519', signingAddress: publicBytes.toString('hex') };
  const request = Buffer.from('{"model":"test/model","messages":[]}');
  const response = Buffer.from('{ "id":"test-response", "choices":[] }\n');
  const text = `test/model:${bytesHash(request)}:${bytesHash(response)}`;
  const signature = { kind: 'provider_tee', signer, signedText: text, signature: sign(null, Buffer.from(text), pair.privateKey).toString('hex') };
  const bundle = { schemaVersion: 1, sdk: CLOUD_VERIFICATION_SDK, actionId: 'synthetic-offline-wire-test', requestFingerprint: 'request-fingerprint', model: 'test/model',
    verificationSpec: spec, observedAt: clock().toISOString(), completionId: 'test-response', signature,
    normalized: { models: [{ attestation: { signer, nonce: 'not-a-real-attestation' }, clientBinding: { nonce: 'not-a-real-attestation' } }] },
    frames: [{ kind: 'completion', direction: 'request', bodyBase64: request.toString('base64'), bodyHash: bytesHash(request) },
      { kind: 'completion', direction: 'response', bodyBase64: response.toString('base64'), bodyHash: bytesHash(response) }] };
  async function persist(value) { const ref = await journal.putArtifact({ actionId: `test-bundle:${Math.random()}`, content: JSON.stringify(value) }); return `private:${ref.id}`; }
  const evidenceRef = await persist(bundle);
  const verification = createCloudVerification({ journal, clock, limits: { maxEvidenceBytes: 100000, timeoutMs: 1000 } });
  return { journal, bundle, persist, verification, input: { evidenceRef, requestFingerprint: bundle.requestFingerprint, verificationSpec: spec } };
}

test('restart replay executes actual SDK Ed25519/wire helpers but never trusts saved TCB/proof booleans', async t => {
  const { bundle, verification, input } = await recordedBundle(t);
  // Deliberately no real TDX evidence. Crypto success must not become TEE proof.
  bundle.verified = true;
  const result = await verification.replay(input);
  assert.equal(result.wireSignatureVerified, true); assert.equal(result.status, 'unavailable');
  assert.equal(result.plaintextBindingStatus, 'unavailable'); assert.equal(result.durableReplayStatus, 'unavailable');
  assert.equal(result.gateway, null); assert.deepEqual(result.models, []);
  assert.equal(result.reasonCode, 'OFFLINE_ATTESTATION_COLLATERAL_REPLAY_UNSUPPORTED');
});

test('one-byte/whitespace changes, missing signature, signer rotation and policy replay cannot be verified', async t => {
  const { bundle, persist, verification, input } = await recordedBundle(t);
  const changed = structuredClone(bundle); changed.frames[1].bodyBase64 = Buffer.from('{"id":"different"}').toString('base64');
  await assert.rejects(verification.replay({ ...input, evidenceRef: await persist(changed) }), { code: 'EVIDENCE_BYTES_MISMATCH' });
  changed.frames[1].bodyHash = bytesHash(Buffer.from(changed.frames[1].bodyBase64, 'base64'));
  assert.equal((await verification.replay({ ...input, evidenceRef: await persist(changed) })).wireSignatureVerified, false);
  const missing = structuredClone(bundle); delete missing.signature;
  assert.equal((await verification.replay({ ...input, evidenceRef: await persist(missing) })).status, 'unavailable');
  const rotated = structuredClone(bundle); rotated.signature.signer.signingAddress = '00'.repeat(32);
  assert.equal((await verification.replay({ ...input, evidenceRef: await persist(rotated) })).wireSignatureVerified, false);
  await assert.rejects(verification.replay({ ...input, verificationSpec: { ...spec, policyFingerprint: 'other-policy' } }), { code: 'REPLAY_BINDING_MISMATCH' });
});

test('read-only preflight/prepare without explicit spec, private journal or limits fails before any SDK/provider I/O', async () => {
  const a = createCloudVerification();
  await assert.rejects(a.preflight({ model: 'test/model' }), { code: 'VERIFICATION_SPEC_REQUIRED' });
  await assert.rejects(a.preflight({ model: 'test/model', requestFingerprint: 'p', verificationSpec: spec }), { code: 'VERIFICATION_STORAGE_AND_LIMITS_REQUIRED' });
});
