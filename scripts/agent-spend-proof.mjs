// End-to-end self-running spend proof (option c):
//   1. prepare   create a deposit address to fund the agent's Intents balance
//   2. spend     agent performs a real policy-bounded swap, then an over-limit
//                swap the Agent API refuses, then commits the spend to the ledger
//
// The swap stays inside the agent's balance (no destination needed), so it works
// under the current `destinations: only, []` policy. Refusals are recorded as
// evidence that the provider enforces policy, not our code.
//
// Usage:
//   node scripts/agent-spend-proof.mjs prepare        # prints deposit address + amount
//   node scripts/agent-spend-proof.mjs spend          # swap + over-limit + ledger
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {createAgentApi, createIdempotencyKey} from '@near-intents-agent-api/sdk';
import {createAgentSpendPort, SPEND_ASSETS} from '../src/custody/agent-spend.mjs';
import {createLedgerCommitter} from '../src/onchain/ledger-commit.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const step = process.argv[2] ?? 'prepare';
const apiKey = process.env.NEAR_INTENTS_AGENT_API_KEY;
const baseUrl = process.env.NEAR_INTENTS_AGENT_API_URL;
const agentId = process.env.NEAR_AGENT_ID;
const grantToken = process.env.NEAR_AGENT_GRANT_TOKEN;
const contractId = process.env.SHOP_LEDGER_CONTRACT_ID;
if (!apiKey || !agentId || !grantToken) throw new Error('Agent API credentials missing in .env');

const api = createAgentApi({apiKey, baseUrl});
const stateFile = '.runtime/agent-spend-proof.json';

if (step === 'prepare') {
  const USDC = SPEND_ASSETS.USDC_NEAR;
  const deposit = await api.deposit(agentId, {origin_asset: USDC, amount: '500000', confidential: true}, {idempotencyKey: createIdempotencyKey()});
  const out = {correlationId: deposit.correlation_id, status: deposit.status, details: deposit.details};
  await mkdir('.runtime', {recursive: true});
  await writeFile(stateFile, JSON.stringify(out, null, 2) + '\n');
  const address = deposit.details?.deposit_address ?? deposit.details?.request?.deposit_address;
  console.log(JSON.stringify({depositAddress: address ?? '(awaiting in details)', status: deposit.status, raw: deposit.details ?? null}, null, 1));
  if (address) console.log(`\nSend 0.5 USDC (NEAR) to: ${address}\nThen run: node scripts/agent-spend-proof.mjs spend`);
  process.exit(0);
}

if (step === 'spend') {
  const USDC = SPEND_ASSETS.USDC_NEAR;
  const WRAP = SPEND_ASSETS.WRAP_NEAR;
  const balances = await api.forGrant(grantToken).getBalances(agentId, {source: "confidential"});
  const usdc = (balances.balances ?? []).find(b => b.asset_id === USDC);
  console.log('agent USDC balance:', usdc?.balance ?? '0');
  if (!usdc || Number(usdc.balance) <= 0) { console.error('Agent has no USDC; run prepare and fund first.'); process.exit(2); }

  const port = createAgentSpendPort({apiKey, baseUrl, agentId, grantToken});
  const evidence = {companyId: 'local-workspace', at: new Date().toISOString(), steps: {}};

  // 1. A real, policy-allowed swap within the per-tx limit (<= 2 USDC).
  // Spend what is actually available, so a partial balance still proves the path.
  const available = BigInt(usdc.available_raw ?? '0');
  if (available < 10000n) { console.error('Agent available USDC too small for a swap:', available.toString()); process.exit(2); }
  const swapAmount = available.toString();
  const allowed = await port.spend({kind: 'swap', asset: USDC, amount: swapAmount, destination: WRAP});
  evidence.steps.allowedSwap = allowed;
  console.log('allowed swap:', allowed.status, allowed.txHash ?? allowed.failureCode);

  // 2. An over-limit swap the Agent API should refuse (policy per-tx limit is 2 USDC).
  let refused;
  try {
    refused = await port.spend({kind: 'swap', asset: USDC, amount: '5000000', destination: WRAP});
  } catch (error) {
    refused = {status: 'REFUSED', code: error.code, message: error.message};
  }
  evidence.steps.overLimit = refused;
  console.log('over-limit attempt:', refused.status, refused.code ?? refused.failureCode ?? '');

  // 3. Commit the real spend to the on-chain ledger.
  if (allowed.status === 'SUCCESS' && contractId) {
    try {
      const committer = createLedgerCommitter({api, agentId, grantToken, contractId, companyId: 'local-workspace'});
      evidence.steps.ledger = await committer.append([{
        type: 'spend.completed',
        data: {companyId: 'local-workspace', actorId: 'agent', asset: USDC, amount: allowed.request?.amount, txHash: allowed.txHash, purpose: 'self-directed provider purchase'},
      }]);
      console.log('ledger attx:', evidence.steps.ledger.txHash);
    } catch (error) {
      evidence.steps.ledger = {error: error.code ?? error.message};
    }
  }

  await mkdir('artifacts/mainnet-proof', {recursive: true});
  await writeFile('artifacts/mainnet-proof/agent-spend-proof.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 1));
}
