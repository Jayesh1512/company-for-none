// Item 1 + 4: dedicated ledger writer account with a scoped function-call key,
// then delete its full-access key (key hygiene), then prove the scope holds.
//
// Flow:
//   deploy(owner) funds writer implicit account  -> writer has full-access key A
//   writer adds function-call key B scoped to {ledger, append}
//   writer deletes full-access key A             -> writer keeps only scoped B
//   deploy(owner) set_writer(writer)
//   writer(key B) append() a new batch           -> allowed
//   writer(key B) tries a transfer               -> rejected (scope holds)
//
// Usage: node scripts/setup-scoped-writer.mjs
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Account, KeyPair, KeyPairSigner, JsonRpcProvider, actions, keyToImplicitAddress} from 'near-api-js';
import {ledgerCompanyHash, ledgerRecordHash} from '../src/rules/onchain-ledger.mjs';
import {hash} from '../src/rules/config.mjs';

const RPC = 'https://free.rpc.fastnear.com';
const GAS = '50000000000000';
const ALLOWANCE = 100000000000000000000000n; // 0.1 NEAR gas allowance on the scoped key
const FUND = 200000000000000000000000n; // 0.2 NEAR to the writer account (gas + record storage)

const walletDir = path.resolve('.runtime/company-ledger-wallet/mainnet');
const publicMeta = JSON.parse(await readFile(path.join(walletDir, 'public.json'), 'utf8'));
const deployCred = JSON.parse(await readFile(path.join(walletDir, 'credential.json'), 'utf8'));
const deployId = deployCred.account_id;
const companyId = publicMeta.companyId;
const companyHash = ledgerCompanyHash(companyId);

async function loadOrCreateKey(file) {
  try { return KeyPair.fromString(JSON.parse(await readFile(file, 'utf8')).private_key); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = KeyPair.fromRandom('ed25519');
    await writeFile(file, JSON.stringify({private_key: key.toString(), public_key: key.getPublicKey().toString()}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    return key;
  }
}

const keyA = await loadOrCreateKey(path.join(walletDir, 'writer-full.json'));
const keyB = await loadOrCreateKey(path.join(walletDir, 'writer-scoped.json'));
const writerId = keyToImplicitAddress(keyA.getPublicKey());

const rpc = async (method, params) => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const payload = await response.json();
  if (payload.error) throw Object.assign(new Error(payload.error.message ?? 'RPC_ERROR'), {rpcError: payload.error});
  return payload.result;
};
const viewCall = async (contract, method_name, args) => {
  const result = await rpc('query', {request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')});
  return JSON.parse(Buffer.from(result.result).toString('utf8'));
};
const accountExists = async id => { try { await rpc('query', {request_type: 'view_account', finality: 'final', account_id: id}); return true; } catch (e) { return !(e.rpcError?.cause?.name === 'UNKNOWN_ACCOUNT'); } };

const provider = new JsonRpcProvider({url: RPC});
const deploy = new Account(deployId, provider, KeyPairSigner.fromSecretKey(deployCred.private_key));

const summary = {writerId, scopedKey: keyB.getPublicKey().toString(), fullKey: keyA.getPublicKey().toString()};

// 1. Create the writer account (funded by the owner) if needed, then ensure it can pay for appends.
if (!(await accountExists(writerId))) {
  const fund = await deploy.signAndSendTransaction({receiverId: writerId, actions: [actions.transfer(FUND)], waitUntil: 'FINAL'});
  summary.fundWriterTx = fund.transaction?.hash ?? null;
}
const writerState = await rpc('query', {request_type: 'view_account', finality: 'final', account_id: writerId});
if (BigInt(writerState.amount) < FUND) {
  const topUp = await deploy.signAndSendTransaction({receiverId: writerId, actions: [actions.transfer(FUND - BigInt(writerState.amount))], waitUntil: 'FINAL'});
  summary.topUpWriterTx = topUp.transaction?.hash ?? null;
}

// 2. Writer (key A) adds scoped key B and deletes its own full-access key A.
const writerA = new Account(writerId, provider, KeyPairSigner.fromSecretKey(keyA.toString()));
const list = await rpc('query', {request_type: 'view_access_key_list', finality: 'final', account_id: writerId});
const hasA = (list.keys ?? []).some(k => k.public_key === keyA.getPublicKey().toString());
const hasB = (list.keys ?? []).some(k => k.public_key === keyB.getPublicKey().toString());

if (!hasB) {
  const addKey = await writerA.signAndSendTransaction({
    receiverId: writerId,
    actions: [actions.addFunctionCallAccessKey(keyB.getPublicKey(), deployId, ['append'], ALLOWANCE)],
    waitUntil: 'FINAL',
  });
  summary.addScopedKeyTx = addKey.transaction?.hash ?? null;
}
if (hasA) {
  const delKey = await writerA.signAndSendTransaction({receiverId: writerId, actions: [actions.deleteKey(keyA.getPublicKey())], waitUntil: 'FINAL'});
  summary.deleteFullKeyTx = delKey.transaction?.hash ?? null;
}

// 3. Owner binds the writer on the ledger contract.
const headBefore = await viewCall(deployId, 'get_head', {});
if (headBefore.writerId !== writerId) {
  const setWriter = await deploy.signAndSendTransaction({receiverId: deployId, actions: [actions.functionCall('set_writer', {writer_id: writerId}, GAS, 0n)], waitUntil: 'FINAL'});
  summary.setWriterTx = setWriter.transaction?.hash ?? null;
}

// 4. Writer (scoped key B only) appends a new batch -> allowed.
const head = await viewCall(deployId, 'get_head', {});
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
const writerB = new Account(writerId, provider, KeyPairSigner.fromSecretKey(keyB.toString()));
const append = await writerB.signAndSendTransaction({
  receiverId: deployId,
  actions: [actions.functionCall('append', {company_hash: companyHash, expected_sequence: head.sequence, expected_hash: head.hash, records}, GAS, 0n)],
  waitUntil: 'FINAL',
});
summary.appendTx = append.transaction?.hash ?? null;
summary.headAfter = await viewCall(deployId, 'get_head', {});

// 5. Scope check: the same scoped key must NOT be able to transfer NEAR.
try {
  await writerB.signAndSendTransaction({receiverId: deployId, actions: [actions.transfer(1n)], waitUntil: 'FINAL'});
  summary.scopeCheck = 'UNEXPECTED_SUCCESS';
} catch (error) {
  summary.scopeCheck = `REJECTED: ${String(error?.message ?? error).slice(0, 120)}`;
}

// 6. Final key listing: only the scoped key should remain on the writer.
const finalList = await rpc('query', {request_type: 'view_access_key_list', finality: 'final', account_id: writerId});
summary.writerKeys = (finalList.keys ?? []).map(k => ({publicKey: k.public_key, permission: k.access_key?.permission?.FunctionCall ? 'FunctionCall(' + k.access_key.permission.FunctionCall.method_names.join(',') + ')' : String(k.access_key?.permission)}));

await mkdir('artifacts/onchain-ledger', {recursive: true});
await writeFile('artifacts/onchain-ledger/mainnet-scoped-writer.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
