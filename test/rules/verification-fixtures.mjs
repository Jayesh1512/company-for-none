// Controlled policy-test findings only. These never claim vendor/SDK verification.
import {fingerprint} from '../../src/contracts.mjs';
import {SDK,verificationSpec,plaintextHash} from '../../src/rules/verification.mjs';
import {NOW} from './fixtures.mjs';
export {verificationSpec,plaintextHash};
export function sdkFinding(request,stage='preflight',output='Controlled test output') {
  const attestation={tcbStatus:'UpToDate',nonce:'controlled-test-nonce',nonceVerified:true,verifiedAt:new Date(NOW).toISOString(),signer:{signingAlgo:'ed25519',signingAddress:'controlled-test-signer'}};
  return {id:`finding:${stage}`,stage,status:'verified',source:'local-sdk',sdkVersion:'0.3.0',sdk:{...SDK},requestFingerprint:fingerprint(request),model:request.model,policyFingerprint:request.verificationSpec.policyFingerprint,verificationPolicyFingerprint:request.verificationSpec.policyFingerprint,verifiedAt:new Date(NOW).toISOString(),evidenceRef:'private:controlled-test-verifier-evidence',gateway:{...attestation},models:[structuredClone(attestation)],requestBytesHash:plaintextHash('controlled prepared request'),...(stage==='response'?{signatureKind:'provider_tee',wireSignatureVerified:true,responseBytesHash:plaintextHash('controlled wire response'),responsePlaintextHash:plaintextHash(output),plaintextBindingStatus:'verified',durableReplayStatus:'verified'}:{})};
}
