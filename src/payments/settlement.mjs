// Binds independently produced evidence (injected port, e.g. S5 signed receipt log) to the FROZEN quote.
// The port's own pass flag is never trusted: terms are re-compared here. There is deliberately no
// assurance whitelist or policy knob: technically `verified` means onchain-final + final + every binding.
// Anything weaker is exposed as facts (assurance, finality, bindings) for M01/Rules to decide.
import { providerReferences } from './status.mjs';

const SKEW_MS = 5 * 60_000;
const isoMs = v => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : NaN);
const text = v => (typeof v === 'string' && v ? v : null);

export function normalizeFindingTerms(finding) {
  const t = finding?.terms && typeof finding.terms === 'object' ? finding.terms : {};
  return { asset: text(t.destination_asset) ?? text(t.asset) ?? text(t.destinationAsset), amount: text(t.amount_out) ?? text(t.amountOut) ?? text(t.amount),
    confidential: typeof t.confidential === 'boolean' ? t.confidential : null };
}

export function bindSettlement({ quote, facts, finding, now }) {
  if (!finding || finding.status === 'unavailable' || !finding.status) return { state: 'unavailable', code: 'SETTLEMENT_PROOF_UNAVAILABLE', mismatches: [], checks: {} };
  if (finding.status !== 'verified') return { state: 'unavailable', code: 'SETTLEMENT_EVIDENCE_REJECTED', mismatches: [], checks: {} };
  const terms = normalizeFindingTerms(finding);
  const expected = providerReferences(quote, facts);
  const refs = new Set([...(Array.isArray(finding.references) ? finding.references : []), finding.terms?.reference, ...(Array.isArray(finding.terms?.references) ? finding.terms.references : [])].filter(Boolean));
  const settled = isoMs(finding.settledAt), issued = isoMs(quote.signedQuote?.timestamp ?? quote.issuedAt), deadline = isoMs(quote.expiresAt);
  const checks = {
    account: text(finding.account) === quote.recipient,
    asset: terms.asset === quote.destination.asset,
    amount: terms.amount === quote.destination.amount,
    confidential: quote.recipientType === 'CONFIDENTIAL_INTENTS' ? terms.confidential === true : terms.confidential !== true,
    reference: expected.some(r => refs.has(r)),
    settledAtPresent: Number.isFinite(settled),
    notBeforeQuote: Number.isFinite(settled) && Number.isFinite(issued) && settled >= issued,
    notFuture: Number.isFinite(settled) && settled <= now + SKEW_MS,
    finality: finding.finality === 'final',
    assuranceOnchain: finding.assurance === 'onchain-final',
  };
  // Window is a FACT (null when time unknown); lateness is never a mismatch, M01 chooses the remedy.
  const withinInvoiceWindow = Number.isFinite(settled) && Number.isFinite(deadline) ? settled <= deadline : null;
  const essential = ['account', 'asset', 'amount', 'confidential', 'reference', 'settledAtPresent', 'notBeforeQuote', 'notFuture'];
  const mismatches = essential.filter(k => !checks[k]);
  const bound = mismatches.length === 0;
  const state = !bound ? 'mismatch' : checks.finality && checks.assuranceOnchain ? 'verified' : 'bound_not_final';
  return { state, code: state === 'verified' ? null : state === 'mismatch' ? 'SETTLEMENT_MISMATCH' : 'SETTLEMENT_ASSURANCE_NOT_ONCHAIN_FINAL',
    checks, mismatches, withinInvoiceWindow, settledAt: Number.isFinite(settled) ? new Date(settled).toISOString() : null,
    money: { network: quote.destination.network, asset: terms.asset, decimals: quote.destination.decimals, amount: terms.amount },
    recipient: text(finding.account), assurance: text(finding.assurance), finality: text(finding.finality), kind: text(finding.kind),
    provenance: finding.provenance ?? null, evidenceRef: finding.evidenceRef ?? null, matchedReferences: expected.filter(r => refs.has(r)) };
}
