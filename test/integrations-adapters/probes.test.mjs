import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createCloudModelProbe } from '../../src/inference/probes.mjs';
import { createPaymentTokensProbe } from '../../src/payments/probes.mjs';
import { createAgentApiProbes } from '../../src/custody/probes.mjs';
import { journalFor, clock } from './fixtures.mjs';

const binding = { companyId: 'company-one', network: 'near:mainnet', treasuryAccount: 'agent.near', bucket: 'confidential' };
async function serve(t, handler) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, headers: req.headers });
    res.setHeader('Content-Type', 'application/json'); handler(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { requests, transport: (url, init) => { const u = new URL(url); return fetch(base + u.pathname + u.search, init); } };
}
async function optionsFor(t, transport, overrides = {}) {
  const journal = await journalFor(t); const saved = [];
  return { binding, policyVersion: 'policy-one', clock, ttlMs: 60000, transport,
    persistEvidence: async evidence => { saved.push(evidence); return journal.putArtifact({ actionId: `probe-evidence:${saved.length}`, content: JSON.stringify(evidence) }); },
    ...overrides, saved, journal };
}
function assertShape(value) {
  assert.deepEqual(Object.keys(value).sort(), ['id', 'capability', 'provider', 'status', 'observedAt', 'expiresAt', 'identity', 'policyVersion', 'evidenceRef', 'reasonCode'].sort());
  assert.deepEqual(value.identity, binding);
  assert.ok(value.evidenceRef.visibility === 'private');
  assert.ok(!JSON.stringify(value).includes('private-provider-detail'));
}

test('public model probe verifies exact membership only; evidence/freshness/company bindings are private and exact', async t => {
  const http = await serve(t, (req, res) => res.end(JSON.stringify({ data: [{ id: 'selected/model', privateDetail: 'private-provider-detail' }] })));
  const options = await optionsFor(t, http.transport);
  const probe = createCloudModelProbe({ ...options, model: 'selected/model' });
  assert.equal(http.requests.length, 0, 'construction must perform no read');
  const observed = await probe.probe(); assertShape(observed);
  assert.equal(observed.capability, 'inference_model'); assert.equal(observed.status, 'verified');
  assert.equal(observed.reasonCode, 'MODEL_CATALOG_OBSERVED');
  assert.equal(observed.expiresAt, '2026-11-10T20:01:00.000Z');
  assert.equal(http.requests[0].path, '/v1/models'); assert.equal(http.requests[0].method, 'GET');
  assert.equal(http.requests[0].headers.authorization, undefined);
  const raw = options.saved[0].reads[0];
  assert.equal(JSON.parse(Buffer.from(raw.response.bodyBase64, 'base64')).data[0].privateDetail, 'private-provider-detail');
  assert.deepEqual(Object.keys(raw.request).sort(), ['method', 'url', 'protocol'].sort());
  const absent = await createCloudModelProbe({ ...options, model: 'missing' }).probe();
  assert.equal(absent.status, 'unavailable'); assert.equal(absent.reasonCode, 'MODEL_UNAVAILABLE');
  const other = await createCloudModelProbe({ ...options, model: 'selected/model', binding: { ...binding, companyId: 'company-two' } }).probe();
  assert.notEqual(other.id, observed.id); assert.equal(other.identity.companyId, 'company-two');
});

test('catalog read cannot verify payment or refund route or mint money', async t => {
  const http = await serve(t, (req, res) => res.end(JSON.stringify([{ assetId: 'nep141:token.near', blockchain: 'near', decimals: 6, price: '1.0' }])));
  const options = await optionsFor(t, http.transport);
  const observed = await createPaymentTokensProbe(options).probe(); assertShape(observed);
  assert.equal(observed.status, 'configured'); assert.equal(observed.capability, 'payments_route');
  assert.equal(observed.reasonCode, 'ROUTE_UNVERIFIED');
  assert.equal(http.requests[0].path, '/v0/tokens'); assert.equal(http.requests[0].method, 'GET');
  assert.equal(options.journal.events().length, 0); assert.equal(options.journal.get('financial', 'state'), null);
});

test('mode/configuration cannot promote missing binding, evidence sink, freshness or model', async () => {
  let reads = 0; const transport = () => { reads++; throw new Error('No external traffic'); };
  const base = { transport, mode: 'live', model: 'selected', clock, persistEvidence: () => 'private:ref', ttlMs: 1000 };
  assert.equal((await createCloudModelProbe(base).probe()).reasonCode, 'PROBE_IDENTITY_REQUIRED');
  assert.equal((await createCloudModelProbe({ ...base, binding, persistEvidence: null }).probe()).reasonCode, 'PRIVATE_EVIDENCE_REQUIRED');
  assert.equal((await createCloudModelProbe({ ...base, binding, ttlMs: null }).probe()).reasonCode, 'PROBE_LIMITS_REQUIRED');
  assert.equal((await createCloudModelProbe({ ...base, binding, model: null }).probe()).reasonCode, 'MODEL_SELECTION_REQUIRED');
  assert.equal(reads, 0);
});

test('failed HTTP, malformed catalog, oversized response and missing private evidence fail closed', async t => {
  let mode = 'error';
  const http = await serve(t, (req, res) => {
    if (mode === 'error') { res.statusCode = 503; res.end('{}'); }
    if (mode === 'malformed') res.end(JSON.stringify({ data: [{ id: 1 }] }));
    if (mode === 'large') res.end('x'.repeat(100));
    if (mode === 'good') res.end(JSON.stringify({ data: [{ id: 'model' }] }));
  });
  const options = await optionsFor(t, http.transport);
  const create = extra => createCloudModelProbe({ ...options, model: 'model', ...extra });
  assert.equal((await create().probe()).status, 'unavailable');
  mode = 'malformed'; assert.equal((await create().probe()).reasonCode, 'MODEL_CATALOG_SCHEMA_UNVERIFIED');
  mode = 'large'; assert.equal((await create({ maxResponseBytes: 30 }).probe()).status, 'unavailable');
  mode = 'good'; assert.equal((await create({ persistEvidence: () => ({ id: 'public', visibility: 'public' }) }).probe()).reasonCode, 'PRIVATE_EVIDENCE_REQUIRED');
});

test('an observation that expires during its bounded read is unavailable', async t => {
  let current = clock().getTime();
  const options = await optionsFor(t, async () => { current += 2000; return new Response(JSON.stringify({ data: [{ id: 'model' }] })); }, { clock: () => new Date(current), ttlMs: 1000 });
  const value = await createCloudModelProbe({ ...options, model: 'model' }).probe();
  assert.equal(value.status, 'unavailable'); assert.equal(value.reasonCode, 'PROBE_EXPIRED');
});

test('Agent API probes use only documented GETs, never grant headers, and keep unverified contracts unavailable', async t => {
  const http = await serve(t, (req, res) => {
    if (req.url === '/v1/agents/agent-one') res.end(JSON.stringify({ agent_id: 'agent-one', status: 'ACTIVE', wallet: { near_account_id: 'agent.near' } }));
    else if (req.url === '/v1/agents/agent-one/policy') res.end(JSON.stringify({ revision: 4, status: 'APPLIED', provider_policy_synced: true, policy: { confidential: true, private: 'private-provider-detail' } }));
    else if (req.url === '/v1/agents/agent-one/grants') res.end(JSON.stringify([{ grant_id: 'grant-one', expires_at: '2027-01-01T00:00:00Z', revoked_at: null }]));
    else if (req.url === '/v1/agents/agent-one/balances?source=confidential') res.end(JSON.stringify({ balances: [{ asset_id: 'nep141:token.near', balance_raw: '100', available_raw: '90' }] }));
    else { res.statusCode = 501; res.end('{}'); }
  });
  const options = await optionsFor(t, http.transport);
  const probes = createAgentApiProbes({ ...options, agentId: 'agent-one', secretRef: 'partner-key-ref', grantRef: 'must-not-resolve', grantId: 'grant-one',
    providerPolicyVersion: 4, balanceSource: 'confidential', resolveSecret: async ref => { assert.equal(ref, 'partner-key-ref'); return 'sentinel-api-secret'; } });
  assert.equal(http.requests.length, 0);
  const values = await probes.probe(); values.forEach(assertShape);
  assert.deepEqual(values.map(v => v.status), ['verified', 'unavailable', 'unavailable', 'unavailable']);
  assert.deepEqual(values.map(v => v.capability), ['custody_identity', 'custody_policy', 'custody_grant', 'custody_balance']);
  assert.deepEqual(values.slice(1).map(v => v.reasonCode), ['POLICY_SIGNATURE_UNVERIFIED', 'GRANT_TOKEN_BINDING_UNVERIFIED', 'BALANCE_WATERMARK_UNVERIFIED']);
  assert.equal(http.requests.length, 7);
  for (const request of http.requests) {
    assert.equal(request.method, 'GET'); assert.equal(request.headers['x-api-key'], 'sentinel-api-secret'); assert.equal(request.headers['x-grant-token'], undefined);
  }
  assert.ok(!JSON.stringify(options.saved).includes('sentinel-api-secret'));
  assert.ok(!JSON.stringify(options.saved).includes('must-not-resolve'));
  assert.equal(options.journal.events().length, 0);
});

test('Agent identity mismatch, wrong bucket/network or absent credentials cannot produce verified observations', async t => {
  let reads = 0;
  const options = await optionsFor(t, async () => { reads++; return new Response(JSON.stringify({ status: 'ACTIVE', wallet: { near_account_id: 'other.near' } })); });
  const base = { ...options, agentId: 'agent', secretRef: 'ref', resolveSecret: async () => 'sentinel', balanceSource: 'confidential' };
  assert.equal((await createAgentApiProbes(base).identity()).status, 'unavailable');
  const current = reads;
  assert.equal((await createAgentApiProbes({ ...base, binding: { ...binding, bucket: 'public' } }).balance()).reasonCode, 'CONFIDENTIAL_MAINNET_BINDING_REQUIRED');
  assert.equal((await createAgentApiProbes({ ...base, binding: { ...binding, network: 'near:testnet' } }).identity()).status, 'unavailable');
  assert.equal((await createAgentApiProbes({ ...base, secretRef: null }).identity()).reasonCode, 'AGENT_ACCESS_REQUIRED');
  assert.equal(reads, current);
});
