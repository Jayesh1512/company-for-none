import {createHash} from 'node:crypto';
import {hash, freeze,integer} from './config.mjs';
import {allow, hold} from './policies.mjs';

export const SDK = Object.freeze({name:'@nearai/inference-sdk',version:'0.3.0',nodeEntry:true});
export const plaintextHash = text => createHash('sha256').update(text,'utf8').digest('hex');
export function inferenceMaximum(bounds,providerBounds) {
  return (BigInt(bounds.inputTokens)*integer(providerBounds.inputNanoUsdPerMillionTokens)+BigInt(bounds.outputTokens)*integer(providerBounds.outputNanoUsdPerMillionTokens)+999999n)/1000000n;
}
const nonempty = x => typeof x==='string'&&!!x.trim();
const digest = x => typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function verificationSpec(config) {
  const policy={schemaVersion:1,route:'near-tee-e2ee-chat',signingAlgo:'ed25519',sdk:SDK,
    requireGatewayAttestation:true,requireModelAttestation:true,requireResponseSignature:true,
    allowedTcbStatuses:[...(config?.inferenceVerification?.allowedTcbStatuses??['UpToDate'])],
    maxAttestationAgeMs:config?.inferenceVerification?.maxAttestationAgeMs??300000,
    attestationCacheTimeToLiveMs:0,signatureKind:'provider_tee',
    ...(config?.inferenceVerification?.responseAcceptance?{responseAcceptance:config.inferenceVerification.responseAcceptance}:{})};
  return freeze({...policy,policyFingerprint:hash(policy)});
}
export function requestVerification(request,config) {
  return request&&hash(request.verificationSpec??null)===hash(verificationSpec(config))?null:hold('VERIFICATION_SPEC_REQUIRED');
}

/** Local official-SDK findings are supplied only by private composition. This
 * module checks policy/bindings; it never verifies cryptographic evidence itself. */
export function verifyInferenceEvidence(stage,{request,requestFingerprint,output,prepared=false},runtime,config,now) {
  const spec=verificationSpec(config),invalid=requestVerification(request,config);if(invalid)return invalid;
  if(!nonempty(requestFingerprint)||requestFingerprint!==hash(request))return hold('REQUEST_FINGERPRINT_MISMATCH');
  const records=(Array.isArray(runtime?.verificationResults)?runtime.verificationResults:[]).filter(x=>x?.stage===stage&&x.requestFingerprint===requestFingerprint);
  if(!records.length)return hold(stage==='preflight'?'INFERENCE_PREFLIGHT_REQUIRED':'INFERENCE_PROOF_REQUIRED');
  if(records.some(x=>!Number.isFinite(Date.parse(x.verifiedAt))))return hold('VERIFICATION_TIME_INVALID');
  records.sort((a,b)=>Date.parse(b.verifiedAt)-Date.parse(a.verifiedAt));
  const r=records[0];
  if(records.some(x=>x!==r&&Date.parse(x.verifiedAt)===Date.parse(r.verifiedAt)&&hash(x)!==hash(r)))return hold('VERIFICATION_RESULT_CONFLICT');
  if(r.source!=='local-sdk'||r.sdkVersion!==SDK.version||hash(r.sdk??null)!==hash(SDK)||!nonempty(r.id)||!nonempty(r.evidenceRef))return hold('LOCAL_SDK_VERIFICATION_REQUIRED');
  if(r.model!==request.model||r.policyFingerprint!==spec.policyFingerprint||(r.verificationPolicyFingerprint!=null&&r.verificationPolicyFingerprint!==spec.policyFingerprint))return hold('VERIFICATION_BINDING_MISMATCH');
  if(r.status!=='verified')return hold(r.status==='failed'?'INFERENCE_VERIFICATION_FAILED':stage==='response'?'INFERENCE_PROOF_UNAVAILABLE':'INFERENCE_PREFLIGHT_UNAVAILABLE');
  const fresh=t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=now&&now-Date.parse(t)<spec.maxAttestationAgeMs;
  if(!fresh(r.verifiedAt))return hold('INFERENCE_ATTESTATION_EXPIRED');
  if(!r.gateway||!Array.isArray(r.models)||!r.models.length)return hold('GATEWAY_AND_MODEL_ATTESTATION_REQUIRED');
  for(const attestation of [r.gateway,...r.models]){
    if(!spec.allowedTcbStatuses.includes(attestation.tcbStatus))return hold('TCB_STATUS_NOT_APPROVED');
    if(attestation.nonceVerified!==true||!nonempty(attestation.nonce)||!fresh(attestation.verifiedAt))return hold('FRESH_NONCE_ATTESTATION_REQUIRED');
    if(attestation.signer?.signingAlgo!==spec.signingAlgo||!nonempty(attestation.signer?.signingAddress))return hold('ATTESTED_SIGNER_REQUIRED');
  }
  if((prepared||stage==='response')&&!digest(r.requestBytesHash))return hold('PREPARED_REQUEST_EVIDENCE_REQUIRED');
  if(stage==='response'){
    if(r.signatureKind!==spec.signatureKind||r.wireSignatureVerified!==true||!digest(r.responseBytesHash))return hold('MODEL_RESPONSE_SIGNATURE_REQUIRED');
    if(spec.responseAcceptance==='live-verified-hold-on-loss'){
      if(r.plaintextBindingStatus!=='verified'||r.processVerificationStatus!=='verified'||r.acceptanceScope!=='live-process-e2ee'||r.stage!=='response')return hold('LIVE_PLAINTEXT_BINDING_REQUIRED');
    }else if(r.plaintextBindingStatus!=='verified'||r.durableReplayStatus!=='verified')return hold('DURABLE_PLAINTEXT_BINDING_REQUIRED');
    const before=verifyInferenceEvidence('preflight',{request,requestFingerprint,prepared:true},runtime,config,now);
    if(before.status!=='allow')return before;
    if(before.plan.requestBytesHash!==r.requestBytesHash)return hold('PREPARED_REQUEST_HASH_MISMATCH');
    if(typeof output!=='string'||!digest(r.responsePlaintextHash)||plaintextHash(output)!==r.responsePlaintextHash)return hold('VERIFIED_OUTPUT_BINDING_REQUIRED');
  }
  return allow({plan:{kind:stage==='preflight'?'inference_preflight':'inference_verification',accepted:true,verificationId:r.id,policyFingerprint:spec.policyFingerprint,...(r.requestBytesHash?{requestBytesHash:r.requestBytesHash}:{}),...(stage==='response'?{responseBytesHash:r.responseBytesHash,responsePlaintextHash:r.responsePlaintextHash}:{}),grantsSpendingAuthority:false}});
}
