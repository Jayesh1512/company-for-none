import { fingerprint } from '../contracts.mjs';
import { atomic, money, sameAsset, balanceChange, integrity, conflict } from './state.mjs';

const clone = value => structuredClone(value);
const text = (value, name) => { if (typeof value !== 'string' || !value) integrity(`${name} required`); return value; };
const resources = ['cash', 'credit'];

// These are identities and provider ordering facts, not policy/affordability decisions.
export function observationScope(resource, binding) {
  if (!resources.includes(resource)) integrity('Observation resource must be cash or credit');
  if (!binding || typeof binding !== 'object') integrity('Economic binding required');
  for (const field of ['provider', 'companyId', 'accountId', 'network', 'asset', 'bucket']) text(binding[field], `binding.${field}`);
  for (const field of ['organizationId', 'credentialId']) if (binding[field] !== null) text(binding[field], `binding.${field}`);
  if (!Number.isInteger(binding.decimals) || binding.decimals < 0 || binding.decimals > 30) integrity('binding.decimals invalid');
  const keys = ['provider', 'companyId', 'accountId', 'organizationId', 'credentialId', 'network', 'asset', 'decimals', 'bucket'];
  if (Object.keys(binding).some(key => !keys.includes(key))) integrity('Economic binding has unknown fields');
  return fingerprint({ resource, binding });
}
function watermark(value) {
  text(value?.stream, 'watermark.stream'); atomic(value.position, 'watermark.position');
  if (Object.keys(value).some(key => !['stream', 'position'].includes(key))) integrity('Provider watermark has unknown fields');
  return value;
}
function ordered(a, b) {
  watermark(a); watermark(b);
  if (a.stream !== b.stream) conflict('Provider watermark stream changed');
  return atomic(a.position) < atomic(b.position) ? -1 : atomic(a.position) > atomic(b.position) ? 1 : 0;
}
function validateUnits(binding, value) {
  money(value);
  if (!sameAsset({ ...binding, amount: '0' }, value)) integrity('Provider binding and Money units differ');
}
export function initializeObservationFacts(state) {
  state.providerObservations ??= [];
  state.balanceReconciliations ??= [];
  state.reconciliationHistory ??= [];
  state.openingRecords ??= [];
  state.economicMovements ??= [];
  return state;
}
function observationAmount(observation) {
  if (observation.resource === 'cash') { validateUnits(observation.binding, observation.money); return observation.money.amount; }
  atomic(observation.availableNanoUsd, 'availableNanoUsd'); return observation.availableNanoUsd;
}

/** Persist the exact Rules comparison. Never derives an opening, lot or balancing entry. */
export function storeBalanceSnapshot(state, plan) {
  initializeObservationFacts(state);
  const observation = plan.observation;
  text(observation?.id, 'observation.id'); text(observation.evidenceRef, 'observation.evidenceRef');
  if (!Number.isFinite(Date.parse(observation.observedAt))) integrity('Observation time required');
  const scopeId = observationScope(observation.resource, observation.binding);
  watermark(observation.watermark);
  const observedAmount = observationAmount(observation);
  const reconciliation = plan.reconciliation;
  if (!reconciliation || !['matched', 'deficit', 'surplus', 'pending', 'unreconciled'].includes(reconciliation.status)) integrity('Exact Rules reconciliation required');
  atomic(reconciliation.expectedAmount, 'expectedAmount'); atomic(reconciliation.observedAmount, 'observedAmount');
  if (reconciliation.observedAmount !== observedAmount) integrity('Reconciliation amount differs from absolute provider observation');
  if (!Array.isArray(reconciliation.unresolvedOperationIds) || reconciliation.unresolvedOperationIds.some(id => typeof id !== 'string' || !id)) integrity('Exact unresolved operation identities required');
  const previous = state.balanceReconciliations.find(item => item.scopeId === scopeId);
  if (previous && ordered(observation.watermark, previous.watermark) < 0) conflict('Observation watermark is older than the recorded provider position');
  const atPosition = state.providerObservations.find(item => item.scopeId === scopeId && ordered(item.watermark, observation.watermark) === 0);
  if (atPosition && observationAmount(atPosition) !== observedAmount) conflict('Same provider watermark has inconsistent absolute amounts');
  const byId = state.providerObservations.find(item => item.id === observation.id);
  if (byId && byId.fingerprint !== fingerprint(observation)) conflict('Observation identity reused with different contents');
  if (!byId) state.providerObservations.push({ ...clone(observation), scopeId, fingerprint: fingerprint(observation), postedVersion: state.version + 1 });
  const exact = { ...clone(reconciliation), scopeId, observationId: observation.id, resource: observation.resource, watermark: clone(observation.watermark), financialVersion: state.version + 1, observedAt: observation.observedAt };
  state.reconciliationHistory.push(clone(exact));
  if (previous) Object.assign(previous, exact); else state.balanceReconciliations.push(exact);
  return { observationId: observation.id, scopeId, resource: observation.resource, watermark: clone(observation.watermark), status: reconciliation.status, evidenceRef: observation.evidenceRef };
}

/** Opening is an explicit approved record, once per attributable resource, never a snapshot. */
export function storeOpening(state, resource, plan) {
  initializeObservationFacts(state);
  text(plan.receiptId, 'opening receiptId'); text(plan.evidenceRef, 'opening evidenceRef'); text(plan.provenance, 'opening provenance');
  const scopeId = observationScope(resource, plan.binding); watermark(plan.watermark);
  if (state.openingRecords.some(item => item.scopeId === scopeId) || state.economicMovements.some(item => item.scopeId === scopeId)) conflict('Resource opening is already established');
  if (resource === 'cash') {
    validateUnits(plan.binding, plan.money);
    // Even a fully spent or refunded legacy balance is existing economic history.
    if (state.balances.some(item => sameAsset(item, plan.money))) conflict('Opening overlaps existing cash history');
    balanceChange(state, plan.money, 1);
  } else {
    const credit = plan.credit;
    text(credit?.id, 'credit.id'); text(credit.owner, 'credit.owner'); text(credit.provider, 'credit.provider'); text(credit.provenance, 'credit.provenance'); atomic(credit.availableNanoUsd);
    if (credit.provider !== plan.binding.provider || credit.owner !== plan.binding.accountId) integrity('Credit opening ownership differs from provider binding');
    if (state.credits.lots.length || atomic(state.credits.availableNanoUsd) !== 0n) conflict('Opening overlaps existing credit history');
    state.credits.lots.push({ ...clone(credit), binding: clone(plan.binding), scopeId, openingReceiptId: plan.receiptId, recordType: 'opening' });
    state.credits.availableNanoUsd = credit.availableNanoUsd;
  }
  state.openingRecords.push({ ...clone(plan), id: plan.receiptId, resource, scopeId, postedVersion: state.version + 1 });
  return { scopeId, resource, watermark: clone(plan.watermark), evidenceRef: plan.evidenceRef };
}

function relevantOpenings(state, resource, value) {
  return (state.openingRecords ?? []).filter(item => item.resource === resource && (resource === 'credit' || sameAsset({ ...item.binding, amount: '0' }, value)));
}

/** Record a discrete posted movement after its opening boundary; never synthesizes one. */
export function postEconomicMovement(state, { resource, value, metadata = {}, id, direction, sourceKind }) {
  const openings = relevantOpenings(state, resource, value);
  if (!metadata.binding) {
    if (openings.length) conflict('Posted movement lacks the opened resource binding');
    return null; // Historical/unbound fixture records retain their original semantics.
  }
  initializeObservationFacts(state);
  const scopeId = observationScope(resource, metadata.binding);
  watermark(metadata.watermark); text(metadata.providerReference, 'providerReference'); text(id, 'movement id');
  const opening = state.openingRecords.find(item => item.scopeId === scopeId);
  if (!opening) conflict('Posted movement has no dedicated resource opening');
  if (ordered(metadata.watermark, opening.watermark) <= 0) conflict('Receipt is already covered by or predates the opening watermark');
  if (resource === 'cash') validateUnits(metadata.binding, value); else atomic(value, 'credit movement amount');
  if (state.economicMovements.some(item => item.scopeId === scopeId && item.providerReference === metadata.providerReference)) conflict('Provider transaction already posted under another receipt identity');
  const record = { id, scopeId, resource, binding: clone(metadata.binding), watermark: clone(metadata.watermark), providerReference: metadata.providerReference, direction, sourceKind, postedVersion: state.version + 1,
    ...(resource === 'cash' ? { money: clone(value) } : { amountNanoUsd: value }), ...(metadata.evidenceRef ? { evidenceRef: metadata.evidenceRef } : {}) };
  state.economicMovements.push(record); return record;
}

export function storeCashReceipt(state, plan) {
  text(plan.receiptId, 'receiptId'); text(plan.provenance, 'provenance'); text(plan.evidenceRef, 'evidenceRef'); money(plan.money);
  if (!plan.binding) integrity('Dedicated cash receipt binding required');
  const record = postEconomicMovement(state, { resource: 'cash', value: plan.money, metadata: plan, id: plan.receiptId, direction: 'in', sourceKind: 'cash_receipt' });
  balanceChange(state, plan.money, 1); return record;
}
export function storeCreditReceipt(state, plan) {
  text(plan.receiptId, 'receiptId'); text(plan.provenance, 'provenance'); text(plan.evidenceRef, 'evidenceRef');
  const credit = plan.credit;
  text(credit?.id, 'credit.id'); text(credit.owner, 'credit.owner'); text(credit.provider, 'credit.provider'); text(credit.provenance, 'credit.provenance'); atomic(credit.availableNanoUsd);
  if (!plan.binding) integrity('Dedicated credit receipt binding required');
  if (credit.owner !== plan.binding.accountId || credit.provider !== plan.binding.provider) integrity('Credit receipt ownership differs from provider binding');
  if (state.credits.lots.some(item => item.id === credit.id)) conflict('Credit lot already exists');
  const record = postEconomicMovement(state, { resource: 'credit', value: credit.availableNanoUsd, metadata: plan, id: plan.receiptId, direction: 'in', sourceKind: 'credit_receipt' });
  state.credits.lots.push({ ...clone(credit), binding: clone(plan.binding), scopeId: record.scopeId, recordType: 'receipt', receiptId: plan.receiptId });
  state.credits.availableNanoUsd = (atomic(state.credits.availableNanoUsd) + atomic(credit.availableNanoUsd)).toString();
  return record;
}
