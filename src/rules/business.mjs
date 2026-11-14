import {hash, integer, sameAsset, validateMoney} from './config.mjs';
import {allow, deny, hold} from './policies.mjs';
import {requireCapabilities} from './runtime.mjs';
import {executionPrerequisites,setupBasis,listingHash} from './activation.mjs';

// Only this module interprets business permissions and provider observations.
export function liveGate(action, facts, config, policyVersion, authorization, now, companyId) {
  const a=authorization;
  if(!a || a.mode!=='live' || a.companyId!==companyId || a.policyVersion!==policyVersion || !a.id || !Number.isFinite(Date.parse(a.expiresAt)) || Date.parse(a.expiresAt)<=now) return deny('LIVE_AUTHORIZATION_REQUIRED');
  if(!Array.isArray(a.actions)||!a.actions.includes(action.type))return deny('ACTION_NOT_AUTHORIZED');
  if(action.maxCostNanoUsd!=null && integer(action.maxCostNanoUsd)>integer(a.maxRequestNanoUsd??'0'))return deny('OWNER_REQUEST_CAP_EXCEEDED');
  if(integer(config.spending.dailyInferenceCapNanoUsd)>integer(a.dailyInferenceCapNanoUsd??'0'))return deny('OWNER_DAILY_CAP_EXCEEDED');
  if(action.type==='offer'&&action.refundRecipient&&!a.recipients?.includes(action.refundRecipient))return deny('REFUND_RECIPIENT_NOT_AUTHORIZED');
  if(action.money){
    validateMoney(action.money);
    if(!a.recipients?.includes(action.recipient))return deny('OWNER_RECIPIENT_DENIED');
    validateMoney(a.maxTotalCash);
    if(!sameAsset(a.maxTotalCash,action.money))return deny('OWNER_ASSET_DENIED');
    // Approved intents consume the authorization budget conservatively, including
    // unresolved and failed intents. They never become free after a restart.
    const plans=(facts.financial?.approvedPlans??[]).filter(p=>p.authorizationId===a.id&&p.actionId!==action.id&&['payout','refund_intent','reservation','procurement'].includes(p.plan?.kind));
    const used=plans.reduce((n,p)=>{const m=p.plan?.money??p.plan?.reservation?.resource;return n+(m&&sameAsset(m,action.money)?integer(m.amount):0n);},0n);
    if(used+integer(action.money.amount)>integer(a.maxTotalCash.amount))return deny('OWNER_CASH_CAP_EXCEEDED');
  }
  return null;
}

export function businessDecision(action,facts,config,policyVersion,now,readiness){
  const mode=config?.mode??'setup';
  const {organization={},agent,listing}=facts;
  if(action.type==='resource_bind'){
    if(!agent||!listing||!['skill','soul','inference','knowledge','connector','wallet'].includes(listing.kind))return deny('INVALID_RESOURCE');
    if(mode!=='fixture'&&listing.purchaseRequired)return deny('LIVE_PROCUREMENT_UNAVAILABLE');
    if(listing.purchaseRequired&&!facts.licenses?.some(l=>l.listingId===listing.id&&l.version===(listing.version??'1')))return hold('LICENCE_REQUIRED');
    if(mode==='setup'&&!['skill','soul'].includes(listing.kind))return hold('COMMERCIAL_POLICY_REQUIRED');
    if(mode==='live'&&!['skill','soul'].includes(listing.kind)){
      const scopes={wallet:['custody_identity','custody_policy','custody_grant','custody_balance'],inference:['inference_model','inference_bounds','inference_credit','inference_proof'],knowledge:['jbrain'],connector:['public_retrieval']};
      const denied=requireCapabilities(readiness,scopes[listing.kind]);if(denied)return denied;
    }
    if(listing.mode&&listing.mode!==mode&&['inference','wallet'].includes(listing.kind))return deny('RESOURCE_MODE_MISMATCH');
    if(listing.availability==='unconfigured')return hold('RESOURCE_UNAVAILABLE');
    return allow({plan:{kind:'resource_binding',binding:{id:listing.id,kind:listing.kind,requirement:listing.requirement,version:listing.version??'1',provider:listing.provider??listing.publisher??'workspace',mode:listing.mode??mode,capability:listing.capability??listing.kind,connected:true},grantsSpendingAuthority:false}});
  }
  if(action.type==='company_pause')return allow({plan:{kind:'company_activation',activation:{state:'paused',policyVersion,pausedAt:new Date(now).toISOString()}}});
  if(action.type==='company_activate'){
    const basis=setupBasis(facts);
    if(!basis)return hold(facts.unifiedSetup?.present?'SETUP_REVIEW_REQUIRED':'SETUP_INCOMPLETE');
    const prerequisite=executionPrerequisites(config,facts,readiness);if(prerequisite)return prerequisite;
    if(!agent||agent.status!=='ready'||!listing||listing.kind!=='service')return hold('SERVICE_AGENT_REQUIRED');
    if(basis==='unified'&&facts.unifiedSetup.agents[agent.id]!==agent.version)return hold('SERVICE_AGENT_REQUIRED');
    if(!Array.isArray(facts.knowledgeIds)||facts.knowledgeIds.some(id=>typeof id!=='string'))return deny('INVALID_KNOWLEDGE_SELECTION');
    if(config.mode==='live'&&config.settlementRecipientType!=='CONFIDENTIAL_INTENTS')return hold('SETTLEMENT_ROUTE_UNVERIFIED');
    if(config.mode==='live'&&facts.knowledgeIds.length)return deny('CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
    return allow({plan:{kind:'company_activation',activation:{state:config.mode==='fixture'?'demo_active':'live_ready',policyVersion,agentId:agent.id,agentVersion:agent.version,serviceId:listing.id,serviceName:listing.name,knowledgeIds:[...new Set(facts.knowledgeIds)],activatedAt:new Date(now).toISOString(),setupBasis:basis,setupFingerprint:basis==='unified'?facts.unifiedSetup.fingerprint:hash(facts.setup.steps),serviceVersion:listing.version??'1',serviceHash:listingHash(listing),price:{...config.settlementAsset,amount:config.pricing.minimumAtomic},contributors:structuredClone(config.revenue.contributors)}}});
  }
  if(action.type==='service_order'){
    const a=organization.activation;
    if(!a||!['demo_active','live_ready'].includes(a.state))return hold('COMPANY_NOT_ACTIVE');
    if(a.policyVersion!==policyVersion||a.agentId!==agent?.id||a.agentVersion!==agent?.version||a.serviceId!==listing?.id)return hold('ACTIVATION_REVIEW_REQUIRED');
    if(a.serviceHash&&a.serviceHash!==listingHash(listing))return hold('ACTIVATION_REVIEW_REQUIRED');
    if(a.setupBasis==='unified'&&(facts.unifiedSetup?.reviewed!==true||facts.unifiedSetup.fingerprint!==a.setupFingerprint))return hold('ACTIVATION_REVIEW_REQUIRED');
    if(config.mode!=='fixture'&&a.knowledgeIds?.length)return deny('CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
    return allow({plan:{kind:'service_order',agentId:agent.id,serviceId:listing.id,knowledgeIds:[...a.knowledgeIds]}});
  }
  if(action.type==='capital_record'){
    if(mode!=='fixture')return deny('LEGACY_ECONOMIC_IMPORT_DISABLED');
    const r=facts.observation;
    if(facts.financial?.receipts?.some(x=>x.id?.startsWith('receipt:capital:')))return deny('CAPITAL_ALREADY_RECORDED');
    if(!r||r.status!=='confirmed'||!r.id||r.owner!==config.treasuryAccount||r.provider!=='owner_capital'||!r.reference)return hold('CAPITAL_EVIDENCE_REQUIRED');
    validateMoney(r.money);if(!sameAsset(r.money,config.settlementAsset))return deny('CAPITAL_ASSET_MISMATCH');
    return allow({plan:{kind:'capital',receiptId:`capital:${r.id}`,money:structuredClone(r.money),reference:r.reference,provenance:'owner_capital'}});
  }
  if(action.type==='credit_record'){
    if(mode!=='fixture')return deny('LEGACY_ECONOMIC_IMPORT_DISABLED');
    const c=facts.observation;
    if(!c||c.status!=='confirmed'||!c.id||!c.reference||c.owner!==config.treasuryAccount||c.provider!=='near-ai-cloud'||c.provenance!=='owner_prepaid'||!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=now||integer(c.availableNanoUsd)===0n)return hold('CREDIT_EVIDENCE_REQUIRED');
    if(facts.financial?.credits?.lots?.some(x=>x.reference===c.reference&&x.id!==c.id))return deny('CREDIT_REFERENCE_REUSED');
    return allow({plan:{kind:'credit_observation',receiptId:c.id,credit:{id:c.id,owner:c.owner,provider:c.provider,availableNanoUsd:c.availableNanoUsd,provenance:c.provenance,reference:c.reference,expiresAt:c.expiresAt,mode:config.mode}}});
  }
  if(action.type==='procurement'){
    if(mode!=='fixture')return deny('LIVE_PROCUREMENT_UNAVAILABLE');
    const p=config.procurement;
    if(!p?.enabled||!agent||p.listingId!==listing?.id||listing.kind!=='skill')return deny('PROCUREMENT_NOT_CONFIGURED');
    validateMoney(p.money);
    if(hash(action.money)!==hash(p.money)||action.recipient!==p.recipient||action.maxCostNanoUsd!==p.maxCostNanoUsd)return deny('PROCUREMENT_PLAN_MISMATCH');
    if(integer(p.maxCostNanoUsd)>integer(config.spending.maxFundingNanoUsd))return deny('REQUEST_CAP_EXCEEDED');
    const financial=facts.financial;
    if(!financial)return hold('FINANCIAL_FACTS_REQUIRED');
    if(financial.reservations.some(r=>r.status==='unknown'))return hold('UNRESOLVED_SPEND');
    const balance=financial.balances.find(m=>sameAsset(m,p.money));
    const locked=financial.protectedFunds.filter(m=>sameAsset(m,p.money)).reduce((s,m)=>s+integer(m.amount),0n)+financial.reservations.filter(r=>!['released','failed','reconciled'].includes(r.status)&&r.resource&&sameAsset(r.resource,p.money)).reduce((s,r)=>s+integer(r.resource.amount),0n);
    if(!balance||integer(balance.amount)<locked+integer(p.money.amount))return deny('INSUFFICIENT_FUNDS');
    return allow({plan:{kind:'procurement',listingId:listing.id,listingVersion:listing.version??'1',recipient:p.recipient,money:structuredClone(p.money),maxCostNanoUsd:p.maxCostNanoUsd,reservation:{id:`reservation:${action.id}`,actionId:action.id,purpose:'procurement',orderId:action.orderId,accountingDay:new Date(now).toISOString().slice(0,10),upperBoundNanoUsd:p.maxCostNanoUsd,resource:structuredClone(p.money),status:'reserved'}}});
  }
  if(action.type==='procurement_record'){
    if(mode!=='fixture')return deny('LIVE_PROCUREMENT_UNAVAILABLE');
    const p=facts.purchase, r=facts.result?.receipt;
    if(!p||facts.result.status!=='confirmed'||!r||r.recipient!==p.recipient||hash(r.money)!==hash(p.money))return hold('PURCHASE_UNCONFIRMED');
    return allow({plan:{kind:'procurement_record',receiptId:r.reference??r.transactionId,actionId:p.actionId,listingId:p.listingId,listingVersion:p.listingVersion,money:p.money,reservationId:p.reservation.id}});
  }
  return deny('UNKNOWN_ACTION');
}
