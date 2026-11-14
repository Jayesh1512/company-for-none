import { integer, money, sameAsset, validateMoney } from './config.mjs';
import { allow, deny, hold, assessSettlement } from './policies.mjs';

function verifiedResult(facts) {
  const result = facts.result;
  if (!result) return hold('RESULT_FACTS_REQUIRED');
  if (['unknown', 'pending'].includes(result.status)) return hold('EXTERNAL_OUTCOME_UNRESOLVED');
  if (result.status !== 'confirmed') return hold('CONFIRMED_RECEIPT_REQUIRED');
  return null;
}
export function bootstrap(facts, config) {
  if (config.mode !== 'fixture') return deny('FIXTURE_ONLY');
  const financial = facts.financial;
  if (!financial || financial.version !== 0 || financial.balances?.length || financial.receipts?.length) return deny('ALREADY_BOOTSTRAPPED');
  return allow({ plan: { kind: 'bootstrap', receiptId: 'fixture:bootstrap', money: structuredClone(config.fixtureBootstrap), provenance: 'fixture_initial_balance', mode: 'fixture' } });
}
export function fundingRecord(action, facts, config) {
  const blocked = verifiedResult(facts); if (blocked) return blocked;
  const receipt = facts.receipt ?? facts.result.receipt;
  if (!receipt || !receipt.creditId || !receipt.agentId || receipt.agentId !== config.treasuryAccount || !receipt.cashSpent || receipt.fundingProvenance !== 'agent_funded') return hold('FUNDING_RECEIPT_REQUIRED');
  validateMoney(receipt.cashSpent);
  const reserved = facts.financial?.reservations?.find(x => x.id === facts.reservationId || x.actionId === receipt.fundingOperationId);
  if (!reserved || !sameAsset(receipt.cashSpent, reserved.resource) || integer(receipt.cashSpent.amount) > integer(reserved.resource.amount)) return deny('RECEIPT_EXCEEDS_RESERVATION');
  const purchased = integer(receipt.purchasedCreditNanoUsd);
  if (purchased === 0n || integer(receipt.availableCreditNanoUsd) !== purchased) return hold('CREDIT_RECEIPT_MISMATCH');
  return allow({ plan: { kind: 'funding', receiptId: receipt.id ?? receipt.reference ?? `funding:${receipt.fundingOperationId}`, reservationId: reserved.id, cashSpent: structuredClone(receipt.cashSpent), credit: { id: receipt.creditId, owner: receipt.agentId, provider: facts.result.provider, availableNanoUsd: purchased.toString(), provenance: receipt.fundingProvenance, mode: facts.result.mode }, reservationStatus: 'reconciled' } });
}
export function consumption(action, facts) {
  const result = facts.result;
  const cost = result?.cost ?? result?.generation?.cost ?? facts.receipt?.cost;
  if (!result || !cost || cost.status !== 'actual' || cost.actualCostNanoUsd == null) return hold('COST_UNRECONCILED');
  if (!['confirmed', 'failed'].includes(result.status)) return hold('EXTERNAL_OUTCOME_UNRESOLVED');
  const reservation = facts.financial?.reservations?.find(x => x.id === facts.reservationId || x.actionId === result.operation?.actionId);
  if (!reservation) return hold('RESERVATION_FACTS_REQUIRED');
  const actual = integer(cost.actualCostNanoUsd);
  const lots = facts.financial.credits.lots ?? [];
  const lot = lots.find(x => x.id === facts.creditId) ?? lots.find(x => integer(x.availableNanoUsd) >= actual);
  if (!lot || integer(lot.availableNanoUsd) < actual) return hold('CREDIT_RECONCILIATION_REQUIRED');
  // A provider overrun remains an observed expense; never fabricate a bounded success.
  const overrun = actual > integer(reservation.upperBoundNanoUsd);
  return allow({ plan: { kind: 'consumption', receiptId: facts.receipt?.id ?? result.providerRequestId ?? result.receipt?.reference ?? `consumption:${reservation.actionId}`, reservationId: reservation.id, actualCostNanoUsd: actual.toString(), creditId: lot.id, remainingCreditNanoUsd: (integer(lot.availableNanoUsd) - actual).toString(), accountingDay: reservation.accountingDay, reservationStatus: 'reconciled', boundExceeded: overrun, remedyRequired: overrun, ...(overrun ? { orderPatch: { remedyRequired: true, reasonCode: 'PROVIDER_COST_BOUND_EXCEEDED' } } : {}) } });
}
export function latePayment(action, facts, now) {
  const assessed = assessSettlement(action, facts, now);
  if (assessed.reasonCode !== 'LATE_PAYMENT_REMEDY') return deny('NOT_LATE_VERIFIED_PAYMENT');
  const { payment, order } = facts;
  if (!order?.id || !facts.financial) return hold('ORDER_FACTS_REQUIRED');
  const due = structuredClone(payment.money);
  return allow({ plan: { kind: 'late_payment', receiptId: payment.id ?? payment.reference, orderId: order.id, revenue: due, refundReserve: structuredClone(due), refundExposure: structuredClone(due), mode: payment.mode, orderPatch: { remedyRequired: true, paymentConfirmed: true, reasonCode: 'LATE_PAYMENT_REMEDY' } } });
}
export function remedy(action, facts) {
  const result = facts.result ?? facts.order?.generationOutcome ?? facts.order?.fundingOutcome;
  if (!result) return hold('RESULT_FACTS_REQUIRED');
  if (['unknown', 'pending'].includes(result.status)) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  const actual = result.cost ?? result.generation?.cost;
  const reservation = facts.financial?.reservations?.find(x => x.id === facts.reservationId || x.actionId === result.operation?.actionId);
  const reconciled = reservation?.status === 'reconciled' || facts.order?.costReconciled === true;
  if (result.status !== 'not_submitted' && !(result.status === 'failed' && actual?.status === 'actual' && reconciled)) return hold('FAILURE_ACCOUNTING_REQUIRED');
  if (!facts.order?.paymentConfirmed) return deny('REMEDY_NOT_ELIGIBLE');
  return allow({ nextAction: 'refund', plan: { kind: 'remedy', nextAction: 'refund', orderPatch: { remedyRequired: true, reasonCode: result.status === 'not_submitted' ? 'SERVICE_NOT_SUBMITTED' : 'SERVICE_FAILED' } } });
}
export function payoutRecord(action, facts) {
  const blocked = verifiedResult(facts); if (blocked) return blocked;
  const obligation = facts.obligation;
  const receipt = facts.receipt ?? facts.result.receipt;
  const paid = receipt?.money ?? receipt?.transferred ?? facts.result.money;
  if (!obligation || !paid || receipt?.recipient !== obligation.recipient) return hold('PAYOUT_RECEIPT_REQUIRED');
  validateMoney(paid);
  if (!sameAsset(paid, obligation.money)) return deny('RECEIPT_ASSET_MISMATCH');
  const completed = integer(obligation.completedAmount ?? '0') + integer(paid.amount);
  if (completed > integer(obligation.money.amount)) return deny('OBLIGATION_OVERPAID');
  return allow({ plan: { kind: 'payout', receiptId: receipt.id ?? receipt.reference ?? facts.result.providerRequestId, obligationId: obligation.id, recipient: obligation.recipient, money: structuredClone(paid), completedAmount: completed.toString(), status: completed === integer(obligation.money.amount) ? 'confirmed' : 'due', releaseProtected: money(paid, integer(paid.amount)) } });
}
export function refundRecord(action, facts) {
  const blocked = verifiedResult(facts); if (blocked) return blocked;
  const receipt = facts.receipt ?? facts.result.receipt;
  const paid = receipt?.money ?? receipt?.transferred ?? facts.result.money;
  if (!facts.payment?.money || !paid || receipt?.recipient !== facts.order?.refundRecipient) return hold('REFUND_RECEIPT_REQUIRED');
  if (!sameAsset(paid, facts.payment.money) || paid.amount !== facts.payment.money.amount) return deny('REFUND_RECEIPT_MISMATCH');
  const reserves = (facts.financial?.protectedFunds ?? []).filter(x => x.orderId === facts.order.id);
  const releaseProtected = reserves.map(x => ({ id: x.id, money: money(x, integer(x.amount)) }));
  const obligations = (facts.financial?.obligations ?? []).filter(x => x.orderId === facts.order.id).map(x => ({ id: x.id, status: integer(x.completedAmount ?? '0') > 0n ? 'paid_before_refund' : 'reversed', completedAmount: x.completedAmount ?? '0', remainingDue: money(x.money, 0n) }));
  return allow({ plan: { kind: 'refund', receiptId: receipt.id ?? receipt.reference ?? facts.result.providerRequestId, orderId: facts.order.id, recipient: facts.order.refundRecipient, money: structuredClone(paid), releaseProtected, obligations, refundExposure: money(paid, 0n), clawbackContributor: false, status: 'confirmed' } });
}
export function reservationUpdate(action, facts) {
  const reservation = facts.financial?.reservations?.find(x => x.id === facts.reservationId);
  if (!reservation) return hold('RESERVATION_FACTS_REQUIRED');
  if (!facts.result) return hold('RESULT_FACTS_REQUIRED');
  if (['pending', 'unknown'].includes(facts.result.status)) return allow({ plan: { kind: 'reconciliation', reservationId: reservation.id, status: facts.result.status, retainUpperBoundNanoUsd: reservation.upperBoundNanoUsd, retainResource: reservation.resource ?? null } });
  if (facts.result.status === 'not_submitted' || (facts.result.status === 'failed' && facts.result.definitiveNoEffect === true && facts.result.costReconciled === true)) return allow({ plan: { kind: 'reconciliation', reservationId: reservation.id, status: 'released', evidenceRef: facts.result.providerRequestId ?? facts.result.code ?? 'verified_not_submitted', releaseUpperBoundNanoUsd: reservation.upperBoundNanoUsd, releaseResource: reservation.resource ?? null } });
  return hold('RECONCILIATION_FACTS_REQUIRED');
}
