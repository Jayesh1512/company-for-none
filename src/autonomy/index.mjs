import {ContractError, fingerprint} from '../contracts.mjs';
import {evaluateTemplateChange} from './evaluation.mjs';
import {createAutonomyWriter} from './plans.mjs';
import {buildLifecycleTrace} from './trace.mjs';

const fail = (code, message = code) => { throw Object.assign(new ContractError(code, message),{httpStatus:code==='ACCESS_DENIED'?403:code==='INVALID_INPUT'?400:409}); };
const UNRESOLVED_STATES=['preparing','prepared','dispatching','pending','unknown','reconciling','proof_held','generated','accepted'];
const unsettled=work=>UNRESOLVED_STATES.includes(work.state)||['pending','unknown','not_submitted'].includes(work.providerStatus)||work.costStatus!=null&&work.costStatus!=='actual';
const pick = (value, fields = []) => Object.fromEntries(fields.filter(k => Object.hasOwn(value, k)).map(k => [k, structuredClone(value[k])]));

/** Mechanics only. Every state transition and projection comes from M01.
 * No provider, shell, owner token, fixture or synthetic model output here. */
export function createAutonomy({journal, rules, internalWork, companyId, clock = () => new Date(), spendExecutor = null, ledgerAutoCommit = null}) {
  let queue = Promise.resolve(), stopped = false;
  const serial = fn => { const work = queue.then(fn); queue = work.catch(() => {}); return work; };
  const company = () => journal.get('autonomousCompanies', companyId);
  const decide = (action, facts) => rules.evaluate(action, facts);
  const apply=createAutonomyWriter({journal,rules,companyId});
  async function recordEvaluation(spec) {
    const observation=evaluateTemplateChange(spec);
    const record={id:spec.evaluationId,source:'fixed-evaluator',companyId,improvementId:spec.improvementId,targetId:spec.targetId,baseRevision:spec.baseRevision,policyVersion:spec.policyVersion,observation,version:1};
    await journal.transaction({actionId:`evaluation:${record.id}`,fingerprint:fingerprint(record)},tx=>{tx.put('improvementEvaluations',record.id,record);tx.append('improvement.evaluated',{companyId,actorId:'fixed-evaluator',causationId:`evaluation:${record.id}`,improvementId:record.improvementId,targetId:record.targetId,evaluationId:record.id,summary:'Fixed baseline and candidate observations recorded'});return null;});
    return record;
  }
  async function ownerMutation(type, input, access, key) {
    if (typeof key !== 'string' || !key || key.length > 160) fail('IDEMPOTENCY_KEY_REQUIRED', 'Use a stable request identity.');
    await api.view(access); // Replayed writes still require current owner access.
    const response = await apply({id:`autonomy:${companyId}:${type}:${key}`,type}, {input,access});
    if (response.decision.status !== 'allow') fail(response.decision.reasonCode);
    return {...response, company: company()};
  }
  // Admit the accepted batch's commands in order while the claim is still current. Running this in
  // the SAME advance as acceptance matters: a tick interval >= the lease would otherwise let the
  // lease expire between acceptance and admission and recover the same result forever.
  async function runAccepted(work){
    const current=journal.get('agentWork',work.id),accepted=current?.lease&&journal.get('agentRuns',current.lease.runId);
    if(!accepted?.acceptedCommands?.length||Date.parse(current.lease.leaseUntil)<=new Date(clock()).getTime())return {attempted:false};
    let progressed=false,blocked=null;
    for(let index=0;index<accepted.acceptedCommands.length;index++){
      const action={id:`${current.id}:${current.logicalStep}:command:${index}`,type:'autonomy_command',workId:current.id,runId:accepted.id,fence:current.lease.fence,commandIndex:index};
      const outcome=await apply(action,{}, {allowHold:true});
      if(outcome.decision.status!=='allow'){blocked=outcome;break;}
      progressed ||= !outcome.replayed;
      // An admitted `spend` command records a spendRequests entry; run it through the
      // real Agent API spend port now, inside the same advance. The port only
      // executes; M01/M03 already admitted it. A port failure never fabricates a result.
      if(outcome.decision.plan?.commandType==='spend' && spendExecutor){
        const spendId=outcome.decision.plan.spendId;
        if(spendId){
          // Commit spend.requested (and anything before it) first, so the chain reads requested -> completed.
          if(ledgerAutoCommit){try{await ledgerAutoCommit.tick();}catch{/* retried next tick */}}
          try{await spendExecutor.execute(spendId);}
          catch(error){blocked=blocked??{decision:{status:'hold',reasonCode:error.code??'SPEND_EXECUTION_FAILED'}};}
        }
      }
    }
    return {attempted:true,progressed,blocked};
  }
  const withCommands=async(outcome,workId)=>{
    if(outcome?.decision?.status!=='allow')return outcome;
    const after=await runAccepted({id:workId});
    if(after.blocked)return {...after.blocked,progressed:after.progressed,workId};
    return after.progressed?{...outcome,progressed:true,workId,commands:true}:outcome;
  };
  const api = {
    onboard: (input,access,key)=>serial(()=>ownerMutation('autonomy_onboard',input,access,key)),
    reviewSetup: (input,access,key)=>serial(()=>ownerMutation('autonomy_setup_review',input,access,key)),
    configure: (input, access, key) => serial(() => ownerMutation('autonomy_configure',input,access,key)),
    bootstrap: (input, access, key) => serial(() => ownerMutation('autonomy_bootstrap',input,access,key)),
    control: (input, access, key) => serial(() => ownerMutation('autonomy_control',input,access,key)),
    recordGap: (input, access, key) => serial(() => ownerMutation('autonomy_gap',input,access,key)),
    registerTemplate: (input, access, key) => serial(() => ownerMutation('autonomy_template',input,access,key)),
    selectKnowledge: (input, access, key) => serial(() => ownerMutation('autonomy_knowledge',input,access,key)),
    rollback: (input, access, key) => serial(() => ownerMutation('autonomy_rollback',input,access,key)),
    reviewChange: (input, access, key) => serial(() => ownerMutation('autonomy_review_change',input,access,key)),
    async view(access, query = {}) {
      const decision = decide({id:`autonomy:${companyId}:view`,type:'autonomy_view'}, {access,input:query});
      if (decision.status !== 'allow') fail(decision.reasonCode);
      const plan = decision.plan;
      const collections = {companies:'autonomousCompanies',objectives:'companyObjectives',agents:'agents',work:'agentWork',runs:'agentRuns',improvements:'improvements',heads:'companyTargetHeads',revisions:'companyRevisions',contracts:'companyTemplateContracts',evaluations:'improvementEvaluations',resourceRequests:'resourceRequests',serviceDrafts:'serviceDrafts'};
      const result = {policy: {mode:rules.snapshot().mode,valid:rules.snapshot().valid}, decision: {status:decision.status,reasonCode:decision.reasonCode}, events:[]};
      result.permittedActions=structuredClone(plan.permittedActions??[]);
      result.setup=structuredClone(plan.setup??{});
      for (const [name, namespace] of Object.entries(collections)) {
        result[name] = journal.list(namespace).filter(v => v.companyId === companyId).map(v => pick(v,plan.fields?.[name]));
      }
      result.orders=journal.list('agentTasks').filter(t=>t.companyId===companyId).map(t=>{const o=journal.get('orders',t.orderId);return o?pick({id:o.id,orderId:o.id,status:o.status,mode:o.mode,agentId:t.agentId,serviceId:t.serviceId},plan.fields?.orders):null;}).filter(Boolean);
      result.operations=Object.values(journal.snapshot().operations).map(o=>pick(o,plan.fields?.operations));
      const cursor = plan.cursor ?? 0, limit = plan.limit ?? 50;
      const events = journal.events({afterSequence:cursor}).filter(e => e.data?.companyId === companyId || plan.financialEventTypes?.includes(e.type));
      result.events = events.slice(0,limit).map(e => ({...pick(e,plan.eventFields),...(plan.eventFields?.includes('data')?{data:pick(e.data,plan.dataFields)}:{})}));
      result.nextCursor = result.events.at(-1)?.sequence ?? cursor;
      result.hasMore = events.length > limit;
      result.company = result.companies[0] ?? null;
      return result;
    },
    /** Owner-only causal lifecycle projection. Built exclusively from the owner view allowlists. */
    async trace(access) {
      const first=await api.view(access,{limit:100});let view=first,all=[...first.events];
      while(view.hasMore){view=await api.view(access,{limit:100,cursor:view.nextCursor});all=all.concat(view.events);}
      return buildLifecycleTrace({...first,events:all});
    },
    evaluate: (input, access, key, {expectedSpec}={}) => serial(async () => {
      const action = {id:`autonomy:${companyId}:evaluate:${key}`,type:'autonomy_evaluate'};
      const d = decide(action,{input,access});
      if (d.status !== 'allow') fail(d.reasonCode);
      const spec = d.plan.evaluationSpec;
      if (!spec) fail('EVALUATION_SPEC_REQUIRED');
      if(expectedSpec){const stable=s=>pick(s,['improvementId','targetId','baseRevision','policyVersion','baseline','candidate','contract']);if(fingerprint(stable(spec))!==fingerprint(stable(expectedSpec)))fail('REMOTE_EVALUATION_SCOPE_CHANGED');}
      const record=await recordEvaluation(spec);
      // A fixed observation does not itself authorise a head change.
      const promotion = await apply({id:`${action.id}:promote`,type:'autonomy_promote',improvementId:spec.improvementId,evaluationId:spec.evaluationId},{access});
      return {evaluation:record,decision:promotion.decision};
    }),
    advance(access) { return serial(async () => {
      if (stopped) return {stopped:true};
      // Flush any autonomy events recorded since the last flush to the on-chain
      // ledger. Independent of the tick's own result and idempotent across restarts.
      const flushLedger=async()=>{ if(ledgerAutoCommit){ try{ await ledgerAutoCommit.tick(); }catch{ /* ledger down: retried next tick */ } } };
      // Owner access is needed for HTTP advance. Background ticks use the durable
      // company start intent and Rules' private facts, never a fabricated owner.
      if (access) await api.view(access);
      for(const improvement of journal.list('improvements').filter(i=>i.companyId===companyId&&i.state==='proposed')) {
        const d=decide({id:`${improvement.id}:auto-evaluate:${improvement.version}`,type:'autonomy_auto_evaluate',improvementId:improvement.id},{});
        if(d.status!=='allow')continue;
        const spec=d.plan.evaluationSpec,record=await recordEvaluation(spec);
        const promoted=await apply({id:`${record.id}:auto-promote`,type:'autonomy_auto_promote',improvementId:improvement.id,evaluationId:record.id},{}, {allowHold:true});
        if(promoted.decision.status==='allow')return promoted;
      }
      const pending = journal.list('agentWork').filter(w => w.companyId === companyId).sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      let blockedResult=null;
      for (const work of pending) {
        if(['completed','failed','canceled','cancelled','superseded'].includes(work.state))continue;
        const direct=await runAccepted(work);
        if(direct.progressed){await flushLedger();return {...(direct.blocked??{}),progressed:true,workId:work.id};}
        if(direct.blocked){blockedResult=direct.blocked;continue;}
        if(direct.attempted)continue;
        if (!['queued','waiting','blocked','accepted','preparing','prepared','dispatching','pending','unknown','reconciling','proof_held'].includes(work.state)) continue;
        const originalEffect=work.effectId?journal.get('internalEffects',work.effectId):null;
        const latestRun=work.lease&&journal.get('agentRuns',work.lease.runId);
        const unfinishedBatch=latestRun?.state==='accepted'&&(latestRun.commandOutcomes?.length??0)<(latestRun.acceptedCommands?.length??0);
        // A settled original effect (confirmed result, actual cost, accepted candidate) is history:
        // a waiting parent or finished batch must move on, not be reconciled forever.
        if(originalEffect&&journal.getOperation(`adapters:m07:${work.effectId}`)&&(unsettled(work)||unfinishedBatch))return withCommands(await internalWork.reconcile({workId:work.id}),work.id);
        // A dependency becoming complete is a new admission observation, not a
        // replay of the old held claim. External effect IDs remain unchanged.
        const admission=fingerprint({company:company()?.version,policy:rules.snapshot().policyVersion,objective:journal.get('companyObjectives',work.objectiveId)?.version,agents:journal.list('agents').map(a=>[a.id,a.version]),work:journal.list('agentWork').map(w=>[w.id,w.version,!!w.lease&&Date.parse(w.lease.leaseUntil)>new Date(clock()).getTime()])}).slice(0,20);
        const claimed=await apply({id:`claim:${work.id}:${work.version}:${admission}`,type:'autonomy_claim',workId:work.id},{}, {allowHold:true});
        if(claimed.decision.status!=='allow'){blockedResult??=claimed;continue;}
        const current=journal.get('agentWork',work.id);
        if(!current?.lease)return claimed;
        if(!internalWork)return {decision:{status:'hold',reasonCode:'INTERNAL_WORK_PORT_UNAVAILABLE'}};
        const outcome=await internalWork.execute({workId:work.id,runId:current.lease.runId,fence:current.lease.fence});
        if(outcome?.retryable){
          // M01 persists the semantic admission blocker and releases the claim. Only a
          // trusted condition change or explicit owner resume admits another attempt.
          return {...outcome,retry:{ownerActionRequired:true}};
        }
        return withCommands(outcome,work.id);
      }
      await flushLedger();
      return blockedResult??{idle:true};
    }); },
    tick: () => api.advance(),
    async close() {stopped=true;await queue;},
  };
  return api;
}
