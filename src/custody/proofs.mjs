import { createHash } from 'node:crypto';
import { fingerprint } from '../contracts.mjs';

export const AGENT_PROOF_SDK = Object.freeze({ name: '@near-intents-agent-api/sdk', version: '0.9.0' });
export const DSTACK_VERIFIER_IMAGE = 'dstacktee/dstack-verifier@sha256:0ed61d60f6e0d44cf466e15dc6894f37152d8567cfa76bd8785a921b2d906c38';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const canonicalInteger = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
const error = (code, status = 'invalid') => Object.assign(new Error(code), { code, proofStatus: status });
const check = (condition, code, status) => { if (!condition) throw error(code, status); };
const emptyStages = () => Object.fromEntries(['audit', 'binding', 'tee', 'finality'].map(key => [key, { status: 'unavailable' }]));

function checkpointData(head, origin) {
  check(head?.origin === origin && typeof head.size === 'bigint' && head.size >= 0n && head.root instanceof Uint8Array && head.root.length === 32 && Array.isArray(head.extensions), 'TRUSTED_CHECKPOINT_INVALID', 'unavailable');
  return { origin: head.origin, size: head.size.toString(), root: Buffer.from(head.root).toString('hex'), extensions: [...head.extensions] };
}
function checkpointValue(head, origin) {
  check(head?.origin === origin && canonicalInteger(head.size) && hex(head.root) && Array.isArray(head.extensions), 'CAPTURE_CHECKPOINT_INVALID');
  return { origin, size: BigInt(head.size), root: Uint8Array.from(Buffer.from(head.root, 'hex')), extensions: [...head.extensions] };
}
export function validateExpected(expected) {
  check(record(expected) && ['agentId', 'accountId', 'correlationId', 'action'].every(key => text(expected[key])), 'EXPECTED_BINDING_REQUIRED');
  check(expected.correlationId.startsWith('op_') && expected.requiredEvent === 'execute.completed', 'EXECUTION_BINDING_REQUIRED');
  check(record(expected.payload) && hex(expected.requestFingerprint) && fingerprint(expected.payload) === expected.requestFingerprint, 'EXPECTED_PAYLOAD_FINGERPRINT_MISMATCH');
  return structuredClone(expected);
}
function validateTrust(trust) {
  check(record(trust) && text(trust.origin) && hex(trust.witnessPublicKey) && text(trust.apiBaseUrl), 'PINNED_LOG_TRUST_REQUIRED', 'unavailable');
  check(new URL(trust.apiBaseUrl).protocol === 'https:', 'HTTPS_LOG_REQUIRED', 'unavailable');
  check(text(trust.expectedAppId) && Array.isArray(trust.allowedComposeHashes) && trust.allowedComposeHashes.length > 0 && trust.allowedComposeHashes.every(hex) && Array.isArray(trust.allowedOsImageHashes) && trust.allowedOsImageHashes.length > 0 && trust.allowedOsImageHashes.every(hex) && text(trust.kmsRoot), 'PINNED_TDX_DEPLOYMENT_REQUIRED', 'unavailable');
  check(trust.dstackVerifierImage === DSTACK_VERIFIER_IMAGE, 'PINNED_QUOTE_VERIFIER_REQUIRED', 'unavailable');
}
function jsonWithin(value, bytes) {
  const serialized = JSON.stringify(value);
  check(typeof serialized === 'string' && Buffer.byteLength(serialized) <= bytes, 'PROOF_CAPTURE_TOO_LARGE');
  return serialized;
}
async function limited(port, input, timeoutMs) {
  const controller = new AbortController(); let timer;
  try {
    return await Promise.race([Promise.resolve().then(() => port({ ...input, signal: controller.signal })), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(error('VERIFICATION_PORT_UNAVAILABLE', 'unavailable')); }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
function agreed(values, wanted, missing) {
  const known = values.filter(value => value !== undefined && value !== null);
  check(known.length > 0, missing, 'unavailable');
  check(known.every(value => value === wanted), missing.replace('_UNAVAILABLE', '_MISMATCH'));
}
function bindEvent(event, expected) {
  const evidence = event.evidence;
  check(record(evidence), 'COMMITTED_EVIDENCE_UNAVAILABLE', 'unavailable');
  const details = record(evidence.details) ? evidence.details : evidence;
  agreed([event.fields.nearAccountId, evidence.near_account_id, details.near_account_id], expected.accountId, 'ACCOUNT_BINDING_UNAVAILABLE');
  agreed([event.fields.executionType, evidence.type, details.action], expected.action, 'ACTION_BINDING_UNAVAILABLE');
  const payload = details.request ?? evidence.request;
  check(record(payload), 'COMMITTED_PAYLOAD_UNAVAILABLE', 'unavailable');
  check(fingerprint(payload) === expected.requestFingerprint && fingerprint(payload) === fingerprint(expected.payload), 'COMMITTED_PAYLOAD_MISMATCH');
  for (const [key, value] of [['agent_id', expected.agentId], ['correlation_id', expected.correlationId]]) {
    if (evidence[key] !== undefined) check(evidence[key] === value, 'COMMITTED_IDENTITY_MISMATCH');
  }
  return { evidence, details };
}
function settlementHashes(details) {
  const names = ['tx_hash', 'transaction_hash', 'settlement_tx_hash', ...(details.chain === 'near' ? ['destination_tx_hash'] : [])];
  return [...new Set(names.map(key => details[key]).filter(text))];
}
function verifyQuoteVerdict(reply, quote, expectedReportData, trust, info) {
  // This port is an administrator-controlled actual quote verifier, never an API response flag.
  check(record(reply) && reply.source === 'dstack-verifier' && reply.verifierImage === trust.dstackVerifierImage && reply.quoteHash === sha256(quote), 'ACTUAL_TDX_VERIFIER_EVIDENCE_REQUIRED', 'unavailable');
  const verdict = reply.verdict, details = verdict?.details;
  check(verdict?.is_valid === true && record(details), 'TDX_QUOTE_INVALID');
  check(details.report_data === expectedReportData, 'TDX_REPORT_DATA_MISMATCH');
  check(details.tcb_status === 'UpToDate' && Array.isArray(details.advisory_ids) && details.advisory_ids.length === 0, 'TDX_TCB_NOT_APPROVED');
  check(details.os_image_is_dev === false || details.os_image_is_dev === null, 'TDX_DEVELOPMENT_IMAGE');
  const app = details.app_info;
  check(record(app) && app.app_id === trust.expectedAppId && trust.allowedComposeHashes.includes(app.compose_hash) && trust.allowedOsImageHashes.includes(app.os_image_hash), 'TDX_DEPLOYMENT_MISMATCH');
  check(record(info) && info.app_id === app.app_id && info.compose_hash === app.compose_hash && info.os_image_hash === app.os_image_hash && typeof info.app_compose === 'string' && sha256(info.app_compose) === app.compose_hash, 'ATTESTED_COMPOSE_UNAVAILABLE', 'unavailable');
  let compose;
  try { compose = JSON.parse(info.app_compose); } catch { throw error('ATTESTED_COMPOSE_INVALID'); }
  check(compose.key_provider === 'kms' && compose.key_provider_id === trust.kmsRoot && compose.gateway_enabled === false, 'TDX_KEY_PROVIDER_MISMATCH');
  return { status: 'verified', source: 'dstack-verifier', quoteHash: reply.quoteHash, appId: app.app_id, composeHash: app.compose_hash };
}
// Facts the operation proof's evidence hash committed (provider-written, log-committed).
function committedFacts(bound) {
  const { details } = bound;
  return { accountId: details.near_account_id ?? bound.evidence.near_account_id ?? null,
    depositAddress: text(details.deposit_address) ? details.deposit_address : null,
    transactionHashes: settlementHashes(details),
    hashes: Object.fromEntries(['intent_hash', 'transfer_intent_hash', 'tx_hash', 'destination_tx_hash', 'settlement_tx_hash', 'receipt_hash'].filter(key => text(details[key])).map(key => [key, details[key]])) };
}
function verifyFinality(observation, hashes, trust) {
  check(record(observation) && observation.source === 'near-rpc' && observation.network === trust.network && Array.isArray(observation.transactions), 'INDEPENDENT_FINALITY_UNAVAILABLE', 'unavailable');
  for (const hash of hashes) {
    const entries = observation.transactions.filter(item => item?.hash === hash);
    check(entries.length === 1, 'SETTLEMENT_TRANSACTION_UNOBSERVED', 'unavailable');
    const response = entries[0].response;
    const tx = record(response?.result) ? response.result : response;
    check(record(tx) && tx.transaction?.hash === hash, 'SETTLEMENT_TRANSACTION_MISMATCH');
    check(tx.final_execution_status === 'FINAL', 'SETTLEMENT_NOT_FINAL', 'pending');
    check(record(tx.status) && Object.hasOwn(tx.status, 'SuccessValue'), 'SETTLEMENT_NOT_SUCCESSFUL');
    check(![tx.transaction_outcome, ...(tx.receipts_outcome ?? [])].some(item => record(item?.outcome?.status) && Object.hasOwn(item.outcome.status, 'Failure')), 'SETTLEMENT_RECEIPT_FAILED');
  }
  return { status: 'verified', source: 'near-rpc', network: observation.network, transactionHashes: hashes };
}

/** Offline audit verification + separately trusted quote/finality observation ports.
 * All ports/trust are private composition inputs. Request/proof JSON cannot supply them.
 * No transfer, wallet provisioning, signing, funds or financial-state methods exist here.
 */
export function createAgentProofs({ journal, trust, verifyTeeQuote, observeFinality, getTrustedCheckpoint, sdk, clock = () => new Date(), limits = {} } = {}) {
  const bounds = { maxCaptureBytes: 2 * 1024 * 1024, maxEvents: 256, timeoutMs: 10000, ...limits };
  for (const key of ['maxCaptureBytes', 'maxEvents', 'timeoutMs']) check(Number.isSafeInteger(bounds[key]) && bounds[key] > 0, 'INVALID_VERIFIER_LIMITS');
  const loadSdk = async () => sdk ?? import('@near-intents-agent-api/sdk');
  const normalizedTrust = trust ? structuredClone(trust) : null;

  async function verify(data, checkpoint, scope = 'full') {
    const stages = emptyStages(), findings = {}; let activeStage = 'audit';
    const base = { sdk: AGENT_PROOF_SDK, correlationId: data.expected?.correlationId ?? null, stages, grantsSpendingAuthority: false, grantsDeliveryAuthority: false, scope: scope === 'terms' ? 'attested-audit-binding-and-tdx' : 'attested-audit-and-recorded-near-finality' };
    try {
      validateTrust(normalizedTrust); validateExpected(data.expected);
      jsonWithin(data, bounds.maxCaptureBytes);
      const document = data.proof;
      check(record(document) && Array.isArray(document.events) && document.events.length <= bounds.maxEvents, 'OPERATION_PROOF_REQUIRED');
      check(document.agent_id === data.expected.agentId && document.correlation_id === data.expected.correlationId, 'PROOF_CALLER_IDENTITY_MISMATCH');
      const official = await loadSdk();
      let verified;
      try { verified = official.verifyOperationProof(document, normalizedTrust.origin, checkpoint); }
      catch { throw error('OPERATION_PROOF_INVALID'); }
      stages.audit = { status: 'verified', proven: verified.proven.length, pending: verified.pending, unlogged: verified.unlogged, checkpoint: checkpointData(verified.checkpoint, normalizedTrust.origin) };
      check(verified.pending === 0, 'AUDIT_EVENTS_PENDING', 'pending');
      check(verified.unlogged === 0, 'AUDIT_EVENTS_UNLOGGED', 'unavailable');
      activeStage = 'binding';
      const terminal = verified.proven.filter(event => event.fields.action === data.expected.requiredEvent);
      check(terminal.length === 1, 'PROVEN_COMPLETION_UNAVAILABLE', 'unavailable');
      const bound = bindEvent(terminal[0], data.expected);
      stages.binding = { status: 'verified', agentId: data.expected.agentId, accountId: data.expected.accountId, action: data.expected.action, requestFingerprint: data.expected.requestFingerprint };
      const status = data.statusEvidence;
      check(record(status) && status.agent_id === data.expected.agentId && status.correlation_id === data.expected.correlationId && status.type === data.expected.action, 'ORIGINAL_STATUS_UNAVAILABLE', 'unavailable');
      check(status.status === 'SUCCESS', 'EXECUTION_NOT_SETTLED', ['PROCESSING', 'UNCERTAIN', 'QUEUED'].includes(status.status) ? 'pending' : 'unavailable');
      activeStage = 'tee';
      const quote = document.notary?.birth?.attestation;
      check(typeof verifyTeeQuote === 'function' && text(quote) && text(verified.birthReportData), 'TDX_VERIFIER_UNAVAILABLE', 'unavailable');
      const quoteReply = await limited(verifyTeeQuote, { attestation: quote, quoteHash: sha256(quote), expectedReportData: verified.birthReportData, trust: structuredClone(normalizedTrust), teeEvidence: data.teeEvidence }, bounds.timeoutMs);
      findings.tee = quoteReply;
      stages.tee = verifyQuoteVerdict(quoteReply, quote, verified.birthReportData, normalizedTrust, data.teeEvidence?.info);
      if (scope === 'terms') {
        // Receipt-terms scope: no independent chain check exists for confidential
        // Intents settlement. Finality is reported as not established, never inferred.
        stages.finality = { status: 'not_applicable', code: 'INDEPENDENT_FINALITY_NOT_ESTABLISHED' };
        return { result: { ...base, status: 'verified', code: 'AUDIT_BINDING_AND_TDX_VERIFIED', checkpoint: stages.audit.checkpoint, committed: committedFacts(bound) }, findings };
      }
      activeStage = 'finality';
      const hashes = settlementHashes(bound.details);
      check(hashes.length > 0, 'INDEPENDENT_SETTLEMENT_PROOF_UNAVAILABLE', 'unavailable');
      check(hashes.every(hash => /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(hash)), 'SETTLEMENT_HASH_INVALID');
      check(normalizedTrust.network === 'near:mainnet' || normalizedTrust.network === 'near:testnet', 'SETTLEMENT_NETWORK_UNSUPPORTED', 'unavailable');
      check(typeof observeFinality === 'function', 'INDEPENDENT_FINALITY_UNAVAILABLE', 'unavailable');
      const finality = await limited(observeFinality, { expected: structuredClone(data.expected), transactionHashes: hashes, network: normalizedTrust.network, committedEvidence: bound.evidence, statusEvidence: status }, bounds.timeoutMs);
      findings.finality = finality;
      stages.finality = verifyFinality(finality, hashes, normalizedTrust);
      return { result: { ...base, status: 'verified', code: 'AUDIT_BINDING_TDX_AND_RECORDED_FINALITY_VERIFIED', checkpoint: stages.audit.checkpoint }, findings };
    } catch (failure) {
      stages[activeStage] = { ...stages[activeStage], status: failure.proofStatus ?? 'unavailable', code: failure.code ?? 'VERIFICATION_UNAVAILABLE' };
      return { result: { ...base, status: failure.proofStatus ?? 'unavailable', code: failure.code ?? 'VERIFICATION_UNAVAILABLE' }, findings };
    }
  }

  async function persist(data, checkpoint, findings, scope = 'full') {
    check(journal, 'PRIVATE_CAPTURE_STORAGE_REQUIRED', 'unavailable');
    const capture = { schemaVersion: 1, kind: 'agent-operation-proof', scope, ...data, trustedCheckpoint: checkpointData(checkpoint, normalizedTrust.origin), trustFingerprint: fingerprint(normalizedTrust), sdk: AGENT_PROOF_SDK, capturedAt: new Date(clock()).toISOString(), findings };
    const content = jsonWithin(capture, bounds.maxCaptureBytes);
    const artifact = await journal.putArtifact({ actionId: `agent-proof-artifact:${sha256(content)}`, content, mediaType: 'application/json' });
    await journal.transaction({ actionId: `agent-proof-capture:${artifact.hash}`, fingerprint: fingerprint(artifact) }, tx => {
      tx.put('agentProofCaptures', artifact.hash, { artifact, trustFingerprint: capture.trustFingerprint, expectedFingerprint: fingerprint(data.expected) }); return null;
    });
    return `agent-proof:${artifact.hash}`;
  }

  return {
    async capture({ expected, proof, statusEvidence, teeEvidence, scope = 'full' } = {}) {
      if (scope !== 'full' && scope !== 'terms') return { status: 'invalid', code: 'PROOF_SCOPE_INVALID', stages: emptyStages(), evidenceRef: null, grantsSpendingAuthority: false, grantsDeliveryAuthority: false };
      const data = { expected, proof, statusEvidence, teeEvidence };
      let checkpoint;
      try {
        validateTrust(normalizedTrust); validateExpected(expected); jsonWithin(data, bounds.maxCaptureBytes);
        const official = await loadSdk();
        // A trusted acquisition port can select the very head used to fetch this
        // operation's from_size proof. Never select a head from document JSON.
        checkpoint = getTrustedCheckpoint ? await limited(getTrustedCheckpoint, { trust: structuredClone(normalizedTrust), expected: structuredClone(expected) }, bounds.timeoutMs)
          : await limited(() => official.fetchWitnessCheckpoint(normalizedTrust.apiBaseUrl, normalizedTrust.origin, normalizedTrust.witnessPublicKey), {}, bounds.timeoutMs);
        checkpointData(checkpoint, normalizedTrust.origin);
      } catch (failure) {
        return { status: failure.proofStatus ?? 'unavailable', code: failure.code ?? 'TRUSTED_CHECKPOINT_UNAVAILABLE', stages: emptyStages(), evidenceRef: null, grantsSpendingAuthority: false, grantsDeliveryAuthority: false };
      }
      const outcome = await verify(data, checkpoint, scope);
      try { return { ...outcome.result, evidenceRef: await persist(data, checkpoint, outcome.findings, scope) }; }
      catch { return { ...outcome.result, status: 'unavailable', code: 'PRIVATE_CAPTURE_UNAVAILABLE', evidenceRef: null }; }
    },
    async replay({ evidenceRef, expected, scope = 'full' } = {}) {
      try {
        validateTrust(normalizedTrust); validateExpected(expected);
        check(typeof evidenceRef === 'string' && /^agent-proof:[a-f0-9]{64}$/.test(evidenceRef), 'PRIVATE_CAPTURE_REFERENCE_REQUIRED');
        const hash = evidenceRef.slice('agent-proof:'.length), reference = journal?.get('agentProofCaptures', hash);
        check(reference?.artifact?.hash === hash, 'PRIVATE_CAPTURE_NOT_FOUND', 'unavailable');
        const artifact = journal.getArtifact(reference.artifact);
        check(typeof artifact.content === 'string' && Buffer.byteLength(artifact.content) <= bounds.maxCaptureBytes && sha256(artifact.content) === hash, 'PRIVATE_CAPTURE_HASH_MISMATCH');
        const saved = JSON.parse(artifact.content);
        check((saved.scope ?? 'full') === scope && saved.schemaVersion === 1 && saved.kind === 'agent-operation-proof' && fingerprint(saved.sdk) === fingerprint(AGENT_PROOF_SDK), 'PRIVATE_CAPTURE_SCHEMA_INVALID');
        check(saved.trustFingerprint === fingerprint(normalizedTrust) && reference.trustFingerprint === saved.trustFingerprint, 'CAPTURE_TRUST_POLICY_CHANGED', 'unavailable');
        check(fingerprint(expected) === fingerprint(saved.expected) && reference.expectedFingerprint === fingerprint(expected), 'CAPTURE_EXPECTED_BINDING_MISMATCH');
        // Re-run the official cryptographic verifier and actual quote/finality ports.
        // Stored findings/"verified" booleans are evidence to inspect, never authority.
        const { findings: ignored, trustedCheckpoint, trustFingerprint: ignoredTrust, capturedAt: ignoredAt, scope: ignoredScope, ...data } = saved;
        const outcome = await verify(data, checkpointValue(trustedCheckpoint, normalizedTrust.origin), scope);
        return { ...outcome.result, evidenceRef, replayScope: 'retained-trusted-checkpoint' };
      } catch (failure) {
        return { status: failure.proofStatus ?? 'invalid', code: failure.code ?? 'PRIVATE_CAPTURE_INVALID', stages: emptyStages(), evidenceRef: evidenceRef ?? null, grantsSpendingAuthority: false, grantsDeliveryAuthority: false };
      }
    },
  };
}
