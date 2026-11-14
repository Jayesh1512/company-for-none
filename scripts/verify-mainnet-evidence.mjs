// Recheck the ledger on public mainnet RPC and inspect retained provider artifacts.
// LIVE_PUBLIC checks query the chain; LOCAL_ARTIFACT checks do not independently
// reverify provider execution, payment, signatures or billing. Swap is not checked.
//
// Read-only: queries public RPC, the ledger contract views and the on-chain tx
// status. Sends nothing, signs nothing, spends nothing. Prints PASS/FAIL per item.
//
// Usage: node scripts/verify-mainnet-evidence.mjs
import {readFile} from 'node:fs/promises';

const RPC = 'https://free.rpc.fastnear.com';
const LEDGER = '755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b';
const COMPANY_HASH = '9f83bd56058199fad25b2afbe9a452a01170dac5187f8546cf0d469278d962f9';
const CODE_HASH = 'GnfHJq4kXk5eLNNSvez2ue7BCHDEaGyZSTXrGzqaZ27g';
const AGENT_ACCOUNT = 'b2c5b8f31edf4dfb2560eb14397c8d61656c9f34c4f644077ed08a991fd9fc75';
const ZERO = '0'.repeat(64);

const DEPLOY_TX = 'DP64fpGTGLyDwUouW9ecas6wgZwuzS7hyDeKH3WtUswR';
const SET_WRITER_TX = 'Cmh2zL2SWhm5mJ4JY23nHFFyJtLiavEV4Vfp4Bsvzb1n';
const APPEND_OWNER_TX = '5Xg6uasjZW4nnwWCFjP3stAaaiDtnCixc3zGvuCarhUb';
const ADD_SCOPED_KEY_TX = 'DUPtojtZt7jUkEUozUeQGBbs812nWHDiXhKjv3v2jxe';
const DELETE_FULL_KEY_TX = 'FPVgbFSQ6CqLFMtBYi4QKcAAz1WaMYwZGZ6ruXiAWyt';
const APPEND_SCOPED_TX = 'GsQhBsCknFXwGTHjdMtSqWPHuyVBZgK31AqufopeUK7d';
const AGENT_APPEND_TX = 'B5uKmgFDs8MrVrMZUuYDj9yQxYDP8bWnpQDdgduJwF1m';

const rpc = async (method, params) => {
  const response = await fetch(RPC, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? 'RPC_ERROR');
  return payload.result;
};
const view = async (method_name, args = {}) => {
  const result = await rpc('query', {request_type: 'call_function', finality: 'final', account_id: LEDGER, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64')});
  return JSON.parse(Buffer.from(result.result).toString('utf8'));
};
const txStatus = async hash => {
  const result = await rpc('tx', {tx_hash: hash, sender_account_id: null, wait_until: 'FINAL'}).catch(async () => {
    // Sender is needed for some nodes; try the known signers.
    for (const sender of [LEDGER, AGENT_ACCOUNT, 'c65dfd852ac424c967951a7f3e2d6ee3153374822c30a4a484345ee5bbf456fc']) {
      try { return await rpc('tx', {tx_hash: hash, sender_account_id: sender, wait_until: 'FINAL'}); } catch { /* next */ }
    }
    throw new Error('TX_NOT_FOUND');
  });
  return result;
};

const results = [];
const check = (name, ok, detail, scope = 'LIVE_PUBLIC') => { results.push({name, ok, detail, scope}); console.log(`${ok ? 'PASS' : 'FAIL'}  [${scope}] ${name}${detail ? ` — ${detail}` : ''}`); };
const artifactCheck = (name, ok, detail) => check(name, ok, detail, 'LOCAL_ARTIFACT');

try {
  const account = await rpc('query', {request_type: 'view_account', finality: 'final', account_id: LEDGER});
  check('ledger contract account exists', true, `code_hash ${account.code_hash.slice(0, 12)}`);
  check('ledger code_hash matches manifest', account.code_hash === CODE_HASH, account.code_hash);

  const head = await view('get_head');
  check('ledger companyHash matches', head.companyHash === COMPANY_HASH, head.companyHash.slice(0, 12));
  check('ledger writer is the Agent API agent account', head.writerId === AGENT_ACCOUNT, head.writerId ?? 'null');
  check('ledger head sequence >= 6', head.sequence >= 6, `sequence ${head.sequence}`);

  const records = await view('get_records', {from_sequence: 1, limit: 20});
  check('ledger has hash-chained records', Array.isArray(records) && records.length >= 6, `${records.length} records`);
  const chainIntact = records.every((r, i) => r.previousHash === (i === 0 ? ZERO : records[i - 1].hash) && r.sequence === i + 1);
  check('record previousHash chain is intact', chainIntact);
} catch (error) {
  check('ledger reads', false, String(error.message ?? error).slice(0, 100));
}

for (const [name, hash] of [['deploy', DEPLOY_TX], ['set_writer', SET_WRITER_TX], ['owner append', APPEND_OWNER_TX], ['add scoped key', ADD_SCOPED_KEY_TX], ['delete full key', DELETE_FULL_KEY_TX], ['scoped append', APPEND_SCOPED_TX], ['agent-api append', AGENT_APPEND_TX]]) {
  try {
    const result = await txStatus(hash);
    const status = result?.status;
    const succeeded = result.final_execution_status === 'FINAL' && status && Object.hasOwn(status, 'SuccessValue') &&
      !(result.receipts_outcome ?? []).some(receipt => Object.hasOwn(receipt.outcome?.status ?? {}, 'Failure'));
    check(`tx FINAL success: ${name} (${hash.slice(0, 10)}…)`, Boolean(succeeded), JSON.stringify(status).slice(0, 60));
  } catch (error) {
    check(`tx: ${name}`, false, String(error.message ?? error).slice(0, 60));
  }
}

// Artifact consistency only: does not independently prove task completion/payment.
try {
  const files = (await import('node:fs')).readdirSync('artifacts/marketplace').filter(f => f.endsWith('.json'));
  const paid = [];
  for (const f of files) {
    const j = JSON.parse(await readFile(`artifacts/marketplace/${f}`, 'utf8'));
    if (j.taskState === 'TASK_STATE_COMPLETED') paid.push({payer: j.payer, taskId: j.taskId});
  }
  artifactCheck('marketplace artifacts report completed tasks', paid.length >= 1, `${paid.length} completed: ${paid.map(p => p.taskId?.slice(0, 8)).join(', ')}`);
} catch (error) {
  artifactCheck('marketplace evidence', false, String(error.message ?? error).slice(0, 60));
}

// Artifact consistency only: does not reverify the original Cloud call or bill.
try {
  const run = JSON.parse(await readFile('artifacts/mainnet-proof/cloud-inference-item5.json', 'utf8'));
  artifactCheck('cloud artifact reports answered inference', run.status === 'answered', run.status);
  artifactCheck('cloud artifact reports verified wire signature', run.verification?.wireSignatureVerified === true);
  artifactCheck('cloud artifact reports original-call plaintext verification', run.verification?.plaintextVerifiedInOriginalCall === true);
  artifactCheck('cloud artifact records no offline plaintext recovery (route b)', run.verification?.offlinePlaintextRecovery === false);
  artifactCheck('cloud artifact reports reconciled cost', run.cost?.status === 'confirmed' && /^[1-9]\d*$/.test(run.cost?.actualCostNanoUsd ?? ''), `${run.cost?.actualCostNanoUsd} nanoUSD`);
} catch (error) {
  artifactCheck('cloud inference evidence', false, String(error.message ?? error).slice(0, 60));
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}`);
for (const scope of ['LIVE_PUBLIC', 'LOCAL_ARTIFACT']) {
  const scoped = results.filter(r => r.scope === scope);
  console.log(`${scope}: ${scoped.filter(r => r.ok).length}/${scoped.length} passed`);
}
console.log('Local artifact checks are recorded assertions, not independent provider verification. 1Click swap settlement is not checked.');
process.exitCode = failed ? 1 : 0;
