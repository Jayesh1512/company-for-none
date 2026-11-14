import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { validateConfig, ConfigError, freeze, hash, stableStringify, integer, isIntegerAmount } from './config.mjs';
import { allow, deny, hold, PUBLIC_FIELDS, makeOffer, assessSettlement, allocation, spend, retry, assessEvidence, assessReport, access, nextAction, payout, refund, eligibility,inferenceAdmission } from './policies.mjs';
import { bootstrap, fundingRecord, consumption, payoutRecord, refundRecord, reservationUpdate, remedy, latePayment } from './records.mjs';

import {liveGate,businessDecision} from './business.mjs';
import { organizationDecision } from './setup.mjs';
import { unifiedSetupState, activationStatus } from './activation.mjs';
import { ceilingBlock,totalCeiling } from './ceiling.mjs';
import { knowledgeDecision } from './knowledge.mjs';
import {CAPABILITIES, ownerAccess, runtimeReadiness, requireCapabilities, probeDecision,publicReadiness} from './runtime.mjs';
import {economicDecision, economicSafety} from './economic.mjs';
import {verificationSpec,verifyInferenceEvidence,inferenceMaximum} from './verification.mjs';
import {componentPreflight,componentInference,componentConsumption} from './components.mjs';
import {autonomyDecision,trustedAutonomyScope} from './autonomy.mjs';
import {agentDecision} from './autonomy-inference.mjs';
import {onchainLedgerDecision,LEDGER_CHAIN_ACTIONS} from './onchain-ledger.mjs';
import {supportDecision,SUPPORT_ACTIONS} from './support.mjs';
import {cloudProductsDecision} from './cloud-products.mjs';
import {integrationDecision} from './integrations.mjs';
import {LOCAL_DEMO_ACTIONS,localDemoDecision,localDemoRestriction} from './local-demo.mjs';
import {aiDemoDecision,AI_DEMO_ACTIONS} from './ai-demo.mjs';

export { validateConfig, ConfigError } from './config.mjs';
export { calculateSplit } from './policies.mjs';
export {autonomyDecision} from './autonomy.mjs';
const require = createRequire(import.meta.url);
const EFFECTS = new Set(['funding', 'inference', 'payout', 'refund', 'procurement','component_inference','agent_inference','integration_execute','ledger_chain_publish','ai_demo_inference']);
const AGENT_ACTIONS=new Set(['agent_preparation_blocked','agent_prepare','agent_inference','agent_result','agent_observe','agent_consumption']);
const autonomyAction=a=>a.type.startsWith('autonomy_')||AGENT_ACTIONS.has(a.type);
const READ_ONLY = new Set(['company_activation_status','access', 'disclosure', 'knowledge_read', 'knowledge_context', 'organization_setup', 'reconcile', 'funding_record', 'consumption', 'payout_record', 'refund_record', 'reservation_update', 'remedy', 'late_payment', 'credit_record', 'capital_record', 'procurement_record', 'company_pause']);
const OWNER_SETUP = new Set(['company_activation_status','agent_manage','organization_manage','organization_setup','organization_setup_review','knowledge_import','knowledge_manage','knowledge_read','knowledge_preview','resource_bind','company_pause','runtime_readiness','runtime_probe','component_preflight']);
const SETUP_ONLY = new Set([...OWNER_SETUP].filter(x=>!['knowledge_context','company_pause'].includes(x)));
const ECONOMIC_RECORDS = new Set(['balance_snapshot','cash_opening','credit_opening','cash_receipt','credit_receipt']);
const COMMERCIAL_READINESS = new Set(['company_activate','service_order','offer','agent_task','funding','inference','payout','refund','procurement','research']);

export function parseConfigYaml(source) {
  const { parseDocument } = require('yaml');
  const document = parseDocument(source, { uniqueKeys: true, version: '1.2', schema: 'core' });
  if (document.errors.length) throw new ConfigError(document.errors.map(x => x.message).join('; '));
  // Aliases are unnecessary for this small owner document, and never expanded.
  return document.toJS({ maxAliasCount: 0 });
}
function researchPlan(config, facts, providerBounds, now) {
  const spec = facts.offer?.research ?? config.research;
  let chargeBound={maxCostNanoUsd:config.spending.maxRequestNanoUsd};
  if(config.mode==='live'){
    if(!providerBounds||providerBounds.model!==spec.model||!providerBounds.reference||!Number.isFinite(Date.parse(providerBounds.validUntil))||Date.parse(providerBounds.validUntil)<=now||providerBounds.completionTokensIncludeReasoning!==true)throw new Error('Verified provider pricing bounds required');
    const maximum=inferenceMaximum({inputTokens:spec.maxInputTokens,outputTokens:spec.maxOutputTokens},providerBounds);
    if(maximum>integer(config.spending.maxRequestNanoUsd))throw new Error('Provider cost exceeds request cap');
    chargeBound={...chargeBound,verified:true,reference:providerBounds.reference,completionTokensIncludeReasoning:true,providerMaximumNanoUsd:maximum.toString()};
  }
  const reportRequirements = { minWords: spec.minWords, maxWords: spec.maxWords, minSources: spec.minSources, maxSources: spec.maxSources, maxSourceAgeDays: spec.maxSourceAgeDays, requiredSections: [...spec.requiredSections], freeSourcesOnly: spec.freeSourcesOnly, allowUnknownPublicationDates: spec.allowUnknownPublicationDates, minQuestionOverlapTokens: spec.minQuestionOverlapTokens, minEvidenceExcerpts: spec.minEvidenceExcerpts };
  return { researchSpec: { maxSources: Math.min(spec.maxSources, spec.maxQueries), maxQueries: spec.maxQueries, maxBytesPerSource: spec.maxBytesPerSource, timeoutMs: spec.timeoutMs, maxRedirects: spec.maxRedirects, maxInputChars: spec.maxInputChars, reportRequirements, generationBounds: { model: spec.model, maxInputBytes: config.mode==='live'?spec.maxInputTokens:spec.maxInputChars * 4, maxOutputTokens: spec.maxOutputTokens, timeoutMs: spec.timeoutMs, chargeBound, maxInputTokens: spec.maxInputTokens, maxReasoningTokens: spec.maxReasoningTokens,...(config.mode==='live'?{verificationSpec:verificationSpec(config)}:{}) } } };
}

/** One in-process Rules authority. No vendor, treasury, journal or model imports. */
export function createRules(options = {}) {
  const clock = options.clock ?? (() => Date.now());
  const configPath = options.configPath;
  // An explicitly supplied (even invalid) policy never falls back to setup.
  const setupOnly = options.setupOnly === true && !configPath && !Object.hasOwn(options,'config');
  const parser = options.parseYaml ?? parseConfigYaml;
  // A server-supplied safety ceiling grants no policy, account, credit or action scope.
  const runtimeCeiling=options.totalCeilingNanoUsd;
  if(runtimeCeiling!==undefined){try{if(integer(runtimeCeiling)<=0n)throw new Error();}catch{throw new ConfigError('totalCeilingNanoUsd must be positive integer text');}}
  const secret = randomUUID();
  let config = null, policyVersion = null, policyEpoch = 0, configError = null, sourceHash = null;
  const issued = new Map();
  const spent = new Set();
  let dispatching = false;
  const nowMs = () => { const value = clock(); const ms = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value; if (!Number.isFinite(ms)) throw new TypeError('clock is invalid'); return ms; };
  const sign = value => createHmac('sha256', secret).update(stableStringify(value)).digest('hex');
  function updateConfig(parsed) {
    if (dispatching) throw new Error('config cannot be changed inside a dispatch callback');
    try {
      const next = validateConfig(parsed), nextHash = hash(next);
      if (nextHash !== policyVersion || configError) { policyEpoch++; policyVersion = nextHash; }
      config = next; configError = null;
      return snapshot(false);
    } catch (error) {
      if (!configError || configError !== error.message) policyEpoch++;
      configError = error.message; // Never retain permissive behavior after a malformed reload.
      return snapshot(false);
    }
  }
  function reload() {
    if (!configPath) return snapshot(false);
    try {
      const source = readFileSync(configPath, 'utf8');
      const nextHash = hash(source);
      if (sourceHash !== nextHash) { sourceHash = nextHash; updateConfig(parser(source)); }
    } catch (error) {
      const message = `Cannot load owner config: ${error.message}`;
      if (configError !== message) policyEpoch++;
      configError = message;
    }
    return snapshot(false);
  }
  function refresh() { if (configPath) reload(); }
  function snapshot(refreshFirst = true) {
    if (refreshFirst) refresh();
    return freeze({ schemaVersion: 1, policyVersion, configVersion: policyVersion, policyEpoch, valid: !!config && !configError, error: configError, mode: config?.mode ?? (setupOnly?'setup':'unavailable'), setupRequired: !config&&setupOnly, config: config ? structuredClone(config) : null, safety: { killSwitch: config?.killSwitch ?? true, policyEpoch, dailyInferenceCapNanoUsd: config?.spending.dailyInferenceCapNanoUsd ?? null, totalCeilingNanoUsd:totalCeiling(config,runtimeCeiling===undefined?[]:[{maxTotalNanoUsd:runtimeCeiling}])?.toString()??null, ready: !!config && !configError } });
  }
  const base = (action, facts) => ({ schemaVersion: 1, actionId: action?.id ?? null, actionFingerprint: hash(action ?? null), policyVersion, policyEpoch, financialVersion: facts.financial?.version ?? null, orderVersion: facts.order?.version ?? null, inputVersions: { financial: facts.financial?.version ?? null, order: facts.order?.version ?? null } });
  function degradedLedgerRead(action) {
    return !!configError && config?.access.publicLedger === true &&
      ((action.type === 'access' && action.resource === 'ledger') ||
       (action.type === 'disclosure' && (action.resource === undefined || action.resource === 'ledger')));
  }
  function ledgerEvaluate(action,facts,dispatch=false){let data;try{data=structuredClone(options.getLedgerFacts?.(structuredClone(action))??null);}catch{data=null;}return onchainLedgerDecision(action,facts,{data,companyId:options.companyId,config,policyVersion,dispatch,now:nowMs(),authorizations:authorizations()});}
  function integrationFacts(){try{return structuredClone(options.getIntegrationFacts?.()??{});}catch{return {};}}
  function integrationEvaluate(action,facts,dispatch=false){return integrationDecision(action,facts,{data:integrationFacts(),companyId:options.companyId,config,policyVersion,dispatch,now:nowMs(),authorizations:authorizations()});}
  function aiDemoFacts(){try{return {...structuredClone(options.getAiDemoFacts?.()??{}),totalCeilingNanoUsd:runtimeCeiling};}catch{return {};}}
  function aiDemoEvaluate(action,facts,dispatch=false){return aiDemoDecision(action,facts,{data:aiDemoFacts(),companyId:options.companyId,config,now:nowMs(),dispatch});}
  function currentAuthorization(action){if(action?.type==='ai_demo_inference')return aiDemoFacts().authorization;if(action?.type==='integration_execute')return integrationFacts().authorization;if(action?.type==='ledger_chain_publish')return options.getLedgerFacts?.()?.authorization;return action?.type==='agent_inference'?options.getAgentAuthorization?.():action?.type==='component_inference'?options.getComponentAuthorization?.():options.getAuthorization?.();}
  function supportEvaluate(action,facts){let data;try{data=structuredClone(options.getSupportFacts?.(structuredClone(action))??null);}catch{data=null;}return supportDecision(action,facts,{data,companyId:options.companyId,config,now:nowMs()});}
  function runtimeFacts() {
    try { return structuredClone(options.getRuntimeFacts?.() ?? {}); }
    catch { return {}; }
  }
  function autonomyFacts(){try{return structuredClone(options.getAutonomyFacts?.()??{company:null,objectives:[],agents:[],work:[],runs:[],improvements:[],heads:[],revisions:[],contracts:[],evaluations:[],resourceRequests:[],serviceDrafts:[],catalog:[],contexts:[],internalResults:[]});}catch{return {company:null};}}
  function autonomyContext(facts,dispatch=false){return {data:autonomyFacts(),config,policyVersion,policyEpoch,companyId:options.companyId,now:nowMs(),runtime:runtimeFacts(),financial:facts.financial,authorization:options.getAgentAuthorization?.(),providerBounds:options.getInferenceBounds?.(),dispatch};}
  function autonomyEvaluate(action,facts,dispatch=false){const ctx=autonomyContext(facts,dispatch);return AGENT_ACTIONS.has(action.type)?agentDecision(action,facts,ctx):autonomyDecision(action,facts,ctx);}
  function internalKnowledge(action,facts){
    if(!['knowledge_read','knowledge_context'].includes(action.type))return null;
    const data=autonomyFacts(),actual=data.agents?.find(a=>a.id===facts.agent?.id&&a.companyId===options.companyId);
    const owner=ownerAccess(facts.access,options.companyId,config?.mode??'setup');
    if(facts.access?.role!=='agent'&&(!actual?.autonomyRole||owner))return null;
    if(facts.access?.companyId!==options.companyId||facts.access?.role!=='agent')return {blocked:deny('INTERNAL_SCOPE_REQUIRED')};
    const resolved=trustedAutonomyScope({workId:facts.access.workId,runId:facts.access.runId,fence:facts.access.fence},{...autonomyContext(facts),data});
    if(resolved.blocked)return resolved;
    if(resolved.agent.id!==facts.agent?.id)return {blocked:deny('INTERNAL_SCOPE_REQUIRED')};
    return {facts:{...facts,agent:resolved.agent,documents:(facts.documents??[]).filter(d=>resolved.scope.knowledgeIds.includes(d.id))}};
  }
  function readiness(runtime=runtimeFacts()) {
    const plan=runtimeReadiness(runtime,{companyId:options.companyId,config,policyVersion,now:nowMs()});
    return config?plan:{...plan,ready:false,commercialPolicyRequired:true};
  }
  // The merged-setup review and the legacy setup plan are recomputed here from private
  // composition facts. A caller-supplied unifiedSetup/setup value is never trusted.
  function activationFacts(action,facts){
    if(!['company_activate','company_activation_status','service_order'].includes(action.type))return facts;
    const {unifiedSetup:_u,setup:_s,...rest}=facts;
    const unifiedSetup=unifiedSetupState(autonomyFacts(),options.companyId);
    const setup=action.type==='service_order'?undefined:organizationDecision({type:'organization_setup'},{...rest,mode:config?.mode??'setup',rulesReadiness:readiness()}).plan;
    return {...rest,unifiedSetup,...(setup?{setup}:{})};
  }
  const authorizations=()=>[runtimeCeiling===undefined?null:{maxTotalNanoUsd:runtimeCeiling},options.getAuthorization?.(),options.getComponentAuthorization?.(),options.getAgentAuthorization?.()].filter(Boolean);
  function businessOutput(facts) {
    const request=facts.request??facts.order?.request,requestFingerprint=hash(request??null);
    if((facts.financial?.approvedPlans??[]).some(p=>p.plan?.proofScope==='wire-only'&&p.plan.requestFingerprint===requestFingerprint))return deny('COMPONENT_OUTPUT_NOT_FOR_DELIVERY');
    return verifyInferenceEvidence('response',{request,requestFingerprint,output:facts.artifact?.content??facts.order?.candidate?.content},runtimeFacts(),config,nowMs());
  }
  const componentContext = (runtime=runtimeFacts(),dispatch=false) => ({config,policyVersion,companyId:options.companyId,now:nowMs(),runtime,authorization:options.getComponentAuthorization?.(),providerBounds:options.getInferenceBounds?.(),model:options.componentModel,dispatch});
  function safety(action, facts,dispatch=false) {
    try { return safetyDecision(action,facts,dispatch); }
    catch { return deny('INVALID_SAFETY_FACTS'); }
  }
  function safetyDecision(action, facts,dispatch) {
    if(configError&&!degradedLedgerRead(action))return deny('INVALID_CONFIG');
    const localRestriction=localDemoRestriction(action,options.localDemoContext,EFFECTS,facts.input);if(localRestriction)return localRestriction;
    if(AI_DEMO_ACTIONS.includes(action.type)){const d=aiDemoEvaluate(action,facts,dispatch);return d.status==='allow'?null:d;}
    if(LOCAL_DEMO_ACTIONS.includes(action.type)){const d=localDemoDecision(action,facts,{companyId:options.companyId,mode:config?.mode??'setup',context:options.localDemoContext});return d.status==='allow'?null:d;}
    if(EFFECTS.has(action.type)){
      const i=integrationFacts();let l;try{l=options.getLedgerFacts?.();}catch{l=null;}
      const nativeBreach=(l?.costs??[]).some(c=>{const r=l?.financial?.reservations?.find(r=>r.actionId===c.operationId);return c.source==='near-json-rpc-final-fee'&&r&&((isIntegerAmount(c.actualCostNanoUsd)&&integer(c.actualCostNanoUsd)>integer(r.upperBoundNanoUsd))||(isIntegerAmount(c.actualFeeYocto)&&r.nativeResource&&integer(c.actualFeeYocto)>integer(r.nativeResource.amountYocto)));});
      if(i.incidents?.some(i=>i.companyId===options.companyId&&i.type==='provider_cost_bound_breach')||nativeBreach)return hold('PROVIDER_COST_BOUND_BREACH');
    }
    if(action.type.startsWith('integration_')){const d=integrationEvaluate(action,facts,dispatch);return d.status==='allow'?null:d;}
    if(action.type.startsWith('ledger_chain_')){
      if(!config&&!setupOnly)return deny('INVALID_CONFIG');
      const d=ledgerEvaluate(action,facts,dispatch);return d.status==='allow'?null:d;
    }
    if(action.type.startsWith('support_')){
      if(!config&&!setupOnly)return deny('INVALID_CONFIG');
      const d=supportEvaluate(action,facts);return d.status==='allow'?null:d;
    }
    if(action.type.startsWith('cloud_')){
      const d=cloudProductsDecision(action,facts,{companyId:options.companyId,mode:config?.mode??'setup',now:nowMs()});
      return d.status==='allow'?null:d;
    }
    if(autonomyAction(action)){
      if(configError||!config&&!setupOnly)return deny('INVALID_CONFIG');
      const d=autonomyEvaluate(action,facts,dispatch);if(d.status!=='allow')return d;
      return config?.mode==='live'&&action.type==='agent_inference'?ceilingBlock(action,facts,config,authorizations()):null;
    }
    const knowledge=internalKnowledge(action,facts);if(knowledge?.blocked)return knowledge.blocked;if(knowledge)return null;
    const mode=config?.mode??(setupOnly?'setup':'unavailable');
    const owner=ownerAccess(facts.access,options.companyId,mode);
    if(mode!=='fixture'&&(OWNER_SETUP.has(action.type)||action.type==='knowledge_context')&&[facts.company?.id,facts.companyId,facts.agent?.companyId].some(id=>id!=null&&id!==options.companyId))return deny('COMPANY_SCOPE_MISMATCH');
    if(!config&&setupOnly&&!configError){
      if(action.type==='public_readiness')return null;
      if(action.type==='access'&&['status','storefront'].includes(action.resource))return null;
      if(action.type==='access'&&['workspace','owner'].includes(action.resource))return owner?null:deny('ACCESS_DENIED');
      if(!SETUP_ONLY.has(action.type))return hold('COMMERCIAL_POLICY_REQUIRED');
      return owner?null:deny('ACCESS_DENIED');
    }
    if (!config || (configError && !degradedLedgerRead(action))) return deny('INVALID_CONFIG');
    if(action.type==='public_readiness')return null;
    if(action.type==='component_consumption')return owner?null:deny('ACCESS_DENIED');
    if(action.type==='component_inference'){
      if(!owner)return deny('ACCESS_DENIED');
      if(config.mode!=='live')return hold('COMMERCIAL_POLICY_REQUIRED');
      if(config.killSwitch)return deny('KILL_SWITCH');
      const ceiling=ceilingBlock(action,facts,config,authorizations());if(ceiling)return ceiling;
      const result=componentInference(action,facts,componentContext(runtimeFacts(),dispatch));
      return result.status==='allow'?null:result;
    }
    if(config.mode!=='fixture'&&action.type==='access'&&['workspace','owner'].includes(action.resource)&&!owner)return deny('ACCESS_DENIED');
    if(config.mode!=='fixture'&&(OWNER_SETUP.has(action.type)||ECONOMIC_RECORDS.has(action.type)||action.type==='company_activate')&&!owner)return deny('ACCESS_DENIED');
    if(config.mode!=='fixture'&&['capital_record','credit_record'].includes(action.type))return deny('LEGACY_ECONOMIC_IMPORT_DISABLED');
    if(config.mode!=='fixture'&&['procurement','procurement_record'].includes(action.type))return deny('LIVE_PROCUREMENT_UNAVAILABLE');
    const publicService=['company_activate','service_order'].includes(action.type)||!!facts.order?.agentContext?.service;
    if(config.mode!=='fixture'&&publicService&&
      [facts.knowledgeIds,facts.organization?.activation?.knowledgeIds,facts.order?.agentContext?.companyKnowledge?.documents].some(ids=>Array.isArray(ids)&&ids.length))return deny('CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
    if(ECONOMIC_RECORDS.has(action.type))return null; // Observation/receipts record facts, never submit effects.
    if(config.mode!=='fixture'&&['runtime_probe','runtime_readiness','company_pause','component_preflight'].includes(action.type))return null;
    if (READ_ONLY.has(action.type)) return null;
    if (config.killSwitch) return deny('KILL_SWITCH');
    if ((action.mode ?? facts.mode ?? config.mode) !== config.mode) return deny('MODE_MISMATCH');
    if(config.mode!=='fixture'){
      if(OWNER_SETUP.has(action.type))return null;
      if(config.mode!=='live')return deny('LIVE_AUTHORIZATION_REQUIRED');
      const denied=liveGate(action,facts,config,policyVersion,options.getAuthorization?.(),nowMs(),options.companyId);if(denied)return denied;
      const runtime=runtimeFacts();
      if(COMMERCIAL_READINESS.has(action.type)){
        // A payment/order step needs the live payment route only. The refund route is
        // enforced per-quote by freezeServiceRefundRoute (the quote fails closed without
        // a complete, priced remedy), so it is not a separate standing capability. The
        // deliverable's own capabilities are still enforced by their own effects.
        const needed=['offer','settlement'].includes(action.type)?['payments_route']:CAPABILITIES;
        const blocked=requireCapabilities(readiness(runtime),needed);if(blocked)return blocked;
      }
      if(EFFECTS.has(action.type)){
        const ceiling=ceilingBlock(action,facts,config,authorizations());if(ceiling)return ceiling;
        const blocked=economicSafety(facts.financial,runtime,config,options.companyId,action.type==='inference'?['credit']:['cash'],nowMs());if(blocked)return blocked;
      }
      if(EFFECTS.has(action.type)&&!['live_ready'].includes(options.getOperationState?.()?.state))return deny('COMPANY_NOT_ACTIVE');
      if(EFFECTS.has(action.type)&&options.getOperationState?.()?.policyVersion!==policyVersion)return deny('ACTIVATION_REVIEW_REQUIRED');
      if(action.type==='inference'){
        const verified=verifyInferenceEvidence('preflight',{request:facts.request,requestFingerprint:action.requestFingerprint,prepared:true},runtime,config,nowMs());
        if(verified.status!=='allow')return verified;
      }
    }else if(EFFECTS.has(action.type)&&options.getOperationState?.()?.state==='paused')return deny('COMPANY_PAUSED');
    return null;
  }
  function evaluate(action, facts = {}) {
    refresh();
    let result;
    try {
      if (!action || typeof action !== 'object' || typeof action.id !== 'string' || !action.id || typeof action.type !== 'string') result = deny('INVALID_INPUT');
      else result = safety(action, facts);
      if (!result) {
        switch (action.type) {
          case 'ai_demo_view':case 'ai_demo_control':case 'ai_demo_prepare':case 'ai_demo_inference':case 'ai_demo_accept':case 'ai_demo_cost':result=aiDemoEvaluate(action,facts);break;
          case 'local_demo_open':case 'local_demo_status':result=localDemoDecision(action,facts,{companyId:options.companyId,mode:config?.mode??'setup',context:options.localDemoContext});break;
          case 'integration_view':case 'integration_review':case 'integration_execute':case 'integration_cost':case 'integration_release':case 'integration_observed':result=integrationEvaluate(action,facts);break;
          case 'ledger_chain_view': case 'ledger_chain_export': case 'ledger_chain_prepare': case 'ledger_chain_publish': case 'ledger_chain_reconcile':case 'ledger_chain_balance':case 'ledger_chain_cost':case 'ledger_chain_release':case 'ledger_chain_pending':result=ledgerEvaluate(action,facts);break;
          case 'support_catalog': case 'support_publish': case 'support_open': case 'support_context': case 'support_view': case 'support_reply': case 'support_escalate': case 'support_owner':result=supportEvaluate(action,facts);break;
          case 'cloud_products_view':case 'cloud_catalog':case 'cloud_usage':case 'cloud_product_plan':case 'cloud_product_execute':result=cloudProductsDecision(action,facts,{companyId:options.companyId,mode:config?.mode??'setup',now:nowMs()});break;
          case 'agent_preparation_blocked':case 'autonomy_review_change':case 'autonomy_onboard':case 'autonomy_setup_review':case 'autonomy_configure':case 'autonomy_bootstrap':case 'autonomy_control':case 'autonomy_view':case 'autonomy_claim':case 'autonomy_command':case 'autonomy_gap':case 'autonomy_template':case 'autonomy_evaluate':case 'autonomy_promote':case 'autonomy_rollback':case 'autonomy_auto_evaluate':case 'autonomy_auto_promote':case 'autonomy_knowledge':case 'autonomy_recover_result':case 'agent_prepare':case 'agent_inference':case 'agent_result':case 'agent_observe':case 'agent_consumption':result=autonomyEvaluate(action,facts);break;
          case 'public_readiness': result=allow({plan:{...publicReadiness(readiness(),!config),...(options.localDemoContext?.kind==='real-local-demo'?{experience:'real-local-demo'}:{})}}); break;
          case 'component_preflight': result=componentPreflight(action,facts,componentContext()); break;
          case 'component_inference': result=componentInference(action,facts,componentContext()); break;
          case 'component_consumption': result=componentConsumption(action,facts,runtimeFacts()); break;
          case 'runtime_readiness': result=allow({plan:readiness()}); break;
          case 'runtime_probe': result=probeDecision(action); break;
          case 'balance_snapshot': case 'cash_opening': case 'credit_opening': case 'cash_receipt': case 'credit_receipt': result=economicDecision(action,facts,config,policyVersion,nowMs(),runtimeFacts(),options.companyId); break;
          case 'company_activation_status': result=activationStatus(config,activationFacts(action,facts),readiness()); break;
          case 'company_activate': case 'company_pause': case 'resource_bind': case 'service_order': case 'credit_record': case 'capital_record': case 'procurement': case 'procurement_record': result=businessDecision(action,activationFacts(action,facts),config,policyVersion,nowMs(),readiness()); break;
          case 'organization_manage': case 'organization_setup': case 'organization_setup_review': result=organizationDecision(action,{...facts,mode:config?.mode??'setup',rulesReadiness:readiness()}); break;
          case 'knowledge_import': case 'knowledge_manage': case 'knowledge_read': case 'knowledge_preview': case 'knowledge_context': result=knowledgeDecision(action,internalKnowledge(action,facts)?.facts??facts,config); break;
          case 'bootstrap': result = bootstrap(facts, config); break;
          case 'agent_manage': {
            const target=facts.input?.runtime,mode=config?.mode??'setup',old=facts.agent?.runtime;
            if(target!==undefined&&(target!==mode||old&&old!==target&&!(old==='setup'&&target==='live')))result=deny('RUNTIME_METADATA_CHANGE_DENIED');
            else result = allow({ plan: { kind: 'agent_metadata', runtime: mode, ...(target===undefined?{}:{agentPatch:{runtime:target}}), grantsSpendingAuthority: false } });
            break;
          }
          case 'agent_task': result = facts.catalog?.some(l=>l.purchaseRequired&&facts.agent?.skillIds?.includes(l.id)&&!facts.licenses?.some(x=>x.listingId===l.id&&x.version===(l.version??'1')))?hold('LICENCE_REQUIRED'): !facts.agent ? hold('AGENT_FACTS_REQUIRED') : facts.agent.status !== 'ready' ? hold(facts.agent.status === 'paused' ? 'AGENT_PAUSED' : 'AGENT_DRAFT') : facts.agent.runtime !== config.mode ? deny('RUNTIME_UNAVAILABLE') : allow({ plan: { kind: 'agent_task', agentId: facts.agent.id, agentVersion: facts.agent.version, requireOrderAuthorization: true } }); break;
          case 'offer':
            result = action.orderId && (!Number.isSafeInteger(facts.activeOrderCount) || facts.activeOrderCount < 0) ? hold('ACTIVE_ORDER_FACTS_REQUIRED') : facts.activeOrderCount > 0 ? hold('ACTIVE_ORDER_LIMIT') : makeOffer(config, policyVersion, nowMs(), action); break;
          case 'settlement': result = assessSettlement(action, facts, nowMs()); break;
          case 'allocate': result = allocation(action, facts, nowMs()); break;
          case 'funding': case 'inference': {
            result = eligibility(action.type, facts);
            if (result.status === 'allow' && action.type === 'inference') result = assessEvidence(facts, config, nowMs());
            if (result.status === 'allow') result = spend(action, facts, config, nowMs());
            if(result.status==='allow'&&config.mode==='live'&&action.type==='inference'){
              const verified=verifyInferenceEvidence('preflight',{request:facts.request,requestFingerprint:action.requestFingerprint,prepared:true},runtimeFacts(),config,nowMs());
              result=verified.status==='allow'?{...result,plan:{...result.plan,requestBytesHash:verified.plan.requestBytesHash}}:verified;
            }
            break;
          }
          case 'research': {
            result = eligibility(action.type, facts);
            if (result.status === 'allow') result = allow({ plan: researchPlan(config, facts, options.getInferenceBounds?.(),nowMs()) });
            break;
          }
          case 'report': {
            result = eligibility(action.type, facts);
            if(result.status==='allow'&&config.mode==='live')result=businessOutput(facts);
            if (result.status === 'allow') result = assessReport(facts, config, nowMs());
            break;
          }
          case 'evidence': {
            result = eligibility(action.type, facts);
            if (result.status === 'allow') result = assessEvidence(facts, config, nowMs());
            break;
          }
          case 'deliver': result = eligibility('deliver', facts); if(result.status==='allow'&&config.mode==='live')result=businessOutput(facts); if (result.status === 'allow') result = allow({ plan: { type: 'delivery', orderId: action.orderId, artifactId: facts.order.reportId, access: 'entitled_customer', availabilityRequired: true } }); break;
          case 'payout': result = payout(action, facts); break;
          case 'refund': result = refund(action, facts); break;
          case 'retry': result = retry(action, facts, config); break;
          case 'access': result = !config?allow({accessPlan:{kind:'setup_status',resource:action.resource,setupRequired:true,permittedActions:[],grantsSpendingAuthority:false}}):access(action, facts, config); if (result.status === 'allow') result.accessPlan.permittedActions = permittedActions(facts); break;
          case 'disclosure': result = config.access.publicLedger ? allow({ plan: { eventFields: [...PUBLIC_FIELDS], publicFields: [...PUBLIC_FIELDS], financialFields: ['balances', 'dailyCosts', 'reservations', 'credits', 'obligations'], separateAssets: true, costsUnit: 'nanoUSD', includeUnknown: true } }) : deny('ACCESS_DENIED'); break;
          case 'reconcile': result = allow({ plan: { type: 'reconcile', operationId: facts.operation?.id ?? null, readOnly: true, resubmit: false } }); break;
          case 'next': {
            result = nextAction(facts, config, nowMs());
            if (result.status === 'allow') {
              const type = result.nextAction;
              const next = result.plan?.action ?? { type, id: `${facts.order?.id ?? action.orderId ?? action.id}:${type}`, orderId: facts.order?.id ?? action.orderId, mode: config.mode };
              if (type === 'payout' && facts.obligation) { const decision = payout(next, facts); if (decision.status === 'allow') Object.assign(next, { recipient: decision.recipient, money: decision.money }); else { result = decision; break; } }
              result.action = next;
              result.permittedActions = permittedActions(facts);
              result.plan = { ...(result.plan ?? {}), kind: 'next', nextAction: type, action: next, permittedActions: result.permittedActions };
            }
            break;
          }
          case 'funding_record': result = fundingRecord(action, facts, config); break;
          case 'consumption': result = consumption(action, facts); break;
          case 'payout_record': result = payoutRecord(action, facts); break;
          case 'refund_record': result = refundRecord(action, facts); break;
          case 'reservation_update': result = reservationUpdate(action, facts); break;
          case 'remedy': result = remedy(action, facts); break;
          case 'late_payment': result = latePayment(action, facts, nowMs()); break;
          case 'complete': result = eligibility('complete', facts); if (result.status === 'allow') result = allow({ plan: { type: 'completion', orderId: action.orderId, mode: config.mode } }); break;
          default: result = deny('UNKNOWN_ACTION');
        }
      }
    } catch (error) { result = deny('INVALID_INPUT', { details: error.message }); }
    const decision = { ...base(action, facts), ...result, mode: config?.mode ?? (setupOnly?'setup':'unavailable') };
    if (decision.status === 'allow' && degradedLedgerRead(action)) {
      const readSafety = { degraded: true, currentSafetyValid: false, readPolicyVersion: policyVersion, businessEffectsAllowed: false };
      Object.assign(decision, readSafety, { reasonCode: 'LAST_ACCEPTED_LEDGER_POLICY' });
      if (decision.plan) Object.assign(decision.plan, readSafety);
      if (decision.accessPlan) Object.assign(decision.accessPlan, readSafety);
    }
    if (decision.status === 'allow' && !SUPPORT_ACTIONS.includes(action.type) && (config?.mode==='live'||action.type==='ai_demo_inference')&&EFFECTS.has(action.type))decision.authorizationId=currentAuthorization(action)?.id??null;
    if (decision.status === 'allow' && EFFECTS.has(action.type)) {
      if (!Number.isSafeInteger(facts.financial?.version)) return freeze({ ...decision, status: 'hold', reasonCode: 'FINANCIAL_FACTS_REQUIRED', plan: undefined });
      const permitData = { schemaVersion: 1, authorizationId:decision.authorizationId??null,...(config?.mode==='live'||action.type==='ai_demo_inference'?{authorizationFingerprint:hash(currentAuthorization(action)??null)}:{}), id: `permit:${randomUUID()}`, actionId: action.id, actionFingerprint: decision.actionFingerprint, policyVersion, policyEpoch, financialVersion: facts.financial.version, orderVersion: facts.order?.version ?? null, recipient: decision.recipient ?? action.recipient ?? null, maximumMoney: decision.money ?? action.money ?? null, maxCostNanoUsd: action.maxCostNanoUsd ?? null, reservationId: decision.plan?.reservation?.id ?? null, issuedAt: new Date(nowMs()).toISOString(), expiresAt: new Date(nowMs() + (config?.spending.permitTtlMs??5000)).toISOString(), mode: config?.mode??'setup' };
      const permit = { ...permitData, signature: sign(permitData) };
      issued.set(permit.id, { permit, plan: structuredClone(decision.plan), action: structuredClone(action), facts: structuredClone(facts) });
      decision.permit = permit;
    }
    return freeze(decision);
  }
  function permittedActions(facts) {
    if (!config || configError || config.killSwitch) return [];
    if(config.mode!=='fixture'&&(requireCapabilities(readiness())||liveGate({type:'offer'},facts,config,policyVersion,options.getAuthorization?.(),nowMs(),options.companyId)))return [];
    const order = facts.order;
    if (!order) return ['create-order'];
    if (order.status === 'complete' || order.refundConfirmed) return [];
    if (order.remedyRequired) return ['run'];
    if (!order.paymentConfirmed) return !order.quote ? ['quote'] : config.mode === 'fixture' ? ['fixture-payment'] : ['check-payment'];
    return ['run'];
  }
  function validateDispatch(permit, facts = {}) {
    refresh();
    const action = facts.action ?? issued.get(permit?.id)?.action;
    const context = { ...issued.get(permit?.id)?.facts, ...facts };
    const decisionBase = base(action, context);
    const reject = code => freeze({ ...decisionBase, ...deny(code) });
    if (!permit || !issued.has(permit.id)) return reject('UNTRUSTED_PERMIT');
    const { signature, ...payload } = permit;
    const expected = sign(payload);
    if (typeof signature !== 'string' || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return reject('UNTRUSTED_PERMIT');
    const blocked = safety(action, context,true);
    if (blocked) return freeze({ ...decisionBase, ...blocked });
    if (spent.has(permit.id) || facts.permitConsumed === true) return reject('PERMIT_CONSUMED');
    if (nowMs() >= Date.parse(permit.expiresAt)) return reject('PERMIT_EXPIRED');
    const authorization=currentAuthorization(action);
    if((config?.mode==='live'||action.type==='ai_demo_inference')&&(permit.authorizationId!==authorization?.id||permit.authorizationFingerprint!==hash(authorization??null)))return reject('STALE_AUTHORIZATION');
    if (permit.policyEpoch !== policyEpoch || permit.policyVersion !== policyVersion) return reject('STALE_POLICY');
    if (hash(action) !== permit.actionFingerprint) return reject('ACTION_MISMATCH');
    if (permit.orderVersion !== null && !facts.order) return reject('CURRENT_ORDER_FACTS_REQUIRED');
    if (!facts.financial || !Number.isSafeInteger(facts.financial.version)) return reject('CURRENT_FINANCIAL_FACTS_REQUIRED');
    const issuedRecord = issued.get(permit.id);
    if(config?.mode==='live'&&['inference','component_inference','agent_inference'].includes(action.type)){
      const request=action.type==='agent_inference'?autonomyFacts().work?.find(w=>w.id===action.workId)?.request:context.request;
      const verified=verifyInferenceEvidence('preflight',{request,requestFingerprint:action.requestFingerprint,prepared:true},runtimeFacts(),config,nowMs());
      if(verified.status!=='allow')return freeze({...decisionBase,...verified});
      if(issuedRecord.plan.requestBytesHash!==verified.plan.requestBytesHash)return reject('PREPARED_REQUEST_HASH_MISMATCH');
    }
    const applied = facts.financial.approvedPlans?.find(x => x.actionId === permit.actionId && x.fingerprint === permit.actionFingerprint && x.policyEpoch === permit.policyEpoch && hash(x.plan) === hash(issuedRecord.plan));
    if (!applied || applied.inputVersion !== permit.financialVersion || applied.appliedVersion !== permit.financialVersion + 1) return reject('PERSISTED_PLAN_REQUIRED');
    const consumed = facts.financial.consumedPermits?.find(x => x.id === permit.id);
    const expectedVersion = consumed ? applied.appliedVersion + 1 : applied.appliedVersion;
    if (facts.financial.version !== expectedVersion || (consumed && (consumed.financialVersion !== expectedVersion || consumed.signature !== permit.signature || consumed.actionFingerprint !== permit.actionFingerprint))) return reject('STALE_FINANCIAL_STATE');
    if ((context.order?.version ?? null) !== permit.orderVersion) return reject('STALE_ORDER_STATE');
    if (['unknown', 'pending'].includes(context.operation?.status)) return freeze({ ...decisionBase, ...hold('RECONCILE_REQUIRED') });
    if (action.type === 'inference'||action.type==='component_inference'||action.type==='agent_inference') {
      const slot=inferenceAdmission(action.id,facts.financial,config);if(slot)return freeze({...decisionBase,...slot});
      if(context.currentAgent&&(context.currentAgent.status!=='ready'||context.currentAgent.version!==context.order?.agentContext?.version))return reject('AGENT_REVIEW_REQUIRED');
      const creditId=action.type==='agent_inference'&&config.mode==='live'?authorization?.creditId:context.creditId;
      if(config.mode==='live'&&!(facts.financial.credits?.lots??[]).some(c=>c.id===creditId&&Date.parse(c.expiresAt)>nowMs()))return reject('CREDIT_EVIDENCE_EXPIRED');
      const evidence = action.type==='component_inference'||action.type==='agent_inference'?allow():assessEvidence(context, config, nowMs());
      if (evidence.status !== 'allow') return freeze({ ...decisionBase, ...evidence });
      const currentDay = new Date(nowMs()).toISOString().slice(0, 10);
      if (facts.financial.dailyCosts?.[currentDay] == null) return reject('DAILY_COST_FACTS_REQUIRED');
      const held = (facts.financial.reservations ?? []).filter(x => x.purpose !== 'funding' && !['released', 'reconciled', 'failed'].includes(x.status)).reduce((sum, x) => sum + integer(x.upperBoundNanoUsd), 0n);
      if (integer(facts.financial.dailyCosts[currentDay]) + held > integer(config.spending.dailyInferenceCapNanoUsd)) return reject('DAILY_CAP_EXCEEDED');
      if (held > integer(facts.financial.credits.availableNanoUsd)) return reject('INSUFFICIENT_CREDIT');
    }
    if ((facts.financial.reservations ?? []).some(x => x.status === 'unknown')) return freeze({ ...decisionBase, ...hold('UNRESOLVED_SPEND') });
    return freeze({ ...decisionBase, authorizationId: authorization?.id??null, ...allow({ permit, financialVersion: facts.financial.version, plan: issuedRecord.plan, consumptionRecorded: !!consumed }) });
  }
  /** Callback must synchronously record consumption and START dispatch; never await first. */
  function dispatch(permit, facts, startEffect) {
    if (dispatching) return freeze({ ...base(facts?.action, facts ?? {}), ...deny('DISPATCH_REENTRANCY') });
    if (typeof startEffect !== 'function') throw new TypeError('dispatch callback is required');
    const decision = validateDispatch(permit, facts);
    if (decision.status !== 'allow') return decision;
    if (!decision.consumptionRecorded) return freeze({ ...decision, ...deny('PERMIT_CONSUMPTION_REQUIRED') });
    dispatching = true;
    spent.add(permit.id); // A thrown/ambiguous submission must never make this permit reusable.
    try { return { ...decision, result: startEffect(decision) }; }
    finally { dispatching = false; }
  }
  if (Object.hasOwn(options, 'config')) updateConfig(options.config);
  else if (configPath) reload();
  else if(!setupOnly) { configError = 'Owner config is required'; policyEpoch++; }
  return Object.freeze({ evaluate, validateDispatch, dispatch, updateConfig, reload, snapshot });
}
