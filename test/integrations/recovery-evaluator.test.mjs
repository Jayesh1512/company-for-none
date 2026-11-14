import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createRecoveryEvaluator} from '../../src/demo/recovery-evaluator.mjs';
import {evaluateTemplateChange} from '../../src/autonomy/evaluation.mjs';
import {fingerprint} from '../../src/contracts.mjs';

const spec={baseline:{fields:[{name:'policyReference',required:true}]},candidate:{fields:[{name:'policyReference',required:true},{name:'address',required:true}]},contract:{requiredFields:['policyReference','address']},jobId:'recovery-test'};
const callId='550e8400-e29b-41d4-a716-446655440000';
async function fixture(t,{lost=false,pending=false,diverged=false,badProof=false}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'recovery-wasm-'));let journal=await createJournal({directory}),posts=0,reads=0;
 t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 const options={binding:{projectOwner:'company.near',projectName:'evaluator',versionHash:'a'.repeat(64),paymentKeyOwner:'payer.near',paymentKeyNonce:1},resolveSecret:async()=> 'payer.near:1:TEST-SECRET',maxPolls:1,pollIntervalMs:0,
  transport:async(url,options)=>{
   if(url.includes('/attestations/'))return new Response(JSON.stringify({quote:'TEST-ONLY-ATTESTATION'}));
   if(options.method==='POST'){posts++;if(lost)throw Error('response lost after acceptance');}else reads++;
   return new Response(JSON.stringify({call_id:callId,status:pending&&posts===1&&reads===0?'pending':'completed',compute_cost:'10',output:diverged?{repaired:true}:evaluateTemplateChange(spec)}));
  },
  verifyExecution:async({request,output,attestation,attestationEvidenceRef})=>{
   assert.equal(attestation.quote,'TEST-ONLY-ATTESTATION');assert.ok(attestationEvidenceRef.startsWith('private:'));
   return {source:'outlayer-execution-verifier',callId:badProof?'wrong':callId,wasmHash:request.binding.versionHash,inputFingerprint:fingerprint(request.body.input),outputFingerprint:fingerprint(output),inputHash:'b'.repeat(64),outputHash:'c'.repeat(64),evidenceRef:attestationEvidenceRef};
  }};
 return {get journal(){return journal;},client:()=>createRecoveryEvaluator({...options,journal}),counts:()=>({posts,reads}),async restart(){await journal.close();journal=await createJournal({directory});}};
}
test('recovery WASM path polls the original call, captures attestation, and replays verified output after restart',async t=>{
 const f=await fixture(t,{pending:true}),r=await f.client().evaluate(spec);assert.equal(r.status,'confirmed');assert.deepEqual(r.output,evaluateTemplateChange(spec));assert.equal(r.providerRequestId,callId);assert.ok(r.attestationEvidenceRef);assert.equal(f.counts().posts,1);assert.equal(f.counts().reads,1);
 const record=f.journal.get('recoveryOutlayerJobs',spec.jobId);assert.equal(record.callId,callId);assert.ok(record.attestationWireHash);assert.ok(!JSON.stringify(record).includes('TEST-SECRET'));
 await f.restart();assert.deepEqual(await f.client().evaluate(spec),r);assert.equal(f.counts().posts,1);
 await assert.rejects(f.client().evaluate({...spec,candidate:spec.baseline}),{code:'OUTLAYER_JOB_CONFLICT'});
});
test('a lost submission response is never resubmitted after restart',async t=>{
 const f=await fixture(t,{lost:true});await assert.rejects(f.client().evaluate(spec));await f.restart();await assert.rejects(f.client().evaluate(spec),{code:'OUTLAYER_ORIGINAL_CALL_ID_REQUIRED'});assert.equal(f.counts().posts,1);
});
for(const options of [{diverged:true},{badProof:true}])test('unproven or divergent WASM output cannot become a cached confirmed result '+JSON.stringify(options),async t=>{
 const f=await fixture(t,options);await assert.rejects(f.client().evaluate(spec));assert.notEqual(f.journal.get('recoveryOutlayerJobs',spec.jobId).status,'confirmed');await assert.rejects(f.client().evaluate(spec));assert.equal(f.counts().posts,1);
});
