import {allow,deny,hold} from './policies.mjs';
import {ownerAccess} from './runtime.mjs';

export const LOCAL_DEMO_KIND='real-local-demo';
export const LOCAL_DEMO_ACTIONS=['local_demo_open','local_demo_status'];
export function localDemoDecision(action,facts,{companyId,mode,context}){
 if(!ownerAccess(facts.access,companyId,mode))return deny('ACCESS_DENIED');
 if(!LOCAL_DEMO_ACTIONS.includes(action.type)||Object.keys(facts.input??{}).length)return deny('INVALID_INPUT');
 return allow({plan:{kind:action.type,active:context?.kind===LOCAL_DEMO_KIND,...(context?.kind===LOCAL_DEMO_KIND?{returnUrl:context.returnUrl}:{}),grantsSpendingAuthority:false,providerCalled:false}});
}
/** This server-owned context only RESTRICTS authority; request facts cannot set it. */
export function localDemoRestriction(action,context,effects,input={}){
 if(context?.kind!==LOCAL_DEMO_KIND)return null;
 if(effects.has(action.type)||['runtime_probe','component_preflight','cloud_catalog','cloud_usage','cloud_product_execute'].includes(action.type)||action.type==='autonomy_control'&&['start','resume','bind_runtime'].includes(input.operation))return hold('LOCAL_DEMO_SCOPE');
 return null;
}
