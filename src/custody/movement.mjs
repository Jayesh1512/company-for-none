import { createHash } from 'node:crypto';
import { fingerprint } from '../contracts.mjs';
import { validateExpected } from './proofs.mjs';

// Exact-terms movement evidence from the Agent API's own transparency log.
//
// What this proves (SDK 0.9.0 verifyReceipt + the operation proof): the API's
// witness-cosigned log recorded THIS agent's execution `correlationId` as settled
// with exactly these signed terms. What it does NOT prove: independent on-chain
// movement or finality (docs: confidential transfers settle "on the provider's
// word"), who funded an inbound deposit, or any absolute balance. The result is
// therefore labelled `log-attested-exact-terms` and never grants authority.
export const MOVEMENT_ASSURANCE = 'log-attested-exact-terms';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const hexOnly = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const HASH_FIELDS = ['intent_hash', 'transfer_intent_hash', 'tx_hash', 'destination_tx_hash', 'settlement_tx_hash', 'receipt_hash'];
const error = (code, status = 'invalid') => Object.assign(new Error(code), { code, proofStatus: status });
const check = (condition, code, status) => { if (!condition) throw error(code, status); };
const emptyStages = () => Object.fromEntries(['receipt', 'terms', 'operation'].map(key => [key, { status: 'unavailable' }]));

function checkpointData(head, origin) {
  check(head?.origin === origin && typeof head.size === 'bigint' && head.size >= 0n && head.root instanceof Uint8Array && head.root.length === 32 && Array.isArray(head.extensions), 'TRUSTED_CHECKPOINT_INVALID', 'unavailable');
  return { origin: head.origin, size: head.size.toString(), root: Buffer.from(head.root).toString('hex'), extensions: [...head.extensions] };
}
function checkpointValue(head, origin) {
  check(head?.origin === origin && /^(0|[1-9][0-9]*)$/.test(head.size ?? '') && hexOnly(head.root) && Array.isArray(head.extensions), 'CAPTURE_CHECKPOINT_INVALID');
  return { origin, size: BigInt(head.size), root: Uint8Array.from(Buffer.from(head.root, 'hex')), extensions: [...head.extensions] };
}
async function limited(port, input, timeoutMs) {
  const controller = new AbortController(); let timer;
  try {
    return await Promise.race([Promise.resolve().then(() => port({ ...input, signal: controller.signal })), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(error('VERIFICATION_PORT_UNAVAILABLE', 'unavailable')); }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
function validateTrust(trust, readTile) {
  check(record(trust) && text(trust.origin) && hexOnly(trust.witnessPublicKey) && text(trust.apiBaseUrl), 'PINNED_LOG_TRUST_REQUIRED', 'unavailable');
  check(new URL(trust.apiBaseUrl).protocol === 'https:', 'HTTPS_LOG_REQUIRED', 'unavailable');
  check(typeof readTile === 'function' || (text(trust.logUrl) && new URL(trust.logUrl).protocol === 'https:'), 'PINNED_LOG_TILE_SOURCE_REQUIRED', 'unavailable');
}
/** Compares exact signed receipt terms to the admitted request body. Pure; no network. */
export function compareReceiptTerms(expected, terms) {
  const body = expected.payload;
  check(terms.type === expected.action, 'RECEIPT_TYPE_MISMATCH');
  check(body.confidential === true && terms.confidential === true, 'CONFIDENTIAL_RECEIPT_REQUIRED');
  if (terms.type === 'transfer') {
    for (const key of ['asset', 'amount', 'recipient']) check(text(body[key]) && terms[key] === body[key], `RECEIPT_${key.toUpperCase()}_MISMATCH`);
    check(terms.reference === body.reference, 'RECEIPT_REFERENCE_MISMATCH');
  } else if (terms.type === 'deposit') {
    check(text(body.origin_asset) && terms.origin_asset === body.origin_asset, 'RECEIPT_ORIGIN_ASSET_MISMATCH');
    if (body.destination_asset !== undefined) check(terms.destination_asset === body.destination_asset, 'RECEIPT_DESTINATION_ASSET_MISMATCH');
    if (body.amount !== undefined) check(terms.amount === body.amount, 'RECEIPT_AMOUNT_MISMATCH');
  } else throw error('RECEIPT_ACTION_UNSUPPORTED', 'unavailable');
}

/**
 * Private composition ports only: trust, checkpoint and tile sources are never read
 * from receipt/proof JSON. `proofs` is a createAgentProofs instance (audit + TDX).
 * No funds, signing, provisioning or financial-state methods exist here.
 */
export function createAgentMovement({ journal, trust, proofs, sdk, getReceiptCheckpoint, readTile, clock = () => new Date(), limits = {} } = {}) {
  const bounds = { maxCaptureBytes: 2 * 1024 * 1024, timeoutMs: 10000, ...limits };
  for (const key of ['maxCaptureBytes', 'timeoutMs']) check(Number.isSafeInteger(bounds[key]) && bounds[key] > 0, 'INVALID_VERIFIER_LIMITS');
  const loadSdk = async () => sdk ?? import('@near-intents-agent-api/sdk');
  const pinned = trust ? structuredClone(trust) : null;
  const sdkId = { name: '@near-intents-agent-api/sdk', version: '0.9.0' };

  async function verifyReceipt(official, receipt, checkpoint) {
    const tiles = readTile ?? official.logTileReader(pinned.logUrl);
    try {
      return await limited(({ signal }) => official.verifyReceipt(receipt, { origin: pinned.origin, trusted: checkpoint, readTile: path => tiles(path, { signal }) }), {}, bounds.timeoutMs);
    } catch (failure) {
      if (failure?.code === 'VERIFICATION_PORT_UNAVAILABLE') throw failure;
      if (failure?.name === 'ReceiptNotCoveredError') throw error('RECEIPT_NOT_COVERED_BY_TRUSTED_CHECKPOINT', 'pending');
      if (failure?.name === 'LogUnavailableError') throw error('LOG_UNAVAILABLE', 'unavailable');
      throw error('RECEIPT_INVALID');
    }
  }

  async function verify({ expected, receipt, operation }, checkpoint, mode) {
    const stages = emptyStages();
    const base = { sdk: sdkId, scope: MOVEMENT_ASSURANCE, assurance: MOVEMENT_ASSURANCE, independentChainFinality: 'not_established',
      correlationId: expected?.correlationId ?? null, stages, grantsSpendingAuthority: false, grantsDeliveryAuthority: false };
    let active = 'receipt';
    try {
      check(pinned, 'PINNED_LOG_TRUST_REQUIRED', 'unavailable'); validateTrust(pinned, readTile); validateExpected(expected);
      check(['transfer', 'deposit'].includes(expected.action), 'RECEIPT_ACTION_UNSUPPORTED', 'unavailable');
      check(record(receipt), 'RECEIPT_REQUIRED', 'unavailable');
      const official = await loadSdk();
      const verified = await verifyReceipt(official, receipt, checkpoint);
      check(verified.correlationId === expected.correlationId, 'RECEIPT_CORRELATION_MISMATCH');
      stages.receipt = { status: 'verified', leafIndex: verified.leafIndex.toString(), settledAt: verified.settledAt };
      active = 'terms';
      compareReceiptTerms(expected, verified.terms);
      stages.terms = { status: 'verified', type: verified.terms.type };
      active = 'operation';
      const proofResult = mode.replayRef
        ? await proofs.replay({ evidenceRef: mode.replayRef, expected, scope: 'terms' })
        : await proofs.capture({ proof: operation?.proof, statusEvidence: operation?.statusEvidence,
          teeEvidence: operation?.teeEvidence, expected, scope: 'terms' });
      stages.operation = { status: proofResult.status, code: proofResult.code, evidenceRef: proofResult.evidenceRef ?? null };
      check(proofResult.status === 'verified' && proofResult.correlationId === expected.correlationId && proofResult.scope === 'attested-audit-binding-and-tdx', proofResult.code ?? 'OPERATION_PROOF_UNAVAILABLE', ['pending', 'unavailable'].includes(proofResult.status) ? proofResult.status : 'invalid');
      const committed = proofResult.committed;
      check(record(committed) && committed.accountId === expected.accountId, 'COMMITTED_ACCOUNT_MISMATCH');
      for (const key of HASH_FIELDS) if (verified.terms[key] !== undefined && committed.hashes?.[key] !== undefined) check(committed.hashes[key] === verified.terms[key], 'RECEIPT_EVIDENCE_HASH_MISMATCH');
      const { type, ...rest } = verified.terms;
      return { operationEvidenceRef: proofResult.evidenceRef, result: { ...base, status: 'verified', code: 'EXACT_TERMS_LOG_ATTESTED', receiptType: type, terms: { type, ...rest },
        account: expected.accountId, accountBinding: 'operation-proof-committed-evidence', committed: { depositAddress: committed.depositAddress ?? null },
        references: [...new Set([...(rest.reference !== undefined ? [rest.reference] : []), ...HASH_FIELDS.map(key => rest[key]).filter(text), ...(committed.depositAddress ? [committed.depositAddress] : [])])],
        settledAt: verified.settledAt, provenance: { leafIndex: verified.leafIndex.toString(), checkpoint: checkpointData(checkpoint, pinned.origin) } } };
    } catch (failure) {
      stages[active] = { ...stages[active], status: failure.proofStatus ?? 'unavailable', code: failure.code ?? 'VERIFICATION_UNAVAILABLE' };
      return { result: { ...base, status: failure.proofStatus ?? 'unavailable', code: failure.code ?? 'VERIFICATION_UNAVAILABLE' } };
    }
  }

  async function persist({ expected, receipt }, checkpoint, operationEvidenceRef, result) {
    check(journal, 'PRIVATE_CAPTURE_STORAGE_REQUIRED', 'unavailable');
    const capture = { schemaVersion: 1, kind: 'agent-movement-receipt', expected, receipt, operationEvidenceRef, trustedCheckpoint: checkpointData(checkpoint, pinned.origin), trustFingerprint: fingerprint(pinned), sdk: sdkId, capturedAt: new Date(clock()).toISOString(), verifiedTerms: result.terms };
    const content = JSON.stringify(capture);
    check(Buffer.byteLength(content) <= bounds.maxCaptureBytes, 'PROOF_CAPTURE_TOO_LARGE');
    const artifact = await journal.putArtifact({ actionId: `agent-movement-artifact:${sha256(content)}`, content, mediaType: 'application/json' });
    const expectedFingerprint = fingerprint(expected);
    await journal.transaction({ actionId: `agent-movement-capture:${artifact.hash}`, fingerprint: fingerprint(artifact) }, tx => {
      // A receipt's correlation id is accepted once: it can never be re-attributed to another request.
      const owner = tx.get('agentMovementByCorrelation', expected.correlationId);
      if (owner && owner.expectedFingerprint !== expectedFingerprint) throw error('CORRELATION_ALREADY_ATTRIBUTED');
      tx.put('agentMovementCaptures', artifact.hash, { artifact, trustFingerprint: capture.trustFingerprint, expectedFingerprint });
      tx.put('agentMovementByCorrelation', expected.correlationId, { expectedFingerprint, evidenceHash: owner?.evidenceHash ?? artifact.hash });
      return null;
    });
    return `agent-movement:${artifact.hash}`;
  }

  return {
    async capture({ expected, receipt, operation } = {}) {
      const failed = (failure) => ({ status: failure.proofStatus ?? 'unavailable', code: failure.code ?? 'TRUSTED_CHECKPOINT_UNAVAILABLE', scope: MOVEMENT_ASSURANCE, assurance: MOVEMENT_ASSURANCE, independentChainFinality: 'not_established', stages: emptyStages(), evidenceRef: null, grantsSpendingAuthority: false, grantsDeliveryAuthority: false });
      let checkpoint;
      try {
        check(pinned, 'PINNED_LOG_TRUST_REQUIRED', 'unavailable'); validateTrust(pinned, readTile); validateExpected(expected);
        check(Buffer.byteLength(JSON.stringify({ expected, receipt, operation })) <= bounds.maxCaptureBytes, 'PROOF_CAPTURE_TOO_LARGE');
        const official = await loadSdk();
        // Fresh witness-signed head (pinned key) or an administrator port. Never from receipt JSON.
        checkpoint = getReceiptCheckpoint ? await limited(getReceiptCheckpoint, { trust: structuredClone(pinned), expected: structuredClone(expected) }, bounds.timeoutMs)
          : await limited(() => official.fetchWitnessCheckpoint(pinned.apiBaseUrl, pinned.origin, pinned.witnessPublicKey), {}, bounds.timeoutMs);
        checkpointData(checkpoint, pinned.origin);
      } catch (failure) { return failed(failure); }
      const outcome = await verify({ expected, receipt, operation }, checkpoint, {});
      if (outcome.result.status !== 'verified') return outcome.result;
      try { return { ...outcome.result, operationEvidenceRef: outcome.operationEvidenceRef, evidenceRef: await persist({ expected, receipt }, checkpoint, outcome.operationEvidenceRef, outcome.result) }; }
      catch (failure) { return { ...outcome.result, status: 'unavailable', code: failure.code === 'CORRELATION_ALREADY_ATTRIBUTED' ? failure.code : 'PRIVATE_CAPTURE_UNAVAILABLE', evidenceRef: null }; }
    },
    async replay({ evidenceRef, expected } = {}) {
      try {
        check(pinned, 'PINNED_LOG_TRUST_REQUIRED', 'unavailable'); validateTrust(pinned, readTile); validateExpected(expected);
        check(typeof evidenceRef === 'string' && /^agent-movement:[a-f0-9]{64}$/.test(evidenceRef), 'PRIVATE_CAPTURE_REFERENCE_REQUIRED');
        const hash = evidenceRef.slice('agent-movement:'.length), reference = journal?.get('agentMovementCaptures', hash);
        check(reference?.artifact?.hash === hash, 'PRIVATE_CAPTURE_NOT_FOUND', 'unavailable');
        const artifact = journal.getArtifact(reference.artifact);
        check(typeof artifact.content === 'string' && Buffer.byteLength(artifact.content) <= bounds.maxCaptureBytes && sha256(artifact.content) === hash, 'PRIVATE_CAPTURE_HASH_MISMATCH');
        const saved = JSON.parse(artifact.content);
        check(saved.schemaVersion === 1 && saved.kind === 'agent-movement-receipt' && fingerprint(saved.sdk) === fingerprint(sdkId), 'PRIVATE_CAPTURE_SCHEMA_INVALID');
        check(saved.trustFingerprint === fingerprint(pinned) && reference.trustFingerprint === saved.trustFingerprint, 'CAPTURE_TRUST_POLICY_CHANGED', 'unavailable');
        check(fingerprint(expected) === fingerprint(saved.expected) && reference.expectedFingerprint === fingerprint(expected), 'CAPTURE_EXPECTED_BINDING_MISMATCH');
        // Re-run official receipt verification (retained independent head + live tiles) and the
        // operation proof. Stored terms/flags are inspected, never trusted.
        const outcome = await verify({ expected, receipt: saved.receipt }, checkpointValue(saved.trustedCheckpoint, pinned.origin), { replayRef: saved.operationEvidenceRef });
        if (outcome.result.status === 'verified') check(fingerprint(outcome.result.terms) === fingerprint(saved.verifiedTerms), 'CAPTURE_TERMS_CHANGED');
        return { ...outcome.result, evidenceRef, replayScope: 'retained-trusted-checkpoint' };
      } catch (failure) {
        return { status: failure.proofStatus ?? 'invalid', code: failure.code ?? 'PRIVATE_CAPTURE_INVALID', scope: MOVEMENT_ASSURANCE, assurance: MOVEMENT_ASSURANCE, independentChainFinality: 'not_established', stages: emptyStages(), evidenceRef: evidenceRef ?? null, grantsSpendingAuthority: false, grantsDeliveryAuthority: false };
      }
    },
  };
}
