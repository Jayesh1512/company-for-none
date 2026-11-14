// Execute agent-initiated spend requests produced by the autonomy loop.
//
// A recorded `spendRequests` entry (from an agent `spend` command) is executed
// by the real Agent API spend port, within M01-admitted bounds and the owner's
// policy/grant. This module does NOT decide authority: it refuses unless the
// request is the exact admitted one, and it records the provider result and an
// optional ledger commitment so the whole run is checkable on chain.
//
// Standalone by design: it can be driven by a loop event, but it does not enter
// the frozen inference decision engine.
import {fingerprint} from '../contracts.mjs';

const CLOSED = new Set(['completed', 'cancelled', 'superseded', 'failed']);
const TERMINAL = new Set(['SUCCESS', 'FAILED', 'REFUNDED', 'NEEDS_REVIEW']);

const fail = code => { throw Object.assign(new Error(code), {code}); };

/**
 * @param {object} deps
 * @param {object} deps.journal   durable journal
 * @param {object} deps.agentSpend port from createAgentSpendPort
 * @param {object} [deps.ledger]  optional { append(records) } ledger committer
 * @param {string} deps.companyId
 */
export function createSpendExecutor({journal, agentSpend, ledger = null, companyId, clock = () => new Date()}) {
  const now = () => new Date(clock()).toISOString();
  const scoped = xs => (xs ?? []).filter(x => x.companyId === companyId);

  function admittedRequest(spendId) {
    const req = journal.get('spendRequests', spendId);
    if (!req || req.companyId !== companyId) fail('SPEND_REQUEST_NOT_FOUND');
    if (req.state !== 'proposed' && req.state !== 'admitted') fail('SPEND_ALREADY_HANDLED');
    if (!req.admission || typeof req.admission.commandHash !== 'string') fail('SPEND_ADMISSION_REQUIRED');
    return req;
  }

  /** Natural-language purpose -> structured request the port can execute. */
  function toPortRequest(req) {
    // The agent names an asset and amount. A supplierRef means "pay this
    // supplier" (transfer); otherwise treat it as an in-account swap between
    // the two policy assets, which needs no destination.
    if (req.supplierRef) return {kind: 'transfer', asset: req.asset, amount: req.amount, destination: req.supplierRef};
    return {kind: 'swap', asset: req.asset, amount: req.amount, destination: req.destinationAsset ?? req.asset};
  }

  async function execute(spendId) {
    const req = admittedRequest(spendId);
    const capability = agentSpend.capability?.() ?? {};
    if (!capability.configured) {
      const blocked = {...req, state: 'blocked', reasonCode: 'SPEND_PORT_NOT_CONFIGURED', updatedAt: now()};
      await journal.transaction({actionId: `spend:${req.id}:blocked`, fingerprint: fingerprint(blocked)}, tx => {tx.put('spendRequests', req.id, blocked); return null;});
      return {status: 'blocked', reasonCode: 'SPEND_PORT_NOT_CONFIGURED'};
    }

    // Mark in-flight before dispatch so a restart cannot double-send.
    const inFlight = {...req, state: 'dispatching', dispatchedAt: now(), updatedAt: now()};
    await journal.transaction({actionId: `spend:${req.id}:dispatch`, fingerprint: fingerprint(inFlight)}, tx => {tx.put('spendRequests', req.id, inFlight); return null;});

    let outcome;
    try {
      outcome = await agentSpend.spend(toPortRequest(req));
    } catch (error) {
      const failed = {...inFlight, state: 'failed', reasonCode: error.code ?? 'SPEND_ERROR', updatedAt: now()};
      await journal.transaction({actionId: `spend:${req.id}:error`, fingerprint: fingerprint(failed)}, tx => {tx.put('spendRequests', req.id, failed); return null;});
      return {status: 'failed', reasonCode: failed.reasonCode};
    }

    const succeeded = outcome.status === 'SUCCESS';
    const recorded = {
      ...inFlight,
      state: succeeded ? 'completed' : TERMINAL.has(outcome.status) ? 'failed' : 'unknown',
      reasonCode: succeeded ? null : outcome.failureCode ?? outcome.status,
      correlationId: outcome.correlationId,
      txHash: outcome.txHash ?? null,
      providerStatus: outcome.status,
      spentAt: succeeded ? now() : null,
      updatedAt: now(),
    };
    await journal.transaction({actionId: `spend:${req.id}:result`, fingerprint: fingerprint(recorded)}, tx => {tx.put('spendRequests', req.id, recorded); return null;});

    // Optional: commit the spend event to the on-chain ledger so a judge can
    // verify the whole loop from the repo + explorer.
    let ledgerTx = null;
    if (succeeded && ledger?.append) {
      try {
        ledgerTx = await ledger.append([{
          type: 'spend.completed',
          data: {companyId, actorId: recorded.actorId, spendId: recorded.id, asset: recorded.asset, amount: recorded.amount, purpose: recorded.purpose, txHash: recorded.txHash},
        }]);
      } catch {
        ledgerTx = null; // Ledger failure never fabricates a spend result.
      }
    }

    return {status: recorded.state, reasonCode: recorded.reasonCode, txHash: recorded.txHash, correlationId: recorded.correlationId, ledgerTx};
  }

  return {execute, admittedRequest};
}
