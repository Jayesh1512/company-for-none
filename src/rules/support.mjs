import {hash,freeze} from './config.mjs';
import {allow,deny,hold} from './policies.mjs';
import {ownerAccess} from './runtime.mjs';

export const SUPPORT_LIMITS=freeze({maxServices:20,maxSources:4,maxSourceChars:24000,maxConversations:100,maxTurns:50,maxTickets:20,maxQuestionChars:2000,maxSummaryChars:2000,maxExcerpts:3,maxExcerptChars:1200,maxNameChars:120,maxDescriptionChars:600});
export const SUPPORT_ACTIONS=Object.freeze(['support_catalog','support_publish','support_open','support_context','support_view','support_reply','support_escalate','support_owner']);
const CONVERSATION_ACTIONS=new Set(['support_context','support_view','support_reply','support_escalate']);
const MUTATIONS=new Set(['support_publish','support_open','support_reply','support_escalate']);
const text=(v,max)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(v,allowed,required=allowed)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const fields=(v,keys)=>Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,structuredClone(v[k])]));
const at=ctx=>new Date(ctx.now).toISOString();
const put=(namespace,value,old=null)=>({namespace,id:value.id,value,expectedVersion:old?.version??null});
const event=(action,ctx,type,data={})=>({type,data:{companyId:ctx.companyId,actorId:type==='support.published'?'owner':'support_customer',causationId:action.id,...data}});
const plan=(action,extra={})=>({kind:action.type,puts:[],events:[],replyMode:'policy_lookup',aiEnabled:false,fictional:true,providerCalled:false,grantsSpendingAuthority:false,...extra});
const record=(id,ctx,data)=>({id,companyId:ctx.companyId,version:1,createdAt:at(ctx),updatedAt:at(ctx),...data});
const servicePublic=s=>fields(s,['id','companyId','agentId','name','description','kind','replyMode','aiEnabled','fictional','status','version']);
const conversationPublic=c=>fields(c,['id','companyId','serviceId','agentId','state','version','createdAt','updatedAt']);
const ticketPublic=t=>fields(t,['id','companyId','conversationId','serviceId','agentId','summary','reasonCode','state','createdAt','updatedAt']);
const messagePublic=m=>fields(m,['id','companyId','conversationId','role','text','citations','replyMode','fictional','reasonCode','createdAt']);
const STALE_NOTICE='The published policy source is no longer current or available. Its earlier excerpt is hidden. You can request an owner review of this conversation.';
const DISCLAIMER='Fictional insurance policy lookup. These are source excerpts, not an AI-generated answer or a claim, coverage, legal or medical decision.';

function dataValid(data,companyId){
 if(!data||!text(companyId,80))return false;
 return ['services','conversations','messages','tickets','agents','documents'].every(k=>Array.isArray(data[k])&&data[k].every(r=>r?.companyId===companyId));
}
function publication(service,ctx){
 if(ctx.config?.killSwitch||!service||service.companyId!==ctx.companyId||service.status!=='published'||service.fictional!==true||service.replyMode!=='policy_lookup'||service.aiEnabled!==false)return false;
 const agent=ctx.data.agents.find(a=>a.id===service.agentId);
 if(!agent||agent.status!=='ready')return false;
 if(!Array.isArray(service.sources)||!service.sources.length||service.sources.length>SUPPORT_LIMITS.maxSources||new Set(service.sources.map(s=>s.documentId)).size!==service.sources.length)return false;
 return service.sources.every(b=>{
  const d=ctx.data.documents.find(d=>d.id===b.documentId);
  return exact(b,['documentId','revision','hash'])&&d&&d.id.startsWith(`companies/${ctx.companyId}/documents/`)&&d.visibility==='company'&&Array.isArray(d.agentIds)&&d.agentIds.includes(agent.id)&&d.revision===b.revision&&text(b.revision,256)&&digest(b.hash);
 });
}
function currentSources(action,service,ctx){
 if(!publication(service,ctx)||ctx.data.sourceActionId!==action.id||!Array.isArray(ctx.data.sources)||ctx.data.sources.length!==service.sources.length)return null;
 const result=[];
 for(const b of service.sources){
  const matches=ctx.data.sources.filter(s=>s.documentId===b.documentId),s=matches[0],meta=ctx.data.documents.find(d=>d.id===b.documentId);
  if(matches.length!==1||!exact(s,['documentId','title','revision','hash','markdown'])||!text(s.title,160)||s.title!==meta.title||s.revision!==b.revision||s.hash!==b.hash||!text(s.markdown,SUPPORT_LIMITS.maxSourceChars)||hash(s.markdown)!==b.hash)return null;
  result.push(s);
 }
 return result;
}
function customer(action,access,ctx){
 const c=ctx.data.conversations.find(c=>c.id===action.conversationId);
 if(!c||access?.role!=='support_customer'||access.verified!==true||access.companyId!==ctx.companyId||access.conversationId!==c.id||access.serviceId!==c.serviceId||c.companyId!==ctx.companyId)return null;
 return c;
}
function ticket(action,ctx,c,summary,reasonCode){return record(`${action.id}:ticket`,ctx,{conversationId:c.id,serviceId:c.serviceId,agentId:c.agentId,summary,reasonCode,state:'open'});}
function transcript(action,ctx,c){
 const s=ctx.data.services.find(s=>s.id===c.serviceId),sources=s?.agentId===c.agentId?currentSources(action,s,ctx):null,messages=ctx.data.messages.filter(m=>m.conversationId===c.id).map(m=>{
  const v=messagePublic(m);
  if(m.role==='assistant'&&Array.isArray(m.citations)&&m.citations.length){
   const valid=sources&&m.citations.every(cite=>sources.some(s=>s.documentId===cite.documentId&&s.revision===cite.revision&&s.hash===cite.hash&&text(cite.excerpt,SUPPORT_LIMITS.maxExcerptChars)&&s.markdown.includes(cite.excerpt)));
   if(!valid)return {...v,text:STALE_NOTICE,citations:[],reasonCode:'SUPPORT_PUBLICATION_STALE'};
  }
  return v;
 });
 return plan(action,{conversation:conversationPublic(c),messages,tickets:ctx.data.tickets.filter(t=>t.conversationId===c.id).map(ticketPublic),publicationCurrent:!!sources});
}

// Selection is local and deterministic. Company text remains inert; no tool/model,
// claim adjudicator or policy interpreter is invoked. Each excerpt is an exact substring.
const stop=new Set('a an and are as at be by can could do does for from have how i in insurance is it me my of on or our please policies policy should tell that the their there these they this to us was what when where which who why will with would you your'.split(' '));
const normalize=s=>s.toLowerCase().normalize('NFKC');
const alias={car:'auto',cars:'auto',vehicle:'auto',vehicles:'auto',automobile:'auto',house:'home',household:'home',deductibles:'deductible',claims:'claim',documents:'document',required:'require',requirements:'require',deadline:'report',reporting:'report',notify:'report',notification:'report',submit:'report',filing:'report',documentation:'document',cancelled:'cancellation',cancel:'cancellation',canceled:'cancellation'};
const tokens=s=>[...new Set((normalize(s).match(/[\p{L}\p{N}]{2,}/gu)??[]).map(t=>alias[t]??t).filter(t=>!stop.has(t)))];
function sections(source){
 const body=source.markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,''),out=[];
 let start=0,name='Policy information';
 const append=end=>{const excerpt=body.slice(start,end).trim();if(excerpt)out.push({source,section:name,body:excerpt});};
 for(const heading of body.matchAll(/^#{1,6}[ \t]+([^\r\n]+?)[ \t]*#*[ \t]*\r?$/gm)){
  append(heading.index);name=heading[1].trim().slice(0,160);start=heading.index+heading[0].length;
 }
 append(body.length);return out;
}

function lookup(question,sources){
 const q=normalize(question);
 if(/\b(approv\w*|adjudicat\w*|reimburse\w*|payout|eligib\w*|pay\s+(?:for\s+)?(?:my|this)|(?:file|submit|settle|accept)\s+(?:my|this)\s+claim|decide\s+(?:my|this))\b/.test(q)||/\b(is|will|can|would|does|am)\b.{0,70}\b(my|this|i)\b.{0,70}\b(covered|cover|eligible|entitled|qualify|claim\s+(approved|paid))\b/.test(q)||/\b(legal\s+advice|medical\s+advice|diagnos\w*)\b/.test(q))return {reasonCode:'SUPPORT_CLAIM_DECISION_ESCALATED',citations:[]};
 const wanted=tokens(question),specific=wanted.filter(t=>!['auto','home','travel','claim','coverage','cover','covered','guide','fictional','information'].includes(t)),categories=wanted.filter(t=>['auto','home','travel'].includes(t));
 const scored=sources.flatMap(sections).map(s=>{
  const heading=tokens(`${s.source.title} ${s.section}`),body=tokens(s.body),sourceCategories=tokens(s.source.title).filter(t=>['auto','home','travel'].includes(t));
  if(categories.length&&sourceCategories.length&&!categories.some(t=>sourceCategories.includes(t)))return {...s,score:0};
  if(specific.length&&!specific.some(t=>heading.includes(t)||body.includes(t)))return {...s,score:0};
  const score=wanted.reduce((n,t)=>n+(heading.includes(t)?3:body.includes(t)?1:0),0);return {...s,score};
 }).filter(s=>s.score>0).sort((a,b)=>b.score-a.score||a.source.documentId.localeCompare(b.source.documentId)||a.section.localeCompare(b.section));
 if(!scored.length)return {reasonCode:'SUPPORT_NO_MATCH_ESCALATED',citations:[]};
 const selected=scored.filter(s=>s.score>=Math.max(1,Math.ceil(scored[0].score*0.6))).slice(0,SUPPORT_LIMITS.maxExcerpts);
 return {reasonCode:'SUPPORT_POLICY_EXCERPTS',citations:selected.map(s=>({documentId:s.source.documentId,title:s.source.title,revision:s.source.revision,hash:s.source.hash,section:s.section,excerpt:s.body.slice(0,SUPPORT_LIMITS.maxExcerptChars)}))};
}

export function supportDecision(action,facts,ctx){
 if(!SUPPORT_ACTIONS.includes(action.type))return deny('UNKNOWN_SUPPORT_ACTION');
 if(!exact(action,['id','type','conversationId'],['id','type'])||action.conversationId!==undefined&&!text(action.conversationId,300))return deny('SUPPORT_INPUT_INVALID');
 if(CONVERSATION_ACTIONS.has(action.type)!==(action.conversationId!==undefined))return deny('SUPPORT_INPUT_INVALID');
 if(!dataValid(ctx.data,ctx.companyId))return hold('SUPPORT_FACTS_REQUIRED');
 const {data}=ctx,input=facts.input??{},owner=ownerAccess(facts.access,ctx.companyId,ctx.config?.mode??'setup');
 if(['support_catalog','support_owner'].includes(action.type)&&!exact(input,[]))return deny('SUPPORT_INPUT_INVALID');
 if(['support_publish','support_owner'].includes(action.type)&&!owner)return deny('ACCESS_DENIED');
 if(MUTATIONS.has(action.type)&&ctx.config?.killSwitch)return deny('KILL_SWITCH');
 if(action.type==='support_catalog')return allow({plan:plan(action,{services:data.services.filter(s=>publication(s,ctx)).map(servicePublic)})});
 if(action.type==='support_owner')return allow({plan:plan(action,{services:data.services.map(s=>({...servicePublic(s),sources:structuredClone(s.sources),publicationCurrent:publication(s,ctx)})),conversations:data.conversations.map(conversationPublic),messages:data.messages.map(messagePublic),tickets:data.tickets.map(ticketPublic),limits:SUPPORT_LIMITS})});
 if(action.type==='support_publish'){
  if(!exact(input,['serviceId','version','agentId','name','description','kind','fictional','sources'])||!text(input.serviceId,160)||!text(input.agentId,200)||!text(input.name,SUPPORT_LIMITS.maxNameChars)||!text(input.description,SUPPORT_LIMITS.maxDescriptionChars)||!['policy','claims'].includes(input.kind)||input.fictional!==true||!Number.isSafeInteger(input.version)||input.version<0)return deny('SUPPORT_INPUT_INVALID');
  const old=data.services.find(s=>s.id===input.serviceId);if((old?.version??0)!==input.version)return deny('SUPPORT_VERSION_CONFLICT');
  if(!old&&data.services.length>=SUPPORT_LIMITS.maxServices)return hold('SUPPORT_SERVICE_LIMIT');
  const value=record(input.serviceId,ctx,{agentId:input.agentId,name:input.name.trim(),description:input.description.trim(),kind:input.kind,replyMode:'policy_lookup',aiEnabled:false,fictional:true,status:'published',sources:structuredClone(input.sources),version:input.version+1,createdAt:old?.createdAt??at(ctx)});
  if(!publication(value,ctx)||!currentSources(action,value,ctx))return hold('SUPPORT_PUBLICATION_STALE');
  return allow({plan:plan(action,{puts:[put('supportServices',value,old)],events:[event(action,ctx,'support.published',{serviceId:value.id,agentId:value.agentId})],service:servicePublic(value)})});
 }
 if(action.type==='support_open'){
  if(!exact(input,['serviceId','conversationId','tokenHash'])||!text(input.serviceId,160)||!text(input.conversationId,300)||!digest(input.tokenHash))return deny('SUPPORT_INPUT_INVALID');
  const s=data.services.find(s=>s.id===input.serviceId);if(!publication(s,ctx))return hold('SUPPORT_PUBLICATION_STALE');
  if(data.conversations.some(c=>c.id===input.conversationId))return deny('SUPPORT_CONVERSATION_EXISTS');
  if(data.conversations.length>=SUPPORT_LIMITS.maxConversations)return hold('SUPPORT_CONVERSATION_LIMIT');
  const c=record(input.conversationId,ctx,{serviceId:s.id,agentId:s.agentId,tokenHash:input.tokenHash,state:'open'});
  return allow({plan:plan(action,{puts:[put('supportConversations',c)],events:[event(action,ctx,'support.opened',{conversationId:c.id,serviceId:s.id})],conversation:conversationPublic(c)})});
 }
 const c=customer(action,facts.access,ctx);if(!c)return deny('ACCESS_DENIED');
 if(action.type==='support_view')return exact(input,[])?allow({plan:transcript(action,ctx,c)}):deny('SUPPORT_INPUT_INVALID');
 if(action.type==='support_escalate'){
  if(!exact(input,['summary'],[])||input.summary!==undefined&&!text(input.summary,SUPPORT_LIMITS.maxSummaryChars))return deny('SUPPORT_INPUT_INVALID');
  if(data.tickets.filter(t=>t.conversationId===c.id).length>=SUPPORT_LIMITS.maxTickets)return hold('SUPPORT_TICKET_LIMIT');
  const t=ticket(action,ctx,c,input.summary?.trim()??'Customer requested an owner review.','SUPPORT_OWNER_REVIEW_REQUESTED'),next={...c,state:'escalated',version:c.version+1,updatedAt:at(ctx)};
  if(data.tickets.some(t=>t.id===`${action.id}:ticket`))return deny('SUPPORT_TURN_EXISTS');
  return allow({plan:plan(action,{puts:[put('supportTickets',t),put('supportConversations',next,c)],events:[event(action,ctx,'support.escalated',{conversationId:c.id,ticketId:t.id,reasonCode:t.reasonCode})],conversation:conversationPublic(next),ticket:ticketPublic(t)})});
 }
 const service=data.services.find(s=>s.id===c.serviceId);
 if(!publication(service,ctx)||service.agentId!==c.agentId)return hold('SUPPORT_PUBLICATION_STALE');
 if(action.type==='support_context')return exact(input,[])?allow({plan:plan(action,{serviceId:service.id,agentId:service.agentId,sources:structuredClone(service.sources),maxSourceChars:SUPPORT_LIMITS.maxSourceChars})}):deny('SUPPORT_INPUT_INVALID');
 if(action.type==='support_reply'){
  if(!exact(input,['text'])||!text(input.text,SUPPORT_LIMITS.maxQuestionChars))return deny('SUPPORT_INPUT_INVALID');
  if(data.messages.filter(m=>m.conversationId===c.id&&m.role==='customer').length>=SUPPORT_LIMITS.maxTurns)return hold('SUPPORT_TURN_LIMIT');
  if(data.messages.some(m=>m.id===`${action.id}:customer`||m.id===`${action.id}:assistant`))return deny('SUPPORT_TURN_EXISTS');
  const sources=currentSources(action,service,ctx);if(!sources)return hold('SUPPORT_PUBLICATION_STALE');
  const selected=lookup(input.text,sources);if(!selected.citations.length&&data.tickets.filter(t=>t.conversationId===c.id).length>=SUPPORT_LIMITS.maxTickets)return hold('SUPPORT_TICKET_LIMIT');
  const t=selected.citations.length?null:ticket(action,ctx,c,input.text,selected.reasonCode),messageText=selected.citations.length?`${DISCLAIMER}\n\n${selected.citations.map(c=>`[${c.title} — ${c.section}]\n${c.excerpt}`).join('\n\n')}`:`${DISCLAIMER}\n\n${selected.reasonCode==='SUPPORT_CLAIM_DECISION_ESCALATED'?'A personal claim or coverage decision requires an authorized human reviewer.':'No matching passage was found in the published fictional policy sources.'} An owner-visible support case was created: ${t.id}.`;
  const common={conversationId:c.id,replyMode:'policy_lookup',fictional:true,createdAt:at(ctx)},question={id:`${action.id}:customer`,companyId:ctx.companyId,...common,role:'customer',text:input.text,citations:[],reasonCode:null},answer={id:`${action.id}:assistant`,companyId:ctx.companyId,...common,role:'assistant',text:messageText,citations:selected.citations,reasonCode:selected.reasonCode},next={...c,state:t?'escalated':c.state,version:c.version+1,updatedAt:at(ctx)};
  return allow({plan:plan(action,{puts:[put('supportMessages',question),put('supportMessages',answer),put('supportConversations',next,c),...t?[put('supportTickets',t)]:[]],events:[event(action,ctx,'support.replied',{conversationId:c.id,messageId:answer.id,reasonCode:answer.reasonCode}),...t?[event(action,ctx,'support.escalated',{conversationId:c.id,ticketId:t.id,reasonCode:t.reasonCode})]:[]],conversation:conversationPublic(next),reply:messagePublic(answer),ticket:t?ticketPublic(t):null})});
 }
 return deny('UNKNOWN_SUPPORT_ACTION');
}
