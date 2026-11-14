// Mainnet deployment of the company ledger contract.
//
// Explicit, owner-authorized deployment. Deploys the compiled WASM and calls the
// #[init] `new(company_hash, writer_id)` in a SINGLE atomic transaction from the
// contract's own implicit account, so no public init can race the deployment.
//
// Usage:
//   node scripts/deploy-ledger-mainnet.mjs --network mainnet --dry-run
//   node scripts/deploy-ledger-mainnet.mjs --network mainnet
//
// Reads the private credential from .runtime/company-ledger-wallet/<network>/.
// Never prints the private key. Writes evidence to artifacts/onchain-ledger/.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {Account, KeyPairSigner, JsonRpcProvider, actions} from 'near-api-js';
import {ledgerCompanyHash} from '../src/rules/onchain-ledger.mjs';

const RPC = {mainnet: 'https://free.rpc.fastnear.com', testnet: 'https://rpc.testnet.fastnear.com'};
const GAS = '300000000000000'; // 300 Tgas: deploy + init comfortably.

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true);
}

const networkId = arg('network') ?? 'mainnet';
if (!['mainnet', 'testnet'].includes(networkId)) throw new Error('Choose mainnet or testnet explicitly.');
const dryRun = Boolean(arg('dry-run'));
const knownTxHash = typeof arg('tx-hash') === 'string' ? arg('tx-hash') : null;
const walletDir = path.resolve('.runtime/company-ledger-wallet', networkId);
const publicMeta = JSON.parse(await readFile(path.join(walletDir, 'public.json'), 'utf8'));
const credential = JSON.parse(await readFile(path.join(walletDir, 'credential.json'), 'utf8'));
if (publicMeta.accountId !== credential.account_id || publicMeta.networkId !== networkId) throw new Error('Wallet metadata/credential mismatch.');

const wasmPath = 'artifacts/onchain-ledger/company-ledger.wasm';
const wasm = await readFile(wasmPath);
const wasmHash = createHash('sha256').update(wasm).digest('hex');
const manifest = JSON.parse(await readFile('artifacts/onchain-ledger/contract-manifest.json', 'utf8'));
if (manifest.wasmHash !== wasmHash) throw new Error(`WASM hash ${wasmHash} does not match manifest ${manifest.wasmHash}. Rebuild with npm run contract:build.`);

const accountId = credential.account_id;
const companyHash = ledgerCompanyHash(publicMeta.companyId);
const provider = new JsonRpcProvider({url: RPC[networkId]});
const signer = KeyPairSigner.fromSecretKey(credential.private_key);
const account = new Account(accountId, provider, signer);

const summary = {networkId, accountId, companyHash, wasmBytes: wasm.length, wasmHash, gas: GAS, dryRun};

let balance = null;
try {
  balance = await account.getBalance();
  summary.balanceYocto = balance.toString();
  summary.balanceNear = (Number(balance) / 1e24).toFixed(6);
} catch (error) {
  summary.balanceError = String(error?.message ?? error).slice(0, 200);
}

if (dryRun) {
  console.log(JSON.stringify({...summary, note: 'Dry run only. No transaction sent.'}, null, 2));
  process.exit(0);
}

async function rpcQuery(params) {
  const response = await fetch(RPC[networkId], {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'query', params}),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? 'RPC_QUERY_FAILED');
  return payload.result;
}

async function viewCall(method, args = {}) {
  const result = await rpcQuery({
    request_type: 'call_function', finality: 'final', account_id: accountId,
    method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
  });
  return {value: JSON.parse(Buffer.from(result.result).toString('utf8')), blockHeight: result.block_height, blockHash: result.block_hash};
}

const accountState = await rpcQuery({request_type: 'view_account', finality: 'final', account_id: accountId});
const alreadyDeployed = accountState.code_hash === manifest.codeHash;

let txHash = null;
let onchain = null;
let status = 'ALREADY_DEPLOYED_SKIPPED';
if (!alreadyDeployed) {
  if (balance === null || balance < 1_400_000_000_000_000_000_000_000n) {
    console.error(JSON.stringify({...summary, error: 'ACCOUNT_NOT_FUNDED', note: 'Fund the account with at least ~1.4 NEAR to cover contract storage + gas, then rerun.'}, null, 2));
    process.exit(2);
  }
  console.log(JSON.stringify({...summary, note: 'Sending atomic deploy + new() transaction...'}, null, 2));
  const result = await account.signAndSendTransaction({
    receiverId: accountId,
    actions: [
      actions.deployContract(wasm),
      actions.functionCall('new', {company_hash: companyHash, writer_id: null}, GAS, 0n),
    ],
    waitUntil: 'FINAL',
  });
  txHash = result.transaction?.hash ?? result.transaction_outcome?.id ?? null;
  status = JSON.stringify(result.status);
  onchain = result.final_execution_status ?? null;
} else {
  console.log(JSON.stringify({...summary, note: 'Contract code already matches manifest; skipping deploy.'}, null, 2));
}
txHash = txHash ?? knownTxHash;

const head = await viewCall('get_head');

const evidence = {
  schemaVersion: 1,
  kind: 'mainnet-ledger-deployment',
  networkId,
  accountId,
  companyHash,
  wasmBytes: wasm.length,
  wasmHash,
  expectedCodeHash: manifest.codeHash,
  transactionHash: txHash,
  finalExecutionStatus: onchain,
  status,
  head: head.value,
  headBlock: {height: head.blockHeight, hash: head.blockHash},
  explorer: txHash ? `https://nearblocks.io/txns/${txHash}` : null,
  recordedAt: new Date().toISOString(),
};
await mkdir('artifacts/onchain-ledger', {recursive: true});
await writeFile('artifacts/onchain-ledger/mainnet-deployment.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
