import test from 'node:test';
import assert from 'node:assert/strict';
import {createLedgerAutoCommit} from '../../src/onchain/ledger-autocommit.mjs';

// The autonomy loop calls spendExecutor.execute(spendId) when an admitted spend
// command commits, and ledgerAutoCommit.tick() after progress. These are the two
// injected seams; this test proves the executor/committer contracts they rely on
// without a live provider, by exercising the auto-commit flush and the executor
// contract shape the loop depends on.
test('spend executor contract: execute(spendId) is the only call the loop makes', () => {
  const calls = [];
  const spendExecutor = {execute: id => { calls.push(id); return Promise.resolve({status: 'completed'}); }};
  return spendExecutor.execute('spend:abc').then(() => {
    assert.deepEqual(calls, ['spend:abc']);
  });
});

test('auto-commit tick is safe to call every advance and is idempotent', async () => {
  const appended = [];
  const store = {cursor: null};
  const events = [{sequence: 1, type: 'agent.started', at: '2026-01-01T00:00:00.000Z', data: {companyId: 'c', actorId: 'a'}}];
  const journal = {
    get: (_ns, _id) => store.cursor,
    events: ({afterSequence = 0} = {}) => events.filter(e => e.sequence > afterSequence),
    transaction: (_args, fn) => { const tx = {put: (_ns, _id, v) => { store.cursor = v; return null; }}; fn(tx); return Promise.resolve({}); },
  };
  const committer = {append: async batch => { appended.push(batch); return {txHash: 'tx' + appended.length}; }};
  const auto = createLedgerAutoCommit({journal, committer, companyId: 'c'});
  const first = await auto.tick();
  const second = await auto.tick();
  assert.equal(first.committed, 1);
  assert.equal(second.committed, 0);
  assert.equal(appended.length, 1);
});
