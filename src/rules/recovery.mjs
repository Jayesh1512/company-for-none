import {randomUUID} from 'node:crypto';
import {fingerprint} from '../contracts.mjs';
import {verificationSpec,verifyInferenceEvidence} from './verification.mjs';
import {lifetimeExposure} from './ceiling.mjs';
import {generationInputBytes} from '../generation-contracts.mjs';
import {evaluateTemplateChange} from '../autonomy/evaluation.mjs';
import {recoveryScenario,DEFAULT_RECOVERY_SCENARIO} from '../demo/recovery-scenarios.mjs';

export const RECOVERY_LIMITS=Object.freeze({model:'Qwen/Qwen3.8-27B',maxCalls:6,maxRequestNanoUsd:'100000000',maxTotalNanoUsd:'600000000',maxInputBytes:16000,maxOutputTokens:4096,timeoutMs:90000});
export const RECOVERY_POLICY=Object.freeze({inferenceVerification:{allowedTcbStatuses:['UpToDate'],maxAttestationAgeMs:300000,responseAcceptance:'live-verified-hold-on-loss'}});
export const RECOVERY_SPEC=verificationSpec(RECOVERY_POLICY);
export const RECOVERY_ROLES=['manager','support_before','backlog','knowledge_curator','template_developer','support_after'];
const outcome=(status,reasonCode,plan)=>({status,reasonCode,...plan?{plan}:{}});
const hold=code=>outcome('hold',code);
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=6000;
const same=(a,b)=>fingerprint(a)===fingerprint(b);

/** A deliberately separate owner-funded scope. This never changes the ordinary
 * company's inference policy, grants, evaluators or paid commercial authority. */
export function createRecoveryRules({base,companyId,facts,clock=()=>new Date(),scenarioId=DEFAULT_RECOVERY_SCENARIO}){
 const scenario=recoveryScenario(scenarioId);
 const permits=new Map(),spent=new Set();
 const now=()=>new Date(clock()).getTime();
 function decide(action,input){
  const d=facts(),run=d.runs.find(r=>r.id===action.runId),owner=input.access?.role==='owner'&&input.access.companyId===companyId&&input.access.verified===true;
  if(!owner)return outcome('deny','ACCESS_DENIED');
  if(action.type==='recovery_view')return outcome('allow','APPROVED',{});
  // A recorded original bill is an observation, even if its document grant or
  // model-work authority changed later. Recording it never dispatches inference.
  if(action.type==='recovery_cost'){
   const r=input.financial?.reservations.find(r=>r.actionId===run?.id+':inference'),cost=run?.billing;
   if(!run||!r||!cost||!/^\d+$/.test(cost.actualCostNanoUsd)||cost.actualCostNanoUsd==='0'||cost.reference!==run.result?.inferenceId)return hold('RECOVERY_BILL_PENDING');
   if(BigInt(cost.actualCostNanoUsd)>BigInt(r.upperBoundNanoUsd))return hold('PROVIDER_COST_BOUND_BREACH');
   return outcome('allow','APPROVED',{kind:'operational_cost',reservationId:r.id,receiptId:run.id+':bill',evidenceRef:cost.reference,actualCostNanoUsd:cost.actualCostNanoUsd,accountingDay:r.accountingDay,expenseCategory:'owner_cloud_recovery_inference'});
  }
  const g=d.authorization;
  if(!g?.enabled||g.companyId!==companyId||g.model!==RECOVERY_LIMITS.model||g.maxTotalNanoUsd!==RECOVERY_LIMITS.maxTotalNanoUsd||g.responseAcceptance!=='live-verified-hold-on-loss'||g.credentialHash!==d.credentialHash||Date.parse(g.expiresAt)<=now())return hold('RECOVERY_AUTHORIZATION_REQUIRED');
  if(base.snapshot().config?.killSwitch)return hold('KILL_SWITCH');
  if(!run||!RECOVERY_ROLES.includes(run.role)||run.request.model!==RECOVERY_LIMITS.model||run.requestFingerprint!==fingerprint(run.request)||run.request.maxOutputTokens!==RECOVERY_LIMITS.maxOutputTokens||run.request.maxInputBytes!==RECOVERY_LIMITS.maxInputBytes||generationInputBytes(run.request)>RECOVERY_LIMITS.maxInputBytes||!same(run.request.verificationSpec,RECOVERY_SPEC))return hold('RECOVERY_REQUEST_REQUIRED');
  const agent=d.agents.find(a=>a.id===run.actorId);
  if(!agent||agent.companyId!==companyId||agent.version!==run.agentVersion||agent.status!=='ready')return hold('RECOVERY_AGENT_CHANGED');
  if(run.documents.some(doc=>!d.documents.some(current=>current.id===doc.id&&current.revision===doc.revision&&current.agentIds.includes(agent.id))))return hold('RECOVERY_CONTEXT_CHANGED');
  const verify=stage=>verifyInferenceEvidence(stage,{request:run.request,requestFingerprint:run.requestFingerprint,prepared:true,output:run.result?.generation?.output},{verificationResults:d.verificationResults},RECOVERY_POLICY,now());
  if(action.type==='recovery_inference'){
   if(run.state!=='prepared'||action.id!==run.id+':inference'||action.requestFingerprint!==run.requestFingerprint||action.maxCostNanoUsd!==RECOVERY_LIMITS.maxRequestNanoUsd)return hold('ORIGINAL_OPERATION_REQUIRED');
   if(d.runs.filter(r=>r.dispatchIntent||r.id===run.id).length>RECOVERY_LIMITS.maxCalls||d.runs.some(r=>r.id!==run.id&&r.dispatchIntent&&['dispatching','unknown','held'].includes(r.state)))return hold('RECOVERY_UNRESOLVED_RUN');
   if(!input.financial||lifetimeExposure(input.financial,action.id)+BigInt(action.maxCostNanoUsd)>BigInt(g.maxTotalNanoUsd))return hold('TOTAL_CEILING_EXCEEDED');
   const b=d.pricing;
   if(!b||b.model!==run.request.model||Date.parse(b.expiresAt)<=now()||b.requestNanoUsd!=='0'||!Number.isSafeInteger(b.contextTokens)||!Number.isSafeInteger(b.outputTokens)||b.outputTokens<run.request.maxOutputTokens)return hold('RECOVERY_PRICING_REQUIRED');
   // Reserve the entire advertised model window, including reasoning. No guessed
   // byte/token conversion, provider credit or fictional cash is introduced.
   const bound=(BigInt(b.contextTokens)*BigInt(b.inputPerMillionNanoUsd)+BigInt(b.outputTokens)*BigInt(b.outputPerMillionNanoUsd)+999999n)/1000000n;
   if(bound>BigInt(action.maxCostNanoUsd))return hold('RECOVERY_PRICE_BOUND_EXCEEDED');
   const checked=verify('preflight');if(checked.status!=='allow')return checked;
   return outcome('allow','APPROVED',{kind:'reservation',requestBytesHash:checked.plan.requestBytesHash,reservation:{id:'reservation:'+action.id,actionId:action.id,purpose:'inference',fundingSource:'owner-cloud-key',upperBoundNanoUsd:action.maxCostNanoUsd,status:'reserved',accountingDay:new Date(clock()).toISOString().slice(0,10)}});
  }
  if(action.type==='recovery_accept'){
   if(run.state!=='generated')return hold('RECOVERY_RESULT_REQUIRED');
   const checked=verify('response');if(checked.status!=='allow')return checked;
   let value;try{value=JSON.parse(run.result.generation.output.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{return hold('RECOVERY_INVALID_JSON');}
   if(!text(value.summary))return hold('RECOVERY_SUMMARY_REQUIRED');
   if(run.role==='manager'&&!same(value.delegate,['support']))return hold('RECOVERY_DELEGATION_INVALID');
   if(run.role==='backlog'&&(!Array.isArray(value.delegate)||!value.delegate.length||new Set(value.delegate).size!==value.delegate.length||value.delegate.some(role=>!Object.hasOwn(scenario.repairs,role))))return hold('RECOVERY_DELEGATION_INVALID');
   if(run.role==='knowledge_curator'){
    const source=run.documents.find(doc=>doc.id===d.sourceId);
    if(!source||!text(value.excerpt)||!source.markdown.includes(value.excerpt)||!scenario.evidenceTerms.every(s=>value.excerpt.includes(s)))return hold('RECOVERY_SOURCE_MISMATCH');
   }
   if(run.role==='template_developer'&&!same(value.operations,scenario.repairOperations))return hold('RECOVERY_PATCH_INVALID');
   if(run.role.startsWith('support_')){
    if(!text(value.answer)||!Array.isArray(value.citations)||value.citations.length>4||typeof value.escalate!=='boolean')return hold('RECOVERY_ANSWER_INVALID');
    for(const c of value.citations){const doc=run.documents.find(doc=>doc.id===c.documentId);if(!doc||!text(c.quote)||!doc.markdown.includes(c.quote))return hold('RECOVERY_CITATION_MISMATCH');}
    if(run.role==='support_before'&&value.escalate!==true)return hold('RECOVERY_MISSING_INFORMATION_NOT_ESCALATED');
    if(run.role==='support_after'&&(value.escalate||!value.citations.some(c=>c.quote.includes(scenario.gap.field))||!same(value.intake,scenario.intake)))return hold('RECOVERY_RETRY_NOT_REPAIRED');
   }
   return outcome('allow','APPROVED',{kind:'recovery_commands',value});
  }
  if(action.type==='recovery_promote'){
   const e=d.evaluation,h=d.head,old=d.baseline,candidate=d.candidate,contract=d.contract;
   if(run.role!=='template_developer'||run.state!=='completed'||!same(run.value?.operations,scenario.repairOperations)||!e||!h||h.revisionId!==old?.id||!candidate||!contract)return hold('RECOVERY_PROMOTION_SCOPE_CHANGED');
   const observed=evaluateTemplateChange({baseline:old.body,candidate:candidate.body,contract});
   if(!same(observed,e.observation)||e.source!=='fixed-evaluator'||!observed.repaired||!same(candidate.body.fields,[...old.body.fields,...scenario.repairOperations.map(({name,required})=>({name,required}))]))return hold('RECOVERY_REPAIR_NOT_PROVEN');
   return outcome('allow','APPROVED',{kind:'recovery_promote',priorRevision:old.id,newRevision:candidate.id,targetId:h.targetId});
  }
  return outcome('deny','UNKNOWN_RECOVERY_ACTION');
 }
 const wrapper={...base,evaluate(action,input={}){
  if(!action.type?.startsWith('recovery_'))return base.evaluate(action,input);
  const state=base.snapshot(),result=decide(action,input),d={schemaVersion:1,actionId:action.id,actionFingerprint:fingerprint(action),financialVersion:input.financial?.version??null,policyVersion:state.policyVersion,policyEpoch:state.policyEpoch,mode:'live',...result};
  if(result.status==='allow'&&action.type==='recovery_inference'){
   const permit={id:'recovery-permit:'+randomUUID(),actionId:action.id,actionFingerprint:d.actionFingerprint,policyEpoch:d.policyEpoch,financialVersion:d.financialVersion,expiresAt:new Date(now()+10000).toISOString()};
   permits.set(permit.id,{permit,action:structuredClone(action),decision:d});d.permit=permit;
  }
  return d;
 },validateDispatch(permit,input={}){
  if(!permit?.id?.startsWith('recovery-permit:'))return base.validateDispatch(permit,input);
  const issued=permits.get(permit.id),reject=code=>outcome('hold',code);
  if(!issued||!same(permit,issued.permit)||spent.has(permit.id))return reject('UNTRUSTED_PERMIT');
  if(now()>=Date.parse(permit.expiresAt))return reject('PERMIT_EXPIRED');
  if(!same(input.action,issued.action))return reject('ACTION_MISMATCH');
  const checked=decide(input.action,input);if(checked.status!=='allow')return checked;
  const financial=input.financial,applied=financial?.approvedPlans.find(p=>p.actionId===permit.actionId&&same(p.plan,issued.decision.plan));
  const consumed=financial?.consumedPermits.find(p=>p.id===permit.id);
  if(!applied||financial.version!==applied.appliedVersion+(consumed?1:0)||!same(checked.plan,issued.decision.plan))return reject('STALE_FINANCIAL_STATE');
  return {...issued.decision,financialVersion:financial.version};
 },dispatch(permit,input,callback){
  if(!permit?.id?.startsWith('recovery-permit:'))return base.dispatch(permit,input,callback);
  const d=wrapper.validateDispatch(permit,input);if(d.status!=='allow')return d;
  if(!input.financial.consumedPermits.some(p=>p.id===permit.id))return hold('PERMIT_NOT_CONSUMED');
  spent.add(permit.id);return callback();
 }};
 return wrapper;
}
