// Pure normalization of the 1Click /v0/status payload. Everything here except the nested
// signed quote is MUTABLE and UNAUTHENTICATED provider data (OpenAPI GetExecutionStatusResponse
// has no top-level signature). Nothing returned from this file is settlement proof.
const PENDING = new Set(['PENDING_DEPOSIT', 'KNOWN_DEPOSIT_TX', 'PROCESSING']);
const big = v => { try { return typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v) ? BigInt(v) : null; } catch { return null; } };
const hashes = list => Array.isArray(list) ? list.map(t => (typeof t === 'string' ? t : t?.hash)).filter(t => typeof t === 'string' && t) : [];

export function normalizeProviderStatus(raw, quote) {
  const swap = raw?.swapDetails ?? {};
  const known = ['SUCCESS', 'REFUNDED', 'FAILED', 'INCOMPLETE_DEPOSIT', ...PENDING].includes(raw?.status);
  const deposited = big(swap.depositedAmount), required = big(quote.requiredInput?.amount), minimum = big(quote.signedQuote?.minAmountIn);
  const refunded = big(swap.refundedAmount);
  const excess = deposited !== null && required !== null && deposited > required ? String(deposited - required) : null;
  const short = deposited !== null && minimum !== null && deposited < minimum ? String(minimum - deposited) : null;
  // Provider-side refund returns principal to the SIGNED quote.refundTo. It is not the service refund.
  let providerRefund = { state: 'none', class: null };
  if (raw?.status === 'INCOMPLETE_DEPOSIT') providerRefund = { state: 'expected_by_quote_deadline', class: 'partial_deposit' };
  else if (raw?.status === 'REFUNDED') providerRefund = { state: refunded ? 'reported' : 'reported_amount_missing', class: 'swap_not_completed' };
  else if (raw?.status === 'FAILED') providerRefund = { state: refunded ? 'reported' : 'unknown', class: 'swap_failed' };
  else if (raw?.status === 'SUCCESS' && refunded) providerRefund = { state: 'reported', class: excess ? 'excess_deposit' : 'unexplained_partial_refund' };
  if (providerRefund.state !== 'none') providerRefund = { ...providerRefund, reportedAmount: swap.refundedAmount ?? null, reason: swap.refundReason ?? null,
    destination: { address: quote.refundTo, type: quote.refundType ?? null, source: 'signed-quote' }, signedRefundFee: quote.signedQuote?.refundFee ?? null,
    authenticated: false, independentlyVerified: false };
  return {
    schemaVersion: 1, authenticated: false, knownStatus: known,
    providerStatus: known ? raw.status : 'UNKNOWN', classification: raw?.status === 'SUCCESS' ? 'success' : raw?.status === 'REFUNDED' || raw?.status === 'FAILED' ? 'failed'
      : raw?.status === 'INCOMPLETE_DEPOSIT' || PENDING.has(raw?.status) ? 'pending' : 'unknown',
    correlationId: typeof raw?.correlationId === 'string' ? raw.correlationId : null,
    // Mutable provider timestamp. NEVER payment, deposit or settlement time.
    statusUpdatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
    amounts: { depositedAmount: swap.depositedAmount ?? null, amountIn: swap.amountIn ?? null, amountOut: swap.amountOut ?? null, refundedAmount: swap.refundedAmount ?? null,
      withdrawFee: swap.withdrawFee ?? null, excessDeposit: excess, shortfallToMinimum: short },
    hashes: { intent: hashes(swap.intentHashes), near: hashes(swap.nearTxHashes), origin: hashes(swap.originChainTxHashes), destination: hashes(swap.destinationChainTxHashes) },
    providerRefund,
  };
}
export const providerReferences = (quote, facts) => [...new Set([facts.correlationId, quote.providerReference, quote.depositAddress,
  ...facts.hashes.intent, ...facts.hashes.near, ...facts.hashes.origin, ...facts.hashes.destination].filter(Boolean))];
