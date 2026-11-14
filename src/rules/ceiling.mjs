import {integer,isIntegerAmount} from './config.mjs';
import {deny,hold} from './policies.mjs';

/** Actions that create paid exposure measured in nanoUSD. Cash payouts/refunds keep their
 * separate asset-unit caps in liveGate; this ceiling is the single common USD ceiling. */
export const CEILING_ACTIONS=new Set(['funding','inference','component_inference','agent_inference','procurement','cloud_product_execute']);
const TERMINAL_FREE=new Set(['released']);

/** Lifetime actual+pending exposure from the persisted reservation ledger. Reservations are
 * never deleted, so exposure survives restart, retry and authorization renewal. Conservative:
 * every purpose counts, so funding followed by use of that funded credit is counted twice
 * (never under-counts a real USD outflow). Unknown/pending/reserved cost = full upper bound. */
export function lifetimeExposure(financial,exceptActionId){
  let total=0n;
  if(!Array.isArray(financial?.reservations))throw new TypeError('Lifetime reservation facts required');
  const seen=new Set();
  for(const r of financial.reservations){
    if(!r||typeof r.actionId!=='string'||!r.actionId||seen.has(r.actionId))throw new TypeError('Unique original action required');
    seen.add(r.actionId);
    if(TERMINAL_FREE.has(r.status)){if(r.actualCostNanoUsd!==undefined)total+=integer(r.actualCostNanoUsd);continue;}
    const bound=integer(r.upperBoundNanoUsd);
    if(r.actionId===exceptActionId&&!['reconciled','failed'].includes(r.status))continue;
    total+=['reconciled','failed'].includes(r.status)&&r.actualCostNanoUsd!==undefined?integer(r.actualCostNanoUsd):bound;
  }
  return total;
}

/** Smallest ceiling among policy and every exact authorization. Null means none is configured. */
export function totalCeiling(config,authorizations=[]){
  const values=[config?.spending?.totalCeilingNanoUsd,...authorizations.map(a=>a?.maxTotalNanoUsd)].filter(v=>v!==undefined&&v!==null);
  if(!values.length)return null;
  if(values.some(v=>!isIntegerAmount(v)))return {invalid:true};
  return values.map(integer).reduce((a,b)=>a<b?a:b);
}

/** null when allowed. Re-run at the final dispatch gate: the same action's own reservation
 * is excluded and re-added at its exact bound, so replay cannot double count or slip through. */
export function ceilingBlock(action,facts,config,authorizations){
  if(!CEILING_ACTIONS.has(action.type))return null;
  const ceiling=totalCeiling(config,authorizations);
  if(ceiling===null)return null;
  if(ceiling.invalid)return deny('TOTAL_CEILING_INVALID');
  if(!facts.financial||!Number.isSafeInteger(facts.financial.version))return hold('FINANCIAL_FACTS_REQUIRED');
  if(action.maxCostNanoUsd==null)return deny('TOTAL_CEILING_BOUND_REQUIRED');
  let proposed;try{proposed=integer(action.maxCostNanoUsd);}catch{return deny('TOTAL_CEILING_BOUND_REQUIRED');}
  let used;try{used=lifetimeExposure(facts.financial,action.id);}catch{return hold('TOTAL_CEILING_FACTS_REQUIRED');}
  return used+proposed>ceiling?deny('TOTAL_CEILING_EXCEEDED'):null;
}
