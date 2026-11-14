import { atomic, digest } from './adapter-runtime.mjs';

// Public read-only NEAR RPC reconciliation. This never signs or broadcasts.
// https://docs.near.org/api/rpc/transactions — tx + wait_until FINAL.
export async function observeNearTransaction({ transport = fetch, network, accountId, transactionId, action }) {
  const base = network === 'near:testnet' ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org';
  const response = await transport(base, { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 'custody-reconciliation', method: 'tx',
      params: { tx_hash: transactionId, sender_account_id: accountId, wait_until: 'FINAL' } }),
  });
  if (!response.ok) throw new Error('RPC_UNAVAILABLE');
  const body = await response.json();
  const value = body.result;
  if (body.error || !value) throw new Error('RPC_UNRESOLVED');
  const tx = value.transaction;
  const methods = tx?.actions;
  if (tx?.hash !== transactionId || tx?.signer_id !== accountId || tx?.receiver_id !== action.recipient ||
    !Array.isArray(methods) || methods.length !== 1) throw new Error('TRANSACTION_MISMATCH');
  if (action.methodName) {
    const call = methods[0].FunctionCall;
    let args;
    try { args = JSON.parse(Buffer.from(call?.args ?? '', 'base64').toString('utf8')); } catch { throw new Error('TRANSACTION_MISMATCH'); }
    if (call.method_name !== action.methodName || call.deposit !== action.money.amount || digest(args) !== digest(action.args)) throw new Error('TRANSACTION_MISMATCH');
  } else if (methods[0].Transfer?.deposit !== action.money.amount) throw new Error('TRANSACTION_MISMATCH');
  const costs = [value.transaction_outcome?.outcome?.tokens_burnt, ...(value.receipts_outcome ?? []).map(r => r.outcome?.tokens_burnt)];
  const gasAtomic = costs.every(atomic) ? costs.reduce((total, v) => total + BigInt(v), 0n).toString() : null;
  const final = value.final_execution_status === 'FINAL';
  const success = final && value.status && Object.hasOwn(value.status, 'SuccessValue');
  const failed = final && value.status && Object.hasOwn(value.status, 'Failure');
  return { status: success ? 'confirmed' : failed ? 'failed' : 'pending', finalityVerified: Boolean(success || failed),
    transactionId, gasAtomic, network, accountId };
}
