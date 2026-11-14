import {randomUUID} from 'node:crypto';
import {fingerprint,ContractError} from '../contracts.mjs';
import {createCloudReadClient,correlateUsage} from '../cloud/read-only.mjs';
import {createCloudProductAdapter} from '../cloud/index.mjs';
import {cloudTechnicalFacts,validateRerankOutput,responseEvidence} from '../cloud/technical-facts.mjs';

export function createNearCloudProducts({journal,rules,knowledge,providers,companyId,clock=()=>new Date(),transport,dispatchAuthorized,reportingOrganizationId,reportingSecretRef,allowDeprecatedReporting=false}){
 const reads=createCloudReadClient({transport,resolveSecret:providers.resolveSecret,organizationId:reportingOrganizationId,reportingSecretRef,inferenceSecretRef:providers.cloudSecretRef,allowDeprecatedReporting,clock});
 const reportingScope=fingerprint({companyId,organizationId:reportingOrganizationId??null,credentialRef:reportingSecretRef??null});
 const adapter=createCloudProductAdapter({journal,mode:rules.snapshot().mode,clock,transport,dispatchAuthorized,resolveSecret:providers.resolveSecret,secretRef:providers.cloudSecretRef});
 const decide=(type,access,extra={})=>{
  const d=rules.evaluate({id:`${type}:${randomUUID()}`,type},{access,...extra});
  if(d.status!=='allow')throw new ContractError(d.reasonCode==='ACCESS_DENIED'?'ACCESS_DENIED':'POLICY_BLOCK',d.reasonCode);
  return d;
 };
 async function evidence(kind,result){const ref=await journal.putArtifact({actionId:`cloud-read:${kind}:${randomUUID()}`,content:JSON.stringify(result),mediaType:'application/json'});return `private:${ref.id}`;}
 function workIds(){
  const all=[...journal.list('internalResults').map(r=>({workId:r.workId,agentId:journal.get('agentWork',r.workId)?.actorId,effectId:r.effectId,result:r.result})),...journal.list('orders').map(o=>({orderId:o.id,agentId:o.agentContext?.id,result:o.generationOutcome})),...journal.list('componentResults').map(r=>({componentId:r.actionId,result:r.result}))];
  const values=new Map();for(const w of all){const r=w.result??{},inferenceId=r.inferenceId??r.generation?.inferenceId,providerRequestId=r.providerRequestId??r.generation?.providerRequestId;if(!inferenceId&&!providerRequestId)continue;const {result,...ids}=w,item={...ids,inferenceId:inferenceId??null,providerRequestId:providerRequestId??null};values.set(fingerprint(item),item);}return [...values.values()];
 }
 // Observed public provider facts handed to M01 as inputs. They never become money, caps or authority here.
 const pricing=()=>{const m=journal.get('cloudCatalog','latest'),v=journal.get('cloudServices','latest');return {models:m?.models??[],services:v?.services??[],observedAt:[m?.observedAt,v?.observedAt].every(Boolean)?[m.observedAt,v.observedAt].sort()[0]:null,catalogComplete:m?.complete===true&&v?.complete===true};};
 const facts=request=>{try{return cloudTechnicalFacts(request);}catch{return null;}}; // M01 still owns rejecting invalid requests
 const rankRequest=(input,snapshot)=>({product:'rerank',input:{model:input.model,query:input.query,documents:snapshot.documents.map(d=>d.markdown)},timeoutMs:30000,maxInputBytes:65536,maxResponseBytes:2097152});
 const api={
  view(access){const d=decide('cloud_products_view',access);const saved=journal.get('cloudCatalog','latest');return {...d.plan,catalog:saved?{observedAt:saved.observedAt,models:saved.models,issues:saved.issues,complete:saved.complete}:null,reporting:{...d.plan.reporting,configured:!!reportingOrganizationId&&!!reportingSecretRef,enabled:allowDeprecatedReporting,readOnly:true},usage:journal.get('cloudUsage',reportingScope)?.view??null};},
  async catalog(access){decide('cloud_catalog',access);const result=await reads.catalog();decide('cloud_catalog',access);const {raw,...view}=result,ref=await evidence('catalog',result);await journal.transaction({actionId:`cloud-catalog:${fingerprint({view,ref})}`,fingerprint:fingerprint(view)},tx=>{tx.put('cloudCatalog','latest',{...view,evidenceRef:ref});return null;});return view;},
  technicalFacts(request,access){decide('cloud_product_plan',access,{request});return cloudTechnicalFacts(request);},
  plan(request,access){return {...decide('cloud_product_plan',access,{request,pricing:pricing(),technicalFacts:facts(request)}).plan,technicalFacts:facts(request)};},
  async services(access){decide('cloud_catalog',access);const result=await reads.services();decide('cloud_catalog',access);const {raw,...view}=result,ref=await evidence('services',result);await journal.transaction({actionId:`cloud-services:${fingerprint({view,ref})}`,fingerprint:fingerprint(view)},tx=>{tx.put('cloudServices','latest',{...view,evidenceRef:ref});return null;});return view;},
  async execute(request,access,key){
   decide('cloud_products_view',access);if(typeof key!=='string'||!key||key.length>160)throw new ContractError('INVALID_INPUT','A stable Idempotency-Key is required.');
   const action={id:`cloud-product:${companyId}:${key}`,type:'cloud_product_execute',requestFingerprint:fingerprint(request)};
   const d=rules.evaluate(action,{access,request,pricing:pricing(),technicalFacts:facts(request)});
   if(d.status!=='allow')return {status:'not_submitted',code:d.reasonCode,plan:d.plan,completionSent:false,grantsSpendingAuthority:false};
   // M01 currently holds every new specialized route. This port cannot bypass it.
   return adapter.execute({action,decision:d,facts:{access,request},request});
  },
  async rankKnowledge(input,access){
   decide('cloud_products_view',access);
   if(!input||Object.keys(input).some(k=>!['agentId','knowledgeIds','query','model'].includes(k))||typeof input.agentId!=='string'||typeof input.query!=='string'||!input.query.trim()||!Array.isArray(input.knowledgeIds)||!input.knowledgeIds.length)throw new ContractError('INVALID_INPUT','Select an agent, permitted documents, query and reranker model.');
   const snapshot=await knowledge.previewContext(input.agentId,input.knowledgeIds,access);knowledge.assertPreviewSnapshot(snapshot,access);
   const request=rankRequest(input,snapshot);
   const plan=api.plan(request,access);
   return {plan,documentRevisions:snapshot.documents.map(d=>({id:d.id,revision:d.revision})),contextHash:fingerprint(snapshot),providerCalled:false,accepted:false};
  },
  // Bind a provider rerank result to the CURRENT grants/revisions and the exact planned request. Advisory ordering only.
  async bindRanking(input,access){
   decide('cloud_products_view',access);
   if(!input||Object.keys(input).some(k=>!['agentId','knowledgeIds','query','model','requestFingerprint','documentRevisions','output'].includes(k))||typeof input.agentId!=='string'||typeof input.query!=='string'||!Array.isArray(input.knowledgeIds)||!input.knowledgeIds.length||typeof input.requestFingerprint!=='string'||!Array.isArray(input.documentRevisions))throw new ContractError('INVALID_INPUT','Provide the planned selection, request fingerprint, document revisions and provider output.');
   const snapshot=await knowledge.previewContext(input.agentId,input.knowledgeIds,access);knowledge.assertPreviewSnapshot(snapshot,access);
   const request=rankRequest(input,snapshot),current=snapshot.documents.map(d=>({id:d.id,revision:d.revision}));
   if(fingerprint(request)!==input.requestFingerprint||fingerprint(current)!==fingerprint(input.documentRevisions))throw new ContractError('STALE_KNOWLEDGE_CONTEXT','Documents, grants or revisions changed after the planned request. Plan again.');
   const ranked=validateRerankOutput(input.output,request);if(!ranked)throw new ContractError('PROVIDER_OUTPUT_SCHEMA_INVALID','Provider output does not match the exact planned documents.');
   return {rankings:ranked.map((r,i)=>({rank:i+1,id:snapshot.documents[r.index].id,revision:snapshot.documents[r.index].revision,score:r.score})),requestFingerprint:input.requestFingerprint,advisoryOnly:true,accepted:false,providerCalled:false,proof:responseEvidence({product:'rerank',requestBytes:Buffer.alloc(0),responseBytes:Buffer.alloc(0)}).proof};
  },
  // Provider-reported actual cost for exact original inference-id header values. Never accounting, never free when zero/absent.
  async billingCosts(input,access){decide('cloud_usage',access);const result=await reads.billingCosts(input);decide('cloud_usage',access);const {raw,...body}=result,view={...body,costs:correlateUsage(body.costs.map(c=>({...c,providerRequestId:null})),workIds())},ref=await evidence('billing-costs',{...result,costs:view.costs});return {...view,evidenceRef:ref};},
  async usage(input,access){decide('cloud_usage',access);
   const windowHash=fingerprint({startTime:input?.startTime,endTime:input?.endTime});
   if(input?.cursor&&journal.get('cloudUsageCursors',fingerprint({reportingScope,cursor:input.cursor}))?.windowHash!==windowHash)throw new ContractError('INVALID_INPUT','Reuse the returned cursor with its original reporting organization and interval.');
   const result=await reads.usage(input);decide('cloud_usage',access);const {raw,...body}=result,view={...body,rows:correlateUsage(body.rows,workIds())},ref=await evidence('usage',{...result,rows:view.rows});await journal.transaction({actionId:`cloud-usage:${fingerprint({view,ref})}`,fingerprint:fingerprint(view)},tx=>{tx.put('cloudUsage',reportingScope,{view,evidenceRef:ref});if(body.nextCursor)tx.put('cloudUsageCursors',fingerprint({reportingScope,cursor:body.nextCursor}),{windowHash});return null;});return view;},
  async summary(input,access){decide('cloud_usage',access);const result=await reads.summary(input);decide('cloud_usage',access);const {raw,...view}=result;await evidence('summary',result);return view;},
  usageForWork(access){decide('cloud_usage',access);return {rows:correlateUsage(journal.get('cloudUsage',reportingScope)?.view?.rows??[],workIds()),accountingApplied:false};},
 };
 return api;
}
