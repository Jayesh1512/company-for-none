import {readFile,mkdtemp,cp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {ROOT,definitions,publicBytes,checkBytes,scanText,validateManifest,validateClaimIndex} from './model.mjs';
import {PUBLIC_RUN} from './catalog.mjs';
import {verifyAiRecords} from './ai-records.mjs';

// Offline only: never runs a collector, provider probe, readiness write or paid call.
const expected=await definitions();
const manifest=JSON.parse(await readFile(path.join(ROOT,'evidence/manifest.json'),'utf8'));
validateManifest(manifest,expected);
let scanned=0;
for(const entry of manifest.artifacts){
 const bytes=await publicBytes(entry.path);checkBytes(bytes,entry);
 const findings=scanText(bytes.toString('utf8'));if(findings.length)throw Error(`EVIDENCE_SECRET_PATTERN:${entry.id}:${findings.join(',')}`);scanned++;
}
const index=await readFile(path.join(ROOT,'CLAIMS.md'),'utf8');
if(scanText(index).length)throw Error('CLAIM_INDEX_SECRET_PATTERN');
validateClaimIndex(index,manifest);
const json=async file=>JSON.parse((await publicBytes(`artifacts/real-ai-demo/${file}`)).toString('utf8'));
const ai=verifyAiRecords({calls:await Promise.all(['actual-call-r2.json','actual-escalation.json'].map(json)),verification:await json('actual-verification-summary.json'),outcomes:await json('actual-outcomes.json'),restart:await json('actual-restart.json'),validation:await json('validation.json'),source:await json('source-manifest.json')});
const temp=await mkdtemp(path.join(os.tmpdir(),'near-evidence-offline-'));
try{
 // This verifier writes a result; copy only public material so the original run
 // and its timestamp stay unchanged. Never copy .runtime/private SDK material.
 for(const entry of expected.artifacts.filter(e=>e.path.startsWith(PUBLIC_RUN+'/')))await cp(path.join(ROOT,entry.path),path.join(temp,path.basename(entry.path)));
 const child=spawnSync(process.execPath,[path.join(ROOT,'scripts/verify-live-evidence.mjs'),temp],{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
 if(child.status!==0)throw Error('ORIGINAL_QUOTE_CRYPTO_REPLAY_FAILED');
 const proof=JSON.parse(await readFile(path.join(temp,'offline-verification.json'),'utf8'));
 if(proof.networkIO!==false||proof.originalQuote?.status!=='verified'||proof.originalQuote?.trustRoot!=='sdk-default-manager-public-key'||proof.negativeControl?.reasonCode!=='QUOTE_SIGNATURE_INVALID'||proof.negativeControl?.byteChecksumRecomputed!==true||proof.teeAttestationReverifiedOffline!==false)throw Error('INVALID_OFFLINE_PROOF_SCOPE');
 console.log(JSON.stringify({artifactsVerified:manifest.artifacts.length,claimsChecked:manifest.claims.length,publishedTextFilesScanned:scanned+1,originalProductionQuote:'verified',journalReopened:proof.originalQuote.journalReopened,syntheticSignedAmountTamper:'rejected',aiDemo:ai,networkIO:false,teeReverifiedOffline:false,secretScan:'heuristic-not-a-guarantee',grantsSpendingAuthority:false}));
 console.log('Offline evidence verified. No provider call, funding, transaction or submission. Local Sandbox evidence is not public-chain execution.');
}finally{await rm(temp,{recursive:true,force:true});}
