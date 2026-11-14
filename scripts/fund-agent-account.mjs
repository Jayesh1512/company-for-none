// Fund the Agent API agent's NEAR account from the payer account, which also
// creates that (implicit) account so native/near/call can pay gas.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Account, KeyPairSigner, JsonRpcProvider, actions} from 'near-api-js';

const RPC = 'https://free.rpc.fastnear.com';
const PAYER = 'e17d480f28ef0c3f39c7b3a12bdf80acfa2e2282a5e7a2eae3f019510ce6e8d4';
const AGENT = 'b2c5b8f31edf4dfb2560eb14397c8d61656c9f34c4f644077ed08a991fd9fc75';
const AMOUNT = 50000000000000000000000n; // 0.05 NEAR

const walletDir = path.resolve('.runtime/company-ledger-wallet/mainnet');
const cred = JSON.parse(await readFile(path.join(walletDir, 'payer-full.json'), 'utf8'));

const provider = new JsonRpcProvider({url: RPC});
const payer = new Account(PAYER, provider, KeyPairSigner.fromSecretKey(cred.private_key));

const accountExists = async id => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'query', params: {request_type: 'view_account', finality: 'final', account_id: id}})});
  const payload = await response.json();
  return !payload.error;
};

const before = await accountExists(AGENT);
console.log('agent account exists before:', before);

const result = await payer.signAndSendTransaction({
  receiverId: AGENT,
  actions: [actions.transfer(AMOUNT)],
  waitUntil: 'FINAL',
});
console.log('fund tx:', result.transaction?.hash, '| status:', JSON.stringify(result.status));
console.log('agent account exists after:', await accountExists(AGENT));
