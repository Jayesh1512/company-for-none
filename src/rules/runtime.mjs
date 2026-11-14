import {hash} from './config.mjs';
import {allow, deny, hold} from './policies.mjs';

export const CAPABILITIES = Object.freeze(['custody_identity','custody_policy','custody_grant','custody_balance','payments_route','refund_route','inference_model','inference_bounds','inference_credit','inference_proof','jbrain','public_retrieval']);
const policyBound = new Set(['custody_policy','custody_grant','payments_route','refund_route','inference_bounds','inference_proof']);
const nonempty = x => typeof x === 'string' && !!x.trim();
const isolated = new Set(['jbrain','public_retrieval']);
const probeBounds=Object.freeze({ttlMs:60000,maxBytes:65536,timeoutMs:5000,maxRedirects:2});
// A local JBrain health read is a no-spend observation, so a human-scale bound keeps setup
// usable. It is still short, explicit-refresh only, identity-bound and never extended.
const probeTtlMs=Object.freeze({jbrain:300000});

export function ownerAccess(access, companyId, mode) {
  if (!nonempty(companyId) || access?.role !== 'owner') return false;
  return (access.verified === true && access.companyId === companyId) ||
    (mode === 'fixture' && access.verifiedLocal === true);
}

// Called only with the private composition callback's return value. Request facts
// cannot supply readiness, identity, or evidence authority.
export function runtimeReadiness(runtime, {companyId, config, policyVersion, now}) {
  const identity = runtime?.economicIdentity;
  const identityValid = identity && identity.companyId === companyId && nonempty(companyId) &&
    nonempty(identity.network) && nonempty(identity.treasuryAccount) && nonempty(identity.bucket) &&
    (config?.mode !== 'live' || identity.bucket === 'confidential') &&
    (!config || (identity.network === config.settlementAsset.network && identity.treasuryAccount === config.treasuryAccount));
  const observations = Array.isArray(runtime?.observations) ? runtime.observations : [];
  const requirements = CAPABILITIES.map(capability => {
    const records = observations.filter(x => x?.capability === capability);
    const missing = reasonCode => ({capability,status:'unavailable',reasonCode});
    if (!records.length) return missing('OBSERVATION_REQUIRED');
    // A malformed or tied conflicting newer record never revives an older grant.
    if (records.some(x => !Number.isFinite(Date.parse(x.observedAt)))) return missing('OBSERVATION_TIME_INVALID');
    records.sort((a,b) => Date.parse(b.observedAt)-Date.parse(a.observedAt));
    const o = records[0];
    if (records.some(x => x !== o && Date.parse(x.observedAt) === Date.parse(o.observedAt) && hash(x) !== hash(o))) return missing('OBSERVATION_CONFLICT');
    const detail = {capability,status:'unavailable',observationId:o.id ?? null,observedAt:Number.isFinite(Date.parse(o.observedAt))?new Date(o.observedAt).toISOString():null,expiresAt:o.expiresAt ?? null};
    const invalid = reasonCode => ({...detail,reasonCode});
    const scopeValid=isolated.has(capability)?identity?.companyId===companyId&&nonempty(companyId):identityValid;
    if (!scopeValid || !o.identity || ['companyId','network','treasuryAccount','bucket'].some(k => o.identity[k] !== identity[k])) return invalid('OBSERVATION_IDENTITY_MISMATCH');
    if (!nonempty(o.id) || !nonempty(o.provider) || !['verified','configured','unavailable'].includes(o.status)) return invalid('OBSERVATION_INVALID');
    if (Date.parse(o.observedAt) > now || !Number.isFinite(Date.parse(o.expiresAt)) || Date.parse(o.expiresAt) <= now || Date.parse(o.expiresAt) <= Date.parse(o.observedAt)) return invalid('OBSERVATION_EXPIRED');
    if ((o.policyVersion != null && o.policyVersion !== policyVersion) || (policyBound.has(capability) && o.policyVersion !== policyVersion)) return invalid('OBSERVATION_POLICY_MISMATCH');
    if (o.status !== 'verified') return {...detail,status:o.status,reasonCode:o.reasonCode ?? 'CAPABILITY_NOT_VERIFIED'};
    if (!nonempty(o.evidenceRef)) return invalid('OBSERVATION_EVIDENCE_REQUIRED');
    return {...detail,status:'verified',reasonCode:'VERIFIED'};
  });
  return {kind:'runtime_readiness',ready:requirements.every(x=>x.status==='verified'),requirements,grantsSpendingAuthority:false};
}

export function requireCapabilities(readiness, capabilities = CAPABILITIES) {
  const missing = readiness.requirements.filter(x => capabilities.includes(x.capability) && x.status !== 'verified');
  return missing.length ? hold('RUNTIME_NOT_READY',{plan:{kind:'runtime_readiness',ready:false,requirements:missing,grantsSpendingAuthority:false}}) : null;
}

export function publicReadiness(readiness,setupRequired) {
  // Never forward provider reason strings: even a valid-looking reason can carry
  // an account identifier or private evidence. Public codes are Rules-owned.
  const safeReasons=new Set(['OBSERVATION_REQUIRED','OBSERVATION_TIME_INVALID','OBSERVATION_CONFLICT','OBSERVATION_IDENTITY_MISMATCH','OBSERVATION_INVALID','OBSERVATION_EXPIRED','OBSERVATION_POLICY_MISMATCH','CAPABILITY_NOT_VERIFIED','OBSERVATION_EVIDENCE_REQUIRED','VERIFIED']);
  return {kind:'public_readiness',ready:readiness.ready===true,setupRequired,
    capabilities:readiness.requirements.map(r=>({capability:r.capability,status:r.status,
      reasonCode:safeReasons.has(r.reasonCode)?r.reasonCode:'CAPABILITY_NOT_VERIFIED',
      expiresAt:Number.isFinite(Date.parse(r.expiresAt))?new Date(r.expiresAt).toISOString():null}))};
}

export function probeDecision(action) {
  if (!CAPABILITIES.includes(action.capability)) return deny('PROBE_SCOPE_DENIED');
  // This action authorizes observation only, not a caller-selected URL, method,
  // body, account mutation, signature, paid inference, or remote work submission.
  if (Object.keys(action).some(k=>!['id','type','mode','capability'].includes(k))) return deny('PROBE_INPUT_DENIED');
  return allow({plan:{kind:'runtime_probe',capability:action.capability,readOnly:true,ttlMs:probeTtlMs[action.capability]??probeBounds.ttlMs,...(action.capability==='public_retrieval'?{maxBytes:probeBounds.maxBytes,timeoutMs:probeBounds.timeoutMs,maxRedirects:probeBounds.maxRedirects}:action.capability==='jbrain'?{timeoutMs:probeBounds.timeoutMs}:{}),grantsSpendingAuthority:false}});
}
