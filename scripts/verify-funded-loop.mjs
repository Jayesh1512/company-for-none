// Verify the customer-funded loop against public NEAR mainnet. Read-only; signs and spends nothing.
//   customer deposit tx -> sale.confirmed (ledger) -> paid answer -> inference.consumed (ledger)
// Labels: LIVE_PUBLIC = read/recomputed from mainnet RPC; LOCAL_ARTIFACT = recorded assertion, not independently proven.
// Usage: node scripts/verify-funded-loop.mjs [artifacts/mainnet-proof/funded-loop.json]
import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {hash} from '../src/rules/config.mjs';
import {ledgerCompanyHash} from '../src/rules/onchain-ledger.mjs';

try { loadEnvFile('.env'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const file = process.argv[2] ?? 'artifacts/mainnet-proof/funded-loop.json', RPC = process.env.NEAR_RPC_URL ?? 'https://free.rpc.fastnear.com';
const rpc = async (method, params) => { const p = await (await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}), signal: AbortSignal.timeout(20000)})).json(); if (p.error) throw new Error(p.error.data ?? p.error.message); return p.result; };
const results = []; const check = (scope, name, ok, detail = '') => { results.push({scope, ok}); console.log(`${ok ? 'PASS' : 'FAIL'}  [${scope}] ${name}${detail ? ` — ${detail}` : ''}`); return ok; };
const finalOk = tx => tx.final_execution_status === 'FINAL' && Object.hasOwn(tx.status ?? {}, 'SuccessValue') && !(tx.receipts_outcome ?? []).some(r => Object.hasOwn(r.outcome?.status ?? {}, 'Failure'));

const r = JSON.parse(await readFile(file, 'utf8')), {sale, settled} = r, companyId = 'local-workspace', companyHash = ledgerCompanyHash(companyId);
const contract = process.env.SHOP_LEDGER_CONTRACT_ID, signer = process.env.SHOP_LEDGER_SIGNER_ID ?? process.env.NEAR_AGENT_ACCOUNT_ID;
console.log(`Funded loop: ${sale.id}\nFunding: ${settled.funding}\n`);

// Money arithmetic (LOCAL_ARTIFACT: values are recorded, USDC->nanoUSD is exact: 1 atomic = 1000 nanoUSD).
const rev = BigInt(settled.revenueNanoUsd), cost = BigInt(settled.inferenceCostNanoUsd), sur = BigInt(settled.surplusNanoUsd);
check('LOCAL_ARTIFACT', 'revenue equals the sale price', rev === BigInt(sale.priceAtomic) * 1000n, `${sale.priceAtomic} USDC atomic = ${rev} nanoUSD`);
check('LOCAL_ARTIFACT', 'revenue - inference cost = surplus, cost > 0', cost > 0n && rev - cost === sur, `${rev} - ${cost} = ${sur} nanoUSD`);
check('LOCAL_ARTIFACT', 'answer came from a signature-verified E2EE call', settled.responseSignatureVerified === true && Boolean(settled.inferenceId), `${settled.model} · inference ${settled.inferenceId}`);

// Settlement leg: the 1Click deposit account (which received the customer's wNEAR) forwarding it to intents.near.
// NOTE: the customer's own transfer to the deposit address is not in the recorded artifact, so it is not checked here.
try {
  const tx = await rpc('tx', {tx_hash: sale.depositTxs[0], sender_account_id: sale.depositAddress, wait_until: 'FINAL'});
  const d = tx.transaction?.actions?.find(x => x.Delegate)?.Delegate?.delegate_action, f = d?.actions?.[0]?.FunctionCall, args = f ? JSON.parse(Buffer.from(f.args, 'base64').toString('utf8')) : null;
  check('LIVE_PUBLIC', 'settlement tx is FINAL and succeeded', finalOk(tx), `${sale.depositTxs[0].slice(0, 12)}…`);
  check('LIVE_PUBLIC', 'deposit account forwarded the full deposited wNEAR to intents.near', d?.sender_id === sale.depositAddress && f?.method_name === 'ft_transfer_call' && args?.receiver_id === 'intents.near' && args?.amount === sale.depositedAmount, `${args?.amount} yocto-wNEAR`);
} catch (e) { check('LIVE_PUBLIC', 'settlement tx lookup', false, String(e.message).slice(0, 80)); }

// Both ledger appends: FINAL, successful, append() on the ledger signed by the agent, containing the expected record type.
async function ledgerTx(label, txHash, type, expectData) {
  try {
    const tx = await rpc('tx', {tx_hash: txHash, sender_account_id: signer, wait_until: 'FINAL'}), call = tx.transaction?.actions?.[0]?.FunctionCall;
    const args = call ? JSON.parse(Buffer.from(call.args, 'base64').toString('utf8')) : null;
    check('LIVE_PUBLIC', `${label}: ledger tx FINAL, append() on the ledger, signed by the agent`, finalOk(tx) && call?.method_name === 'append' && tx.transaction.receiver_id === contract && tx.transaction.signer_id === signer, `${txHash.slice(0, 12)}…`);
    const rec = args?.records?.find(x => x.type === type);
    check('LIVE_PUBLIC', `${label}: record type ${type} is in that transaction`, Boolean(rec) && args.company_hash === companyHash);
    if (expectData && rec) check('LIVE_PUBLIC', `${label}: payload hash recomputes from the receipt data`, rec.payloadHash === hash({domain: 'company-ledger:payload:v1', companyHash, data: expectData}));
    console.log(`      explorer: https://nearblocks.io/txns/${txHash}`);
  } catch (e) { check('LIVE_PUBLIC', `${label}: ledger tx lookup`, false, String(e.message).slice(0, 80)); }
}
await ledgerTx('sale', sale.saleLedgerTx, 'sale.confirmed');
await ledgerTx('inference', settled.ledgerTx, 'inference.consumed', {companyId, actorId: 'agent', saleId: sale.id, saleLedgerTx: sale.saleLedgerTx, runId: settled.runId, inferenceId: settled.inferenceId,
  revenueNanoUsd: settled.revenueNanoUsd, costNanoUsd: settled.inferenceCostNanoUsd, surplusNanoUsd: settled.surplusNanoUsd, funding: settled.funding});

const failed = results.filter(x => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}`);
console.log(`Not proven here: (0) the customer's own wNEAR transfer into the deposit address is not in the artifact; (1) sale assurance — ${sale.assurance}; (2) no USDC moved to NEAR AI: the inference was billed to the owner-prepaid Cloud key and the sale is attributed to it; (3) the billed cost is the provider's report, not on-chain.`);
process.exitCode = failed ? 1 : 0;
