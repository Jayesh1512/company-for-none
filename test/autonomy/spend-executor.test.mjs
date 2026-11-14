import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createSpendExecutor} from '../../src/workflow/spend.mjs';

const USDC = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const request = {id: 'cmd:spend', companyId: 'c', actorId: 'agent-1', asset: USDC, amount: '25000', purpose: 'buy inference', state: 'proposed', admission: {commandHash: 'h'}};

async function setup({ledger}) {
  const journal = await createJournal({directory: await mkdtemp(path.join(os.tmpdir(), 'spend-exec-'))});
  await journal.transaction({actionId: 'seed', fingerprint: 'seed'}, tx => { tx.put('spendRequests', request.id, request); return null; });
  const sent = [];
  const agentSpend = {capability: () => ({configured: true}), spend: async r => { sent.push(r); return {status: 'SUCCESS', correlationId: 'op_1', txHash: null}; }};
  return {journal, sent, executor: createSpendExecutor({journal, agentSpend, ledger, companyId: 'c'})};
}

test('a completed spend persists the exact ledger commitment so it can be re-verified', async () => {
  const appended = [];
  const {journal, sent, executor} = await setup({ledger: {append: async events => { appended.push(events); return {txHash: 'TX1', correlationId: 'op_2'}; }}});
  const result = await executor.execute(request.id);
  const saved = journal.get('spendRequests', request.id);
  assert.equal(result.status, 'completed');
  assert.equal(sent[0].kind, 'swap');
  assert.notEqual(sent[0].destination, USDC); // a swap must move between two different assets
  assert.equal(saved.ledgerCommit.txHash, 'TX1');
  assert.deepEqual({type: saved.ledgerCommit.type, data: saved.ledgerCommit.data}, appended[0][0]); // verbatim: the verifier recomputes the payload hash from it
  assert.equal(saved.ledgerCommit.data.spendId, request.id);
  await journal.close();
});

test('a ledger failure never fabricates a ledger link or undoes the spend result', async () => {
  const {journal, executor} = await setup({ledger: {append: async () => { throw new Error('LEDGER_APPEND_FAILED'); }}});
  const result = await executor.execute(request.id);
  const saved = journal.get('spendRequests', request.id);
  assert.equal(result.status, 'completed');
  assert.equal(saved.state, 'completed');
  assert.equal(saved.ledgerCommit, undefined);
  await journal.close();
});
