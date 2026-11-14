import { createHash } from 'node:crypto';
import { digest } from './adapter-runtime.mjs';

// Technical read-only observation machinery. M01 supplies freshness and decides
// business readiness. Raw provider evidence is delivered only to the private sink.
export function createProbeRuntime({ provider, binding, policyVersion, clock = () => new Date(), ttlMs,
  timeoutMs = 10000, maxResponseBytes = 1048576, persistEvidence, transport = fetch } = {}) {
  const identity = Object.freeze(Object.fromEntries(['companyId', 'network', 'treasuryAccount', 'bucket'].map(k => [k, binding?.[k] ?? null])));
  const complete = Object.values(identity).every(v => typeof v === 'string' && v.length > 0);
  const timing = Number.isSafeInteger(ttlMs) && ttlMs > 0 && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && Number.isSafeInteger(maxResponseBytes) && maxResponseBytes > 0;
  const at = () => new Date(clock()).toISOString();
  function observation(capability, status, reasonCode, { observedAt = at(), expiresAt, evidenceRef } = {}) {
    const expiry = expiresAt ?? (status === 'unavailable' || !timing ? observedAt : new Date(Date.parse(observedAt) + ttlMs).toISOString());
    return { id: `probe:${digest({ provider, capability, identity, policyVersion, observedAt, expiry, evidenceRef, status, reasonCode })}`,
      capability, provider, status, observedAt, expiresAt: expiry, identity: { ...identity },
      ...(policyVersion !== undefined ? { policyVersion } : {}), ...(evidenceRef ? { evidenceRef } : {}), ...(reasonCode ? { reasonCode } : {}) };
  }
  function prerequisite(capability) {
    if (!complete) return observation(capability, 'unavailable', 'PROBE_IDENTITY_REQUIRED');
    if (!timing) return observation(capability, 'unavailable', 'PROBE_LIMITS_REQUIRED');
    if (typeof persistEvidence !== 'function') return observation(capability, 'unavailable', 'PRIVATE_EVIDENCE_REQUIRED');
    return null;
  }
  async function read(url, { headers = {}, protocol } = {}) {
    const observedAt = at();
    const response = await transport(url, { method: 'GET', redirect: 'error', cache: 'no-store', headers, signal: AbortSignal.timeout(timeoutMs) });
    const chunks = []; let length = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('PROVIDER_READ_FAILED');
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        length += part.value.byteLength;
        if (length > maxResponseBytes) { await reader.cancel(); throw new Error('PROVIDER_RESPONSE_TOO_LARGE'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    const hash = createHash('sha256').update(bytes).digest('hex');
    // Evidence never contains request headers, credential references, or tokens.
    const evidence = { request: { method: 'GET', url, protocol }, response: {
      httpStatus: response.status, bodyBase64: bytes.toString('base64'), bodyHash: hash,
      contentType: response.headers.get('content-type'), observedAt } };
    let body;
    try { body = JSON.parse(bytes.toString('utf8')); } catch { body = null; }
    return { ok: response.ok, httpStatus: response.status, body, observedAt, evidence };
  }
  async function record(capability, reads, status, reasonCode) {
    const observedAt = reads[0]?.observedAt ?? at();
    try {
      const evidenceRef = await persistEvidence({ provider, capability, observedAt,
        identity: { ...identity }, ...(policyVersion !== undefined ? { policyVersion } : {}), reads: reads.map(r => r.evidence) });
      const privateRef = typeof evidenceRef === 'string' ? evidenceRef.startsWith('private:') : evidenceRef?.visibility === 'private' && typeof evidenceRef.id === 'string';
      if (!privateRef) return observation(capability, 'unavailable', 'PRIVATE_EVIDENCE_REQUIRED');
      if (Date.parse(at()) >= Date.parse(observedAt) + ttlMs) return observation(capability, 'unavailable', 'PROBE_EXPIRED', { observedAt, evidenceRef });
      return observation(capability, status, reasonCode, { observedAt, evidenceRef });
    } catch { return observation(capability, 'unavailable', 'EVIDENCE_STORAGE_UNAVAILABLE'); }
  }
  return { identity, prerequisite, observation, read, record };
}
