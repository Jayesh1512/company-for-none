// Item 2 completion: bind the Agent API agent account as the ledger writer,
// then have the agent append a batch via native/near/call (the expected route),
// and verify the on-chain head.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Account, KeyPairSigner, JsonRpcProvider, actions} from 'near-api-js';
import {createAgentApi, createIdempotencyKey} from '@near-intents-agent-api/sdk';
import {ledgerCompanyHash, ledgerRecordHash, LEDGER_ZERO_HASH} from '../src/rules/onchain-ledger.mjs';
import {hash} from '../src/rules/config.mjs';

const RPC = 'https://free.rpc.fastnear.com';
const GAS = '20000000000000';

const envText = await readFile(path.resolve('.env'), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(l => /^[A-Z0-9_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));

const ledger = env.SHOP_LEDGER_CONTRACT_ID;
const companyId = 'local-workspace';
const companyHash = ledgerCompanyHash(companyId);
const agentAccount = env.NEAR_AGENT_ACCOUNT_ID;
const agentId = env.NEAR_AGENT_ID;
const grantToken = env.NEAR_AGENT_GRANT_TOKEN;

const rpc = async (method, params) => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? 'RPC_ERROR');
  return payload.result;
};
const viewCall = async (method_name, args) => JSON.parse(Buffer.from((await rpc('query', {request_type: 'call_function', finality: 'final', account_id: ledger, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')})).result).toString('utf8'));

// 1. Owner binds the agent account as writer.
const walletDir = path.resolve('.runtime/company-ledger-wallet/mainnet');
const deployCred = JSON.parse(await readFile(path.join(walletDir, 'credential.json'), 'utf8'));
const provider = new JsonRpcProvider({url: RPC});
const owner = new Account(deployCred.account_id, provider, KeyPairSigner.fromSecretKey(deployCred.private_key));

const summary = {ledger, companyHash, agentAccount};
const headBefore = await viewCall('get_head', {});
summary.headBefore = headBefore;
if (headBefore.writerId !== agentAccount) {
  const bind = await owner.signAndSendTransaction({receiverId: ledger, actions: [actions.functionCall('set_writer', {writer_id: agentAccount}, GAS, 0n)], waitUntil: 'FINAL'});
  summary.setWriterTx = bind.transaction?.hash ?? null;
}

// 2. Build the next batch using M01's record projection.
const head = await viewCall('get_head', {});
const now = new Date().toISOString();
let previousHash = head.hash;
const records = ['work.completed', 'ledger.chain_confirmed'].map((type, i) => {
  const sequence = head.sequence + i + 1;
  const actorHash = hash({domain: 'company-ledger:actor:v1', companyHash, actor: 'owner'});
  const payloadHash = hash({domain: 'company-ledger:payload:v1', companyHash, data: {companyId, actorId: 'owner'}});
  const r = {sequence, type, at: now, actorHash, payloadHash, previousHash};
  r.hash = ledgerRecordHash(companyHash, r);
  previousHash = r.hash;
  return r;
});

// 3. The agent appends via the Agent API native call (the expected route).
const api = createAgentApi({apiKey: env.NEAR_INTENTS_AGENT_API_KEY, baseUrl: env.NEAR_INTENTS_AGENT_API_URL});
const gapi = api.forGrant(grantToken);
const call = await gapi.nativeNearCall(agentId, {
  receiver_id: ledger,
  method_name: 'append',
  args: {company_hash: companyHash, expected_sequence: head.sequence, expected_hash: head.hash, records},
  gas: GAS,
  deposit: '0',
}, {idempotencyKey: createIdempotencyKey()});
summary.nativeCall = {correlation_id: call.correlation_id, status: call.status};

let status = call;
for (let i = 0; i < 12; i += 1) {
  if (['SUCCESS', 'FAILED', 'REFUNDED', 'NEEDS_REVIEW'].includes(status.status)) break;
  status = await api.getStatus(call.correlation_id, {waitMs: 12000});
  summary.nativeCall.status = status.status;
}
summary.nativeCall.failure = status.failure_code ?? null;
summary.nativeCall.txHash = status.details?.tx_hash ?? null;

summary.headAfter = await viewCall('get_head', {});
summary.recordsReadBack = await viewCall('get_records', {from_sequence: head.sequence + 1, limit: 10});

await mkdir('artifacts/onchain-ledger', {recursive: true});
await writeFile('artifacts/onchain-ledger/mainnet-agent-api-append.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
