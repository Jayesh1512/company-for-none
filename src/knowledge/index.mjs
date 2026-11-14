import {randomUUID} from 'node:crypto';
import {parseDocument} from 'yaml';
import {ContractError,fingerprint} from '../contracts.mjs';
const fail=(code,message,httpStatus)=>{throw Object.assign(new ContractError(code,message),httpStatus?{httpStatus}:{});};
const copy=v=>structuredClone(v);
export function createCompanyKnowledge({journal,rules,client,companyId='local-workspace',clock=()=>new Date()}) {
 if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(companyId))fail('INVALID_INPUT','Invalid server company identifier.');
 const prefix=`companies/${companyId}/documents/`,now=()=>new Date(clock()).toISOString();
 const docs=()=>journal.list('companyKnowledgeDocuments').filter(d=>d.companyId===companyId);
 const agent=id=>journal.get('agents',id)??fail('NOT_FOUND','Agent not found.');
 const ownerContext=access=>access??(rules.snapshot().mode==='fixture'?{role:'owner',verifiedLocal:true,companyId}:{role:'public',verified:false,companyId});
 let queue=Promise.resolve();
 const serial=fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
 function decide(type,extra={},actionExtra={}) {
  const d=rules.evaluate({id:`knowledge:${type}:${randomUUID()}`,type,mode:rules.snapshot().mode,...actionExtra},{company:{id:companyId},documents:docs(),...extra});
  if(d.status!=='allow')throw Object.assign(new ContractError(d.reasonCode,d.reasonCode==='KNOWLEDGE_ACCESS_DENIED'?'This agent does not have access to the selected company document.':d.reasonCode),{httpStatus:403,decision:d});
  return d;
 }
 function registered(id) {if(typeof id!=='string'||!id.startsWith(prefix))fail('KNOWLEDGE_ACCESS_DENIED','Document is outside this company.',403);return docs().find(d=>d.id===id)??fail('NOT_FOUND','Company document not found.',404);}
 function connected(){if(!client)fail('JBRAIN_UNAVAILABLE','Company knowledge is not connected. Start JBrain and configure its service URL.',503);return client;}
 async function canonical(id) {const value=await connected().read(id);if(value.id!==id||typeof value.markdown!=='string'||typeof value.revision!=='string')fail('JBRAIN_RESPONSE_INVALID','JBrain returned an unexpected document.');return value;}
 function contextDecision(agentId,ids,access){return decide('knowledge_context',{agent:agent(agentId),access:ownerContext(access)},{...(ids!==undefined?{documentIds:ids}:{})});}
 function previewDecision(agentId,ids,access){return decide('knowledge_preview',{agent:agent(agentId),access:ownerContext(access)},{documentIds:ids});}
 async function commit(intent,receipt){
   const commandId=intent.id;
   if(receipt.id!==intent.payload.id||receipt.requestId!==commandId||typeof receipt.revision!=='string')fail('JBRAIN_RESPONSE_INVALID','JBrain did not confirm the original write identity.');
   const document={...intent.metadata,revision:receipt.revision};
   await journal.transaction({actionId:`${commandId}:applied`,fingerprint:fingerprint(receipt)},tx=>{tx.put('companyKnowledgeDocuments',document.id,document);tx.put('companyKnowledgeWrites',commandId,{...intent,status:'applied',document,receipt});const id=randomUUID();tx.put('workspaceActivity',id,{id,type:'knowledge.saved',agentName:intent.metadata.sourceAgentId?agent(intent.metadata.sourceAgentId).name:'Company knowledge',at:now()});return null;});
   return {document,replayed:false};

 }
 const api={
  companyId,
  recover(){return serial(async()=>{if(!client)return;for(const intent of journal.list('companyKnowledgeWrites').filter(w=>w.metadata.companyId===companyId&&['prepared','unknown'].includes(w.status))){try{const operation=await client.operation(intent.id);if(operation.state==='applied')await commit(intent,operation.result);else if(operation.state==='rejected')await journal.transaction({actionId:`${intent.id}:rejected`,fingerprint:fingerprint(operation.result)},tx=>{tx.put('companyKnowledgeWrites',intent.id,{...intent,status:'rejected',reasonCode:operation.result?.error?.code});return null;});}catch(e){if(e.httpStatus!==404&&e.httpStatus!==503)throw e;}}});},
  async view(agentId,access){const plan=decide('knowledge_read',{...(agentId?{agent:agent(agentId)}:{}),access:ownerContext(access)}).plan;let status='unavailable',reason='Not configured';if(client)try{const h=await client.health();status=h.status==='ready'?'connected':'unavailable';reason=h.status;}catch(e){reason=e.code;}return {company:{id:companyId,name:journal.get('organization',companyId)?.name||'My company'},provider:'jbrain',status,reason,documents:docs().filter(d=>plan.documentIds.includes(d.id)),limits:{selectionRequiredAbove:plan.maxDocuments,maxDocumentChars:plan.maxDocumentChars,...(plan.importLimits?{import:plan.importLimits}:{})},limitations:'Single-owner local workspace. JBrain credentials stay on the server.'};},
  async read(id,access){decide('knowledge_read',{access:ownerContext(access)});const meta=registered(id),value=await canonical(id);return {document:{...meta,revision:value.revision,markdown:value.markdown,body:value.markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'')}};},
  save(input,{requestId,sourceOrderId,sourceAgentId,access}={}) {return serial(async()=>{
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['id','title','body','visibility','agentIds','expectedRevision','version'].includes(k)))fail('INVALID_INPUT','Unsupported company document field.');
   if(typeof requestId!=='string'||!requestId||requestId.length>160)fail('INVALID_INPUT','A stable Idempotency-Key is required.');
   const commandId=`near1:${fingerprint({companyId,requestId})}`,fp=fingerprint({input,sourceOrderId,sourceAgentId});
   let intent=journal.get('companyKnowledgeWrites',commandId);
   if(intent&&intent.fingerprint!==fp)fail('CONFLICT','Write identity was reused with different content.',409);
   const d=decide('knowledge_manage',{access:ownerContext(access),document:input,agents:journal.list('agents')});
   connected();
   if(intent?.status==='applied')return {document:copy(intent.document),replayed:true};
   if(!intent){
    const old=input.id?registered(input.id):null;
    if(old&&journal.list('companyKnowledgeWrites').some(w=>w.metadata.companyId===companyId&&w.payload.id===old.id&&['prepared','unknown'].includes(w.status)))fail('CONFLICT','A previous write is unresolved. Retry its original request before editing again.',409);
    if(old&&(input.version!==old.version||typeof input.expectedRevision!=='string'))fail('CONFLICT','The document changed. Reload it before merging your edits.',409);
    if(!old&&(input.expectedRevision!==undefined&&input.expectedRevision!==null))fail('INVALID_INPUT','A new document must use a null revision.');
    const id=old?.id??prefix+randomUUID();
    let frontmatter='type: Reference\n';
    if(old){const prior=await canonical(id);if(prior.revision!==input.expectedRevision)fail('CONFLICT','JBrain document changed. Reload before merging your edits.',409);frontmatter=/^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(prior.markdown)?.[1]??'type: Reference';}
    const header=parseDocument(frontmatter);if(header.errors.length)fail('INVALID_INPUT','Existing document metadata could not be preserved.');
    header.set('title',input.title.trim());header.set('companyId',companyId);if(sourceOrderId)header.set('sourceOrderId',sourceOrderId);
    const payload={requestId:commandId,actor:'near1/owner',action:'put',id,expectedRevision:old?input.expectedRevision:null,markdown:`---\n${header.toString()}---\n${input.body.trim()}\n`};
    const metadata={id,companyId,title:input.title.trim(),visibility:d.plan.visibility,agentIds:d.plan.agentIds,version:(old?.version??0)+1,createdAt:old?.createdAt??now(),updatedAt:now(),...(sourceOrderId?{sourceOrderId}:{}),...(sourceAgentId?{sourceAgentId}:{})};
    intent={id:commandId,fingerprint:fp,payload,metadata,status:'prepared',createdAt:now()};
    await journal.transaction({actionId:`${commandId}:intent`,fingerprint:fp},tx=>{tx.put('companyKnowledgeWrites',commandId,intent);return null;});
   }
   let receipt;
   try{receipt=await client.write(intent.payload);}
   catch(e){await journal.transaction({actionId:`${commandId}:observation:${randomUUID()}`,fingerprint:fingerprint({code:e.code})},tx=>{tx.put('companyKnowledgeWrites',commandId,{...intent,status:e.httpStatus===409?'rejected':'unknown',reasonCode:e.code});return null;});throw e;}
   return commit(intent,receipt);
  });},
  available(agentId,access){return contextDecision(agentId,undefined,access).plan;},
  async previewContext(agentId,ids,access){
   const d=previewDecision(agentId,ids,access),documents=[];let remaining=d.plan.maxContextChars;
   for(const id of d.plan.documentIds){const value=await canonical(id),meta=registered(id),text=value.markdown.slice(0,Math.min(remaining,d.plan.maxCharsPerDocument));documents.push({id,title:meta.title,revision:value.revision,markdown:text,truncated:text.length<value.markdown.length});remaining-=text.length;}
   previewDecision(agentId,d.plan.documentIds,access);
   return {provider:'jbrain',companyId,agentId,documents,capturedAt:now(),untrusted:true,publicEvidence:false,preparationOnly:true};
  },
  assertPreviewSnapshot(snapshot,access){if(snapshot?.companyId!==companyId||snapshot.preparationOnly!==true)fail('COMPANY_SCOPE_MISMATCH','This is not a local company context preview.',403);return previewDecision(snapshot.agentId,snapshot.documents.map(d=>d.id),access);},
  async capture(agentId,ids,access){
   if(Array.isArray(ids)&&ids.length===0)return {provider:'jbrain',companyId,agentId,documents:[],capturedAt:now(),untrusted:true,publicEvidence:false};
   const d=contextDecision(agentId,ids,access),documents=[];let remaining=d.plan.maxContextChars;
   if(!d.plan.documentIds.length)return {provider:'jbrain',companyId,agentId,documents:[],capturedAt:now(),untrusted:true};
   for(const id of d.plan.documentIds){const value=await canonical(id),meta=registered(id),limit=Math.min(remaining,d.plan.maxCharsPerDocument),text=value.markdown.slice(0,limit);documents.push({id,title:meta.title,revision:value.revision,markdown:text,truncated:text.length<value.markdown.length});remaining-=text.length;}
   contextDecision(agentId,d.plan.documentIds,access);
   return {provider:'jbrain',companyId,agentId,documents,capturedAt:now(),untrusted:true,publicEvidence:false};
  },
  assertSnapshot(snapshot,access){if(!snapshot?.documents?.length)return null;if(snapshot.companyId!==companyId)fail('COMPANY_SCOPE_MISMATCH','Task knowledge belongs to another company.',403);return contextDecision(snapshot.agentId,snapshot.documents.map(d=>d.id),access);},
 };
 return api;
}
