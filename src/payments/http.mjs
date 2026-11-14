// NEAR Intents 1Click REST API, mainnet only. The customer sends the deposit.
import { boundedBytes, bytesHash } from '../inference/capture.mjs';

export function createIntentsClient({ transport = fetch, resolveSecret, secretRef, authScheme = null, persistExchange, maxResponseBytes = 1048576 } = {}) {
  async function request(path, body, capture = false) {
    if (capture && typeof persistExchange !== 'function') throw Object.assign(new Error('Private envelope storage required'), { code: 'PRIVATE_ENVELOPE_REQUIRED' });
    const key = secretRef ? await resolveSecret?.(secretRef) : null;
    if (secretRef && !key) throw new Error('CREDENTIAL_UNAVAILABLE');
    if(secretRef&&!['bearer','api-key'].includes(authScheme))throw new Error('AUTH_SCHEME_UNVERIFIED');
    const url = 'https://1click.chaindefuser.com' + path;
    const requestBody = body ? JSON.stringify(body) : null;
    const response = await transport(url, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(key ? authScheme==='api-key'?{'X-API-Key':key}:{ Authorization: `Bearer ${key}` } : {}) },
      ...(body ? { body: requestBody } : {}), signal: AbortSignal.timeout(30_000),
    });
    const bytes = await boundedBytes(response.body, maxResponseBytes);
    const evidenceRef = capture ? await persistExchange({ request: { url, method: body ? 'POST' : 'GET', bodyBase64: requestBody ? Buffer.from(requestBody).toString('base64') : null,
      bodyHash: requestBody ? bytesHash(Buffer.from(requestBody)) : null }, response: { httpStatus: response.status,
      bodyBase64: Buffer.from(bytes).toString('base64'), bodyHash: bytesHash(bytes) } }) : null;
    if (!response.ok) throw new Error('PROVIDER_HTTP_ERROR');
    const value = JSON.parse(Buffer.from(bytes).toString('utf8'));
    return capture ? { body: value, evidenceRef } : value;
  }
  return {
    tokens: () => request('/v0/tokens'),
    quote: requestBody => request('/v0/quote', requestBody),
    quoteWithEvidence: requestBody => request('/v0/quote', requestBody, true),
    status: ({ depositAddress, depositMemo }) => request('/v0/status?' + new URLSearchParams({
      depositAddress, ...(depositMemo ? { depositMemo } : {}),
    })),
    statusWithEvidence: ({ depositAddress, depositMemo }) => request('/v0/status?' + new URLSearchParams({
      depositAddress, ...(depositMemo ? { depositMemo } : {}),
    }), undefined, true),
  };
}
