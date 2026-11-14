import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const customerCareBrief={name:'Northstar Care',purpose:'Provide customer-care services to other companies using scoped company knowledge and tracked owner escalations.',industry:'Business customer care · fictional insurance demonstration',customer:'Harbor Mutual Insurance — fictional demonstration client',outcome:'Cited answers to sample policy questions and persistent review requests for unsupported or individual claim decisions.',objective:'Operate customer care for fictional Harbor Mutual Insurance, using published policy and claims guides. Record unsupported questions for owner review; never approve claims or move funds.'};
const initialIntent={maxAgents:6,maxOpenWork:12,maxDepth:3,maxSteps:24,maxCalls:12,maxCreations:10,maxInputBytes:262144,maxResultBytes:131072,maxRetries:2,allowedResourceKinds:['skill','soul'],allowedPatchKinds:['template.add_optional_field','template.require_field']};

/** Explicit owner-requested configuration only. No provider, key, money or activation. */
export async function setupCustomerCareCompany(api){
 let view=await api('/api/workspace/autonomy');
 if(view.company?.started){await api('/api/workspace/autonomy/control',{body:{version:view.company.version,operation:'pause'}});view=await api('/api/workspace/autonomy');}
 if(!view.company){
   const setup=await api('/api/workspace/setup');
   await api('/api/workspace/autonomy/onboard',{body:{version:0,organizationVersion:setup.organization.version,brief:customerCareBrief,intent:initialIntent}});
 }else{
   const old=view.company;
   if(JSON.stringify(old.brief)!==JSON.stringify(customerCareBrief))await api('/api/workspace/autonomy/configure',{body:{version:old.version,operatingMode:old.operatingMode,brief:customerCareBrief,intent:old.intent}});
   const setup=await api('/api/workspace/setup');
   if(['name','purpose','industry'].some(k=>setup.organization[k]!==customerCareBrief[k]))await api('/api/workspace/organization',{body:{version:setup.organization.version,...Object.fromEntries(['name','purpose','industry'].map(k=>[k,customerCareBrief[k]]))}});
 }
 view=await api('/api/workspace/autonomy');
 const objective=view.objectives?.find(o=>o.id===view.company.objectiveId);
 if(objective&&objective.topic!==customerCareBrief.objective)await api('/api/workspace/autonomy/control',{body:{version:view.company.version,operation:'replace_objective',objective:customerCareBrief.objective}});
 const pack=await api('/api/workspace/support/demo',{body:{}});
 return {companyName:customerCareBrief.name,services:pack.services,agents:pack.agents?.map(a=>({id:a.id,name:a.name})),documents:pack.documents?.map(d=>({id:d.id,title:d.title,revision:d.revision})),fictional:true,replyMode:pack.replyMode,aiEnabled:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const base=process.argv[2]??'http://127.0.0.1:4173';
 const url=new URL(base);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Use the existing local owner connection.');
 const api=async(route,{body}={})=>{const r=await fetch(new URL(route,base),{method:body?'POST':'GET',headers:body?{'content-type':'application/json','idempotency-key':randomUUID()}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error?.message??r.statusText);return data;};
 const summary=await setupCustomerCareCompany(api);console.log(JSON.stringify({...summary,customerPortal:base+'/#care',ownerInbox:base+'/#support'},null,2));
}
