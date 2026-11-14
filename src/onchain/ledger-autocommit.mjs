// Auto-commit autonomy events to the on-chain ledger.
//
// Watches the journal for autonomy-spine events (agent started/stopped/delegated,
// work queued/completed/blocked, spend requested/completed) that have not yet been
// committed, and appends them to the corpus ledger through the ledger committer.
//
// It is a separate, explicit committer so it can never change the frozen autonomy
// decision engine. It is idempotent: each event carries its journal sequence and
// the last committed sequence is stored, so a restart re-appends nothing.
import {fingerprint} from '../contracts.mjs';

// Events worth showing on the ledger page: agent lifecycle, delegation lineage,
// work outcomes and spend alerts. Any other journal event is ignored here.
export const COMMITTABLE_TYPES = Object.freeze([
  'agent.created', 'agent.started', 'agent.stopped', 'agent.delegated',
  'work.queued', 'work.blocked', 'work.completed', 'work.resumed',
  'spend.requested', 'spend.completed', 'spend.refused',
  'command.rejected', 'gap.recorded', 'improvement.proposed', 'improvement.promoted',
]);

const fail = code => { throw Object.assign(new Error(code), {code}); };

/**
 * @param {object} deps
 * @param {object} deps.journal     durable journal
 * @param {object} deps.committer   from createLedgerCommitter
 * @param {string} deps.companyId
 * @param {number} [deps.batchSize] max events per append (ledger caps 50)
 */
export function createLedgerAutoCommit({journal, committer, companyId, batchSize = 25}) {
  const cursorId = 'ledgerAutoCommit';

  function lastSequence() {
    return journal.get('ledgerAutoCommit', cursorId)?.sequence ?? 0;
  }

  /** All committable events for this company after the stored cursor, in order. */
  function pending() {
    const after = lastSequence();
    return journal.events({afterSequence: after})
      .filter(e => e.data?.companyId === companyId && COMMITTABLE_TYPES.includes(e.type))
      .sort((a, b) => a.sequence - b.sequence);
  }

  /** Append the next batch; returns {committed, txHash, sequence} or {committed:0}. */
  async function tick() {
    const events = pending();
    if (!events.length) return {committed: 0, sequence: lastSequence(), txHash: null};

    // The ledger record commits to the journal event's own identity and time; the
    // payload is the same data the trace already shows. Identities are hashed on
    // chain by projectChainRecords, so no raw agent id or name reaches the contract.
    const batch = events.slice(0, batchSize).map(e => ({type: e.type, at: e.at, data: e.data}));
    const lastEvent = events[Math.min(batch.length, batchSize) - 1];

    const result = await committer.append(batch);

    const next = {id: cursorId, companyId, sequence: lastEvent.sequence, at: new Date().toISOString(), lastTxHash: result.txHash ?? null};
    await journal.transaction({actionId: `ledger-auto:${lastEvent.sequence}:${fingerprint(next)}`, fingerprint: fingerprint(next)}, tx => {
      tx.put('ledgerAutoCommit', cursorId, next);
      return null;
    });
    return {committed: batch.length, sequence: lastEvent.sequence, txHash: result.txHash ?? null};
  }

  /** Drain every pending batch; returns the list of appended batches. */
  async function drain({maxBatches = 20} = {}) {
    const done = [];
    for (let i = 0; i < maxBatches; i += 1) {
      const r = await tick();
      if (!r.committed) break;
      done.push(r);
    }
    return done;
  }

  return {tick, drain, pending, lastSequence};
}
