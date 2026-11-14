// Item 2: create an Agent API agent owned by the payer account, issue a grant,
// and record both ids/tokens back into .env.
//
// Owner = the payer account (e17d480f...), which holds a full-access key.
// Owner signing uses NEP-366 (NEAR delegate action) for agent_create and
// NEP-413 (message) for grant_issue, matching the API's intent.standard.
//
// Usage:
//   node scripts/agent-api-create.mjs --step create   # generate + submit agent_create
//   node scripts/agent-api-create.mjs --step grant    # generate + submit grant_issue
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Account, KeyPairSigner, JsonRpcProvider, actions, buildDelegateAction, encodeSignedDelegate} from 'near-api-js';
import {createAgentApi, createGrantCredential, createIdempotencyKey} from '@near-intents-agent-api/sdk';

const RPC = 'https://free.rpc.fastnear.com';
const USDC_NEAR = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const WRAP_NEAR = 'nep141:wrap.near';

const step = (() => { const i = process.argv.indexOf('--step'); return i === -1 ? 'create' : process.argv[i + 1]; })();
const envPath = path.resolve('.env');
const envText = await readFile(envPath, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(l => /^[A-Z0-9_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));

const apiKey = env.NEAR_INTENTS_AGENT_API_KEY;
const baseUrl = env.NEAR_INTENTS_AGENT_API_URL;
if (!apiKey) throw new Error('NEAR_INTENTS_AGENT_API_KEY empty in .env');

const walletDir = path.resolve('.runtime/company-ledger-wallet/mainnet');
const payerCred = JSON.parse(await readFile(path.join(walletDir, 'payer-full.json'), 'utf8'));
const payerId = 'e17d480f28ef0c3f39c7b3a12bdf80acfa2e2282a5e7a2eae3f019510ce6e8d4';
const payerKey = KeyPairSigner.fromSecretKey(payerCred.private_key);
const ownerPublicKey = payerCred.public_key;

const api = createAgentApi({apiKey, baseUrl});

const pending = new Set(['PROCESSING', 'QUEUED', 'PENDING_DEPOSIT', 'PENDING_APPROVAL', 'UNCERTAIN']);
async function settled(correlationId, timeoutMs = 5 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await api.getStatus(correlationId, {waitMs: 30_000});
    if (!pending.has(status.status)) return status;
  }
  throw new Error(`${correlationId} still pending`);
}

function setEnv(key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  const envNext = re.test(envText) ? envText.replace(re, `${key}=${value}`) : `${envText}\n${key}=${value}`;
  return envNext;
}
let working = envText;

if (step === 'create') {
  const policy = {
    frozen: false,
    actions: ['swap', 'transfer', 'withdraw'],
    confidential: true,
    owner_approval: false,
    assets: [USDC_NEAR, WRAP_NEAR],
    limits: {per_transaction: {[USDC_NEAR]: '2000000', [WRAP_NEAR]: '500000000000000000000000'}},
    max_actions_per_hour: null,
    destinations: {mode: 'only', list: []},
    budget: {daily_usd: '2', weekly_usd: null, monthly_usd: null},
    timelock_ms: 0,
    native: {
      near: {sign_message: [], transfer: false, call: [env.SHOP_LEDGER_CONTRACT_ID]},
      evm: {sign_typed_data: [], sign_message: false, sign_transaction: false},
      solana: {sign_message: false, sign_transaction: false},
    },
  };

  const generated = await api.generateIntent(
    {type: 'agent_create', name: 'Company for None ledger writer', external_user_id: 'company-for-none', owner: {type: 'near', account_id: payerId, public_key: ownerPublicKey}, policy},
    {idempotencyKey: createIdempotencyKey()},
  );
  console.log('correlation_id:', generated.correlation_id, '| agent_id:', generated.agent_id, '| standard:', generated.intent.standard);
  console.log('preview:', generated.preview?.summary);

  if (generated.intent.standard !== 'nep366') throw new Error(`Unexpected standard ${generated.intent.standard}`);
  const provider = new JsonRpcProvider({url: RPC});
  const ownerAccount = new Account(payerId, provider, payerKey);
  const payerPublicKey = await payerKey.getPublicKey();
  const accessKey = await provider.viewAccessKey({accountId: payerId, publicKey: ownerPublicKey});
  const block = await provider.viewBlock({finality: 'final'});
  const deliverable = generated.intent.payload;
  const nearActions = deliverable.actions.map(a => {
    if (a.type !== 'FunctionCall') throw new Error(`Unsupported payload action ${a.type}`);
    return actions.functionCall(a.params.methodName, a.params.args, BigInt(a.params.gas), BigInt(a.params.deposit));
  });
  const delegateAction = buildDelegateAction({
    actions: nearActions,
    maxBlockHeight: BigInt(block.header.height + 1000),
    nonce: BigInt(accessKey.nonce) + 1n,
    publicKey: payerPublicKey,
    receiverId: deliverable.receiverId,
    senderId: payerId,
  });
  void ownerAccount;
  const signed = await payerKey.signDelegateAction(delegateAction);
  const signed_data = {standard: 'nep366', payload: deliverable, signed_delegate: Buffer.from(encodeSignedDelegate(signed.signedDelegate)).toString('base64')};

  await api.submitIntent({type: 'agent_create', correlation_id: generated.correlation_id, signed_data});
  const status = await settled(generated.correlation_id);
  console.log('agent_create status:', status.status, status.failure_code ?? '');
  if (status.status !== 'SUCCESS') { console.log(JSON.stringify(status, null, 2).slice(0, 1200)); process.exit(1); }

  const agent = await api.getAgent(generated.agent_id);
  console.log('agent status:', agent.status, '| near_account:', agent.wallet?.near_account_id);
  working = setEnv('NEAR_AGENT_ID', generated.agent_id);
  working = setEnv('NEAR_AGENT_ACCOUNT_ID', agent.wallet?.near_account_id ?? '');
  working = setEnv('SHOP_LEDGER_SIGNER_ID', agent.wallet?.near_account_id ?? '');
  await writeFile(envPath, working);
}

if (step === 'grant') {
  const agentId = env.NEAR_AGENT_ID;
  if (!agentId) throw new Error('NEAR_AGENT_ID empty in .env');
  const {token, commitment} = createGrantCredential();
  const generated = await api.generateIntent(
    {type: 'grant_issue', agent_id: agentId, label: 'Company for None ledger writer', credential: commitment, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()},
    {idempotencyKey: createIdempotencyKey()},
  );
  console.log('grant correlation_id:', generated.correlation_id, '| standard:', generated.intent.standard);
  if (generated.intent.standard !== 'nep413') throw new Error(`Unexpected standard ${generated.intent.standard}`);
  const payload = generated.intent.payload;
  const signedMessage = await payerKey.signNep413Message(payerId, {message: payload.message, recipient: payload.recipient, nonce: Buffer.from(payload.nonce, 'base64')});
  const signed_data = {standard: 'nep413', payload, public_key: signedMessage.publicKey.toString(), signature: Buffer.from(signedMessage.signature).toString('base64')};
  await api.submitIntent({type: 'grant_issue', correlation_id: generated.correlation_id, signed_data});
  const status = await settled(generated.correlation_id);
  console.log('grant_issue status:', status.status, status.failure_code ?? '');
  if (status.status !== 'SUCCESS') { console.log(JSON.stringify(status, null, 2).slice(0, 1200)); process.exit(1); }
  working = setEnv('NEAR_AGENT_GRANT_TOKEN', token);
  await writeFile(envPath, working);
  console.log('grant live; token stored in .env as NEAR_AGENT_GRANT_TOKEN');
}
