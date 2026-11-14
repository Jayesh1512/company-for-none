import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournal } from '../../src/journal/index.mjs';
import { fingerprint } from '../../src/contracts.mjs';

export const clock = () => new Date('2026-11-14T12:00:00.000Z');
export async function journalFor(t) {
  const directory = await mkdtemp(join(tmpdir(), 'near1-funding-'));
  const journal = await createJournal({ directory, clock });
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return journal;
}
export const decision = action => ({ status: 'allow', actionFingerprint: fingerprint(action), permit: { id: `permit:${action.id}`, actionFingerprint: fingerprint(action), actionId: action.id } });
export const gate = ({ action, decision: d }, callback) =>
  d.status !== 'allow' || d.actionFingerprint !== fingerprint(action) || d.permit.actionFingerprint !== fingerprint(action) ? { status: 'deny', reasonCode: 'ACTION_MISMATCH' } : callback();
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// Records every request; handler returns a Response (or throws to simulate a lost response).
export function recorder(handler) {
  const calls = [];
  const transport = async (url, init = {}) => { const call = { url: String(url), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body }; calls.push(call); return handler(call); };
  return { calls, transport };
}
