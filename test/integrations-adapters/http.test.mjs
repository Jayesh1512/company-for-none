import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createCustodyAdapter } from '../../src/custody/index.mjs';
import { createPaymentsAdapter } from '../../src/payments/index.mjs';
import { createInferenceAdapter } from '../../src/inference/index.mjs';
import { createNearCloudClient } from '../../src/inference/http.mjs';
import { createAgentApiCustody } from '../../src/custody/agent-api.mjs';
import { fingerprint } from '../../src/contracts.mjs';
import { clock, decision, gate, journalFor } from './fixtures.mjs';

async function localHttp(t, handler) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    const body = text ? JSON.parse(text) : null;
    requests.push({ path: req.url, method: req.method, body, headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    try { await handler(req, res, body); } catch { res.statusCode = 500; res.end('{}'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { requests, transport: (url, init) => {
    const parsed = new URL(url);
    return fetch(base + (parsed.pathname === '/' ? '/rpc' : parsed.pathname) + parsed.search, init);
  } };
}

test('documented Cloud completion HTTP payload, inference-id cost lookup and delayed billing', async t => {
  const journal = await journalFor(t);
  const inferenceId = '77777777-7777-4777-8777-777777777777';
  let billed = false;
  const http = await localHttp(t, (req, res, body) => {
    if (req.url === '/v1/chat/completions') {
      res.setHeader('inference-id', inferenceId); res.setHeader('x-request-id', 'wrong-transport-id');
      res.end(JSON.stringify({ id: 'completion-one', model: 'documented-model',
        choices: [{ message: { content: 'Source-linked report output' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17, completion_tokens_details: { reasoning_tokens: 1 } } }));
    } else if (req.url === '/v1/billing/costs') {
      assert.deepEqual(body, { requestIds: [inferenceId] });
      res.end(JSON.stringify({ requests: [{ requestId: inferenceId, costNanoUsd: billed ? 1280000 : 0 }],
        ...(billed ? {} : { warning: 'Usage not found yet' }) }));
    } else { res.statusCode = 501; res.end('{}'); }
  });
  const client = createNearCloudClient({transport:http.transport,secretRef:'cloud-reference',resolveSecret:async()=> 'sentinel-protected-credential'});
  const request = { model: 'documented-model', messages: [{ role: 'user', content: 'Research evidence' }], maxOutputTokens:20, timeoutMs:1000 };
  const response=await client.complete(request);
  assert.equal(response.inferenceId,inferenceId);
  assert.equal(response.body.choices[0].message.content,'Source-linked report output');
  assert.deepEqual(http.requests[0].body,{model:request.model,messages:request.messages,max_completion_tokens:20,n:1,stream:false});
  assert.equal((await client.costs(inferenceId)).requests[0].costNanoUsd,0);
  billed=true;
  assert.equal((await client.costs(inferenceId)).requests[0].costNanoUsd,1280000);
  assert.equal(http.requests.filter(r=>r.path==='/v1/chat/completions').length,1);
  assert.ok(!JSON.stringify(journal.snapshot()).includes('sentinel-protected-credential'));
});

test('HTTP acceptance followed by socket loss stays unknown and never repeats paid POST', async t => {
  const journal = await journalFor(t);
  let accepted = 0;
  const http = await localHttp(t, (req, res) => { accepted++; res.destroy(); });
  const client=createNearCloudClient({transport:http.transport,resolveSecret:async()=> 'sentinel',secretRef:'protected-reference'});
  const verification={prepare:async({action,request})=>{
    const transport=await client.prepareComplete(request);
    const send=()=>transport();
    Object.defineProperties(send,{preflight:{value:{id:'test-preflight',status:'verified',requestFingerprint:action.requestFingerprint}},requestFingerprint:{value:action.requestFingerprint}});
    return send;
  }};
  const a = createInferenceAdapter({ mode: 'live', journal, clock, transport: http.transport,
    verification, dispatchAuthorized: gate });
  const request = { model: 'test-model', messages: [{ role: 'user', content: 'evidence' }], maxInputBytes: 1000,
    maxOutputTokens: 20, timeoutMs: 1000, chargeBound: { maxCostNanoUsd: '2000000', verified: true, completionTokensIncludeReasoning: true, reference: 'test-bound' } };
  const action = { id: 'lost-http', type: 'inference', maxCostNanoUsd: '2000000', requestFingerprint: fingerprint(request) };
  const command = { action, request, decision: decision(action), credit: { status: 'confirmed', availableNanoUsd: '2000000' } };
  assert.equal((await a.prepare(command)).status,'confirmed');
  assert.equal((await a.generate(command)).status, 'unknown');
  assert.equal((await a.generate(command)).status, 'unknown');
  assert.equal((await a.reconcile(command)).status, 'unknown'); assert.equal(accepted, 1);
});

test('OutLayer protected credential precedes final gate; native transfer finality verified through read-only NEAR tx', async t => {
  const journal = await journalFor(t);
  const http = await localHttp(t, (req, res, body) => {
    if (req.url === '/wallet/v1/address?chain=near') res.end(JSON.stringify({ near_account_id: 'agent.testnet', api_key: 'must-never-be-recorded' }));
    else if (req.url === '/wallet/v1/transfer') res.end(JSON.stringify({ status: 'success', request_id: 'outlayer-request', tx_hash: 'tx-one' }));
    else if (req.url === '/wallet/v1/requests/outlayer-request') res.end(JSON.stringify({ status: 'success', request_id: 'outlayer-request', tx_hash: 'tx-one' }));
    else if (req.url === '/rpc') {
      assert.equal(req.headers.authorization, undefined);
      assert.deepEqual(body.params, { tx_hash: 'tx-one', sender_account_id: 'agent.testnet', wait_until: 'FINAL' });
      res.end(JSON.stringify({ result: { final_execution_status: 'FINAL', status: { SuccessValue: '' },
        transaction: { hash: 'tx-one', signer_id: 'agent.testnet', receiver_id: 'contributor.testnet', actions: [{ Transfer: { deposit: '10' } }] },
        transaction_outcome: { outcome: { tokens_burnt: '2' } }, receipts_outcome: [{ outcome: { tokens_burnt: '3' } }] } }));
    } else { res.statusCode = 501; res.end('{}'); }
  });
  let resolves = 0;
  const a = createCustodyAdapter({ mode: 'testnet', network: 'near:testnet', accountId: 'agent.testnet', journal, clock,
    transport: http.transport, secretRef: 'protected-outlayer-reference', resolveSecret: async () => { resolves++; return 'sentinel-protected-key'; },
    dispatchAuthorized: (ctx, cb) => { assert.equal(resolves, 2); return gate(ctx, cb); } });
  const action = { id: 'outlayer-one', type: 'payout', recipient: 'contributor.testnet', money: { network: 'near:testnet', asset: 'near', decimals: 24, amount: '10' } };
  const command = { action, decision: decision(action) };
  assert.equal((await a.transfer(command)).status, 'pending');
  const confirmed = await a.reconcile(command);
  assert.equal(confirmed.status, 'confirmed'); assert.equal(confirmed.receipt.finalityVerified, true);
  assert.equal(confirmed.receipt.fees[0].money.amount, '5');
  assert.equal(confirmed.receipt.fees[1].status, 'pending');
  assert.equal(http.requests.filter(r => r.path === '/wallet/v1/transfer').length, 1);
  assert.ok(!JSON.stringify(journal.snapshot()).includes('sentinel-protected-key'));
  assert.ok(!JSON.stringify(journal.snapshot()).includes('must-never-be-recorded'));
});

test('Intents exact-output HTTP request captures raw envelope and refuses unsigned deposit instructions', async t => {
  const journal = await journalFor(t);
  const expiresAt = '2026-11-10T20:15:00.000Z';
  let quoted;
  const http = await localHttp(t, (req, res, body) => {
    if (req.url === '/v0/tokens') res.end(JSON.stringify([{ assetId: 'nep141:usdc.near', blockchain: 'near', decimals: 6 }]));
    else if (req.url === '/v0/quote') {
      quoted = body;
      res.end(JSON.stringify({ correlationId: 'provider-one', quoteRequest: body,
        quote: { amountIn: '5100000', amountOut: '5000000', depositAddress: 'deposit.near', deadline: expiresAt } }));
    } else if (req.url === '/v0/status?depositAddress=deposit.near') res.end(JSON.stringify({ status: 'SUCCESS', correlationId: 'provider-one', updatedAt: '2026-11-10T20:00:01.000Z',
      quoteResponse: { quoteRequest: quoted, quote: { depositAddress: 'deposit.near' } }, swapDetails: { amountOut: '5000000', destinationChainTxHashes: [{ hash: 'settled-tx' }] } }));
    else { res.statusCode = 501; res.end('{}'); }
  });
  const a = createPaymentsAdapter({ mode: 'live', journal, clock, transport: http.transport, slippageTolerance: 100 });
  const money = { network: 'near:mainnet', asset: 'nep141:usdc.near', decimals: 6, amount: '5000000' };
  const action = { id: 'quote-live-http', type: 'offer' };
  const outcome = await a.quote({ action, decision: decision(action), offer: { id: 'live-invoice', price: money, treasuryAccount: 'treasury.near', expiresAt },
    sourceAsset: { network: money.network, asset: money.asset, decimals: 6 }, recipient: 'treasury.near', refundTo: 'customer.near', expiresAt });
  assert.equal(quoted.swapType, 'EXACT_OUTPUT'); assert.equal(quoted.amount, '5000000');
  assert.equal(outcome.status, 'not_submitted'); assert.equal(outcome.code, 'QUOTE_SIGNATURE_INVALID');
  assert.equal(outcome.quote, undefined); assert.equal(outcome.proof.status, 'failed');
  assert.equal(journal.list('privateArtifacts').length, 1);
  assert.equal(http.requests.filter(r => r.path.startsWith('/v0/status')).length, 0);
});

test('Agent API SUCCESS and intent hash remain unknown without proof verification and do not repeat a transfer', async t => {
  const journal = await journalFor(t); let sent = 0;
  const action = { id: 'agent-effect', type: 'payout', mode: 'live', recipient: 'recipient.near', money: { network: 'near:mainnet', asset: 'nep141:token.near', decimals: 6, amount: '10' } };
  const providerResult = { status: 'SUCCESS', agent_id: 'agent-one', type: 'transfer', correlation_id: 'op-one',
    details: { near_account_id: 'agent.near', intent_hash: 'only-a-hash', request: { confidential: true, asset: action.money.asset, amount: '10', recipient: action.recipient } } };
  const http = await localHttp(t, (req, res, body) => {
    if (req.url === '/v1/agents/agent-one') res.end(JSON.stringify({ status: 'ACTIVE', wallet: { near_account_id: 'agent.near' } }));
    else if (req.url === '/v1/agents/agent-one/transfer') {
      sent++; assert.equal(req.headers['x-grant-token'], 'sentinel-grant');
      assert.deepEqual(body, providerResult.details.request); assert.ok(req.headers['idempotency-key']);
      res.end(JSON.stringify(providerResult));
    } else if (req.url === '/v1/status?correlation_id=op-one') res.end(JSON.stringify(providerResult));
    else { res.statusCode = 501; res.end('{}'); }
  });
  const a = createAgentApiCustody({ mode: 'live', journal, clock, dispatchAuthorized: gate, transport: http.transport,
    network: 'near:mainnet', balanceSource: 'confidential', agentId: 'agent-one', accountId: 'agent.near', secretRef: 'key', grantRef: 'grant',
    resolveSecret: async ref => ref === 'key' ? 'sentinel-api' : 'sentinel-grant' });
  const command = { action, decision: decision(action) };
  const first = await a.transfer(command);
  assert.equal(first.status, 'unknown'); assert.equal(first.code, 'EXECUTION_PROOF_UNVERIFIED');
  assert.equal(first.receipt.providerStatus, 'SUCCESS'); assert.equal(first.receipt.proofVerifiedLocally, false);
  assert.equal((await a.transfer(command)).status, 'unknown');
  assert.equal((await a.reconcile(command)).status, 'unknown'); assert.equal(sent, 1);
  assert.ok(!JSON.stringify(journal.snapshot()).includes('sentinel-grant'));
});

test('Agent audit port binds exact admitted provider body and still cannot promote money movement', async t => {
  const journal = await journalFor(t); let transfers = 0, captures = 0;
  const action = { id: 'agent-audit-only', type: 'payout', mode: 'live', recipient: 'recipient.near', money: { network: 'near:mainnet', asset: 'nep141:token.near', decimals: 6, amount: '10' } };
  const admitted = { confidential: true, asset: action.money.asset, amount: '10', recipient: action.recipient };
  const statusEvidence = { status: 'SUCCESS', agent_id: 'agent-one', type: 'transfer', correlation_id: 'op_original',
    details: { near_account_id: 'agent.near', intent_hash: 'hash-only', request: admitted } };
  const http = await localHttp(t, (req, res) => {
    if (req.url === '/v1/agents/agent-one') res.end(JSON.stringify({ status: 'ACTIVE', wallet: { near_account_id: 'agent.near' } }));
    else if (req.url === '/v1/agents/agent-one/transfer') { transfers++; res.end(JSON.stringify(statusEvidence)); }
    else if (req.url === '/v1/status?correlation_id=op_original') res.end(JSON.stringify(statusEvidence));
    else { res.statusCode = 501; res.end('{}'); }
  });
  // Contract-only audit port, not live TDX/settlement evidence. Even a complete
  // normalized audit finding must leave movement unverified in this adapter.
  const auditFinding = { status: 'verified', scope: 'attested-audit-and-recorded-near-finality', sdk: { name: '@near-intents-agent-api/sdk', version: '0.9.0' },
    stages: Object.fromEntries(['audit','binding','tee','finality'].map(key => [key, { status: 'verified' }])), evidenceRef: `agent-proof:${'a'.repeat(64)}` };
  const a = createAgentApiCustody({ mode: 'live', journal, clock, dispatchAuthorized: gate, transport: http.transport,
    network: 'near:mainnet', balanceSource: 'confidential', agentId: 'agent-one', accountId: 'agent.near', secretRef: 'key', grantRef: 'grant', resolveSecret: async () => 'sentinel',
    getProofInputs: async ({ expected }) => { assert.deepEqual(expected.payload, admitted); assert.equal(expected.requestFingerprint, fingerprint(admitted)); assert.notEqual(expected.requestFingerprint, fingerprint(action)); return { proof: 'contract-input', teeEvidence: { info: 'private-historical-info' } }; },
    proofs: { capture: async ({ expected, proof }) => { captures++; assert.deepEqual(expected.payload, admitted); assert.equal(proof, 'contract-input'); return auditFinding; }, replay: async () => auditFinding } });
  const command = { action, decision: decision(action) }; const first = await a.transfer(command);
  assert.equal(first.status, 'unknown'); assert.equal(first.code, 'MOVEMENT_PROOF_UNVERIFIED');
  assert.equal(first.receipt.auditProofVerifiedLocally, true); assert.equal(first.receipt.proofVerifiedLocally, false); assert.equal(first.receipt.movementVerification, 'unavailable');
  await a.transfer(command); await a.reconcile(command); assert.equal(transfers, 1); assert.equal(captures, 1);
});
