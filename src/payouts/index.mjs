import { fingerprint, assertExternalResult, sameAsset } from '../contracts.mjs';
import { JournalError } from '../journal/index.mjs';

const reject = (code, message) => { throw new JournalError(code, message); };
const kindOf = plan => plan?.kind ?? plan?.type;
const unknown = (action, mode, code = 'UNKNOWN_OUTCOME') => ({ status: 'unknown', mode, code, operation: { actionId: action.id, fingerprint: fingerprint(action) }, evidence: [], reconciliationRequired: true });

/** Executes a frozen obligation; it has no research or report-generation dependency. */
export function createPayouts({ journal, treasury, custody, rules } = {}) {
  if (!journal || !treasury || !custody) reject('INVALID_INPUT', 'Journal, treasury and custody required');
  function existing(action) {
    const record = journal.get('payouts', action.id);
    if (record && record.fingerprint !== fingerprint(action)) reject('CONFLICT', 'Payout action identity reused with changed contents');
    return record;
  }
  function validateResult(record, outcome) {
    try {
      assertExternalResult(outcome);
      if (outcome.status === 'confirmed') {
        const receipt = outcome.receipt;
        if (!receipt || receipt.status !== 'confirmed' || receipt.recipient !== record.plan.recipient || !sameAsset(receipt.money, record.plan.money) || receipt.money.amount !== record.plan.money.amount) return unknown(record.action, outcome.mode, 'RECEIPT_MISMATCH');
      }
      return outcome;
    } catch { return unknown(record.action, record.mode, 'INVALID_PROVIDER_RESULT'); }
  }
  async function save(record, result) {
    const outcome = validateResult(record, result);
    const saved = await journal.transaction({ actionId: `payout:result:${record.action.id}:${fingerprint(outcome)}`, fingerprint: fingerprint(outcome) }, tx => {
      const latest = tx.get('payouts', record.action.id);
      if (latest.status === 'confirmed' && outcome.status !== 'confirmed') reject('CONFLICT', 'Confirmed payout cannot regress');
      tx.put('payouts', record.action.id, { ...latest, status: outcome.status, result: outcome });
      tx.updateOperation(record.action.id, { status: outcome.status, result: outcome });
      treasury.applyPayoutResult(tx, { actionId: record.action.id, result: outcome });
      return outcome;
    });
    return saved.result;
  }
  return {
    async fulfill({ action, decision, facts = {}, obligation } = {}) {
      if (!action?.id) reject('INVALID_INPUT', 'Payout action required');
      const prior = existing(action);
      if (prior) return prior.result ?? unknown(action, prior.mode);
      if (decision?.status !== 'allow' || kindOf(decision.plan) !== 'payout') reject('POLICY_BLOCK', 'Exact M01 payout authorization required');
      if (decision.actionFingerprint !== fingerprint(action)) reject('CONFLICT', 'Decision action fingerprint differs');
      const plan = decision.plan;
      const frozen = treasury.getObligation(plan.obligationId);
      if (!frozen || (obligation && obligation.id !== frozen.id) || frozen.recipient !== plan.recipient || !sameAsset(frozen.money, plan.money)) reject('CONFLICT', 'Frozen contributor obligation differs');
      if (action.recipient !== plan.recipient || !sameAsset(action.money, plan.money) || action.money.amount !== plan.money.amount) reject('CONFLICT', 'Payout action differs from exact approved transfer');
      await treasury.applyDecision({ actionId: action.id, decision });
      const mode = action.mode ?? decision.mode ?? 'unavailable';
      const initial = { action, fingerprint: fingerprint(action), obligationId: frozen.id, plan, mode, status: 'unknown', result: unknown(action, mode) };
      const claim = await journal.transaction({ actionId: `payout:prepare:${action.id}`, fingerprint: fingerprint({ action, plan }) }, tx => {
        tx.operation({ actionId: action.id, fingerprint: fingerprint(action), purpose: 'payout', obligationId: frozen.id, network: action.money.network, provider: 'custody', status: 'unknown' });
        tx.put('payouts', action.id, initial);
        return initial;
      });
      if (claim.replayed) return existing(action).result;
      let result;
      try { result = await custody.transfer({ action, decision, facts: { ...facts, obligation: frozen, financial: treasury.snapshot() } }); }
      catch { result = unknown(action, mode); }
      return save(initial, result);
    },
    async reconcile({ action, decision, facts = {} } = {}) {
      if (!action?.id) reject('INVALID_INPUT', 'Original payout action required');
      const record = existing(action);
      if (!record) reject('INVALID_INPUT', 'Payout operation not found');
      if (record.status === 'confirmed') return record.result;
      const authorization = decision ?? rules?.evaluate({ id: `reconcile:${action.id}`, type: 'reconcile', mode: record.mode, orderId: action.orderId }, { ...facts, operation: record, financial: treasury.snapshot() });
      if (authorization?.status !== 'allow') reject('POLICY_BLOCK', 'M01 reconciliation authorization required');
      let result;
      try { result = await custody.reconcile({ action, decision: authorization, facts }); }
      catch { result = unknown(action, record.mode); }
      return save(record, result);
    },
    get(actionId) { return journal.get('payouts', actionId); },
  };
}
