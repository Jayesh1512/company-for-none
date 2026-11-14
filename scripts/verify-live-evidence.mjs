import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createJournal} from '../src/journal/index.mjs';
import {createPaymentSignatureVerifier} from '../src/payments/signatures.mjs';

// Offline verifier. Public quote bytes are imported into an ephemeral private
// journal, reopened, and checked with the unchanged SDK production trust root.
// This does NOT reverify TDX/Intel/NVIDIA attestation from a saved boolean.
const directory=path.resolve(process.argv[2]??'artifacts/live-evidence/2026-11-14-readonly-r1');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
const publicFiles=[];
for(const request of manifest.requests){
 if(!request.responseFile)continue;
 assert.match(request.responseFile,/^[a-z0-9-]+\.response\.json$/);
 const bytes=await readFile(path.join(directory,request.responseFile));assert.equal(bytes.length,request.bytes);assert.equal(sha(bytes),request.sha256);
 publicFiles.push({file:request.responseFile,bytes:bytes.length,sha256:sha(bytes),matched:true});
}
for(const filename of ['cloud-attestation-summary.json','intents-dry-quote-summary.json']){
 const bytes=await readFile(path.join(directory,filename)),expected=(await readFile(path.join(directory,filename+'.sha256'),'utf8')).split(/\s/)[0];assert.equal(sha(bytes),expected);
}
const exchange=JSON.parse(await readFile(path.join(directory,'intents-dry-quote-exchange.json'),'utf8'));
const requestBytes=Buffer.from(exchange.request.bodyBase64,'base64'),responseBytes=Buffer.from(exchange.response.bodyBase64,'base64');
assert.equal(sha(requestBytes),exchange.request.bodyHash);assert.equal(sha(responseBytes),exchange.response.bodyHash);
assert.equal(JSON.parse(requestBytes.toString('utf8')).dry,true);
const temp=await mkdtemp(path.join(os.tmpdir(),'near-real-quote-verify-'));let journal;
try{
 journal=await createJournal({directory:temp});const originalRef=await journal.putArtifact({actionId:'actual-production-quote',content:JSON.stringify(exchange),mediaType:'application/json'});
 await journal.close();journal=await createJournal({directory:temp});
 const verifier=createPaymentSignatureVerifier({journal}),original=await verifier.verifyQuote({evidenceRef:'private:'+originalRef.id});assert.equal(original.status,'verified');assert.equal(original.trustRoot,'sdk-default-manager-public-key');
 const altered=JSON.parse(responseBytes.toString('utf8'));altered.quote.amountIn=String(BigInt(altered.quote.amountIn)+1n);
 const syntheticBytes=Buffer.from(JSON.stringify(altered)),tampered=structuredClone(exchange);tampered.response.bodyBase64=syntheticBytes.toString('base64');tampered.response.bodyHash=sha(syntheticBytes);
 const alteredRef=await journal.putArtifact({actionId:'explicit-synthetic-negative-control',content:JSON.stringify(tampered),mediaType:'application/json'});
 const rejected=await verifier.verifyQuote({evidenceRef:'private:'+alteredRef.id});assert.equal(rejected.status,'failed');assert.equal(rejected.reasonCode,'QUOTE_SIGNATURE_INVALID');
 const proof={at:new Date().toISOString(),networkIO:false,publicFiles,summaryChecksumsMatched:true,dryRequest:true,originalQuote:{source:'actual provider response',journalReopened:true,status:original.status,reasonCode:original.reasonCode,trustRoot:original.trustRoot,sdk:original.sdk,signedPayloadHash:original.signedPayloadHash},negativeControl:{source:'explicitly synthetic altered copy of captured provider response',field:'quote.amountIn',byteChecksumRecomputed:true,status:rejected.status,reasonCode:rejected.reasonCode},teeAttestationReverifiedOffline:false,attestationScope:'Only summary checksum verified here; rerun collector for actual fresh official-SDK attestation.',settlementVerified:false,paidInferenceCalls:0,transactionsSent:0};
 await writeFile(path.join(directory,'offline-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({publicResponsesVerified:publicFiles.length,originalProductionQuote:original.status,diskReopen:true,tamperedSignedAmount:rejected.status,networkIO:false}));
}finally{await journal?.close();await rm(temp,{recursive:true,force:true});}
