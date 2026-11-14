import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fingerprint } from '../../src/contracts.mjs';
import { createJournal } from '../../src/journal/index.mjs';
import { createAgentProofs, DSTACK_VERIFIER_IMAGE } from '../../src/custody/proofs.mjs';
import { createAgentMovement } from '../../src/custody/movement.mjs';

// Synthetic, test-only signed log. Node Ed25519 signs; the REAL official SDK verifies.
// The TDX verdict and tile source are controlled stand-ins, never live vendor evidence.
export const digest = input => createHash('sha256').update(input).digest();
export const sha = input => digest(input).toString('hex');
export const copy = value => structuredClone(value);
const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const leafOf = opening => digest(Buffer.concat([Buffer.from([0]), digest(opening)]));
const node = (left, right) => digest(Buffer.concat([Buffer.from([1]), left, right]));
const openingOf = (fields, salt) => Buffer.from(`near-intents-agent-api/audit/v1\n${JSON.stringify(sorted({ ...fields, salt: Buffer.alloc(32, salt).toString('base64') }))}`);

export const BODY = Object.freeze({ confidential: true, asset: 'nep141:usdc.near', amount: '250000', recipient: 'payee.near' });
export function fixture({ body = BODY, action = 'transfer', terms: suppliedTerms, resourceId = 'op_test_transfer', evidence: suppliedEvidence, reference } = {}) {
  const origin = 'agent-proof-test.invalid/log';
  const payload = reference === undefined ? copy(body) : { ...copy(body), reference };
  const expected = { agentId: 'a'.repeat(64), accountId: 'agent.near', correlationId: resourceId, action, payload, requiredEvent: 'execute.completed', requestFingerprint: fingerprint(payload) };
  const evidence = suppliedEvidence ?? { type: action, near_account_id: expected.accountId, request: copy(payload), intent_hash: 'intent-hash-one' };
  const evidenceJson = JSON.stringify(evidence);
  const eventOpening = openingOf({ agentId: expected.agentId, resourceId, action: 'execute.completed', createdAt: '2026-11-14T00:00:00.000Z', evidenceHash: sha(evidenceJson) }, 7);
  const terms = suppliedTerms ?? { type: 'transfer', asset: payload.asset, amount: payload.amount, recipient: payload.recipient, confidential: true, ...(reference === undefined ? {} : { reference }), intent_hash: 'intent-hash-one' };
  const termsJson = typeof terms === 'string' ? terms : JSON.stringify(terms);
  const receiptOpening = openingOf({ resourceId, action: 'execute.receipt', createdAt: '2026-11-14T00:00:05.000Z', evidenceHash: sha(termsJson) }, 8);
  const [eventLeaf, receiptLeaf] = [leafOf(eventOpening), leafOf(receiptOpening)];
  const root = node(eventLeaf, receiptLeaf);
  const checkpointText = `${origin}\n2\n${root.toString('base64')}\n`;
  const log = generateKeyPairSync('ed25519'), notary = generateKeyPairSync('ed25519');
  const pub = pair => pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const keyId = (name, type, pair) => digest(Buffer.concat([Buffer.from(name), Buffer.from([10, type]), pub(pair)])).subarray(0, 4);
  const verifierKey = (name, type, pair) => `${name}+${keyId(name, type, pair).toString('hex')}+${Buffer.concat([Buffer.from([type]), pub(pair)]).toString('base64')}`;
  const cosignedAt = 1791000000n, timestamp = Buffer.alloc(8); timestamp.writeBigUInt64BE(cosignedAt);
  const cosignature = Buffer.concat([timestamp, sign(null, Buffer.from(`cosignature/v1\ntime ${cosignedAt}\n${checkpointText}`), notary.privateKey)]);
  const notaryName = 'agent-proof-test.invalid/notary';
  const note = `${checkpointText}\n— ${origin} ${Buffer.concat([keyId(origin, 1, log), sign(null, Buffer.from(checkpointText), log.privateKey)]).toString('base64')}\n— ${notaryName} ${Buffer.concat([keyId(notaryName, 4, notary), cosignature]).toString('base64')}\n`;
  const signingAddress = Buffer.concat([pub(log), pub(notary)]);
  const birthReportData = Buffer.concat([digest(Buffer.concat([Buffer.from('near-intents-agent-api/notary-birth/v1'), signingAddress])), Buffer.alloc(32)]).toString('hex');
  const document = { agent_id: expected.agentId, correlation_id: resourceId, origin, checkpoint: note, consistency: null,
    notary: { log_key: verifierKey(origin, 1, log), notary_key: verifierKey(notaryName, 4, notary), signing_address: signingAddress.toString('hex'), birth: { report_data: birthReportData, previous: null, attestation: 'synthetic-not-a-live-TDX-quote' } },
    events: [{ action: 'execute.completed', created_at: '2026-11-14T00:00:00.000Z', status: 'PROVEN', proof: `c2sp.org/tlog-proof@v1\nextra ${eventOpening.toString('base64')}\nindex 0\n${receiptLeaf.toString('base64')}\n\n${note}`, evidence: evidenceJson }] };
  const receipt = { version: 1, origin, leaf_index: '1', opening: receiptOpening.toString('utf8'), terms: termsJson };
  const kmsRoot = '02' + '7'.repeat(64);
  const compose = JSON.stringify({ key_provider: 'kms', key_provider_id: kmsRoot, gateway_enabled: false, docker_compose_file: 'synthetic fixture' });
  const trust = { origin, apiBaseUrl: 'https://agent-proof-test.invalid', logUrl: 'https://log.agent-proof-test.invalid/', witnessPublicKey: '1'.repeat(64), expectedAppId: 'test-app', allowedComposeHashes: [sha(compose)], allowedOsImageHashes: ['2'.repeat(64)], kmsRoot, dstackVerifierImage: DSTACK_VERIFIER_IMAGE, network: 'near:mainnet' };
  const info = { app_id: 'test-app', compose_hash: sha(compose), os_image_hash: '2'.repeat(64), app_compose: compose };
  const quoteReply = { source: 'dstack-verifier', verifierImage: DSTACK_VERIFIER_IMAGE, quoteHash: sha(document.notary.birth.attestation), verdict: { is_valid: true, details: { report_data: birthReportData, os_image_is_dev: null, tcb_status: 'UpToDate', advisory_ids: [], app_info: { app_id: info.app_id, compose_hash: info.compose_hash, os_image_hash: info.os_image_hash } } } };
  const operation = { proof: document, statusEvidence: { agent_id: expected.agentId, correlation_id: resourceId, type: action, status: 'SUCCESS' }, teeEvidence: { info } };
  const head = { origin, size: 2n, root: Uint8Array.from(root), extensions: [] };
  const opTrusted = { origin, size: 0n, root: Uint8Array.from(digest(Buffer.alloc(0))), extensions: [] };
  const tiles = new Map([['tile/0/000.p/2', Uint8Array.from(Buffer.concat([eventLeaf, receiptLeaf]))]]);
  const readTile = async tilePath => tiles.get(tilePath) ?? null;
  return { expected, receipt, operation, trust, quoteReply, head, opTrusted, readTile, tiles, document, termsJson };
}

export async function harness(t, f, overrides = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'near1-custody-'));
  let journal = await createJournal({ directory });
  const calls = { quote: 0, tiles: 0, head: 0 };
  const build = (extra = {}) => {
    const o = { trust: f.trust, ...overrides, ...extra };
    const proofs = createAgentProofs({ journal, trust: o.trust, getTrustedCheckpoint: async () => f.opTrusted, verifyTeeQuote: async () => { calls.quote++; return copy(f.quoteReply); }, ...(o.proofs ?? {}) });
    const movement = createAgentMovement({ journal, trust: o.trust, proofs, getReceiptCheckpoint: async () => { calls.head++; return f.head; },
      readTile: async (p, i) => { calls.tiles++; return f.readTile(p, i); }, ...(o.movement ?? {}) });
    return { proofs, movement };
  };
  let current = build();
  t.after(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });
  return { calls, get journal() { return journal; }, get movement() { return current.movement; }, get proofs() { return current.proofs; },
    rebuild(extra) { current = build(extra); return current; },
    async restart(extra) { await journal.close(); journal = await createJournal({ directory }); current = build(extra); return current; } };
}
