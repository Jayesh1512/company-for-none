import { fingerprint } from '../../src/contracts.mjs';

// Exact injected Rules outputs for storage acceptance, not application policy.
export const usd = amount => ({ network: 'fixture', asset: 'usdc', decimals: 6, amount });
export const bootstrapPlan = { kind: 'bootstrap', receiptId: 'bootstrap:one', money: usd('100000000'), provenance: 'fixture-only-no-funds' };
export const allocationPlan = {
  kind: 'allocation', id: 'allocation:one', settlementId: 'receipt:sale:one', orderId: 'order:one',
  revenue: usd('5000000'), treasury: usd('4000000'), contributorReserve: usd('1000000'),
  refundReserve: usd('5000000'), refundExposure: usd('5000000'),
  obligations: [{ id: 'obligation:one', orderId: 'order:one', settlementId: 'receipt:sale:one', recipient: 'contributor.fixture', shareBps: 2000, money: usd('1000000'), completedAmount: '0', status: 'due' }],
};
export const fundingReservation = { kind: 'reservation', reservation: { id: 'reservation:funding', actionId: 'funding:one', orderId: 'order:one', purpose: 'funding', accountingDay: '2026-11-11', upperBoundNanoUsd: '1000000000', resource: usd('1000000'), status: 'reserved' } };
export const fundingPlan = { kind: 'funding', receiptId: 'funding:receipt:one', reservationId: 'reservation:funding', cashSpent: usd('1000000'), credit: { id: 'credit:one', owner: 'agent.fixture', provider: 'fixture-cloud', availableNanoUsd: '1000000000', provenance: 'agent-funded-fixture' } };
export const inferenceReservation = { kind: 'reservation', reservation: { id: 'reservation:inference', actionId: 'inference:one', purpose: 'inference', accountingDay: '2026-11-11', upperBoundNanoUsd: '200000000', status: 'reserved' } };
export const consumptionPlan = { kind: 'consumption', receiptId: 'cost:one', reservationId: 'reservation:inference', actualCostNanoUsd: '100000000', creditId: 'credit:one', remainingCreditNanoUsd: '900000000', accountingDay: '2026-11-11' };
export const payoutPlan = { kind: 'payout', obligationId: 'obligation:one', recipient: 'contributor.fixture', money: usd('1000000'), completedAmount: '1000000', status: 'paid' };
export const payoutAction = { id: 'payout:one', type: 'payout', orderId: 'order:one', network: 'fixture', mode: 'fixture', recipient: 'contributor.fixture', money: usd('1000000') };
export function approve(treasury, action, plan) {
  const version = treasury.snapshot().version;
  const actionFingerprint = fingerprint(action);
  return { status: 'allow', reasonCode: 'FIXTURE_APPROVED', mode: 'fixture', financialVersion: version, policyEpoch: 1, policyVersion: 'fixture:one', actionFingerprint, plan: structuredClone(plan),
    permit: { id: `permit:${action.id}`, actionId: action.id, actionFingerprint, financialVersion: version, policyEpoch: 1, policyVersion: 'fixture:one', signature: 'injected-test-only', expiresAt: '2099-01-01T00:00:00Z' } };
}
export async function apply(treasury, id, plan) { return treasury.applyDecision({ actionId: id, decision: approve(treasury, { id }, plan) }); }
