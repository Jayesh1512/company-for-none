import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudFundingAdapter, createCloudCreditReadPort, toEconomicObservation } from '../../src/cloud-funding/index.mjs';
import { clock, json, recorder } from './helpers.mjs';

const ORG = 'org-1', KEY = 'sk-live-secret', JWT = 'aaa.bbb.ccc';
const row = (type, amount, out, consumed, source = null) => { const cap = Math.max(amount - out, 0); return { type, source, currency: 'USD', amount, transferred_out: out, effective_capacity: cap, consumed, available: Math.max(cap - consumed, 0) }; };
const balance = (limits, extra = {}) => ({ organization_id: ORG, credit_limits: limits, legacy_unattributed_amount: 0, unfunded_amount: 0, total_spent: 0, total_spent_display: '$0', total_requests: 0, total_tokens: 0, updated_at: '2026-11-14T11:59:00Z', ...extra });
const live = (handler, extra = {}) => { const r = recorder(handler); return { ...r, adapter: createCloudFundingAdapter({ mode: 'live', transport: r.transport, resolveSecret: ref => ({ session: JWT, key: KEY, rpt: 'rpt-abc' })[ref], clock, ...extra }) }; };
const route = (balanceBody, attrBody = { valid: true, organization_id: ORG, workspace_id: 'ws-1', api_key_id: 'key-1' }) => call =>
  call.url.endsWith('/check_api_key') ? json(attrBody) : call.url.endsWith('/usage/balance') ? json(balanceBody) : json({}, 404);

test('balance is an unwatermarked, non-additive comparison fact; postpay is not prepaid credit', async () => {
  const { adapter, calls } = live(route(balance([row('payment', 5_000_000_000, 0, 1_000_000_000), row('grant', 100, 0, 0), row('postpay', 9_000_000_000, 0, 0)])));
  const r = await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session', keySecretRef: 'key' });
  assert.equal(r.status, 'confirmed'); const o = r.observation;
  assert.deepEqual(o.creditLimits.map(r => [r.type, r.availableNanoUsd]), [['payment', '4000000000'], ['grant', '100'], ['postpay', '9000000000']]);
  assert.equal(o.aggregateAvailableNanoUsd, null); assert.equal(o.arithmeticVerified, false);
  assert.equal('availableNanoUsd' in o, false); // aggregation belongs to M01
  assert.equal(o.status, 'unwatermarked'); assert.equal(o.watermark, null);
  assert.equal(o.additive, false); assert.equal(o.opening, false); assert.equal(o.grantsSpendingAuthority, false); assert.equal(o.autonomousPurchase, false);
  assert.deepEqual([o.scope.organizationId, o.scope.workspaceId, o.scope.apiKeyId, o.scope.keyLimitVerified], [ORG, 'ws-1', 'key-1', false]);
  assert.equal(o.creditLimits[0].provenanceClaim, 'payment_credit'); assert.equal(o.scope.ownerBindingVerified, false);
  assert.equal(JSON.stringify(r).includes(KEY) || JSON.stringify(r).includes(JWT), false);
  assert.equal(calls.length, 2); assert.equal(calls.every(c => c.headers.authorization.startsWith('Bearer ')), true);
});

test('identical reads give the same observation id; no credit lot or balance row is ever produced', async () => {
  const { adapter } = live(route(balance([row('payment', 5_000_000_000, 0, 0)])));
  const a = (await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).observation;
  const b = (await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).observation;
  assert.equal(a.id, b.id);
  assert.equal('credit' in a || 'lot' in a || 'receipt' in a, false);
});

test('economic observation candidate is never verified and cannot cross organization/key bindings', async () => {
  const { adapter } = live(route(balance([row('payment', 5_000_000_000, 0, 0)])));
  const o = (await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session', keySecretRef: 'key' })).observation;
  const binding = { provider: 'near-ai-cloud', companyId: 'c', accountId: 'acct', organizationId: ORG, credentialId: 'key-1', network: 'near-ai-cloud', asset: 'nano-usd', decimals: 9, bucket: 'prepaid' };
  const rec = toEconomicObservation(o, binding);
  assert.equal(rec.status, 'unwatermarked'); assert.equal(rec.watermark, null); assert.equal(rec.creditLimits[0].availableNanoUsd, '5000000000'); assert.equal('availableNanoUsd' in rec, false);
  assert.throws(() => toEconomicObservation(o, { ...binding, organizationId: 'other' }), /Binding/);
  assert.throws(() => toEconomicObservation(o, { ...binding, credentialId: 'key-2' }), /Binding/);
});

test('only a user session token can read balances; inference and reporting tokens are refused before any request', async () => {
  const { adapter, calls } = live(route(balance([])));
  for (const ref of ['key', 'rpt']) assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: ref })).code, 'SESSION_CREDENTIAL_REQUIRED');
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'missing' })).code, 'SESSION_CREDENTIAL_REQUIRED');
  assert.equal(calls.length, 0);
});

test('attribution mismatch, foreign organization, float, unsafe integer or wrong currency are rejected', async () => {
  let { adapter } = live(route(balance([row('payment', 1, 0, 0)]), { valid: true, organization_id: 'org-other', workspace_id: 'w', api_key_id: 'k' }));
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session', keySecretRef: 'key' })).code, 'ATTRIBUTION_MISMATCH');
  ({ adapter } = live(route({ ...balance([row('payment', 1, 0, 0)]), organization_id: 'org-other' })));
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).code, 'BALANCE_SCHEMA_INVALID');
  ({ adapter } = live(route(balance([{ ...row('payment', 5, 0, 0), available: 1.5 }]))));
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).code, 'BALANCE_SCHEMA_INVALID');
  ({ adapter } = live(route(balance([{ ...row('payment', 5, 0, 0), amount: Number.MAX_SAFE_INTEGER + 1 }]))));
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).code, 'BALANCE_SCHEMA_INVALID');
  ({ adapter } = live(route(balance([{ ...row('payment', 5, 0, 0), currency: 'EUR' }]))));
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).code, 'BALANCE_SCHEMA_INVALID');
});

test('read-only bridge pins organization/key/session references and refuses caller-selected scope', async () => {
  const { adapter, calls } = live(route(balance([row('payment', 5, 0, 0)])));
  const port = createCloudCreditReadPort({ adapter, organizationId: ORG, sessionSecretRef: 'session', keySecretRef: 'key' });
  assert.equal(Object.isFrozen(port), true);
  assert.equal((await port.attributeKey()).attribution.apiKeyId, 'key-1');
  assert.equal((await port.observeBalance()).observation.scope.organizationId, ORG);
  const before = calls.length;
  assert.throws(() => port.observeBalance({ organizationId: 'other', sessionSecretRef: 'foreign' }), /no caller-selected/);
  assert.throws(() => port.attributeKey({}), /no caller-selected/);
  assert.equal(calls.length, before);
  assert.throws(() => createCloudCreditReadPort({ adapter, organizationId: ORG }), /Pinned/);
});

test('row arithmetic stays as provider claims for M01; no duplicate source rows are summed into a balance', async () => {
  const r = { ...row('payment', 5, 0, 0), available: 9 };
  const { adapter } = live(route(balance([r, r])));
  const o = (await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).observation;
  assert.equal(o.creditLimits.length, 2); assert.equal(o.aggregateAvailableNanoUsd, null);
  assert.equal(o.arithmeticVerified, false); assert.equal(o.additive, false);
  assert.deepEqual(o.creditLimits.map(r => r.availableNanoUsd), ['9', '9']);
});

test('provider errors are never retried', async () => {
  const { adapter, calls } = live(() => json({ error: 'x' }, 500));
  assert.equal((await adapter.observeBalance({ organizationId: ORG, sessionSecretRef: 'session' })).status, 'failed');
  assert.equal(calls.length, 1);
});

test('purchase, caller-supplied balances, staking and transfer stay unsupported with zero traffic; fixture/default modes read nothing', async () => {
  const { adapter, calls } = live(route(balance([])));
  assert.equal(adapter.capabilities().autonomousPurchaseSupported, false);
  assert.equal(adapter.capabilities().staking.supported, false); assert.equal(adapter.capabilities().creditTransfer.supported, false);
  assert.equal((await adapter.fund({ action: { id: 'f1', type: 'funding' } })).code, 'UNSUPPORTED_CAPABILITY');
  assert.equal((await adapter.reconcile({ action: { id: 'f1' } })).code, 'UNSUPPORTED_CAPABILITY');
  assert.equal(adapter.observeCredit({ credit: { availableNanoUsd: '10' } }).code, 'CREDIT_EVIDENCE_UNVERIFIED');
  assert.equal(calls.length, 0);
  const off = recorder(() => json({}));
  for (const mode of ['fixture', 'testnet', 'setup', undefined]) {
    const a = createCloudFundingAdapter({ mode, transport: off.transport, resolveSecret: () => JWT });
    assert.equal((await a.observeBalance({ organizationId: ORG, sessionSecretRef: 's' })).code, 'PROVIDER_MODE_UNAVAILABLE');
    assert.equal((await a.attributeKey({ keySecretRef: 'k' })).code, 'PROVIDER_MODE_UNAVAILABLE');
  }
  assert.equal(off.calls.length, 0);
});
