import { JournalError } from '../journal/index.mjs';
import { assertIntegerString, assertMoney, sameAsset as sharedSameAsset } from '../contracts.mjs';

// Storage/integrity operations only: no prices, percentages, caps or eligibility here.
export const integrity = message => { throw new JournalError('INVALID_INPUT', message); };
export const conflict = message => { throw new JournalError('CONFLICT', `${message}; reevaluate with Rules`); };
export function atomic(value, name = 'amount') {
  assertIntegerString(value, name);
  return BigInt(value);
}
export function money(value) {
  return assertMoney(value);
}
export const sameAsset = sharedSameAsset;
export const amount = (template, value) => ({ network: template.network, asset: template.asset, decimals: template.decimals, amount: value.toString() });
export function emptyFinancial() {
  return { schemaVersion: 1, version: 0, balances: [], protectedFunds: [], allocations: [], obligations: [], reservations: [], refunds: [], latePayments: [], credits: { availableNanoUsd: '0', lots: [] }, dailyCosts: {}, consumedPermits: [], approvedPlans: [], receipts: [] };
}
export function balanceChange(state, value, direction) {
  money(value);
  let entry = state.balances.find(item => sameAsset(item, value));
  if (!entry) { entry = amount(value, 0n); state.balances.push(entry); }
  const next = atomic(entry.amount) + BigInt(direction) * atomic(value.amount);
  if (next < 0n) conflict('Plan would record a negative controlled balance');
  entry.amount = next.toString();
}
export function protectedChange(state, id, value, direction, purpose, extra = {}) {
  money(value);
  let entry = state.protectedFunds.find(item => item.id === id);
  if (!entry) {
    if (direction < 0) conflict('Protected resource is missing');
    entry = { id, purpose, ...extra, ...amount(value, 0n) }; state.protectedFunds.push(entry);
  }
  if (!sameAsset(entry, value)) conflict('Protected resource units changed');
  const next = atomic(entry.amount) + BigInt(direction) * atomic(value.amount);
  if (next < 0n) conflict('Protected resource would become negative');
  entry.amount = next.toString();
}
export function assertConservation(state) {
  for (const balance of state.balances) {
    const protectedAmount = state.protectedFunds.filter(entry => sameAsset(entry, balance)).reduce((sum, entry) => sum + atomic(entry.amount), 0n);
    if (protectedAmount > atomic(balance.amount)) conflict('Plan overstates disjoint protected cash');
  }
  for (const resource of state.protectedFunds) {
    if (atomic(resource.amount) > 0n && !state.balances.some(balance => sameAsset(balance, resource))) conflict('Protected cash has no controlled balance');
  }
}
export function requireFresh(state, decision, expectedVersion, currentPolicy) {
  if (!decision || decision.status !== 'allow') throw new JournalError('POLICY_BLOCK', 'An allowed M01 decision is required');
  const version = decision.financialVersion ?? decision.inputVersions?.financial;
  if (!Number.isSafeInteger(version) || version !== state.version || (expectedVersion !== undefined && expectedVersion !== state.version)) conflict('Financial version changed');
  if (currentPolicy && (currentPolicy.policyEpoch ?? currentPolicy.epoch) !== decision.policyEpoch) conflict('Rules policy epoch changed');
  if (typeof decision.actionFingerprint !== 'string' || !decision.actionFingerprint) integrity('Decision fingerprint required');
}
