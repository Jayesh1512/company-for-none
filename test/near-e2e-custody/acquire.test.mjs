import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentApiAcquirer, createAgentMovement } from '../../src/custody/index.mjs';
import { createAgentProofs } from '../../src/custody/proofs.mjs';
import { fixture, harness, copy } from './fixtures.mjs';

test('acquired original proof and receipt verify together with the real SDK and retained independent head', async t => {
  const f = fixture(), h = await harness(t, f), requests = [];
  const acquirer = createAgentApiAcquirer({ agentId: f.expected.agentId, trust: f.trust,
    secretRef: 'key', resolveSecret: async () => 'test-key', fetchHead: async () => f.head,
    transport: async (url, init) => {
      requests.push({ url, init });
      const route = new URL(url).pathname;
      if (route.endsWith('/proof')) return Response.json(f.document);
      if (route.endsWith('/receipt')) return Response.json({ status: 'PROVEN', correlation_id: f.expected.correlationId, receipt: f.receipt });
      if (route === '/tee/info') return Response.json(f.operation.teeEvidence.info);
      throw Error('unexpected request');
    } });
  const inputs = await acquirer.bundle({ expected: f.expected, statusEvidence: f.operation.statusEvidence });
  const proofs = createAgentProofs({ journal: h.journal, trust: f.trust,
    getTrustedCheckpoint: acquirer.getTrustedCheckpoint, verifyTeeQuote: async () => copy(f.quoteReply) });
  const movement = createAgentMovement({ journal: h.journal, trust: f.trust, proofs,
    getReceiptCheckpoint: acquirer.getTrustedCheckpoint, readTile: f.readTile });
  const result = await movement.capture({ expected: f.expected, ...inputs });
  assert.equal(result.status, 'verified', result.code);
  assert.equal(result.assurance, 'log-attested-exact-terms');
  assert.equal(result.independentChainFinality, 'not_established');
  assert.equal(requests.length, 3);
  assert.ok(requests[0].url.endsWith('/proof?from_size=2'));
  assert.ok(requests.every(r => r.init.method === 'GET' && r.init.headers['X-Grant-Token'] === undefined));
  assert.equal((await movement.replay({ expected: f.expected, evidenceRef: result.evidenceRef })).status, 'verified');
  assert.equal(requests.length, 3, 'replay never re-queries the Agent API or sends a transfer');
});

test('acquisition rejects a foreign agent, malformed head and missing credentials without selecting another operation', async () => {
  const f = fixture(); let reads = 0, heads = 0;
  const options = { agentId: f.expected.agentId, trust: f.trust, fetchHead: async () => { heads++; return f.head; }, transport: async () => { reads++; throw Error(); } };
  const acquirer = createAgentApiAcquirer(options);
  await assert.rejects(acquirer.bundle({ expected: { ...f.expected, agentId: 'other-agent' } }), /AGENT_IDENTITY_MISMATCH/);
  assert.equal(heads, 0); assert.equal(reads, 0);
  await assert.rejects(acquirer.bundle({ expected: f.expected }), /CREDENTIAL_UNAVAILABLE/);
  assert.equal(reads, 0);
  const malformed = createAgentApiAcquirer({ ...options, fetchHead: async () => ({ ...f.head, origin: 'foreign-log' }) });
  await assert.rejects(malformed.bundle({ expected: f.expected }), /TRUSTED_CHECKPOINT_INVALID/);
  assert.equal(reads, 0);
  assert.throws(() => createAgentApiAcquirer({ maxBytes: 0 }), /INVALID_READ_LIMIT/);
});

test('oversized provider proof is cancelled while streaming; no receipt/info follow-up runs', async () => {
  const f = fixture(); let cancelled = false, reads = 0;
  const acquirer = createAgentApiAcquirer({ agentId: f.expected.agentId, trust: f.trust,
    secretRef: 'key', resolveSecret: async () => 'test-key', fetchHead: async () => f.head, maxBytes: 32,
    transport: async () => {
      reads++;
      return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(33)); }, cancel() { cancelled = true; } }));
    } });
  await assert.rejects(acquirer.bundle({ expected: f.expected }), /PROVIDER_RESPONSE_TOO_LARGE/);
  assert.equal(cancelled, true); assert.equal(reads, 1);
});
