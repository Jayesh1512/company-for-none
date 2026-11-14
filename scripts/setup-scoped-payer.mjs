// Item 3: dedicated marketplace payer account with a scoped ft_transfer key.
//
// Creates a payer implicit account funded with NEAR, adds a function-call key
// scoped to {USDC contract, ft_transfer}, funds it with USDC, and (optionally)
// removes its full-access key so only the scoped key remains.
//
// Usage: node scripts/setup-scoped-payer.mjs [--delete-full-access]
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Account, KeyPair, KeyPairSigner, JsonRpcProvider, actions, keyToImplicitAddress} from 'near-api-js';

const RPC = 'https://free.rpc.fastnear.com';
const USDC = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const GAS = '50000000000000';
const ALLOWANCE = 100000000000000000000000n; // 0.1 NEAR
const FUND_NEAR = 100000000000000000000000n; // 0.1 NEAR
const FUND_USDC = 1000000n; // 1.0 USDC
const deleteFullAccess = process.argv.includes('--delete-full-access');

const walletDir = path.resolve('.runtime/company-ledger-wallet/mainnet');
const deployCred = JSON.parse(await readFile(path.join(walletDir, 'credential.json'), 'utf8'));
const deployId = deployCred.account_id;

async function loadOrCreateKey(file) {
  try { return KeyPair.fromString(JSON.parse(await readFile(file, 'utf8')).private_key); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = KeyPair.fromRandom('ed25519');
    await writeFile(file, JSON.stringify({private_key: key.toString(), public_key: key.getPublicKey().toString()}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    return key;
  }
}

const keyFull = await loadOrCreateKey(path.join(walletDir, 'payer-full.json'));
const keyScoped = await loadOrCreateKey(path.join(walletDir, 'payer-scoped.json'));
const payerId = keyToImplicitAddress(keyFull.getPublicKey());

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
const exists = async id => { try { await rpc('query', {request_type: 'view_account', finality: 'final', account_id: id}); return true; } catch (e) { return !(e.rpcError?.cause?.name === 'UNKNOWN_ACCOUNT'); } };

const provider = new JsonRpcProvider({url: RPC});
const deploy = new Account(deployId, provider, KeyPairSigner.fromSecretKey(deployCred.private_key));
const summary = {payerId, scopedKey: keyScoped.getPublicKey().toString()};

if (!(await exists(payerId))) {
  const fund = await deploy.signAndSendTransaction({receiverId: payerId, actions: [actions.transfer(FUND_NEAR)], waitUntil: 'FINAL'});
  summary.fundPayerTx = fund.transaction?.hash ?? null;
}

const payerFull = new Account(payerId, provider, KeyPairSigner.fromSecretKey(keyFull.toString()));
const list = await rpc('query', {request_type: 'view_access_key_list', finality: 'final', account_id: payerId});
const keys = list.keys ?? [];
const hasScoped = keys.some(k => k.public_key === keyScoped.getPublicKey().toString());
const hasFull = keys.some(k => k.public_key === keyFull.getPublicKey().toString());

if (!hasScoped) {
  const add = await payerFull.signAndSendTransaction({receiverId: payerId, actions: [actions.addFunctionCallAccessKey(keyScoped.getPublicKey(), USDC, ['ft_transfer'], ALLOWANCE)], waitUntil: 'FINAL'});
  summary.addScopedKeyTx = add.transaction?.hash ?? null;
}

// Fund the payer with USDC (register if needed, then transfer from the deploy account).
const payerStorage = await viewCall(USDC, 'storage_balance_of', {account_id: payerId}).catch(() => null);
if (!payerStorage || BigInt(payerStorage.total ?? '0') === 0n) {
  const reg = await deploy.signAndSendTransaction({receiverId: USDC, actions: [actions.functionCall('storage_deposit', {account_id: payerId, registration_only: true}, GAS, 1250000000000000000000n)], waitUntil: 'FINAL'});
  summary.usdcRegisterTx = reg.transaction?.hash ?? null;
}
const payerUsdc = await viewCall(USDC, 'ft_balance_of', {account_id: payerId});
if (BigInt(payerUsdc) < FUND_USDC) {
  const send = await deploy.signAndSendTransaction({receiverId: USDC, actions: [actions.functionCall('ft_transfer', {receiver_id: payerId, amount: FUND_USDC.toString()}, GAS, 1n)], waitUntil: 'FINAL'});
  summary.fundPayerUsdcTx = send.transaction?.hash ?? null;
}

if (deleteFullAccess && hasFull) {
  const del = await payerFull.signAndSendTransaction({receiverId: payerId, actions: [actions.deleteKey(keyFull.getPublicKey())], waitUntil: 'FINAL'});
  summary.deleteFullAccessTx = del.transaction?.hash ?? null;
}

const finalKeys = await rpc('query', {request_type: 'view_access_key_list', finality: 'final', account_id: payerId});
summary.payerKeys = (finalKeys.keys ?? []).map(k => ({publicKey: k.public_key, permission: k.access_key?.permission?.FunctionCall ? 'FunctionCall(' + k.access_key.permission.FunctionCall.method_names.join(',') + ')' : String(k.access_key?.permission)}));
summary.payerUsdc = (Number(await viewCall(USDC, 'ft_balance_of', {account_id: payerId})) / 1e6).toFixed(6);
console.log(JSON.stringify(summary, null, 2));
