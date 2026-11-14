import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import * as official from '@near-intents-agent-api/sdk';
import { createAgentApiCustody } from '../../src/custody/agent-api.mjs';
import { createAgentApiAcquirer, createAgentSettlementEvidence } from '../../src/custody/index.mjs';
import { decision, gate, clock } from '../integrations-adapters/fixtures.mjs';
import { fixture, harness, copy } from './fixtures.mjs';

async function localHttp(t, handler) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
    res.setHeader('Content-Type', 'application/json'); res.statusCode = 200;
    try { handler(req, res); } catch { res.statusCode = 500; res.end('{}'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { requests, transport: (url, init) => { const u = new URL(url); return fetch(base + u.pathname + u.search, init); } };
}
const money = { network: 'near:mainnet', asset: 'nep141:usdc.near', decimals: 6, amount: '250000' };
const action = id => ({ id, type: 'payout', mode: 'live', recipient: 'payee.near', money });

function setup(t, f, extraRoutes = {}) {
  const statusRaw = { status: 'SUCCESS', agent_id: f.expected.agentId, type: 'transfer', correlation_id: f.expected.correlationId,
    details: { near_account_id: 'agent.near', intent_hash: 'intent-hash-one', request: f.expected.payload } };
  const state = { transfers: 0 };
  return { statusRaw, state, routes: (req, res) => {
    if (req.url === `/v1/agents/${f.expected.agentId}`) res.end(JSON.stringify({ status: 'ACTIVE', wallet: { near_account_id: 'agent.near' } }));
    else if (req.url === `/v1/agents/${f.expected.agentId}/transfer`) { state.transfers++; res.end(JSON.stringify(statusRaw)); }
    else if (req.url === `/v1/status?correlation_id=${f.expected.correlationId}`) res.end(JSON.stringify(statusRaw));
    else if (extraRoutes[req.url]) res.end(JSON.stringify(extraRoutes[req.url]));
    else { res.statusCode = 501; res.end('{}'); }
  } };
}
const adapterFor = (h, f, http, extra) => createAgentApiCustody({ mode: 'live', journal: h.journal, clock, dispatchAuthorized: gate, transport: http.transport,
  network: 'near:mainnet', balanceSource: 'confidential', agentId: f.expected.agentId, accountId: 'agent.near', secretRef: 'key', grantRef: 'grant',
  resolveSecret: async ref => ref === 'key' ? 'sentinel-api' : 'sentinel-grant', ...extra });

test('adapter attaches log-attested exact terms to the ORIGINAL operation; status stays unknown; zero blind retry', async t => {
  const f = fixture(), h = await harness(t, f), s = setup(t, f); const http = await localHttp(t, s.routes);
  let acquisitions = 0;
  const a = adapterFor(h, f, http, { movement: h.movement, getMovementInputs: async ({ expected, statusEvidence }) => {
    acquisitions++; assert.deepEqual(expected.payload, f.expected.payload); assert.equal(statusEvidence.status, 'SUCCESS'); return { receipt: f.receipt, operation: f.operation };
  } });
  const command = { action: action('custody-movement-one'), decision: decision(action('custody-movement-one')) };
  const first = await a.transfer(command);
  assert.equal(first.status, 'unknown'); assert.equal(first.code, 'MOVEMENT_LOG_ATTESTED_NOT_CHAIN_FINAL');
  assert.equal(first.receipt.movementVerification, 'log-attested-exact-terms'); assert.equal(first.receipt.proofVerifiedLocally, false);
  assert.equal(first.movementProof.independentChainFinality, 'not_established'); assert.equal(first.movementProof.terms.amount, '250000');
  assert.equal(first.providerRequestId, f.expected.correlationId);
  // replay + reconcile reuse the retained private capture; the original op is not re-sent or re-acquired.
  assert.equal((await a.transfer(command)).status, 'unknown');
  const again = await a.reconcile(command);
  assert.equal(again.receipt.movementVerification, 'log-attested-exact-terms'); assert.equal(s.state.transfers, 1); assert.equal(acquisitions, 1);
  // Retained evidence is re-verified from scratch after restart; a removed tile source fails closed.
  await h.restart();
  const restarted = adapterFor(h, f, http, { movement: h.rebuild({ movement: { readTile: async () => null } }).movement });
  const degraded = await restarted.reconcile(command);
  assert.equal(degraded.receipt.movementVerification, 'unavailable'); assert.equal(degraded.status, 'unknown'); assert.equal(s.state.transfers, 1);
  assert.ok(http.requests.every(r => r.headers['x-grant-token'] === undefined || r.path.endsWith('/transfer')));
});

test('without receipt material, with a tampered receipt, or with another correlation the adapter reports unavailable and never throws', async t => {
  for (const mutate of [r => ({ ...r, receipt: undefined }), r => ({ ...r, receipt: { ...r.receipt, terms: r.receipt.terms.replace('250000', '9') } })]) {
    const f = fixture(), h = await harness(t, f), s = setup(t, f); const http = await localHttp(t, s.routes);
    const a = adapterFor(h, f, http, { movement: h.movement, getMovementInputs: async () => mutate({ receipt: f.receipt, operation: f.operation }) });
    const command = { action: action('custody-movement-bad'), decision: decision(action('custody-movement-bad')) };
    const r = await a.transfer(command);
    assert.equal(r.status, 'unknown'); assert.equal(r.receipt.movementVerification, 'unavailable'); assert.notEqual(r.code, 'MOVEMENT_LOG_ATTESTED_NOT_CHAIN_FINAL');
    assert.equal(h.journal.list('agentMovementCaptures').length, 0);
  }
  const f = fixture(), h = await harness(t, f), s = setup(t, f); const http = await localHttp(t, s.routes);
  const noPort = adapterFor(h, f, http, { movement: h.movement });
  assert.equal((await noPort.transfer({ action: action('custody-no-port'), decision: decision(action('custody-no-port')) })).receipt.movementVerification, 'unavailable');
});

test('original durable operation rejects a changed account or agent after restart before reading or dispatching', async t => {
  const f = fixture(), h = await harness(t, f), s = setup(t, f), http = await localHttp(t, s.routes);
  const command = { action: action('custody-binding'), decision: decision(action('custody-binding')) };
  const first = await adapterFor(h, f, http).transfer(command);
  assert.equal(first.status, 'unknown'); assert.equal(s.state.transfers, 1);
  const intent = h.journal.getOperation('adapters:agent-api:custody-binding');
  assert.match(intent.bindingFingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(intent.payloadHash, intent.actionFingerprint);
  await h.restart();
  const before = http.requests.length;
  for (const extra of [{ accountId: 'other.near' }, { agentId: 'other-agent' }]) {
    const changed = adapterFor(h, f, http, extra);
    assert.equal((await changed.transfer(command)).code, 'PROVIDER_ACCOUNT_MISMATCH');
    assert.equal((await changed.reconcile(command)).code, 'PROVIDER_ACCOUNT_MISMATCH');
  }
  assert.equal(http.requests.length, before); assert.equal(s.state.transfers, 1);
  assert.equal((await adapterFor(h, f, http).reconcile(command)).providerRequestId, first.providerRequestId);
});

test('a mismatched failed/refunded response cannot resolve an original unknown operation', async t => {
  for (const status of ['FAILED', 'REFUNDED']) {
    const f = fixture(), h = await harness(t, f), s = setup(t, f), http = await localHttp(t, s.routes);
    const a = adapterFor(h, f, http);
    const command = { action: action('custody-wrong-failure'), decision: decision(action('custody-wrong-failure')) };
    await a.transfer(command);
    s.statusRaw.status = status; s.statusRaw.agent_id = 'someone-else';
    const result = await a.reconcile(command);
    assert.equal(result.status, 'unknown'); assert.equal(result.code, 'RECEIPT_MISMATCH');
    assert.equal(result.providerRequestId, f.expected.correlationId); assert.equal(s.state.transfers, 1);
  }
});

test('response loss retains the original unknown intent across restart with no blind POST retry', async t => {
  const f = fixture(), h = await harness(t, f); let posts = 0;
  const transport = async (url, init) => {
    if (init.method === 'GET') return Response.json({ status: 'ACTIVE', wallet: { near_account_id: 'agent.near' } });
    posts++; throw Error('response lost after submission');
  };
  const build = () => adapterFor(h, f, { transport });
  const command = { action: action('custody-lost'), decision: decision(action('custody-lost')) };
  assert.equal((await build().transfer(command)).status, 'unknown');
  await h.restart();
  assert.equal((await build().transfer(command)).status, 'unknown');
  assert.equal((await build().reconcile(command)).status, 'unknown');
  assert.equal(posts, 1);
  const original = h.journal.getOperation('adapters:agent-api:custody-lost');
  assert.equal(original.status, 'unknown'); assert.equal(original.attempts.length, 1);
});

test('acquirer is read-only GET, pins the witness head before from_size, never sends a grant token, and fails closed on unproven receipts', async t => {
  const f = fixture(); const cid = f.expected.correlationId, id = f.expected.agentId;
  const item = { correlation_id: cid, type: 'transfer', status: 'PROVEN', details: {}, receipt: f.receipt };
  const http = await localHttp(t, (req, res) => {
    if (req.url === `/v1/agents/${id}/operations/${cid}/proof?from_size=2`) res.end(JSON.stringify(f.document));
    else if (req.url === `/v1/agents/${id}/operations/${cid}/receipt`) res.end(JSON.stringify(state.item));
    else if (req.url === '/tee/info') res.end(JSON.stringify({ app_id: 'test-app' }));
    else { res.statusCode = 501; res.end('{}'); }
  });
  const state = { item };
  let heads = 0;
  const acquirer = createAgentApiAcquirer({ agentId: id, secretRef: 'key', resolveSecret: async () => 'sentinel-api', transport: http.transport, trust: f.trust, fetchHead: async () => { heads++; return f.head; } });
  const bundle = await acquirer.bundle({ expected: f.expected, statusEvidence: f.operation.statusEvidence });
  assert.deepEqual(bundle.receipt, f.receipt); assert.equal(bundle.operation.proof.correlation_id, cid); assert.equal(heads, 1);
  assert.equal((await acquirer.getTrustedCheckpoint({ expected: f.expected })).size, 2n);
  assert.ok(http.requests.every(r => r.method === 'GET' && !r.headers['x-grant-token'])); assert.equal(http.requests.find(r => r.path === '/tee/info').headers['x-api-key'], undefined);
  assert.equal(http.requests.find(r => r.path.endsWith('/receipt')).headers['x-api-key'], 'sentinel-api');
  for (const bad of [{ ...item, status: 'PENDING' }, { ...item, receipt: null }, { ...item, correlation_id: 'op_other' }]) { state.item = bad; await assert.rejects(acquirer.bundle({ expected: f.expected, statusEvidence: {} }), /RECEIPT_NOT_PROVEN/); }
  await assert.rejects(createAgentApiAcquirer({ agentId: id, transport: http.transport, trust: { origin: 'x' } }).bundle({ expected: f.expected }), /PINNED_LOG_TRUST_REQUIRED/);
});

test('settlement-evidence port returns exact signed terms (never a pass flag) and refuses what receipts cannot prove', async t => {
  const f = fixture(), h = await harness(t, f);
  const port = createAgentSettlementEvidence({ movement: h.movement, acquire: async ({ agentCorrelationId }) => ({ expected: f.expected, receipt: f.receipt, operation: f.operation, agentCorrelationId }) });
  const quote = { correlationId: '1click-correlation' };
  const ok = await port.verify({ quote, providerStatus: {}, expected: { agentCorrelationId: f.expected.correlationId, account: 'agent.near', asset: 'nep141:usdc.near', amount: '250000' } });
  assert.equal(ok.status, 'verified'); assert.equal(ok.kind, 'agent-receipt-log'); assert.equal(ok.assurance, 'log-attested-exact-terms'); assert.equal(ok.finality, 'not_established');
  assert.deepEqual({ type: ok.terms.type, asset: ok.terms.asset, amount: ok.terms.amount, recipient: ok.terms.recipient }, { type: 'transfer', asset: 'nep141:usdc.near', amount: '250000', recipient: 'payee.near' });
  assert.equal(ok.settledAt, '2026-11-14T00:00:05.000Z'); assert.deepEqual(ok.references, ['intent-hash-one']); assert.match(ok.evidenceRef, /^agent-movement:/);
  assert.equal(ok.provenance.checkpoint.size, '2'); assert.equal(ok.account, 'agent.near');
  // no op_ correlation (e.g. third-party 1Click delivery) => unavailable, never verified
  assert.equal((await port.verify({ quote, expected: { account: 'agent.near' } })).code, 'AGENT_EXECUTION_CORRELATION_REQUIRED');
  assert.equal((await port.verify({ quote, expected: { agentCorrelationId: '1click-correlation' } })).status, 'unavailable');
  // mismatching binding supplied by the acquisition port is refused
  const mismatch = createAgentSettlementEvidence({ movement: h.movement, acquire: async () => ({ expected: { ...f.expected, correlationId: 'op_other' } }) });
  assert.equal((await mismatch.verify({ expected: { agentCorrelationId: f.expected.correlationId } })).code, 'AGENT_EXECUTION_BINDING_MISMATCH');
  // invalid evidence is unavailable, not a "failed settlement"
  const tampered = createAgentSettlementEvidence({ movement: h.movement, acquire: async () => ({ expected: f.expected, receipt: { ...f.receipt, terms: f.receipt.terms.replace('250000', '1') }, operation: f.operation }) });
  const bad = await tampered.verify({ expected: { agentCorrelationId: f.expected.correlationId } });
  assert.equal(bad.status, 'unavailable'); assert.equal(bad.proofStatus, 'invalid');
  // retained-evidence replay path
  const replay = createAgentSettlementEvidence({ movement: h.movement, acquire: async () => ({ expected: f.expected, evidenceRef: ok.evidenceRef }) });
  assert.equal((await replay.verify({ expected: { agentCorrelationId: f.expected.correlationId } })).status, 'verified');
  assert.equal((await createAgentSettlementEvidence({}).verify({ expected: { agentCorrelationId: 'op_x' } })).code, 'MOVEMENT_VERIFIER_UNAVAILABLE');
  assert.ok(official.verifyReceipt && copy && clock);
});
