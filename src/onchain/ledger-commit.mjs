// Append company ledger events to the mainnet ledger contract via the Agent API
// native-call route, using the project's own M01 record projection.
//
// Read the current head, build the next hash-chained batch from the given
// events, and call append() through the agent's NEAR account under the grant.
// Returns the Agent API correlation id and the transaction hash, or throws.
import {
  ledgerCompanyHash, ledgerRecordHash, LEDGER_ZERO_HASH,
} from '../rules/onchain-ledger.mjs';
import {hash} from '../rules/config.mjs';

const DEFAULT_RPC = 'https://free.rpc.fastnear.com';

async function rpcView(base, contract, method_name, args) {
  const response = await fetch(base, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'query', params: {request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')}}),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (payload.error) throw Object.assign(new Error(payload.error.message ?? 'RPC_ERROR'), {code: 'LEDGER_RPC_ERROR'});
  return JSON.parse(Buffer.from(payload.result.result).toString('utf8'));
}

/**
 * @param {object} deps
 * @param {object} deps.api      createAgentApi(...) instance
 * @param {string} deps.agentId
 * @param {string} deps.grantToken
 * @param {string} deps.contractId  ledger contract account
 * @param {string} deps.companyId
 * @param {string} [deps.rpc]       NEAR RPC endpoint
 */
export function createLedgerCommitter({api, agentId, grantToken, contractId, companyId, rpc = DEFAULT_RPC}) {
  const companyHash = ledgerCompanyHash(companyId);
  const gapi = api.forGrant(grantToken);

  /** Append one or more events; returns {correlationId, txHash}. */
  async function append(events) {
    if (!Array.isArray(events) || events.length === 0) throw Object.assign(new Error('LEDGER_EVENTS_REQUIRED'), {code: 'LEDGER_EVENTS_REQUIRED'});
    const head = await rpcView(rpc, contractId, 'get_head', {});
    const at = new Date().toISOString();
    let previousHash = head.hash;
    const records = events.map((event, i) => {
      const sequence = head.sequence + i + 1;
      const actorHash = hash({domain: 'company-ledger:actor:v1', companyHash, actor: event.data?.actorId ?? null});
      const payloadHash = hash({domain: 'company-ledger:payload:v1', companyHash, data: event.data ?? null});
      const r = {sequence, type: event.type, at, actorHash, payloadHash, previousHash};
      r.hash = ledgerRecordHash(companyHash, r);
      previousHash = r.hash;
      return r;
    });

    const result = await gapi.nativeNearCall(agentId, {
      receiver_id: contractId,
      method_name: 'append',
      args: {company_hash: companyHash, expected_sequence: head.sequence, expected_hash: head.hash, records},
      gas: '50000000000000',
      deposit: '0',
    }, {idempotencyKey: `ledger:${head.sequence + 1}:${records.at(-1).hash.slice(0, 16)}`});

    // Follow to a terminal state so the caller gets a real tx hash, not a dispatch.
    // A ledger append needs enough gas for records + hashing; 50 Tgas is safe.
    let status = result;
    const terminal = new Set(['SUCCESS', 'FAILED', 'REFUNDED', 'NEEDS_REVIEW']);
    const deadline = Date.now() + 180_000;
    while (!terminal.has(status.status) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await api.getStatus(result.correlation_id, {waitMs: 5000});
    }
    const txHash = status.details?.tx_hash ?? null;
    if (status.status !== 'SUCCESS') {
      // UNCERTAIN with a broadcast tx still must not be reported as success.
      throw Object.assign(new Error(status.failure_code ?? status.status ?? 'LEDGER_APPEND_FAILED'), {code: 'LEDGER_APPEND_FAILED', providerStatus: status.status, txHash});
    }
    return {correlationId: result.correlation_id, txHash};
  }

  return {append, companyHash, head: () => rpcView(rpc, contractId, 'get_head', {})};
}
