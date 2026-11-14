import {randomUUID} from 'node:crypto';
import {fingerprint,ContractError} from '../contracts.mjs';
import {catalog as defaultCatalog} from './catalog.mjs';
import {resolveEffectiveContext} from '../autonomy/context.mjs';
const fail=(code,message)=>{throw new ContractError(code,message);};
const text=(value,name,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail('INVALID_INPUT',`${name} is required and must be at most ${max} characters.`);return value.trim();};
const clone=v=>structuredClone(v);
export function createWorkspace({journal,workflow,rules,knowledge,companyId='local-workspace',readiness=()=>[],clock=()=>new Date(),catalog=defaultCatalog}) {
  let queue=Promise.resolve();
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const now=()=>new Date(clock()).toISOString();
  const profile=id=>journal.get('agents',id)??fail('NOT_FOUND','Agent not found.');
  const ownerContext=access=>access??(rules.snapshot().mode==='fixture'?{verifiedLocal:true,role:'owner',companyId}:{verified:false,role:'public',companyId});
  const gate=(type,agent,access,input)=>{const d=rules.evaluate({id:`workspace:${type}:${agent?.id??'new'}`,type,mode:rules.snapshot().mode},{agent,input,access:ownerContext(access),catalog:resourceCatalog(),licenses:journal.list('resourceLicenses')});if(d.status!=='allow')fail('POLICY_BLOCK',d.reasonCode);return d;};
  const organization=()=>journal.get('organization',companyId)??{id:companyId,name:'',purpose:'',industry:'',version:0,setupReviews:{}};
  const resourceCatalog=()=>catalog.map(item=>({...item,version:item.version??'1'}));
  // Presentation is the latest CURRENT M01 decision per capability, never the raw observation log
  // (which keeps every expired/duplicate probe). Fixture mode keeps its local runner facts.
  function readinessPlan(access){const d=rules.evaluate({id:`workspace-readiness:${randomUUID()}`,type:'runtime_readiness'},{access:ownerContext(access)});return d.status==='allow'?d.plan:null;}
  async function infrastructure(access){
    if(rules.snapshot().mode==='fixture')return readiness();
    const plan=readinessPlan(access);
    return (plan?.requirements??[]).map(r=>({...r,module:r.capability,mode:r.status}));
  }
  async function setupFacts(access){return {access:ownerContext(access),companyId,organization:organization(),agents:journal.list('agents'),infrastructure:await infrastructure(access),brain:knowledge?await knowledge.view(undefined,ownerContext(access)):{status:'unavailable',documents:[]}};}
  function activationPlan(facts,access){const d=rules.evaluate({id:`organization:activation-status:${randomUUID()}`,type:'company_activation_status',mode:rules.snapshot().mode},{...facts,access:ownerContext(access??facts.access)});return d.status==='allow'?d.plan:{kind:'activation_status',ready:false,basis:null,unifiedReviewed:false,blockers:[{reasonCode:d.reasonCode}],grantsSpendingAuthority:false};}
  function setupDecision(type,facts,extra={},access){const d=rules.evaluate({id:`organization:${type}:${randomUUID()}`,type,mode:rules.snapshot().mode,...extra},{...facts,access:ownerContext(access??facts.access)});if(d.status!=='allow')fail('POLICY_BLOCK',d.plan?.requirement??d.reasonCode);return d;}
  function skills(ids=[],access) {if(!Array.isArray(ids)||ids.some(id=>!catalog.some(x=>x.id===id&&x.kind==='skill')))fail('INVALID_INPUT','Choose skills from the workspace catalog.');for(const id of ids){const listing=catalog.find(x=>x.id===id);if(listing.purchaseRequired){const d=rules.evaluate({id:`skill-check:${id}`,type:'resource_bind',mode:rules.snapshot().mode},{access:ownerContext(access),agent:{id:'candidate'},listing,licenses:journal.list('resourceLicenses')});if(d.status!=='allow')fail('POLICY_BLOCK',d.reasonCode);}}return [...new Set(ids)];}
  function summarize(task) {let order;try{order=workflow.getOrder(task.orderId);}catch{}return {...task,status:order?.status??task.status,reportAvailable:!!order?.reportAvailable,reasonCode:order?.reasonCode??null};}
  function activity() {return journal.list('workspaceActivity').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30);}
  async function writeAgent(agent,kind,actionId=randomUUID()) {
    await journal.transaction({actionId:`agent:${actionId}`,fingerprint:fingerprint(agent)},tx=>{tx.put('agents',agent.id,agent);const id=randomUUID();tx.put('workspaceActivity',id,{id,agentId:agent.id,agentName:agent.name,type:kind,at:now()});tx.append(kind,{companyId,actorKind:'owner',actorId:'owner',agentId:agent.id,agentName:agent.name,revision:agent.version,status:agent.status,summary:'Agent profile updated'});if(kind!=='agent.updated')tx.append('agent.updated',{companyId,actorKind:'owner',actorId:'owner',agentId:agent.id,agentName:agent.name,revision:agent.version,status:agent.status,reasonCode:kind,summary:'Agent profile updated'});return agent;});return agent;
  }
  async function createTaskImpl(agentId,input,access){
      const agent=profile(agentId);gate('agent_task',agent,access);
      const allowed=['question','geography','timeHorizon','serviceId','sourceAsset','sourceNetwork','refundRecipient','actionId','knowledgeIds'];if(Object.keys(input).some(k=>!allowed.includes(k)))fail('INVALID_INPUT','Unsupported task field.');
      const question=text(input.question,'Task brief',24000);
      const service=input.serviceId?catalog.find(x=>x.id===input.serviceId&&x.kind==='service'):null;if(input.serviceId&&!service)fail('INVALID_INPUT','Service not found.');
      const companyKnowledge=knowledge?await knowledge.capture(agent.id,input.knowledgeIds,ownerContext(access)):null;
      const effective=resolveEffectiveContext({journal,catalog:resourceCatalog(),companyId,agent,companyKnowledge});
      const context={...(companyKnowledge?{companyKnowledge}:{}),companyId,id:agent.id,name:agent.name,role:agent.role,instructions:effective.instructions,version:agent.version,resourceBindings:clone(agent.resourceBindings??[]),skills:effective.skills,effectiveContext:effective,service:service?{id:service.id,name:service.name,instructions:service.prompt}:null};
      const created=await workflow.createOrder({question,geography:input.geography,timeHorizon:input.timeHorizon,sourceAsset:input.sourceAsset,sourceNetwork:input.sourceNetwork,refundRecipient:input.refundRecipient,actionId:input.actionId,agentContext:context,taskMetadata:{companyId,agentId,agentName:agent.name,agentVersion:agent.version,serviceId:service?.id??null,serviceName:service?.name??null}});
      const task=journal.get('agentTasks',created.order.id);return {...created,task};
  }
  const api={
    async initialize() {},
    async setup(access){const facts=await setupFacts(access);return {organization:facts.organization,progress:setupDecision('organization_setup',facts).plan,infrastructure:facts.infrastructure,readiness:readinessPlan(access),activation:activationPlan(facts,access),brain:facts.brain};},
    saveOrganization(input,access){return serial(async()=>{if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['name','purpose','industry','version'].includes(k)))fail('INVALID_INPUT','Unsupported organization field.');const old=organization();if(input.version!==old.version)fail('CONFLICT','Organization settings changed. Refresh before saving.');const d=setupDecision('organization_manage',{input}, {},access),next={...old,name:d.plan.name,purpose:d.plan.purpose,industry:d.plan.industry,version:old.version+1,updatedAt:now()};await journal.transaction({actionId:`organization:${randomUUID()}`,fingerprint:fingerprint(next)},tx=>{tx.put('organization',companyId,next);return null;});return {organization:next};});},
    reviewSetup(input,access){return serial(async()=>{if(!input||Object.keys(input).some(k=>!['stepId','version'].includes(k)))fail('INVALID_INPUT','Unsupported setup field.');const old=organization();if(input.version!==old.version)fail('CONFLICT','Setup changed. Refresh before continuing.');const facts=await setupFacts(access),d=setupDecision('organization_setup_review',facts,{stepId:input.stepId}),next={...old,setupReviews:{...old.setupReviews,[d.plan.stepId]:d.plan.reviewFingerprint},version:old.version+1,updatedAt:now()};await journal.transaction({actionId:`setup-review:${randomUUID()}`,fingerprint:fingerprint(next)},tx=>{tx.put('organization',companyId,next);return null;});return {organization:next};});},
    async operation(access){const f=await setupFacts(access),policy=rules.snapshot();return {organization:f.organization,setup:setupDecision('organization_setup',f).plan,mode:policy.mode,policyVersion:policy.policyVersion,readiness:readinessPlan(access),activationStatus:activationPlan(f,access),price:policy.config?{...policy.config.settlementAsset,amount:policy.config.pricing.minimumAtomic}:null,limits:policy.config?.spending??null,contributors:policy.config?.revenue?.contributors??[],procurement:policy.config?.procurement??null,infrastructure:f.infrastructure,services:resourceCatalog().filter(x=>x.kind==='service'),agents:f.agents,licenses:journal.list('resourceLicenses'),activation:f.organization.activation??{state:'setup_reviewed'}};},
    activate(input,access){return serial(async()=>{if(!input||Object.keys(input).some(k=>!['version','agentId','serviceId','knowledgeIds'].includes(k))||!Array.isArray(input.knowledgeIds??[])||(input.knowledgeIds??[]).some(id=>typeof id!=='string'))fail('INVALID_INPUT','Choose an agent, service and knowledge documents.');const old=organization();if(input.version!==old.version)fail('CONFLICT','Organization changed. Refresh before activation.');const f=await setupFacts(access),agent=profile(input.agentId),listing=resourceCatalog().find(x=>x.id===input.serviceId),knowledgeIds=input.knowledgeIds??[];if(knowledgeIds.length)await knowledge.capture(agent.id,knowledgeIds,ownerContext(access));const d=setupDecision('company_activate',{...f,agent,listing,knowledgeIds},{},access);const next={...old,activation:d.plan.activation,version:old.version+1,updatedAt:now()};await journal.transaction({actionId:`activate:${companyId}:${next.version}`,fingerprint:fingerprint(next)},tx=>{tx.put('organization',companyId,next);return null;});return {organization:next};});},
    pause(input,access){return serial(async()=>{const old=organization();if(input.version!==old.version)fail('CONFLICT','Organization changed.');const d=setupDecision('company_pause',{}, {},access),next={...old,activation:{...old.activation,...d.plan.activation},version:old.version+1,updatedAt:now()};await journal.transaction({actionId:`pause:${companyId}:${next.version}`,fingerprint:fingerprint(next)},tx=>{tx.put('organization',companyId,next);return null;});return {organization:next};});},
    services(){const org=organization(),a=org.activation;if(!a)return [];const listing=resourceCatalog().find(x=>x.id===a.serviceId);const d=rules.evaluate({id:`service-view:${a.serviceId}`,type:'service_order',mode:rules.snapshot().mode},{organization:org,agent:journal.get('agents',a.agentId),listing});return d.status==='allow'?[{id:a.serviceId,name:a.serviceName,price:a.price,mode:rules.snapshot().mode,available:true}]:[];},
    createServiceOrder(serviceId,input){return serial(async()=>{const org=organization(),a=org.activation;const agent=a?profile(a.agentId):null,listing=resourceCatalog().find(x=>x.id===serviceId);const d=rules.evaluate({id:`service-order:${input.actionId??randomUUID()}`,type:'service_order',mode:rules.snapshot().mode},{organization:org,agent,listing});if(d.status!=='allow')fail('POLICY_BLOCK',d.reasonCode);const created=await createTaskImpl(agent.id,{...input,serviceId,knowledgeIds:d.plan.knowledgeIds});await workflow.quote(created.order.id);return {...created,order:workflow.getOrder(created.order.id)};});},
    bindResource(id,input,access){return serial(async()=>{const agent=profile(id);if(input.version!==agent.version)fail('CONFLICT','Agent changed. Refresh before connecting a resource.');const listing=resourceCatalog().find(x=>x.id===input.listingId),d=setupDecision('resource_bind',{agent,listing,licenses:journal.list('resourceLicenses')},{},access);const bindings=[...(agent.resourceBindings??[]).filter(x=>x.id!==listing.id&&(['inference','wallet','knowledge'].includes(listing.kind)?x.kind!==listing.kind:true)),d.plan.binding];const next={...agent,resourceBindings:bindings,skillIds:listing.kind==='skill'?[...new Set([...agent.skillIds,listing.id])]:agent.skillIds,instructions:listing.kind==='soul'?`${agent.instructions}\n\n${listing.instructions}`:agent.instructions,version:agent.version+1,updatedAt:now()};return {agent:await writeAgent(next,'resource.connected')};});},
    view() {return {organization:organization(),workspace:{id:companyId,name:organization().name||journal.get('autonomousCompanies',companyId)?.brief?.name||'My workspace',operatingMode:journal.get('autonomousCompanies',companyId)?.operatingMode??'one',mode:rules.snapshot().mode,localOnly:rules.snapshot().mode==='fixture'},agents:journal.list('agents'),tasks:journal.list('agentTasks').map(summarize).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),activity:activity(),catalog:clone(resourceCatalog())};},
    get(id) {const agent=profile(id);return {agent,tasks:journal.list('agentTasks').filter(x=>x.agentId===id).map(summarize),activity:activity().filter(x=>x.agentId===id)};},
    create(input,access) {return serial(async()=>{
      gate('agent_manage',null,access);
      const allowed=['name','role','description','instructions','skillIds','templateId','status','runtime','actionId'];if(Object.keys(input).some(k=>!allowed.includes(k)))fail('INVALID_INPUT','Unsupported agent field.');
      const template=input.templateId?catalog.find(x=>x.kind==='template'&&x.id===input.templateId):null;
      if(input.templateId&&!template)fail('INVALID_INPUT','Agent template not found.');
      const status=input.status??'ready';if(!['ready','draft'].includes(status))fail('INVALID_INPUT','Choose ready or draft.');
      if(input.runtime&&input.runtime!==rules.snapshot().mode)fail('INVALID_INPUT','Only the local demo runner is configured.');
      const agent={schemaVersion:1,companyId,id:randomUUID(),name:text(input.name??template?.name,'Agent name',80),role:text(input.role??template?.role,'Role',100),description:String(input.description??template?.summary??'').slice(0,500),instructions:text(input.instructions??template?.instructions,'Working instructions',12000),skillIds:skills(input.skillIds??template?.skills,access),templateId:template?.id??null,color:template?.color??'blue',icon:template?.icon??'bot',status,runtime:rules.snapshot().mode,resourceBindings:[],version:1,createdAt:now(),updatedAt:now()};
      if(input.actionId) {const prior=journal.get('agentCreateRequests',input.actionId);if(prior){if(prior.fingerprint!==fingerprint({...input,actionId:undefined}))fail('CONFLICT','Creation request changed.');return {agent:profile(prior.id)};}}
      await journal.transaction({actionId:`agent-create:${input.actionId??agent.id}`,fingerprint:fingerprint({...input,actionId:undefined})},tx=>{tx.put('agents',agent.id,agent);if(input.actionId)tx.put('agentCreateRequests',input.actionId,{id:agent.id,fingerprint:fingerprint({...input,actionId:undefined})});const id=randomUUID();tx.put('workspaceActivity',id,{id,agentId:agent.id,agentName:agent.name,type:'agent.created',at:now()});tx.append('agent.created',{companyId,actorKind:'owner',actorId:'owner',agentId:agent.id,agentName:agent.name,revision:agent.version,status:agent.status,summary:'Agent profile created'});return agent;});return {agent};
    });},
    update(id,input,access) {return serial(async()=>{
      const old=profile(id),decision=gate('agent_manage',old,access,input);
      const allowed=['name','role','description','instructions','skillIds','status','version','runtime'];if(Object.keys(input).some(k=>!allowed.includes(k)))fail('INVALID_INPUT','Unsupported agent field.');
      if(input.version!==old.version)fail('CONFLICT','This agent changed. Refresh it before saving.');
      if(input.status&&!['ready','paused','draft'].includes(input.status))fail('INVALID_INPUT','Unknown agent status.');
      const {runtime:requestedRuntime,...changes}=input;
      const agent={...old,...changes,...(decision.plan?.agentPatch??{}),name:input.name===undefined?old.name:text(input.name,'Agent name',80),role:input.role===undefined?old.role:text(input.role,'Role',100),instructions:input.instructions===undefined?old.instructions:text(input.instructions,'Working instructions',12000),skillIds:input.skillIds===undefined?old.skillIds:skills(input.skillIds,access),version:old.version+1,updatedAt:now()};
      return {agent:await writeAgent(agent,'agent.updated')};
    });},
    install(agentId,listingId,access) {return serial(async()=>{
      const old=profile(agentId);gate('agent_manage',old,access);const item=catalog.find(x=>x.id===listingId&&x.kind==='skill');if(!item)fail('INVALID_INPUT','Choose a skill listing.');
      skills([item.id],access);
      if(old.skillIds.includes(item.id))return {agent:old,alreadyInstalled:true};
      const agent={...old,skillIds:[...old.skillIds,item.id],version:old.version+1,updatedAt:now()};return {agent:await writeAgent(agent,'skill.installed')};
    });},
    createTask:(agentId,input,access)=>serial(()=>createTaskImpl(agentId,input,access)),
  };
  return api;
}
