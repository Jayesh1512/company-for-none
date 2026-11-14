import {freeze} from './config.mjs';

/** Formatting only. The M01 command validator, scopes, lease and SDK proof still decide admission. */
export function commandResponseFormat(){
 const string={type:'string',minLength:1},list={type:'array',items:string,maxItems:64};
 const shapes={
  delegate:{required:['kind','role','topic','instructions'],properties:{kind:{enum:['specialist','developer']},role:string,topic:string,instructions:string,skillIds:list,knowledgeIds:list,toolIds:list,targetIds:list,targetId:string,improvementId:string}},
  request_resource:{properties:{listingId:string,version:string}},
  propose_service:{properties:{baseListingId:string,title:string,inputs:{anyOf:[string,{type:'array',items:string,maxItems:16}]},deliverable:string}},
  report_gap:{properties:{targetId:string,failureCode:{type:'string',pattern:'^[A-Z0-9_]{1,80}$'},summary:string}},
  propose_patch:{properties:{improvementId:string,targetId:string,baseRevision:string,operations:{type:'array',minItems:1,maxItems:32,items:{type:'object',required:['type','name'],additionalProperties:false,properties:{type:{enum:['add_field','require_field']},name:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_]{0,63}$'},required:{type:'boolean'}}}}}},
  propose_change:{properties:{improvementId:string,targetId:string,kind:{enum:['instructions','host_code']},rationale:{...string,maxLength:4000},proposedText:{...string,maxLength:12000}}},
  complete_work:{properties:{summary:string,deliverable:string}},
 };
 const items={anyOf:Object.entries(shapes).map(([type,s])=>({type:'object',required:['type',...(s.required??Object.keys(s.properties))],additionalProperties:false,properties:{type:{const:type},...s.properties}}))};
 return freeze({type:'json_schema',json_schema:{name:'company_commands',strict:false,schema:{type:'object',required:['commands'],additionalProperties:false,properties:{commands:{type:'array',minItems:1,maxItems:32,items}}}}});
}
