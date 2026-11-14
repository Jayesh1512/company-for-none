import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

const stores = new Map();
const clone = value => structuredClone(value);
const empty = () => ({ schemaVersion: 1, version: 0, records: {}, events: [], operations: {}, artifacts: {}, commands: {} });

export class JournalError extends Error {
  constructor(code, message) { super(message); this.name = 'JournalError'; this.code = code; }
}
const fail = (code, message) => { throw new JournalError(code, message); };
function safe(value) {
  if (value === undefined) fail('INVALID_INPUT', 'Undefined is not a durable value');
  const json = JSON.stringify(value, (key, item) => {
    if (/^(privateKey|secretKey|apiKey|password|seedPhrase|authorization|credential)$/i.test(key)) fail('INVALID_INPUT', 'Raw credentials cannot be journaled');
    if (typeof item === 'bigint' || typeof item === 'function' || typeof item === 'symbol' || (typeof item === 'number' && !Number.isFinite(item))) fail('INVALID_INPUT', 'Durable values must be JSON data');
    return item;
  });
  return JSON.parse(json);
}
const requireId = id => { if (typeof id !== 'string' || !id || ['__proto__', 'constructor', 'prototype'].includes(id)) fail('INVALID_INPUT', 'Invalid record identity'); };
const hash = value => createHash('sha256').update(value).digest('hex');
const statuses = ['not_submitted', 'pending', 'confirmed', 'failed', 'unknown'];

/** One local application process owns a directory. Concurrent handles share its queue. */
export async function createJournal({ directory, clock = () => new Date(), fault } = {}) {
  if (!directory) fail('INVALID_INPUT', 'A caller-selected journal directory is required');
  const root = path.resolve(directory);
  if (stores.has(root)) return stores.get(root);
  const opening = open();
  stores.set(root, opening);
  try { return await opening; } catch (error) { stores.delete(root); throw error; }

  async function open() {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const file = path.join(root, 'journal.json');
    const lock = path.join(root, 'writer.lock');
    const owner = { pid: process.pid, hostname: hostname(), nonce: randomUUID() };
    let recoveryClaim;
    // A dead local process cannot still write. Never steal an active/foreign/unknown lock.
    try {
      const prior = JSON.parse(await fs.readFile(lock, 'utf8'));
      if (prior.hostname !== hostname()) fail('STORE_BUSY', 'Journal is owned by another host');
      let dead = false;
      try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') dead = true; }
      if (!dead) fail('STORE_BUSY', 'Journal already has an active writer');
      if (typeof prior.nonce !== 'string' || !/^[a-f0-9-]+$/.test(prior.nonce)) fail('STORE_BUSY', 'Journal writer lock needs inspection');
      // Elect one reclaimer for this exact dead owner. A delayed opener must never
      // unlink a replacement writer's lock after another opener already recovered.
      recoveryClaim = path.join(root, `recovery-${prior.nonce}.lock`);
      try { const claim = await fs.open(recoveryClaim, 'wx', 0o600); await claim.close(); }
      catch (error) { if (error.code === 'EEXIST') fail('STORE_BUSY', 'Journal recovery is already claimed'); throw error; }
      const current = JSON.parse(await fs.readFile(lock, 'utf8'));
      if (current.nonce !== prior.nonce) { await fs.unlink(recoveryClaim); fail('STORE_BUSY', 'Another writer recovered the journal'); }
      await fs.unlink(lock);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      const lockHandle = await fs.open(lock, 'wx', 0o600);
      try { await lockHandle.writeFile(JSON.stringify(owner)); await lockHandle.sync(); }
      finally { await lockHandle.close(); }
    } finally { if (recoveryClaim) await fs.unlink(recoveryClaim).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    let state;
    try { state = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') { await fs.unlink(lock); throw error; } state = empty(); }
    if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.version) || !state.commands || !state.operations) {
      await fs.unlink(lock); fail('CORRUPT_STORE', 'Unsupported or corrupt journal snapshot');
    }
    let queue = Promise.resolve();
    let closed = false;
    const now = () => new Date(clock()).toISOString();

    async function persist(next) {
      const temp = path.join(root, `.journal-${randomUUID()}.tmp`);
      let committed = false;
      try {
        const handle = await fs.open(temp, 'wx', 0o600);
        try { await handle.writeFile(JSON.stringify(next)); await handle.sync(); } finally { await handle.close(); }
        await fault?.('beforeRename');
        await fs.rename(temp, file);
        committed = true;
        state = next; // After rename, a thrown fsync/fault is an uncertain commit, never rollback.
        const dir = await fs.open(root, 'r');
        try { await dir.sync(); } finally { await dir.close(); }
        await fault?.('afterRename');
      } catch (error) {
        if (committed) throw new JournalError('COMMIT_UNKNOWN', 'Commit may be durable; replay the same action identity');
        throw error;
      } finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }

    const api = {
      directory: root,
      snapshot() { return clone(state); },
      get(namespace, id) { requireId(namespace); requireId(id); return clone(state.records[namespace]?.[id] ?? null); },
      list(namespace) { requireId(namespace); return clone(Object.values(state.records[namespace] ?? {})); },
      events({ afterSequence = 0 } = {}) { return clone(state.events.filter(event => event.sequence > afterSequence)); },
      getOperation(actionId) { requireId(actionId); return clone(state.operations[actionId] ?? null); },
      operationHistory(actionId) { requireId(actionId); return clone(state.operations[actionId]?.history ?? []); },
      recoverableOperations() { return clone(Object.values(state.operations).filter(op => ['pending', 'unknown'].includes(op.status))); },
      transaction(command, mutate) {
        const work = queue.then(async () => {
          if (closed) fail('STORE_CLOSED', 'Journal is closed');
          const { actionId, fingerprint, expectedVersion } = command;
          requireId(actionId);
          if (typeof fingerprint !== 'string' || !fingerprint) fail('INVALID_INPUT', 'Immutable command fingerprint required');
          const prior = state.commands[actionId];
          if (prior) {
            if (prior.fingerprint !== fingerprint) fail('CONFLICT', 'Action identity reused with different contents');
            return { replayed: true, version: prior.version, result: clone(prior.result) };
          }
          if (expectedVersion !== undefined && expectedVersion !== state.version) fail('CONFLICT', 'Journal version changed; reevaluate');
          const next = clone(state);
          const tx = {
            get(namespace, id) { requireId(namespace); requireId(id); return clone(next.records[namespace]?.[id] ?? null); },
            list(namespace) { requireId(namespace); return clone(Object.values(next.records[namespace] ?? {})); },
            put(namespace, id, value, { expectedVersion: expected } = {}) {
              requireId(namespace); requireId(id);
              const previous = next.records[namespace]?.[id];
              if (expected !== undefined && (previous?.version ?? 0) !== expected) fail('CONFLICT', 'Record version changed; reevaluate');
              next.records[namespace] ??= {};
              next.records[namespace][id] = safe(value);
            },
            append(type, data = {}) {
              requireId(type);
              const event = { sequence: next.events.length + 1, type, at: now(), data: safe(data) };
              next.events.push(event); return clone(event);
            },
            getOperation(id) { requireId(id); return clone(next.operations[id] ?? null); },
            operation(intent) {
              requireId(intent.actionId);
              if (!intent.fingerprint) fail('INVALID_INPUT', 'Operation fingerprint required');
              if (intent.status && !statuses.includes(intent.status)) fail('INVALID_INPUT', 'Invalid operation outcome');
              const existing = next.operations[intent.actionId];
              if (existing) {
                if (existing.fingerprint !== intent.fingerprint) fail('CONFLICT', 'Operation fingerprint mismatch');
                return clone(existing);
              }
              const operation = safe({ ...intent, status: intent.status ?? 'not_submitted', attempts: intent.attempts ?? [], history: [], createdAt: now() });
              next.operations[intent.actionId] = operation; return clone(operation);
            },
            updateOperation(id, patch) {
              requireId(id);
              const existing = next.operations[id];
              if (!existing) fail('INVALID_INPUT', 'Operation not registered');
              if ((patch.fingerprint && patch.fingerprint !== existing.fingerprint) || (patch.actionId && patch.actionId !== id)) fail('CONFLICT', 'Operation identity is immutable');
              for (const key of ['purpose', 'orderId', 'obligationId', 'network', 'provider', 'payload']) {
                if (Object.hasOwn(patch, key) && JSON.stringify(patch[key]) !== JSON.stringify(existing[key])) fail('CONFLICT', 'Operation intent is immutable');
              }
              if (patch.status && !statuses.includes(patch.status)) fail('INVALID_INPUT', 'Invalid operation outcome');
              if (existing.status === 'confirmed' && patch.status && patch.status !== 'confirmed') fail('CONFLICT', 'Confirmed effect cannot be erased by a later uncertain observation');
              if (Object.hasOwn(patch, 'history')) fail('CONFLICT', 'Operation history is append-only');
              next.operations[id] = safe({ ...existing, ...patch, history: [...(existing.history ?? []), { at: now(), ...safe(patch) }], updatedAt: now() });
              return clone(next.operations[id]);
            },
          };
          const result = mutate(tx);
          if (result && typeof result.then === 'function') fail('INVALID_INPUT', 'Journal transaction callbacks must be synchronous');
          next.version++;
          const durableResult = safe(result ?? null);
          next.commands[actionId] = { fingerprint, version: next.version, result: durableResult };
          await persist(next);
          return { replayed: false, version: next.version, result: clone(durableResult) };
        });
        queue = work.catch(() => {}); return work;
      },
      async registerOperation(intent) {
        return api.transaction({ actionId: `operation:${intent.actionId}`, fingerprint: intent.fingerprint }, tx => tx.operation(intent));
      },
      async recordOperationResult(actionId, result, { eventId = randomUUID() } = {}) {
        return api.transaction({ actionId: `operation-result:${actionId}:${eventId}`, fingerprint: hash(JSON.stringify(safe(result))) }, tx => tx.updateOperation(actionId, { status: result.status, result }));
      },
      async putArtifact({ actionId, content, mediaType = 'text/plain' }) {
        if (typeof content !== 'string') fail('INVALID_INPUT', 'Artifact content must be text');
        const digest = hash(content);
        const ref = { id: digest, hash: digest, visibility: 'private', mediaType };
        await api.transaction({ actionId, fingerprint: hash(JSON.stringify({ ref, content })) }, tx => {
          tx.put('privateArtifacts', digest, { ...ref, content }); return ref;
        });
        return ref;
      },
      getArtifact(ref) {
        const artifact = api.get('privateArtifacts', ref.id);
        if (!artifact || artifact.hash !== ref.hash) fail('INVALID_INPUT', 'Artifact reference mismatch');
        return artifact;
      },
      async close() {
        await queue;
        if (closed) return;
        closed = true;
        const current = JSON.parse(readFileSync(lock, 'utf8'));
        if (current.nonce === owner.nonce) await fs.unlink(lock);
        stores.delete(root);
      },
    };
    return api;
  }
}
