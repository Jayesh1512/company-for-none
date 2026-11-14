import test from 'node:test';
import assert from 'node:assert/strict';
import {projectChainRecords} from '../../src/rules/onchain-ledger.mjs';
import {COMMITTABLE_TYPES} from '../../src/onchain/ledger-autocommit.mjs';
import {ledgerCompanyHash} from '../../src/rules/onchain-ledger.mjs';

const companyId = 'local-workspace';

test('spend and delegation events are ledger-safe (not downgraded to private.event)', () => {
  const events = [
    {sequence: 1, type: 'agent.started', at: '2026-11-14T10:00:00.000Z', data: {companyId, actorId: 'agent-a'}},
    {sequence: 2, type: 'agent.delegated', at: '2026-11-14T10:00:01.000Z', data: {companyId, parentAgentId: 'agent-a', childAgentId: 'agent-b'}},
    {sequence: 3, type: 'spend.requested', at: '2026-11-14T10:00:02.000Z', data: {companyId, actorId: 'agent-a', asset: 'nep141:usdc', amount: '200000'}},
    {sequence: 4, type: 'spend.completed', at: '2026-11-14T10:00:03.000Z', data: {companyId, actorId: 'agent-a', txHash: 'abc'}},
    {sequence: 5, type: 'agent.stopped', at: '2026-11-14T10:00:04.000Z', data: {companyId, actorId: 'agent-a'}},
  ];
  const {records} = projectChainRecords(events, companyId);
  const types = records.map(r => r.type);
  assert.deepEqual(types, ['agent.started', 'agent.delegated', 'spend.requested', 'spend.completed', 'agent.stopped']);
  assert.ok(!types.includes('private.event'), 'no event was downgraded to private.event');
});

test('delegation record commits parent and child identities as distinct hashes', () => {
  const events = [{sequence: 1, type: 'agent.delegated', at: '2026-11-14T10:00:00.000Z', data: {companyId, parentAgentId: 'agent-a', childAgentId: 'agent-b'}}];
  const {records} = projectChainRecords(events, companyId);
  assert.equal(records[0].type, 'agent.delegated');
  // actorHash commits to the parent, payloadHash to the whole event (which includes the child).
  assert.match(records[0].actorHash, /^[a-f0-9]{64}$/);
  assert.match(records[0].payloadHash, /^[a-f0-9]{64}$/);
  assert.notEqual(records[0].actorHash, records[0].payloadHash);
});

test('a different child produces a different payloadHash for the same parent', () => {
  const a = projectChainRecords([{sequence: 1, type: 'agent.delegated', at: '2026-11-14T10:00:00.000Z', data: {companyId, parentAgentId: 'p', childAgentId: 'c1'}}], companyId);
  const b = projectChainRecords([{sequence: 1, type: 'agent.delegated', at: '2026-11-14T10:00:00.000Z', data: {companyId, parentAgentId: 'p', childAgentId: 'c2'}}], companyId);
  assert.equal(a.records[0].actorHash, b.records[0].actorHash);
  assert.notEqual(a.records[0].payloadHash, b.records[0].payloadHash);
});

test('committable types cover agent lifecycle, delegation and spend', () => {
  for (const t of ['agent.started', 'agent.stopped', 'agent.created', 'agent.delegated', 'work.queued', 'work.completed', 'spend.requested', 'spend.completed']) {
    assert.ok(COMMITTABLE_TYPES.includes(t), `${t} is committable`);
  }
});

test('ledger company hash is stable for the company id', () => {
  assert.equal(ledgerCompanyHash(companyId), ledgerCompanyHash(companyId));
  assert.match(ledgerCompanyHash(companyId), /^[a-f0-9]{64}$/);
});
