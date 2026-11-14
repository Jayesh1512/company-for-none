import {hash} from './config.mjs';
import {allow, hold} from './policies.mjs';
import {requireCapabilities} from './runtime.mjs';
import {setupFingerprint} from './autonomy.mjs';

/**
 * Activation consumes the merged setup review plus ACTUAL execution prerequisites.
 * Both are derived here from private composition facts. Nothing is read from a
 * request-supplied boolean, a stored "complete" flag, or optional company documents.
 */
export function unifiedSetupState(data,companyId){
  const c=data?.company;
  if(!c||c.companyId!==companyId)return {present:false,reviewed:false,fingerprint:null,agents:{}};
  const fingerprint=setupFingerprint(c,data);
  const review=c.setupReview;
  const reviewed=!!review&&review.scope==='local-configuration-only'&&review.fingerprint===fingerprint;
  const agents=Object.fromEntries((data.agents??[]).filter(a=>a.companyId===companyId).map(a=>[a.id,a.version]));
  return {present:true,reviewed,fingerprint,agents,paused:c.started!==true};
}

/** Returns a hold decision, or null when execution prerequisites are actually present. */
export function executionPrerequisites(config,facts,readiness){
  if(!config)return hold('COMMERCIAL_POLICY_REQUIRED');
  if(config.mode==='fixture'){
    const infra=facts.infrastructure??[];
    return infra.length===4&&infra.every(x=>x?.mode==='fixture')?null:hold('EXECUTION_RUNTIME_REQUIRED',{plan:{kind:'activation_prerequisite',requirement:'The local fixture runner must be available.',grantsSpendingAuthority:false}});
  }
  if(config.mode==='live')return requireCapabilities(readiness);
  return hold('COMMERCIAL_POLICY_REQUIRED');
}

/** Which setup basis (if any) currently authorizes activation. */
export function setupBasis(facts){
  if(facts.unifiedSetup?.present)return facts.unifiedSetup.reviewed===true?'unified':null;
  if(facts.unifiedSetup?.reviewed===true)return 'unified';
  if(facts.setup?.complete===true)return 'legacy-six-step';
  return null;
}

/** Read-only owner projection. It never allows or prepares any action. */
export function activationStatus(config,facts,readiness){
  const blockers=[];
  const basis=setupBasis(facts);
  if(!config)blockers.push({reasonCode:'COMMERCIAL_POLICY_REQUIRED',requirement:'The owner commercial policy is required before activation.'});
  else{
    if(config.killSwitch)blockers.push({reasonCode:'KILL_SWITCH',requirement:'The owner policy kill switch blocks activation.'});
    if(!basis)blockers.push({reasonCode:facts.unifiedSetup?.present?'SETUP_REVIEW_REQUIRED':'SETUP_INCOMPLETE',requirement:facts.unifiedSetup?.present?'Finish the current company setup review. Any profile, brief or catalog change requires a new review.':'Save the company brief and finish setup.'});
    const blocked=executionPrerequisites(config,facts,readiness);
    if(blocked)blockers.push({reasonCode:blocked.reasonCode,requirement:blocked.plan?.requirement??'Execution prerequisites are not currently verified.',capabilities:blocked.plan?.requirements?.map(r=>r.capability)});
    if(config.mode==='live'&&config.settlementRecipientType!=='CONFIDENTIAL_INTENTS')blockers.push({reasonCode:'SETTLEMENT_ROUTE_UNVERIFIED',requirement:'A verified confidential settlement route is required.'});
  }
  return allow({plan:{kind:'activation_status',ready:blockers.length===0,basis,unifiedReviewed:facts.unifiedSetup?.reviewed===true,blockers,grantsSpendingAuthority:false}});
}

export const listingHash=listing=>hash(listing??null);
