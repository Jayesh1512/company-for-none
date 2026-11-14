import {createHash,randomUUID} from 'node:crypto';
import {ContractError,fingerprint} from '../contracts.mjs';
import {AI_DEMO_LIMITS} from '../rules/ai-demo.mjs';
import {readCloudJson} from '../cloud/http.mjs';
import {createOperationRuntime,capability} from '../custody/adapter-runtime.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const caches=new WeakMap();
export function readAiDemoFacts({journal,companyId,providers}){
 return {companyId,...caches.get(journal),authorization:providers.getAiDemoAuthorization(),control:journal?.get('aiDemoControl','current'),
  agents:journal?.list('agents')??[],documents:journal?.list('companyKnowledgeDocuments')??[],runs:journal?.list('aiDemoRuns')??[],
  results:journal?.list('aiDemoResults')??[],costs:journal?.list('aiDemoCosts')??[],proofs:journal?.list('aiDemoProofs')??[]};
}
const error=code=>Object.assign(new ContractError(code,code),{httpStatus:code==='ACCESS_DENIED'?403:409});
const allowed=d=>{if(d.status!=='allow')throw error(d.reasonCode);return d.plan;};
const price=value=>{if(typeof value!=='string'||!/^\d+(\.\d{1,15})?$/.test(value))throw error('AI_DEMO_PRICE_INVALID');const [a,b='']=value.split('.');return (BigInt(a)*10n**15n+BigInt(b.padEnd(15,'0'))).toString();};

/** Real, owner-invoked support agent. No public caller, synthetic provider,
 * agent-credit opening, automatic retry, purchase or wallet port exists here. */
export function createAiDemo({journal,rules,treasury,knowledge,providers,companyId,clock=()=>new Date(),
 loadVerification=()=>import('../inference/verification.mjs'),readProvider=readCloudJson}){
 caches.set(journal,{});let queue=Promise.resolve();
 const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const at=()=>new Date(clock()).toISOString();
 const decide=(type,access,extra={},facts={})=>rules.evaluate({id:`${extra.runId??'ai-demo'}:${type}`,type,...extra},{access,financial:treasury.snapshot(),...facts});
 const write=async(id,namespace,value)=>journal.transaction({actionId:id,fingerprint:fingerprint(value)},tx=>{tx.put(namespace,value.id,value);return null;});
 const recordProof=async(runId,proof)=>{
  await write(`ai-demo:proof:${proof.id}:${fingerprint(proof)}`,'verificationResults',proof);
  const link={id:`${runId}:${proof.stage}`,runId,proof};await write(`ai-demo:proof-link:${fingerprint(link)}`,'aiDemoProofs',link);
 };
 function current(run){
  const data=readAiDemoFacts({journal,companyId,providers}),a=data.agents.find(a=>a.id===run.agentId);
  return a?.status==='ready'&&a.version===run.agentVersion&&run.context.documents.every(d=>data.documents.some(v=>v.id===d.id&&v.revision===d.revision&&v.agentIds?.includes(a.id)&&v.visibility==='company'));
 }
 function project(run){
  const visible=current(run),{context,request,credentialHash,...safe}=run;
  const noDispatch=run.status==='not_submitted'&&!treasury.snapshot().reservations.some(r=>r.actionId===`${run.id}:inference`);
  return {...safe,...noDispatch?{cost:{status:'not_incurred',maximumNanoUsd:'0'}}:{},...!visible?{status:'held',reasonCode:'AI_DEMO_CONTEXT_REVOKED',answer:null,citations:[]}:{},
   sources:(context?.documents??[]).map(d=>({id:d.id,title:d.title,revision:d.revision})),
   acceptance:'live-process-e2ee',offlinePlaintextRecovery:false,fundingSource:'owner-cloud-key'};
 }
 async function visibleRun(run,access){const result=project(run);if(result.answer){try{await nativeCurrent(run,access);}catch{return {...result,status:'held',reasonCode:'AI_DEMO_CONTEXT_REVOKED',answer:null,citations:[]};}}return result;}
 async function view(access){allowed(decide('ai_demo_view',access));const data=readAiDemoFacts({journal,companyId,providers});
  return {authorized:!!data.authorization?.enabled,paused:data.control?.paused===true,limits:AI_DEMO_LIMITS,agents:data.agents.filter(a=>a.status==='ready').map(a=>({id:a.id,name:a.name,role:a.role,documentIds:data.documents.filter(d=>d.visibility==='company'&&d.agentIds?.includes(a.id)).map(d=>d.id)})),
   documents:data.documents.map(d=>({id:d.id,title:d.title,revision:d.revision})),runs:(await Promise.all(data.runs.map(run=>visibleRun(run,access)))).reverse(),
   financial:{reservations:treasury.snapshot().reservations.filter(r=>r.fundingSource==='owner-cloud-key').map(r=>({id:r.id,actionId:r.actionId,status:r.status,upperBoundNanoUsd:r.upperBoundNanoUsd,actualCostNanoUsd:r.actualCostNanoUsd??null}))},
   e2ee:true,acceptance:'live-process-e2ee',autonomousPurchase:false,publicService:false};
 }
 async function nativeCurrent(run,access){
  const fresh=await knowledge.previewContext(run.agentId,run.context.documents.map(d=>d.id),access);
  if(fingerprint(fresh.documents)!==fingerprint(run.context.documents))throw error('AI_DEMO_CONTEXT_REVOKED');
  knowledge.assertPreviewSnapshot(run.context,access);
 }
 async function pricing(){
  const r=await readProvider({path:'/models',timeoutMs:15000});const m=r.data.data?.find(m=>m.id===AI_DEMO_LIMITS.model);
  if(!m?.pricing||m.pricing.request!=='0')throw error('AI_DEMO_PRICING_REQUIRED');
  const ref=await journal.putArtifact({actionId:`ai-demo:pricing:${r.raw.bodyHash}`,content:JSON.stringify(r.raw),mediaType:'application/json'});
  const value={model:m.id,inputPerMillionNanoUsd:price(m.pricing.prompt),outputPerMillionNanoUsd:price(m.pricing.completion),requestNanoUsd:'0',contextTokens:m.context_length,modelOutputTokens:m.max_output_length,reference:`private:${ref.id}`,observedAt:at(),expiresAt:new Date(new Date(clock()).getTime()+300000).toISOString()};
  caches.get(journal).pricing=value;return value;
 }
 async function updateReservation(run,result,access){
  const d=rules.evaluate({id:`${run.id}:reservation:${fingerprint(result)}`,type:'ai_demo_cost',runId:run.id},{access,financial:treasury.snapshot()});
  if(d.status==='allow')await treasury.applyDecision({actionId:d.actionId,decision:d});
 }
 async function bill(run,access){
  if(!run.inferenceId)return;
  try{
   const token=await providers.resolveSecret(providers.cloudSecretRef),r=await readProvider({path:'/billing/costs',method:'POST',body:{requestIds:[run.inferenceId]},token,timeoutMs:10000});
   const row=r.data.requests?.find(r=>r.requestId===run.inferenceId);
   // A delayed/missing/zero bill is not free and never releases its reservation.
   const amount=typeof row?.costNanoUsd==='string'?row.costNanoUsd:Number.isSafeInteger(row?.costNanoUsd)?String(row.costNanoUsd):null;
   if(r.data.warning||!amount||!/^\d+$/.test(amount)||BigInt(amount)<=0n)return;
   const artifact=await journal.putArtifact({actionId:`${run.id}:bill:${r.raw.bodyHash}`,content:JSON.stringify(r.raw),mediaType:'application/json'});
   const cost={id:`ai-demo-bill:${run.inferenceId}`,runId:run.id,actualCostNanoUsd:amount,reference:`private:${artifact.id}`};
   await write(cost.id,'aiDemoCosts',cost);
   const d=decide('ai_demo_cost',access,{runId:run.id});if(d.status==='allow')await treasury.applyDecision({actionId:d.actionId,decision:d});
   run.cost={status:d.status==='allow'?'confirmed':'held',actualCostNanoUsd:amount,reasonCode:d.reasonCode};
  }catch{/* An unavailable bill remains pending at the full reserved maximum. */}
 }
 async function runNow(access,input,key){
  allowed(decide('ai_demo_view',access));
  if(typeof key!=='string'||!key||key.length>160)throw error('IDEMPOTENCY_KEY_REQUIRED');
  const id=`ai-demo:${fingerprint({companyId,key})}`,old=journal.get('aiDemoRuns',id);
  if(old){if(old.inputFingerprint!==fingerprint(input))throw error('CONFLICT');return {...await visibleRun(old,access),replayed:true};}
  const token=await providers.resolveSecret(providers.cloudSecretRef);if(typeof token!=='string'||!token)throw error('CREDENTIAL_UNAVAILABLE');
  const cache=caches.get(journal);cache.credentialHash=sha(token);
  // Fresh native JBrain, existing grants only. The owner chooses the agent/docs.
  cache.context=await knowledge.previewContext(input.agentId,input.documentIds,access);
  const plan=allowed(decide('ai_demo_prepare',access,{runId:id},{input}));
  let run={id,companyId,inputFingerprint:fingerprint(input),question:input.question,agentId:plan.agentId,agentVersion:plan.agentVersion,authorizationId:plan.authorizationId,controlVersion:plan.controlVersion,request:plan.request,requestFingerprint:plan.requestFingerprint,context:plan.context,status:'prepared',createdAt:at(),updatedAt:at(),cost:{status:'pending',maximumNanoUsd:AI_DEMO_LIMITS.maxRequestNanoUsd},trace:[{step:'agent-assigned',at:at(),agentId:plan.agentId},{step:'native-knowledge-read',at:at(),documentCount:plan.context.documents.length}]};
  await write(`${id}:prepared`,'aiDemoRuns',run);
  let result,send;
  const action={id:`${id}:inference`,type:'ai_demo_inference',runId:id,requestFingerprint:run.requestFingerprint,maxCostNanoUsd:AI_DEMO_LIMITS.maxRequestNanoUsd};
  try{
   await pricing();
   const {createCloudVerification}=await loadVerification();const verifier=createCloudVerification({journal,clock,resolveSecret:providers.resolveSecret,secretRef:providers.cloudSecretRef,limits:{timeoutMs:30000,maxEvidenceBytes:4*1024*1024}});
   send=await verifier.prepare({action,request:run.request,verificationSpec:run.request.verificationSpec});
   await recordProof(id,send.preflight);await nativeCurrent(run,access);
   const decision=decide('ai_demo_inference',access,action);
   allowed(decision);await treasury.applyDecision({actionId:action.id,decision});
   const facts=()=>({access,action,financial:treasury.snapshot()});
   const runtime=createOperationRuntime({journal,namespace:'ai-demo-cloud',meta:capability('M07','live','near-ai-cloud'),clock,
    dispatchAuthorized:async(_,callback)=>{
     await nativeCurrent(run,access);
     const before=rules.validateDispatch(decision.permit,facts());if(before.status!=='allow')return before;
     await treasury.consumePermit({actionId:action.id,permit:decision.permit,decision:before});
     knowledge.assertPreviewSnapshot(run.context,access);
     return rules.dispatch(decision.permit,facts(),callback);
    }});
   result=await runtime.execute({action,decision,facts:facts(),payload:run.request,send:()=>send()});
   if(result.proof)await recordProof(id,result.proof);
   const value={id:`${id}:result`,runId:id,output:result.generation?.output??null,result};await write(value.id,'aiDemoResults',value);
   await updateReservation(run,result,access);
   run.providerRequestId=result.providerRequestId??null;run.inferenceId=result.inferenceId??null;
   run.trace.push({step:'cloud-completion',at:at(),status:result.status},{step:'official-sdk-verification',at:at(),status:result.proof?.status??'unavailable'});
   await nativeCurrent(run,access);
   const accepted=decide('ai_demo_accept',access,{runId:id});
   if(accepted.status==='allow'){
    const p=accepted.plan;Object.assign(run,{status:p.escalate?'escalated':'answered',answer:p.answer,citations:p.citations,reason:p.reason,verification:{status:'verified',scope:p.acceptance,wireSignatureVerified:true,plaintextVerifiedInOriginalCall:true,offlinePlaintextRecovery:false}});
    if(p.escalate){const ticket={id:`${id}:ticket`,companyId,conversationId:id,serviceId:'owner-ai-demo',agentId:run.agentId,summary:run.question,reasonCode:'AI_OWNER_REVIEW_REQUIRED',state:'open',createdAt:at(),updatedAt:at(),version:1};await write(ticket.id,'supportTickets',ticket);run.ticketId=ticket.id;}
    run.trace.push({step:p.escalate?'owner-ticket-created':'citations-accepted',at:at()});
   }else Object.assign(run,{status:'held',reasonCode:result.status==='failed'?result.proof?.reasonCode??accepted.reasonCode:accepted.reasonCode,answer:null,citations:[]});
   await bill(run,access);
  }catch(e){
   // A persisted intent or accepted effect is never regenerated to fill a gap.
   const op=journal.getOperation(`ai-demo-cloud:${action.id}`);
   Object.assign(run,{status:op&&op.status!=='not_submitted'?'held':'not_submitted',reasonCode:e.code??'AI_DEMO_UNAVAILABLE',answer:null,citations:[]});
   if(e.result)await recordProof(id,e.result);
   if(treasury.snapshot().reservations.some(r=>r.actionId===action.id)){
    const failure=op?.result??{status:op?'unknown':'not_submitted',code:run.reasonCode};
    await write(`${id}:failed-result`,'aiDemoResults',{id:`${id}:result`,runId:id,output:null,result:failure});
    await updateReservation(run,failure,access);
   }
   if(!op||op.status==='not_submitted')run.cost={status:'not_incurred',maximumNanoUsd:'0'};
  }
  run.updatedAt=at();await journal.transaction({actionId:`${id}:finished`,fingerprint:fingerprint(run)},tx=>{tx.put('aiDemoRuns',id,run);tx.append('ai_demo.completed',{companyId,runId:id,agentId:run.agentId,status:run.status,mode:'live',costStatus:run.cost.status,maximumNanoUsd:AI_DEMO_LIMITS.maxRequestNanoUsd,reasonCode:run.reasonCode??null});return null;});
  return project(run);
 }
 async function control(access,input){const plan=allowed(decide('ai_demo_control',access,{}, {input}));await journal.transaction({actionId:`ai-demo:control:${randomUUID()}`,fingerprint:fingerprint(plan)},tx=>{const old=tx.get('aiDemoControl','current');tx.put('aiDemoControl','current',{id:'current',companyId,version:(old?.version??0)+1,paused:plan.paused,updatedAt:at()});return null;});return {paused:plan.paused};}
 // Stop is deliberately outside the inference queue: it can fence an in-flight
 // call. Accepted provider work may still be billed; stop cannot cancel it.
 return {view,control,run:(...args)=>serial(()=>runNow(...args))};
}
