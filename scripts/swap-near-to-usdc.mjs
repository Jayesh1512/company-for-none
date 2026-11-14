// Swap native NEAR -> USDC on NEAR via NEAR Intents (1Click).
//
// NEAR-origin 1Click swaps deposit NEP-141 wNEAR, so this wraps NEAR first
// (wrap.near near_deposit) then ft_transfers wNEAR to the quote's deposit address.
// Delivery is USDC (NEP-141) on NEAR to the same account.
//
// Usage:
//   node scripts/swap-near-to-usdc.mjs --amount-near 0.7 --dry-run
//   node scripts/swap-near-to-usdc.mjs --amount-near 0.7
import {readFile} from 'node:fs/promises';
import {Account, KeyPairSigner, JsonRpcProvider, actions} from 'near-api-js';

const RPC = 'https://free.rpc.fastnear.com';
const WRAP = 'wrap.near';
const USDC = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const WRAP_ASSET = 'nep141:wrap.near';
const USDC_ASSET = `nep141:${USDC}`;
const GAS = '30000000000000';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true);
}

const amountNear = arg('amount-near');
const useWnear = Boolean(arg('use-wnear'));
const dryRun = Boolean(arg('dry-run'));
if ((!useWnear || amountNear !== null) && (typeof amountNear !== 'string' || !/^(0|[1-9]\d*)(?:\.\d{1,24})?$/.test(amountNear))) throw new Error('Provide a positive --amount-near with at most 24 decimal places (or --use-wnear to swap the current wNEAR balance).');
const [whole, fraction = ''] = amountNear?.split('.') ?? [];
const amountYocto = amountNear ? (BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, '0'))).toString() : null;
if (!useWnear && BigInt(amountYocto) <= 0n) throw new Error('The wrap amount must be positive.');

const walletDir = '.runtime/company-ledger-wallet/mainnet';
// A dry run needs only public account metadata; never load or construct a signer.
const credential = JSON.parse(await readFile(`${walletDir}/${dryRun ? 'public' : 'credential'}.json`, 'utf8'));
const accountId = dryRun ? credential.accountId : credential.account_id;

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

const account = dryRun ? null : new Account(accountId, new JsonRpcProvider({url: RPC}), KeyPairSigner.fromSecretKey(credential.private_key));

const accountView = await rpc('query', {request_type: 'view_account', finality: 'final', account_id: accountId});
const storageRequired = BigInt(accountView.storage_usage) * 10000000000000000000n;
const freeYocto = BigInt(accountView.amount) - storageRequired;
const summary = {accountId, amountNear, freeNear: (Number(freeYocto) / 1e24).toFixed(6)};

if (!useWnear && BigInt(amountYocto) + 100000000000000000000000n > freeYocto) {
  console.log(JSON.stringify({...summary, error: 'INSUFFICIENT_FREE_NEAR', note: 'Wrap less, or fund more NEAR.'}, null, 2));
  process.exit(2);
}

// 1. Wrap NEAR -> wNEAR (unless swapping an existing wNEAR balance). wrap.near keeps
// a one-time ~0.00125 NEAR storage deposit, so the credited amount can be slightly less.
if (!useWnear && !dryRun) {
  console.log(JSON.stringify({...summary, note: 'Wrapping NEAR -> wNEAR...'}, null, 2));
  const wrapResult = await account.signAndSendTransaction({
    receiverId: WRAP, actions: [actions.functionCall('near_deposit', {}, GAS, BigInt(amountYocto))], waitUntil: 'FINAL',
  });
  summary.wrapTx = wrapResult.transaction?.hash ?? null;
}
const wNearBalance = await viewCall(WRAP, 'ft_balance_of', {account_id: accountId});
summary.wNearBalance = (Number(wNearBalance) / 1e24).toFixed(6);
// Before a hypothetical wrap, quote the expected balance without sending it.
// A first-time wNEAR storage charge can reduce the actual live balance.
const quoteAmount = dryRun && !useWnear ? (BigInt(wNearBalance) + BigInt(amountYocto)).toString() : wNearBalance;
if (quoteAmount === '0') throw new Error('No wNEAR to swap.');
summary.quoteAmountYocto = quoteAmount;
summary.quoteAmountEstimated = dryRun && !useWnear;

// 2. Request a real quote for the exact wNEAR balance so we know the deposit address.
const quoteRequest = {
  dry: dryRun, swapType: 'EXACT_INPUT', slippageTolerance: 100,
  originAsset: WRAP_ASSET, destinationAsset: USDC_ASSET, amount: quoteAmount,
  depositType: 'ORIGIN_CHAIN', recipientType: 'DESTINATION_CHAIN', refundType: 'ORIGIN_CHAIN',
  refundTo: accountId, recipient: accountId, deadline: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
};
const quoteResponse = await fetch('https://1click.chaindefuser.com/v0/quote', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(quoteRequest)});
const quoteBody = await quoteResponse.json();
if (quoteResponse.status !== 201 || !quoteBody?.quote || (!dryRun && !quoteBody.quote.depositAddress)) throw new Error(`QUOTE_FAILED ${quoteResponse.status} ${JSON.stringify(quoteBody).slice(0, 300)}`);
const quote = quoteBody.quote;
summary.depositAddress = quote.depositAddress;
summary.expectedUsdc = (Number(quote.amountOut) / 1e6).toFixed(6);
summary.minUsdc = (Number(quote.minAmountOut) / 1e6).toFixed(6);
summary.quoteDeadline = quote.deadline;

if (dryRun) {
  console.log(JSON.stringify({...summary, note: 'Dry run: estimate only; no key loaded, transaction signed, wrapping or deposit. A first-time wNEAR storage charge can reduce the live quote amount.'}, null, 2));
  process.exit(0);
}

// 3. Register the fresh deposit address on wNEAR (NEP-141 ft_transfer needs the receiver registered).
const storageBal = await viewCall(WRAP, 'storage_balance_of', {account_id: quote.depositAddress});
if (!storageBal || BigInt(storageBal.total ?? '0') === 0n) {
  console.log(JSON.stringify({...summary, note: 'Registering deposit address on wNEAR...'}, null, 2));
  const regResult = await account.signAndSendTransaction({
    receiverId: WRAP,
    actions: [actions.functionCall('storage_deposit', {account_id: quote.depositAddress, registration_only: true}, GAS, 1250000000000000000000n)],
    waitUntil: 'FINAL',
  });
  summary.storageDepositTx = regResult.transaction?.hash ?? null;
}

// 4. Deposit wNEAR to the 1Click deposit address.
console.log(JSON.stringify({...summary, note: 'Depositing wNEAR to 1Click deposit address...'}, null, 2));
const depositResult = await account.signAndSendTransaction({
  receiverId: WRAP,
  actions: [actions.functionCall('ft_transfer', {receiver_id: quote.depositAddress, amount: wNearBalance}, GAS, 1n)],
  waitUntil: 'FINAL',
});
summary.depositTx = depositResult.transaction?.hash ?? null;

// 4. Poll 1Click status.
let status = null;
for (let attempt = 0; attempt < 40; attempt += 1) {
  const s = await fetch(`https://1click.chaindefuser.com/v0/status?depositAddress=${quote.depositAddress}`).then(r => r.json());
  status = s.status;
  if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(status)) break;
  await new Promise(resolve => setTimeout(resolve, 5000));
}
summary.swapStatus = status;
summary.usdcBalance = (Number(await viewCall(USDC, 'ft_balance_of', {account_id: accountId})) / 1e6).toFixed(6);
console.log(JSON.stringify(summary, null, 2));
