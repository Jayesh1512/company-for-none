import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupplierProcurementAdapter, requestFingerprint, entitlementMatches, deriveEntitlement, SUPPLIER_KIND } from '../../src/procurement/index.mjs';
import { fingerprint } from '../../src/contracts.mjs';
import { clock, decision, gate, journalFor, json, recorder } from './helpers.mjs';

const ASSET = { network: 'near:mainnet', asset: 'usdc.contract', decimals: 6 };
const ROW = { scheme: 'exact', network: 'near:mainnet', asset: 'usdc.contract', amount: '2500000', payTo: 'treasury.hex', maxTimeoutSeconds: 4200 };
const TASK = 'Title\nWrite a persona skill for support triage.';
const TERMS = 'job terms v1';
const syntheticHeader = (row, nonce = 1) => Buffer.from(JSON.stringify({ x402Version: 2, accepted: row, payload: { syntheticOnly: true, nonce } })).toString('base64');
const artifact = text => ({ artifactId: 'a1', name: 'answer', parts: [{ text }] });
const task = (state, over = {}) => ({ id: 'task-1', contextId: 'hire-1', status: { state, timestamp: '2026-11-14T12:00:05Z' }, ...over });

// A scripted supplier. `s` mutates between calls to script behaviour.
function supplier(s = {}) {
  const r = recorder(call => {
    s.seen?.(call);
    const u = call.url;
    if (u.endsWith('/.well-known/x402')) return json({ x402Version: 2, recipients: s.recipients ?? [{ network: ROW.network, asset: ROW.asset, payTo: ROW.payTo }] });
    if (u.endsWith('/.well-known/agent-card.json')) return json({ name: 'agent', version: s.version ?? '1.2.0' });
    if (u.endsWith('/job-terms')) return new Response(s.terms ?? TERMS);
    if (u.includes('/v1/agents')) return json({ agents: [{ id: 'id1', handle: 'triage-bot', name: 'Triage', available_now: true, sla_seconds: 30, delivered_jobs: 4 }, { handle: 'BAD HANDLE' }] });
    const body = call.body ? JSON.parse(call.body) : null;
    if (u.endsWith('/a2a/v1') && body?.method === 'SendMessage') {
      if (!call.headers['x-payment']) return json({ x402Version: 2, accepts: [s.row ?? ROW] }, 402);
      if (s.lose) throw new Error('connection reset');
      return s.sendResponse ? s.sendResponse(call) : json({ jsonrpc: '2.0', id: 1, result: { task: task(s.state ?? 'TASK_STATE_SUBMITTED', s.taskOver) } });
    }
    if (body?.method === 'GetTask') return s.getTask ? s.getTask(body) : json({ jsonrpc: '2.0', id: 2, result: task(s.state ?? 'TASK_STATE_SUBMITTED', s.taskOver) });
    return json({}, 404);
  });
  return r;
}
async function setup(t, s = {}, opts = {}) {
  const journal = await journalFor(t); const sup = supplier(s); let signed = 0, dispatches = 0;
  const adapter = createSupplierProcurementAdapter({ mode: 'live', journal, clock, transport: sup.transport, settlementAsset: ASSET,
    signPayment: async ({ row }) => { signed++; return { header: syntheticHeader(row, signed) }; }, dispatchAuthorized: (c, cb) => { dispatches++; return gate(c, cb); }, ...opts });
  const quote = (await adapter.quote({ handle: 'triage-bot', task: TASK })).quote;
  const request = { handle: 'triage-bot', task: TASK, quote, ...(s.pinTerms ? { terms: { url: 'https://market.near.ai/job-terms', sha256: s.pinTerms } } : {}) };
  const action = id => ({ id, type: 'supplier_order', mode: 'live', supplier: { kind: SUPPLIER_KIND, handle: 'triage-bot' }, money: quote.money, recipient: quote.recipient, requestFingerprint: requestFingerprint(request) });
  return { journal, sup, adapter, quote, request, action, counts: () => ({ signed, dispatches }),
    run: (a, over = {}) => adapter.execute({ action: a, decision: { ...decision(a), plan: { kind: 'supplier_order', requestFingerprint: a.requestFingerprint, request } }, request, ...over }),
    paid: () => sup.calls.filter(c => c.headers['x-payment']) };
}

test('discovery and quote are free reads; the quote binds exact row, recipient, pinned asset and supplier version', async t => {
  const { adapter, quote, sup } = await setup(t);
  assert.deepEqual(quote.money, { network: 'near:mainnet', asset: 'usdc.contract', decimals: 6, amount: '2500000' });
  assert.equal(quote.recipient, 'treasury.hex'); assert.equal(quote.agentCard.version, '1.2.0'); assert.equal(sup.calls.some(c => c.headers['x-payment']), false);
  const found = await adapter.discover({ query: 'triage' });
  assert.deepEqual(found.agents.map(a => a.handle), ['triage-bot']); assert.equal(found.agents[0].claim, true); assert.equal(found.grantsSpendingAuthority, false);
});

test('quote refuses recipient substitution, wrong asset and an unpinned settlement asset', async t => {
  const a = await setup(t, { recipients: [{ network: ROW.network, asset: ROW.asset, payTo: 'someone-else' }] }, {});
  // setup's own quote already failed, so quote is undefined; query again explicitly
  assert.equal((await a.adapter.quote({ handle: 'triage-bot', task: TASK })).code, 'QUOTE_RECIPIENT_MISMATCH');
  const b = await setup(t, { row: { ...ROW, asset: 'other.token' } });
  assert.equal((await b.adapter.quote({ handle: 'triage-bot', task: TASK })).code, 'SETTLEMENT_ASSET_MISMATCH');
  const c = await setup(t, {}, { settlementAsset: undefined });
  assert.equal((await c.adapter.quote({ handle: 'triage-bot', task: TASK })).code, 'SETTLEMENT_ASSET_REQUIRED');
});

test('a bare payment acceptance is not delivery: submitted/working task yields pending and no entitlement', async t => {
  const { run, action, journal } = await setup(t);
  const r = await run(action('o1'));
  assert.equal(r.status, 'pending'); assert.equal(r.entitlement, undefined); assert.equal(r.settlement.independentlyVerified, false);
  assert.equal(r.order.taskId, 'task-1'); assert.equal(journal.list('supplierEntitlements').length, 0);
  assert.throws(() => deriveEntitlement({ order: r.order, task: { id: 'task-1', contextId: 'hire-1', state: 'TASK_STATE_SUBMITTED', artifacts: [] } }), /not completed/);
});

test('completed without hashable content (empty or url-only) is not an entitlement', async t => {
  for (const [i, artifacts] of [[1, []], [2, [{ artifactId: 'u', parts: [{ url: 'https://files.example/x' }] }]], [3, [artifact('')]]]) {
    const { run, action } = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts } });
    const r = await run(action('empty' + i));
    assert.equal(r.status, 'pending'); assert.equal(r.code, 'DELIVERY_UNVERIFIABLE'); assert.equal(r.entitlement, undefined);
  }
});

test('verified delivery yields a work-product entitlement bound to order, quote, task, supplier version and content; never a license', async t => {
  const { run, action, quote, counts, paid } = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts: [artifact('# Persona\nbody')] } });
  const a = action('o2'); const r = await run(a);
  assert.equal(r.status, 'confirmed'); const e = r.entitlement;
  assert.equal(e.licenseGranted, false); assert.equal(e.scope, 'received_work_product'); assert.equal(e.useRightsStatus, 'unverified'); assert.equal(e.grantsSpendingAuthority, false);
  assert.equal(e.orderActionId, 'o2'); assert.equal(e.quoteId, quote.quoteId); assert.equal(e.taskId, 'task-1'); assert.equal(e.supplierVersion, '1.2.0');
  assert.equal(r.settlement.independentlyVerified, false); assert.equal(r.payment.money.amount, '2500000');
  assert.equal(entitlementMatches(e, { orderActionId: 'o2', quoteId: quote.quoteId, taskId: 'task-1', handle: 'triage-bot', supplierVersion: '1.2.0' }).ok, true);
  assert.deepEqual(counts(), { signed: 1, dispatches: 1 }); assert.equal(paid().length, 1);
  assert.equal(JSON.stringify(r).includes('x-payment-1'), false); // only the header hash is recorded
});

test('mismatched entitlements are rejected (other order, supplier, task, content, version, tampering)', async t => {
  const { run, action } = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts: [artifact('payload')] } });
  const e = (await run(action('o3'))).entitlement;
  for (const [expected, reason] of [[{ orderActionId: 'other' }, 'ORDERACTIONID'], [{ handle: 'evil-bot' }, 'HANDLE'], [{ taskId: 't2' }, 'TASKID'], [{ artifactsHash: 'f'.repeat(64) }, 'ARTIFACTSHASH'], [{ quoteId: 'q2' }, 'QUOTEID'], [{ supplierVersion: '9.9.9' }, 'SUPPLIER_VERSION']]) {
    const m = entitlementMatches(e, expected); assert.equal(m.ok, false); assert.ok(m.reasons.includes(reason), reason);
  }
  assert.ok(entitlementMatches({ ...e, artifactsHash: 'f'.repeat(64) }, {}).reasons.includes('ENTITLEMENT_ID'));
  assert.ok(entitlementMatches({ ...e, licenseGranted: true }, {}).reasons.includes('SHAPE'));
  assert.throws(() => deriveEntitlement({ order: { ...{ taskId: 'x' }, supplier: {}, actionId: 'a' }, task: { id: 'task-1', state: 'TASK_STATE_COMPLETED', artifacts: [artifact('p')] } }), /differs from the paid order/);
});

test('duplicate imports: replay is a no-op, a second entitlement for the same task or order is refused', async t => {
  const { run, action, adapter, journal } = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts: [artifact('one')] } });
  const e = (await run(action('o4'))).entitlement;
  await adapter.importEntitlement(e); assert.equal((await adapter.importEntitlement(e)).replayed, true);
  assert.equal(journal.list('supplierEntitlements').length, 1);
  const { entitlementId, ...body } = e; const other = { ...body, artifactsHash: 'a'.repeat(64) }; other.entitlementId = `entitlement:${fingerprint(other)}`;
  await assert.rejects(adapter.importEntitlement(other), /fresh matching/);
  const sameOrder = { ...body, taskId: 'task-2' }; sameOrder.entitlementId = `entitlement:${fingerprint(sameOrder)}`;
  await assert.rejects(adapter.importEntitlement(sameOrder), /fresh matching/);
  await assert.rejects(adapter.importEntitlement({ ...e, taskId: 'tampered' }), /fresh matching/);
});

test('unknown outcome is kept; repeating the order or reconciling never sends another payment', async t => {
  const s = { lose: true }; const { run, action, adapter, request, paid, counts, sup } = await setup(t, s);
  const a = action('o5'); const first = await run(a);
  assert.equal(first.status, 'unknown'); assert.equal(paid().length, 1);
  assert.equal((await run(a)).status, 'unknown'); assert.equal(paid().length, 1); assert.equal(counts().signed, 1);
  const rec = await adapter.reconcile({ action: a, request });
  assert.equal(rec.code, 'TASK_ID_UNKNOWN'); assert.equal(rec.status, 'unknown');
  assert.equal(sup.calls.filter(c => c.body && JSON.parse(c.body).method === 'GetTask').length, 0);
  assert.equal(paid().length, 1);
  // a different supplier message/payment for the same identity is a conflict
  assert.equal((await adapter.execute({ action: { ...a, requestFingerprint: 'x' }, decision: decision({ ...a, requestFingerprint: 'x' }), request })).code, 'CONFLICT');
});

test('reconcile uses free GetTask on the original task id and then yields the entitlement; delivery is immutable afterwards', async t => {
  const s = { state: 'TASK_STATE_WORKING' }; const { run, action, adapter, request, paid, sup } = await setup(t, s);
  const a = action('o6'); assert.equal((await run(a)).status, 'pending');
  s.state = 'TASK_STATE_COMPLETED'; s.taskOver = { artifacts: [artifact('final')] };
  const done = await adapter.reconcile({ action: a, request });
  assert.equal(done.status, 'confirmed'); assert.equal(done.entitlement.taskId, 'task-1');
  assert.equal(paid().length, 1); assert.equal(sup.calls.some(c => c.body && JSON.parse(c.body).method === 'GetTask' && c.headers['x-payment']), false);
  s.taskOver = { artifacts: [artifact('CHANGED')] };
  assert.equal((await adapter.reconcile({ action: a, request })).code, 'SUPPLIER_DELIVERY_CHANGED');
  await assert.rejects(adapter.importEntitlement(done.entitlement), /fresh matching/);
});

test('GetTask for another task id is a mismatch, not a delivery', async t => {
  const s = { state: 'TASK_STATE_WORKING' }; const { run, action, adapter, request } = await setup(t, s);
  const a = action('o7'); await run(a);
  s.state = 'TASK_STATE_COMPLETED'; s.getTask = () => json({ jsonrpc: '2.0', id: 2, result: task('TASK_STATE_COMPLETED', { id: 'task-OTHER', artifacts: [artifact('x')] }) });
  const r = await adapter.reconcile({ action: a, request });
  assert.equal(r.status, 'unknown'); assert.equal(r.code, 'ORDER_MISMATCH'); assert.equal(r.entitlement, undefined);
});

test('supplier terminal failure and payment rejection are failed, with supplier-claimed no charge left unverified', async t => {
  const failed = await setup(t, { state: 'TASK_STATE_FAILED' });
  const r = await failed.run(failed.action('o8')); assert.equal(r.status, 'failed'); assert.equal(r.charged, 'not_charged_per_supplier_terms_unverified'); assert.equal(r.settlement.independentlyVerified, false);
  const rejected = await setup(t, { sendResponse: () => json({ error: 'bad payment' }, 402) });
  assert.equal((await rejected.run(rejected.action('o9'))).code, 'SUPPLIER_PAYMENT_REJECTED');
  const server = await setup(t, { sendResponse: () => json({ error: 'x' }, 502) });
  const u = await server.run(server.action('o10')); assert.equal(u.status, 'unknown');
  assert.equal((await server.run(server.action('o10'))).status, 'unknown'); assert.equal(server.paid().length, 1);
});

test('M01 denial, action drift, price drift and missing signer send nothing paid', async t => {
  const a1 = await setup(t); const d = a1.action('o11');
  assert.equal((await a1.run(d, { decision: { ...decision(d), status: 'deny' } })).status, 'not_submitted'); assert.equal(a1.counts().signed, 0);
  assert.equal((await a1.run({ ...d, recipient: 'attacker' })).code, 'CONFLICT');
  assert.equal((await a1.run({ ...d, money: { ...d.money, amount: '1' } })).code, 'CONFLICT');
  assert.equal((await a1.run({ ...d, type: 'payout' })).code, 'INVALID_INPUT');
  assert.equal(a1.paid().length, 0);
  const s = {}; const a2 = await setup(t, s); s.row = { ...ROW, amount: '9999999' };
  const drift = await a2.run(a2.action('o12')); assert.equal(drift.status, 'not_submitted'); assert.equal(drift.code, 'QUOTE_CHANGED'); assert.equal(a2.paid().length, 0); assert.equal(a2.counts().signed, 0);
  const a3 = await setup(t, {}, { signPayment: undefined });
  assert.equal((await a3.run(a3.action('o13'))).code, 'PROVIDER_UNAVAILABLE'); assert.equal(a3.paid().length, 0);
  const forged = await setup(t); const fq = { ...forged.request, quote: { ...forged.quote, money: { ...forged.quote.money, amount: '1' } } };
  const fa = { ...forged.action('o14'), money: fq.quote.money };
  assert.equal((await forged.run(fa, { request: fq })).code, 'INVALID_INPUT'); // consistent forgery of the derived view still fails
  assert.equal(forged.paid().length, 0);
});

test('pinned job terms: a hash mismatch withholds the entitlement; a matching hash is bound into it', async t => {
  const { createHash } = await import('node:crypto'); const good = createHash('sha256').update(TERMS).digest('hex');
  const m = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts: [artifact('p')] }, pinTerms: 'b'.repeat(64) });
  const bad = await m.run(m.action('o15')); assert.equal(bad.status, 'pending'); assert.equal(bad.code, 'TERMS_MISMATCH'); assert.equal(bad.entitlement, undefined);
  const ok = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts: [artifact('p')] }, pinTerms: good });
  const r = await ok.run(ok.action('o16')); assert.equal(r.status, 'confirmed'); assert.equal(r.entitlement.terms.sha256, good);
});

test('real factory is unavailable in fixture/default mode and sends nothing', async t => {
  const off = recorder(() => json({}));
  for (const mode of ['fixture', undefined]) {
    const a = createSupplierProcurementAdapter({ mode, transport: off.transport, settlementAsset: ASSET, signPayment: () => { throw new Error('no'); } });
    assert.equal(a.capabilities().mode, 'unavailable'); assert.equal(a.capabilities().licenseSupported, false);
    assert.equal((await a.discover()).code, 'PROVIDER_MODE_UNAVAILABLE'); assert.equal((await a.quote({ handle: 'x', task: 't' })).code, 'PROVIDER_MODE_UNAVAILABLE');
    assert.equal((await a.execute({ action: { id: 'n' } })).status, 'not_submitted');
  }
  assert.equal(off.calls.length, 0);
});

test('no signing without an exact admitted request; final gate still stops dispatch', async t => {
  const h = await setup(t); const a = h.action('exact');
  assert.equal((await h.run(a, { decision: decision(a) })).code, 'EXACT_PLAN_REQUIRED');
  const changed = { ...h.request, terms: { url: 'https://market.near.ai/job-terms', sha256: 'a'.repeat(64) } };
  assert.equal((await h.run(a, { decision: { ...decision(a), plan: { kind: 'supplier_order', requestFingerprint: a.requestFingerprint, request: changed } } })).code, 'EXACT_PLAN_REQUIRED');
  assert.equal(h.counts().signed, 0);
  const killed = await setup(t, {}, { dispatchAuthorized: () => ({ status: 'deny', reasonCode: 'KILLED' }) });
  assert.equal((await killed.run(killed.action('kill'))).code, 'KILLED'); assert.equal(killed.paid().length, 0);
});

test('reconcile rejects changed request, terms or supplier before any provider read', async t => {
  const s = { state: 'TASK_STATE_WORKING' }; const h = await setup(t, s); const a = h.action('rebind'); await h.run(a);
  const before = h.sup.calls.length;
  for (const request of [{ ...h.request, terms: { url: 'https://market.near.ai/job-terms', sha256: 'a'.repeat(64) } }, { ...h.request, handle: 'other-bot' }, { ...h.request, task: 'different task' }]) {
    const r = await h.adapter.reconcile({ action: a, request }); assert.equal(r.status, 'not_submitted');
  }
  assert.equal(h.sup.calls.length, before); assert.equal(h.paid().length, 1);
});

test('forged decimals or agent-card version and arbitrary terms origins never authorize a payment', async t => {
  const h = await setup(t);
  const q = { ...h.quote, money: { ...h.quote.money, decimals: 9 } };
  const r = { ...h.request, quote: q }; const a = { ...h.action('decimals'), money: q.money, requestFingerprint: requestFingerprint(r) };
  assert.equal((await h.run(a, { request: r })).code, 'INVALID_INPUT');
  const qv = { ...h.quote, agentCard: { ...h.quote.agentCard, version: 'forged' } };
  const rv = { ...h.request, quote: qv };
  const av = { ...h.action('version'), requestFingerprint: requestFingerprint(rv) };
  assert.equal((await h.run(av, { request: rv, decision: { ...decision(av), plan: { kind: 'supplier_order', requestFingerprint: requestFingerprint(rv), request: rv } } })).code, 'QUOTE_CHANGED');
  for (const url of ['https://127.0.0.1/terms', 'https://evil.example/terms', 'https://user:password@market.near.ai/terms', 'https://market.near.ai:444/terms']) {
    const request = { ...h.request, terms: { url, sha256: 'a'.repeat(64) } };
    assert.equal((await h.run(h.action('origin'), { request })).code, 'INVALID_INPUT');
  }
  assert.equal(h.counts().signed, 0); assert.equal(h.paid().length, 0);
});

test('matching task id with a changed hire context is not delivery', async t => {
  const s = { state: 'TASK_STATE_WORKING' }; const h = await setup(t, s); const a = h.action('context'); await h.run(a);
  s.state = 'TASK_STATE_COMPLETED'; s.taskOver = { contextId: 'another-hire', artifacts: [artifact('foreign result')] };
  const r = await h.adapter.reconcile({ action: a, request: h.request });
  assert.equal(r.code, 'ORDER_MISMATCH'); assert.equal(r.entitlement, undefined); assert.equal(h.paid().length, 1);
});

test('restart refuses caller-authored/imported proof flags until a fresh matching GetTask, without signing', async t => {
  const h = await setup(t, { state: 'TASK_STATE_COMPLETED', taskOver: { artifacts: [artifact('real response in local stand-in')] } });
  const a = h.action('restart'); const e = (await h.run(a)).entitlement;
  const restarted = createSupplierProcurementAdapter({ mode: 'live', journal: h.journal, clock, transport: h.sup.transport, settlementAsset: ASSET });
  await assert.rejects(restarted.importEntitlement({ ...e, verified: true }), /fresh matching/);
  await assert.rejects(restarted.importEntitlement(e), /fresh matching/);
  const r = await restarted.reconcile({ action: a, request: h.request });
  assert.equal(r.status, 'confirmed'); await restarted.importEntitlement(r.entitlement);
  assert.equal(h.paid().length, 1); assert.equal(h.counts().signed, 1);
});

test('order snapshot prevents mutation during signing from rebinding the paid request', async t => {
  let change;
  const h = await setup(t, {}, { signPayment: async ({ row }) => { change(); return { header: syntheticHeader(row) }; } });
  const a = h.action('mutation'); change = () => { h.request.task = 'changed during preparation'; a.recipient = 'another-payer'; };
  const r = await h.run(a);
  assert.equal(r.status, 'pending'); assert.equal(JSON.parse(h.paid()[0].body).params.message.parts[0].text, TASK);
  assert.equal(r.payment.money.amount, ROW.amount);
});

test('payer envelope with another amount, asset or payee is rejected before transport', async t => {
  for (const patch of [{ amount: '1' }, { asset: 'other-asset' }, { payTo: 'other-payee' }]) {
    const h = await setup(t, {}, { signPayment: async ({ row }) => ({ header: syntheticHeader({ ...row, ...patch }) }) });
    assert.equal((await h.run(h.action('wrong-envelope'))).code, 'PAYMENT_ENVELOPE_MISMATCH'); assert.equal(h.paid().length, 0);
  }
});

test('unknown funding identity stays unsupported and cannot trigger a blind purchase retry', async () => {
  const { createCloudFundingAdapter } = await import('../../src/cloud-funding/index.mjs'); let calls = 0;
  const adapter = createCloudFundingAdapter({ mode: 'live', transport: () => { calls++; throw new Error('forbidden'); } });
  const action = { id: 'original-unknown-funding', type: 'funding', providerOperationId: 'original-provider-id' };
  for (let i = 0; i < 2; i++) {
    assert.equal((await adapter.fund({ action })).code, 'UNSUPPORTED_CAPABILITY');
    assert.equal((await adapter.reconcile({ action })).code, 'UNSUPPORTED_CAPABILITY');
  }
  assert.equal(calls, 0);
});
