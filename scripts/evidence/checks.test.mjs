import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,checkBytes,scanText,safePath,validateManifest,renderClaims,validateClaimIndex} from './model.mjs';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {verifyAiRecords} from './ai-records.mjs';
const spec={id:'control',path:'artifacts/sample.json',kind:'controlled_test',command:'local controlled test',doesNotProve:'No live provider proof.'};
const claim={id:'live-output',claim:'Accepted paid output.',status:'HELD',evidence:['control'],verify:null,doesNotProve:'Not established.'};
function sample(){const bytes=Buffer.from('controlled');return {schemaVersion:1,grantsSpendingAuthority:false,artifacts:[{...spec,trustScope:'CONTROLLED',bytes:bytes.length,sha256:hash(bytes)}],claims:[structuredClone(claim)]};}
const expected={artifacts:[spec],claims:[claim]};
test('controlled evidence cannot be relabelled live or acquire a different provenance',()=>{
 const m=sample();m.artifacts[0].trustScope='LIVE_PUBLIC';assert.throws(()=>validateManifest(m,expected),/SCOPE_MISMATCH/);
 m.artifacts[0].trustScope='CONTROLLED';m.artifacts[0].kind='public_capture';assert.throws(()=>validateManifest(m,expected),/SCOPE_MISMATCH/);
});
test('held claims cannot be promoted by a manifest boolean or dropped from the index',()=>{
 const m=sample();m.claims[0].status='OBSERVED';assert.throws(()=>validateManifest(m,expected),/CLAIM_SCOPE_OR_STATUS_CHANGED/);
 m.claims=[];assert.throws(()=>validateManifest(m,expected),/INDEX_INCOMPLETE/);
});
test('bound artifact byte changes are rejected independently of claim labels',()=>{
 const m=sample();assert.throws(()=>checkBytes(Buffer.from('contr0lled'),m.artifacts[0]),/BYTES_CHANGED/);
 assert.equal(validateManifest(m,expected),true);
});
test('private paths, traversal and substituted artifact paths are rejected',()=>{
 for(const p of ['.env','.runtime/credential.json','artifacts/../.env','/tmp/keys','artifacts/key.pem'])assert.throws(()=>safePath(p),/UNSAFE/);
 const m=sample();m.artifacts[0].path='artifacts/another.json';assert.throws(()=>validateManifest(m,expected),/SCOPE_MISMATCH/);
});
test('secret scan catches private credentials without treating a public NEAR key or digest as a secret',()=>{
 assert.deepEqual(scanText('ed25519:'+'A'.repeat(44)),[]);
 assert.deepEqual(scanText('a'.repeat(64)),[]);
 assert.ok(scanText('ed25519:'+'A'.repeat(88)).includes('NEAR_SECRET_KEY'));
 assert.ok(scanText('sk-'+'x'.repeat(40)).includes('API_SECRET'));
 assert.ok(scanText('-----BEGIN PRIVATE KEY-----').includes('PRIVATE_KEY_PEM'));
});
test('evidence verification never grants spending authority',()=>{
 const m=sample();m.grantsSpendingAuthority=true;assert.throws(()=>validateManifest(m,expected),/INVALID_EVIDENCE_MANIFEST/);
});
test('public NEAR block signatures are not secret keys, while private-key fields remain rejected',()=>{
 const value='ed25519:'+'A'.repeat(88);
 assert.deepEqual(scanText(JSON.stringify({header:{signature:value,approvals:[null,value]}})),[]);
 assert.ok(scanText(JSON.stringify({privateKey:value})).includes('NEAR_SECRET_KEY'));
 assert.ok(scanText(JSON.stringify({signature:{privateKey:value}})).includes('NEAR_SECRET_KEY'));
 assert.ok(scanText(JSON.stringify({unexpected:value})).includes('NEAR_SECRET_KEY'));
});
test('claim prose cannot silently promote a held outcome or change generated limitations',()=>{
 const m=sample(),text=renderClaims(m);assert.doesNotThrow(()=>validateClaimIndex(text,m));
 assert.throws(()=>validateClaimIndex(text.replace('Not established.','All live verification passed.'),m),/INDEX_STALE_OR_ALTERED/);
});
test('reindexing an altered original public response cannot replace its collection digest',()=>{
 const m=sample(),e={artifacts:[{...spec,expectedHash:'f'.repeat(64),expectedBytes:m.artifacts[0].bytes}],claims:[claim]};
 assert.throws(()=>validateManifest(m,e),/ORIGINAL_CAPTURE_DIGEST_CHANGED/);
});
test('a paid_provider artifact carries LIVE_PAID scope and cannot masquerade as controlled',async()=>{
 const {SCOPE_BY_KIND}=await import('./catalog.mjs');
 assert.equal(SCOPE_BY_KIND.paid_provider,'LIVE_PAID');
 const bytes=Buffer.from('{"status":"MATCHED"}');
 const specPaid={id:'paid-run-x',path:'artifacts/live-evidence/paid-x/paid-run.json',kind:'paid_provider',command:'node scripts/evidence/run-paid.mjs',doesNotProve:'single bounded paid call'};
 const expected2={artifacts:[specPaid],claims:[{...claim,id:'paid-inference'}]};
 const m2={schemaVersion:1,grantsSpendingAuthority:false,artifacts:[{...specPaid,trustScope:'CONTROLLED',bytes:bytes.length,sha256:hash(bytes)}],claims:[{...claim,id:'paid-inference'}]};
 assert.throws(()=>validateManifest(m2,expected2),/SCOPE_MISMATCH/);
});
test('paid-inference cannot be OBSERVED without an indexed paid-run artifact',()=>{
 const paid={...claim,id:'paid-inference',status:'OBSERVED',evidence:[]};
 const e={artifacts:[spec],claims:[paid]};
 const m={schemaVersion:1,grantsSpendingAuthority:false,artifacts:[{...spec,trustScope:'CONTROLLED',bytes:3,sha256:hash(Buffer.from('abc'))}],claims:[paid]};
 assert.throws(()=>validateManifest(m,e),/UNSUPPORTED_EVIDENCE_CLAIM/);
});
test('disabled paid evidence entry point never imports an app or reads credentials for any flag',()=>{
 for(const args of [[],['--describe'],['--run','--max-usd','5']]){
  const r=spawnSync(process.execPath,['scripts/evidence/run-paid.mjs',...args],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME,NEAR_AI_API_KEY:'NONSECRET_TEST_SENTINEL'}});
  assert.equal(r.status,2);const body=JSON.parse(r.stderr);
  assert.equal(body.reasonCode,'UNREVIEWED_PAID_EVIDENCE_RUNNER_DISABLED');assert.equal(body.credentialsRead,false);assert.equal(body.providerCalls,0);assert.equal(body.paidCalls,0);assert.ok(!r.stderr.includes('NONSECRET_TEST_SENTINEL'));
 }
});
async function recordedAi(){
 const json=async name=>JSON.parse(await readFile(`artifacts/real-ai-demo/${name}`,'utf8'));
 return {calls:await Promise.all(['actual-call-r2.json','actual-escalation.json'].map(json)),verification:await json('actual-verification-summary.json'),outcomes:await json('actual-outcomes.json'),restart:await json('actual-restart.json'),validation:await json('validation.json'),source:await json('source-manifest.json')};
}
test('actual AI public records are consistent without claiming offline private cryptographic replay',async()=>{
 const result=verifyAiRecords(await recordedAi());assert.equal(result.recordedPaidCalls,2);assert.equal(result.recordedCostNanoUsd,'3221160');assert.equal(result.privateCryptographyReverifiedOffline,false);assert.equal(result.durablePlaintextRecovery,false);assert.equal(result.newPaidRequests,0);
});
test('altered AI bill, identity, citation and durable-replay claims are rejected',async()=>{
 const original=await recordedAi();
 for(const [mutate,error]of [
  [v=>{v.calls[0].result.cost.actualCostNanoUsd='1';},/BILL_RECORD_MISMATCH/],
  [v=>{v.calls[1].result.providerRequestId=v.calls[0].result.providerRequestId;},/BINDING_MISMATCH/],
  [v=>{v.calls[0].result.citations[0].documentId='foreign-document';},/CITATION_METADATA_MISMATCH/],
  [v=>{v.verification.records[0].durableReplayStatus='verified';},/SCOPE_CHANGED/],
  [v=>{v.calls[1].result.ticketId=null;},/TICKET_MISSING/],
  [v=>{v.outcomes.unknownReservations=1;},/OUTCOME_RECORD_MISMATCH/]
 ]){const copy=structuredClone(original);mutate(copy);assert.throws(()=>verifyAiRecords(copy),error);}
});
