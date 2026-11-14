import {escapeHtml as e} from './domain.js';
const explorer = tx => `https://nearblocks.io/txns/${encodeURIComponent(tx)}`;
const asset = id => /17208628/.test(id) ? 'USDC' : /wrap\.near/.test(id) ? 'wNEAR' : id;
const units = (raw, id) => /17208628/.test(id) ? `${(Number(raw) / 1e6).toFixed(6)} USDC` : `${raw} ${asset(id)}`;
// Funded commerce loop: decision -> payment -> ledger record -> verify. Renders the
// receipt written by scripts/loop-spend-e2e.mjs; shows nothing until a real run exists.
export function renderLoopReceipt(state) {
  const r = state.loopReceipt;
  if (!r?.spend) return '';
  const cloud = r.reasoning?.mode === 'cloud';
  const spendCommit = (r.ledger?.commits ?? []).find(c => c.type === 'spend.completed');
  const row = (n, title, body, note = '') => `<li class="loop-step"><span class="loop-n">${n}</span><div><strong>${title}</strong><p>${body}</p>${note ? `<small>${note}</small>` : ''}</div></li>`;
  return `<section class="loop-receipt" aria-labelledby="loop-receipt-title"><div class="cfn-section-heading"><div><h2 id="loop-receipt-title">Funded commerce loop</h2><p>One agent decision, one real payment, one on-chain record — each step checkable below.</p></div><span class="environment-badge">${e(r.ledger?.network ?? 'mainnet')}</span></div><ol class="loop-steps">${
    row(1, 'Agent decides', cloud
      ? `NEAR AI Cloud (${e(r.reasoning.model)}) chose: ${e(units(r.reasoning.command.amount, r.reasoning.command.asset))} — “${e(r.reasoning.command.purpose)}”`
      : `Decision supplied by the test script (not model-generated): ${e(units(r.reasoning.command.amount, r.reasoning.command.asset))}.`,
      cloud ? `End-to-end encrypted call · ${e(r.reasoning.signatureKind)} response signature verified · request ${e(r.reasoning.providerRequestId)}` : 'Labelled CONTROLLED reasoning + live execution.')}${
    row(2, 'Loop pays', `The autonomy loop admitted the command under the owner-signed policy and executed it through the NEAR Intents Agent API: <strong>${e(r.spend.providerStatus)}</strong>, ${e(units(r.spend.amount, r.spend.asset))}.`,
      `Confidential swap — no public tx. Agent API operation <code>${e(r.spend.correlationId)}</code>.`)}${
    row(3, 'Ledger records it', spendCommit?.txHash ? `A spend.completed record was appended to the company ledger contract by the agent’s own account. <a href="${explorer(spendCommit.txHash)}" target="_blank" rel="noopener noreferrer">View transaction</a>` : 'No ledger transaction is recorded for this spend.',
      `Contract <code>${e(r.ledger?.contractId)}</code>. The record commits to the spend’s hash; raw data stays private.`)}${
    row(4, 'Anyone can verify', 'Recomputes every ledger hash from public RPC and finds this spend’s commitment on chain:', '<code>node scripts/verify-loop-receipt.mjs</code>')}</ol><p class="fine-print">Generated ${e(r.generatedAt)}. A ledger commitment proves a record existed, not that the underlying business event is true. The verifier labels each check LIVE_PUBLIC (read from mainnet), LIVE_AUTHED or LOCAL_ARTIFACT (a recorded assertion).</p></section>`;
}
