// Only the documented non-streaming completion and read-only billing lookup.
export function createNearCloudClient({ transport = fetch, resolveSecret, secretRef } = {}) {
  async function prepare(path, body, timeoutMs = 30_000) {
    const key = await resolveSecret?.(secretRef);
    if (typeof key !== 'string' || !key) throw new Error('CREDENTIAL_UNAVAILABLE');
    return () => transport('https://cloud-api.near.ai' + path, {
      method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    }).then(async response => {
      if (!response.ok) throw new Error('PROVIDER_HTTP_ERROR');
      return { body: await response.json(), inferenceId: response.headers.get('inference-id') };
    });
  }
  const request = async (path, body) => (await prepare(path, body))();
  return {
    prepareComplete: ({ model, messages, maxOutputTokens, timeoutMs }) => prepare('/v1/chat/completions', {
      model, messages, max_completion_tokens: maxOutputTokens, n: 1, stream: false,
    }, timeoutMs),
    complete: ({ model, messages, maxOutputTokens, timeoutMs }) => request('/v1/chat/completions', {
      model, messages, max_completion_tokens: maxOutputTokens, n: 1, stream: false,
    }, timeoutMs),
    costs: async inferenceId => (await request('/v1/billing/costs', { requestIds: [inferenceId] })).body,
  };
}
