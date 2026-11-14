import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournal } from '../../src/journal/index.mjs';
import { fingerprint } from '../../src/contracts.mjs';

export const clock = () => new Date('2026-11-10T20:00:00.000Z');
export const money = (amount = '5000000') => ({ network: 'fixture', asset: 'demo-usdc', decimals: 6, amount });
export const decision = action => ({ status: 'allow', actionFingerprint: fingerprint(action),
  permit: { id: `permit:${action.id}`, actionFingerprint: fingerprint(action), actionId: action.id } });
export function gate({ action, decision: d }, callback) {
  if (d.status !== 'allow' || d.actionFingerprint !== fingerprint(action) || d.permit.actionFingerprint !== fingerprint(action)) return { status: 'deny', reasonCode: 'ACTION_MISMATCH' };
  return callback();
}
export async function journalFor(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'near1-adapters-'));
  const journal = await createJournal({ directory, clock, ...options });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return journal;
}
export const transferAction = id => ({ id, type: 'payout', recipient: 'fixture-contributor', money: money('1000000'), mode: 'fixture' });
export const fundingAction = id => ({ id, type: 'funding', recipient: 'fixture-cloud', money: money('500000'),
  requiredCreditNanoUsd: '50000000', agentId: 'fixture-agent', creditId: `credit:${id}`, mode: 'fixture' });
export const request = () => ({ model: 'fixture-research', messages: [{ role: 'user', content: 'Research supplied evidence.' }],
  maxInputBytes: 1000, maxOutputTokens: 1000, timeoutMs: 10000,
  chargeBound: { maxCostNanoUsd: '20000000' }, evidence: { sources: [] } });
export const inferenceAction = (id, req) => ({ id, type: 'inference', mode: 'fixture', requestFingerprint: fingerprint(req), maxCostNanoUsd: req.chargeBound.maxCostNanoUsd });
export const credit = { status: 'confirmed', availableNanoUsd: '50000000', fundingProvenance: 'owner_prepaid' };
export const offer = id => ({ id, orderId: `order:${id}`, price: money(), treasuryAccount: 'fixture-treasury',
  createdAt: '2026-11-10T19:59:00.000Z', expiresAt: '2026-11-10T20:15:00.000Z', mode: 'fixture' });
export const quoteCommand = id => { const action = { id: `quote:${id}`, type: 'offer', mode: 'fixture' }; return {
  action, offer: offer(id), sourceAsset: { network: 'fixture', asset: 'demo-usdc', decimals: 6 },
  recipient: 'fixture-treasury', refundTo: 'fixture-customer', decision: decision(action),
}; };
