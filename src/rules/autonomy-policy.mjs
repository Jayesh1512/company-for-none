export const AUTONOMY_LIMITS=Object.freeze({maxAgents:64,maxOpenWork:256,maxDepth:16,maxSteps:4096,maxCalls:1024,maxCreations:256,maxInputBytes:16777216,maxResultBytes:4194304,maxRetries:16});
export const RESOURCE_KINDS=Object.freeze(['skill','soul','inference','knowledge','connector','wallet','service']);
export const PATCH_KINDS=Object.freeze(['template.add_optional_field','template.require_field','instructions.propose']);
export const DEFAULT_INTENT=Object.freeze({maxAgents:8,maxOpenWork:16,maxDepth:4,maxSteps:64,maxCalls:0,maxCreations:8,maxInputBytes:262144,maxResultBytes:65536,maxRetries:2,allowedResourceKinds:['skill','soul'],allowedPatchKinds:['template.add_optional_field','template.require_field']});
export function validateAutonomyPolicy(value){
 const keys=[...Object.keys(AUTONOMY_LIMITS),'allowedResourceKinds','allowedPatchKinds'];
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new TypeError('Autonomy limits require the exact technical schema');
 for(const [key,max] of Object.entries(AUTONOMY_LIMITS)){
  const min=['maxCalls','maxRetries','maxDepth'].includes(key)?0:['maxAgents','maxCreations'].includes(key)?2:1;
  if(!Number.isSafeInteger(value[key])||value[key]<min||value[key]>max)throw new TypeError(`Invalid autonomy ${key}`);
 }
 for(const [key,allowed] of [['allowedResourceKinds',RESOURCE_KINDS],['allowedPatchKinds',PATCH_KINDS]])if(!Array.isArray(value[key])||new Set(value[key]).size!==value[key].length||value[key].some(x=>!allowed.includes(x)))throw new TypeError(`Invalid autonomy ${key}`);
 return structuredClone(value);
}
