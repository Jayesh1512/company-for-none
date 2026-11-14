import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeb, createDeliveryAccess, verifyAccessToken, parseOrderRequest } from '../../src/web/index.mjs';
import { renderReport, renderLedger, renderOrder, loadView } from '../../public/app.js';
import { formatMoney, safeSourceUrl } from '../../public/domain.js';

const order = { id: 'o1', customerId: 'c1', question: 'Private question', status: 'ready', reportAccepted: true, reportAvailable: true };
function fixture() {
  const calls = [];
  const workflow = {
    status: async () => ({ mode: 'fixture' }),
    createOrder: async input => { calls.push(['create', input]); return { order, accessToken: 'customer-key' }; },
    verifyAccess: async (id, token) => ({ verified: id === 'o1' && token === 'customer-key', customerId: token === 'customer-key' ? 'c1' : undefined }),
    getOrder: async () => order,
    getReport: async (id, access) => { calls.push(['report', id, access]); return { content: 'Private report' }; },
    quote: async () => { calls.push(['quote']); return { status: 'confirmed' }; },
    confirmFixturePayment: async () => { calls.push(['payment']); return { status: 'confirmed', mode: 'fixture' }; },
    run: async () => { calls.push(['run']); return { order }; },
  };
  const rules = {
    evaluate: async (action, facts) => {
      assert.ok(action.id);
      const allowed = ['ledger', 'storefront'].includes(action.resource) || (action.resource === 'owner' ? facts.access.verified && facts.access.role === 'owner' : facts.access.verified && facts.access.customerId === facts.order.customerId);
      return { status: allowed ? 'allow' : 'deny', reasonCode: allowed ? 'APPROVED' : 'ACCESS_DENIED' };
    }, snapshot: () => ({ kill: false, policyEpoch: 1 }),
  };
  return { calls, web: createWeb({ workflow, rules, ledger: { view: async () => ({ entries: [] }) }, ownerToken: 'owner-key' }) };
}
const request = (path, options = {}) => new Request(`http://localhost${path}`, options);

test('customer capability verifies only its order; browser role/body/query claims confer no access', async () => {
  const { web, calls } = fixture();
  for (const path of ['/api/orders/o1', '/api/orders/o1/report', '/api/orders/o1/report?role=owner&token=customer-key']) assert.equal((await web.handle(request(path))).status, 403);
  assert.equal((await web.handle(request('/api/orders/o1/run', { method: 'POST', headers: { authorization: 'Bearer wrong' } }))).status, 403);
  assert.equal(calls.length, 0);
  const report = await web.handle(request('/api/orders/o1/report', { headers: { authorization: 'Bearer customer-key' } }));
  assert.equal(report.status, 200); assert.equal((await report.json()).artifact.content, 'Private report');
  assert.equal((await web.handle(request('/api/orders/o2/report', { headers: { authorization: 'Bearer customer-key' } }))).status, 403);
});

test('owner requires distinct secret and public ledger cannot expose report contents', async () => {
  const { web } = fixture();
  assert.equal((await web.handle(request('/api/owner/status', { headers: { authorization: 'Bearer customer-key' } }))).status, 403);
  assert.equal((await web.handle(request('/api/owner/status', { headers: { authorization: 'Bearer owner-key' } }))).status, 200);
  const ledger = await web.handle(request('/api/ledger'));
  assert.equal(ledger.status, 200); assert.equal((await ledger.text()).includes('Private'), false);
  assert.equal(ledger.headers.get('cache-control'), 'no-store');
});

test('order parser accepts brief facts and rejects client decisions/permissions and cross-origin mutations', async () => {
  const { web, calls } = fixture();
  const body = input => ({ method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'create-1' }, body: JSON.stringify(input) });
  assert.equal((await web.handle(request('/api/orders', body({ question: 'Question?', role: 'owner', permit: {} })))).status, 400);
  const accepted = await web.handle(request('/api/orders', body({ question: ' Question? ', geography: 'India' })));
  assert.equal(accepted.status, 201); assert.equal(calls[0][1].question, 'Question?'); assert.equal(calls[0][1].actionId, 'create-1');
  assert.equal((await web.handle(request('/api/orders', { ...body({ question: 'q' }), headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' } }))).status, 403);
  await assert.rejects(parseOrderRequest(request('/api/orders', body({ question: 'x'.repeat(70000) }))), { code: 'REQUEST_TOO_LARGE' });
});

test('Rules hold prevents access and no fallback executes a mutation', async () => {
  let called = false;
  const web = createWeb({ workflow: { verifyAccess: () => ({ verified: true }), getOrder: () => order, run: () => { called = true; } }, rules: { evaluate: () => ({ status: 'hold', reasonCode: 'STOPPED' }) } });
  assert.equal((await web.handle(request('/api/orders/o1/run', { method: 'POST' }))).status, 409); assert.equal(called, false);
});

test('capability helper issues random opaque tokens and constant-time hash verification', () => {
  const a = createDeliveryAccess(), b = createDeliveryAccess();
  assert.notEqual(a.token, b.token); assert.equal(verifyAccessToken(a.token, a.hash), true); assert.equal(verifyAccessToken(b.token, a.hash), false); assert.equal(verifyAccessToken('', a.hash), false);
});

test('reports, sources, questions, ledger fields render as inert untrusted text', () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const report = renderReport({ mode: 'fixture', content: payload, sources: [{ title: payload, url: 'javascript:alert(1)', id: 'S1' }], qualifications: [payload] });
  const ledger = renderLedger({ entries: [{ id: payload, type: payload, money: { amount: '1', decimals: 0, asset: payload, network: 'fixture' }, status: 'unknown', evidenceRef: payload }] });
  const view = renderOrder({ ...order, question: payload, permittedActions: ['run', payload] });
  for (const html of [report, ledger, view]) { assert.equal(html.includes('<script>'), false); assert.equal(html.includes('<img'), false); assert.ok(html.includes('&lt;')); }
  assert.equal(report.includes('href="javascript:'), false); assert.equal(safeSourceUrl('data:text/html,x'), null);
  assert.equal(formatMoney({ amount: '999999999999999999999999999', decimals: 6, asset: 'usdc', network: 'fixture' }), '999,999,999,999,999,999,999.999999 usdc · fixture');
});

test('ledger renders degraded Rules metadata without inferring a degraded policy from other fields', () => {
  const view = { entries: [], degraded: true, currentSafetyValid: false, businessEffectsAllowed: false, readPolicyVersion: '<script>bad</script>' };
  const html = renderLedger(view);
  assert.match(html, /Degraded public ledger view/);
  assert.match(html, /Current safety configuration is invalid/);
  assert.match(html, /Business effects are disabled/);
  assert.match(html, /Read policy version: &lt;script&gt;bad&lt;\/script&gt;/);
  assert.equal(html.includes('<script>'), false);
  assert.equal(renderLedger({ entries: [], currentSafetyValid: false }).includes('Degraded public ledger view'), false);
});

test('ledger entry and refresh load independently of denied storefront status and propagate ledger denial', async () => {
  const calls = [];
  const ledger = { entries: [{ id: 'safe-sale' }], degraded: true };
  const api = async path => {
    calls.push(path);
    if (path === '/api/status') throw Error('Storefront access denied');
    return { ledger };
  };
  assert.deepEqual(await loadView({ page: 'ledger' }, { api, status: null }), { ledger });
  assert.deepEqual(await loadView({ page: 'ledger' }, { api, status: { mode: 'fixture' }, refreshStatus: true }), { ledger });
  assert.deepEqual(calls, ['/api/ledger', '/api/ledger']);
  await assert.rejects(loadView({ page: 'shop' }, { api, status: null }), /Storefront access denied/);
  await assert.rejects(loadView({ page: 'ledger' }, { api: async () => { throw Error('Ledger access denied'); }, status: { mode: 'fixture' } }), /Ledger access denied/);
  assert.match(renderLedger(null), /No approved ledger view is available/);
});
