import {fingerprint,ContractError} from '../contracts.mjs';
import {createOperationRuntime,capability,result} from '../custody/adapter-runtime.mjs';
import {readExchange} from './http.mjs';
import {outlayerRequest,createOutlayerEvaluator} from './outlayer.mjs';
import {pingRequest,createPingPay} from './pingpay.mjs';
import {ownerIntentRequest,signedOwnerRequest,createOwnerSigning} from './owner-signing.mjs';
import {accountPlan,checkpointFeedPlan} from './accounts.mjs';
import {evaluateTemplateChange} from '../autonomy/evaluation.mjs';

const fail=(code,status=409)=>{throw Object.assign(new ContractError(code,code),{httpStatus:status});};
export function readIntegrationFacts({journal,companyId,authorization=null,bounds=[],resources=[],costs=[]}){
 return {companyId,plans:journal?.list('integrationPlans')??[],operations:journal?Object.values(journal.snapshot().operations):[],incidents:journal?.list('integrationIncidents')??[],authorization,bounds,resources,costs};
}
export function createNearIntegrations({journal,rules,treasury,providers,dispatchAuthorized,companyId,autonomy,clock=()=>new Date(),technical={},transport=fetch,verifyOutlayer,verifyPingSettlement}){
 const resources=new Map(),costs=new Map();
 const expires=()=>new Date(new Date(clock()).getTime()+30000).toISOString();
 let queue=Promise.resolve();const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const clients={outlayer:createOutlayerEvaluator({resolveSecret:providers.resolveSecret,transport,verifyExecution:verifyOutlayer}),pingpay:createPingPay({resolveSecret:providers.resolveSecret,transport,verifySettlement:verifyPingSettlement}),'near-agent-api':createOwnerSigning({resolveSecret:providers.resolveSecret,transport,clock})};
 const meta=capability('near-integrations','live','near-ecosystem',{verified:false});
 const runtime=createOperationRuntime({journal,namespace:'near-integrations',meta,dispatchAuthorized,binding:{companyId},clock});
 const requireAllow=d=>{if(d.status!=='allow')fail(d.reasonCode,d.reasonCode==='ACCESS_DENIED'?403:409);return d;};
 const view=access=>{const d=requireAllow(rules.evaluate({id:`integrations:${companyId}:view`,type:'integration_view'},{access}));return {...d.plan,plans:journal.list('integrationPlans').filter(p=>p.companyId===companyId).map(p=>({id:p.id,kind:p.kind,hash:p.hash,createdAt:p.createdAt,expiresAt:p.expiresAt,binding:p.binding,readiness:rules.evaluate({id:`${p.id}:review`,type:'integration_review',planId:p.id},{access,financial:treasury.snapshot()}).plan??{executionAllowed:false,reasonCode:'INTEGRATION_PLAN_REQUIRED'}})),runs:journal.list('integrationRuns').filter(r=>r.companyId===companyId).map(r=>({id:r.id,planId:r.planId,status:r.result.status,reasonCode:r.result.code??null,reportedCostNanoUsd:r.result.reportedCostNanoUsd??null,evidenceRef:r.evidenceRef,providerRequestId:r.result.providerRequestId??null})),prerequisites:{cloud:'SUPPORTED_DURABLE_PLAINTEXT_REQUIRED',ledger:'EXACT_NATIVE_FEE_AND_SIGNING_AUTHORITY_REQUIRED',outlayer:'PINNED_PROJECT_PAYMENT_RESOURCE_AND_PROOF_REQUIRED',pingpay:'MERCHANT_CONFIGURATION_AND_INDEPENDENT_SETTLEMENT_REQUIRED',owner:'PARTNER_CREDENTIAL_AND_EXACT_SIGNED_INTENT_REQUIRED'}};};
 function getPlan(id){const p=journal.get('integrationPlans',id);if(!p||p.companyId!==companyId)fail('NOT_FOUND',404);return p;}
 async function prepare(kind,input,access,key){
  view(access);if(typeof key!=='string'||!key||key.length>160)fail('IDEMPOTENCY_KEY_REQUIRED',400);
  const id=`integration:${companyId}:${fingerprint(key)}`,old=journal.get('integrationPlans',id),inputHash=fingerprint({kind,input});
  if(old){if(old.inputHash!==inputHash)fail('CONFLICT');return {plan:old,replayed:true,executionAllowed:false};}
  let request;
  if(kind==='outlayer_evaluate'){
   if(Object.keys(input).some(k=>k!=='improvementId'))fail('INVALID_INPUT',400);
   const d=requireAllow(rules.evaluate({id:id+':evaluation',type:'autonomy_evaluate'},{access,input}));
   request=outlayerRequest({...technical.outlayer,evaluationSpec:d.plan.evaluationSpec,jobId:id});
  }else if(kind.startsWith('pingpay_')){
   if(Object.keys(input).some(k=>!['amountOut','requirements','refundTo','quotePlanId','txHash','depositMemo','resourceId'].includes(k)))fail('INVALID_INPUT',400);
   let quote;
   if(kind==='pingpay_settle'){
    const prior=journal.list('integrationRuns').find(r=>r.planId===input.quotePlanId&&r.companyId===companyId&&r.result.quote);
    if(!prior||getPlan(prior.planId).binding.resourceId!==input.resourceId)fail('PINGPAY_ORIGINAL_QUOTE_REQUIRED');quote=prior.result.quote;
    if(Date.parse(quote.refundDeadline)<=new Date(clock()).getTime())fail('PINGPAY_QUOTE_EXPIRED');
   }
   request=pingRequest({...input,quote,kind,origin:technical.pingpay?.origin});
  }else if(kind==='owner_generate')request=ownerIntentRequest(input);
  else if(kind==='owner_submit'){
   if(Object.keys(input).some(k=>!['intentPlanId','signedData'].includes(k)))fail('INVALID_INPUT',400);
   const prior=journal.list('integrationRuns').find(r=>r.planId===input.intentPlanId&&r.companyId===companyId&&r.result.intent);
   if(!prior)fail('OWNER_ORIGINAL_INTENT_REQUIRED');request=signedOwnerRequest(prior.result.intent,input.signedData,new Date(clock()).getTime());
  }else fail('INTEGRATION_KIND_UNSUPPORTED');
  const binding=request.binding,createdAt=new Date(clock()).toISOString(),expiresAt=new Date(new Date(clock()).getTime()+300000).toISOString();
  const p={id,companyId,kind,inputHash,request,binding,createdAt,expiresAt};p.hash=fingerprint({kind,request,binding,inputHash});
  await journal.transaction({actionId:id,fingerprint:inputHash},tx=>{tx.put('integrationPlans',id,p,{expectedVersion:0});tx.append('integration.prepared',{companyId,kind,planId:id,requestHash:p.hash});return null;});
  return {plan:p,replayed:false,executionAllowed:false};
 }
 async function recordExchange(p,action,exchange){
  const artifact=await journal.putArtifact({actionId:`${action.id}:exchange:${exchange.wireHash}`,content:exchange.raw.toString('utf8'),mediaType:'application/json'});
  const record={id:action.id,companyId,planId:p.id,requestHash:p.hash,wireHash:exchange.wireHash,evidenceRef:`private:${artifact.id}`,httpStatus:exchange.httpStatus,ok:exchange.ok,raw:exchange.raw.toString('utf8')};
  await journal.transaction({actionId:`${action.id}:wire:${exchange.wireHash}`,fingerprint:fingerprint(record)},tx=>{tx.put('integrationExchanges',action.id,record);});
  return record.evidenceRef;
 }
 async function persist(p,action,outcome,exchange){
  let evidenceRef=null;
  if(exchange)evidenceRef=await recordExchange(p,action,exchange);
  const id=action.id;
  await journal.transaction({actionId:`integration-result:${id}:${fingerprint(outcome)}`,fingerprint:fingerprint(outcome)},tx=>{tx.put('integrationRuns',id,{id,companyId,planId:p.id,requestHash:p.hash,result:outcome,evidenceRef:evidenceRef??tx.get('integrationRuns',id)?.evidenceRef??null});if(outcome.code==='PROVIDER_COST_EXCEEDED')tx.put('integrationIncidents',id,{id,companyId,type:'provider_cost_bound_breach',operationId:id,evidenceRef});tx.append('integration.observed',{companyId,kind:p.kind,planId:p.id,operationId:id,status:outcome.status,reasonCode:outcome.code??null});return null;});
  return {...outcome,planId:p.id,evidenceRef};
 }
 async function execute({planId},access){
  view(access);const p=getPlan(planId),id=`${p.id}:execute`;
  const maxCostNanoUsd=p.request.maxCostNanoUsd??'0',action={id,type:'integration_execute',planId,requestHash:p.hash,maxCostNanoUsd};
  const old=runtime.read(action);if(old)return {status:old.result?.status??old.status,reasonCode:'ORIGINAL_OPERATION_RECONCILIATION_REQUIRED',operationId:id};
  const facts={access,financial:treasury.snapshot()},decision=requireAllow(rules.evaluate(action,facts));
  const client=clients[p.binding.provider];if(!client)fail('INTEGRATION_PROVIDER_UNAVAILABLE');
  // Resolve credentials before reserving, so missing credentials cause no held money.
  const prepared=await client.prepare(p.request);
  await treasury.applyDecision({actionId:id,decision});
  let exchange;
  const outcome=await runtime.execute({action,decision,facts,payload:p.request,prepare:async()=>prepared,send:async handle=>{
   exchange=await readExchange(await handle.start());
   // Preserve the exact accepted response before parsing/verification or a
   // workflow transition. Recovery can inspect it without resending an effect.
   await recordExchange(p,action,exchange);
   if(exchange.parseError)throw new ContractError(exchange.parseError,exchange.parseError);
   if(!exchange.ok&&p.binding.provider!=='pingpay')return result(meta,exchange.httpStatus>=500?'unknown':'failed',action,{code:'PROVIDER_HTTP_ERROR',cost:{status:'pending',actualCostNanoUsd:null}});
   const decoded=await client.decode(exchange,p.request);return result(meta,decoded.status,action,decoded);
  }});
  const observed=await persist(p,action,outcome,exchange);
  if(outcome.status==='not_submitted'){const d=rules.evaluate({id:`${id}:release`,type:'integration_release',operationId:id},{access,financial:treasury.snapshot()});if(d.status==='allow')await treasury.applyDecision({actionId:`${id}:release`,decision:d});}
  else if(['unknown','pending','failed'].includes(outcome.status)||outcome.cost?.status==='pending'){const d=rules.evaluate({id:`${id}:unresolved`,type:'integration_observed',operationId:id},{access,financial:treasury.snapshot()});if(d.status==='allow')await treasury.applyDecision({actionId:`${id}:unresolved`,decision:d});}
  return observed;
 }
 async function reconcile({planId},access){
  view(access);const p=getPlan(planId),action={id:`${p.id}:execute`,type:'integration_execute',planId,requestHash:p.hash,maxCostNanoUsd:p.request.maxCostNanoUsd??'0'},client=clients[p.binding.provider];
  let exchange;
  const outcome=await runtime.reconcile(action,async op=>{
   if(!op.result){const wire=journal.get('integrationExchanges',action.id);if(wire?.requestHash===p.hash){let value;try{value=JSON.parse(wire.raw);}catch{return result(meta,'unknown',action,{code:'PROVIDER_INVALID_JSON'});}return result(meta,'unknown',action,await client.decode({...wire,value},p.request));}}
   if(p.kind==='outlayer_evaluate'&&op.result?.providerRequestId){exchange=await client.observe(op.result.providerRequestId,p.request);return result(meta,'unknown',action,await client.decode(exchange,p.request));}
   if(p.kind==='owner_submit'){exchange=await client.observe(p.request.body.correlation_id);return result(meta,'unknown',action,await client.decode(exchange,p.request));}
   // Ping settlement retries reuse the exact original deposit token/tx, but do not
   // silently POST here after unknown. The owner reviews the original operation.
   return op.result??result(meta,'unknown',action,{code:'ORIGINAL_PROVIDER_OBSERVATION_REQUIRED'});
  });
  return persist(p,action,outcome,exchange);
 }
 return {view,prepare:(...args)=>serial(()=>prepare(...args)),execute:(...args)=>serial(()=>execute(...args)),reconcile:(...args)=>serial(()=>reconcile(...args)),
  facts:()=>({resources:[...resources.values()],costs:[...costs.values()],bounds:journal.list('integrationPlans').filter(p=>p.companyId===companyId&&p.kind==='outlayer_evaluate').map(p=>({source:'integration-cost-bound',requestHash:p.hash,kind:p.kind,bindingHash:fingerprint(p.binding),expiresAt:p.expiresAt,maxCostNanoUsd:p.request.maxCostNanoUsd}))}),
  probeResource:({planId},access)=>serial(async()=>{view(access);const p=getPlan(planId);if(p.kind!=='outlayer_evaluate')fail('PROVIDER_RESOURCE_READ_UNSUPPORTED');const e=await clients.outlayer.balance(p.request),evidenceRef=await recordExchange(p,{id:`${p.id}:resource:${e.wireHash}`},e),r={source:'provider-resource-observation',bindingHash:fingerprint(p.binding),resourceId:e.resourceId,availableNanoUsd:e.availableNanoUsd,expiresAt:expires(),evidenceRef};resources.set(p.id,r);return {resourceId:r.resourceId,availableNanoUsd:r.availableNanoUsd,expiresAt:r.expiresAt,evidenceRef,grantsSpendingAuthority:false};}),
  cost:({planId},access)=>serial(async()=>{view(access);const p=getPlan(planId),operationId=`${p.id}:execute`,r=treasury.snapshot().reservations.find(r=>r.actionId===operationId);if(['reconciled','released'].includes(r?.status))return {costReconciled:true,replayed:true};
   if(runtime.read({id:operationId})?.result?.status==='not_submitted'){const d=requireAllow(rules.evaluate({id:`${operationId}:release`,type:'integration_release',operationId},{access,financial:treasury.snapshot()}));await treasury.applyDecision({actionId:`${operationId}:release`,decision:d});return {reservationReleased:true};}
   if(p.kind==='outlayer_evaluate'){const op=runtime.read({id:operationId}),callId=op?.result?.providerRequestId;if(!callId)fail('ORIGINAL_CALL_ID_REQUIRED');const e=await clients.outlayer.observe(callId,p.request),v=e.value;if(!e.ok||v?.call_id!==callId||!['completed','failed'].includes(v.status)||!/^(0|[1-9]\d*)$/.test(v.compute_cost??''))fail('VERIFIED_INTEGRATION_COST_REQUIRED');const evidenceRef=await recordExchange(p,{id:`${operationId}:billing:${e.wireHash}`},e);costs.set(operationId,{source:'verified-provider-cost',operationId,requestHash:p.hash,bindingHash:fingerprint(p.binding),actualCostNanoUsd:(BigInt(v.compute_cost)*1000n).toString(),receiptId:`outlayer:${p.binding.networkId}:${callId}`,evidenceRef});}
   const d=requireAllow(rules.evaluate({id:`${operationId}:cost`,type:'integration_cost',operationId},{access,financial:treasury.snapshot()}));await treasury.applyDecision({actionId:`${operationId}:cost`,decision:d});for(const [key,observation]of resources)if(observation.resourceId===r?.providerResourceId)resources.delete(key);return {costReconciled:true};}),
  accountPlan:(input,access)=>{view(access);return accountPlan(input);},
  feedPlan:(input,access)=>{view(access);if(Object.keys(input).some(k=>k!=='destination'))fail('INVALID_INPUT',400);return checkpointFeedPlan({checkpoint:journal.list('ledgerChainCheckpoints').find(c=>c.companyId===companyId),binding:technical.ledgerBinding,destination:input.destination});},
  async verifyEvaluation({planId},access){
   view(access);const p=getPlan(planId);if(p.kind!=='outlayer_evaluate')fail('NOT_EVALUATION_PLAN');const run=journal.get('integrationRuns',`${p.id}:execute`);
   if(run?.result.status!=='confirmed'||!run.result.proof)fail('OUTLAYER_EXECUTION_PROOF_REQUIRED');
   const expected=evaluateTemplateChange(p.request.body.input.spec);let actual=run.result.output;if(typeof actual==='string')try{actual=JSON.parse(actual);}catch{fail('OUTLAYER_OUTPUT_INVALID');}
   if(fingerprint(expected)!==fingerprint(actual))fail('FIXED_EVALUATION_DIVERGED');
   // Remote output never manufactures a local pass. The actual fixed evaluator
   // remains mandatory; ordinary M01 promotion still performs current CAS checks.
   const observation={planId:p.id,requestHash:p.hash,evaluatorObservationHash:fingerprint(expected),executionProof:run.result.proof};
   await journal.transaction({actionId:`${p.id}:verified-evaluation`,fingerprint:fingerprint(observation)},tx=>{tx.put('remoteEvaluations',p.id,observation);tx.append('integration.evaluation_verified',{companyId,planId:p.id,observationHash:fingerprint(observation)});});
   if(!autonomy)return {...observation,promotion:null};
   const promotion=await autonomy.evaluate({improvementId:p.request.body.input.spec.improvementId},access,fingerprint(p.id),{expectedSpec:p.request.body.input.spec});
   return {...observation,promotion};
  },
 };
}
