// Verify a funded commerce loop receipt against public NEAR mainnet.
//
//   decision -> spend (Agent API) -> on-chain ledger record -> this check
//
// Read-only: public RPC views/tx lookups only. Signs nothing, spends nothing.
// Each line is labelled by what actually establishes it:
//   LIVE_PUBLIC    recomputed from, or read from, public mainnet RPC
//   LOCAL_ARTIFACT a recorded assertion in the receipt, not independently proven
//   LIVE_AUTHED    re-read from the Agent API (only when NEAR_INTENTS_AGENT_API_KEY is set)
//
// The swap itself is confidential, so it has no public tx. What binds the payment to
// the chain is the ledger commitment: the receipt carries the exact event data, this
// script recomputes its payload hash with the product's own function and finds that
// hash in the contract's hash-chained records.
//
// Usage: node scripts/verify-loop-receipt.mjs [artifacts/mainnet-proof/loop-receipt.json]
import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {hash} from '../src/rules/config.mjs';
import {ledgerCompanyHash, ledgerRecordHash, LEDGER_ZERO_HASH} from '../src/rules/onchain-ledger.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const file = process.argv[2] ?? 'artifacts/mainnet-proof/loop-receipt.json';
const RPC = process.env.NEAR_RPC_URL ?? 'https://free.rpc.fastnear.com';

const rpc = async (method, params) => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}), signal: AbortSignal.timeout(20000)});
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.data ?? payload.error.message ?? 'RPC_ERROR');
  return payload.result;
};
const view = async (contract, method_name, args = {}) => {
  const r = await rpc('query', {request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')});
  return JSON.parse(Buffer.from(r.result).toString('utf8'));
};

const results = [];
const check = (scope, name, ok, detail = '') => {
  results.push({scope, ok});
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${scope}] ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

let receipt;
try { receipt = JSON.parse(await readFile(file, 'utf8')); } catch (error) {
  console.error(`Cannot read receipt ${file}: ${error.message}`);
  process.exit(2);
}
console.log(`Receipt: ${file}\nLabel:   ${receipt.label}\nCompany: ${receipt.companyId}\nContract: ${receipt.ledger?.contractId}\n`);

const {spend, ledger, reasoning} = receipt;
const contract = ledger?.contractId;
const companyHash = contract ? ledgerCompanyHash(receipt.companyId) : null;

// --- Decision -------------------------------------------------------------
check('LOCAL_ARTIFACT', `decision source: ${reasoning?.mode ?? 'missing'}`, ['cloud', 'controlled'].includes(reasoning?.mode),
  reasoning?.mode === 'cloud' ? `${reasoning.model} · provider request ${reasoning.providerRequestId}` : 'decision tokens were supplied, not model-generated');
check('LOCAL_ARTIFACT', 'decision matches executed spend', Boolean(spend && reasoning?.command?.asset === spend.asset && reasoning?.command?.amount === spend.amount),
  `${reasoning?.command?.amount} of ${reasoning?.command?.asset?.slice(0, 24)}`);

// --- Payment --------------------------------------------------------------
check('LOCAL_ARTIFACT', 'spend recorded as completed by the loop', spend?.state === 'completed' && spend?.providerStatus === 'SUCCESS',
  `state ${spend?.state}, provider ${spend?.providerStatus}, correlation ${spend?.correlationId}`);
if (process.env.NEAR_INTENTS_AGENT_API_KEY && process.env.NEAR_INTENTS_AGENT_API_URL && spend?.correlationId) {
  try {
    const {createAgentApi} = await import('@near-intents-agent-api/sdk');
    const status = await createAgentApi({apiKey: process.env.NEAR_INTENTS_AGENT_API_KEY, baseUrl: process.env.NEAR_INTENTS_AGENT_API_URL}).getStatus(spend.correlationId, {waitMs: 0});
    check('LIVE_AUTHED', 'Agent API still reports the spend SUCCESS', status.status === 'SUCCESS', `${status.status}`);
  } catch (error) { check('LIVE_AUTHED', 'Agent API status re-read', false, String(error.message).slice(0, 80)); }
} else {
  console.log('SKIP  [LIVE_AUTHED] Agent API status re-read (set NEAR_INTENTS_AGENT_API_KEY to enable)');
}

// --- Ledger ---------------------------------------------------------------
let records = [];
try {
  const account = await rpc('query', {request_type: 'view_account', finality: 'final', account_id: contract});
  check('LIVE_PUBLIC', 'ledger contract is deployed on mainnet', Boolean(account.code_hash) && account.code_hash !== '11111111111111111111111111111111', `code_hash ${account.code_hash.slice(0, 12)}`);
  const head = await view(contract, 'get_head');
  check('LIVE_PUBLIC', 'ledger belongs to this company', head.companyHash === companyHash, head.companyHash.slice(0, 16));
  if (ledger.signerId) check('LIVE_PUBLIC', 'ledger writer is the agent account', head.writerId === ledger.signerId, head.writerId);
  for (let from = 1; from <= head.sequence; from += 50) records.push(...await view(contract, 'get_records', {from_sequence: from, limit: 50}));
  check('LIVE_PUBLIC', 'every record hash recomputes and the chain links', records.length === head.sequence && records.every((r, i) =>
    r.sequence === i + 1 && r.previousHash === (i === 0 ? LEDGER_ZERO_HASH : records[i - 1].hash) && ledgerRecordHash(companyHash, r) === r.hash), `${records.length} records, head ${head.hash.slice(0, 12)}`);
} catch (error) {
  check('LIVE_PUBLIC', 'ledger reads', false, String(error.message ?? error).slice(0, 100));
}

// Each committed event must appear on chain with the payload hash recomputed from the
// exact data in the receipt: this is what ties the spend, its request and its
// delegation lineage to the chain.
const payloadHash = data => hash({domain: 'company-ledger:payload:v1', companyHash, data: data ?? null});
const used = new Set();
for (const commit of ledger?.commits ?? []) {
  const expected = payloadHash(commit.data);
  const found = records.find(r => !used.has(r.sequence) && r.type === commit.type && r.payloadHash === expected);
  if (found) used.add(found.sequence);
  const label = commit.type === 'agent.delegated' ? `agent.delegated (${commit.data?.topic?.slice(0, 40)})` : commit.type;
  check('LIVE_PUBLIC', `on-chain record for ${label}`, Boolean(found), found ? `sequence ${found.sequence}, payload ${expected.slice(0, 12)}` : `payload ${expected.slice(0, 12)} not found`);
}
const spendCommit = (ledger?.commits ?? []).find(c => c.type === 'spend.completed');
check('LIVE_PUBLIC', 'spend.completed commitment binds this exact spend', Boolean(spendCommit && spendCommit.data?.spendId === spend?.id && spendCommit.data?.amount === spend?.amount && spendCommit.data?.asset === spend?.asset));

// The transaction that wrote the spend record: FINAL, successful, an append() on the ledger.
if (spendCommit?.txHash) {
  try {
    const tx = await rpc('tx', {tx_hash: spendCommit.txHash, sender_account_id: ledger.signerId, wait_until: 'FINAL'});
    const call = tx.transaction?.actions?.[0]?.FunctionCall;
    const ok = tx.final_execution_status === 'FINAL' && Object.hasOwn(tx.status ?? {}, 'SuccessValue') && !(tx.receipts_outcome ?? []).some(r => Object.hasOwn(r.outcome?.status ?? {}, 'Failure'));
    check('LIVE_PUBLIC', 'ledger tx is FINAL and succeeded', ok, `${spendCommit.txHash.slice(0, 12)}…`);
    check('LIVE_PUBLIC', 'ledger tx is append() on the ledger contract, signed by the agent', tx.transaction?.receiver_id === contract && call?.method_name === 'append' && tx.transaction?.signer_id === ledger.signerId, `${call?.method_name} from ${tx.transaction?.signer_id?.slice(0, 12)}…`);
    console.log(`      explorer: https://nearblocks.io/txns/${spendCommit.txHash}`);
  } catch (error) { check('LIVE_PUBLIC', 'ledger tx lookup', false, String(error.message ?? error).slice(0, 80)); }
} else {
  check('LIVE_PUBLIC', 'spend record has a transaction hash', false, 'receipt lacks ledger tx for spend.completed');
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}`);
for (const scope of ['LIVE_PUBLIC', 'LIVE_AUTHED', 'LOCAL_ARTIFACT']) {
  const s = results.filter(r => r.scope === scope);
  if (s.length) console.log(`${scope}: ${s.filter(r => r.ok).length}/${s.length}`);
}
console.log('The swap is confidential: LIVE_PUBLIC proves the payment was committed to the chain, not that funds moved. A ledger commitment proves the record existed, not that the business event is true.');
process.exitCode = failed ? 1 : 0;
