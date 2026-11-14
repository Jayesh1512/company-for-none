import { fingerprint, assertMoney, assertIntegerString } from '../contracts.mjs';

// Internal technical persistence/transport mechanics shared by M04–M07.
// Business decisions and permitted retry/remedy plans always come from M01.
export const digest = fingerprint;
export const nowIso = clock => new Date(clock()).toISOString();
export const atomic = value => { try { assertIntegerString(value); return true; } catch { return false; } };
export function moneyValid(m) {
  try { assertMoney(m); return true; } catch { return false; }
}
export function sameUnit(a, b) {
  return a?.network === b?.network && a?.asset === b?.asset && a?.decimals === b?.decimals;
}
export const realMode = mode => ['live', 'testnet'].includes(mode) ? mode : 'unavailable';
export function capability(module, mode, provider, details = {}) {
  if (!['live', 'testnet', 'unavailable'].includes(mode)) throw new TypeError('Invalid provider mode');
  return { schemaVersion: 1, module, mode, provider, simulated: false,
    liveProven: false, ...details };
}
export function result(meta, status, action, fields = {}) {
  return { schemaVersion: 1, status, mode: meta.mode, simulated: meta.simulated,
    provider: meta.provider, operation: { actionId: action?.id ?? action?.actionId ?? null,
      fingerprint: action ? digest(action) : null, provider: meta.provider }, evidence: [], ...fields };
}
export const unsupported = (meta, action, reason = 'No supported route or access established') =>
  result(meta, 'not_submitted', action, { code: 'UNSUPPORTED_CAPABILITY', reason });

export function createOperationRuntime({ journal, namespace, meta, dispatchAuthorized, binding, clock = () => new Date() }) {
  const bindingFingerprint = binding === undefined ? null : digest(binding);
  const key = action => `${namespace}:${action.id ?? action.actionId}`;
  function read(action) { return journal.getOperation(key(action)); }
  function prior(action, payload) {
    const op = read(action);
    if (!op) return null;
    if (op.mode !== meta.mode || op.provider !== meta.provider) return result(meta, 'not_submitted', action, { code: 'PROVIDER_MODE_MISMATCH' });
    if (bindingFingerprint !== null && op.bindingFingerprint !== bindingFingerprint) return result(meta, 'not_submitted', action, { code: 'PROVIDER_ACCOUNT_MISMATCH' });
    if (op.fingerprint !== digest({ action, payload })) return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
    return op.result ?? result(meta, op.status, action, { code: 'RECONCILIATION_REQUIRED',
      operation: { actionId: op.externalActionId, fingerprint: op.actionFingerprint, provider: op.provider } });
  }
  async function save(action, outcome) {
    await journal.recordOperationResult(key(action), outcome);
    return outcome;
  }
  async function execute({ action, decision, facts = {}, payload, prepare, send }) {
    if (!action || typeof (action.id ?? action.actionId) !== 'string') return result(meta, 'not_submitted', action, { code: 'INVALID_INPUT' });
    if (!journal) return result(meta, 'not_submitted', action, { code: 'STORAGE_UNAVAILABLE' });
    const existing = prior(action, payload);
    if (existing) return existing;
    if (!decision || decision.status !== 'allow' || !decision.permit || typeof dispatchAuthorized !== 'function') {
      return result(meta, 'not_submitted', action, { code: 'POLICY_BLOCK', reason: 'M01 decision, permit and final dispatch gate required' });
    }
    if (decision.actionFingerprint !== digest(action) || decision.permit.actionFingerprint !== digest(action)) {
      return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
    }
    let prepared;
    try { prepared = await prepare?.(); } catch {
      return result(meta, 'not_submitted', action, { code: 'PROVIDER_UNAVAILABLE' });
    }
    // Atomic operation registration wins races between simultaneous commands.
    const claim = await journal.registerOperation({ actionId: key(action), fingerprint: digest({ action, payload }),
      purpose: action.type, network: action.money?.network ?? action.network ?? null,
      provider: meta.provider, mode: meta.mode, status: 'unknown',
      ...(bindingFingerprint === null ? {} : { bindingFingerprint }),
      externalActionId: action.id ?? action.actionId, actionFingerprint: digest(action), payloadHash: digest(payload), attempts: [{ at: nowIso(clock) }] });
    if (claim.replayed) return prior(action, payload);
    let invoked = false;
    let sending;
    let gate;
    try {
      gate = await dispatchAuthorized({ action, decision, permit: decision.permit, facts }, () => {
        if (invoked) throw new Error('Duplicate dispatch callback');
        invoked = true;
        // send must invoke the transport synchronously, with credentials already
        // resolved. No credential lookup or storage await after the final gate.
        sending = send(prepared);
        return sending;
      });
      if (!invoked) return save(action, result(meta, 'not_submitted', action, {
        code: gate?.reasonCode ?? gate?.code ?? 'POLICY_BLOCK', decision: gate?.status ?? 'hold',
      }));
      return await save(action, await sending);
    } catch {
      const outcome = result(meta, invoked ? 'unknown' : 'not_submitted', action, {
        code: invoked ? 'UNKNOWN_OUTCOME' : 'POLICY_BLOCK',
        cost: { status: 'pending', actualCostNanoUsd: null },
      });
      // A post-dispatch journal error may leave only the durable unknown intent.
      // Do not erase it or issue another provider request.
      try { return await save(action, outcome); } catch { return outcome; }
    }
  }
  async function reconcile(action, observe) {
    const op = journal?.getOperation(key(action));
    if (!op) return result(meta, 'not_submitted', action, { code: 'OPERATION_NOT_FOUND' });
    if (op.mode !== meta.mode || op.provider !== meta.provider) return result(meta, 'not_submitted', action, { code: 'PROVIDER_MODE_MISMATCH' });
    if (bindingFingerprint !== null && op.bindingFingerprint !== bindingFingerprint) return result(meta, 'not_submitted', action, { code: 'PROVIDER_ACCOUNT_MISMATCH' });
    if (op.actionFingerprint !== digest(action)) return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
    if (op.result?.status === 'confirmed' && op.result.cost?.status !== 'pending') return op.result;
    try { return await save(action, await observe(op)); }
    catch { return op.result ?? result(meta, 'unknown', action, { code: 'UNKNOWN_OUTCOME' }); }
  }
  return { execute, reconcile, read, save, meta, clock };
}
