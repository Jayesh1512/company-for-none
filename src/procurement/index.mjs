import { capability, createOperationRuntime, realMode, result } from '../custody/adapter-runtime.mjs';
import { fingerprint } from '../contracts.mjs';
import { boundedRequest, sha256 } from './http.mjs';
import { MARKET_ORIGIN, SUPPLIER_KIND, a2aUrl, agentOrigin, getTaskBody, handleValid, messageIdFor, parseCatalog, parseChallenge, parseRpc, sendMessageBody } from './marketplace.mjs';
import { deriveEntitlement, entitlementMatches, storeEntitlement } from './entitlement.mjs';

export { entitlementMatches, deriveEntitlement, hashArtifacts } from './entitlement.mjs';
export { SUPPLIER_KIND } from './marketplace.mjs';

const tag = (code, message) => Object.assign(new Error(message), { code });
const orderFingerprint = ({ handle, task, quote, terms = null }) => fingerprint({ handle, taskHash: sha256(Buffer.from(task, 'utf8')), quote, terms });
export const requestFingerprint = orderFingerprint;

function quoteIntact(q) {
  if (!q || q.kind !== 'supplier_quote' || !handleValid(q.supplier?.handle)) return false;
  // money/recipient/timeout are derived views of the TLS-observed challenge, not signed supplier facts.
  const m = q.money, r = q.row;
  if (!m || !r || m.network !== r.network || m.asset !== r.asset || m.amount !== r.amount || !Number.isInteger(m.decimals) || Object.keys(m).length !== 4 || q.recipient !== r.payTo || q.maxTimeoutSeconds !== r.maxTimeoutSeconds || typeof q.agentCard?.hash !== 'string') return false;
  return q.quoteId === fingerprint({ handle: q.supplier.handle, taskHash: q.taskHash, row: q.row, agentCardHash: q.agentCard.hash });
}

function termsIntact(terms, handle) {
  if (terms == null) return true;
  try {
    const u = new URL(terms.url);
    return Object.keys(terms).length === 2 && /^[0-9a-f]{64}$/.test(terms.sha256) && !u.username && !u.password && !u.hash
      && [MARKET_ORIGIN, agentOrigin(handle)].includes(u.origin);
  } catch { return false; }
}

// Codec/binding check only. Cryptographic delegate verification belongs to the independently reviewed payer port.
function paymentEnvelopeIntact(header, row) {
  if (typeof header !== 'string' || !header || header.length > 65536) return false;
  try {
    const bytes = Buffer.from(header, 'base64');
    if (bytes.toString('base64') !== header) return false;
    const envelope = JSON.parse(bytes.toString('utf8'));
    return envelope?.x402Version === 2 && envelope.accepted && fingerprint(envelope.accepted) === fingerprint(row)
      && envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload);
  } catch { return false; }
}

/**
 * Real supplier-order adapter for the NEAR Agents Marketplace (x402 over A2A).
 * Ports: transport (fetch-like), signPayment({row,quote,action}) -> {header} (payer wallet; this module never signs),
 * settlementAsset {network,asset,decimals} pinned by M01/config, dispatchAuthorized (final Rules gate), journal.
 * Quotes/discovery/GetTask are free reads. The only paid effect is the single gated SendMessage with X-PAYMENT.
 */
export function createSupplierProcurementAdapter(options = {}) {
  const mode = realMode(options.mode);
  const { journal, transport = fetch, signPayment, settlementAsset, dispatchAuthorized, clock = () => new Date(), timeoutMs = 20000 } = options;
  const meta = capability('PROCUREMENT', mode, SUPPLIER_KIND, { supplier: SUPPLIER_KIND, configured: false, verified: false, evidenceLevel: 'unavailable',
    delivers: 'work_product', licenseSupported: false, settlementProof: 'none', supplierResponseEvidence: 'provider_tls_only', paymentVerification: 'envelope_binding_only',
    missingAccess: ['Payer wallet signing port (x402 X-PAYMENT)', 'Pinned settlement asset', 'Exact M01 supplier-order plan', 'Independent settlement evidence'] });
  const rt = createOperationRuntime({ journal, namespace: 'supplier', meta, dispatchAuthorized, clock });
  // Only fresh provider reads in this process admit an import. Stored success fields or self-hashes cannot do so.
  const observedDeliveries = new Map();
  function requestIntact(action, request) {
    const q = request?.quote;
    return !!action?.id && action.type === 'supplier_order' && action.mode === mode && handleValid(request?.handle)
      && typeof request.task === 'string' && quoteIntact(q) && q.supplier.kind === SUPPLIER_KIND && q.supplier.handle === request.handle
      && q.taskHash === sha256(Buffer.from(request.task, 'utf8')) && termsIntact(request.terms, request.handle)
      && q.money.network === settlementAsset?.network && q.money.asset === settlementAsset?.asset && q.money.decimals === settlementAsset?.decimals;
  }
  function actionBound(action, request) {
    return action.requestFingerprint === orderFingerprint(request) && action.supplier?.handle === request.handle && action.supplier?.kind === SUPPLIER_KIND
      && fingerprint(action.money) === fingerprint(request.quote.money) && action.recipient === request.quote.recipient;
  }
  const unavailable = () => mode === 'unavailable';
  const blocked = (code, fields = {}, action = null) => result(meta, 'not_submitted', action, { code, ...fields });
  const get = (url, max) => boundedRequest({ transport, url, timeoutMs, maxBytes: max, headers: { accept: 'application/json' } });

  async function discover({ query = '', category = null, limit = 20 } = {}) {
    if (unavailable()) return blocked('PROVIDER_MODE_UNAVAILABLE');
    const qs = new URLSearchParams({ ...(query ? { q: String(query).slice(0, 200) } : {}), ...(category ? { category: String(category).slice(0, 64) } : {}), limit: String(Math.min(Math.max(Number(limit) | 0, 1), 50)) });
    try {
      const res = await get(`${MARKET_ORIGIN}/v1/agents?${qs}`, 2 * 1024 * 1024);
      if (!res.ok) return result(meta, 'failed', null, { code: 'SUPPLIER_READ_FAILED', kind: 'supplier_catalog' });
      return result(meta, 'confirmed', null, { kind: 'supplier_catalog', agents: parseCatalog(res.json()), observedAt: new Date(clock()).toISOString(), raw: { bodyHash: res.bodyHash }, grantsSpendingAuthority: false });
    } catch (e) { return result(meta, 'failed', null, { code: e.code && /^[A-Z_]+$/.test(e.code) ? e.code : 'SUPPLIER_READ_FAILED', kind: 'supplier_catalog' }); }
  }

  // Free: an unpaid SendMessage is answered with HTTP 402 and creates no task.
  async function quoteRaw({ handle, task }) {
    if (!handleValid(handle) || typeof task !== 'string' || !task.trim()) throw tag('INVALID_INPUT', 'Supplier handle and task are required.');
    if (!settlementAsset?.network || !settlementAsset.asset || !Number.isInteger(settlementAsset.decimals)) throw tag('SETTLEMENT_ASSET_REQUIRED', 'Pin the settlement network, asset and decimals first.');
    const challenge = await boundedRequest({ transport, url: a2aUrl(handle), method: 'POST', timeoutMs, headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: sendMessageBody({ task, messageId: messageIdFor(sha256(Buffer.from(task, 'utf8'))) }) });
    if (challenge.status !== 402) throw tag(challenge.status === 200 ? 'SUPPLIER_UNAVAILABLE' : 'SUPPLIER_QUOTE_FAILED', 'The supplier did not return a payment challenge.');
    const rows = parseChallenge(challenge.json()).filter(r => r.network === settlementAsset.network && r.asset === settlementAsset.asset);
    if (rows.length !== 1) throw tag('SETTLEMENT_ASSET_MISMATCH', 'No single payment row in the pinned network and asset.');
    const [row] = rows;
    // payTo/asset must also appear in the platform's own recipient list; never trust a challenge alone.
    const known = await get(`${MARKET_ORIGIN}/.well-known/x402`, 64 * 1024);
    const recipients = known.ok ? known.json()?.recipients : null;
    if (!Array.isArray(recipients) || !recipients.some(r => r?.network === row.network && r.asset === row.asset && r.payTo === row.payTo)) throw tag('QUOTE_RECIPIENT_MISMATCH', 'Challenge recipient is not in the supplier platform recipient list.');
    const card = await get(`${agentOrigin(handle)}/.well-known/agent-card.json`, 256 * 1024);
    const cardJson = card.ok ? card.json() : null;
    if (!cardJson || typeof cardJson !== 'object') throw tag('SUPPLIER_CARD_UNAVAILABLE', 'The supplier agent card is required to bind a supplier version.');
    const taskHash = sha256(Buffer.from(task, 'utf8'));
    const agentCard = { version: typeof cardJson.version === 'string' ? cardJson.version.slice(0, 64) : null, hash: card.bodyHash };
    return { schemaVersion: 1, kind: 'supplier_quote', quoteId: fingerprint({ handle, taskHash, row, agentCardHash: agentCard.hash }), supplier: { kind: SUPPLIER_KIND, handle }, taskHash, row,
      money: { network: row.network, asset: row.asset, decimals: settlementAsset.decimals, amount: row.amount }, recipient: row.payTo, maxTimeoutSeconds: row.maxTimeoutSeconds, agentCard,
      observedAt: new Date(clock()).toISOString() };
  }
  async function quote(input) {
    if (unavailable()) return blocked('PROVIDER_MODE_UNAVAILABLE', { kind: 'supplier_quote' });
    try { return result(meta, 'confirmed', null, { kind: 'supplier_quote', quote: await quoteRaw(input), grantsSpendingAuthority: false }); }
    catch (e) { return blocked(e.code && /^[A-Z_]+$/.test(e.code) ? e.code : 'SUPPLIER_QUOTE_FAILED', { kind: 'supplier_quote' }); }
  }

  const base = (action, request, extra = {}) => ({ actionId: action.id, supplier: { kind: SUPPLIER_KIND, handle: request.handle }, quoteId: request.quote.quoteId, taskHash: request.quote.taskHash,
    supplierVersion: request.quote.agentCard.version, supplierCardHash: request.quote.agentCard.hash, ...extra });
  const settlement = { independentlyVerified: false, supplierClaim: 'settles_on_delivery_only' };

  // Maps a supplier task to an operation result. Only a completed, hashable, order-bound delivery becomes confirmed.
  async function fromTask(action, request, order, task) {
    if (order.taskId && order.taskId !== task.id || order.contextId && order.contextId !== task.contextId)
      return result(meta, 'unknown', action, { code: 'ORDER_MISMATCH', order, settlement });
    const common = { order: { ...order, taskId: task.id, contextId: task.contextId, state: task.state }, settlement, payment: { money: request.quote.money, signedHeaderHash: order.paymentHeaderHash } };
    if (['TASK_STATE_REJECTED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED'].includes(task.state)) return result(meta, 'failed', action, { code: 'SUPPLIER_TASK_' + task.state.slice(11), ...common, charged: 'not_charged_per_supplier_terms_unverified' });
    if (task.state !== 'TASK_STATE_COMPLETED') return result(meta, 'pending', action, { code: 'SUPPLIER_WORKING', ...common });
    let terms = null, termsStatus = 'not_pinned';
    if (request.terms) {
      termsStatus = 'unavailable';
      try {
        const res = await get(request.terms.url, 1024 * 1024);
        if (res.ok) { termsStatus = res.bodyHash === request.terms.sha256 ? 'verified' : 'mismatch'; if (termsStatus === 'verified') terms = { url: request.terms.url, sha256: res.bodyHash }; }
      } catch { /* stays unavailable; retried by reconcile */ }
      if (termsStatus !== 'verified') return result(meta, 'pending', action, { code: termsStatus === 'mismatch' ? 'TERMS_MISMATCH' : 'TERMS_UNVERIFIED', termsStatus, ...common });
    }
    try {
      const { delivery, entitlement } = deriveEntitlement({ order: common.order, task, terms });
      const previous = rt.read(action)?.result?.entitlement;
      if (previous && fingerprint(previous) !== fingerprint(entitlement)) {
        observedDeliveries.delete(previous.entitlementId);
        return result(meta, 'unknown', action, { code: 'SUPPLIER_DELIVERY_CHANGED', ...common });
      }
      observedDeliveries.set(entitlement.entitlementId, fingerprint(entitlement));
      return result(meta, 'confirmed', action, { code: 'DELIVERED', delivery, entitlement, termsStatus, ...common });
    } catch (e) { return result(meta, 'pending', action, { code: e.code && /^[A-Z_]+$/.test(e.code) ? e.code : 'DELIVERY_UNVERIFIABLE', ...common }); }
  }

  async function execute({ action, decision, facts = {}, request } = {}) {
    if (unavailable()) return blocked('PROVIDER_MODE_UNAVAILABLE', {}, action);
    // Snapshot the admitted bytes before any await so mutation during preparation cannot rebind dispatch.
    request = structuredClone(request); action = structuredClone(action); decision = structuredClone(decision);
    const q = request?.quote;
    if (!requestIntact(action, request)) return blocked('INVALID_INPUT', {}, action);
    if (!actionBound(action, request)) return blocked('CONFLICT', {}, action);
    if (decision?.plan?.kind !== 'supplier_order' || decision.plan.requestFingerprint !== action.requestFingerprint
      || !decision.plan.request || fingerprint(decision.plan.request) !== fingerprint(request)) return blocked('EXACT_PLAN_REQUIRED', {}, action);
    if (typeof signPayment !== 'function') return blocked('PROVIDER_UNAVAILABLE', { reason: 'No payer signing port' }, action);
    let failure = null;
    const outcome = await rt.execute({ action, decision, facts, payload: { handle: request.handle, taskHash: q.taskHash, quoteId: q.quoteId, terms: request.terms ?? null },
      async prepare() {
        try {
          // Price/recipient/version drift between quote and order is a refusal, never a silent re-sign.
          const fresh = await quoteRaw({ handle: request.handle, task: request.task });
          if (fresh.quoteId !== q.quoteId || fingerprint(fresh.agentCard) !== fingerprint(q.agentCard)) throw tag('QUOTE_CHANGED', 'The supplier quote changed since it was bound.');
          const signed = await signPayment({ row: structuredClone(q.row), quote: structuredClone(q), action: structuredClone(action) });
          if (!paymentEnvelopeIntact(signed?.header, q.row)) throw tag('PAYMENT_ENVELOPE_MISMATCH', 'The payer envelope does not bind the exact supplier challenge.');
          return signed;
        } catch (e) { failure = e.code && /^[A-Z_]+$/.test(e.code) ? e.code : 'PROVIDER_UNAVAILABLE'; throw e; }
      },
      send(signed) {
        const headerHash = sha256(Buffer.from(signed.header, 'utf8'));
        const order = base(action, request, { paymentHeaderHash: headerHash, sentAt: new Date(clock()).toISOString() });
        return boundedRequest({ transport, url: a2aUrl(request.handle), method: 'POST', timeoutMs, maxBytes: 2 * 1024 * 1024,
          headers: { 'content-type': 'application/json', accept: 'application/json', 'x-payment': signed.header },
          body: sendMessageBody({ task: request.task, messageId: messageIdFor(action.id), returnImmediately: true }) })
          .then(async res => {
            // 402: supplier refused the payment; nothing settles. Any other non-200 may have been processed: stay unknown.
            if (res.status === 402) return result(meta, 'failed', action, { code: 'SUPPLIER_PAYMENT_REJECTED', order, settlement, charged: 'not_charged_per_supplier_terms_unverified' });
            if (res.status !== 200) return result(meta, 'unknown', action, { code: 'UNKNOWN_OUTCOME', httpStatus: res.status, order, settlement });
            let rpc; try { rpc = parseRpc(res, { sync: true }); } catch { return result(meta, 'unknown', action, { code: 'UNKNOWN_OUTCOME', order, settlement }); }
            if (rpc.error) return result(meta, 'unknown', action, { code: 'SUPPLIER_RPC_ERROR', rpcCode: rpc.error.code, order, settlement });
            return fromTask(action, request, order, rpc.task);
          });
      } });
    return outcome.code === 'PROVIDER_UNAVAILABLE' && failure ? { ...outcome, code: failure } : outcome;
  }

  // Free: GetTask on the ORIGINAL task id. Never sends another payment or SendMessage.
  async function reconcile({ action, request } = {}) {
    if (unavailable()) return blocked('PROVIDER_MODE_UNAVAILABLE', {}, action);
    request = structuredClone(request); action = structuredClone(action);
    if (!requestIntact(action, request)) return blocked('INVALID_INPUT', {}, action);
    if (!actionBound(action, request)) return blocked('CONFLICT', {}, action);
    const op = rt.read(action);
    if (!op) return blocked('OPERATION_NOT_FOUND', {}, action);
    if (op.mode !== mode || op.provider !== meta.provider) return blocked('PROVIDER_MODE_MISMATCH', {}, action);
    if (op.actionFingerprint !== fingerprint(action)) return blocked('CONFLICT', {}, action);
    if (op.result?.entitlement) observedDeliveries.delete(op.result.entitlement.entitlementId);
    try {
      const prior = op.result;
      const taskId = prior?.order?.taskId;
      if (!taskId) return result(meta, 'unknown', action, { code: 'TASK_ID_UNKNOWN', order: prior?.order ?? null, settlement });
      const res = await boundedRequest({ transport, url: a2aUrl(request.handle), method: 'POST', timeoutMs, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: getTaskBody(taskId) });
      if (!res.ok) return result(meta, 'unknown', action, { code: 'DELIVERY_READ_UNAVAILABLE', order: prior?.order ?? null, settlement });
      const rpc = parseRpc(res, { sync: false });
      if (rpc.error || rpc.task.id !== taskId) return result(meta, 'unknown', action, { code: rpc.error ? 'SUPPLIER_RPC_ERROR' : 'ORDER_MISMATCH', order: prior.order, settlement });
      const outcome = await fromTask(action, request, prior.order, rpc.task);
      // Never overwrite an accepted delivery on conflicting fresh facts. Import still requires a fresh matching read.
      if (outcome.code === 'SUPPLIER_DELIVERY_CHANGED' || outcome.code === 'ORDER_MISMATCH') return outcome;
      return rt.save(action, outcome);
    } catch { return result(meta, 'unknown', action, { code: 'DELIVERY_READ_UNAVAILABLE', order: op.result?.order ?? null, settlement }); }
  }

  async function importEntitlement(entitlement) {
    const digest = fingerprint(entitlement);
    if (observedDeliveries.get(entitlement?.entitlementId) !== digest) throw tag('DELIVERY_EVIDENCE_REQUIRED', 'A fresh matching provider delivery read is required before import.');
    const op = journal?.getOperation(`supplier:${entitlement.orderActionId}`);
    if (!op || fingerprint(op.result?.entitlement ?? null) !== digest) throw tag('DELIVERY_EVIDENCE_REQUIRED', 'The original supplier operation does not contain this delivery.');
    return storeEntitlement(journal, entitlement);
  }
  return { capabilities: () => structuredClone(meta), discover, quote, execute, reconcile, entitlementMatches, importEntitlement };
}
