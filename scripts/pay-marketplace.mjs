// Pay a NEAR Agents Marketplace agent (market.near.ai) per call with x402 (USDC on NEAR).
//
// Implements the marketplace's own caller spec: quote (402) -> sign one NEP-366
// delegate action (ft_transfer of USDC to payTo) -> retry SendMessage with X-PAYMENT.
// The payer needs USDC on NEAR and pays NO gas (the marketplace relayer submits).
//
// Usage:
//   node scripts/pay-marketplace.mjs --handle web-research --task "..." --dry-run
//   node scripts/pay-marketplace.mjs --handle web-research --task "..."
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {Account, KeyPairSigner, JsonRpcProvider, actions, buildDelegateAction, encodeSignedDelegate} from 'near-api-js';
import {messageIdFor, sendMessageBody, getTaskBody, parseChallenge, agentOrigin, a2aUrl} from '../src/procurement/marketplace.mjs';

const RPC = 'https://free.rpc.fastnear.com';
const MARKET_ORIGIN = 'https://market.near.ai';
const TASK_STATE_TERMINAL = ['TASK_STATE_COMPLETED', 'TASK_STATE_REJECTED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED'];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true);
}

const handle = arg('handle');
const task = arg('task');
const dryRun = Boolean(arg('dry-run'));
if (!handle || typeof task !== 'string') throw new Error('Provide --handle <supplier> and --task "<text>".');

const walletDir = '.runtime/company-ledger-wallet/mainnet';
const publicMeta = JSON.parse(await readFile(`${walletDir}/public.json`, 'utf8'));
const payerKeyFile = arg('payer-key');
const payerIdArg = arg('payer-id');
const credential = payerKeyFile ? JSON.parse(await readFile(payerKeyFile, 'utf8')) : JSON.parse(await readFile(`${walletDir}/credential.json`, 'utf8'));
const accountId = typeof payerIdArg === 'string' ? payerIdArg : credential.account_id;

const rpc = async (method, params) => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? 'RPC_ERROR');
  return payload.result;
};
const viewCall = async (account_id, method_name, args) => {
  const result = await rpc('query', {request_type: 'call_function', finality: 'final', account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')});
  return JSON.parse(Buffer.from(result.result).toString('utf8'));
};

// 1. Quote: SendMessage without payment -> HTTP 402 challenge.
const sendMessage = async (extraHeaders = {}) => {
  const response = await fetch(a2aUrl(handle), {
    method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json', ...extraHeaders},
    body: sendMessageBody({task, messageId: messageIdFor(task)}),
  });
  return {status: response.status, body: await response.json()};
};

const quoted = await sendMessage();
if (quoted.status !== 402) {
  console.log(JSON.stringify({handle, httpStatus: quoted.status, note: 'Expected a 402 payment challenge.', response: quoted.body}, null, 2));
  process.exit(quoted.status === 200 ? 0 : 3);
}
const rows = parseChallenge(quoted.body);
const row = rows.find(r => r.network === 'near:mainnet');
if (!row) throw new Error('No near:mainnet payment row in the challenge.');

// Verify the payTo/asset against the platform recipient list, never the challenge alone.
const wellKnown = await fetch(`${MARKET_ORIGIN}/.well-known/x402`).then(r => r.json());
if (!Array.isArray(wellKnown?.recipients) || !wellKnown.recipients.some(r => r.network === row.network && r.asset === row.asset && r.payTo === row.payTo)) {
  throw new Error('Challenge recipient is not in the marketplace recipient list.');
}

const summary = {handle, task, network: row.network, asset: row.asset, payTo: row.payTo, amountAtomic: row.amount, maxTimeoutSeconds: row.maxTimeoutSeconds};
summary.amountUsdc = (Number(row.amount) / 1e6).toFixed(6);

const balanceAtomic = await viewCall(row.asset, 'ft_balance_of', {account_id: accountId});
summary.payer = accountId;
summary.payerUsdcAtomic = balanceAtomic;
summary.payerUsdc = (Number(balanceAtomic) / 1e6).toFixed(6);

if (BigInt(balanceAtomic) < BigInt(row.amount)) {
  console.log(JSON.stringify({...summary, error: 'INSUFFICIENT_USDC', note: `Payer needs ${summary.amountUsdc} USDC on NEAR (has ${summary.payerUsdc}). Fund the account with USDC on NEAR, then rerun.`}, null, 2));
  process.exit(2);
}

// 2. Sign exactly the accepted row: one NEP-366 delegate action (ft_transfer, no gas from payer).
const provider = new JsonRpcProvider({url: RPC});
const signer = KeyPairSigner.fromSecretKey(credential.private_key);
const account = new Account(accountId, provider, signer);
const publicKey = await signer.getPublicKey();
const accessKey = await rpc('query', {request_type: 'view_access_key', finality: 'final', account_id: accountId, public_key: publicKey.toString()});
const block = await rpc('block', {finality: 'final'});
const maxBlockHeight = BigInt(block.header.height) + BigInt(row.maxTimeoutSeconds);
const nonce = BigInt(accessKey.nonce) + 1n;

const delegateAction = buildDelegateAction({
  actions: [actions.functionCall('ft_transfer', {receiver_id: row.payTo, amount: row.amount}, 30000000000000n, 1n)],
  maxBlockHeight, nonce, publicKey, senderId: accountId, receiverId: row.asset,
});
const {signedDelegate} = await signer.signDelegateAction(delegateAction);
const signedDelegateAction = Buffer.from(encodeSignedDelegate(signedDelegate)).toString('base64');
const payload = {signedDelegateAction};
const xPayment = Buffer.from(JSON.stringify({x402Version: 2, accepted: row, payload})).toString('base64');
summary.xPaymentHeaderBytes = xPayment.length;

if (dryRun) {
  console.log(JSON.stringify({...summary, note: 'Dry run: delegate action signed but not sent. No payment, no task.', signedDelegateAction}, null, 2));
  process.exit(0);
}

// 3. Pay: retry the same SendMessage with X-PAYMENT. The header is a cheque; money moves on delivery.
const paid = await sendMessage({'X-PAYMENT': xPayment});
summary.paidHttpStatus = paid.status;

async function readTask() {
  const body = paid.body?.result?.task ?? paid.body?.result;
  if (body?.id && TASK_STATE_TERMINAL.includes(body?.status?.state)) return body;
  if (!body?.id) return null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const polled = await fetch(a2aUrl(handle), {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: getTaskBody(body.id)}).then(r => r.json());
    const taskResult = polled?.result;
    if (taskResult?.status?.state && TASK_STATE_TERMINAL.includes(taskResult.status.state)) return taskResult;
  }
  return body;
}

const finished = await readTask();
const evidence = {
  schemaVersion: 1,
  kind: 'marketplace-x402-payment',
  paidAt: new Date().toISOString(),
  challenge: row,
  payer: accountId,
  taskId: finished?.id ?? null,
  taskState: finished?.status?.state ?? null,
  artifacts: finished?.artifacts ?? null,
  rawResponse: paid.body,
};
await mkdir('artifacts/marketplace', {recursive: true});
await writeFile(`artifacts/marketplace/payment-${Date.now()}.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
