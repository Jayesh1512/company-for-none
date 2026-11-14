import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {ContractError,fingerprint} from '../contracts.mjs';
import {DEMO_VERSION,profiles,documents as demoDocuments} from './demo.mjs';

// Actual source snapshots are ephemeral and bound to one Rules action. Never accept these
// through an HTTP/input/facts field. A fresh native JBrain read is required for each exposure.
const sourceCaches=new WeakMap();
const cacheFor=journal=>{let cache=sourceCaches.get(journal);if(!cache){cache=new Map();sourceCaches.set(journal,cache);}return cache;};
const digest=token=>createHash('sha256').update(token).digest('hex');
const fail=(code,status=409)=>{throw Object.assign(new ContractError(code,code),{httpStatus:status});};
const publicConversation=value=>value?Object.fromEntries(['id','companyId','serviceId','agentId','state','version','createdAt','updatedAt'].filter(k=>Object.hasOwn(value,k)).map(k=>[k,structuredClone(value[k])])):null;
const mode={replyMode:'policy_lookup',aiEnabled:false};
const namespaces=new Set(['supportServices','supportConversations','supportMessages','supportTickets']);

/** Private composition callback. The optional action binds the native-source cache to precisely
 * the action under evaluation. Only company-scoped durable state is returned. */
export function readSupportFacts({journal,companyId,action}={}){
 const map={services:'supportServices',conversations:'supportConversations',messages:'supportMessages',tickets:'supportTickets',agents:'agents',documents:'companyKnowledgeDocuments'};
 const cached=journal&&action?.id?sourceCaches.get(journal)?.get(action.id):null;
 return {companyId,...Object.fromEntries(Object.entries(map).map(([key,ns])=>[key,journal?.list(ns).filter(r=>r.companyId===companyId)??[]])),sources:cached?.sources?structuredClone(cached.sources):[],sourceActionId:cached? action.id:null};
}

/** Model-free orchestration. M01 owns publication, customer scope, source selection, reply
 * content and all journal plans. No provider, sale, claim, email or wallet port is present. */
export function createCustomerCare({journal,rules,workspace,knowledge,jbrainClient,companyId,clock=()=>new Date()}){
 if(!journal||!rules||typeof companyId!=='string')fail('SUPPORT_COMPOSITION_REQUIRED');
 let queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const action=(type,key=randomUUID(),conversationId)=>({id:`support:${companyId}:${type}:${fingerprint({key,conversationId:conversationId??null})}`,type,...conversationId?{conversationId}:{}});
 const keyRequired=key=>{if(typeof key!=='string'||!key.trim()||key.length>160)fail('IDEMPOTENCY_KEY_REQUIRED',400);};
 const check=decision=>{if(decision.status!=='allow')fail(decision.reasonCode,decision.reasonCode==='ACCESS_DENIED'?403:409);return decision.plan;};
 const evaluate=(a,access,input={})=>rules.evaluate(a,{access,input});
 const ownerPlan=access=>check(evaluate(action('support_owner'),access));
 function customer(id,token){
  const conversation=typeof id==='string'?journal.get('supportConversations',id):null;
  if(!conversation||conversation.companyId!==companyId||typeof token!=='string'||token.length<32||token.length>256||!/^[a-f0-9]{64}$/.test(conversation.tokenHash??''))fail('ACCESS_DENIED',403);
  const supplied=Buffer.from(digest(token),'hex'),expected=Buffer.from(conversation.tokenHash,'hex');
  if(!timingSafeEqual(supplied,expected))fail('ACCESS_DENIED',403);
  return {role:'support_customer',verified:true,companyId,conversationId:conversation.id,serviceId:conversation.serviceId};
 }
 const immutable=(a,input)=>fingerprint({action:a,input});
 function replay(a,input){
  const prior=journal.snapshot().commands[a.id];
  if(!prior)return null;
  if(prior.fingerprint!==immutable(a,input))fail('CONFLICT');
  return {...structuredClone(prior.result),replayed:true};
 }
 async function apply(a,access,input,identityInput=input,authenticate=()=>access){
  const old=replay(a,identityInput);if(old)return old;
  check(evaluate(a,authenticate(),input));
  const outcome=await journal.transaction({actionId:a.id,fingerprint:immutable(a,identityInput)},tx=>{
   const plan=check(evaluate(a,authenticate(),input));
   if(!Array.isArray(plan.puts)||plan.grantsSpendingAuthority!==false||plan.providerCalled!==false)fail('INVALID_SUPPORT_PLAN');
   for(const put of plan.puts){
    if(!namespaces.has(put.namespace)||put.value?.companyId!==companyId)fail('INVALID_SUPPORT_PLAN');
    tx.put(put.namespace,put.id,put.value,{expectedVersion:put.expectedVersion===null?0:put.expectedVersion});
   }
   for(const event of plan.events??[])tx.append(event.type,event.data);
   return {conversation:publicConversation(plan.conversation),reply:plan.reply??null,ticket:plan.ticket??null,service:plan.service??null};
  });
  return {...outcome.result,replayed:outcome.replayed};
 }
 async function sourceSnapshots(bindings,read,maxChars=24000){
  const sources=[];
  for(const binding of bindings){
   const value=await read(binding.documentId);
   if(!value||value.id!==binding.documentId||typeof value.markdown!=='string'||value.markdown.length>maxChars||typeof value.revision!=='string')fail('SUPPORT_SOURCE_UNAVAILABLE');
   const meta=journal.get('companyKnowledgeDocuments',value.id);
   sources.push({documentId:value.id,title:meta?.title??'',revision:value.revision,hash:fingerprint(value.markdown),markdown:value.markdown});
  }
  return sources;
 }
 async function customerSources(id,access,target){
  const plan=check(evaluate(action('support_context',randomUUID(),id),access,{}));
  if(!jbrainClient)fail('JBRAIN_UNAVAILABLE',503);
  const sources=await sourceSnapshots(plan.sources,bindingId=>jbrainClient.read(bindingId),plan.maxSourceChars);
  cacheFor(journal).set(target.id,{sources});
 }
 async function viewNow(id,token){
  const access=customer(id,token),a=action('support_view',randomUUID(),id);
  // A missing/revoked source is not permission to replay a formerly public passage.
  // Rules still permits the customer's own transcript and redacts stale assistant text.
  try{await customerSources(id,access,a);}catch{/* M01 projects a redacted transcript without sources. */}
  try{const plan=check(evaluate(a,access,{}));return {conversation:publicConversation(plan.conversation),messages:plan.messages??[],tickets:plan.tickets??[],...mode};}
  finally{cacheFor(journal).delete(a.id);}
 }
 async function publishNow(input,access,key){
  keyRequired(key);ownerPlan(access);
  const a=action('support_publish',key),old=replay(a,input);if(old)return {...old,...mode};
  if(!Array.isArray(input?.sources)||input.sources.length>4)fail('INVALID_INPUT',400);
  // This owner operation uses the actual owner knowledge API. Customer paths use only
  // the private native client after support_context; they never fabricate owner identity.
  const sources=await sourceSnapshots(input.sources,async id=>(await knowledge.read(id,access)).document);
  cacheFor(journal).set(a.id,{sources});
  try{return {...await apply(a,access,input),...mode};}finally{cacheFor(journal).delete(a.id);}
 }
 const api={
  catalog(){const plan=check(evaluate(action('support_catalog'),null,{}));return {services:plan.services??[],...mode};},
  open(input,key){return serial(async()=>{
   keyRequired(key);if(!input||Object.keys(input).some(k=>k!=='serviceId'))fail('INVALID_INPUT',400);
   const a=action('support_open',key),old=replay(a,input);
   if(old)return {conversation:old.conversation,accessToken:null,replayed:true,...mode};
   const accessToken=randomBytes(32).toString('base64url'),conversationId=randomUUID();
   const result=await apply(a,null,{serviceId:input.serviceId,conversationId,tokenHash:digest(accessToken)},input);
   return {conversation:result.conversation,accessToken:result.replayed?null:accessToken,replayed:result.replayed,...mode};
  });},
  view:(id,token)=>serial(()=>viewNow(id,token)),
  message(id,input,token,key){return serial(async()=>{
   keyRequired(key);const access=customer(id,token),a=action('support_reply',key,id),old=replay(a,input);
   if(old){const current=await viewNow(id,token);return {conversation:current.conversation,reply:current.messages.find(m=>m.id===old.reply?.id)??null,ticket:current.tickets.find(t=>t.id===old.ticket?.id)??null,replayed:true,...mode};}
   try{await customerSources(id,access,a);return {...await apply(a,access,input,input,()=>customer(id,token)),...mode};}finally{cacheFor(journal).delete(a.id);}
  });},
  escalate(id,input,token,key){return serial(async()=>{
   keyRequired(key);const access=customer(id,token),a=action('support_escalate',key,id);
   return {...await apply(a,access,input,input,()=>customer(id,token)),...mode};
  });},
  ownerView(access){const plan=ownerPlan(access);return {services:plan.services??[],conversations:plan.conversations??[],messages:plan.messages??[],tickets:plan.tickets??[],...mode};},
  publish:(input,access,key)=>serial(()=>publishNow(input,access,key)),
  setupDemo(access,key){return serial(async()=>{
   keyRequired(key);ownerPlan(access);
   if(!workspace||!knowledge)fail('SUPPORT_COMPOSITION_REQUIRED');
   const agents=[];
   for(const {key:profileKey,...profile} of profiles){
    const created=await workspace.create({...profile,actionId:`${companyId}:${DEMO_VERSION}:${profileKey}`},access);agents.push(created.agent);
   }
   const documents=[],originalRevisions=new Map(),publicationRequired=[];
   for(const {key:documentKey,title,body} of demoDocuments){
    const saved=await knowledge.save({title,body,visibility:'company',agentIds:agents.map(a=>a.id)},{requestId:`support:${DEMO_VERSION}:${documentKey}`,access});
    originalRevisions.set(saved.document.id,saved.document.revision);
    // A replayed owner write returns its original receipt. Respect any later user edit.
    documents.push(journal.get('companyKnowledgeDocuments',saved.document.id));
   }
   for(const [index,profile] of profiles.entries()){
    const serviceId=`support:${companyId}:${profile.key}`;
    if(journal.get('supportServices',serviceId))continue; // Explicit rerun never republishes edits/revocations.
    const selected=index===0?documents.filter((_,i)=>i<3):documents;
    const sources=await sourceSnapshots(selected.map(d=>({documentId:d.id})),async id=>(await knowledge.read(id,access)).document);
    const changed=selected.filter(d=>d.revision!==originalRevisions.get(d.id)||sources.find(s=>s.documentId===d.id)?.revision!==originalRevisions.get(d.id));
    if(changed.length){
     publicationRequired.push({serviceId,reasonCode:'SUPPORT_DEMO_SOURCE_CHANGED',documentIds:changed.map(d=>d.id)});
     continue; // A repeated setup is not approval to publish intervening owner edits.
    }
    await publishNow({serviceId,version:0,agentId:agents[index].id,name:profile.name,description:profile.description,kind:index===0?'policy':'claims',fictional:true,sources:sources.map(({documentId,revision,hash})=>({documentId,revision,hash}))},access,`${DEMO_VERSION}:${profile.key}:publish`);
   }
   return {...api.ownerView(access),agents,documents,publicationRequired,fictional:true};
  });},
 };
 return api;
}
