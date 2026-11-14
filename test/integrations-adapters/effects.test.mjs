import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureCustodyAdapter as createCustodyAdapter, createFixtureCloudFundingAdapter as createCloudFundingAdapter, createFixtureInferenceAdapter as createInferenceAdapter } from './fixture-adapters.mjs';
import { createCloudFundingAdapter as createRealCloudFundingAdapter } from '../../src/cloud-funding/index.mjs';
import { createJournal } from '../../src/journal/index.mjs';
import { fingerprint, assertExternalResult } from '../../src/contracts.mjs';
import { clock, money, decision, gate, journalFor, transferAction, fundingAction, request, inferenceAction, credit } from './fixtures.mjs';

const factories = [
  ['custody', createCustodyAdapter, transferAction, 'transfer'],
  ['funding', createCloudFundingAdapter, fundingAction, 'fund'],
  ['inference', createInferenceAdapter, id => inferenceAction(id, request()), 'generate'],
];
for (const [name, factory, makeAction, method] of factories) {
  test(`${name}: requires M01 allow + final dispatch, executes once under concurrency`, async t => {
    const journal = await journalFor(t);
    let dispatches = 0;
    const adapter = factory({ mode: 'fixture', journal, clock, fixtureOutput: () => 'Evidence-based fixture output',
      dispatchAuthorized: (ctx, cb) => { dispatches++; return gate(ctx, cb); } });
    const action = makeAction(name);
    const command = { action, decision: decision(action), request: request(), credit };
    const denied = await adapter[method]({ ...command, decision: { ...command.decision, status: 'deny' } });
    assert.equal(denied.status, 'not_submitted');
    const results = await Promise.all([adapter[method](command), adapter[method](command)]);
    assert.equal(results.filter(r => r.status === 'confirmed').length >= 1, true);
    assert.equal(dispatches, 1);
    assert.equal((await adapter[method](command)).status, 'confirmed');
    assert.equal(dispatches, 1);
    assert.equal(adapter.capabilities().simulated, true);
    results.forEach(assertExternalResult);
    const changed = { ...action, recipient: 'different-recipient' };
    assert.equal((await adapter[method]({ ...command, action: changed, decision: decision(changed) })).code, 'CONFLICT');
  });
  test(`${name}: unknown submission survives restart; reconciliation does not repeat effect`, async t => {
    let journal = await journalFor(t);
    const directory = journal.directory;
    let dispatches = 0;
    const scenarios = { lost: { lostResponse: true, reconcileStatus: 'pending' } };
    const options = () => ({ mode: 'fixture', journal, clock, scenarios, fixtureOutput: () => 'Fixture recovered output',
      dispatchAuthorized: (ctx, cb) => { dispatches++; return gate(ctx, cb); } });
    let adapter = factory(options());
    const action = makeAction('lost');
    const command = { action, decision: decision(action), request: request(), credit };
    assert.equal((await adapter[method](command)).status, 'unknown');
    await journal.close();
    journal = await createJournal({ directory, clock });
    adapter = factory(options());
    assert.equal((await adapter[method](command)).status, 'unknown');
    assert.equal(dispatches, 1);
    assert.equal((await adapter.reconcile(command)).status, 'pending');
    scenarios.lost.reconcileStatus = 'confirmed';
    assert.equal((await adapter.reconcile(command)).status, 'confirmed');
    assert.equal(dispatches, 1);
    await journal.close();
  });
  test(`${name}: final hold or missing gate cannot dispatch`, async t => {
    const journal = await journalFor(t);
    const action = makeAction('held');
    const command = { action, decision: decision(action), request: request(), credit };
    const noGate = factory({ mode: 'fixture', journal, fixtureOutput: () => 'x' });
    assert.equal((await noGate[method](command)).status, 'not_submitted');
    const held = factory({ mode: 'fixture', journal, fixtureOutput: () => 'x', dispatchAuthorized: () => ({ status: 'hold', reasonCode: 'KILL_SWITCH' }) });
    const outcome = await held[method](command);
    assert.equal(outcome.status, 'not_submitted'); assert.equal(outcome.code, 'KILL_SWITCH');
  });
}

test('journal failure before durable submission prevents all effects', async t => {
  const journal = await journalFor(t, { fault: () => { throw new Error('disk unavailable'); } });
  let calls = 0;
  const adapter = createCustodyAdapter({ journal, mode: 'fixture', dispatchAuthorized: (ctx, cb) => { calls++; return cb(); } });
  const action = transferAction('disk');
  await assert.rejects(adapter.transfer({ action, decision: decision(action) }), /disk unavailable/);
  assert.equal(calls, 0);
});

test('funding absent is unsupported; owner prepaid credit is never a purchase', () => {
  const a = createRealCloudFundingAdapter({ mode: 'live' });
  assert.equal(a.capabilities().autonomousPurchaseSupported, false);
  const observation = a.observeCredit({ credit: { availableNanoUsd: '10', fundingProvenance: 'owner_prepaid' } });
  assert.equal(observation.kind, 'credit_observation'); assert.equal(observation.autonomousPurchase, false);
  assert.equal(observation.status, 'not_submitted'); assert.equal(observation.code, 'CREDIT_EVIDENCE_UNVERIFIED');
});

test('inference preserves delayed and failed billed costs, request bound is immutable', async t => {
  const journal = await journalFor(t);
  const scenarios = { cost: { costPending: true }, failed: { status: 'failed', actualCostNanoUsd: '19' } };
  const a = createInferenceAdapter({ mode: 'fixture', journal, dispatchAuthorized: gate, scenarios, fixtureOutput: () => 'source-linked output', clock });
  const req = request(); const action = inferenceAction('cost', req);
  const command = { action, request: req, decision: decision(action), credit };
  const initial = await a.generate(command);
  assert.equal(initial.status, 'confirmed'); assert.equal(initial.cost.actualCostNanoUsd, null);
  assert.equal((await a.reconcile(command)).cost.actualCostNanoUsd, '10000000');
  assert.equal((await a.generate({ ...command, request: { ...req, model: 'other' } })).code, 'CONFLICT');
  const failedAction = inferenceAction('failed', req);
  const failed = await a.generate({ ...command, action: failedAction, decision: decision(failedAction) });
  assert.equal(failed.status, 'failed'); assert.equal(failed.cost.actualCostNanoUsd, '19');
  const tooBig = { ...req, maxInputBytes: 1 }; const bigAction = inferenceAction('big', tooBig);
  assert.equal((await a.generate({ ...command, action: bigAction, request: tooBig, decision: decision(bigAction) })).code, 'INVALID_INPUT');
});
