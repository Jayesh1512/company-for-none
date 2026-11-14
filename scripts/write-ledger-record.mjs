// Write company ledger records to the deployed mainnet contract.
//
// set_writer(owner) then append a valid hash-chained batch built by the project's
// own M01 projection (src/rules/onchain-ledger.mjs), then read it back.
//
// Usage: node scripts/write-ledger-record.mjs
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {Account, KeyPairSigner, JsonRpcProvider, actions} from 'near-api-js';
import {ledgerCompanyHash, LEDGER_ZERO_HASH, projectChainRecords} from '../src/rules/onchain-ledger.mjs';

const RPC = 'https://free.rpc.fastnear.com';
const GAS = '50000000000000';

const walletDir = '.runtime/company-ledger-wallet/mainnet';
const publicMeta = JSON.parse(await readFile(`${walletDir}/public.json`, 'utf8'));
const credential = JSON.parse(await readFile(`${walletDir}/credential.json`, 'utf8'));
const accountId = credential.account_id;
const companyId = publicMeta.companyId;

const rpc = async (method, params) => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? 'RPC_ERROR');
  return payload.result;
};
const viewCall = async (method_name, args) => {
  const result = await rpc('query', {request_type: 'call_function', finality: 'final', account_id: accountId, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')});
  return JSON.parse(Buffer.from(result.result).toString('utf8'));
};

const provider = new JsonRpcProvider({url: RPC});
const signer = KeyPairSigner.fromSecretKey(credential.private_key);
const account = new Account(accountId, provider, signer);

const companyHash = ledgerCompanyHash(companyId);
const now = new Date().toISOString();
const events = [
  {sequence: 1, type: 'company.configured', at: now, data: {companyId, actorId: 'owner'}},
  {sequence: 2, type: 'work.completed', at: now, data: {companyId, actorId: 'owner'}},
];
const projection = projectChainRecords(events, companyId);

const before = await viewCall('get_head', {});
const summary = {accountId, companyHash, records: projection.records.length, headBefore: before};

if (before.writerId !== accountId) {
  const w = await account.signAndSendTransaction({receiverId: accountId, actions: [actions.functionCall('set_writer', {writer_id: accountId}, GAS, 0n)], waitUntil: 'FINAL'});
  summary.setWriterTx = w.transaction?.hash ?? null;
}

const appendResult = await account.signAndSendTransaction({
  receiverId: accountId,
  actions: [actions.functionCall('append', {company_hash: companyHash, expected_sequence: 0, expected_hash: LEDGER_ZERO_HASH, records: projection.records}, GAS, 0n)],
  waitUntil: 'FINAL',
});
summary.appendTx = appendResult.transaction?.hash ?? null;
summary.appendStatus = JSON.stringify(appendResult.status);
summary.headAfter = await viewCall('get_head', {});
summary.recordsReadBack = await viewCall('get_records', {from_sequence: 1, limit: 10});

await mkdir('artifacts/onchain-ledger', {recursive: true});
await writeFile('artifacts/onchain-ledger/mainnet-ledger-write.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
