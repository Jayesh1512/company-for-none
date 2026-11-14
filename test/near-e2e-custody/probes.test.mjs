import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as official from '@near-intents-agent-api/sdk';
import { createJournal } from '../../src/journal/index.mjs';
import { createAgentApiProbes } from '../../src/custody/probes.mjs';

const clock = () => new Date('2026-11-14T12:00:00.000Z');
const binding = { companyId: 'company-one', network: 'near:mainnet', treasuryAccount: 'agent.near', bucket: 'confidential' };
const credential = official.createGrantCredential();
const agent = { id: 'agent-one', status: 'ACTIVE', wallet: { wallet_id: 'w', near_account_id: 'agent.near' } };
const grantRecord = (over = {}) => ({ grant_id: 'grant-one', agent_id: 'agent-one', wallet_id: 'w', label: 'x', issued_at: '2026-11-01T00:00:00Z', expires_at: '2027-01-01T00:00:00.000Z', revoked_at: null, revoked_reason: null, owner_epoch: 3,
  owner_message: { domain: 'near-intents-agent-api.agent-grant.v6', tenant_id: 't', agent_id: 'agent-one', wallet_id: 'w', label: 'x', credential: credential.commitment, network: 'mainnet', issued_at_ms: Date.parse('2026-11-01T00:00:00Z'), expires_at_ms: Date.parse('2027-01-01T00:00:00.000Z'), owner_epoch: 3, nonce: 'n', recipient: 'r' }, ...over });
const containment = (over = {}) => ({ generated_at: 'x', wallet: { wallet_id: 'w', near_account_id: 'agent.near' }, grants: { data: [{ grant_id: 'grant-one', owner_epoch: 3, issued_at: '2026-11-01T00:00:00Z', expires_at: '2027-01-01T00:00:00.000Z', revoked_at: null, grant_record_current: true, findings: [] }], next_cursor: null, has_more: false },
  pending_operations: { data: [{ operation_id: 'op_1', kind: 'execute', status: 'PROCESSING' }], next_cursor: null, has_more: false }, provider_boundary: { enforcement: 'unverified', direct_provider_key_bypass: 'unverified' }, ...over });

async function setup(t, routes, extra = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers });
    const route = routes[req.url];
    res.setHeader('Content-Type', 'application/json');
    if (!route) { res.statusCode = 501; return res.end('{}'); }
    res.end(JSON.stringify(typeof route === 'function' ? route() : route));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const directory = await mkdtemp(join(tmpdir(), 'near1-custody-probe-'));
  const journal = await createJournal({ directory, clock });
  t.after(async () => { await new Promise(r => server.close(r)); await journal.close(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`, saved = [];
  const secrets = { 'key-ref': 'sentinel-api-key', 'grant-ref': credential.token };
  const probes = createAgentApiProbes({ binding, policyVersion: 'p1', clock, ttlMs: 60000, agentId: 'agent-one', secretRef: 'key-ref', grantRef: 'grant-ref', grantId: 'grant-one', providerPolicyVersion: 4, balanceSource: 'confidential',
    resolveSecret: async ref => secrets[ref], transport: (url, init) => fetch(base + new URL(url).pathname + new URL(url).search, init),
    persistEvidence: async e => { saved.push(e); return journal.putArtifact({ actionId: `probe:${saved.length}`, content: JSON.stringify(e) }); }, ...extra });
  return { probes, requests, saved, secrets };
}

test('balanceFacts returns one exact asset as provider-reported integers with NO invented watermark', async t => {
  const { probes, requests, saved } = await setup(t, { '/v1/agents/agent-one': agent,
    '/v1/agents/agent-one/balances?source=confidential&asset=nep141%3Ausdc.near': { near_account_id: 'agent.near', source: 'confidential', balances: [{ asset_id: 'nep141:usdc.near', decimals: 6, price_updated_at: '2026-11-14T11:59:00Z', balance_raw: '1000', available_raw: '900', symbol: 'USDC', balance: '0.001', available: '0.0009', price: 1, price_expires_at: null, blockchain: null }] } });
  const o = await probes.balanceFacts({ asset: 'nep141:usdc.near' });
  assert.equal(o.status, 'observed'); assert.equal(o.reasonCode, 'NO_PROVIDER_WATERMARK_LOCAL_READ_TIME_ONLY');
  assert.deepEqual({ ...o.facts }, { accountId: 'agent.near', source: 'confidential', assetId: 'nep141:usdc.near', balanceRaw: '1000', availableRaw: '900', decimals: 6, watermark: null, localReadAt: '2026-11-14T12:00:00.000Z' });
  assert.ok(!JSON.stringify(o).includes('price_updated_at') && !JSON.stringify(o.facts).includes('2026-11-14T11:59'), 'price time must not be mistaken for a watermark');
  assert.ok(o.evidenceRef.visibility === 'private' && new Date(o.expiresAt) > new Date(o.observedAt));
  assert.ok(requests.every(r => r.method === 'GET' && r.headers['x-api-key'] === 'sentinel-api-key' && r.headers['x-grant-token'] === undefined));
  assert.ok(!JSON.stringify(saved).includes('sentinel-api-key'));
  assert.equal((await probes.balanceFacts()).reasonCode, 'ASSET_SCOPE_REQUIRED');
});

test('balanceFacts rejects wrong account/source, duplicate or missing asset, non-integer and inconsistent rows', async t => {
  const url = '/v1/agents/agent-one/balances?source=confidential&asset=nep141%3Ausdc.near';
  const row = { asset_id: 'nep141:usdc.near', balance_raw: '5', available_raw: '5' };
  for (const [body, code] of [
    [{ near_account_id: 'other.near', source: 'confidential', balances: [row] }, 'BALANCE_SCOPE_MISMATCH'],
    [{ near_account_id: 'agent.near', source: 'public', balances: [row] }, 'BALANCE_SCOPE_MISMATCH'],
    [{ near_account_id: 'agent.near', source: 'confidential', balances: [row, row] }, 'BALANCE_ASSET_UNOBSERVED'],
    [{ near_account_id: 'agent.near', source: 'confidential', balances: [] }, 'BALANCE_ASSET_UNOBSERVED'],
    [{ near_account_id: 'agent.near', source: 'confidential', balances: [{ ...row, balance_raw: '5.0' }] }, 'BALANCE_ASSET_UNOBSERVED'],
    [{ near_account_id: 'agent.near', source: 'confidential', balances: [{ ...row, decimals: -1 }] }, 'BALANCE_ASSET_UNOBSERVED'],
    [{ near_account_id: 'agent.near', source: 'confidential', balances: [{ ...row, balance_raw: '1'.repeat(79) }] }, 'BALANCE_ASSET_UNOBSERVED'],
    [{ near_account_id: 'agent.near', source: 'confidential', balances: [{ ...row, available_raw: '6' }] }, 'BALANCE_INCONSISTENT'],
  ]) {
    const { probes } = await setup(t, { '/v1/agents/agent-one': agent, [url]: body });
    const o = await probes.balanceFacts({ asset: 'nep141:usdc.near' });
    assert.equal(o.status, 'unavailable', code); assert.equal(o.reasonCode, code); assert.equal(o.facts, undefined);
  }
});

test('policyFacts exposes applied policy only when synced and at the pinned revision; never a verdict', async t => {
  const policy = { frozen: false, actions: ['transfer'], confidential: true, owner_approval: false, assets: ['nep141:usdc.near'], limits: { per_transaction: { 'nep141:usdc.near': '500' } }, max_actions_per_hour: 2, destinations: { mode: 'only', list: [{ action: 'transfer', address: 'payee.near', confidential: true }] }, budget: { daily_usd: '5', weekly_usd: null, monthly_usd: null }, timelock_ms: 0 };
  const good = { wallet_id: 'w', revision: 4, policy_hash: 'abc', status: 'APPLIED', applied_at: 'x', transaction_hash: null, provider_policy_synced: true, cooldowns: {}, policy, usage: { budget: {}, timelock: {} } };
  const ok = await (await setup(t, { '/v1/agents/agent-one': agent, '/v1/agents/agent-one/policy': good })).probes.policyFacts();
  assert.equal(ok.status, 'observed'); assert.equal(ok.reasonCode, 'POLICY_PROVIDER_REPORTED_SIGNATURE_UNVERIFIED');
  assert.equal(ok.facts.policyHash, 'abc'); assert.equal(ok.facts.frozen, false); assert.equal(ok.facts.destinations.list[0].address, 'payee.near');
  assert.ok(!('allowed' in ok.facts) && !('decision' in ok.facts));
  for (const [override, code] of [[{ revision: 5 }, 'PROVIDER_POLICY_REVISION_UNVERIFIED'], [{ provider_policy_synced: false }, 'PROVIDER_POLICY_NOT_APPLIED'], [{ status: 'SIGNED' }, 'PROVIDER_POLICY_NOT_APPLIED'], [{ policy: null }, 'PROVIDER_POLICY_NOT_APPLIED']]) {
    const o = await (await setup(t, { '/v1/agents/agent-one': agent, '/v1/agents/agent-one/policy': { ...good, ...override } })).probes.policyFacts();
    assert.equal(o.status, 'unavailable'); assert.equal(o.reasonCode, code);
  }
});

test('grantBinding checks the local token commitment against the provider record without ever sending the token', async t => {
  const routes = over => ({ '/v1/agents/agent-one': agent, '/v1/agents/agent-one/grants': [grantRecord(over.grant)], '/v1/agents/agent-one/containment': containment(over.containment) });
  const h = await setup(t, routes({}));
  const o = await h.probes.grantBinding();
  assert.equal(o.status, 'observed', o.reasonCode); assert.equal(o.facts.commitmentMatchesLocalToken, true);
  assert.equal(o.facts.providerBoundary.enforcement, 'unverified'); assert.equal(o.facts.providerBoundary.directProviderKeyBypass, 'unverified');
  assert.deepEqual(o.facts.pendingOperations.items, [{ operationId: 'op_1', kind: 'execute', status: 'PROCESSING' }]);
  const wire = JSON.stringify(h.requests) + JSON.stringify(h.saved);
  assert.ok(!wire.includes(credential.token), 'grant token never leaves the process');
  assert.ok(h.requests.every(r => r.method === 'GET' && !r.headers['x-grant-token']));
  const cases = [
    [{ grant: { owner_message: { ...grantRecord().owner_message, credential: 'f'.repeat(64) } } }, 'GRANT_COMMITMENT_MISMATCH'],
    [{ grant: { owner_message: { ...grantRecord().owner_message, agent_id: 'other' } } }, 'GRANT_COMMITMENT_MISMATCH'],
    [{ grant: { owner_message: { ...grantRecord().owner_message, owner_epoch: 4 } } }, 'GRANT_COMMITMENT_MISMATCH'],
    [{ grant: { owner_message: { ...grantRecord().owner_message, wallet_id: 'other' } } }, 'GRANT_COMMITMENT_MISMATCH'],
    [{ grant: { revoked_at: '2026-11-13T00:00:00Z' } }, 'GRANT_INACTIVE'],
    [{ grant: { expires_at: '2026-11-14T12:00:00.000Z', owner_message: { ...grantRecord().owner_message, expires_at_ms: Date.parse('2026-11-14T12:00:00.000Z') } } }, 'GRANT_INACTIVE'],
    [{ grant: { grant_id: 'grant-two' } }, 'GRANT_NOT_FOUND'],
    [{ containment: { grants: { data: [{ grant_id: 'grant-one', owner_epoch: 3, revoked_at: null, grant_record_current: false, findings: [] }], has_more: false } } }, 'GRANT_RECORD_NOT_CURRENT'],
    [{ containment: { grants: { data: [{ grant_id: 'grant-one', owner_epoch: 3, revoked_at: null, grant_record_current: true, findings: ['owner_epoch_stale'] }], has_more: false } } }, 'GRANT_RECORD_NOT_CURRENT'],
    [{ containment: { grants: { data: [], has_more: true, next_cursor: 'c' } } }, 'GRANT_CONTAINMENT_PAGE_INCOMPLETE'],
    [{ containment: { wallet: { wallet_id: 'w', near_account_id: 'other.near' } } }, 'GRANT_RECORD_NOT_CURRENT'],
    [{ containment: { grants: { data: [{ ...containment().grants.data[0], expires_at: '2028-01-01T00:00:00Z' }], has_more: false } } }, 'GRANT_RECORD_NOT_CURRENT'],
    [{ containment: { grants: { data: [containment().grants.data[0], containment().grants.data[0]], has_more: false } } }, 'GRANT_RECORD_NOT_CURRENT'],
  ];
  for (const [over, code] of cases) assert.equal((await (await setup(t, routes(over))).probes.grantBinding()).reasonCode, code);
  const wrong = await setup(t, routes({}));
  wrong.secrets['grant-ref'] = official.createGrantCredential().token;
  assert.equal((await wrong.probes.grantBinding()).reasonCode, 'GRANT_COMMITMENT_MISMATCH');
  wrong.secrets['grant-ref'] = 'not-a-grant';
  assert.equal((await wrong.probes.grantBinding()).reasonCode, 'GRANT_TOKEN_UNAVAILABLE');
});

test('grant observations expose exact expiry; M01 owns any freshness margin', async t => {
  const expires = '2026-11-14T12:00:30.000Z';
  const grant = grantRecord({ expires_at: expires, owner_message: { ...grantRecord().owner_message, expires_at_ms: Date.parse(expires) } });
  const c = containment(); c.grants.data[0].expires_at = expires;
  const h = await setup(t, { '/v1/agents/agent-one': agent, '/v1/agents/agent-one/grants': [grant], '/v1/agents/agent-one/containment': c });
  const result = await h.probes.grantBinding();
  assert.equal(result.status, 'observed'); assert.equal(result.facts.expiresAt, expires);
});

test('wrong agent identity or missing private evidence yields no facts', async t => {
  const { probes } = await setup(t, { '/v1/agents/agent-one': { ...agent, wallet: { near_account_id: 'other.near' } }, '/v1/agents/agent-one/policy': {} });
  assert.equal((await probes.policyFacts()).reasonCode, 'AGENT_IDENTITY_UNVERIFIED');
  const none = await setup(t, { '/v1/agents/agent-one': agent, '/v1/agents/agent-one/policy': {} }, { persistEvidence: undefined });
  assert.equal((await none.probes.balanceFacts({ asset: 'a' })).reasonCode, 'PRIVATE_EVIDENCE_REQUIRED');
});
