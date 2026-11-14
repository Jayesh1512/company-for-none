import { atomic, capability, createOperationRuntime, digest, realMode, result, unsupported } from '../custody/adapter-runtime.mjs';
import { createNearCloudClient } from './http.mjs';
import { createCloudVerification, CLOUD_DURABLE_RECOVERY } from './verification.mjs';
import {generationInputBytes} from '../generation-contracts.mjs';
export { createCloudVerification, CLOUD_DURABLE_RECOVERY } from './verification.mjs';

const positive = n => Number.isSafeInteger(n) && n > 0;

export function createInferenceAdapter(options = {}) {
  const mode = realMode(options.mode);
  const { journal, dispatchAuthorized, clock = () => new Date() } = options;
  const meta = capability('M07', mode, 'near-ai-cloud', {
    inferenceSupported: mode === 'live', autonomousFunding: false, configured: Boolean(options.secretRef && options.resolveSecret), verified: false, proofVerificationSupported: false,
    completionTransport: 'official-sdk-prepared-e2ee',
    durableRecoverySupported: CLOUD_DURABLE_RECOVERY.supported,
    durableRecoveryReasonCode: CLOUD_DURABLE_RECOVERY.reasonCode,
    evidenceLevel: 'documented-only',
    missingAccess: ['Protected Cloud API key', 'Verified credit ownership', 'Verified model charge bound', 'Explicit funded limit'],
  });
  const runtime = createOperationRuntime({ journal, namespace: 'adapters:m07', meta, dispatchAuthorized, clock });
  const client = mode === 'live' ? createNearCloudClient(options) : null;
  const prepared = new Map();
  const verification = () => options.verification ?? createCloudVerification({journal,clock,
    resolveSecret:options.resolveSecret,secretRef:options.secretRef,
    limits:{maxEvidenceBytes:4*1024*1024,timeoutMs:30000}});
  async function recordProof(proof) {
    if(!proof?.id)return;
    await journal.transaction({actionId:`business-proof:${proof.id}:${digest(proof)}`,fingerprint:digest(proof)},tx=>{
      tx.put('verificationResults',proof.id,proof);return null;
    });
  }
  return {
    capabilities: () => structuredClone(meta),
    async prepare({action,request}={}) {
      if(mode!=='live')return unsupported(meta,action);
      if(!action?.id||action.requestFingerprint!==digest(request))return result(meta,'not_submitted',action,{code:'CONFLICT'});
      // Recover original effects before considering any new provider work.
      if(runtime.read(action))return result(meta,'not_submitted',action,{code:'RECONCILIATION_REQUIRED'});
      const old=prepared.get(action.id);
      if(old){
        if(old.fingerprint===digest({action,request}))return old.finding;
        // Only a private, fresh M01 preparation decision can replace a fenced
        // internal worker's read-only callback. Never replace an effect intent.
        const sameWork=action.type==='agent_inference'&&old.action?.type==='agent_inference'&&old.action.workId===action.workId&&old.action.requestFingerprint===action.requestFingerprint;
        const admission=sameWork?options.authorizePreparation?.({action,previousAction:old.action,request}):null;
        if(admission?.status!=='allow'||runtime.read(action))return result(meta,'not_submitted',action,{code:admission?.reasonCode??'CONFLICT'});
        prepared.delete(action.id);
      }
      try{
        const send=await verification().prepare({action,request,verificationSpec:request.verificationSpec});
        if(typeof send!=='function'||!send.preflight||send.requestFingerprint!==action.requestFingerprint)throw Object.assign(Error(),{code:'PREPARED_REQUEST_MISMATCH'});
        if(action.type==='agent_inference'&&options.authorizePreparation){
          const admission=options.authorizePreparation({action,request});
          if(admission?.status!=='allow')return result(meta,'not_submitted',action,{code:admission?.reasonCode??'STALE_WORK_FENCE',completionSent:false});
        }
        await recordProof(send.preflight);
        const finding=result(meta,'confirmed',action,{proof:send.preflight,completionSent:false});
        prepared.set(action.id,{action:structuredClone(action),fingerprint:digest({action,request}),send,finding});
        return finding;
      }catch(error){
        if(error.result&&!(action.type==='agent_inference'&&options.authorizePreparation&&options.authorizePreparation({action,request})?.status!=='allow'))await recordProof(error.result);
        return result(meta,'not_submitted',action,{code:typeof error.code==='string'?error.code:'INFERENCE_PREPARATION_FAILED',completionSent:false});
      }
    },
    async generate({ action, decision, facts, request, credit } = {}) {
      if (mode === 'unavailable' || mode === 'testnet') return unsupported(meta, action, 'No Cloud testnet or live access established');
      if (!action?.id || !request || action.requestFingerprint !== digest(request)) return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
      if (typeof request.model !== 'string' || !Array.isArray(request.messages) || !request.messages.length ||
        !request.messages.every(m => ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string') ||
        !positive(request.maxInputBytes) || !positive(request.maxOutputTokens) || !positive(request.timeoutMs) ||
        generationInputBytes(request) > request.maxInputBytes ||
        !atomic(request.chargeBound?.maxCostNanoUsd) || action.maxCostNanoUsd !== request.chargeBound.maxCostNanoUsd) {
        return result(meta, 'not_submitted', action, { code: 'INVALID_INPUT' });
      }
      if (!credit || credit.status !== 'confirmed' || !atomic(credit.availableNanoUsd)) {
        return result(meta, 'not_submitted', action, { code: 'CREDIT_EVIDENCE_REQUIRED' });
      }
      // These are provider-bound facts, not a locally chosen spending policy.
      // M01 decides affordability and the allowed maximum. Without established
      // reasoning-inclusive provider bounds we cannot claim bounded live calls.
      if (mode === 'live' && (request.chargeBound.verified !== true ||
        request.chargeBound.completionTokensIncludeReasoning !== true || !request.chargeBound.reference)) {
        return result(meta, 'not_submitted', action, { code: 'BOUNDS_UNESTABLISHED' });
      }
      const pending=prepared.get(action.id);
      if(!runtime.read(action)&&(!pending||pending.fingerprint!==digest({action,request})))return result(meta,'not_submitted',action,{code:'PREPARED_INFERENCE_REQUIRED'});
      return runtime.execute({ action, decision, facts, payload: request,
        prepare: () => pending?.send,
        send: send => send().then(async outcome=>{await recordProof(outcome.proof);return outcome;}),
      });
    },
    async reconcile({ action, request } = {}) {
      if (mode === 'unavailable' || mode === 'testnet') return unsupported(meta, action);
      if (action?.requestFingerprint !== digest(request)) return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
      return runtime.reconcile(action, async op => {
        const prior = op.result;
        // Billing lookup cannot recover a lost output or identify a response whose
        // inference-id never reached us. Such effects stay unknown without retry.
        const inferenceId = prior?.generation?.inferenceId;
        if (!inferenceId) return prior ?? result(meta, 'unknown', action, { code: 'RECONCILIATION_REQUIRED', cost: { status: 'pending', actualCostNanoUsd: null } });
        const billed = await client.costs(inferenceId);
        const row = billed.requests?.find(r => r.requestId === inferenceId);
        const value = row?.costNanoUsd;
        const amount = typeof value === 'string' ? value : Number.isSafeInteger(value) ? String(value) : null;
        // API returns 0 for unmatched IDs and delayed records. A warning or zero
        // is never evidence of a free request, so retain the reservation.
        if (billed.warning || !atomic(amount) || amount === '0') return prior;
        const cost = { status: 'actual', actualCostNanoUsd: amount, reference: inferenceId,
          observedAt: new Date(clock()).toISOString(), mode, simulated: false };
        return { ...prior, cost, generation: { ...prior.generation, cost } };
      });
    },
  };
}
