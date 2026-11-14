import { createHash } from 'node:crypto';

// Wire parsing for the NEAR Agents Marketplace (market.near.ai): public catalog, A2A JSON-RPC and x402 challenge.
// It sells agent WORK (a task result). It has no license, skill-version or entitlement object.
export const MARKET_ORIGIN = 'https://market.near.ai';
export const SUPPLIER_KIND = 'near-agents-marketplace';
const bad = (code, message) => { throw Object.assign(new Error(message), { code }); };
const text = (x, max = 4096) => typeof x === 'string' && x.length > 0 && x.length <= max;
const atomic = x => typeof x === 'string' && /^(0|[1-9][0-9]*)$/.test(x);
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);

export const handleValid = h => typeof h === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(h);
export function agentOrigin(handle) { if (!handleValid(handle)) bad('INVALID_INPUT', 'Unsupported supplier handle.'); return `https://${handle}.market.near.ai`; }
export const a2aUrl = handle => `${agentOrigin(handle)}/a2a/v1`;
// Deterministic message id so every retry of the same order is the same supplier message.
export function messageIdFor(seed) {
  const h = createHash('sha256').update(String(seed)).digest(); h[6] = (h[6] & 0x0f) | 0x40; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex'); return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
export function sendMessageBody({ task, messageId, returnImmediately = false }) {
  if (!text(task, 200000)) bad('INVALID_INPUT', 'A nonempty task text is required.');
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'SendMessage', params: { message: { messageId, role: 'ROLE_USER', parts: [{ text: task }] },
    configuration: { historyLength: 0, ...(returnImmediately ? { returnImmediately: true } : {}) } } });
}
export const getTaskBody = taskId => JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'GetTask', params: { id: taskId, historyLength: 0 } });

export function parseCatalog(data) {
  if (!object(data) || !Array.isArray(data.agents)) bad('SUPPLIER_SCHEMA_INVALID', 'Catalog response has an unsupported shape.');
  return data.agents.filter(a => object(a) && handleValid(a.handle)).slice(0, 50).map(a => ({
    id: text(a.id, 128) ? a.id : null, handle: a.handle, name: text(a.name, 200) ? a.name : a.handle, category: text(a.category, 64) ? a.category : null,
    description: typeof a.description === 'string' ? a.description.slice(0, 1000) : '', availableNow: a.available_now === true,
    slaSeconds: Number.isSafeInteger(a.sla_seconds) ? a.sla_seconds : null, deliveredJobs: Number.isSafeInteger(a.delivered_jobs) ? a.delivered_jobs : null,
    // Catalog fields are supplier claims; they are never accepted-quality or price facts.
    claim: true }));
}

export function parseChallenge(data) {
  if (!object(data) || data.x402Version !== 2 || !Array.isArray(data.accepts)) bad('SUPPLIER_SCHEMA_INVALID', 'Not an x402 v2 challenge.');
  if (!data.accepts.length) bad('SUPPLIER_NOT_ACCEPTING_PAYMENT', 'The supplier deployment takes no payments.');
  return data.accepts.map(r => {
    if (!object(r) || r.scheme !== 'exact' || !text(r.network, 64) || !text(r.asset, 256) || !atomic(r.amount) || !text(r.payTo, 256) || !Number.isSafeInteger(r.maxTimeoutSeconds) || r.maxTimeoutSeconds <= 0) bad('SUPPLIER_SCHEMA_INVALID', 'Unsupported x402 payment row.');
    return structuredClone(r); // signed verbatim by the payer, never rewritten
  });
}

export const TASK_STATES = Object.freeze(['TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_COMPLETED', 'TASK_STATE_REJECTED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED']);
export function parseTask(task) {
  if (!object(task) || !text(task.id, 256) || !object(task.status) || !TASK_STATES.includes(task.status.state)) bad('SUPPLIER_SCHEMA_INVALID', 'Unsupported A2A task.');
  const artifacts = task.artifacts ?? [];
  if (!Array.isArray(artifacts)) bad('SUPPLIER_SCHEMA_INVALID', 'Unsupported A2A artifacts.');
  return { id: task.id, contextId: typeof task.contextId === 'string' ? task.contextId : null, state: task.status.state,
    timestamp: typeof task.status.timestamp === 'string' && Number.isFinite(Date.parse(task.status.timestamp)) ? task.status.timestamp : null, artifacts };
}
export function parseRpc(res, { sync }) {
  // `SendMessage` wraps the task as result.task; `GetTask` returns the task as result.
  const body = res.json();
  if (!object(body) || body.jsonrpc !== '2.0' || body.id !== (sync ? 1 : 2)) bad('SUPPLIER_SCHEMA_INVALID', 'Not the matching JSON-RPC response.');
  if (body.error) return { error: { code: Number.isSafeInteger(body.error.code) ? body.error.code : null, message: typeof body.error.message === 'string' ? body.error.message.slice(0, 300) : '' } };
  return { task: parseTask(sync ? body.result?.task : body.result) };
}
