// Finalize the live checkout: corroborate the provider settlement independently and
// commit the sale to the on-chain ledger with an explicit assurance label.
//
// The payment module returns `unknown` (SETTLEMENT_PROOF_UNAVAILABLE) because it has
// no independent settlement-evidence port wired. We do not pretend otherwise: this
// records what IS proven — 1Click status SUCCESS + the deposit tx FINAL on chain —
// and labels the assurance as provider-status + final on-chain deposit, NOT an
// independently verified onchain-final money-movement proof.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {createAgentApi} from '@near-intents-agent-api/sdk';
import {createLedgerCommitter} from '../src/onchain/ledger-commit.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const RPC = 'https://free.rpc.fastnear.com';
const companyId = 'local-workspace';
const jwt = process.env.NEAR_1CLICK_API_KEY;
const saved = JSON.parse(await readFile('.runtime/live-checkout/checkout.json', 'utf8'));
const addr = saved.quote.depositAddress;

const status = await (await fetch('https://1click.chaindefuser.com/v0/status?depositAddress=' + addr, {headers: {Authorization: 'Bearer ' + jwt}})).json();
if (status.status !== 'SUCCESS') { console.log(JSON.stringify({status: status.status, note: 'not settled yet'})); process.exit(0); }
const sd = status.swapDetails || {};
const txById = async h => {
  const r = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tx', params: {tx_hash: h, sender_account_id: 'intents.near', wait_until: 'FINAL'}})});
  const j = await r.json();
  return j.result ? {hash: h, finality: j.result.final_execution_status, receiver: j.result.transaction?.receiver_id} : {hash: h, error: j.error?.cause?.name ?? 'ERR'};
};
const nearTxs = [];
for (const h of sd.nearTxHashes || []) nearTxs.push(await txById(h));
const depositFinal = nearTxs.some(t => t.receiver === addr && t.finality === 'FINAL');

const record = {
  kind: 'live-checkout-settlement',
  at: new Date().toISOString(),
  assurance: 'provider-status-success + final on-chain deposit tx; independent onchain-final money-movement port NOT wired (adapter records unknown/SETTLEMENT_PROOF_UNAVAILABLE)',
  providerStatus: status.status,
  depositedAmount: sd.depositedAmount, depositedUsd: sd.depositedAmountUsd,
  offer: {price: saved.offer.price, treasury: saved.offer.treasuryAccount},
  customer: '755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b',
  depositAddress: addr,
  nearTxs, depositTxFinal: depositFinal,
  destinationTxs: sd.nearTxHashes ? undefined : null,
};
if (depositFinal) {
  const api = createAgentApi({apiKey: process.env.NEAR_INTENTS_AGENT_API_KEY, baseUrl: process.env.NEAR_INTENTS_AGENT_API_URL});
  const committer = createLedgerCommitter({api, agentId: process.env.NEAR_AGENT_ID, grantToken: process.env.NEAR_AGENT_GRANT_TOKEN, contractId: process.env.SHOP_LEDGER_CONTRACT_ID, companyId});
  try {
    record.ledger = await committer.append([{type: 'sale.confirmed', data: {
      companyId, actorId: 'customer', offerId: saved.offer.id,
      amount: saved.offer.price.amount, asset: saved.offer.price.asset,
      depositTx: nearTxs.find(t => t.receiver === addr && t.finality === 'FINAL')?.hash ?? null,
      assurance: 'provider-success+final-deposit-tx',
    }}]);
  } catch (e) { record.ledger = {error: e.code ?? e.message}; }
}
await mkdir('artifacts/mainnet-proof', {recursive: true});
await writeFile('artifacts/mainnet-proof/live-checkout-settlement.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record, null, 1));
