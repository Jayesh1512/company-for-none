// Option B: a REAL mainnet customer payment through the product's payment module.
//
// Customer pays wNEAR -> treasury (payer account) receives USDC, settled by 1Click.
// Cross-asset by necessity: the adapter (correctly) refuses same-asset settlement
// because a reverse refund route cannot be priced for it.
//
// Honest label: the product's payment module executed under explicit owner
// authorization. The standing `payments_route` readiness capability remains
// `configured` (ROUTE_UNVERIFIED), so the full service-order activation gate is
// NOT claimed as open.
//
// Usage:
//   node scripts/live-checkout.mjs open     # real 1Click quote -> deposit address
//   node scripts/live-checkout.mjs pay      # buyer wraps+sends wNEAR to the address
//   node scripts/live-checkout.mjs settle   # poll status, confirm, write ledger
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {loadEnvFile} from 'node:process';
import {Account, KeyPairSigner, JsonRpcProvider, actions} from 'near-api-js';
import {createJournal} from '../src/journal/index.mjs';
import {parseConfigYaml} from '../src/rules/index.mjs';
import {makeOffer} from '../src/rules/policies.mjs';
import {createPaymentsAdapter} from '../src/payments/index.mjs';
import {hash} from '../src/rules/config.mjs';
import {createAgentApi} from '@near-intents-agent-api/sdk';
import {createLedgerCommitter} from '../src/onchain/ledger-commit.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const step = process.argv[2] ?? 'open';
const companyId = 'local-workspace';
const RPC = 'https://free.rpc.fastnear.com';
const WRAP = 'wrap.near';
const WRAP_ASSET = 'nep141:wrap.near';
const USDC_ASSET = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const BUYER = '755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b'; // deploy = buyer (pays wNEAR)
const policyPath = '.runtime/live-checkout/policy.yaml';
const statePath = '.runtime/live-checkout/checkout.json';

const clock = () => new Date();
const config = parseConfigYaml(await readFile(policyPath, 'utf8'));
const journal = await createJournal({directory: '.runtime/live-checkout/journal', clock});
const resolveSecret = async name => process.env[name] || null;
const payments = createPaymentsAdapter({mode: 'live', journal, clock, slippageTolerance: 100, resolveSecret, secretRef: process.env.SHOP_PAYMENTS_SECRET_REF ?? 'NEAR_1CLICK_API_KEY', authScheme: 'bearer'});

const actionId = 'checkout:customer-care:1';

if (step === 'open') {
  const decision = makeOffer(config, hash(config), clock().getTime(), {
    id: actionId, orderId: 'order:customer-care:1',
    money: {network: 'near:mainnet', asset: USDC_ASSET, decimals: 6, amount: '100000'}, // 0.10 USDC
    sourceAsset: {network: 'near:mainnet', asset: WRAP_ASSET, decimals: 24},
  });
  if (decision.status !== 'allow') throw new Error(`makeOffer refused: ${decision.reasonCode}`);
  const offer = decision.offer;
  const sourceAsset = {network: 'near:mainnet', asset: WRAP_ASSET, decimals: 24};

  const result = await payments.quote({
    action: {id: actionId, type: 'offer'},
    offer, sourceAsset,
    recipient: config.treasuryAccount, refundTo: BUYER, expiresAt: offer.expiresAt,
    decision: {status: 'allow', offer},
  });
  if (result.status !== 'confirmed') {
    console.log(JSON.stringify({step: 'open', status: result.status, code: result.code ?? null}).slice(0, 500));
    process.exitCode = 2;
  } else {
    const q = result.quote;
    await mkdir('.runtime/live-checkout', {recursive: true});
    await writeFile(statePath, JSON.stringify({offer, quote: q, actionId, sourceAsset}, null, 2) + '\n');
    console.log(JSON.stringify({step: 'open', treasury: config.treasuryAccount, price: offer.price,
      depositAddress: q.depositAddress, depositMemo: q.depositMemo ?? null, requiredInput: q.requiredInput,
      providerRef: q.providerReference, refundRoute: q.serviceRefundRoute ? {kind: q.serviceRefundRoute.kind, feesComplete: q.serviceRefundRoute.feesComplete} : null}, null, 1));
    console.log(`\nCustomer pays ${q.requiredInput.amount} atomic ${q.requiredInput.asset.split(':').pop()} to:\n  ${q.depositAddress}\nRun: node scripts/live-checkout.mjs pay`);
  }
}

if (step === 'pay') {
  const saved = JSON.parse(await readFile(statePath, 'utf8'));
  const dest = saved.quote.depositAddress;
  const amount = saved.quote.requiredInput.amount; // wNEAR atomic
  const cred = JSON.parse(await readFile(path.resolve('.runtime/company-ledger-wallet/mainnet/credential.json'), 'utf8'));
  const provider = new JsonRpcProvider({url: RPC});
  const buyer = new Account(BUYER, provider, KeyPairSigner.fromSecretKey(cred.private_key));
  const rpc = async p => (await (await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'query', params: p})})).json()).result;
  const view = async (m, a) => JSON.parse(Buffer.from((await rpc({request_type: 'call_function', finality: 'final', account_id: WRAP, method_name: m, args_base64: Buffer.from(JSON.stringify(a)).toString('base64')})).result).toString('utf8'));

  // Wrap a little extra NEAR to cover the amount plus gas, then register + transfer.
  const wrapDeposit = (BigInt(amount) + 5000000000000000000000n).toString(); // +0.005 NEAR headroom
  const dep = await buyer.signAndSendTransaction({receiverId: WRAP, actions: [actions.functionCall('near_deposit', {}, '30000000000000', BigInt(wrapDeposit))], waitUntil: 'FINAL'});
  const bal = await view('ft_balance_of', {account_id: BUYER});
  const sb = await view('storage_balance_of', {account_id: dest});
  if (!sb || BigInt(sb.total ?? '0') === 0n) await buyer.signAndSendTransaction({receiverId: WRAP, actions: [actions.functionCall('storage_deposit', {account_id: dest, registration_only: true}, '30000000000000', 1250000000000000000000n)], waitUntil: 'FINAL'});
  const t = await buyer.signAndSendTransaction({receiverId: WRAP, actions: [actions.functionCall('ft_transfer', {receiver_id: dest, amount}, '30000000000000', 1n)], waitUntil: 'FINAL'});
  console.log(JSON.stringify({step: 'pay', wrapTx: dep.transaction?.hash, buyerWNear: bal, transferTx: t.transaction?.hash, status: JSON.stringify(t.status)}, null, 1));
}

if (step === 'settle') {
  const saved = JSON.parse(await readFile(statePath, 'utf8'));
  let confirmed = null;
  for (let i = 0; i < 40; i += 1) {
    const out = await payments.verifySettlement({action: {id: saved.actionId, type: 'settlement'}, quote: saved.quote});
    if (['confirmed', 'failed'].includes(out.status)) { confirmed = out; break; }
    await new Promise(r => setTimeout(r, 6000));
  }
  const s = confirmed ?? {status: 'pending', code: 'PAYMENT_UNRESOLVED'};
  const record = {step: 'settle', at: new Date().toISOString(), status: s.status, code: s.code ?? null,
    settlement: s.settlement ? {verified: s.settlement.verified, money: s.settlement.money, recipient: s.settlement.recipient, verificationLevel: s.settlement.verificationLevel, transactionIds: s.settlement.transactionIds} : null};
  if (s.status === 'confirmed') {
    const api = createAgentApi({apiKey: process.env.NEAR_INTENTS_AGENT_API_KEY, baseUrl: process.env.NEAR_INTENTS_AGENT_API_URL});
    const committer = createLedgerCommitter({api, agentId: process.env.NEAR_AGENT_ID, grantToken: process.env.NEAR_AGENT_GRANT_TOKEN, contractId: process.env.SHOP_LEDGER_CONTRACT_ID, companyId});
    try { record.ledger = await committer.append([{type: 'sale.confirmed', data: {companyId, actorId: 'customer', offerId: saved.offer.id, amount: saved.offer.price.amount, asset: saved.offer.price.asset, txIds: record.settlement?.transactionIds ?? []}}]); }
    catch (error) { record.ledger = {error: error.code ?? error.message}; }
  }
  await mkdir('artifacts/mainnet-proof', {recursive: true});
  await writeFile('artifacts/mainnet-proof/live-checkout-settlement.json', JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record, null, 1));
}

await journal.close();
