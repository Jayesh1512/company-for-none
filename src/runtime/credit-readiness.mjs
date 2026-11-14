import {randomUUID} from 'node:crypto';
import {ContractError} from '../contracts.mjs';
import {createCloudCreditReadPort} from '../cloud-funding/index.mjs';

// Owner-only observation mechanics. Organization/credential refs come from
// private server composition; no request can select them or post credit/money.
export function createCreditReadiness({journal,rules,adapter,organizationId,sessionSecretRef,keySecretRef}){
 const gate=access=>{const d=rules.evaluate({id:'cloud-credit-read:'+randomUUID(),type:'runtime_probe',capability:'inference_credit'},{access});if(d.status!=='allow')throw new ContractError('ACCESS_DENIED',d.reasonCode);return d;};
 const port=organizationId&&sessionSecretRef&&keySecretRef?createCloudCreditReadPort({adapter,organizationId,sessionSecretRef,keySecretRef}):null;
 async function read(method,access){
  gate(access);
  if(!port)return {status:'unavailable',reasonCode:'CLOUD_CREDIT_SCOPE_REQUIRED',readOnly:true,grantsSpendingAuthority:false,accountingApplied:false};
  const result=await port[method]();gate(access);
  const artifact=await journal.putArtifact({actionId:'cloud-credit-read:'+randomUUID(),content:JSON.stringify(result),mediaType:'application/json'});
  const view=structuredClone(result);if(view.observation)delete view.observation.raw;if(view.attribution)delete view.attribution.raw;
  return {...view,readOnly:true,grantsSpendingAuthority:false,accountingApplied:false,evidenceRef:'private:'+artifact.id};
 }
 return Object.freeze({attribution:access=>read('attributeKey',access),balance:access=>read('observeBalance',access)});
}
