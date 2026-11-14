import { capability, createOperationRuntime, moneyValid, realMode, result, unsupported } from './adapter-runtime.mjs';
import { createOutLayerClient } from './http.mjs';
import { observeNearTransaction } from './near-rpc.mjs';

export { createAgentMovement, compareReceiptTerms, MOVEMENT_ASSURANCE } from './movement.mjs';
export { createAgentApiAcquirer } from './acquire.mjs';
export { createAgentSettlementEvidence } from './settlement.mjs';

export function createCustodyAdapter(options = {}) {
  const mode = realMode(options.mode);
  const { journal, dispatchAuthorized, clock = () => new Date(), network = null, accountId = null } = options;
  const meta = capability('M04', mode, 'outlayer', {
    network, accountId, configured: Boolean(accountId && options.secretRef && options.resolveSecret), verified: false,
    custody: 'provider-signs-no-local-private-key', methods: ['transfer', 'call', 'reconcile'],
    missingAccess: mode === 'live' ? ['Protected OutLayer credential and verified account/policy required'] : [],
    evidenceLevel: 'documented-only',
  });
  const runtime = createOperationRuntime({ journal, namespace: 'adapters:m04', meta, dispatchAuthorized, clock });
  const httpMode = mode === 'live' || mode === 'testnet';
  const client = httpMode && ['near:mainnet', 'near:testnet'].includes(network) ? createOutLayerClient({ ...options, network }) : null;
  function liveResult(action, raw) {
    const providerRequestId = raw.request_id ?? raw.id ?? null;
    // A tx hash alone is submission evidence. It does not establish finality.
    const status = raw.status === 'failed' ? 'failed' : 'pending';
    return result(meta, status, action, { providerRequestId,
      receipt: { schemaVersion: 1, provider: 'outlayer', reference: providerRequestId,
        observedAt: new Date(clock()).toISOString(), network, status,
        transactionId: typeof raw.tx_hash === 'string' ? raw.tx_hash : null,
        recipient: action.recipient, money: action.money, mode, simulated: false,
        finalityVerified: false, fees: [{ kind: 'gas-storage-custody', status: 'pending' }] },
      cost: { status: 'pending', actualCostNanoUsd: null },
    });
  }
  async function execute(command, kind) {
    const { action, decision, facts } = command ?? {};
    if (mode === 'unavailable' || !client) return unsupported(meta, action);
    if (!action || (action.network ?? action.money?.network) !== network || !moneyValid(action.money) || action.money.network !== network ||
      typeof action.recipient !== 'string' || !action.recipient ||
      (kind === 'call' && (typeof action.methodName !== 'string' || !action.args || typeof action.args !== 'object'))) {
      return result(meta, 'not_submitted', action, { code: 'INVALID_INPUT' });
    }
    // /transfer is native NEAR only. Token transfer is an exact M01-approved
    // restricted call, never an invented /transfer token parameter.
    if (httpMode && kind === 'transfer' && !['near', 'native:near'].includes(action.money.asset)) {
      return unsupported(meta, action, 'Native transfer endpoint does not transfer this asset; use an approved restricted call');
    }
    if (httpMode && !accountId) return unsupported(meta, action, 'Expected agent account identity must be supplied and verified');
    return runtime.execute({ action, decision, facts, payload: { kind, action },
      prepare: async () => {
        const identity = await client.address();
        if ((identity.near_account_id ?? identity.address) !== accountId) throw new Error('IDENTITY_MISMATCH');
        return kind === 'transfer' ? client.prepareTransfer(action) : client.prepareCall(action);
      },
      send: prepared => prepared().then(raw => liveResult(action, raw)),
    });
  }
  return {
    capabilities: () => structuredClone(meta),
    async identity() {
      if (mode === 'unavailable' || !client) return { ...meta, status: 'not_submitted', code: 'UNSUPPORTED_CAPABILITY' };
      try {
        const raw = await client.address();
        const address = raw.near_account_id ?? raw.address;
        if (typeof address !== 'string' || (accountId && address !== accountId)) return { ...meta, status: 'unknown', code: 'IDENTITY_MISMATCH' };
        return { ...meta, accountId: address, status: 'confirmed', observedAt: new Date(clock()).toISOString() };
      } catch { return { ...meta, status: 'unknown', code: 'PROVIDER_UNAVAILABLE' }; }
    },
    async balance({ asset = 'near' } = {}) {
      if (mode === 'unavailable' || !client) return unsupported(meta);
      try {
        const raw = await client.balance(asset === 'near' ? null : asset);
        // Keep only known amount fields. Never persist the entire authenticated response.
        const amount = raw.balance ?? raw.amount;
        return { mode, simulated: false, status: 'confirmed', network, accountId,
          amount: typeof amount === 'string' ? amount : null, observedAt: new Date(clock()).toISOString() };
      } catch { return result(meta, 'unknown', null, { code: 'PROVIDER_UNAVAILABLE' }); }
    },
    transfer: command => execute(command, 'transfer'),
    call: command => execute(command, 'call'),
    async reconcile({ action }) {
      if (mode === 'unavailable' || !client) return unsupported(meta, action);
      return runtime.reconcile(action, async op => {
        let observation = op.result;
        if (op.result?.providerRequestId) observation = liveResult(action, await client.status(op.result.providerRequestId));
        const transactionId = observation?.receipt?.transactionId;
        if (!transactionId || !accountId) return observation ?? result(meta, 'unknown', action, { code: 'RECONCILIATION_REQUIRED' });
        const chain = await observeNearTransaction({ transport: options.rpcTransport ?? options.transport ?? fetch,
          network, accountId, transactionId, action });
        return { ...observation, status: chain.status, receipt: { ...observation.receipt,
          status: chain.status, finalityVerified: chain.finalityVerified,
          observedAt: new Date(clock()).toISOString(), fees: [
            { kind: 'gas', status: chain.gasAtomic === null ? 'pending' : 'known',
              ...(chain.gasAtomic === null ? {} : { money: { network, asset: 'near', decimals: 24, amount: chain.gasAtomic } }) },
            { kind: 'storage-custody', status: 'pending' },
          ] } };
      });
    },
  };
}
