import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createJournal } from '../../src/journal/index.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'one-journal-'));
  const journal = await createJournal({ directory });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return { directory, journal };
}

test('atomic facts/events, operation fingerprints, replay and version conflicts', async t => {
  const { journal } = await fixture(t);
  const applied = await journal.transaction({ actionId: 'sale:1', fingerprint: 'immutable:1', expectedVersion: 0 }, tx => {
    tx.put('orders', 'one', { version: 1, status: 'settled' }, { expectedVersion: 0 });
    tx.append('settlement', { orderId: 'one' });
    return { allocationId: 'allocation:one' };
  });
  assert.equal(applied.version, 1);
  assert.deepEqual(await journal.transaction({ actionId: 'sale:1', fingerprint: 'immutable:1', expectedVersion: 0 }, () => { throw Error('must not run'); }), { ...applied, replayed: true });
  await assert.rejects(journal.transaction({ actionId: 'sale:1', fingerprint: 'different' }, () => {}), { code: 'CONFLICT' });
  await assert.rejects(journal.transaction({ actionId: 'sale:2', fingerprint: 'two', expectedVersion: 0 }, () => {}), { code: 'CONFLICT' });
  await assert.rejects(journal.transaction({ actionId: 'partial', fingerprint: 'partial' }, tx => {
    tx.put('orders', 'two', { version: 1 }); tx.append('should-not-exist'); throw Error('interrupted');
  }), /interrupted/);
  assert.equal(journal.get('orders', 'two'), null);
  assert.equal(journal.events().length, 1);
  await journal.registerOperation({ actionId: 'effect', fingerprint: 'fp', purpose: 'inference' });
  await journal.recordOperationResult('effect', { status: 'unknown', evidence: { reference: 'request:one' } }, { eventId: 'lost' });
  await assert.rejects(journal.registerOperation({ actionId: 'effect', fingerprint: 'mutated' }), { code: 'CONFLICT' });
  assert.equal(journal.recoverableOperations()[0].status, 'unknown');
  assert.equal(journal.operationHistory('effect')[0].status, 'unknown');
});

test('concurrent handles use a single serialization queue and reject stale writes', async t => {
  const { journal, directory } = await fixture(t);
  const other = await createJournal({ directory });
  const results = await Promise.allSettled([journal, other].map((store, i) => store.transaction({ actionId: `race:${i}`, fingerprint: `${i}`, expectedVersion: 0 }, tx => tx.put('facts', 'winner', { version: 1, i }))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'CONFLICT').length, 1);
});

for (const point of ['beforeRename', 'afterRename']) {
  test(`SIGKILL at ${point} recovers the entire committed snapshot or none`, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'one-crash-'));
    let recovered;
    t.after(async () => { await recovered?.close(); await rm(directory, { recursive: true, force: true }); });
    const initial = await createJournal({ directory });
    await initial.transaction({ actionId: 'base', fingerprint: 'base' }, tx => tx.put('facts', 'base', { version: 1 }));
    await initial.close();
    const child = `import {createJournal} from ${JSON.stringify(new URL('../../src/journal/index.mjs', import.meta.url).href)};
      const journal=await createJournal({directory:${JSON.stringify(directory)},fault:point=>{if(point===${JSON.stringify(point)})process.kill(process.pid,'SIGKILL')}});
      await journal.transaction({actionId:'atomic',fingerprint:'atomic'},tx=>{tx.put('facts','allocation',{version:1});tx.put('facts','obligation',{version:1});tx.append('allocation',{id:'one'});return 'done'});`;
    await assert.rejects(promisify(execFile)(process.execPath, ['--input-type=module', '-e', child]), error => error.signal === 'SIGKILL');
    recovered = await createJournal({ directory });
    const committed = point === 'afterRename';
    assert.equal(Boolean(recovered.get('facts', 'allocation')), committed);
    assert.equal(Boolean(recovered.get('facts', 'obligation')), committed);
    assert.equal(recovered.events().length, committed ? 1 : 0);
    if (committed) assert.equal((await recovered.transaction({ actionId: 'atomic', fingerprint: 'atomic' }, () => { throw Error('no repeat'); })).replayed, true);
  });
}

test('private artifact references are durable; credentials and mutable read aliases are rejected', async t => {
  const { journal, directory } = await fixture(t);
  const ref = await journal.putArtifact({ actionId: 'report:1', content: '<script>untrusted report</script>', mediaType: 'text/markdown' });
  assert.equal(ref.visibility, 'private');
  assert.equal(journal.events().length, 0);
  assert.equal((await stat(path.join(directory, 'journal.json'))).mode & 0o077, 0);
  assert.equal(journal.getArtifact(ref).content, '<script>untrusted report</script>');
  await assert.rejects(journal.transaction({ actionId: 'secret', fingerprint: 'secret' }, tx => tx.put('facts', 'secret', { apiKey: 'raw' })), { code: 'INVALID_INPUT' });
  await assert.rejects(journal.transaction({ actionId: 'unsafe-id', fingerprint: 'unsafe' }, tx => tx.put('__proto__', 'x', {})), { code: 'INVALID_INPUT' });
  const copy = journal.snapshot(); copy.version = 99;
  assert.notEqual(journal.snapshot().version, 99);
  await journal.close();
  const restarted = await createJournal({ directory });
  try { assert.equal(restarted.getArtifact(ref).content, '<script>untrusted report</script>'); }
  finally { await restarted.close(); }
});
