import {capability,createOperationRuntime,result,unsupported,digest} from '../custody/adapter-runtime.mjs';
import {describeCloudRequest} from '../cloud-contracts.mjs';
import {prepareCloudPost} from './http.mjs';
import {responseEvidence,validateRerankOutput} from './technical-facts.mjs';
import {boundedBytes,bytesHash} from '../inference/capture.mjs';
export {describeCloudRequest,appendFunctionOutputs} from '../cloud-contracts.mjs';

/** Real specialized protocols. HTTP success is neither paid-call authority nor TEE proof. */
export function createCloudProductAdapter(options={}){
 const {journal,clock=()=>new Date()}=options,mode=options.mode==='live'?'live':'unavailable';
 const meta=capability('M07',mode,'near-ai-cloud-products',{proofVerificationSupported:false,autonomousFunding:false});
 const runtime=createOperationRuntime({journal,namespace:'adapters:cloud-products',meta,clock,dispatchAuthorized:options.dispatchAuthorized});
 return {
  capabilities:()=>structuredClone(meta),
  async execute({action,decision,facts,request}={}){
   if(mode!=='live')return unsupported(meta,action);
   let wire;try{wire=describeCloudRequest(request);}catch(error){return result(meta,'not_submitted',action,{code:error.code??'INVALID_INPUT'});}
   if(action?.type!=='cloud_product_execute'||action.requestFingerprint!==wire.requestFingerprint||decision?.plan?.kind!=='cloud_product_dispatch'||decision.plan.requestFingerprint!==wire.requestFingerprint||digest(decision.plan.request)!==digest(request))return result(meta,'not_submitted',action,{code:'EXACT_CLOUD_PLAN_REQUIRED'});
   return runtime.execute({action,decision,facts,payload:request,
    prepare:()=>prepareCloudPost({...options,wire,request}),
    send:send=>send().then(async response=>{
     // Persist exact body bytes privately before parsing. Never persist credential headers.
     const bytes=await boundedBytes(response.body,request.maxResponseBytes),inferenceId=response.headers.get('inference-id');
     const captured={product:request.product,requestFingerprint:wire.requestFingerprint,requestBody:wire.body,response:{status:response.status,bodyBase64:Buffer.from(bytes).toString('base64'),bodyHash:bytesHash(bytes)},observedAt:new Date(clock()).toISOString()};
     const ref=await journal.putArtifact({actionId:`cloud-product:${action.id}:${digest(captured)}`,content:JSON.stringify(captured),mediaType:'application/json'});
     let output=null;try{output=JSON.parse(Buffer.from(bytes).toString('utf8'));}catch{}
     const ok=response.ok&&output!==null,evidence=responseEvidence({product:request.product,requestBytes:Buffer.from(typeof wire.body==='string'?wire.body:JSON.stringify(wire.body)),responseBytes:bytes});
     const shape=ok&&request.product==='rerank'?validateRerankOutput(output,request)!==null:ok;
     return result(meta,ok&&shape?'confirmed':'unknown',action,{product:request.product,
      providerRequestId:typeof output?.id==='string'?output.id:response.headers.get('x-generation-id'),inferenceId,
      supportRequestId:response.headers.get('x-request-id'),evidenceRef:`private:${ref.id}`,exactBytes:{requestHash:evidence.requestHash,responseHash:evidence.responseHash},
      output,cost:{status:'pending',actualCostNanoUsd:null,plannedBound:decision.plan.costBound??null},proof:evidence.proof,
      accepted:false,code:ok&&shape?'OUTPUT_REQUIRES_VERIFICATION':ok?'PROVIDER_OUTPUT_SCHEMA_INVALID':'PROVIDER_OUTCOME_UNRESOLVED'});
    })});
  },
  async reconcile({action,request}={}){
   if(mode!=='live')return unsupported(meta,action);
   if(action?.requestFingerprint!==digest(request))return result(meta,'not_submitted',action,{code:'CONFLICT'});
   // No documented output recovery or durable specialized proof route. Never resend.
   return runtime.reconcile(action,async op=>op.result??result(meta,'unknown',action,{code:'RECONCILIATION_REQUIRED',cost:{status:'pending',actualCostNanoUsd:null},accepted:false}));
  },
 };
}
