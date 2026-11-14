import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createLedgerAutoCommit} from '../../src/onchain/ledger-autocommit.mjs';

test('auto-commit appends new events once, advances the cursor and survives restart', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cfn-autocommit-'));
  const journal = await createJournal({directory});
  const calls = {append: 0};
  const committer = {append: async () => { calls.append += 1; return {txHash: `tx${calls.append}`}; }};

  await journal.transaction({actionId: 'a1', fingerprint: 'f1'}, tx => {
    tx.append('agent.started', {companyId: 'c', actorId: 'agent-a'});
    tx.append('notes', {companyId: 'c'});
  });
  await journal.transaction({actionId: 'a2', fingerprint: 'f2'}, tx => {
    tx.append('spend.completed', {companyId: 'c', actorId: 'agent-a'});
  });
  t.after(async () => { await journal.close(); await rm(directory, {recursive: true, force: true}); });

  const auto = createLedgerAutoCommit({journal, committer, companyId: 'c'});
  const first = await auto.tick();
  assert.equal(first.committed, 2, 'commits the two committable events, not the ignored note');
  assert.equal(first.txHash, 'tx1');

  const second = await auto.tick();
  assert.equal(second.committed, 0, 'nothing new to commit');
  assert.equal(calls.append, 1, 'one append, no replay');

  const restarted = createLedgerAutoCommit({journal, committer, companyId: 'c'});
  assert.equal((await restarted.tick()).committed, 0, 'a restart does not re-append committed events');
});
