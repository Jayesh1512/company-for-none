import {hash} from './config.mjs';
import {allow,deny,hold} from './policies.mjs';
const definitions=[['org','Define Org'],['agents','Define Agents'],['profiles','Add Profiles'],['skills','Enhance Skills'],['infra','Set Up Infra'],['brain','Company Brain']];
export function organizationSetup(facts){
 const org=facts.organization??{},agents=facts.agents??[],brain=facts.brain??{},infra=facts.infrastructure??[];
 const sorted=[...agents].sort((a,b)=>a.id.localeCompare(b.id));
 const validProfiles=agents.filter(a=>a.name?.trim()&&a.role?.trim()&&a.instructions?.trim());
 const skilled=agents.filter(a=>a.skillIds?.length);
 const shared=(brain.documents??[]).filter(d=>d.visibility==='company'||d.agentIds?.some(id=>agents.some(a=>a.id===id)));
 const fixture=facts.mode==='fixture',requirements=facts.rulesReadiness?.requirements??[];
 const runtimeReady=fixture?infra.length===4&&infra.every(x=>x.mode==='fixture'):facts.rulesReadiness?.ready===true;
 const brainReady=fixture?brain.status==='connected':requirements.some(x=>x.capability==='jbrain'&&x.status==='verified');
 const ready={org:!!(org.name?.trim()&&org.purpose?.trim()),agents:agents.length>0,profiles:agents.length>0&&validProfiles.length===agents.length,skills:agents.length>0&&skilled.length===agents.length,infra:runtimeReady,brain:brainReady&&shared.length>0};
 const signatures={agents:hash(sorted.map(a=>({id:a.id,role:a.role}))),profiles:hash(sorted.map(a=>({id:a.id,name:a.name,role:a.role,instructions:a.instructions}))),skills:hash(sorted.map(a=>({id:a.id,skills:[...(a.skillIds??[])].sort()}))),infra:hash(fixture?infra.map(x=>({module:x.module,mode:x.mode,provider:x.provider})):requirements),brain:hash({companyId:facts.companyId,provider:'jbrain'})};
 const summaries={org:ready.org?org.name:'Name your company and its purpose',agents:`${agents.length} ${agents.length===1?'agent':'agents'} defined`,profiles:`${validProfiles.length} of ${agents.length} profiles configured`,skills:`${skilled.length} of ${agents.length} agents have skills`,infra:runtimeReady?(fixture?'Local demo runner available':'Required capabilities verified'):'Runtime verification is required',brain:brainReady?`${shared.length} shared ${shared.length===1?'document':'documents'} in JBrain`:'JBrain is not verified'};
 const notes={org:'Save your organization name and purpose.',agents:'Add at least one agent with a responsibility.',profiles:'Give every agent a name, role and working instructions.',skills:'Add at least one skill to each agent.',infra:fixture?'The supported local demo runner must be available.':'Current identity-bound provider observations and a commercial policy are required.',brain:'Connect JBrain and share a document with at least one agent.'};
 const steps=definitions.map(([id,label],i)=>({id,label,number:i+1,ready:ready[id],complete:id==='org'?ready.org:ready[id]&&org.setupReviews?.[id]===signatures[id],reviewFingerprint:signatures[id]??null,summary:summaries[id],requirement:notes[id]}));
 for(let i=0;i<steps.length;i++)steps[i].canReview=steps[i].ready&&steps.slice(0,i).every(x=>x.complete);
 return {kind:'organization_setup',steps,completedCount:steps.filter(x=>x.complete).length,totalSteps:steps.length,nextStep:steps.find(x=>!x.complete)?.id??'brain',complete:steps.every(x=>x.complete),executionMode:facts.mode??'fixture',grantsSpendingAuthority:false};
}
export function organizationDecision(action,facts){
 if(action.type==='organization_setup')return allow({plan:organizationSetup(facts)});
 if(action.type==='organization_manage'){
  const input=facts.input;
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>80||typeof input.purpose!=='string'||!input.purpose.trim()||input.purpose.length>2000||typeof (input.industry??'')!=='string'||(input.industry??'').length>100)return deny('ORGANIZATION_INPUT_INVALID');
  return allow({plan:{kind:'organization_metadata',name:input.name.trim(),purpose:input.purpose.trim(),industry:(input.industry??'').trim(),grantsSpendingAuthority:false}});
 }
 const plan=organizationSetup(facts),step=plan.steps.find(x=>x.id===action.stepId);
 if(!step||step.id==='org')return deny('INVALID_SETUP_STEP');
 if(!step.canReview)return hold(step.ready?'SETUP_PREVIOUS_STEPS_REQUIRED':'SETUP_STEP_NOT_READY',{plan:{stepId:step.id,requirement:step.ready?'Review the earlier setup steps first.':step.requirement}});
 return allow({plan:{kind:'organization_setup_review',stepId:step.id,reviewFingerprint:step.reviewFingerprint,grantsSpendingAuthority:false}});
}
