// Real NEAR spend port for admitted agent spend requests.
//
// This module executes an ALREADY M01-admitted `spend` request through the
// NEAR Intents Agent API under the owner-signed grant. It never decides
// authority, limits or destinations itself: M01 admits, M03 reserves, and this
// port only performs the exact approved action and reports the provider result.
//
// Two shapes are supported, chosen by the admitted request:
//   - swap:     asset <-> asset inside the agent's balance (no destination needed)
//   - transfer: to a policy-listed destination (requires destinations.only list)
//
// No key, account or grant is created here. Demo keys rotate; the grant token
// and agent id come from protected configuration.
import {createHash, randomUUID} from 'node:crypto';

const USDC_NEAR = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const WRAP_NEAR = 'nep141:wrap.near';
export const SPEND_ASSETS = Object.freeze({USDC_NEAR, WRAP_NEAR});

const sha = value => createHash('sha256').update(value).digest('hex');

/** Load the Agent API SDK lazily so this port is inert when not configured. */
async function defaultSdk() { return import('@near-intents-agent-api/sdk'); }

export function createAgentSpendPort(options = {}) {
  const {
    apiKey, baseUrl, agentId, grantToken, sdkLoader = defaultSdk,
    clock = () => new Date(), timeoutMs = 120_000, pollMs = 5_000,
  } = options;
  const configured = Boolean(apiKey && agentId && grantToken);
  const capability = () => ({
    provider: 'near-agent-api',
    configured,
    kinds: ['swap', 'transfer'],
    grantsSpendingAuthority: false,
    evidenceLevel: 'provider-http',
  });

  if (!configured) {
    return Object.freeze({
      capability,
      async spend() { throw Object.assign(new Error('SPEND_PORT_NOT_CONFIGURED'), {code: 'SPEND_PORT_NOT_CONFIGURED'}); },
    });
  }

  /** Execute one admitted spend request and follow it to a terminal state. */
  async function spend(request) {
    if (!request || typeof request !== 'object') throw Object.assign(new Error('INVALID_SPEND'), {code: 'INVALID_SPEND'});
    const {kind, asset, amount, destination, minAmountOut} = request;
    if (!['swap', 'transfer'].includes(kind)) throw Object.assign(new Error('SPEND_KIND_UNSUPPORTED'), {code: 'SPEND_KIND_UNSUPPORTED'});
    if (typeof asset !== 'string' || typeof amount !== 'string' || !/^[1-9][0-9]{0,30}$/.test(amount)) {
      throw Object.assign(new Error('SPEND_BOUNDS_INVALID'), {code: 'SPEND_BOUNDS_INVALID'});
    }
    if (kind === 'transfer' && typeof destination !== 'string') {
      throw Object.assign(new Error('SPEND_DESTINATION_REQUIRED'), {code: 'SPEND_DESTINATION_REQUIRED'});
    }
    if (kind === 'swap' && typeof destination !== 'string') {
      throw Object.assign(new Error('SPEND_SWAP_DESTINATION_REQUIRED'), {code: 'SPEND_SWAP_DESTINATION_REQUIRED'});
    }

    const {createAgentApi, createIdempotencyKey} = await sdkLoader();
    const api = createAgentApi({apiKey, baseUrl});
    const gapi = api.forGrant(grantToken);
    const idempotencyKey = createIdempotencyKey();

    const body = kind === 'swap'
      ? {origin_asset: asset, destination_asset: destination, amount, ...(minAmountOut ? {min_amount_out: minAmountOut} : {}), confidential: true}
      : {asset, amount, recipient: destination, confidential: true};

    const submitted = kind === 'swap'
      ? await gapi.swap(agentId, body, {idempotencyKey})
      : await gapi.transfer(agentId, body, {idempotencyKey});

    const result = {
      id: `spend:${sha(JSON.stringify(body)).slice(0, 16)}:${randomUUID().slice(0, 8)}`,
      kind,
      request: body,
      correlationId: submitted.correlation_id ?? null,
      status: submitted.status ?? 'UNKNOWN',
      failureCode: submitted.failure_code ?? null,
      txHash: submitted.details?.tx_hash ?? null,
      observedAt: new Date(clock()).toISOString(),
      terminal: false,
    };

    const terminalStates = new Set(['SUCCESS', 'FAILED', 'REFUNDED', 'NEEDS_REVIEW']);
    const deadline = Date.now() + timeoutMs;
    while (!terminalStates.has(result.status) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, pollMs));
      const status = await api.getStatus(result.correlationId, {waitMs: pollMs});
      result.status = status.status ?? result.status;
      result.failureCode = status.failure_code ?? result.failureCode;
      result.txHash = status.details?.tx_hash ?? result.txHash;
      result.observedAt = new Date(clock()).toISOString();
    }
    result.terminal = terminalStates.has(result.status);
    return result;
  }

  return Object.freeze({capability, spend});
}
