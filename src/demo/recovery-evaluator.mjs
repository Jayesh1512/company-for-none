import {fingerprint,ContractError} from '../contracts.mjs';
import {evaluateTemplateChange} from '../autonomy/evaluation.mjs';
import {outlayerRequest,createOutlayerEvaluator} from '../integrations/outlayer.mjs';
import {readExchange} from '../integrations/http.mjs';

const fail=code=>{throw new ContractError(code,code);};

/** One durable submission per job. Recovery observes the original call only. */
export function createRecoveryEvaluator({journal,binding,resolveSecret,verifyExecution,transport,clock=()=>new Date(),maxPolls=30,pollIntervalMs=1000}={}){
 return {async evaluate({baseline,candidate,contract,jobId}){
  if(!binding)fail('OUTLAYER_PROJECT_BINDING_REQUIRED');
  if(typeof verifyExecution!=='function')fail('OUTLAYER_EXECUTION_VERIFIER_REQUIRED');
  const request=outlayerRequest({...binding,evaluationSpec:{baseline,candidate,contract},jobId}),requestHash=fingerprint(request);
  let record=journal.get('recoveryOutlayerJobs',jobId);
  if(record&&record.requestHash!==requestHash)fail('OUTLAYER_JOB_CONFLICT');
  const save=async change=>{
   record={...record,id:jobId,requestHash,request,...change,updatedAt:new Date(clock()).toISOString()};
   await journal.transaction({actionId:`${jobId}:outlayer:${fingerprint(record)}`,fingerprint:fingerprint(record)},tx=>tx.put('recoveryOutlayerJobs',jobId,record));
  };
  const capture=async(kind,exchange)=>{
   const a=await journal.putArtifact({actionId:`${jobId}:${kind}:${exchange.wireHash}`,content:exchange.raw.toString('utf8'),mediaType:'application/json'});
   const evidenceRef=`private:${a.id}`;
   await save({[kind+'EvidenceRef']:evidenceRef,[kind+'WireHash']:exchange.wireHash});return evidenceRef;
  };
  const client=createOutlayerEvaluator({resolveSecret,transport,verifyExecution:async input=>{
   const attestation=await client.attestation(input.callId,request);
   const attestationEvidenceRef=await capture('attestation',attestation);
   if(!attestation.ok||attestation.parseError)fail('OUTLAYER_ATTESTATION_UNAVAILABLE');
   return verifyExecution({...input,attestation:attestation.value,attestationEvidenceRef});
  }});
  if(record?.status==='confirmed')return record.result;
  let exchange;
  if(record){
   if(!record.callId)fail('OUTLAYER_ORIGINAL_CALL_ID_REQUIRED');
   exchange=await client.observe(record.callId,request);
  }else{
   const prepared=await client.prepare(request);
   // Persist intent before transport: a lost response must not trigger another
   // paid WASM call when this journal is reopened.
   const claim=await journal.registerOperation({actionId:jobId+':outlayer-dispatch',fingerprint:requestHash,provider:'outlayer',mode:'live',status:'unknown'});
   if(claim.replayed)fail('OUTLAYER_ORIGINAL_CALL_ID_REQUIRED');
   await save({status:'dispatching'});
   exchange=await readExchange(await prepared.start());
  }
  for(let poll=0;;poll++){
   await capture('response',exchange);
   if(!exchange.ok||exchange.parseError)fail('OUTLAYER_RESPONSE_UNAVAILABLE');
   const callId=exchange.value?.call_id;
   if(!/^[a-f0-9-]{36}$/i.test(callId??'')||record.callId&&record.callId!==callId)fail('OUTLAYER_RESPONSE_UNCORRELATED');
   await save({callId,status:exchange.value.status});
   const decoded=await client.decode(exchange,request);
   await save({status:decoded.status==='confirmed'?'verifying':decoded.status,result:decoded});
   if(decoded.status==='pending'&&poll<maxPolls){
    await new Promise(resolve=>setTimeout(resolve,pollIntervalMs));
    exchange=await client.observe(callId,request);continue;
   }
   if(decoded.status!=='confirmed'||!decoded.proof)fail(decoded.code??'OUTLAYER_EVALUATION_UNAVAILABLE');
   let output=decoded.output;
   if(typeof output==='string')try{output=JSON.parse(output);}catch{fail('OUTLAYER_OUTPUT_INVALID');}
   if(fingerprint(output)!==fingerprint(evaluateTemplateChange({baseline,candidate,contract})))fail('FIXED_EVALUATION_DIVERGED');
   const result={...decoded,output,attestationEvidenceRef:record.attestationEvidenceRef,responseEvidenceRef:record.responseEvidenceRef};
   await save({status:'confirmed',result});return result;
  }
 }};
}
