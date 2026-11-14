import {ContractError, fingerprint} from '../contracts.mjs';

const NAMESPACES = new Set(['organization','autonomousCompanies','companyObjectives','agents','agentWork','agentRuns','improvements','companyTargetHeads','companyRevisions','companyTemplateContracts','improvementEvaluations','resourceRequests','serviceDrafts','spendRequests']);
const fail = code => {throw new ContractError(code,code);};

/** Exact local plan executor. The synchronous Rules recheck is the last local
 * commit gate; provider effects never enter this writer. */
export function createAutonomyWriter({journal,rules,companyId}) {
  return async function apply(action,facts={}, {allowHold=false}={}) {
    const inputHash=fingerprint({action,input:facts.input??null});
    const committed=journal.snapshot().commands[action.id];
    if(committed&&action.type==='autonomy_command'){
      const current=rules.evaluate(action,facts);
      if(current.status!=='allow')return {decision:current};
      if(current.plan?.replay&&current.plan.commandHash&&current.plan.commandHash===committed.result?.decision?.plan?.commandHash){
        return {decision:current,replayed:true};
      }
      if(committed.fingerprint!==inputHash)fail('COMMAND_REPLAY_CONFLICT');
    }
    if(committed) {
      const prior=await journal.transaction({actionId:action.id,fingerprint:inputHash},()=>fail('REPLAY_STATE_CHANGED'));
      return {...prior.result,replayed:true};
    }
    const decision=rules.evaluate(action,facts);
    if(decision.status!=='allow'&&!(allowHold&&decision.status==='hold'&&decision.plan?.puts))return {decision};
    const result=await journal.transaction({actionId:action.id,fingerprint:inputHash},tx=>{
      const fresh=rules.evaluate(action,facts);
      if(fresh.status!=='allow'&&!(allowHold&&fresh.status==='hold'&&fresh.plan?.puts))fail(fresh.reasonCode);
      for(const put of fresh.plan?.puts??[]) {
        if(!NAMESPACES.has(put.namespace)||put.value?.companyId&&put.value.companyId!==companyId||put.namespace==='organization'&&put.id!==companyId)fail('INVALID_AUTONOMY_PLAN');
        tx.put(put.namespace,put.id,put.value,{expectedVersion:put.expectedVersion===null?0:put.expectedVersion});
      }
      for(const event of fresh.plan?.events??[])tx.append(event.type,{...event.data,companyId});
      return {decision:fresh};
    });
    return {...result.result,replayed:result.replayed};
  };
}
