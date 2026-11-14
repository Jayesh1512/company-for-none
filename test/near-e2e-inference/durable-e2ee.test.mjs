// REAL: installed SDK request encryption and Ed25519 wire-signature verification.
// SYNTHETIC: model signer, attestation/TCB/nonce, network and response decryption.
// These tests never claim live TEE execution or independently recoverable E2EE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateKeyPairSync, sign } from 'node:crypto';
import { journalFor, clock } from '../integrations-adapters/fixtures.mjs';
import { createJournal } from '../../src/journal/index.mjs';
import { bytesHash } from '../../src/inference/capture.mjs';
import { createCloudVerification, loadCloudVerificationSdk, CLOUD_VERIFICATION_SDK, CLOUD_DURABLE_RECOVERY } from '../../src/inference/verification.mjs';
import { createCloudComponents } from '../../src/runtime/components.mjs';
import { verificationSpec, verifyInferenceEvidence } from '../../src/rules/verification.mjs';
import { fingerprint } from '../../src/contracts.mjs';

const spec = verificationSpec();
const model = 'synthetic/model';
function harness(t, { networkText = 'Synthetic verified answer', failVerify = false } = {}) {
  const signerPair = generateKeyPairSync('ed25519');
  const signerHex = signerPair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const signer = { signingAlgo: 'ed25519', signingAddress: signerHex };
  const report = { nonce: 'synthetic-nonce-not-a-tdx-report', signer };
  const attest = { tcbStatus: 'UpToDate', report, signer, deploymentProvenance: 'synthetic', deployment: { runtimeMeasurements: { synthetic: true } }, signingPublicKey: signerHex };
  const calls = { completions: 0 };
  return { calls, signer, signerPair, attest, networkText, failVerify,
    sdk: async () => {
      const real = await loadCloudVerificationSdk();
      class FakeInferenceClient {
        constructor(options) { this.options = options; this.registered = new Map(); }
        async verify(modelId) { const s = await this.createVerificationState(modelId); return { verifiedAt: clock().getTime(), gateway: s.attestationResult.gateway, models: s.attestationResult.models }; }
        async createVerificationState() {
          return { attestationResult: { gateway: { ...attest, tlsBinding: { kind: 'attested' } }, models: [attest] }, modelKey: { signingAlgo: 'ed25519', publicKey: signerHex },
            transport: { fetch: this.createGatewayFetch(null), fetchCompletionSignature: async ({ completionId }) => this.signatures.get(completionId) } };
        }
        createGatewayFetch() {
          return async request => {
            calls.completions++;
            const replyPub = request.headers.get('x-client-pub-key'); const requestBytes = Buffer.from(await request.clone().arrayBuffer());
            const body = JSON.stringify({ id: 'chatcmpl-synthetic', object: 'chat.completion', model, usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
              choices: [{ index: 0, message: { role: 'assistant', content: 'synthetic-ciphertext-not-real-e2ee' }, finish_reason: 'stop' }] });
            const text = `${model}:${bytesHash(requestBytes)}:${bytesHash(Buffer.from(body))}`;
            (this.signatures ??= new Map()).set('chatcmpl-synthetic', { kind: 'provider_tee', signer, signedText: text, signature: sign(null, Buffer.from(text), signerPair.privateKey).toString('hex') });
            return new Response(body, { headers: { 'content-type': 'application/json', 'inference-id': 'synthetic-inference-id' } });
          };
        }
        registerResponse(captured) { this.registered.set(captured.id, captured); }
        async verifyResponse(id) {
          if (failVerify) throw Object.assign(Error(), { code: 'SYNTHETIC_SIGNATURE_FAILURE' });
          const r = this.registered.get(id); const signature = await r.session.transport.fetchCompletionSignature({ completionId: id });
          real.verifyModelResponse({ requestBody: r.requestBody, responseBody: await r.responseBody, signature, attestation: { signer } });
          return { signatureKind: 'provider_tee', signature, attestations: [attest] };
        }
      }
      return { ...real, AttestationClient: class {}, InferenceClient: FakeInferenceClient,
        prepareE2eeChatRequest: async params => {
          calls.preparationInput = await params.request.clone().json();
          const prepared = await real.prepareE2eeChatRequest(params);
          calls.preparedWire = await prepared.request.clone().json();
          // SYNTHETIC decryption port: no custom cryptography or RNG hooks. Real
          // SDK encryption and wire-signature checks run; this is NOT E2EE/TEE evidence.
          return { ...prepared, decryptResponse: async response => {
            const body = await response.json(); body.choices[0].message.content = networkText;
            return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
          } };
        } };

    } };
}
const genRequest = () => ({ model, messages: [{ role: 'user', content: 'private prompt' }], maxInputBytes: 1000, maxOutputTokens: 20, timeoutMs: 5000, verificationSpec: spec,
  chargeBound: { maxCostNanoUsd: '1000' } });
async function runFlow(t, options = {}, journalOptions) {
  const h = harness(t, options); const journal = await journalFor(t, journalOptions);
  const engine = createCloudVerification({ journal, clock, secretRef: 'synthetic', resolveSecret: async () => 'synthetic-key-never-sent', loadSdk: h.sdk,
    limits: { maxEvidenceBytes: 400000, timeoutMs: 5000 }, ...options.engine });
  const request = genRequest(), requestFingerprint = fingerprint(request);
  const action = { id: options.actionId ?? 'synthetic-e2ee-action', type: 'inference', requestFingerprint };
  const send = await engine.prepare({ action, request, verificationSpec: spec });
  return { h, journal, engine, request, requestFingerprint, action, send };
}

test('supported SDK has no durable key API; factory/export are frozen and construction never patches global RNG', async () => {
  const real = await loadCloudVerificationSdk();
  const require = createRequire(import.meta.url);
  const nacl = createRequire(require.resolve('@nearai/inference-sdk/node'))('tweetnacl');
  const original = nacl.setPRNG; let mutations = 0, loads = 0;
  nacl.setPRNG = () => { mutations++; throw Error('Global PRNG mutation forbidden'); };
  try {
    const engine = createCloudVerification({ loadSdk: () => { loads++; return real; } });
    assert.ok(Object.isFrozen(engine) && Object.isFrozen(CLOUD_DURABLE_RECOVERY));
    assert.equal(CLOUD_DURABLE_RECOVERY.supported, false);
    for (const options of [{ durableReplyKey: true }, { captureReplyKey: () => {} }, { nacl }])
      assert.throws(() => createCloudVerification({ ...options, loadSdk: () => { loads++; return real; } }), { code: 'SDK_DURABLE_REPLY_KEY_UNSUPPORTED' });
    assert.equal(mutations, 0); assert.equal(loads, 0);
    const pair = generateKeyPairSync('ed25519');
    const prepared = await real.prepareE2eeChatRequest({ request: new Request('https://cloud-api.near.ai/v1/chat/completions', {
      method: 'POST', body: JSON.stringify({ model, messages: [{ role: 'user', content: 'private input' }] }) }),
      modelKey: { signingAlgo: 'ed25519', publicKey: pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex') } });
    assert.deepEqual(Object.keys(prepared).sort(), ['decryptResponse', 'request']);
    assert.equal(prepared.request.headers.get('x-encryption-version'), '3');
    assert.notEqual(JSON.parse(await prepared.request.text()).messages[0].content, 'private input');
    assert.equal(mutations, 0);
  } finally { nacl.setPRNG = original; }
  assert.equal(nacl.setPRNG, original);
});

test('SYNTHETIC process verification never becomes durable plaintext proof or admitted business commands', async t => {
  const { send, journal, request, requestFingerprint, action, h } = await runFlow(t);
  assert.equal(h.calls.completions, 0);
  const prepared = journal.get('inferencePrepared', action.id);
  assert.ok(prepared.requestFrameRef && prepared.evidenceRun);
  assert.equal(prepared.replyKeyRef, undefined);
  assert.equal(h.calls.preparationInput.max_completion_tokens, request.maxOutputTokens);
  assert.equal(Object.hasOwn(h.calls.preparationInput, 'max_tokens'), false);
  assert.equal(h.calls.preparedWire.max_completion_tokens, request.maxOutputTokens);
  assert.equal(Object.hasOwn(h.calls.preparedWire, 'max_tokens'), false);
  assert.equal(h.calls.preparedWire.n, 1); assert.equal(h.calls.preparedWire.stream, false);
  assert.equal(prepared.requestBytesHash, bytesHash(Buffer.from(JSON.stringify(h.calls.preparedWire))));
  const result = await send();
  assert.equal(h.calls.completions, 1);
  assert.throws(() => send(), { code: 'PREPARED_CALLBACK_ALREADY_USED' });
  assert.equal(result.proof.processVerificationStatus, 'verified');
  assert.equal(result.proof.wireSignatureVerified, true);
  assert.equal(result.proof.status, 'unavailable');
  assert.equal(result.proof.plaintextBindingStatus, 'unavailable');
  assert.equal(result.proof.durableReplayStatus, 'unavailable');
  const runtime = { verificationResults: [send.preflight, result.proof] };
  const decision = verifyInferenceEvidence('response', { request, requestFingerprint, output: result.generation.output }, runtime, undefined, clock().getTime());
  assert.equal(decision.status, 'hold');
  const b = JSON.parse(journal.getArtifact({ id: result.proof.evidenceRef.slice(8), hash: result.proof.evidenceRef.slice(8) }).content);
  assert.ok(b.frames.find(f => f.kind === 'completion' && f.direction === 'response'));
  assert.equal(b.replyKeyRef, undefined);
});

test('SYNTHETIC signature failure preserves unavailable statuses despite process output', async t => {
  const { send } = await runFlow(t, { failVerify: true });
  const proof = (await send()).proof;
  assert.equal(proof.status, 'unavailable'); assert.equal(proof.wireSignatureVerified, false);
  assert.equal(proof.reasonCode, 'SYNTHETIC_SIGNATURE_FAILURE');
  assert.equal(proof.durableReplayStatus, 'unavailable');
});

async function altered(journal, ref, edit) {
  const id = ref.slice(8), bundle = JSON.parse(journal.getArtifact({ id, hash: id }).content);
  edit(bundle);
  const saved = await journal.putArtifact({ actionId: `mutation:${Math.random()}`, content: JSON.stringify(bundle) });
  return `private:${saved.id}`;
}

test('SYNTHETIC replay checks original signed bytes, nonce/signer/model bindings and ignores forged plaintext/key/success fields', async t => {
  const { send, journal, requestFingerprint } = await runFlow(t);
  const live = (await send()).proof;
  const restart = createCloudVerification({ journal, clock, limits: { maxEvidenceBytes: 400000, timeoutMs: 5000 } });
  const input = { evidenceRef: live.evidenceRef, requestFingerprint, verificationSpec: spec };
  const baseline = await restart.replay(input);
  assert.equal(baseline.wireSignatureVerified, true); assert.equal(baseline.status, 'unavailable');
  const replayEdit = async edit => restart.replay({ ...input, evidenceRef: await altered(journal, live.evidenceRef, edit) });
  const whitespace = await replayEdit(b => {
    const frame = b.frames.find(f => f.kind === 'completion' && f.direction === 'response');
    frame.bodyBase64 = Buffer.from(Buffer.from(frame.bodyBase64, 'base64').toString() + '\n').toString('base64');
    frame.bodyHash = bytesHash(Buffer.from(frame.bodyBase64, 'base64'));
  });
  assert.equal(whitespace.wireSignatureVerified, false);
  const nonce = await replayEdit(b => { b.normalized.models[0].clientBinding.nonce = 'different-nonce'; });
  assert.equal(nonce.wireSignatureVerified, false); assert.equal(nonce.reasonCode, 'NONCE_BINDING_MISMATCH');
  const signer = await replayEdit(b => { b.signature.signer.signingAddress = '00'.repeat(32); });
  assert.equal(signer.wireSignatureVerified, false);
  const wrongModel = await replayEdit(b => { b.model = 'other/model'; });
  assert.equal(wrongModel.wireSignatureVerified, false); assert.equal(wrongModel.reasonCode, 'REPLAY_MODEL_BINDING_MISMATCH');
  const forged = await replayEdit(b => {
    b.verified = true; b.status = 'verified'; b.plaintextBindingStatus = 'verified'; b.durableReplayStatus = 'verified';
    b.replyKeyRef = `private:${'0'.repeat(64)}`;
    b.plaintextFrame = { bodyBase64: Buffer.from('{"choices":[{"message":{"content":"forged commands"}}]}').toString('base64') };
  });
  assert.equal(forged.status, 'unavailable'); assert.equal(forged.plaintextBindingStatus, 'unavailable');
  assert.equal(forged.durableReplayStatus, 'unavailable');
  assert.equal(journal.get('inferenceVerification', live.id).stage, 'response');
});

async function crashFlow(t, failWhen) {
  const directory = await mkdtemp(join(tmpdir(), 'near1-s2-restart-'));
  const journal = await createJournal({ directory, clock });
  let current = journal, failing = false;
  t.after(async () => { await current.close(); await rm(directory, { recursive: true, force: true }); });
  const wrapped = new Proxy(journal, { get(target, prop) {
    if (prop === 'putArtifact') return async arg => {
      if (failing && failWhen(arg, JSON.parse(arg.content))) throw Error('simulated process crash');
      return target.putArtifact(arg);
    };
    const value = target[prop]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  const h = harness(t), request = genRequest(), requestFingerprint = fingerprint(request);
  const action = { id: 'synthetic-crash-action', type: 'inference', requestFingerprint };
  const engine = createCloudVerification({ journal: wrapped, clock, secretRef: 'synthetic', resolveSecret: async () => 'synthetic-key', loadSdk: h.sdk,
    limits: { maxEvidenceBytes: 400000, timeoutMs: 5000 } });
  const send = await engine.prepare({ action, request, verificationSpec: spec });
  failing = true;
  return { h, send, action, requestFingerprint, reopen: async () => {
    await current.close(); current = await createJournal({ directory, clock });
    return { journal: current, engine: createCloudVerification({ journal: current, clock, limits: { maxEvidenceBytes: 400000, timeoutMs: 5000 } }) };
  } };
}

test('SYNTHETIC disk restart before bundle recovers signed wire evidence only, never output or a resend', async t => {
  const { h, send, action, requestFingerprint, reopen } = await crashFlow(t, arg => arg.actionId.startsWith('cloud-bundle:') && arg.actionId.includes(':response:'));
  await assert.rejects(send(), /simulated process crash/);
  assert.equal(h.calls.completions, 1);
  const { engine, journal } = await reopen();
  const input = { actionId: action.id, model, requestFingerprint, verificationSpec: spec };
  const recovered = await engine.recover(input);
  assert.equal(recovered.verification.wireSignatureVerified, true);
  assert.equal(recovered.verification.status, 'unavailable');
  assert.equal(recovered.verification.plaintextBindingStatus, 'unavailable');
  assert.equal(recovered.verification.durableReplayStatus, 'unavailable');
  assert.equal(recovered.output, null); assert.equal(recovered.status, 'unknown');
  assert.equal(recovered.completionSent, false); assert.equal(recovered.originalCompletionCaptured, true);
  assert.equal(recovered.cost.status, 'pending'); assert.equal(h.calls.completions, 1);
  await assert.rejects(engine.prepare({ action, request: genRequest(), verificationSpec: spec }), { code: 'PREPARED_ACTION_ALREADY_EXISTS' });
  await assert.rejects(engine.recover({ ...input, model: 'other/model' }), { code: 'REPLAY_BINDING_MISMATCH' });
  await assert.rejects(engine.recover({ ...input, requestFingerprint: 'other' }), { code: 'REPLAY_BINDING_MISMATCH' });
  await assert.rejects(engine.recover({ ...input, verificationSpec: { ...spec, maxAttestationAgeMs: 2 } }), { code: 'REPLAY_BINDING_MISMATCH' });
  assert.equal(journal.get('inferencePrepared', action.id).status, 'not_submitted', 'recovery never rewrites effect state');
});

test('SYNTHETIC crash before signature capture preserves original unknown result and pending cost', async t => {
  const flow = await crashFlow(t, (arg, value) => value.kind === 'decrypted-json');
  const lost = await flow.send(); assert.equal(lost.status, 'unknown');
  const { engine } = await flow.reopen();
  const r = await engine.recover({ actionId: flow.action.id, model, requestFingerprint: flow.requestFingerprint, verificationSpec: spec });
  assert.equal(r.verification.wireSignatureVerified, false); assert.equal(r.output, null);
  assert.equal(r.verification.status, 'unavailable'); assert.equal(flow.h.calls.completions, 1);
});

test('SYNTHETIC crash before response persistence refuses recovery and never retries', async t => {
  const flow = await crashFlow(t, (arg, value) => value.kind === 'completion' && value.direction === 'response');
  assert.equal((await flow.send()).status, 'unknown');
  const { engine } = await flow.reopen();
  await assert.rejects(engine.recover({ actionId: flow.action.id, model, requestFingerprint: flow.requestFingerprint, verificationSpec: spec }), { code: 'COMPLETION_RESPONSE_NOT_CAPTURED' });
  assert.equal(flow.h.calls.completions, 1);
});

test('SYNTHETIC owner component recovery verifies current M01 policy and never settles cost or admits output', async t => {
  const { journal, send, action, requestFingerprint, h } = await runFlow(t);
  await send(); let currentSpec = spec, deny = false;
  const components = createCloudComponents({ journal, clock, treasury: {}, providers: {}, rules: {
    evaluate: command => deny ? { status: 'deny', reasonCode: 'OWNER_REQUIRED' } : { status: 'allow', plan: { model, verificationSpec: currentSpec, timeoutMs: 5000 } }
  } });
  const recovered = await components.recover({ role: 'owner' }, { id: action.id });
  assert.equal(recovered.verification.status, 'unavailable'); assert.equal(recovered.output, null);
  assert.equal(recovered.businessDeliveryAllowed, false); assert.equal(recovered.requestFingerprint, undefined);
  assert.equal(recovered.cost.status, 'pending'); assert.equal(h.calls.completions, 1);
  assert.equal(journal.get('inferencePrepared', action.id).requestFingerprint, requestFingerprint);
  currentSpec = { ...spec, maxAttestationAgeMs: 1 };
  await assert.rejects(components.recover({}, { id: action.id }), { code: 'CONFLICT' });
  deny = true;
  await assert.rejects(components.recover({}, { id: action.id }), { code: 'POLICY_BLOCK' });
});
