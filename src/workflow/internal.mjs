import {ContractError,fingerprint} from '../contracts.mjs';
import {createAutonomyWriter} from '../autonomy/plans.mjs';
import {resolveEffectiveContext} from '../autonomy/context.mjs';

/** Internal work has no customer order, synthetic payment or component grant.
 * The only production generation port is the real M07 SDK adapter. */
export function createInternalWork({journal,rules,treasury,inference,knowledge,catalog,companyId,clock=()=>new Date(),getAgentAuthorization=()=>null}) {
  const apply=createAutonomyWriter({journal,rules,companyId});
  const now=()=>new Date(clock()).toISOString();
  const work=id=>{const w=journal.get('agentWork',id);if(!w||w.companyId!==companyId)throw new ContractError('NOT_FOUND','Internal work not found.');return w;};
  const access=frame=>({role:'agent',companyId,...frame});
  const gateAction=(type,frame,suffix='')=>({id:`${work(frame.workId).effectId}:${type}:${frame.runId}:${frame.fence}${suffix}`,type,...frame});
  async function preparationFailure(frame,{source,stage,reasonCode}){
    const id=`${frame.workId}:${frame.runId}:${frame.fence}:${stage}-failure`;
    const record=journal.get('internalPreparationFailures',id)??{id,source,companyId,...frame,stage,reasonCode,observedAt:now()};
    await journal.transaction({actionId:`internal-preparation-failure:${id}`,fingerprint:fingerprint(record)},tx=>{tx.put('internalPreparationFailures',id,record);return null;});
    const blocked=await apply({...gateAction('agent_preparation_blocked',frame,`:${stage}`),observationId:id},{}, {allowHold:true});
    return {...blocked,retryable:true,external:stage==='knowledge_capture'?'knowledge':'context'};
  }

  async function observe(frame,result) {
    const w=work(frame.workId),id=`${w.effectId}:result:${fingerprint(result)}`;
    // Equal provider observations replay the first immutable fact. A new local
    // timestamp must not make the same observation identity conflict.
    const record=journal.get('internalResults',id)??{id,source:'local-sdk',companyId,workId:w.id,effectId:w.effectId,runId:frame.runId,fence:frame.fence,requestFingerprint:w.requestFingerprint,result,observedAt:now()};
    await journal.transaction({actionId:`internal-observation:${id}`,fingerprint:fingerprint(record)},tx=>{tx.put('internalResults',id,record);return null;});
    await apply({id:`${id}:observe`,type:'agent_observe',workId:w.id,resultId:id},{}, {allowHold:true});
    const cost=rules.evaluate({id:`${id}:consumption`,type:'agent_consumption',workId:w.id,resultId:id},{financial:treasury.snapshot()});
    // An original actual bill is consumed once. Re-observing the same result (reconcile,
    // restart, proof recovery) must not re-evaluate against already-reduced credit.
    const consumed=cost.status==='allow'&&cost.plan?.receiptId&&treasury.snapshot().receipts?.some(r=>r.id===`receipt:${cost.plan.receiptId}`);
    if(cost.status==='allow'&&!consumed)await treasury.applyDecision({actionId:`${id}:consumption`,decision:cost});
    return {record,decision:cost};
  }
  async function prepare(frame) {
    let w=work(frame.workId);
    const agent=journal.get('agents',w.actorId),contextId=`${w.id}:${frame.runId}:${frame.fence}`;
    let record=journal.get('internalContexts',contextId);
    if(!record){
      const scope=w.scope??agent?.scope;
      let companyKnowledge=null;
      // Persist only actual, sanitized failures. M01 releases the local claim and holds
      // unchanged semantic conditions across time/restarts without spending another step.
      if(knowledge)try{companyKnowledge=await knowledge.capture(w.actorId,scope?.knowledgeIds??[],access(frame));}catch(error){
        const reasonCode=['CURRENT_KNOWLEDGE_GRANT_REQUIRED','KNOWLEDGE_GRANT_REQUIRED','KNOWLEDGE_ACCESS_DENIED'].includes(error?.code)?'CURRENT_KNOWLEDGE_GRANT_REQUIRED':error?.code==='INTERNAL_CONTEXT_REQUIRED'?'INTERNAL_CONTEXT_REQUIRED':'JBRAIN_UNAVAILABLE';
        return preparationFailure(frame,{source:'internal-knowledge-capture',stage:'knowledge_capture',reasonCode});
      }
      let context;
      try{context=resolveEffectiveContext({journal,catalog,companyId,agent,companyKnowledge});}catch(error){
        if(!(error instanceof ContractError)||!['CATALOG_REVISION_CHANGED','CATALOG_REVISION_UNAVAILABLE','REVISION_INTEGRITY_FAILED','COMPANY_SCOPE_MISMATCH'].includes(error.code))throw error;
        return preparationFailure(frame,{source:'internal-context-resolution',stage:'context_resolution',reasonCode:error.code});
      }
      record={id:contextId,companyId,workId:w.id,runId:frame.runId,fence:frame.fence,profileRevision:agent.version,context,contextHash:context.contextHash,capturedAt:now()};
      await journal.transaction({actionId:`internal-context:${record.id}`,fingerprint:fingerprint(record)},tx=>{tx.put('internalContexts',record.id,record);return null;});
    }else knowledge?.assertSnapshot(record.context.companyKnowledge,access(frame));
    const prepared=await apply(gateAction('agent_prepare',frame),{financial:treasury.snapshot()}, {allowHold:true});
    if(prepared.decision.status!=='allow')return prepared;
    // Replay never replaces a current authority/fence check.
    const fresh=rules.evaluate(gateAction('agent_prepare',frame),{financial:treasury.snapshot()});
    if(fresh.status!=='allow')return {decision:fresh};
    const {request,action}=fresh.plan;
    if(!request||!action)return {decision:{status:'hold',reasonCode:'INTERNAL_REQUEST_REQUIRED'}};
    const oldEffect=journal.get('internalEffects',action.id);
    const replacement=oldEffect&&fingerprint(oldEffect.action)!==fingerprint(action);
    const effect={id:action.id,companyId,workId:w.id,action,request,requestFingerprint:fingerprint(request),admittedRunId:frame.runId,admittedFence:frame.fence,version:replacement?oldEffect.version+1:oldEffect?.version??1};
    if(replacement&&(oldEffect.requestFingerprint!==effect.requestFingerprint||oldEffect.workId!==w.id))return {decision:{status:'hold',reasonCode:'ORIGINAL_EFFECT_MISMATCH'}};
    if(!oldEffect||replacement)await journal.transaction({actionId:replacement?`internal-effect-recovery:${effect.id}:${frame.fence}`:`internal-effect:${effect.id}`,fingerprint:fingerprint(effect)},tx=>{
      const current=rules.evaluate(gateAction('agent_prepare',frame),{financial:treasury.snapshot()});
      if(current.status!=='allow'||fingerprint(current.plan.action)!==fingerprint(action))throw new ContractError(current.reasonCode??'STALE_WORK_FENCE','Current preparation scope changed.');
      if(replacement){
        const financial=tx.get('treasury','financial');
        if(tx.getOperation(`adapters:m07:${effect.id}`)||financial?.approvedPlans?.some(p=>p.actionId===effect.id)||financial?.consumedPermits?.some(p=>p.actionId===effect.id))throw new ContractError('RECONCILIATION_REQUIRED','The original effect must be reconciled.');
      }
      tx.put('internalEffects',effect.id,effect,{expectedVersion:replacement?oldEffect.version:oldEffect?undefined:0});return null;
    });
    // M01 has checked paid authority/bounds before this read-only attestation
    // preparation. It cannot send a completion.
    const result=await inference.prepare({action,request});
    if(result.status!=='confirmed'){
      // Preparation never sent a completion. Report the truthful local blocker rather than the
      // unrelated consumption verdict. A retry still needs changed M01 admission conditions.
      await observe(frame,result);
      const blocked=work(frame.workId);
      return {decision:{status:'hold',reasonCode:blocked.reasonCode??'INFERENCE_NOT_SUBMITTED'},result,retryable:result.status==='not_submitted',external:'inference',providerCode:typeof result.code==='string'?result.code:null};
    }
    const after=rules.evaluate({id:action.id,type:'agent_inference',...action},{financial:treasury.snapshot(),creditId:getAgentAuthorization()?.creditId});
    return {decision:after,action,request,result};
  }
  async function accept(frame,resultId) {
    const w=work(frame.workId);
    const proofRevision=fingerprint(journal.list('verificationResults').filter(r=>r.requestFingerprint===w.requestFingerprint));
    // A new trusted verification finding is a new acceptance observation; it
    // must not replay an older held verdict for the same immutable result.
    return apply({...gateAction('agent_result',frame,`:${resultId}:proof:${proofRevision}`),resultId},{}, {allowHold:true});
  }
  async function execute(frame) {
    const w=work(frame.workId),existing=journal.get('internalEffects',w.effectId);
    // A persisted provider intent is not proof that it is safe to resend.
    if(existing&&journal.getOperation(`adapters:m07:${w.effectId}`))return reconcile({workId:w.id});
    const p=await prepare(frame);
    if(p.decision.status!=='allow')return p;
    const {action,request}=p,creditId=getAgentAuthorization()?.creditId;
    const facts={financial:treasury.snapshot(),creditId,request};
    const decision=rules.evaluate(action,facts);
    if(decision.status!=='allow')return {decision};
    await treasury.applyDecision({actionId:action.id,decision});
    const lot=treasury.snapshot().credits.lots.find(l=>l.id===creditId);
    const result=await inference.generate({action,decision,facts,request,credit:{status:'confirmed',availableNanoUsd:lot?.availableNanoUsd??'0'}});
    const observed=await observe(frame,result);
    const accepted=await accept(frame,observed.record.id);
    return {...accepted,resultId:observed.record.id};
  }
  async function reconcile({workId}) {
    const w=work(workId),effect=journal.get('internalEffects',w.effectId);
    if(!effect)return {decision:{status:'hold',reasonCode:'ORIGINAL_EFFECT_REQUIRED'}};
    const result=await inference.reconcile({action:effect.action,request:effect.request});
    const frame={workId:w.id,runId:effect.admittedRunId,fence:effect.admittedFence};
    const observed=await observe(frame,result);
    // Reconciliation records money/status while paused; it does not renew the
    // original actor's authority to issue commands or create a replacement call.
    const current=work(workId);
    if(current.lease&&Date.parse(current.lease.leaseUntil)>new Date(clock()).getTime()){
      const accepted=await accept({workId,runId:current.lease.runId,fence:current.lease.fence},observed.record.id);
      return {...accepted,resultId:observed.record.id};
    }
    const recovered=await apply({id:`${observed.record.id}:recover:${current.version}`,type:'autonomy_recover_result',workId,resultId:observed.record.id},{}, {allowHold:true});
    if(recovered.decision.status==='allow'){
      const renewed=work(workId),accepted=await accept({workId,runId:renewed.lease.runId,fence:renewed.lease.fence},observed.record.id);
      return {...accepted,resultId:observed.record.id,recovered:true};
    }
    return {...recovered,resultId:observed.record.id};
  }
  return {prepare,execute,accept,reconcile};
}
