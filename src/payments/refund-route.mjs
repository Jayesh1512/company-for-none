// Provider route/fee FACTS for a future service refund (shop -> customer after an accepted settlement).
// A dry reverse quote prices "deliver back exactly what the customer paid" from the settlement asset held in
// the shop's confidential account. It is a signed provider ESTIMATE only: it does not prove funded custody
// can sign the confidential intent (custodyExecutionVerified stays false) and a fresh non-dry quote is needed
// at refund time. Missing facts block deposit instructions (no instructions before a remedy route exists).
import { atomic } from '../custody/adapter-runtime.mjs';

const finiteDate = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
export const SERVICE_REFUND_ROUTE_VERSION = 1;

export async function freezeServiceRefundRoute({ client, signatures, offer, sourceAsset, treasury, refundTo, paidAmount, slippageTolerance, expiresAt, now }) {
  if (offer.price.asset === sourceAsset.asset) return { ok: false, code: 'REFUND_ROUTE_UNPRICED', reason: 'same-asset refund is a direct withdrawal with no provider fee quote' };
  const request = { dry: true, swapType: 'EXACT_OUTPUT', slippageTolerance, originAsset: offer.price.asset, destinationAsset: sourceAsset.asset, amount: paidAmount,
    depositType: 'CONFIDENTIAL_INTENTS', recipient: refundTo, recipientType: 'DESTINATION_CHAIN', refundTo: treasury, refundType: 'CONFIDENTIAL_INTENTS', deadline: expiresAt };
  let received;
  try { received = await client.quoteWithEvidence(request); } catch { return { ok: false, code: 'REFUND_ROUTE_UNAVAILABLE' }; }
  const proof = await signatures.verifyQuote({ evidenceRef: received.evidenceRef });
  if (proof.status !== 'verified') return { ok: false, code: 'REFUND_ROUTE_UNAVAILABLE', proof };
  const q = received.body?.quote, echoed = received.body?.quoteRequest;
  for (const field of ['dry', 'swapType', 'originAsset', 'destinationAsset', 'amount', 'depositType', 'recipient', 'recipientType', 'refundTo', 'refundType', 'deadline']) {
    if (echoed?.[field] !== request[field]) return { ok: false, code: 'REFUND_ROUTE_UNAVAILABLE', reason: `echo:${field}` };
  }
  if (!q || !atomic(q.amountIn) || q.amountOut !== request.amount || (q.depositAddress ?? null) !== null) return { ok: false, code: 'REFUND_ROUTE_UNAVAILABLE', reason: 'quote-shape' };
  if (q.withdrawFee !== undefined && !atomic(q.withdrawFee)) return { ok: false, code: 'REFUND_ROUTE_UNAVAILABLE', reason: 'fee-shape' };
  const principal = BigInt(offer.price.amount), input = BigInt(q.amountIn);
  const fees = [{ kind: 'refund_withdraw', treatment: 'shop_pays', status: q.withdrawFee !== undefined ? 'estimated' : 'unknown',
    ...(q.withdrawFee !== undefined ? { money: { network: sourceAsset.network, asset: sourceAsset.asset, decimals: sourceAsset.decimals, amount: q.withdrawFee } } : {}) }];
  return { ok: true, route: { schemaVersion: SERVICE_REFUND_ROUTE_VERSION, kind: '1click_swap_confidential_to_origin', frozenAt: new Date(now).toISOString(),
    principal: { ...offer.price }, deliver: { ...sourceAsset, amount: paidAmount }, recipient: refundTo, recipientType: 'DESTINATION_CHAIN',
    fromAccount: treasury, depositType: 'CONFIDENTIAL_INTENTS', feeTreatment: 'shop_pays',
    estimatedInput: { ...offer.price, amount: q.amountIn }, inputMinusPrincipal: String(input - principal), fees,
    feesComplete: fees.every(f => f.status === 'estimated'), signedEstimateRef: proof.evidenceRef, signatureProof: proof,
    estimateValidUntil: finiteDate(q.deadline) ? q.deadline : null,
    status: 'provider_estimate_only', custodyExecutionVerified: false, executableProof: 'unavailable',
    executionRequires: 'fresh non-dry quote at refund time plus funded custody signing of the confidential intent' } };
}
