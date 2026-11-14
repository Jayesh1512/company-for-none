import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createCustodyAdapter } from '../../src/custody/index.mjs';
import { createAgentApiCustody } from '../../src/custody/agent-api.mjs';
import { createPaymentsAdapter } from '../../src/payments/index.mjs';
import { createInferenceAdapter } from '../../src/inference/index.mjs';
import { createCloudFundingAdapter } from '../../src/cloud-funding/index.mjs';
import { createOperationRuntime } from '../../src/custody/adapter-runtime.mjs';
import { createFixtureCustodyAdapter, createFixturePaymentsAdapter } from './fixture-adapters.mjs';
import { gate, journalFor, transferAction, decision, quoteCommand, clock } from './fixtures.mjs';

test('real provider factories reject fixture mode and absent configuration without synthetic results or traffic', async () => {
  let calls = 0;
  const options = { mode: 'fixture', transport: () => { calls++; throw new Error('must not send'); }, resolveSecret: () => { calls++; return 'ambient-secret'; }, secretRef: 'present', grantRef: 'present', accountId: 'agent.near', agentId: 'agent', balanceSource: 'confidential', network: 'near:mainnet' };
  const factories = [createCustodyAdapter, createAgentApiCustody, createPaymentsAdapter, createInferenceAdapter, createCloudFundingAdapter];
  for (const factory of factories) {
    const a = factory(options); assert.equal(a.capabilities().mode, 'unavailable'); assert.equal(a.capabilities().simulated, false);
    const operation = a.transfer ?? a.quote ?? a.generate ?? a.fund;
    assert.equal((await operation({ action: { id: 'never' } })).status, 'not_submitted');
  }
  assert.equal(calls, 0);
  const defaults = factories.map(factory => factory());
  for (const a of defaults) assert.equal(a.capabilities().mode, 'unavailable');
});

test('fixture factory cannot execute a real transport even when one is injected', async t => {
  const journal = await journalFor(t);
  let calls = 0;
  const a = createFixtureCustodyAdapter({ journal, dispatchAuthorized: gate, mode: 'live', transport: () => { calls++; throw new Error('must not send'); }, resolveSecret: () => { calls++; return 'ambient'; } });
  const action = transferAction('test-only');
  assert.equal((await a.transfer({ action, decision: decision(action) })).simulated, true); assert.equal(calls, 0);
});

test('explicit undefined fixture scenario options preserve test composition defaults', async t => {
  const journal = await journalFor(t);
  const a = createFixturePaymentsAdapter({ journal, clock, scenarios: undefined });
  const { quote } = await a.quote(quoteCommand('undefined-options'));
  assert.equal((await a.verifySettlement({ action: { id: 'pending-payment' }, quote })).status, 'pending');
  const custody = createFixtureCustodyAdapter({ journal, dispatchAuthorized: gate, clock: undefined, scenarios: undefined });
  const action = transferAction('undefined-custody');
  assert.equal((await custody.transfer({ action, decision: decision(action) })).status, 'confirmed');
});

test('durable operations cannot replay across a changed mode/provider', async t => {
  const journal = await journalFor(t); const action = transferAction('old-operation'); const payload = { action };
  const prior = createOperationRuntime({ journal, namespace: 'isolation', meta: { provider: 'historical', mode: 'fixture', simulated: true }, dispatchAuthorized: gate });
  await prior.execute({ action, decision: decision(action), payload, send: () => ({ status: 'confirmed', mode: 'fixture' }) });
  let calls = 0;
  const current = createOperationRuntime({ journal, namespace: 'isolation', meta: { provider: 'real-provider', mode: 'live', simulated: false }, dispatchAuthorized: () => { calls++; } });
  assert.equal((await current.execute({ action, decision: decision(action), payload, send: () => { calls++; } })).code, 'PROVIDER_MODE_MISMATCH');
  assert.equal((await current.reconcile(action, () => { calls++; })).code, 'PROVIDER_MODE_MISMATCH'); assert.equal(calls, 0);
});

test('provider transitive import graphs contain no test factories or synthetic helpers', async () => {
  const root = resolve('src'); const visited = new Set();
  async function inspect(file) {
    if (visited.has(file)) return; visited.add(file);
    assert.ok(file.startsWith(root + '/'), file);
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /fixtureRef|fixtureScenario|fixtureOutput|fixtureQuotes|fixture-custody|fixture-cloud|fixture-only-do-not-send/);
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.')) await inspect(resolve(dirname(file), match[1]));
    }
  }
  for (const dir of ['custody', 'payments', 'cloud-funding', 'inference']) {
    for (const file of await readdir(resolve(root, dir))) if (file.endsWith('.mjs')) await inspect(resolve(root, dir, file));
  }
});
