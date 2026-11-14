import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Bounded, redirect-free single request. No retries: callers decide what an error means.
export async function boundedRequest({ transport = fetch, url, method = 'GET', headers = {}, body, timeoutMs = 10000, maxBytes = 1024 * 1024 }) {
  const response = await transport(url, { method, redirect: 'error', headers, ...(body === undefined ? {} : { body }), signal: AbortSignal.timeout(timeoutMs) });
  const chunks = []; let size = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw Object.assign(new Error('Response byte bound exceeded'), { code: 'RESPONSE_TOO_LARGE' }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(Buffer.concat(chunks));
  return { status: response.status, ok: response.ok, bytes, bodyHash: sha256(bytes), url,
    json() { try { return JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { return undefined; } } };
}
