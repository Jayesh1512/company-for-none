// Explicit test-only providers. No credentials or network transport are used.
// Product modules must never import this file, directly or transitively.
import { createOperationRuntime, digest, moneyValid, atomic, result, unsupported } from '../../src/custody/adapter-runtime.mjs';

const meta = (module, provider, fields = {}) => ({ schemaVersion: 1, module, provider, mode: 'fixture', simulated: true, liveProven: false, evidenceLevel: 'controlled-fixture', ...fields });
const scenarioFor = (cases, action) => cases?.[action.id ?? action.actionId] ?? { status: 'confirmed' };
const ref = (module, action) => `fixture:${module}:${action.id ?? action.actionId}`;
const receipt = (m, a, clock, fields) => ({ schemaVersion: 1, provider: m.provider, source: m.provider, reference: ref(m.module, a), observedAt: new Date(clock()).toISOString(), mode: 'fixture', simulated: true, ...fields });
const optionsFor = options => ({ ...options, clock: options.clock ?? (() => new Date()), scenarios: options.scenarios ?? {} });

export function createFixtureCustodyAdapter(options = {}) {
  const { journal, dispatchAuthorized, clock, scenarios, network = 'fixture', accountId = 'fixture-agent.testnet' } = optionsFor(options);
  const m = meta('M04', 'fixture-custody', { network, accountId, methods: ['transfer', 'call', 'reconcile'] });
  const runtime = createOperationRuntime({ journal, namespace: 'adapters:m04', meta: m, dispatchAuthorized, clock });
  const outcome = (a, status) => result(m, status, a, { providerRequestId: ref('M04', a),
    receipt: receipt(m, a, clock, { status, network, recipient: a.recipient, money: a.money, accountId, transactionId: ref('tx', a),
      fees: [{ kind: 'gas', status: 'known', money: { network, asset: 'near', decimals: 24, amount: '0' }, simulated: true }] }),
    cost: { status: 'actual', actualCostNanoUsd: '0', simulated: true } });
  async function execute({ action, decision, facts } = {}, kind) {
    if (!moneyValid(action?.money) || (action.network ?? action.money.network) !== network || action.money.network !== network || !action.recipient ||
      (kind === 'call' && (!action.methodName || !action.args))) return result(m, 'not_submitted', action, { code: 'INVALID_INPUT' });
    return runtime.execute({ action, decision, facts, payload: { kind, action }, send: () => {
      const s = scenarioFor(scenarios, action);
      if (s.lostResponse) throw new Error('Simulated lost response after acceptance');
      return outcome(action, s.status ?? 'confirmed');
    } });
  }
  return { capabilities: () => structuredClone(m), identity: async () => ({ ...m, status: 'confirmed' }),
    balance: async () => ({ ...m, status: 'confirmed', observation: structuredClone(options.fixtureBalance ?? null) }),
    transfer: c => execute(c, 'transfer'), call: c => execute(c, 'call'),
    reconcile: ({ action }) => runtime.reconcile(action, () => { const s = scenarioFor(scenarios, action); return outcome(action, s.reconcileStatus ?? s.status ?? 'confirmed'); }) };
}

export function createFixtureCloudFundingAdapter(options = {}) {
  const { journal, dispatchAuthorized, clock, scenarios } = optionsFor(options);
  const m = meta('M06', 'fixture-cloud-funding', { autonomousPurchaseSupported: true });
  const runtime = createOperationRuntime({ journal, namespace: 'adapters:m06', meta: m, dispatchAuthorized, clock });
  const outcome = (a, status) => result(m, status, a, { providerRequestId: ref('M06', a), receipt: receipt(m, a, clock, {
    status, kind: 'credit_purchase', agentId: a.agentId, creditId: a.creditId ?? ref('credit', a), fundingProvenance: 'agent_funded',
    requestedCreditNanoUsd: a.requiredCreditNanoUsd, purchasedCreditNanoUsd: status === 'confirmed' ? a.requiredCreditNanoUsd : null,
    availableCreditNanoUsd: status === 'confirmed' ? a.requiredCreditNanoUsd : null, cashSpent: a.money ?? null, fundingOperationId: a.id }) });
  return { capabilities: () => structuredClone(m),
    observeCredit({ credit }) { return { schemaVersion: 1, mode: 'fixture', simulated: true, status: 'confirmed', kind: 'credit_observation', credit: structuredClone(credit), autonomousPurchase: false }; },
    async fund({ action, decision, facts } = {}) {
      if (!atomic(action?.requiredCreditNanoUsd) || !action.agentId) return result(m, 'not_submitted', action, { code: 'INVALID_INPUT' });
      return runtime.execute({ action, decision, facts, payload: action, send: () => {
        const s = scenarioFor(scenarios, action); if (s.lostResponse) throw new Error('Simulated lost purchase response');
        return outcome(action, s.status ?? 'confirmed');
      } });
    },
    reconcile: ({ action }) => runtime.reconcile(action, () => { const s = scenarioFor(scenarios, action); return outcome(action, s.reconcileStatus ?? s.status ?? 'confirmed'); }),
  };
}

export function createFixtureInferenceAdapter(options = {}) {
  const { journal, dispatchAuthorized, clock, scenarios, fixtureOutput, fixtureCostNanoUsd = '10000000' } = optionsFor(options);
  const m = meta('M07', 'fixture-cloud-inference', { inferenceSupported: true, autonomousFunding: false });
  const runtime = createOperationRuntime({ journal, namespace: 'adapters:m07', meta: m, dispatchAuthorized, clock });
  function outcome(a, request, s, status) {
    const cost = { status: s.costPending ? 'pending' : 'actual', actualCostNanoUsd: s.costPending ? null : s.actualCostNanoUsd ?? fixtureCostNanoUsd, simulated: true };
    return result(m, status, a, { providerRequestId: ref('M07', a), cost,
      generation: { providerRequestId: ref('M07', a), output: status === 'confirmed' ? fixtureOutput(request) : null,
        finishReason: status === 'confirmed' ? 'stop' : null, usage: s.usage ?? { inputTokens: 100, outputTokens: Math.min(600, request.maxOutputTokens), reasoningTokens: 0, simulated: true }, cost,
        ...(status !== 'confirmed' ? { outputAvailable: false } : {}) }, receipt: receipt(m, a, clock, { status, requestId: ref('M07', a), cost }) });
  }
  return { capabilities: () => structuredClone(m),
    async generate({ action, decision, facts, request, credit } = {}) {
      if (!action?.id || !request || action.requestFingerprint !== digest(request)) return result(m, 'not_submitted', action, { code: 'CONFLICT' });
      if (!Number.isSafeInteger(request.maxInputBytes) || request.maxInputBytes <= 0 ||
        !Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0 || !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0 ||
        !Array.isArray(request.messages) || Buffer.byteLength(JSON.stringify(request.messages)) > request.maxInputBytes ||
        !atomic(request.chargeBound?.maxCostNanoUsd) || action.maxCostNanoUsd !== request.chargeBound.maxCostNanoUsd) return result(m, 'not_submitted', action, { code: 'INVALID_INPUT' });
      if (credit?.status !== 'confirmed' || !atomic(credit.availableNanoUsd)) return result(m, 'not_submitted', action, { code: 'CREDIT_EVIDENCE_REQUIRED' });
      if (typeof fixtureOutput !== 'function') return unsupported(m, action, 'Test output generator is required');
      return runtime.execute({ action, decision, facts, payload: request, send: () => {
        const s = scenarioFor(scenarios, action); if (s.lostResponse) throw new Error('Simulated lost billed response');
        return outcome(action, request, s, s.status ?? 'confirmed');
      } });
    },
    reconcile({ action, request } = {}) {
      if (!request || action?.requestFingerprint !== digest(request)) return result(m, 'not_submitted', action, { code: 'CONFLICT' });
      return runtime.reconcile(action, () => { const s = scenarioFor(scenarios, action); return outcome(action, request, { ...s, costPending: s.reconciledCostPending ?? false }, s.reconcileStatus ?? s.status ?? 'confirmed'); });
    },
  };
}

const assets = [{ network: 'fixture', asset: 'demo-usdc', decimals: 6 }, { network: 'fixture', asset: 'demo-near', decimals: 24 }];
const same = (a, b) => a?.network === b?.network && a?.asset === b?.asset && a?.decimals === b?.decimals;
export function createFixturePaymentsAdapter(options = {}) {
  const { journal, clock, scenarios, supportedAssets = assets, fixtureQuotes = {} } = optionsFor(options);
  const m = meta('M05', 'fixture-intents', { exactOutput: true, testnetSupported: false, networks: ['fixture'] });
  const ns = 'adapters:m05'; const stamp = () => new Date(clock()).toISOString();
  async function quote({ action, offer, sourceAsset, recipient, refundTo, expiresAt = offer?.expiresAt, decision, fixtureInputMoney } = {}) {
    if (!action?.id || !offer?.id || !moneyValid(offer.price) || decision?.status !== 'allow' || recipient !== offer.treasuryAccount || !refundTo) return result(m, 'not_submitted', action, { code: 'INVALID_INPUT' });
    const hash = digest({ action, offer, sourceAsset, recipient, refundTo, expiresAt, fixtureInputMoney });
    const existing = journal.get(ns, offer.id);
    if (existing && existing.fingerprint !== hash) return result(m, 'not_submitted', action, { code: 'CONFLICT' });
    if (Date.parse(expiresAt) <= new Date(clock()).getTime()) return result(m, 'not_submitted', action, { code: 'QUOTE_EXPIRED' });
    if (existing) return result(m, 'confirmed', action, { quote: existing.quote });
    if (!supportedAssets.some(a => same(a, sourceAsset))) return result(m, 'not_submitted', action, { code: 'UNSUPPORTED_ASSET' });
    const requiredInput = fixtureInputMoney ?? fixtureQuotes[sourceAsset.asset] ?? (same(sourceAsset, offer.price) ? offer.price : null);
    if (!moneyValid(requiredInput) || !same(requiredInput, sourceAsset)) return unsupported(m, action, 'Missing test quote fact');
    const q = { schemaVersion: 1, id: offer.id, invoiceId: offer.id, requiredInput, destination: offer.price, recipient, refundTo, expiresAt,
      depositAddress: `fixture-only-do-not-send:${offer.id}`, providerReference: `fixture:quote:${offer.id}`, mode: 'fixture', simulated: true,
      costs: [{ kind: 'conversion', status: 'known', simulated: true, money: { ...requiredInput, amount: '0' } }], issuedAt: stamp() };
    const stored = (await journal.transaction({ actionId: `${ns}:quote:${offer.id}`, fingerprint: hash }, tx => { tx.put(ns, offer.id, { fingerprint: hash, quote: q }); return q; })).result;
    return result(m, 'confirmed', action, { quote: stored });
  }
  async function verifySettlement({ action, quote: q, observation } = {}) {
    const known = q?.id && journal.get(ns, q.id);
    if (!action?.id || !known || digest(known.quote) !== digest(q)) return result(m, 'not_submitted', action, { code: 'CONFLICT' });
    const prior = journal.get(ns + ':settlements', q.id);
    if (prior?.status === 'confirmed' && prior.settlement?.verified) return prior;
    let f = observation ?? scenarios[q.id]?.observation ?? { status: 'pending' };
    if (f.status === 'confirmed') f = { ...q.destination, recipient: q.recipient, finality: 'final', settledAt: stamp(), reference: `fixture:settlement:${q.id}`, ...f };
    const status = ['pending', 'failed', 'unknown', 'confirmed'].includes(f.status) ? f.status : 'unknown';
    let settlement;
    if (status === 'confirmed') {
      const mismatches = ['network', 'asset', 'decimals', 'amount'].filter(k => f[k] !== q.destination[k]);
      if (f.recipient !== q.recipient) mismatches.push('recipient'); if (f.finality !== 'final') mismatches.push('finality');
      if (!Number.isFinite(Date.parse(f.settledAt))) mismatches.push('settledAt');
      settlement = { schemaVersion: 1, id: f.reference, invoiceId: q.invoiceId, verified: !mismatches.length, mismatches,
        money: { network: f.network, asset: f.asset, decimals: f.decimals, amount: f.amount }, recipient: f.recipient,
        settledAt: f.settledAt, withinInvoiceWindow: Date.parse(f.settledAt) <= Date.parse(q.expiresAt), finality: f.finality,
        mode: 'fixture', simulated: true, reference: f.reference, transactionIds: f.transactionIds ?? [] };
    }
    const value = result(m, status, action, { ...(settlement ? { settlement, receipt: settlement } : {}),
      ...(settlement?.mismatches.length ? { code: 'SETTLEMENT_MISMATCH' } : {}),
      evidence: [{ provider: m.provider, reference: f.reference ?? q.providerReference, observedAt: stamp(), mode: 'fixture', simulated: true }] });
    await journal.transaction({ actionId: `${ns}:observation:${q.id}:${digest(value)}`, fingerprint: digest(value) }, tx => { tx.put(ns + ':settlements', q.id, value); return value; });
    return value;
  }
  return { capabilities: () => structuredClone(m), quote, verifySettlement, reconcile: verifySettlement };
}
