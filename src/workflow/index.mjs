import {catalog as defaultCatalog} from '../workspace/catalog.mjs';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { fingerprint, ContractError, assertOrderSpec } from '../contracts.mjs';

const digestToken = token => createHash('sha256').update(token).digest('hex');
const fail = (code,message) => { throw new ContractError(code,message); };
const allowed = d => d?.status === 'allow';
const clone = v => structuredClone(v);

/** Mechanics only: M01 supplies every price, next action and financial plan. */
export function createWorkflow({journal,treasury,rules,custody,payments,funding,inference,research,payouts,clock=()=>new Date(),sourceUrls=[],initialize=async()=>{},getOperationState=()=>null,catalog=defaultCatalog}) {
  let queue=Promise.resolve();
  const now=()=>new Date(clock()).toISOString();
  const raw=id=>journal.get('orders',id) ?? fail('NOT_FOUND','Order not found.');
  const action=(order,type,extra={})=>({id:`${order.id}:${type}`,type,orderId:order.id,mode:order.mode,...extra});
  const facts=(order,extra={})=>({order,offer:order.offer,financial:treasury.snapshot(),payment:order.payment,report:order.reportFacts,evidencePack:order.evidencePack,request:order.request,creditId:order.creditId,agent:order.agentContext,listing:catalog.find(x=>x.id===order.procurementIntent?.action?.listingId),licenses:journal.list('resourceLicenses'),artifact:order.candidate,capabilities:{funding:funding.capabilities().autonomousPurchaseSupported},...extra});
  const decide=(order,type,extra={},more={})=>rules.evaluate(action(order,type,extra),facts(order,more));
  const serial=fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
  async function save(order,patch) {
    if(Object.entries(patch).every(([key,value])=>fingerprint(order[key]??null)===fingerprint(value??null)))return order;
    const next={...order,...clone(patch),version:order.version+1,updatedAt:now()};
    await journal.transaction({actionId:`order-update:${order.id}:${next.version}`,fingerprint:fingerprint(next)},tx=>{tx.put('orders',order.id,next,{expectedVersion:order.version});return next;});
    return next;
  }
  async function blocked(order,decision) {
    const patch=decision.plan?.orderPatch??{};
    const status=decision.status==='deny'?'blocked':'held';
    if(order.status!==status || order.reasonCode!==decision.reasonCode || Object.keys(patch).some(key=>order[key]!==patch[key]))await save(order,{...patch,status,reasonCode:decision.reasonCode,lastDecision:decision});
    return {order:getOrder(order.id)};
  }
  function accessDecision(order,token,resource) {
    return rules.evaluate({...action(order,'access'),resource},facts(order,{access:verifyAccess(order.id,token)}));
  }
  function verifyAccess(id,token) {
    const order=journal.get('orders',id);
    if(!order || typeof token!=='string' || !token) return {verified:false};
    const actual=digestToken(token);
    const verified=actual.length===order.accessHash.length && timingSafeEqual(Buffer.from(actual),Buffer.from(order.accessHash));
    return {verified, ...(verified?{customerId:order.customerId,role:'customer'}:{})};
  }
  function getOrder(id) {
    const o=raw(id), next=decide(o,'next');
    const permittedActions=next.permittedActions??next.plan?.permittedActions??[];
    return {companyKnowledge:(o.agentContext?.companyKnowledge?.documents??[]).map(({id,title,revision,truncated})=>({id,title,revision,truncated})),id:o.id,customerId:o.customerId,question:o.question,geography:o.geography,timeHorizon:o.timeHorizon,format:o.format,status:o.status,mode:o.mode,offer:o.offer,quote:o.quote,payment:o.payment,paymentConfirmed:!!o.paymentConfirmed,reportAccepted:!!o.reportAccepted,reportAvailable:!!o.reportAvailable,reportId:o.reportId,evidenceReady:!!o.evidenceReady,generationComplete:!!o.generationComplete,procurementReady:!!o.procurementReady,procurementLicence:o.procurementLicence,payoutConfirmed:!!o.payoutConfirmed,costReconciled:!!o.costReconciled,refundConfirmed:!!o.refundConfirmed,reasonCode:allowed(next)?o.reasonCode:next.reasonCode,permittedActions,createdAt:o.createdAt,updatedAt:o.updatedAt,version:o.version};
  }
  async function createOrder(input) { return serial(async()=>{
    await initialize();
    const requestId=input.actionId;
    const clean={question:input.question,geography:input.geography??'',timeHorizon:input.timeHorizon??'',format:input.format??'report',sourceAsset:input.sourceAsset??null,sourceNetwork:input.sourceNetwork??null,refundRecipient:input.refundRecipient??null,...(input.agentContext?{agentContext:input.agentContext}:{})};
    if(requestId) {
      const prior=journal.get('orderRequests',requestId);
      if(prior) {
        if(prior.fingerprint!==fingerprint(clean)) fail('CONFLICT','Idempotency key was used with a different brief.');
        // Capability cannot be recovered from a hash; the browser retains the creation response.
        fail('CONFLICT',`Order already created: ${prior.orderId}. Use its original delivery capability.`);
      }
    }
    const id=randomUUID(), token=randomBytes(32).toString('base64url');
    const config=rules.snapshot();
    const assets=config.config?.customerAssets??[];
    const requested=typeof input.sourceAsset==='object' && input.sourceAsset?input.sourceAsset:assets.find(a=>a.asset===input.sourceAsset && (!input.sourceNetwork||a.network===input.sourceNetwork)) ?? (input.sourceAsset?{asset:input.sourceAsset,network:input.sourceNetwork,decimals:0}:assets[0]);
    let order={schemaVersion:1,id,customerId:randomUUID(),accessHash:digestToken(token),question:clean.question,geography:clean.geography,timeHorizon:clean.timeHorizon,format:clean.format,mode:config.mode,sourceAsset:requested,refundRecipient:input.refundRecipient??(config.mode==='fixture'?'fixture-customer':null),version:1,status:'created',createdAt:now(),updatedAt:now()};
    if(input.agentContext)order.agentContext=clone(input.agentContext);
    if(config.mode!=='fixture'&&(typeof order.refundRecipient!=='string'||!order.refundRecipient.trim()||order.refundRecipient.length>256))fail('INVALID_INPUT','A refund address on the payment network is required.');
    assertOrderSpec(order);
    const offer=rules.evaluate(action(order,'offer',{sourceAsset:requested,refundRecipient:order.refundRecipient}),facts(order,{activeOrderCount:journal.list('orders').filter(o=>!['complete','refunded'].includes(o.status)).length}));
    if(!allowed(offer)) fail('POLICY_BLOCK',offer.reasonCode);
    order.offer=offer.offer; order.offerDecision=offer;
    await journal.transaction({actionId:`order-create:${requestId??id}`,fingerprint:fingerprint(clean)},tx=>{tx.put('orders',id,order);if(input.taskMetadata)tx.put('agentTasks',id,{...input.taskMetadata,id,orderId:id,title:order.question,status:order.status,createdAt:order.createdAt});if(requestId)tx.put('orderRequests',requestId,{fingerprint:fingerprint(clean),orderId:id});return {id};});
    return {order:getOrder(id),accessToken:token};
  }); }
  async function quoteImpl(id) {
    let o=raw(id); if(o.quote) return {order:getOrder(id)};
    // Frozen offer was M01-approved; current next gate enforces current kill/config.
    const next=decide(o,'next');if(!allowed(next))return blocked(o,next);
    const result=await payments.quote({action:action(o,'offer',{sourceAsset:o.sourceAsset}),offer:o.offer,sourceAsset:o.sourceAsset,recipient:o.offer.treasuryAccount,refundTo:o.refundRecipient,expiresAt:o.offer.expiresAt,decision:o.offerDecision});
    if(result.status!=='confirmed')return blocked(o,{status:'hold',reasonCode:result.code??result.status});
    o=await save(o,{quote:result.quote,status:'awaiting_payment'});return {order:getOrder(id)};
  }
  async function confirmImpl(id) {
    let o=raw(id);
    if(o.paymentConfirmed)return {order:getOrder(id)};
    if(!o.quote){await quoteImpl(id);o=raw(id);if(!o.quote)return {order:getOrder(id)};}
    const outcome=await payments.verifySettlement({action:action(o,'settlement'),quote:o.quote,});
    if(['pending','unknown'].includes(outcome.status)){await save(o,{status:'awaiting_payment',paymentOutcome:outcome,reasonCode:outcome.code??'PAYMENT_UNRESOLVED'});return {order:getOrder(id)};}
    const payment={...outcome.settlement,status:outcome.status,confirmedAt:outcome.settlement?.settledAt};
    o=await save(o,{payment,paymentOutcome:outcome});
    const decision=decide(o,'settlement');
    if(!allowed(decision)) {
      if(decision.reasonCode==='LATE_PAYMENT_REMEDY') {
        const late=decide(o,'late_payment');if(!allowed(late))return blocked(o,late);
        await treasury.applyDecision({actionId:`${id}:late_payment`,decision:late});
        o=await save(o,late.plan.orderPatch);
      }
      return blocked(o,decision);
    }
    await save(o,{paymentConfirmed:true,status:'paid',reasonCode:null});return {order:getOrder(id)};
  }
  async function prepareEffect(o,type,a,more={}) {
    const key=`${type}Intent`;
    const stored=journal.get('workflowIntents',a.id);
    if(stored) {
      await treasury.applyDecision({actionId:a.id,decision:stored.decision});
      return {o,intent:stored};
    }
    // Persist the action identity first; issuing a permit must not change orderVersion.
    if(!o[key])o=await save(o,{[key]:{action:a}});
    const decision=rules.evaluate(a,facts(o,more));
    if(!allowed(decision))return {o,blocked:decision};
    const intent={action:a,decision};
    await journal.transaction({actionId:`effect-intent:${a.id}`,fingerprint:fingerprint(intent)},tx=>{tx.put('workflowIntents',a.id,intent);return null;});
    await treasury.applyDecision({actionId:a.id,decision});
    return {o,intent};
  }
  function persistedIntent(o,type) { const local=o[`${type}Intent`];return local?journal.get('workflowIntents',local.action.id):null; }
  async function recordEffect(o,type,outcome,more={}) {
    const id=`${o.id}:${type}`;
    const stored=journal.get('workflowRecords',id);
    const decision=stored?.decision??decide(o,type,{}, {result:outcome,receipt:outcome.receipt,...more});
    if(!allowed(decision))return {blocked:decision};
    if(!stored)await journal.transaction({actionId:`record-intent:${id}`,fingerprint:fingerprint(decision)},tx=>{tx.put('workflowRecords',id,{decision});return null;});
    await treasury.applyDecision({actionId:id,decision});return {patch:decision.plan?.orderPatch??{}};
  }
  async function recordReservation(o,type,outcome) {
    const intent=persistedIntent(o,type);if(!intent?.decision.plan?.reservation)return;
    const reservationId=intent.decision.plan.reservation.id;
    const d=decide(o,'reservation_update',{}, {result:outcome,reservationId});
    if(allowed(d))await treasury.applyDecision({actionId:`${o.id}:reservation-observation:${type}:${fingerprint(d.plan)}`,decision:d});
  }
  async function reconcileImpl(o) {
    for(const type of ['funding','inference','payout','refund','procurement']) {
      const field={funding:'fundingOutcome',inference:'generationOutcome',payout:'payoutOutcome',refund:'refundOutcome',procurement:'procurementOutcome'}[type];
      const prior=o[field], intent=persistedIntent(o,type);
      if(!intent || !prior || (!['unknown','pending'].includes(prior.status) && !(prior.status==='confirmed'&&prior.cost?.status==='pending')))continue;
      const d=decide(o,'reconcile',{}, {operation:prior});if(!allowed(d))return {o,blocked:d};
      const port={funding,inference,payout:payouts,refund:custody,procurement:custody}[type];
      const result=await port.reconcile({action:intent.action,request:o.request,decision:d,facts:facts(o)});
      o=await save(o,{[field]:result});
      if(['funding','inference'].includes(type) && ['unknown','pending','not_submitted'].includes(result.status))await recordReservation(o,type,result);
      if(['unknown','pending'].includes(result.status))return {o,blocked:{status:'hold',reasonCode:'RECONCILE_REQUIRED'}};
    }
    return {o};
  }
  async function runImpl(id) {
    for(let step=0;step<32;step++) {
      let o=raw(id);if(['complete','refunded'].includes(o.status))return {order:getOrder(id)};
      const reconciled=await reconcileImpl(o);o=reconciled.o;if(reconciled.blocked)return blocked(o,reconciled.blocked);
      if(getOperationState()?.state==='paused')return blocked(o,{status:'hold',reasonCode:'COMPANY_PAUSED'});
      const decision=decide(o,'next');if(!allowed(decision))return blocked(o,decision);
      const type=decision.nextAction??decision.plan?.nextAction;
      if(type==='settlement'){if(o.mode==='live'&&o.quote){await confirmImpl(id);o=raw(id);if(o.paymentConfirmed)continue;}return {order:getOrder(id)};}
      if(type==='allocate') {
        const d=decide(o,'allocate');if(!allowed(d))return blocked(o,d);
        await treasury.applyDecision({actionId:`${id}:allocate`,decision:d});await save(o,{allocated:true,status:'processing',reasonCode:null});continue;
      }
      if(type==='funding') {
        let intent=persistedIntent(o,'funding');
        if(!intent) {
          const supplied=decision.action??decision.nextCommand??decision.plan?.action??decision.fundingAction;
          if(!supplied)return blocked(o,{status:'hold',reasonCode:'FUNDING_COMMAND_REQUIRED'});
          const a=action(o,'funding',supplied);
          const prepared=await prepareEffect(o,'funding',a);o=prepared.o;if(prepared.blocked)return blocked(o,prepared.blocked);intent=prepared.intent;
        }
        const outcome=await funding.fund({...intent,facts:facts(o)});
        o=await save(o,{fundingOutcome:outcome});
        if(outcome.status!=='confirmed'){await recordReservation(o,'funding',outcome);const remedy=decide(o,'remedy',{}, {result:outcome});if(allowed(remedy)&&remedy.plan?.orderPatch){await save(o,remedy.plan.orderPatch);continue;}return blocked(o,{status:'hold',reasonCode:outcome.code??`FUNDING_${outcome.status.toUpperCase()}`});}
        const recorded=await recordEffect(o,'funding_record',outcome,{reservationId:intent.decision.plan?.reservation?.id});
        if(recorded.blocked)return blocked(o,recorded.blocked);
        await save(o,{creditReady:true,creditId:outcome.receipt.creditId,status:'researching',reasonCode:null});continue;
      }
      if(type==='credit_ready') {
        const credit=treasury.snapshot().credits.lots.find(x=>x.id===decision.plan.creditId);
        await save(o,{creditReady:true,creditId:credit?.id,status:'researching'});continue;
      }
      if(type==='procurement_ready'){
        const licence=journal.list('resourceLicenses').find(x=>x.listingId===decision.plan.listingId);
        await save(o,{procurementReady:true,procurementLicence:licence,agentContext:{...o.agentContext,procuredSkill:licence?{id:licence.listingId,version:licence.version,instructions:catalog.find(x=>x.id===licence.listingId)?.instructions}:null}});continue;
      }
      if(type==='procurement'){
        const a=action(o,'procurement',decision.action??decision.plan.action);
        const listing=catalog.find(x=>x.id===a.listingId);
        const prepared=await prepareEffect(o,'procurement',a,{listing});o=prepared.o;
        if(prepared.blocked)return blocked(o,prepared.blocked);
        const intent=prepared.intent;
        const outcome=o.procurementOutcome?.status==='confirmed'?o.procurementOutcome:await custody.transfer({...intent,facts:facts(o,{listing})});
        o=await save(o,{procurementOutcome:outcome});
        if(outcome.status!=='confirmed'){await recordReservation(o,'procurement',outcome);return blocked(o,{status:'hold',reasonCode:'PROCUREMENT_RECONCILIATION_REQUIRED'});}
        const recorded=await recordEffect(o,'procurement_record',outcome,{purchase:{...intent.decision.plan,actionId:a.id}});
        if(recorded.blocked)return blocked(o,recorded.blocked);
        const licence={listingId:listing.id,version:intent.decision.plan.listingVersion,actionId:a.id,receipt:outcome.receipt.reference??outcome.receipt.transactionId,mode:o.mode};
        await journal.transaction({actionId:`licence:${a.id}`,fingerprint:fingerprint(licence)},tx=>{tx.put('resourceLicenses',listing.id,licence);return null;});
        await save(o,{procurementReady:true,procurementLicence:licence,agentContext:{...o.agentContext,procuredSkill:{id:listing.id,version:licence.version,instructions:listing.instructions}}});continue;
      }
      if(type==='research') {
        const d=decide(o,'research');if(!allowed(d))return blocked(o,d);
        const evidencePack=await research.collect({order:o,decision:d,sourceUrls});
        const evidenceDecision=decide(o,'evidence',{}, {evidencePack});
        if(!allowed(evidenceDecision)) {
          o=await save(o,{evidencePack,evidenceDecision,...(evidenceDecision.plan?.orderPatch??{})});
          if(evidenceDecision.plan?.orderPatch)continue;
          return blocked(o,evidenceDecision);
        }
        let request;
        try { request=research.assemble({order:o,evidencePack,decision:d}); }
        catch(error) {
          const result={status:'not_submitted',mode:o.mode,code:error.code??'RESEARCH_ASSEMBLY_FAILED'};
          const remedy=decide(o,'remedy',{}, {result});
          if(allowed(remedy)&&remedy.plan?.orderPatch){await save(o,{evidencePack,evidenceDecision,researchError:result,...remedy.plan.orderPatch});continue;}
          return blocked(o,remedy);
        }
        await save(o,{evidencePack,evidenceDecision,request,researchDecision:d,evidenceReady:true,status:'researching'});continue;
      }
      if(type==='inference') {
        let intent=persistedIntent(o,'inference');
        if(!intent) {
          const b=o.researchDecision.plan.researchSpec.generationBounds;
          const a=action(o,'inference',{...(decision.action??decision.nextCommand??decision.plan?.action??{}),maxCostNanoUsd:o.request.chargeBound.maxCostNanoUsd,requestFingerprint:fingerprint(o.request),bounds:{inputTokens:b.maxInputTokens,outputTokens:b.maxOutputTokens,reasoningTokens:b.maxReasoningTokens}});
          if(o.mode==='live'&&typeof inference.prepare==='function'){
            const preparation=await inference.prepare({action:a,request:o.request});
            if(preparation.status!=='confirmed')return blocked(o,{status:'hold',reasonCode:preparation.code??'INFERENCE_PREFLIGHT_REQUIRED'});
          }
          const prepared=await prepareEffect(o,'inference',a);o=prepared.o;if(prepared.blocked)return blocked(o,prepared.blocked);intent=prepared.intent;
        }
        const outcome=await inference.generate({...intent,facts:facts(o),request:o.request,credit:{status:'confirmed',availableNanoUsd:treasury.snapshot().credits.availableNanoUsd}});
        o=await save(o,{generationOutcome:outcome});
        if(outcome.status!=='confirmed'){
          if(outcome.status==='failed'&&outcome.cost?.status==='actual'){const billed=await recordEffect(o,'consumption',outcome,{reservationId:intent.decision.plan?.reservation?.id,creditId:o.creditId});if(billed.blocked)return blocked(o,billed.blocked);o=await save(o,{costReconciled:true,...billed.patch});}
          else await recordReservation(o,'inference',outcome);
          const remedy=decide(o,'remedy',{}, {result:outcome});if(allowed(remedy)&&remedy.plan?.orderPatch){await save(o,remedy.plan.orderPatch);continue;}
          return blocked(o,{status:'hold',reasonCode:outcome.code??`INFERENCE_${outcome.status.toUpperCase()}`});
        }
        const recorded=await recordEffect(o,'consumption',outcome,{reservationId:intent.decision.plan?.reservation?.id,creditId:o.creditId});
        if(recorded.blocked)return blocked(o,recorded.blocked);
        if(recorded.patch&&Object.keys(recorded.patch).length){o=await save(o,recorded.patch);continue;}
        let candidate;
        try { candidate=research.candidate({order:o,evidencePack:o.evidencePack,generationResult:outcome,decision:o.researchDecision}); }
        catch(error) { candidate={artifact:null,reportFacts:{generated:false,sourceErrors:[{code:error.code??'INVALID_CANDIDATE'}]}}; }
        await save(o,{candidate:candidate.artifact,reportFacts:candidate.reportFacts,generationComplete:true,costReconciled:outcome.cost?.status==='actual',status:'reviewing'});continue;
      }
      if(type==='report') {
        const d=decide(o,'report');if(!allowed(d)){if(d.plan?.orderPatch){await save(o,{...d.plan.orderPatch,lastDecision:d});continue;}return blocked(o,d);}
        await save(o,{candidate:{...o.candidate,validation:{status:'accepted',acceptance:d.reportAcceptance,policyVersion:d.policyVersion}},reportAccepted:true,reportDecision:d,reportId:o.candidate.id,status:'delivering'});continue;
      }
      if(type==='deliver') {
        const d=decide(o,'deliver');if(!allowed(d))return blocked(o,d);
        const ref=await journal.putArtifact({actionId:`${id}:artifact`,content:JSON.stringify(o.candidate),mediaType:'application/json'});
        await save(o,{artifactRef:ref,reportAvailable:true,deliveryDecision:d,status:'paying_contributor'});continue;
      }
      if(type==='payout') {
        const obligation=treasury.snapshot().obligations.find(x=>x.orderId===id && x.status!=='paid');
        if(!obligation) { const done=treasury.snapshot().obligations.filter(x=>x.orderId===id);if(done.length&&done.every(x=>x.status==='paid')){await save(o,{payoutConfirmed:true});continue;}return blocked(o,{status:'hold',reasonCode:'OBLIGATION_FACTS_REQUIRED'}); }
        const a=action(o,'payout',{obligationId:obligation.id,network:obligation.money.network,recipient:obligation.recipient,money:obligation.money});
        let intent=persistedIntent(o,'payout');
        if(!intent){const prepared=await prepareEffect(o,'payout',a,{obligation});o=prepared.o;if(prepared.blocked)return blocked(o,prepared.blocked);intent=prepared.intent;}
        const outcome=await payouts.fulfill({...intent,facts:facts(o,{obligation}),obligation});
        o=await save(o,{payoutOutcome:outcome});
        if(outcome.status!=='confirmed')return blocked(o,{status:'hold',reasonCode:outcome.code??`PAYOUT_${outcome.status.toUpperCase()}`});
        await save(o,{payoutConfirmed:true,status:'reconciling',reasonCode:null});continue;
      }
      if(type==='refund') {
        let intent=persistedIntent(o,'refund');
        if(!intent) {
          const d=decide(o,'refund');if(!allowed(d))return blocked(o,d);
          const a=action(o,'refund',{network:d.money.network,recipient:d.recipient,money:d.money});
          const prepared=await prepareEffect(o,'refund',a);o=prepared.o;if(prepared.blocked)return blocked(o,prepared.blocked);intent=prepared.intent;
        }
        const outcome=await custody.transfer({...intent,facts:facts(o)});
        o=await save(o,{refundOutcome:outcome});
        if(outcome.status!=='confirmed')return blocked(o,{status:'hold',reasonCode:outcome.code??`REFUND_${outcome.status.toUpperCase()}`});
        const recorded=await recordEffect(o,'refund_record',outcome);if(recorded.blocked)return blocked(o,recorded.blocked);
        await save(o,{refundConfirmed:true,status:'refunded',reasonCode:o.reasonCode??'REFUNDED'});return {order:getOrder(id)};
      }
      if(type==='complete') {
        const d=decide(o,'complete');if(!allowed(d))return blocked(o,d);
        await save(o,{status:'complete',completedAt:now(),completionDecision:d,reasonCode:null});return {order:getOrder(id)};
      }
      return blocked(o,{status:'hold',reasonCode:`UNHANDLED_RULES_ACTION_${type??'missing'}`});
    }
    fail('CONFLICT','Workflow transition bound exceeded.');
  }
  async function getReport(id,context={}) {
    const o=raw(id),d=accessDecision(o,context.token,'report');
    if(!allowed(d))fail('ACCESS_DENIED',d.reasonCode);
    return JSON.parse(journal.getArtifact(o.artifactRef).content);
  }
  function status() {
    const s=rules.snapshot(), c=s.config, d=rules.evaluate({type:'offer',id:'storefront:offer',mode:s.mode},{financial:treasury.snapshot()});
    return {shopName:'Autonomous Research Shop',mode:s.mode,setupRequired:s.setupRequired===true,offer:{price:d.offer?.price,customerAssets:c?.customerAssets??[]},safety:{kill:s.safety.killSwitch,reasonCode:s.error??(s.safety.killSwitch?'KILL_SWITCH':null),policyVersion:s.policyVersion},strictGates:s.mode==='fixture'?['Demo payments and inference','Live funds require separate authorization']:['Autonomous Cloud credit purchase unsupported','Provider execution and proof must be independently verified'],researchMode:s.mode==='fixture'?'fixture or public read-only sources; deterministic inference':'public source retrieval and configured NEAR Cloud inference',activeOrders:journal.list('orders').filter(o=>!['complete','refunded'].includes(o.status)).length};
  }
  return {createOrder,getOrder,verifyAccess,getReport,status,quote:id=>serial(()=>quoteImpl(id)),checkPayment:id=>serial(()=>confirmImpl(id)),run:id=>serial(async()=>{await initialize();return runImpl(id);}),recover:()=>serial(async()=>{await initialize();const results=[];for(const o of journal.list('orders').filter(x=>!['complete','refunded'].includes(x.status)))results.push(await runImpl(o.id));return results;})};
}
