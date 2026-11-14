// Read response bytes incrementally. A response.text()/json() check after allocation
// cannot bound a provider-controlled body. Callers own the request timeout/signal.
export async function readBoundedJson(response, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('INVALID_READ_LIMIT');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('PROVIDER_RESPONSE_MISSING');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
}
