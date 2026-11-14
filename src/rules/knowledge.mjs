import {allow,deny,hold} from './policies.mjs';
import {ownerAccess} from './runtime.mjs';
const importLimits={maxUploadBytes:5*1024*1024,maxWebsiteBytes:1024*1024,maxDocumentChars:24000,maxPdfPages:50,timeoutMs:10000,maxRedirects:3};
export function knowledgeDecision(action,facts,config) {
 const companyId=facts.company?.id;
 if(typeof companyId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(companyId))return deny('COMPANY_FACTS_REQUIRED');
 const docs=facts.documents??[];
 if(!Array.isArray(docs)||docs.some(d=>d.companyId!==companyId||!d.id?.startsWith(`companies/${companyId}/documents/`)))return deny('COMPANY_SCOPE_MISMATCH');
 if(action.type==='knowledge_import') {
  if(!ownerAccess(facts.access,companyId,config?.mode??'setup'))return deny('ACCESS_DENIED');
  if(!['pdf','markdown','text','website'].includes(facts.source?.kind))return deny('KNOWLEDGE_IMPORT_TYPE_INVALID');
  return allow({plan:{kind:'knowledge_import',...importLimits,sourceKind:facts.source.kind,canonicalStore:'jbrain',saveRequiresReview:true,grantsSpendingAuthority:false}});
 }
 if(action.type==='knowledge_manage') {
  if(!ownerAccess(facts.access,companyId,config?.mode??'setup'))return deny('ACCESS_DENIED');
  const doc=facts.document;
  if(!doc||!['company','restricted'].includes(doc.visibility)||typeof doc.title!=='string'||!doc.title.trim()||doc.title.length>160||typeof doc.body!=='string'||!doc.body.trim()||doc.body.length>24000)return deny('KNOWLEDGE_DOCUMENT_INVALID');
  if(!Array.isArray(doc.agentIds)||doc.agentIds.some(id=>!facts.agents?.some(a=>a.id===id&&a.companyId===companyId)))return deny('KNOWLEDGE_GRANT_INVALID');
  return allow({plan:{kind:'knowledge_write',companyId,visibility:doc.visibility,agentIds:[...new Set(doc.agentIds)],maxDocumentChars:24000,canonicalStore:'jbrain',grantsSpendingAuthority:false}});
 }
 if(action.type==='knowledge_read'&&!facts.agent&&ownerAccess(facts.access,companyId,config?.mode??'setup'))return allow({plan:{kind:'knowledge_read',companyId,documentIds:docs.map(d=>d.id),maxDocuments:4,maxDocumentChars:24000,importLimits}});
 if(action.type==='knowledge_preview'&&!ownerAccess(facts.access,companyId,config?.mode??'setup'))return deny('ACCESS_DENIED');
 const agent=facts.agent;
 if(!agent||agent.companyId!==companyId)return deny('COMPANY_SCOPE_MISMATCH');
 const permitted=docs.filter(d=>d.visibility==='company'||d.agentIds?.includes(agent.id));
 if(action.type==='knowledge_read')return allow({plan:{kind:'knowledge_read',companyId,agentId:agent.id,documentIds:permitted.map(d=>d.id),maxDocuments:4,maxDocumentChars:24000}});
 const requested=action.documentIds??permitted.map(d=>d.id);
 if(!Array.isArray(requested)||requested.some(id=>!permitted.some(d=>d.id===id)))return deny('KNOWLEDGE_ACCESS_DENIED');
 const ids=[...new Set(requested)];
 if(ids.length>4)return hold('KNOWLEDGE_SELECTION_REQUIRED');
 return allow({plan:{kind:action.type==='knowledge_preview'?'knowledge_preview':'knowledge_context',companyId,agentId:agent.id,documentIds:ids,maxDocuments:4,maxCharsPerDocument:2000,maxContextChars:config?Math.min(8000,Math.floor(config.research.maxInputChars/3)):8000,untrusted:true,publicEvidence:false,grantsSpendingAuthority:false}});
}
