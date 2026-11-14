import { createHash } from 'node:crypto';

export const bytesHash = bytes => createHash('sha256').update(bytes).digest('hex');
const requestHeaders = ['content-type', 'accept-encoding', 'x-signing-algo', 'x-client-pub-key', 'x-model-pub-key', 'x-encryption-version', 'x-encrypt-all-fields', 'x-no-aliasing'];
const responseHeaders = ['content-type', 'content-encoding', 'inference-id', 'x-request-id'];
const selectHeaders = (headers, names) => Object.fromEntries(names.filter(n => headers.has(n)).map(n => [n, headers.get(n)]));

export async function boundedBytes(body, maximum) {
  if (!body) return new Uint8Array();
  const reader = body.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw Object.assign(new Error('Evidence byte bound exceeded'), { code: 'EVIDENCE_BYTE_BOUND' }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Uint8Array(Buffer.concat(chunks));
}

export function createPreparedDispatch({ start, finish, preflight, now, expiresAt }) {
  let used = false;
  const send = () => {
    if (used) throw Object.assign(new Error('Prepared callback already used'), { code: 'PREPARED_CALLBACK_ALREADY_USED' });
    if (now() >= expiresAt) throw Object.assign(new Error('Preflight expired'), { code: 'PREFLIGHT_EXPIRED' });
    used = true;
    const effect = start(); // The final gate reaches the transport in this stack.
    return finish(effect);
  };
  Object.defineProperties(send, { preflight: { value: preflight }, requestFingerprint: { value: preflight.requestFingerprint },
    requestBytesHash: { value: preflight.requestBytesHash }, evidenceRef: { value: preflight.evidenceRef } });
  return send;
}

// Capture before parsing and before returning bytes to the SDK. Persistence
// failures propagate; a caller must keep any already-sent effect unknown.
export function createWireCapture({ persist, maxEvidenceBytes, clock = () => new Date() }) {
  let consumed = 0; const frames = [];
  const at = () => new Date(clock()).toISOString();
  async function keep(value) {
    consumed += Buffer.byteLength(JSON.stringify(value));
    if (consumed > maxEvidenceBytes) throw Object.assign(new Error('Evidence byte bound exceeded'), { code: 'EVIDENCE_BYTE_BOUND' });
    const ref = await persist(value); frames.push({ ...value, evidenceRef: ref }); return frames[frames.length - 1];
  }
  async function request(request, kind) {
    const bytes = await boundedBytes(request.clone().body, maxEvidenceBytes);
    return keep({ kind, direction: 'request', observedAt: at(), url: request.url, method: request.method,
      headers: selectHeaders(request.headers, requestHeaders), bodyBase64: Buffer.from(bytes).toString('base64'), bodyHash: bytesHash(bytes) });
  }
  async function response(response, kind, { requestRef, peerSpkiFingerprint } = {}) {
    const bytes = await boundedBytes(response.body, maxEvidenceBytes);
    const frame = await keep({ kind, direction: 'response', observedAt: at(), status: response.status,
      headers: selectHeaders(response.headers, responseHeaders), bodyBase64: Buffer.from(bytes).toString('base64'), bodyHash: bytesHash(bytes),
      ...(requestRef ? { requestRef } : {}), ...(peerSpkiFingerprint ? { peerSpkiFingerprint } : {}) });
    return { frame, response: new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers }) };
  }
  return { frames, request, response, keep };
}
