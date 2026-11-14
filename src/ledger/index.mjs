import { createHash } from 'node:crypto';
import { assertMoney } from '../contracts.mjs';

const AMOUNT = /^(0|[1-9]\d*)$/;
const STATUSES = new Set(['due', 'not_submitted', 'pending', 'confirmed', 'failed', 'unknown', 'provisional', 'reserved', 'reconciled', 'released']);
const CATEGORIES = new Set(['sale', 'funding', 'consumption', 'fee', 'obligation', 'payout', 'refund', 'reversal', 'operational_cost', 'reservation', 'late_payment', 'seed', 'capital', 'credit', 'procurement']);
// The projection accepts a narrow record, never arbitrary journal payloads.
const ROW_FIELDS = new Set(['id', 'sequence', 'type', 'category', 'at', 'status', 'mode', 'money', 'costNanoUsd', 'costStatus', 'upperBoundNanoUsd', 'reservationId', 'actionId', 'expenseCategory', 'creditNanoUsd', 'obligationId', 'reversesId', 'evidenceRef', 'accountingDay', 'description']);
const EVENT_CATEGORIES = { 'capital.recorded':'capital','credit.observed':'credit','procurement.confirmed':'procurement', 'sale.confirmed': 'sale', 'obligation.due': 'obligation', 'funding.confirmed': 'funding', 'inference.consumed': 'consumption', 'fee.recorded': 'fee', 'payout.pending': 'payout', 'payout.unknown': 'payout', 'payout.confirmed': 'payout', 'payout.failed': 'payout', 'payout.not_submitted': 'payout', 'refund.confirmed': 'refund', 'accounting.correction': 'reversal', 'operational_cost.recorded': 'operational_cost', 'reservation.recorded': 'reservation', 'reservation.updated': 'reservation', 'payment.late': 'late_payment', 'fixture.bootstrap': 'seed' };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function money(value) {
  assertMoney(value);
  return { network: value.network, asset: value.asset, decimals: value.decimals, amount: value.amount };
}
function add(bucket, key, amount) { bucket[key] = (BigInt(bucket[key] || '0') + BigInt(amount)).toString(); }

/** Rebuildable read projection. All rows and disclosure fields originate in Rules-approved recorded plans. */
export function projectLedger(events, decision) {
  const plan = decision?.plan?.disclosure || decision?.plan?.disclosurePlan || decision?.disclosurePlan || decision?.plan || decision;
  const decisionStatus = decision?.status || decision?.outcome || decision?.decision;
  const publicFields = plan?.publicFields || plan?.fields;
  const readMetadata = Object.fromEntries(['degraded', 'currentSafetyValid', 'readPolicyVersion', 'businessEffectsAllowed']
    .filter(key => decision?.[key] !== undefined || plan?.[key] !== undefined)
    .map(key => [key, decision?.[key] ?? plan?.[key]]));
  if ((decisionStatus && decisionStatus !== 'allow') || !Array.isArray(publicFields)) {
    return { schemaVersion: 1, entries: [], totals: [], costs: {}, checkpoint: 0, disclosureStatus: 'unavailable', reconciliation: 'unavailable', ...readMetadata };
  }
  const fields = new Set(publicFields.filter(key => ROW_FIELDS.has(key)));
  const seen = new Map(), entries = [], totals = new Map(), costs = {}, latest = new Map();
  let checkpoint = 0;
  for (const event of [...events].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))) {
    checkpoint = Math.max(checkpoint, event.sequence || 0);
    const category = EVENT_CATEGORIES[event.type];
    if (!category && !event.data?.ledger && !event.ledger) continue;
    const fact = event.data?.ledger || event.ledger || event.data;
    if (!fact) continue;
    const candidate = { ...fact, category: fact.category || category, id: fact.id || event.id || `event:${event.sequence}`, sequence: event.sequence, at: fact.at || event.at, type: event.type, status: fact.status || (event.type === 'obligation.due' ? 'due' : event.type.endsWith('.pending') ? 'pending' : event.type.endsWith('.unknown') ? 'unknown' : event.type.endsWith('.failed') ? 'failed' : 'confirmed') };
    if (!CATEGORIES.has(candidate.category) || !STATUSES.has(candidate.status)) throw Object.assign(new Error('Malformed ledger category/status.'), { code: 'INVALID_LEDGER_FACT' });
    const canonical = Object.fromEntries([...ROW_FIELDS].filter(k => candidate[k] !== undefined).map(k => [k, k === 'money' ? money(candidate[k]) : structuredClone(candidate[k])]));
    // Same economic fact may be observed twice. Conflicting contents are a data-integrity fault.
    const fingerprint = digest(Object.fromEntries(Object.entries(canonical).filter(([key]) => !['sequence', 'at'].includes(key))));
    if (seen.has(candidate.id)) {
      if (seen.get(candidate.id) !== fingerprint) throw Object.assign(new Error('Conflicting ledger fact identity.'), { code: 'CONFLICT' });
      continue;
    }
    seen.set(candidate.id, fingerprint);
    const row = Object.fromEntries(Object.entries(canonical).filter(([key]) => fields.has(key)));
    entries.push(row);
    if (row.category && row.status) {
      const key = row.category === 'payout' ? `payout:${row.obligationId || row.actionId || row.id}` : row.category === 'reservation' ? `reservation:${row.reservationId || row.id}` : `${row.category}:${row.actionId || row.id}`;
      latest.set(key, { status: row.status, costStatus: row.costStatus });
      if (['funding', 'consumption', 'procurement'].includes(row.category) && row.status === 'confirmed' && row.reservationId) latest.set(`reservation:${row.reservationId}`, { status: 'reconciled' });
    }
    // Totals are computed only from disclosed financial fields. A hidden value cannot leak through a sum.
    if (row.money && row.category && row.status) {
      const assetKey = JSON.stringify([row.money.network, row.money.asset, row.money.decimals]);
      if (!totals.has(assetKey)) totals.set(assetKey, { network: row.money.network, asset: row.money.asset, decimals: row.money.decimals, amounts: {} });
      add(totals.get(assetKey).amounts, `${row.category}:${row.status}`, row.money.amount);
    }
    if (row.costNanoUsd !== undefined && row.category && row.status) {
      if (!AMOUNT.test(row.costNanoUsd)) throw Object.assign(new Error('Malformed nano-USD cost.'), { code: 'INVALID_LEDGER_FACT' });
      // Funding converts cash into credit; only consumption/fee/operational expense is expense.
      const classification = row.category;
      add(costs, `${classification}:${row.costStatus || row.status}`, row.costNanoUsd);
    }
  }
  const unresolved = [...latest.values()].some(e => ['pending', 'unknown', 'provisional', 'reserved'].includes(e.status) || e.costStatus === 'pending');
  return { schemaVersion: 1, entries, totals: [...totals.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), costs, checkpoint, disclosureStatus: 'approved', policyVersion: decision.policyVersion, reconciliation: unresolved ? 'unresolved' : 'recorded', updatedAt: entries.at(-1)?.at || null, ...readMetadata };
}

export function createLedger({ journal, rules }) {
  return { async view(context = {}) { const events = await journal.events({ afterSequence: 0 }); const decision = await rules.evaluate({ type: 'disclosure', id: 'disclosure:public-ledger', resource: 'ledger' }, { ...context, events }); return projectLedger(events, decision); } };
}
