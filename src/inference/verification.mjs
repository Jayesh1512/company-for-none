import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fingerprint } from '../contracts.mjs';
import { boundedBytes, bytesHash, createWireCapture, createPreparedDispatch } from './capture.mjs';
import {generationInputBytes,encodeGenerationRequest} from '../generation-contracts.mjs';

export const CLOUD_VERIFICATION_SDK = Object.freeze({ name: '@nearai/inference-sdk', version: '0.3.0', nodeEntry: true });
const BASE = 'https://cloud-api.near.ai/v1/';
export const CLOUD_DURABLE_RECOVERY = Object.freeze({ supported: false,
  reasonCode: 'E2EE_PLAINTEXT_REPLAY_UNSUPPORTED',
  evidenceScope: 'recorded-wire-signature-only',
  sdk: CLOUD_VERIFICATION_SDK });
const bad = code => Object.assign(new Error(code), { code });
const privateId = ref => typeof ref === 'string' && /^private:[a-f0-9]{64}$/.test(ref) ? ref.slice(8) : null;

export async function loadCloudVerificationSdk() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  if (!(major > 24 || (major === 24 && (minor > 22 || (minor === 22 && patch >= 1))))) throw bad('SDK_NODE_VERSION_UNSUPPORTED');
  const require = createRequire(import.meta.url);
  const entry = require.resolve('@nearai/inference-sdk/node');
  const metadata = JSON.parse(await readFile(resolve(dirname(entry), '../package.json'), 'utf8'));
  if (metadata.version !== CLOUD_VERIFICATION_SDK.version) throw bad('SDK_VERSION_UNSUPPORTED');
  return import('@nearai/inference-sdk/node');
}

function validateSpec(spec) {
  if (!spec || spec.route !== 'near-tee-e2ee-chat' || spec.signingAlgo !== 'ed25519' ||
    spec.sdk?.name !== CLOUD_VERIFICATION_SDK.name || spec.sdk?.version !== CLOUD_VERIFICATION_SDK.version || spec.sdk?.nodeEntry !== true ||
    spec.attestationCacheTimeToLiveMs !== 0 || spec.signatureKind !== 'provider_tee' ||
    !Array.isArray(spec.allowedTcbStatuses) || !spec.allowedTcbStatuses.length ||
    !Number.isSafeInteger(spec.maxAttestationAgeMs) || spec.maxAttestationAgeMs <= 0 ||
    spec.requireGatewayAttestation !== true || spec.requireModelAttestation !== true || spec.requireResponseSignature !== true ||
    typeof spec.policyFingerprint !== 'string' || !spec.policyFingerprint) throw bad('VERIFICATION_SPEC_REQUIRED');
  if(spec.responseAcceptance!==undefined&&spec.responseAcceptance!=='live-verified-hold-on-loss')throw bad('VERIFICATION_SPEC_REQUIRED');
}
function facts(result, observedAt) {
  const verifiedAt = new Date(result.verifiedAt).toISOString();
  const normalize = a => ({ tcbStatus: a.tcbStatus, nonce: a.report.nonce, nonceVerified: true, verifiedAt, observedAt,
    signer: a.signer, deploymentProvenance: a.deploymentProvenance,
    runtimeMeasurements: a.deployment.runtimeMeasurements, ...(a.tlsBinding ? { tlsBinding: a.tlsBinding } : {}) });
  return { gateway: normalize(result.gateway), models: result.models.map(normalize) };
}

/** Bounded supported Node/protected SDK integration. No provider call occurs at construction. */
export function createCloudVerification(options = {}) {
  options = Object.freeze({ ...options, limits: Object.freeze({ ...options.limits }) });
  const { journal, resolveSecret, secretRef, clock = () => new Date(), limits = {} } = options;
  // SDK 0.3.0 exposes only a process-local decryptResponse closure. Reject the
  // unfinished shortcut options before loading the SDK or touching global RNG.
  if (options.durableReplyKey === true || options.captureReplyKey !== undefined || options.nacl !== undefined)
    throw bad('SDK_DURABLE_REPLY_KEY_UNSUPPORTED');
  const at = () => new Date(clock()).toISOString();
  function context(input) {
    const spec = input.verificationSpec ?? input.request?.verificationSpec; validateSpec(spec);
    if (!journal || !Number.isSafeInteger(limits.maxEvidenceBytes) || limits.maxEvidenceBytes <= 0 ||
      !Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs <= 0) throw bad('VERIFICATION_STORAGE_AND_LIMITS_REQUIRED');
    const request = input.request; const model = request?.model ?? input.model;
    if (!model || typeof model !== 'string') throw bad('MODEL_REQUIRED');
    const requestFingerprint = input.requestFingerprint ?? fingerprint(request ?? { model, verificationSpec: spec });
    if (request && requestFingerprint !== fingerprint(request)) throw bad('REQUEST_FINGERPRINT_MISMATCH');
    if (input.action?.requestFingerprint && input.action.requestFingerprint !== requestFingerprint) throw bad('REQUEST_FINGERPRINT_MISMATCH');
    if (request?.verificationSpec && fingerprint(request.verificationSpec) !== fingerprint(spec)) throw bad('VERIFICATION_POLICY_BINDING_MISMATCH');
    return { request, model, spec, requestFingerprint, actionId: input.action?.id ?? input.actionId ?? `preflight:${requestFingerprint}` };
  }
  async function sessionFor(c, { requireCredential = false } = {}) {
    // Public gateway/model evidence is deliberately available before a customer
    // trusts the service with a credential. Paid preparation still requires one.
    let apiKey = secretRef ? await resolveSecret?.(secretRef) : undefined;
    if (typeof apiKey !== 'string' || !apiKey) {
      if (requireCredential) throw bad('CREDENTIAL_UNAVAILABLE');
      apiKey = undefined;
    }
    if(requireCredential){
      if(!Array.isArray(c.request?.messages)||!Number.isSafeInteger(c.request.maxInputBytes)||generationInputBytes(c.request)>c.request.maxInputBytes||!Number.isSafeInteger(c.request.maxOutputTokens)||c.request.maxOutputTokens<=0)throw bad('INVALID_GENERATION_BOUNDS');
      encodeGenerationRequest(c.request); // validate the frozen schema before SDK/network I/O
    }
    const sdk = await (options.loadSdk ?? loadCloudVerificationSdk)();
    const run = randomUUID(); let sequence = 0;
    const state = { run, sdk, c, raw: [], normalized: {}, session: null, preparedRequest: null, preparedFrame: null, completionFrame: null, abort: new AbortController() };
    async function persist(value) {
      const ref = await journal.putArtifact({ actionId: `cloud-evidence:${c.actionId}:${run}:${sequence++}`, content: JSON.stringify({ ...value, evidenceAction: c.actionId, evidenceRun: run }), mediaType: 'application/json' });
      return `private:${ref.id}`;
    }
    state.capture = createWireCapture({ persist, clock, maxEvidenceBytes: limits.maxEvidenceBytes });
    const policy = { acceptedTcbStatuses: c.spec.allowedTcbStatuses };
    const clientOptions = { baseUrl: BASE, ...(apiKey ? { apiKey } : {}), e2ee: true, ohttp: false,
      signingAlgo: 'ed25519', attestationCacheTimeToLiveMs: 0, responseCacheTimeToLiveMs: c.spec.maxAttestationAgeMs,
      gatewayVerification: { includeSpkiFingerprint: true, policy }, modelVerification: { policy } };
    class CapturingAttestationClient extends sdk.AttestationClient {
      async requestGatewayAttestation(request, capturePeer) {
        const timed = new Request(request, { signal: AbortSignal.any([state.abort.signal, AbortSignal.timeout(limits.timeoutMs)]) });
        const frame = await state.capture.request(timed, 'gateway-attestation');
        const received = await super.requestGatewayAttestation(timed, capturePeer);
        const captured = await state.capture.response(received.response, 'gateway-attestation', { requestRef: frame.evidenceRef, peerSpkiFingerprint: received.peerSpkiFingerprint });
        return { ...received, response: captured.response };
      }
    }
    const attestationClient = new CapturingAttestationClient(clientOptions);
    class CapturingInferenceClient extends sdk.InferenceClient {
      async fetchGatewayAttestation() {
        const value = await attestationClient.fetchGatewayAttestation({ signingAlgo: 'ed25519', includeSpkiFingerprint: true });
        state.normalized.gateway = value;
        await persist({ kind: 'gateway-sdk-input', value }); return value;
      }
      createGatewayFetch(spki) {
        const pinned = super.createGatewayFetch(spki);
        return (input, init) => {
          const request = input instanceof Request && init === undefined ? input : new Request(input, init);
          const kind = new URL(request.url).pathname.endsWith('/chat/completions') ? 'completion'
            : new URL(request.url).pathname.includes('/signature/') ? 'signature'
            : new URL(request.url).searchParams.has('provider') ? 'model-attestation' : 'model-metadata';
          // The final dispatch path has no persistence/credential/preflight await.
          if (kind === 'completion') {
            if (request !== state.preparedRequest) return Promise.reject(bad('UNPREPARED_COMPLETION_DENIED'));
            request.signal.throwIfAborted();
            const effect = pinned(request);
            return effect.then(async response => {
              const captured = await state.capture.response(response, kind, { requestRef: state.preparedFrame.evidenceRef });
              state.completionFrame = captured.frame; return captured.response;
            });
          }
          return (async () => {
            if (request.method !== 'GET' || new URL(request.url).origin !== new URL(BASE).origin) throw bad('SDK_READ_SCOPE_DENIED');
            const timed = new Request(request, { signal: AbortSignal.any([state.abort.signal, AbortSignal.timeout(limits.timeoutMs)]) });
            const frame = await state.capture.request(timed, kind);
            const captured = await state.capture.response(await pinned(timed), kind, { requestRef: frame.evidenceRef });
            return captured.response;
          })();
        };
      }
      async createVerificationState(model) {
        const original = await super.createVerificationState(model);
        const value = { ...original, transport: { ...original.transport, fetchCompletionSignature: async params => {
          const signature = await original.transport.fetchCompletionSignature(params);
          state.signature = signature;
          await persist({ kind: 'signature-sdk-input', value: signature }); return signature;
        } } }; state.session = value;
        const result = value.attestationResult;
        if (result.gateway.tlsBinding.kind !== 'attested' || !result.models.length) throw bad('REQUIRED_PREFLIGHT_UNAVAILABLE');
        // Save normalized SDK inputs, not authoritative serialized conclusions.
        state.normalized.models = result.models.map(a => ({ attestation: a.report, clientBinding: { nonce: a.report.nonce } }));
        state.observedAt = state.capture.frames.find(f => f.kind === 'gateway-attestation' && f.direction === 'request')?.observedAt ?? at();
        if (new Date(clock()).getTime() - Date.parse(state.observedAt) > c.spec.maxAttestationAgeMs) throw bad('PREFLIGHT_EXPIRED');
        await persist({ kind: 'model-sdk-inputs', value: state.normalized.models }); return value;
      }
      registerCaptured(captured) { this.registerResponse(captured, this.responseCacheGeneration); }
    }
    state.client = new CapturingInferenceClient(clientOptions);
    state.apiKey = apiKey; // Closure only: never copied to evidence/result.
    let timeout;
    try {
      state.attestations = await Promise.race([state.client.verify(c.model), new Promise((_, reject) => {
        timeout = setTimeout(() => { const error = bad('PREFLIGHT_TIMEOUT'); state.abort.abort(error); reject(error); }, limits.timeoutMs);
      })]);
    } catch (error) { state.preflightError = error; }
    finally { clearTimeout(timeout); }
    return state;
  }
  async function save(state, stage, fields = {}) {
    const c = state.c; const verifiedAt = stage === 'preflight' && state.attestations ? new Date(state.attestations.verifiedAt).toISOString() : at();
    const bundle = { schemaVersion: 1, sdk: CLOUD_VERIFICATION_SDK, actionId: c.actionId,
      requestFingerprint: c.requestFingerprint, model: c.model, verificationSpec: c.spec,
      observedAt: state.observedAt ?? verifiedAt, frames: state.capture?.frames ?? [], normalized: state.normalized ?? {},
      ...(state.signature ? { signature: state.signature } : {}), ...(state.completionId ? { completionId: state.completionId } : {}),
      ...(state.plaintextFrame ? { plaintextFrame: state.plaintextFrame } : {}) };
    const serialized = JSON.stringify(bundle);
    if (Buffer.byteLength(serialized) > limits.maxEvidenceBytes) throw bad('EVIDENCE_BYTE_BOUND');
    const artifact = await journal.putArtifact({ actionId: `cloud-bundle:${c.actionId}:${stage}:${randomUUID()}`, content: serialized, mediaType: 'application/json' });
    const result = { id: `cloud-verification:${fingerprint({ actionId: c.actionId, requestFingerprint: c.requestFingerprint, stage })}`,
      stage, status: state.preflightError ? 'unavailable' : stage === 'preflight' ? 'verified' : 'unavailable',
      source: 'local-sdk', sdkVersion: CLOUD_VERIFICATION_SDK.version, sdk: CLOUD_VERIFICATION_SDK,
      requestFingerprint: c.requestFingerprint, model: c.model, policyFingerprint: c.spec.policyFingerprint,
      verificationPolicyFingerprint: c.spec.policyFingerprint, verifiedAt, evidenceRef: `private:${artifact.id}`,
      ...(state.attestations ? facts(state.attestations, state.observedAt) : { gateway: null, models: [] }),
      ...(state.preparedFrame ? { requestBytesHash: state.preparedFrame.bodyHash } : {}),
      ...(state.completionFrame ? { responseBytesHash: state.completionFrame.bodyHash } : {}), ...fields };
    if (state.preflightError) result.reasonCode = safeError(state.preflightError);
    await journal.transaction({ actionId: `${result.id}:${fingerprint(result)}`, fingerprint: fingerprint(result) }, tx => {
      tx.put('inferenceVerification', result.id, result); return result;
    });
    return result;
  }
  async function preflight(input = {}) {
    const c = context(input); let state;
    try { state = await sessionFor(c); }
    catch (error) { state = { c, normalized: {}, preflightError: error }; }
    return save(state, 'preflight');
  }
  async function prepare(input = {}) {
    const c = context(input);
    if (journal.get('inferencePrepared', c.actionId)) throw bad('PREPARED_ACTION_ALREADY_EXISTS');
    if (!c.request || !c.actionId || !secretRef) throw bad('PAID_REQUEST_AND_SECRET_REFERENCE_REQUIRED');
    if (!c.request.verificationSpec || fingerprint(c.request.verificationSpec) !== fingerprint(c.spec)) throw bad('VERIFICATION_POLICY_BINDING_MISMATCH');
    let state;
    try { state = await sessionFor(c, { requireCredential: true }); }
    catch (error) { state = { c, normalized: {}, preflightError: error }; }
    if (state.preflightError) { const result = await save(state, 'preflight'); throw Object.assign(bad(result.reasonCode), { result }); }
    const body = JSON.stringify(encodeGenerationRequest(c.request));
    const prepareRequest = () => state.sdk.prepareE2eeChatRequest({ request: new Request(BASE + 'chat/completions', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.apiKey}`, 'Accept-Encoding': 'identity' }, body,
      signal: AbortSignal.timeout(c.request.timeoutMs ?? limits.timeoutMs) }), modelKey: state.session.modelKey });
    const encrypted = await prepareRequest();
    state.apiKey = undefined;
    state.preparedRequest = encrypted.request;
    state.preparedFrame = await state.capture.request(encrypted.request, 'completion');
    const preparedFinding = await save(state, 'preflight');
    await journal.transaction({ actionId: `inference-prepared:${c.actionId}`, fingerprint: fingerprint({ actionId: c.actionId, requestFingerprint: c.requestFingerprint, wireHash: state.preparedFrame.bodyHash }) }, tx => {
      tx.put('inferencePrepared', c.actionId, { actionId: c.actionId, requestFingerprint: c.requestFingerprint,
        requestBytesHash: state.preparedFrame.bodyHash, evidenceRef: preparedFinding.evidenceRef, status: 'not_submitted',
        model: c.model, verificationSpec: c.spec, evidenceRun: state.run, requestFrameRef: state.preparedFrame.evidenceRef }); return null;
    });
    return createPreparedDispatch({ start: () => state.session.transport.fetch(state.preparedRequest),
      finish: started => finish(started, state, encrypted), preflight: preparedFinding,
      now: () => new Date(clock()).getTime(), expiresAt: Date.parse(state.observedAt) + c.spec.maxAttestationAgeMs });
  }
  async function finish(started, state, encrypted) {
    let body = null; let inferenceId = null; let completionHttpStatus=null;let processVerification = 'unavailable'; let reasonCode = 'E2EE_PLAINTEXT_REPLAY_UNSUPPORTED';
    const cost = { status: 'pending', actualCostNanoUsd: null };
    try {
      const raw = await started; inferenceId = raw.headers.get('inference-id');completionHttpStatus=raw.status;
      if (!raw.ok) throw bad(raw.status===401||raw.status===403?'PROVIDER_ACCESS_DENIED':raw.status===402?'PROVIDER_CREDIT_UNAVAILABLE':'COMPLETION_HTTP_ERROR');
      const wireBytes = Buffer.from(state.completionFrame.bodyBase64, 'base64');
      // Raw bytes already durable, before either SDK decryption or JSON parsing.
      const decrypted = await encrypted.decryptResponse(raw);
      const plaintext = await boundedBytes(decrypted.body, limits.maxEvidenceBytes);
      state.plaintextFrame = await state.capture.keep({ kind: 'decrypted-json', direction: 'process-output',
        observedAt: at(), bodyBase64: Buffer.from(plaintext).toString('base64'), bodyHash: bytesHash(plaintext) });
      body = JSON.parse(Buffer.from(plaintext).toString('utf8')); state.completionId = body.id;
      if (typeof body.id !== 'string') throw bad('COMPLETION_ID_UNAVAILABLE');
      state.client.registerCaptured({ id: body.id, requestBody: Buffer.from(state.preparedFrame.bodyBase64, 'base64'),
        responseBody: Promise.resolve(wireBytes), session: state.session });
      const verified = await state.client.verifyResponse(body.id); // explicit official SDK verification
      if (verified.signatureKind === 'provider_tee' && verified.attestations?.length !== 1) throw bad('AMBIGUOUS_MODEL_SIGNER');
      state.signature = verified.signature; state.signatureKind = verified.signatureKind; processVerification = 'verified';
    } catch (error) { reasonCode = safeError(error); }
    const text = body?.choices?.[0]?.message?.content;
    const textHash = typeof text === 'string' ? bytesHash(Buffer.from(text, 'utf8')) : undefined;
    // Explicit owner-selected alternative: authenticated E2EE decryption and the
    // official model-signature check must BOTH succeed in this original process.
    // This does not manufacture an offline decryption key or recovery guarantee.
    const liveAccepted=state.c.spec.responseAcceptance==='live-verified-hold-on-loss'&&processVerification==='verified'&&state.signatureKind==='provider_tee'&&typeof text==='string'&&text.length>0;
    const proof = await save(state, 'response', {
      status: liveAccepted?'verified':'unavailable', reasonCode:liveAccepted?'LIVE_E2EE_VERIFIED_NO_OFFLINE_RECOVERY':reasonCode,
      ...(state.signatureKind ? { signatureKind: state.signatureKind } : {}),
      wireSignatureVerified: processVerification === 'verified',
      plaintextBindingStatus: liveAccepted?'verified':'unavailable', durableReplayStatus: 'unavailable',
      ...(liveAccepted?{acceptanceScope:'live-process-e2ee'}:{}),
      processVerificationStatus: processVerification,
      ...(completionHttpStatus?{completionHttpStatus}:{}),
      ...(textHash ? { responsePlaintextHash: textHash } : {}) });
    return { status: typeof text === 'string' ? 'confirmed' : [401,402,403,429].includes(completionHttpStatus)?'failed':'unknown',mode: 'live', simulated: false, provider: 'near-ai-cloud',
      ...(completionHttpStatus?{completionHttpStatus}:{}),
      providerRequestId: body?.id ?? null, inferenceId, proof, cost,
      generation: { providerRequestId: body?.id ?? null, inferenceId, output: typeof text === 'string' ? text : null,
        usage: body?.usage ?? null, finishReason: body?.choices?.[0]?.finish_reason ?? null, proof, cost } };
  }
  function loadBundle(evidenceRef) {
    const id = privateId(evidenceRef); if (!id) throw bad('PRIVATE_EVIDENCE_REQUIRED');
    return JSON.parse(journal.getArtifact({ id, hash: id }).content);
  }
  /**
   * Reproduce frame hashes and the SDK public wire-signature check only.
   * Saved plaintext/key material/proof/TCB booleans never establish binding.
   * Offline nonce consistency is checked, but is not attestation verification.
   */
  async function verifyRecorded(bundle) {
    for (const frame of bundle.frames) if (frame.bodyBase64 !== undefined && bytesHash(Buffer.from(frame.bodyBase64, 'base64')) !== frame.bodyHash) throw bad('EVIDENCE_BYTES_MISMATCH');
    const request = bundle.frames.find(f => f.kind === 'completion' && f.direction === 'request');
    const response = bundle.frames.find(f => f.kind === 'completion' && f.direction === 'response');
    if (!request || !response) throw bad('DURABLE_SIGNATURE_OR_BYTES_UNAVAILABLE');
    const requestBody = Buffer.from(request.bodyBase64, 'base64');
    if (JSON.parse(requestBody.toString('utf8')).model !== bundle.model) throw bad('REPLAY_MODEL_BINDING_MISMATCH');
    const out = { wireSignatureVerified: false, signatureKind: bundle.signature?.kind, plaintextBindingStatus: 'unavailable' };
    let signatureError = null;
    try {
      if (!bundle.signature) throw bad('DURABLE_SIGNATURE_OR_BYTES_UNAVAILABLE');
      const sdk = await (options.loadSdk ?? loadCloudVerificationSdk)();
      const args = { requestBody: Buffer.from(request.bodyBase64, 'base64'), responseBody: Buffer.from(response.bodyBase64, 'base64'), signature: bundle.signature };
      if (bundle.signature.kind === 'provider_tee') {
        const matching = (bundle.normalized.models ?? []).filter(x => x.attestation.signer.signingAlgo === bundle.signature.signer.signingAlgo && x.attestation.signer.signingAddress === bundle.signature.signer.signingAddress);
        if (matching.length !== 1) throw bad('SIGNER_BINDING_MISMATCH');
        if (!matching[0].clientBinding?.nonce || matching[0].attestation.nonce !== matching[0].clientBinding.nonce) throw bad('NONCE_BINDING_MISMATCH');
        sdk.verifyModelResponse({ ...args, attestation: { signer: matching[0].attestation.signer } });
      } else if (bundle.signature.kind === 'gateway') sdk.verifyGatewayResponse({ ...args, attestation: { signer: bundle.normalized.gateway.attestation.signer } });
      else throw bad('SIGNATURE_KIND_UNSUPPORTED');
      out.wireSignatureVerified = true;
    } catch (error) { signatureError = safeError(error); }
    out.signatureError = signatureError;

    return out;
  }
  // Restart replay of a saved bundle. Stage 'replay' never replaces the live
  // 'response' finding that M01 evaluates.
  async function replay(input = {}) {
    const bundle = loadBundle(input.evidenceRef);
    if (bundle.sdk?.version !== CLOUD_VERIFICATION_SDK.version || bundle.requestFingerprint !== input.requestFingerprint ||
      bundle.verificationSpec?.policyFingerprint !== input.verificationSpec?.policyFingerprint || fingerprint(bundle.verificationSpec) !== fingerprint(input.verificationSpec)) throw bad('REPLAY_BINDING_MISMATCH');
    validateSpec(input.verificationSpec);
    for (const frame of bundle.frames) if (frame.bodyBase64 !== undefined && bytesHash(Buffer.from(frame.bodyBase64, 'base64')) !== frame.bodyHash) throw bad('EVIDENCE_BYTES_MISMATCH');
    const c = { actionId: bundle.actionId, requestFingerprint: bundle.requestFingerprint, model: bundle.model, spec: bundle.verificationSpec };
    const state = { c, capture: { frames: bundle.frames }, normalized: bundle.normalized, observedAt: bundle.observedAt,
      signature: bundle.signature, completionId: bundle.completionId };
    state.preparedFrame = bundle.frames.find(f => f.kind === 'completion' && f.direction === 'request');
    state.completionFrame = bundle.frames.find(f => f.kind === 'completion' && f.direction === 'response');
    return save(state, 'replay', recordedFields(await settle(() => verifyRecorded(bundle)), bundle));
  }
  const settle = async work => { try { return await work(); } catch (error) { return { error: safeError(error) }; } };
  function recordedFields(r, bundle) {
    return { status: 'unavailable', reasonCode: r.error ?? r.signatureError ?? 'OFFLINE_ATTESTATION_COLLATERAL_REPLAY_UNSUPPORTED',
      wireSignatureVerified: r.wireSignatureVerified === true, ...(bundle.signature ? { signatureKind: bundle.signature.kind } : {}),
      plaintextBindingStatus: 'unavailable', durableReplayStatus: 'unavailable',
      attestationReplayStatus: 'unavailable',
      replayScope: 'recorded-wire-signature-only-no-plaintext-or-attestation-collateral' };
  }
  /**
   * Crash recovery: the process died after dispatch but before a bundle was
   * written. Rebuild evidence from individually persisted frames and the exact
   * prepared request/policy. The SDK closure key is unavailable after restart.
   * Never returns recovered plaintext, accepts a saved proof flag, or resends.
   */
  async function recover(input = {}) {
    const prepared = journal.get('inferencePrepared', input.actionId);
    if (!prepared?.evidenceRun || !prepared.requestFrameRef) throw bad('RECOVERY_MATERIAL_UNAVAILABLE');
    if (input.requestFingerprint && input.requestFingerprint !== prepared.requestFingerprint) throw bad('REPLAY_BINDING_MISMATCH');
    validateSpec(input.verificationSpec);
    if (input.model !== prepared.model || fingerprint(input.verificationSpec) !== fingerprint(prepared.verificationSpec)) throw bad('REPLAY_BINDING_MISMATCH');
    const kept = journal.list('privateArtifacts').map(a => { try { return JSON.parse(a.content); } catch { return null; } })
      .filter(v => v?.evidenceAction === input.actionId && v.evidenceRun === prepared.evidenceRun);
    const strip = ({ evidenceAction, evidenceRun, ...frame }) => frame;
    const request = kept.find(v => v.kind === 'completion' && v.direction === 'request');
    const response = kept.find(v => v.kind === 'completion' && v.direction === 'response' && v.requestRef === prepared.requestFrameRef);
    if (!request || request.bodyHash !== prepared.requestBytesHash) throw bad('RECOVERY_MATERIAL_UNAVAILABLE');
    if (!response) throw bad('COMPLETION_RESPONSE_NOT_CAPTURED'); // lost output stays unknown; no retry
    const preparedBundle = loadBundle(prepared.evidenceRef);
    if (preparedBundle.actionId !== input.actionId || preparedBundle.requestFingerprint !== prepared.requestFingerprint ||
      preparedBundle.model !== prepared.model || fingerprint(preparedBundle.verificationSpec) !== fingerprint(prepared.verificationSpec)) throw bad('REPLAY_BINDING_MISMATCH');
    const durableRequest = loadBundle(prepared.requestFrameRef);
    if (fingerprint(durableRequest) !== fingerprint(request)) throw bad('RECOVERY_MATERIAL_UNAVAILABLE');
    const signature = kept.find(v => v.kind === 'signature-sdk-input')?.value;
    const models = kept.find(v => v.kind === 'model-sdk-inputs')?.value ?? [];
    const bundle = { schemaVersion: 1, sdk: CLOUD_VERIFICATION_SDK, actionId: input.actionId, requestFingerprint: prepared.requestFingerprint, model: input.model,
      verificationSpec: input.verificationSpec, observedAt: request.observedAt, frames: [strip(request), strip(response)], normalized: { models },
      ...(signature ? { signature } : {}) };
    const c = { actionId: input.actionId, requestFingerprint: prepared.requestFingerprint, model: input.model, spec: input.verificationSpec };
    const state = { c, capture: { frames: bundle.frames }, normalized: bundle.normalized, observedAt: bundle.observedAt, signature,
      preparedFrame: bundle.frames[0], completionFrame: bundle.frames[1] };
    const r = await settle(() => verifyRecorded(bundle));

    const record = await save(state, 'recovery', { ...recordedFields(r, bundle), reasonCode: r.error ?? r.signatureError ?? 'RECOVERED_WITHOUT_LIVE_ATTESTATION_SESSION' });
    return { verification: record, output: null, completionSent: false, originalCompletionCaptured: true,
      status: 'unknown', cost: { status: 'pending', actualCostNanoUsd: null } };
  }
  return Object.freeze({ preflight, prepare, replay, recover });
}

function safeError(error) {
  if(error?.failure?.code==='api.http_status'){
    const status=error.failure.details?.status;
    if(status===401||status===403)return 'PROVIDER_ACCESS_DENIED';
    if(status===402)return 'PROVIDER_CREDIT_UNAVAILABLE';
  }
  const code = error?.code ?? error?.failure?.code;
  return typeof code === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(code) ? code : 'SDK_VERIFICATION_UNAVAILABLE';
}
