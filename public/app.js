import {renderCare} from './customer-care.js';
import {AUTONOMY_INTENT} from './autonomy-intent.js';
import {setupDemoDraft,SETUP_DEMO_KNOWLEDGE} from './setup-demo.js';
import {previewKnowledgeFile} from './knowledge-import.js';
export {renderReport,renderLedger,renderOrder,loadView} from './research-ui.js';
import {renderWorkspace} from './workspace.js';
import {signWithEvmWallet} from './owner-wallet.js';

export function parseRoute(hash='') {
 const [path,query='']=hash.replace(/^#/,'').split('?');let [page,sub,id]=path.split('/').map(x=>decodeURIComponent(x||''));const params=new URLSearchParams(query);
 if(page==='autonomy'&&sub==='setup'){page='setup';sub=['org','brain','boundaries','review'][Number(params.get('step')??0)]??'org';params.delete('step');}
 return {page:['demo','autonomy','agents','overview','tasks','marketplace','ledger','settings','owner','activity','order','knowledge','setup','service','care','support'].includes(page)?page:'setup',sub:sub||null,id:page==='agents'&&sub==='new'?id:null,action:page==='agents'&&sub!=='new'?id:null,params};
}
if(typeof document!=='undefined') {
  const root=document.querySelector('#app');
  const state={route:parseRoute(location.hash),data:null,status:null,order:null,artifact:null,ledger:null,error:null,busy:false,search:'',marketSearch:'',agentFilter:'all',marketTab:'all',category:'All categories',sort:'recent',agentTab:'overview',draft:{},menuOpen:false,helpOpen:false};
  try{state.exampleMode=sessionStorage.getItem('near:setup-example')==='on'||sessionStorage.getItem('near:setup-demo')==='on';sessionStorage.removeItem('near:setup-demo');}catch{}
  // Retire the former browser-held owner credential. Local access is verified by the server socket.
  try{sessionStorage.removeItem('one:owner');}catch{}
  const memoryTokens=new Map();
  const getToken=id=>{try{return localStorage.getItem(`one:access:${id}`)||sessionStorage.getItem(`one:access:${id}`)||memoryTokens.get(id)||'';}catch{return memoryTokens.get(id)||'';}};
  const saveToken=(id,token)=>{memoryTokens.set(id,token);try{localStorage.setItem(`one:access:${id}`,token);sessionStorage.setItem(`one:access:${id}`,token);}catch{}};
  async function api(path,{method='GET',body,token,key}={}) {const response=await fetch(path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`} :{}),...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error?.message??`Request failed (${response.status})`),{status:response.status,code:value.error?.code});return value;}
  const careMemory=new Map();
  const careSession=id=>{try{return JSON.parse(sessionStorage.getItem('near:care:'+id)||'null')??careMemory.get(id);}catch{return careMemory.get(id);}};
  const saveCareSession=(serviceId,value)=>{careMemory.set(serviceId,value);try{sessionStorage.setItem('near:care:'+serviceId,JSON.stringify(value));}catch{}};
  async function startCare(){
    const serviceId=state.route.sub,key=state.careOpenKey??=crypto.randomUUID();
    const result=await api('/api/support/conversations',{method:'POST',body:{serviceId},key});
    if(!result.accessToken){state.careOpenKey=null;throw Error('The conversation was created, but this browser did not receive its private key. Start a new conversation.');}
    saveCareSession(serviceId,{id:result.conversation.id,token:result.accessToken});state.careOpenKey=null;state.careDraft='';
  }
  const render=()=>{root.innerHTML=state.route.page==='care'?renderCare(state):renderWorkspace(state);if(state.knowledgeFile){const input=root.querySelector('#knowledge-file');if(input&&typeof DataTransfer!=='undefined'){const files=new DataTransfer();files.items.add(state.knowledgeFile);input.files=files.files;}}if(state.busy)root.querySelectorAll('main button').forEach(b=>b.disabled=true);if(state.helpOpen){const d=root.querySelector('dialog');d.removeAttribute('open');d.showModal();}};
  const announce=msg=>{document.querySelector('#announcement').textContent=msg;};
  async function load() {
    state.route=parseRoute(location.hash);
    if(state.route.page==='care'){
      state.status=await api('/api/status');
      state.supportCatalog=await api('/api/support/services');
      const serviceId=state.route.sub,session=serviceId?careSession(serviceId):null;
      state.careView=session?await api('/api/support/conversations/'+encodeURIComponent(session.id),{token:session.token}):null;
      return;
    }
    if(state.route.page==='ledger'){state.ledgerUnavailable=null;try{state.ledger=await api('/api/ledger');}catch(error){if(!['COMMERCIAL_POLICY_REQUIRED','ACCESS_DENIED','INVALID_CONFIG'].includes(error.code))throw error;state.ledger=null;state.ledgerUnavailable={reasonCode:error.code};}return;}
    if(['order','service'].includes(state.route.page)){state.status=await api('/api/status');state.data={agents:[],tasks:[],catalog:[],activity:[],workspace:{name:'Research service'}};if(state.route.page==='service'){state.services=(await api('/api/services')).services;return;}}
    else {try{const [data,status]=await Promise.all([api('/api/workspace'),api('/api/status')]);state.data=data;state.status=status;state.workspaceAccessDenied=false;}catch(error){if(error.status!==403)throw error;state.workspaceAccessDenied=true;state.data={agents:[],tasks:[],catalog:[],activity:[]};state.status=await api('/api/status');state.operation=null;return;}}
    try{state.localDemo=await api('/api/workspace/local-demo');}catch(error){if(error.status!==404)throw error;state.localDemo={active:false};}
    if(state.localDemo?.active)state.supportCatalog=await api('/api/support/services');
    if(state.route.page==='demo'&&!state.localDemo?.active)state.aiDemo=await api('/api/workspace/ai-demo');
    if(['setup','autonomy'].includes(state.route.page)){state.autonomy=await api('/api/workspace/autonomy');if(state.route.page==='setup'||state.route.sub==='knowledge')state.autonomyKnowledge=await api('/api/knowledge');if(state.route.page==='autonomy'&&state.route.sub==='improvements')state.autonomyTrace=await api('/api/workspace/autonomy/trace');if(state.route.page==='autonomy'&&state.route.sub==='ledger')state.ledgerChain=await api('/api/workspace/ledger-chain');}
    if(['marketplace','support'].includes(state.route.page))state.supportCatalog=await api('/api/support/services');
    if(state.route.page==='support')state.supportOwner=await api('/api/workspace/support');
    if(state.route.page==='marketplace'){state.marketKnowledge=await api('/api/knowledge');if(state.route.params.has('agent'))state.marketAgentId=state.route.params.get('agent');}
    if(!state.localDemo?.active&&['setup','settings','marketplace'].includes(state.route.page))state.operation=await api('/api/workspace/operation');
    if(!state.localDemo?.active&&['settings','owner'].includes(state.route.page)){state.cloudPlan=await api('/api/workspace/inference/plan');state.nearCloud=await api('/api/workspace/cloud');state.owner=await api('/api/owner/status');state.nearIntegrations=await api('/api/workspace/near-integrations');}
    if(state.route.page==='setup'){state.setup=await api('/api/workspace/setup');if(state.exampleMode)state.companySetupDraft=setupDemoDraft(state);}
    if(state.route.page==='agents'&&state.route.params.get('tab')==='settings')state.agentTab='settings';
    if(state.route.page==='knowledge'){const source=state.route.params.get('source');if(['pdf','markdown','website'].includes(source))state.knowledgeSource=source;state.knowledge=await api('/api/knowledge');state.knowledgeDocument=null;if(state.route.sub&&state.route.sub!=='new')state.knowledgeDocument=await api('/api/knowledge/document?id='+encodeURIComponent(state.route.sub));}
    if(state.exampleMode&&!state.localDemo?.active&&state.route.page==='knowledge'&&state.route.sub==='new'&&!state.knowledgeDraft)state.knowledgeDraft={...SETUP_DEMO_KNOWLEDGE,agentIds:[]};
    if(state.route.page==='agents'&&state.route.action==='task')state.taskKnowledge=await api('/api/knowledge?agentId='+encodeURIComponent(state.route.sub));
    if(state.route.page==='order') {const id=state.route.sub;if(!getToken(id)){state.order=null;return;}state.order=(await api(`/api/orders/${encodeURIComponent(id)}`,{token:getToken(id)})).order;if(state.order.reportAvailable)state.artifact=(await api(`/api/orders/${encodeURIComponent(id)}/report`,{token:getToken(id)})).artifact;}
  }
  async function task(work,{reload=true,toast}={}) {if(state.busy)return;state.error=null;state.busy=true;render();try {await work();if(reload)await load();if(toast)state.toast=toast;announce(toast??'Workspace updated.');}catch(error){state.error=error.message;announce(error.message);}finally{state.busy=false;render();}}
  function rememberKnowledgeDraft(){const form=root.querySelector('#knowledge-form');if(!form)return;const values=new FormData(form);state.knowledgeDraft={title:values.get('title')??'',body:values.get('body')??'',visibility:values.get('visibility')??'company',agentIds:values.getAll('agentIds')};const url=root.querySelector('#knowledge-url');if(url)state.knowledgeUrl=url.value;}
  function acceptKnowledgePreview(result){state.knowledgeDraft={...state.knowledgeDraft,title:state.knowledgeDraft?.title?.trim()||result.preview.title,body:result.preview.body};state.knowledgeImportPreview=result.preview;state.knowledgeKey=null;}
  function navigate(hash) {if(location.hash===`#${hash}`)return task(load,{reload:false});location.hash=hash;}
  root.addEventListener('submit',event=>{
    if(event.target.id==='ai-demo-form'){
      event.preventDefault();const f=new FormData(event.target),input={agentId:f.get('agentId'),documentIds:f.getAll('documentIds'),question:f.get('question')};
      state.aiDemoQuestion=input.question;const key=state.aiDemoKey??=crypto.randomUUID();
      task(async()=>{await api('/api/workspace/ai-demo/run',{method:'POST',body:input,key});state.aiDemoKey=null;},{toast:'Agent request recorded'});return;
    }
    event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form));
    if(form.id==='near-integration-form'){state.integrationDraft=values.input;state.integrationKind=values.kind;const key=state.integrationKey??=crypto.randomUUID();task(async()=>{const input=JSON.parse(values.input);state.integrationResult=await api('/api/workspace/near-integrations/prepare',{method:'POST',key,body:{kind:values.kind,input}});state.integrationKey=null;},{toast:'Request prepared without provider execution'});return;}
    if(form.id==='near-account-plan-form'){task(async()=>{state.integrationResult=await api('/api/workspace/near-integrations/accounts',{method:'POST',body:JSON.parse(values.input)});},{toast:'Unsigned account plan prepared; no keys or accounts created'});return;}
    if(form.id==='care-message-form'){
      const session=careSession(state.route.sub);if(!session)return;
      state.careDraft=values.text;const key=state.careMessageKey??=crypto.randomUUID();
      task(async()=>{await api('/api/support/conversations/'+encodeURIComponent(session.id)+'/messages',{method:'POST',body:{text:values.text},token:session.token,key});state.careDraft='';state.careMessageKey=null;},{toast:'Reply received'});return;
    }
    if(form.id==='cloud-tool-plan-form'){state.cloudDraft=values;const input=values.product==='web_search'?{model:values.model,input:values.text,count:5,maxOutputTokens:2048}:{model:values.model,input:values.text};task(async()=>{state.nearCloudPlan=await api('/api/workspace/cloud/plan',{method:'POST',body:{product:values.product,input,timeoutMs:30000,maxInputBytes:65536,maxResponseBytes:2097152}});},{reload:false,toast:'Request prepared locally. No Cloud call was sent.'});return;}
    if(form.id==='cloud-usage-form'){task(async()=>{state.cloudReport=await api('/api/workspace/cloud/usage',{method:'POST',body:{startTime:values.startTime+'Z',endTime:values.endTime+'Z',limit:100}});},{toast:'Read one usage page'});return;}
    if(form.id==='company-brief-form'){
     const {maxAgents,...brief}=values,intent={...AUTONOMY_INTENT,...state.autonomy?.company?.intent,...state.companySetupDraft?.intent,maxAgents:Number(maxAgents)};
     state.companySetupDraft={brief,intent};const key=state.companyOnboardKey??=crypto.randomUUID();
     task(async()=>{const result=await api('/api/workspace/autonomy/onboard',{method:'POST',key,body:{version:state.autonomy?.company?.version??0,organizationVersion:state.setup?.organization?.version??0,brief,intent}});state.companyOnboardKey=null;state.companySetupDraft={brief:result.company.brief,intent:result.company.intent};location.hash='setup/agents';},{toast:'Company and core team configured. Review the agent profiles.'});return;
    }
    if(form.dataset.setupAgent){
     const id=form.dataset.setupAgent,body={name:values.name,role:values.role,instructions:values.instructions,version:Number(values.version),skillIds:new FormData(form).getAll('skillIds')};state.companyAgentDrafts={...state.companyAgentDrafts,[id]:body};
     task(async()=>{await api('/api/agents/'+encodeURIComponent(id)+'/update',{method:'POST',body});delete state.companyAgentDrafts[id];},{toast:'Configured agent saved'});return;
    }
    if(form.id==='company-boundaries-form'){
     const c=state.autonomy.company,intent={...c.intent,...state.companySetupDraft?.intent};for(const [key,value]of Object.entries(values))intent[key]=Number(value);
     state.companySetupDraft={...state.companySetupDraft,intent};const key=state.companyBoundsKey??=crypto.randomUUID();
     task(async()=>{await api('/api/workspace/autonomy/configure',{method:'POST',key,body:{version:c.version,operatingMode:c.operatingMode,brief:c.brief,intent}});state.companyBoundsKey=null;location.hash='setup/review';},{toast:'Operating preferences saved. Execution remains paused.'});return;
    }
    if(form.id==='autonomy-knowledge-form'){const agent=state.autonomy.agents.find(a=>a.id===values.agentId),key=state.autonomyKnowledgeKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/knowledge-selection',{method:'POST',key,body:{agentId:agent.id,version:agent.version,knowledgeIds:new FormData(form).getAll('knowledgeIds')}});state.autonomyKnowledgeKey=null;location.hash=state.route.params.get('setup')==='brain'?'setup/brain':'autonomy/agents';},{toast:'Company context selection saved for new work'});return;}
    if(form.dataset.changeReview){
     const improvementId=form.dataset.changeReview,decision=event.submitter?.value,reviewNote=String(values.reviewNote??'').trim();
     state.changeReviewDrafts={...state.changeReviewDrafts,[improvementId]:{reviewNote}};const key=state.changeReviewKeys??={};key[improvementId]??=crypto.randomUUID();
     task(async()=>{await api('/api/workspace/autonomy/change-review',{method:'POST',key:key[improvementId],body:{improvementId,version:Number(form.dataset.version),decision,...(reviewNote?{reviewNote}:{})}});delete state.changeReviewDrafts[improvementId];delete key[improvementId];},{toast:'Owner review recorded. Current execution and scope checks still apply.'});return;
    }
    if(form.id==='autonomy-objective-form'){const key=state.autonomyObjectiveKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/control',{method:'POST',key,body:{version:state.autonomy.company.version,operation:'replace_objective',objective:values.objective}});state.autonomyObjectiveKey=null;location.hash='autonomy';},{toast:'New objective saved; prior history retained'});return;}
    if(form.id==='autonomy-gap-form'){const key=state.autonomyGapKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/gaps',{method:'POST',key,body:values});state.autonomyGapKey=null;location.hash='autonomy/improvements';},{toast:'Gap recorded in the company backlog'});return;}
    if(form.id==='autonomy-template-form'){const lines=x=>x.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const fields=lines(values.fields).map(name=>({name:name.replace(/\*$/,''),required:name.endsWith('*')}));const key=state.autonomyTemplateKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/templates',{method:'POST',key,body:{name:values.name,fields,requiredFields:lines(values.requiredFields)}});state.autonomyTemplateKey=null;location.hash='autonomy/improvements';},{toast:'Company template registered'});return;}
    if(form.id==='activation-form'){const body={agentId:values.agentId,serviceId:values.serviceId,knowledgeIds:new FormData(form).getAll('knowledgeIds'),version:state.operation.organization.version};task(()=>api('/api/workspace/activate',{method:'POST',body}),{toast:'Company activation saved'});return;}
    if(form.id==='service-order-form'){if(!values.refundRecipient?.trim())delete values.refundRecipient;const key=state.serviceKey??=crypto.randomUUID();task(async()=>{const result=await api(`/api/services/${state.route.sub}/orders`,{method:'POST',key,body:values});saveToken(result.order.id,result.accessToken);state.serviceKey=null;location.hash=`order/${result.order.id}`;},{toast:'Order and quote created'});return;}
    if(form.id==='resource-binding-form'){const agent=state.data.agents.find(x=>x.id===values.agentId);task(()=>api(`/api/agents/${agent.id}/resources`,{method:'POST',body:{listingId:state.route.sub,version:agent.version}}),{toast:'Resource connected'});return;}
    if(form.id==='organization-form'){const body={...values,version:state.setup.organization.version};state.orgDraft=body;task(async()=>{await api('/api/workspace/organization',{method:'POST',body});state.orgDraft=null;location.hash='setup/agents';},{toast:'Organization saved'});}
    if(form.id==='create-agent-form') {const body={name:values.name,role:values.role,description:values.description,instructions:values.instructions,skillIds:new FormData(form).getAll('skillIds'),status:values.draft?'draft':'ready',...(state.route.id?{templateId:state.route.id}:{})};state.draft=body;const key=state.createKey??=crypto.randomUUID();task(async()=>{const {agent}=await api('/api/agents',{method:'POST',body,key});state.draft={};state.createKey=null;state.agentTab='overview';location.hash=state.route.params.get('setup')==='agents'?'setup/agents':`agents/${agent.id}`;},{toast:'Agent created'});}
    if(form.id==='agent-settings-form'){const agent=state.data.agents.find(a=>a.id===state.route.sub);const returnStep=state.route.params.get('setup');task(async()=>{await api(`/api/agents/${agent.id}/update`,{method:'POST',body:{...values,skillIds:new FormData(form).getAll('skillIds'),version:agent.version}});if(['agents','profiles'].includes(returnStep))location.hash=`setup/${returnStep}`;},{toast:'Agent settings saved'});}
    if(form.id==='review-soul-form'){navigate(`agents/${encodeURIComponent(values.agentId)}?tab=settings&soul=${encodeURIComponent(state.route.sub)}`);return;}
    if(form.id==='use-listing-form'){const item=state.data.catalog.find(x=>x.id===state.route.sub);if(item.kind==='skill')task(async()=>{await api(`/api/agents/${values.agentId}/skills`,{method:'POST',body:{listingId:item.id}});if(state.route.params.get('setup')==='skills')location.hash='setup/skills';},{toast:'Skill added to agent'});else navigate(`agents/${values.agentId}/task?service=${item.id}`);}
    if(form.id==='knowledge-form'){const doc=state.knowledgeDocument?.document;const body={title:values.title,body:values.body,visibility:values.visibility,agentIds:new FormData(form).getAll('agentIds'),...(doc?{id:doc.id,expectedRevision:doc.revision,version:doc.version}:{})};state.knowledgeDraft=body;const key=state.knowledgeKey??=crypto.randomUUID();task(async()=>{await api('/api/knowledge/documents',{method:'POST',body,key});state.knowledgeKey=null;state.knowledgeDraft=null;location.hash=state.route.params.get('setup')==='brain'?'setup/brain':'knowledge';},{toast:'Company knowledge saved'});}
    if(form.id==='publish-knowledge-form'){const id=state.order.id,body={title:values.title,visibility:values.visibility,agentIds:new FormData(form).getAll('agentIds')};const key=state.publishKey??=crypto.randomUUID();task(async()=>{await api(`/api/orders/${id}/publish-knowledge`,{method:'POST',body,key,token:getToken(id)});state.publishKey=null;state.sharing=false;},{toast:'Report shared with company knowledge'});}
    if(form.id==='task-form'){values.knowledgeIds=new FormData(form).getAll('knowledgeIds');state.draft=values;const key=state.taskKey??=crypto.randomUUID();task(async()=>{const result=await api(`/api/agents/${state.route.sub}/tasks`,{method:'POST',key,body:{...values,...(state.route.params.get('service')?{serviceId:state.route.params.get('service')}:{})}});saveToken(result.order.id,result.accessToken);state.draft={};state.taskKey=null;state.artifact=null;location.hash=`order/${result.order.id}`;},{toast:'Task created'});}
    if(form.id==='restore-task-form'){saveToken(state.route.sub,values.token.trim());task(load,{reload:false});}
  });
  root.addEventListener('click',event=>{
    const integrationButton=event.target.closest('[data-integration-execute],[data-integration-reconcile],[data-integration-verify],[data-integration-resource],[data-integration-cost]');
    if(integrationButton&&!integrationButton.disabled){const op=integrationButton.dataset.integrationExecute?'execute':integrationButton.dataset.integrationReconcile?'reconcile':integrationButton.dataset.integrationResource?'probe-resource':integrationButton.dataset.integrationCost?'cost':'verify-evaluation',planId=integrationButton.dataset.integrationExecute??integrationButton.dataset.integrationReconcile??integrationButton.dataset.integrationVerify??integrationButton.dataset.integrationResource??integrationButton.dataset.integrationCost;task(async()=>{state.integrationResult=await api('/api/workspace/near-integrations/'+op,{method:'POST',body:{planId}});},{toast:'Integration request checked against current authority'});return;}
    const reconcile=event.target.closest('[data-chain-reconcile]');if(reconcile){const key=state.chainReconcileKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/ledger-chain/reconcile',{method:'POST',body:{batchId:reconcile.dataset.chainReconcile},key});state.chainReconcileKey=null;},{toast:'Batch checked against final on-chain records'});return;}
    const publish=event.target.closest('[data-chain-publish]');if(publish&&!publish.disabled){task(async()=>{state.chainResult=await api('/api/workspace/ledger-chain/publish',{method:'POST',body:{batchId:publish.dataset.chainPublish}});},{toast:'Original native operation recorded; final proof still required'});return;}
    const chainCost=event.target.closest('[data-chain-cost]');if(chainCost){task(async()=>{state.chainResult=await api('/api/workspace/ledger-chain/fees',{method:'POST',body:{operationId:chainCost.dataset.chainCost}});},{toast:'Original fee checked against final NEAR receipts'});return;}
    const suggestion=event.target.closest('[data-care-question]');if(suggestion){state.careDraft=suggestion.dataset.careQuestion;render();root.querySelector('#care-question')?.focus();return;}
    const filter=event.target.closest('[data-filter-agent]');if(filter){state.agentFilter=filter.dataset.filterAgent;render();return;}
    const requirement=event.target.closest('[data-market-requirement]');if(requirement){state.marketRequirement=requirement.dataset.marketRequirement;const query=new URLSearchParams({requirement:state.marketRequirement,...(state.marketAgentId?{agent:state.marketAgentId}:{})});history.replaceState(null,'',`#marketplace?${query}`);state.route=parseRoute(location.hash);render();return;}
    const tab=event.target.closest('[data-market-tab]');if(tab){state.marketTab=tab.dataset.marketTab;render();return;}
    const cat=event.target.closest('[data-category]');if(cat){state.category=cat.dataset.category;render();return;}
    const agentTab=event.target.closest('[data-agent-tab]');if(agentTab){state.agentTab=agentTab.dataset.agentTab;render();return;}
    const control=event.target.closest('[data-action]');if(!control||control.disabled)return;const action=control.dataset.action;
    if(action==='ai-demo-control'){task(async()=>{await api('/api/workspace/ai-demo/control',{method:'POST',body:{operation:control.dataset.operation}});},{toast:'AI demo control updated'});return;}
    if(action==='integration-feed-plan'){task(async()=>{state.integrationResult=await api('/api/workspace/near-integrations/checkpoint-feed',{method:'POST',body:{destination:'near.social'}});},{toast:'Prepared public checkpoint scope; nothing was published'});return;}
    if(action==='integration-sign-owner'){task(async()=>{const original=state.integrationResult,signedData=await signWithEvmWallet(original.intent,window.ethereum);state.integrationKind='owner_submit';state.integrationDraft=JSON.stringify({intentPlanId:original.planId,signedData},null,2);state.integrationResult={walletSigned:true,authorityGranted:false,nextAction:'Prepare the signed submission for separate Rules review.'};},{reload:false,toast:'Original wallet signature prepared; nothing submitted'});return;}
    if(action==='chain-inspect'){task(async()=>{state.ledgerChain=await api('/api/workspace/ledger-chain/inspect',{method:'POST',body:{}});},{reload:false,toast:'Read-only chain check finished. No transaction was sent.'});return;}
    if(action==='chain-balance'){task(async()=>{state.chainResult=await api('/api/workspace/ledger-chain/balance',{method:'POST',body:{}});},{toast:'Native resource read separately from Intents and inference credit'});return;}
    if(action==='chain-export'){task(async()=>{const result=await api('/api/workspace/ledger-chain/export',{method:'POST',body:{}}),url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='company-ledger-public-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},{reload:false,toast:'Exported hashes and audit metadata. Private payloads are excluded.'});return;}
    if(action==='chain-prepare'){const key=state.chainPrepareKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/ledger-chain/prepare',{method:'POST',body:{limit:50},key});state.chainPrepareKey=null;},{toast:'Unsigned batch saved. No transaction was sent.'});return;}
    if(action==='care-start'||action==='care-new'){task(startCare);return;}
    if(action==='care-refresh'||action==='support-refresh'){task(load,{reload:false});return;}
    if(action==='support-demo'){const key=state.supportDemoKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/support/demo',{method:'POST',body:{},key});state.supportDemoKey=null;},{toast:'Fictional policies saved to JBrain and support agents published'});return;}
    if(action==='care-escalate'){const session=careSession(state.route.sub);if(!session)return;const key=state.careEscalationKey??=crypto.randomUUID();task(async()=>{await api('/api/support/conversations/'+encodeURIComponent(session.id)+'/escalate',{method:'POST',body:{},token:session.token,key});state.careEscalationKey=null;},{toast:'Review request recorded in the company inbox'});return;}
    if(action==='setup-demo'){
     task(async()=>{if(state.localDemo?.active){location.assign(state.localDemo.returnUrl+'/#autonomy');return;}location.hash=state.route.page==='demo'?'#autonomy':'#demo';},{reload:false});return;
    }
    if(action==='setup-example'){
     const form=root.querySelector('#company-brief-form'),values=form?Object.fromEntries(new FormData(form)):{};
     if(form)state.companySetupDraft={...state.companySetupDraft,brief:Object.fromEntries(['name','purpose','industry','customer','outcome','objective'].map(key=>[key,values[key]])),intent:{...AUTONOMY_INTENT,...state.autonomy?.company?.intent,...state.companySetupDraft?.intent,maxAgents:Number(values.maxAgents)}};
     state.exampleMode=!state.exampleMode;try{if(state.exampleMode)sessionStorage.setItem('near:setup-example','on');else sessionStorage.removeItem('near:setup-example');}catch{}
     if(state.exampleMode){if(form)state.companySetupDraft=setupDemoDraft(state,values);state.toast='Fictional example text filled. Review it, then use the normal save buttons.';state.error=null;announce(state.toast);if(location.hash!=='#setup/org'){navigate('setup/org');return;}}
     else{state.toast='Example fields off. Your entered and saved details are preserved.';announce(state.toast);}
     render();return;
    }
    if(['toggle-menu','close-menu'].includes(action)){state.menuOpen=action==='toggle-menu'?!state.menuOpen:false;render();return;}
    if(['help','close-help'].includes(action)){state.helpOpen=action==='help';render();if(state.helpOpen)root.querySelector('.help-dialog button')?.focus();return;}
    if(action==='company-finish-setup'){const key=state.companyFinishKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/setup-review',{method:'POST',key,body:{version:state.autonomy.company.version}});state.companyFinishKey=null;location.hash='autonomy';},{toast:'Setup reviewed. Open the company when you are ready to start work.'});return;}
    if(action==='autonomy-bootstrap'){if(state.autonomy?.company?.managerId){location.hash='autonomy';return;}const key=state.autonomyBootstrapKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/bootstrap',{method:'POST',key,body:{version:state.autonomy.company.version}});state.autonomyBootstrapKey=null;location.hash='autonomy';},{toast:'Core agents and company objective created'});return;}
    if(['autonomy-start','autonomy-pause','autonomy-resume'].includes(action)){const operation=action.slice(9),key=state.autonomyControlKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/control',{method:'POST',key,body:{version:state.autonomy.company.version,operation}});state.autonomyControlKey=null;},{toast:operation==='pause'?'New company work paused':'Company operating intent saved'});return;}
    if(action==='autonomy-bind-runtime'){const key=state.autonomyBindKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/control',{method:'POST',key,body:{version:state.autonomy.company.version,operation:'bind_runtime'}});state.autonomyBindKey=null;},{toast:'Runtime metadata bound. Execution remains paused and requires verification.'});return;}
    if(action==='autonomy-switch-mode'){const key=state.autonomyModeKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/control',{method:'POST',key,body:{version:state.autonomy.company.version,operation:'switch_mode',operatingMode:control.dataset.mode}});state.autonomyModeKey=null;location.hash=control.dataset.mode==='one'?'setup':'autonomy';},{toast:'Operating mode changed; new agent work paused'});return;}
    if(action==='autonomy-evaluate'){const key=state.autonomyEvaluationKey??=crypto.randomUUID();task(async()=>{await api('/api/workspace/autonomy/evaluations',{method:'POST',key,body:{improvementId:control.dataset.id}});state.autonomyEvaluationKey=null;},{toast:'Fixed evaluation recorded; promotion follows Rules'});return;}
    if(action==='autonomy-ledger-more'){task(async()=>{const next=await api('/api/workspace/autonomy?cursor='+state.autonomy.nextCursor);state.autonomy={...next,events:[...state.autonomy.events,...next.events]};},{reload:false});return;}
    if(action==='knowledge-source'){rememberKnowledgeDraft();state.knowledgeSource=control.dataset.source;state.knowledgeFile=null;render();return;}
    if(action==='knowledge-import-file'||action==='knowledge-import-website'){rememberKnowledgeDraft();state.knowledgeImporting=true;state.toast=null;task(async()=>{try{const result=action==='knowledge-import-file'?await previewKnowledgeFile(state.knowledgeFile,state.knowledgeSource,state.knowledge.limits.import):await api('/api/knowledge/import',{method:'POST',body:{kind:'website',url:state.knowledgeUrl??''}});acceptKnowledgePreview(result);}finally{state.knowledgeImporting=false;}},{reload:false,toast:'Source imported. Review the text before saving.'});return;}
    if(action==='select-runtime'){const agent=state.data.agents.find(a=>a.id===control.dataset.id);task(()=>api(`/api/agents/${agent.id}/update`,{method:'POST',body:{runtime:'live',version:agent.version}}),{toast:'Runtime metadata updated. Provider verification is still required.'});return;}
    if(action==='cloud-catalog'){task(()=>api('/api/workspace/cloud/catalog',{method:'POST',body:{}}),{toast:'Public model catalogue refreshed. Model selection is unchanged.'});return;}
    if(action==='verify-cloud'){task(async()=>{state.cloudVerification=await api('/api/workspace/inference/preflight',{method:'POST',body:{}});},{toast:'Attestation check recorded'});return;}
    if(action==='probe-runtime'){task(()=>api('/api/workspace/probes',{method:'POST',body:{capability:control.dataset.capability}}),{toast:'Read-only check recorded'});return;}
    if(action==='pause-company'){task(()=>api('/api/workspace/pause',{method:'POST',body:{version:state.operation.organization.version}}),{toast:'Company paused'});return;}
    if(action==='clear-market-search'){state.marketSearch='';render();return;}
    if(action==='reload-workspace'){task(load,{reload:false});return;}
    if(action==='dismiss-error'){state.error=null;render();return;}
    if(['pause-agent','resume-agent'].includes(action)){const a=state.data.agents.find(x=>x.id===control.dataset.id);task(()=>api(`/api/agents/${a.id}/update`,{method:'POST',body:{status:action==='pause-agent'?'paused':'ready',version:a.version}}),{toast:action==='pause-agent'?'New tasks paused':'Agent ready'});return;}
    if(action==='setup-review'){const step=state.setup.progress.steps.find(x=>x.id===control.dataset.step),next=state.setup.progress.steps[step.number];task(async()=>{await api('/api/workspace/setup/review',{method:'POST',body:{stepId:step.id,version:state.setup.organization.version}});location.hash=next?`setup/${next.id}`:'setup/complete';},{toast:step.id==='brain'?'Organization setup complete':'Step reviewed'});return;}
    if(action==='share-report'){state.sharing=true;render();return;}
    if(action==='cancel-share'){state.sharing=false;render();return;}
    if(action==='copy-task-key'){task(()=>navigator.clipboard.writeText(getToken(state.order.id)),{reload:false,toast:'Private access key copied'});return;}
    if(action==='download'&&state.artifact){const url=URL.createObjectURL(new Blob([state.artifact.content],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=`report-${state.order.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);return;}
    if(action==='refresh'){task(load,{reload:false});return;}
    if(['run','report','refresh-task','check-payment'].includes(action))task(async()=>{
      const id=state.order.id,token=getToken(id),endpoint=`/api/orders/${id}`;
      if(action==='check-payment')await api(endpoint+'/check-payment',{method:'POST',token});
      if(action==='run')await api(endpoint+'/run',{method:'POST',token});
      if(action==='report')state.artifact=(await api(endpoint+'/report',{token})).artifact;
    });
  });
  root.addEventListener('input',event=>{const input=event.target;if(input.id==='care-question'){if(state.careDraft!==input.value)state.careMessageKey=null;state.careDraft=input.value;return;}if(!input.dataset.search)return;const value=input.value,position=input.selectionStart;if(input.dataset.search==='agents')state.search=value;else state.marketSearch=value;render();const next=root.querySelector(`[data-search="${input.dataset.search}"]`);next?.focus();next?.setSelectionRange(position,position);});
  root.addEventListener('change',event=>{if(event.target.id==='ai-demo-agent'){state.aiDemoQuestion=root.querySelector('#ai-demo-question')?.value??'';state.aiDemoAgentId=event.target.value;state.aiDemoKey=null;render();return;}if(event.target.id==='knowledge-file'){rememberKnowledgeDraft();state.knowledgeFile=event.target.files?.[0]??null;render();return;}if(event.target.id==='market-agent'){state.marketAgentId=event.target.value;const query=new URLSearchParams({requirement:state.route.params.get('requirement')??state.marketRequirement??'all',agent:state.marketAgentId});history.replaceState(null,'',`#marketplace?${query}`);state.route=parseRoute(location.hash);render();return;}if(event.target.id==='agent-sort'){state.sort=event.target.value;render();}});
  document.querySelector('.skip-link')?.addEventListener('click',()=>root.querySelector('#main')?.focus());
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(state.helpOpen||state.menuOpen)){state.helpOpen=false;state.menuOpen=false;render();}});
  window.addEventListener('hashchange',()=>{state.route=parseRoute(location.hash);state.error=null;state.toast=null;state.draft={};state.knowledgeDraft=null;state.knowledgeKey=null;state.knowledgeSource='write';state.knowledgeFile=null;state.knowledgeImportPreview=null;state.knowledgeUrl='';state.sharing=false;state.taskKnowledge=null;state.menuOpen=false;state.artifact=null;if(state.route.page==='order'&&state.order?.id!==state.route.sub)state.order=null;window.scrollTo(0,0);task(load,{reload:false});});
  setInterval(async()=>{if(state.busy||state.route.page!=='autonomy'||state.route.sub==='setup')return;try{const fresh=await api('/api/workspace/autonomy');const hash=JSON.stringify(fresh);if(hash!==JSON.stringify(state.autonomy)&&!root.contains(document.activeElement)){state.autonomy=fresh;render();}else if(hash!==JSON.stringify(state.autonomy)&&document.activeElement===document.body){state.autonomy=fresh;render();}}catch{}},5000);
  setInterval(async()=>{if(state.busy||state.route.page!=='order'||!state.order||['complete','refunded'].includes(state.order.status))return;try{state.order=(await api(`/api/orders/${state.order.id}`,{token:getToken(state.order.id)})).order;render();}catch{}},3000);
  render();task(load,{reload:false});
}
