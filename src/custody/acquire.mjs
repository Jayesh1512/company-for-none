// Read-only acquisition of one execution's proof material from the Agent API.
// GET only: no grant token, no writes, no wallet/key/grant/provision calls. Trust (witness key,
// origin) is a private pin; nothing here reads it from a response. Responses are bounded.
import { validateExpected } from './proofs.mjs';
import { readBoundedJson } from './read-json.mjs';
const BASE = 'https://api.agentsonintents.com';
const MAX_HEADS = 64;

export function createAgentApiAcquirer({ agentId, secretRef, resolveSecret, transport = fetch, trust, fetchHead, sdk, maxBytes = 2 * 1024 * 1024, timeoutMs = 15000 } = {}) {
  if (![maxBytes, timeoutMs].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('INVALID_READ_LIMIT');
  const pinned = trust ? structuredClone(trust) : null;
  const heads = new Map();
  async function get(path, { authenticated = true } = {}) {
    const headers = {};
    if (authenticated) {
      const key = await resolveSecret?.(secretRef);
      if (typeof key !== 'string' || !key) throw new Error('CREDENTIAL_UNAVAILABLE');
      headers['X-API-Key'] = key;
    }
    const response = await transport(BASE + path, { method: 'GET', redirect: 'error', cache: 'no-store', headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) { await response.body?.cancel(); throw new Error('PROVIDER_HTTP_ERROR'); }
    return readBoundedJson(response, maxBytes);
  }
  const id = encodeURIComponent(agentId ?? '');
  return {
    /** Pass to createAgentProofs({getTrustedCheckpoint}); returns the witness head fetched for this exact execution. */
    getTrustedCheckpoint: async ({ expected }) => {
      validateExpected(expected);
      if (expected.agentId !== agentId) throw new Error('AGENT_IDENTITY_MISMATCH');
      return structuredClone(heads.get(expected.correlationId));
    },
    /** Returns {receipt, operation} for createAgentMovement.capture. `statusEvidence` is the original provider status read. */
    async bundle({ expected, statusEvidence }) {
      if (!agentId || !/^[a-f0-9]{64}$/.test(pinned?.witnessPublicKey ?? '') || !pinned?.origin || new URL(pinned?.apiBaseUrl).protocol !== 'https:') throw new Error('PINNED_LOG_TRUST_REQUIRED');
      expected = validateExpected(expected);
      if (expected.agentId !== agentId) throw new Error('AGENT_IDENTITY_MISMATCH');
      const cid = encodeURIComponent(expected.correlationId);
      // The witness head is fetched BEFORE the proof so from_size aligns the consistency proof with it.
      const head = await (fetchHead ?? (async () => (await (sdk ?? import('@near-intents-agent-api/sdk'))).fetchWitnessCheckpoint(pinned.apiBaseUrl, pinned.origin, pinned.witnessPublicKey)))();
      if (head?.origin !== pinned.origin || typeof head.size !== 'bigint' || head.size < 0n || !(head.root instanceof Uint8Array) || head.root.length !== 32 || !Array.isArray(head.extensions)) throw new Error('TRUSTED_CHECKPOINT_INVALID');
      heads.set(expected.correlationId, structuredClone(head));
      if (heads.size > MAX_HEADS) heads.delete(heads.keys().next().value);
      const [proof, item, info] = [await get(`/v1/agents/${id}/operations/${cid}/proof?from_size=${head.size.toString()}`),
        await get(`/v1/agents/${id}/operations/${cid}/receipt`), await get('/tee/info', { authenticated: false })];
      if (item?.status !== 'PROVEN' || item.correlation_id !== expected.correlationId || !item.receipt) throw new Error('RECEIPT_NOT_PROVEN');
      // `info` is the CURRENT deployment's description. The verifier accepts it only if its compose
      // hash equals the one inside the historical birth quote; a changed deployment fails closed.
      return { receipt: item.receipt, operation: { proof, statusEvidence, teeEvidence: { info } } };
    },
  };
}
