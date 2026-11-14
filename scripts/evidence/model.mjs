import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CLAIMS,STATIC_ARTIFACTS,SCOPE_BY_KIND,LOCAL_SUITES,PUBLIC_RUN} from './catalog.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Error(code);};
export function safePath(value){
 if(typeof value!=='string'||path.isAbsolute(value)||value.split('/').some(s=>!s||s==='.'||s==='..')||! /^(artifacts|evidence)\/[a-zA-Z0-9_./-]+$/.test(value)||value.includes('/.runtime/')||/\.(env|token|pem|key)$/i.test(value))fail('UNSAFE_EVIDENCE_PATH');
 return value;
}
export async function publicBytes(relative){
 safePath(relative);const absolute=path.join(ROOT,relative),actual=await realpath(absolute);
 if(!actual.startsWith(ROOT+path.sep)||actual!==absolute)fail('EVIDENCE_SYMLINK_REJECTED');
 return readFile(absolute);
}
export function checkBytes(bytes,entry){if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)fail('EVIDENCE_BYTES_CHANGED');}
export function scanText(text){
 // High-confidence patterns only. This is an additional heuristic, not a guarantee.
 const checks=[['PRIVATE_KEY_PEM',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['API_SECRET',/\b(?:sk|rpt|oc)_[A-Za-z0-9_-]{24,}\b|\bsk-[A-Za-z0-9_-]{24,}\b/],['BEARER_SECRET',/Bearer\s+[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]+){0,2}/],['ASSIGNED_SECRET',/(?:NEAR_AI_API_KEY|NEAR_AGENT_GRANT_TOKEN|NEAR_INTENTS_AGENT_API_KEY)\s*=\s*['"]?[A-Za-z0-9_-]{24,}/]];
 const found=new Set(checks.filter(([,re])=>re.test(text)).map(([name])=>name));
 const near=/ed25519:[1-9A-HJ-NP-Za-km-z]{80,100}\b/;
 // NEAR signatures and secret keys share prefix/length. Public RPC signature
 // fields must not be called leaked keys. A sensitive descendant overrides
 // the signature context; arbitrary unlabeled long values still fail closed.
 function inspect(value,publicSignature=false){
  if(typeof value==='string'){if(near.test(value)&&!publicSignature)found.add('NEAR_SECRET_KEY');}
  else if(Array.isArray(value))value.forEach(v=>inspect(v,publicSignature));
  else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))inspect(v,/private.?key|secret.?key|credential/i.test(key)?false:/^(signature|signatures|approvals)$/i.test(key)||publicSignature);
 }
 try{inspect(JSON.parse(text));}catch{if(near.test(text))found.add('NEAR_SECRET_KEY');}
 return [...found];
}
export async function definitions(){
 const artifacts=structuredClone(STATIC_ARTIFACTS),claims=structuredClone(CLAIMS);
 const publicManifest=JSON.parse(await publicBytes(`${PUBLIC_RUN}/manifest.json`));
 for(const r of publicManifest.requests){if(!r.responseFile)continue;if(!/^[a-z0-9-]+\.response\.json$/.test(r.responseFile))fail('INVALID_PUBLIC_CAPTURE');artifacts.push({id:`capture-${r.name}`,path:`${PUBLIC_RUN}/${r.responseFile}`,kind:'public_capture',command:`${r.method} ${r.url}`,observedAt:r.observedAt,expectedHash:r.sha256,expectedBytes:r.bytes,doesNotProve:'Original recorded endpoint response; HTTP200 can contain RPC errors. Integrity is not independent semantic/provider proof.'});}
 // Paid evidence is curated explicitly. Never discover/promote claims from an
 // arbitrary paid-run.json or a saved MATCHED/provider-success boolean.
 let local;
 try{local=JSON.parse(await publicBytes('evidence/latest-local.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(local){
  if(local.schemaVersion!==1||!/^evidence\/runs\/[a-zA-Z0-9_-]+$/.test(local.directory)||local.results?.length!==LOCAL_SUITES.length)fail('INVALID_LOCAL_EVIDENCE');
  for(const suite of LOCAL_SUITES){
   const r=local.results.find(r=>r.id===suite.id);
   if(!r||r.kind!==suite.kind||r.trustScope!==SCOPE_BY_KIND[suite.kind]||JSON.stringify(r.tests)!==JSON.stringify(suite.tests)||typeof r.passed!=='boolean')fail('INVALID_LOCAL_SCOPE');
   const id=`fresh-${suite.id}`;
   artifacts.push({id,path:`${local.directory}/${suite.id}.log`,kind:suite.kind,command:`node --test --test-reporter=spec ${suite.tests.join(' ')}`,observedAt:r.completedAt,doesNotProve:suite.doesNotProve});
   const c=claims.find(c=>c.id===suite.claim);c.evidence.push(id);if(!r.passed)c.status='FAILED';else if(c.status==='LOCAL_RUN_REQUIRED')c.status='OBSERVED';
  }
  artifacts.push({id:'latest-local',path:'evidence/latest-local.json',kind:'local_execution',command:'node scripts/evidence/run-local.mjs',doesNotProve:'Run metadata; each child log retains its own scope. This file does not upgrade controlled proof.'});
  if(local.scenarioOutput){
   if(local.scenarioOutput!==`${local.directory}/care-scenario.json`)fail('INVALID_LOCAL_SCENARIO_PATH');
   artifacts.push({id:'actual-care-scenario',path:local.scenarioOutput,kind:'local_execution',command:`node scripts/evidence/care-scenario.mjs ${local.scenarioOutput}`,observedAt:local.completedAt,doesNotProve:'Actual isolated native JBrain/cited answer/ticket/restart; fictional data and no model/provider/financial effect.'});
   claims.find(c=>c.id==='customer-care').evidence.push('actual-care-scenario');
  }
 }
 return {artifacts,claims};
}
export function validateManifest(manifest,expected){
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.artifacts)||!Array.isArray(manifest.claims)||manifest.grantsSpendingAuthority!==false)fail('INVALID_EVIDENCE_MANIFEST');
 if(manifest.artifacts.length!==expected.artifacts.length||manifest.claims.length!==expected.claims.length)fail('EVIDENCE_INDEX_INCOMPLETE');
 const ids=new Set();
 for(const entry of manifest.artifacts){
  const spec=expected.artifacts.find(s=>s.id===entry.id);if(!spec||ids.has(entry.id))fail('UNKNOWN_OR_DUPLICATE_ARTIFACT');ids.add(entry.id);
  if(entry.path!==spec.path||entry.kind!==spec.kind||entry.trustScope!==SCOPE_BY_KIND[spec.kind]||entry.command!==spec.command||entry.doesNotProve!==spec.doesNotProve||entry.observedAt!==spec.observedAt)fail('EVIDENCE_SCOPE_MISMATCH');
  safePath(entry.path);if(!Number.isSafeInteger(entry.bytes)||entry.bytes<0||!/^[a-f0-9]{64}$/.test(entry.sha256))fail('INVALID_EVIDENCE_DIGEST');
  if(spec.expectedHash&&(entry.sha256!==spec.expectedHash||entry.bytes!==spec.expectedBytes))fail('ORIGINAL_CAPTURE_DIGEST_CHANGED');
 }
 if(JSON.stringify(manifest.claims)!==JSON.stringify(expected.claims))fail('CLAIM_SCOPE_OR_STATUS_CHANGED');
 for(const claim of manifest.claims)if(claim.evidence.some(id=>!ids.has(id))||!claim.doesNotProve||claim.status==='OBSERVED'&&!claim.evidence.length)fail('UNSUPPORTED_EVIDENCE_CLAIM');
 return true;
}
export function renderClaims(manifest){
 const lines=['# Claim-to-evidence index','','Generated by `node scripts/evidence/build.mjs`. This is a curated claim index, not a judge score or an authority to spend.','','Run `node scripts/evidence/verify.mjs` for offline integrity, scope consistency, heuristic secret checks, production-root quote signature replay and sanitized actual-AI record consistency. The latter does not replay private TEE/signature/plaintext evidence. Run `node scripts/evidence/run-local.mjs` separately for isolated native-JBrain and controlled pipeline tests. See [evidence guide](evidence/README.md).','','Trust scopes: **LIVE_PUBLIC** = original public provider capture; **LIVE_PAID** = sanitized records of the approved actual owner-funded calls; **LIVE_LOCAL** = actual local execution; **CONTROLLED** = injected external facts. Claim status is separate from trust scope. Rebuilding hashes or changing labels cannot manufacture missing live proof.',''];
 for(const c of manifest.claims){
  lines.push(`<!-- claim:${c.id}:${c.status} -->`,`## ${c.id} — ${c.status}`,'',c.claim,'',...c.evidence.map(id=>{const e=manifest.artifacts.find(e=>e.id===id);return `- **${e.trustScope}**: [${id}](${e.path})`;}),...(c.evidence.length?[]:['- No established evidence for this outcome.']),...(c.verify?['',`Verify/reproduce: \`${c.verify}\``]:[]),'',`Limit: ${c.doesNotProve}`,'');
 }
 return lines.join('\n');
}
export function validateClaimIndex(text,manifest){if(text!==renderClaims(manifest))fail('CLAIM_INDEX_STALE_OR_ALTERED');}
