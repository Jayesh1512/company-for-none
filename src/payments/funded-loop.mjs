// Customer-funded loop: ONE confirmed customer sale pays for ONE inference run.
//   sale (revenue in, USDC)  ->  claim by a run  ->  actual inference cost  ->  surplus
// Both sides land on the mainnet ledger: `sale.confirmed` (committed when the sale
// settled) and `inference.consumed` (committed here, referencing the sale).
//
// Honest accounting label, carried into every record: the NEAR AI Cloud call is billed
// to the owner's prepaid key (no documented cash->Cloud-credit route exists, see
// src/cloud-funding/index.mjs). The sale's USDC is ATTRIBUTED to that cost; no USDC
// moved to the provider. State is a small JSON file, not the journal (ponytail: swap
// for a journal namespace if multiple writers are ever needed).
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const fail = (code, status = 409) => { throw Object.assign(new Error(code), {code, httpStatus: status}); };
export const FUNDING_LABEL = 'owner-prepaid-cloud-key; sale USDC attributed to cost (accounting only)';
const USDC_ATOMIC_TO_NANO_USD = 1000n; // 6-decimal USDC atomic -> 9-decimal nanoUSD
const big = v => typeof v === 'string' && /^[0-9]{1,30}$/.test(v) ? BigInt(v) : fail('AMOUNT_INVALID', 400);

/** Turn a settled live-checkout artifact into a sale. Fails closed unless provider SUCCESS + final deposit + ledger commit. */
export function saleFromSettlement(s) {
  if (s?.providerStatus !== 'SUCCESS' || s.depositTxFinal !== true || !s.ledger?.txHash || !s.offer?.price?.amount || s.offer.price.decimals !== 6) fail('SALE_NOT_CONFIRMED', 400);
  const id = 'sale:' + createHash('sha256').update(`${s.depositAddress}:${s.nearTxs?.[0]?.hash}`).digest('hex').slice(0, 24);
  return {id, priceAtomic: s.offer.price.amount, asset: s.offer.price.asset, revenueNanoUsd: (big(s.offer.price.amount) * USDC_ATOMIC_TO_NANO_USD).toString(),
    customer: s.customer, depositAddress: s.depositAddress, depositedAmount: s.depositedAmount ?? null, depositTxs: (s.nearTxs ?? []).map(t => t.hash), saleLedgerTx: s.ledger.txHash, assurance: s.assurance ?? null, settledAt: s.at};
}

export function createFundedLoop({file, committer = null, companyId = 'local-workspace', clock = () => new Date()} = {}) {
  if (!file) fail('FUNDED_LOOP_FILE_REQUIRED', 500);
  let queue = Promise.resolve();
  const serial = fn => { const r = queue.then(fn); queue = r.catch(() => {}); return r; };
  const load = async () => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {sales: {}}; throw e; } };
  const save = async state => { await mkdir(path.dirname(file), {recursive: true}); await writeFile(file + '.tmp', JSON.stringify(state, null, 2) + '\n', {mode: 0o600}); await rename(file + '.tmp', file); };

  /** Register a confirmed sale (idempotent). */
  const register = settlement => serial(async () => {
    const sale = saleFromSettlement(settlement), state = await load();
    state.sales[sale.id] ??= {sale, claim: null, settled: null}; await save(state); return state.sales[sale.id];
  });
  /** Reserve the sale for one run. Same run key replays; a different run is refused. */
  const claim = (saleId, runKey) => serial(async () => {
    const state = await load(), entry = state.sales[saleId];
    if (!entry) fail('SALE_UNKNOWN', 402);
    if (entry.claim && entry.claim.runKey !== runKey) fail('SALE_ALREADY_USED', 402);
    entry.claim ??= {runKey, at: clock().toISOString()}; await save(state); return entry;
  });
  /** Record the actual cost against the sale and commit `inference.consumed`. Idempotent. */
  const settle = ({saleId, runKey, run}) => serial(async () => {
    const state = await load(), entry = state.sales[saleId];
    if (!entry || entry.claim?.runKey !== runKey) fail('SALE_UNKNOWN', 402);
    if (entry.settled?.ledgerTx) return entry;
    // No completion was sent: the customer got nothing, so the sale stays spendable.
    if (run?.status === 'not_submitted' || run?.cost?.status === 'not_incurred') { entry.claim = null; entry.settled = null; await save(state); return entry; }
    const cost = run?.cost?.status === 'confirmed' ? big(run.cost.actualCostNanoUsd) : null;
    const rev = BigInt(entry.sale.revenueNanoUsd);
    if (cost === null) { entry.settled = {status: 'cost_pending', runId: run?.id ?? null}; await save(state); return entry; }
    if (cost > rev) fail('COST_EXCEEDS_REVENUE', 409);
    const settled = {status: 'settled', runId: run.id, providerRequestId: run.providerRequestId ?? null, inferenceId: run.inferenceId ?? null,
      revenueNanoUsd: rev.toString(), inferenceCostNanoUsd: cost.toString(), surplusNanoUsd: (rev - cost).toString(), funding: FUNDING_LABEL, at: clock().toISOString()};
    if (committer) {
      const ledger = await committer.append([{type: 'inference.consumed', data: {companyId, actorId: 'agent', saleId, saleLedgerTx: entry.sale.saleLedgerTx,
        runId: run.id, inferenceId: settled.inferenceId, revenueNanoUsd: settled.revenueNanoUsd, costNanoUsd: settled.inferenceCostNanoUsd, surplusNanoUsd: settled.surplusNanoUsd, funding: FUNDING_LABEL}}]);
      settled.ledgerTx = ledger.txHash; settled.ledgerCorrelationId = ledger.correlationId ?? null;
    }
    entry.settled = settled; await save(state); return entry;
  });
  const view = async () => (await load());
  return Object.freeze({register, claim, settle, view});
}
