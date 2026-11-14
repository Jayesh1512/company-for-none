import {parseArgs} from 'node:util';
import {loadEnvFile} from 'node:process';
import {createApp} from '../src/app.mjs';

// This entry is read-only unless the owner explicitly selects --execute AND M01 approves
// the exact private one-shot manifest, existing credit, bounds and prepared request.
export async function runCloudProof(args=process.argv.slice(2)) {
  const {values}=parseArgs({args,options:{describe:{type:'boolean'},preflight:{type:'boolean'},execute:{type:'boolean'},
    model:{type:'string'},store:{type:'string'},replay:{type:'string'},inspect:{type:'string'},recover:{type:'string'},help:{type:'boolean'}}});
  if(values.help){console.log('Cloud component proof: --describe (default), --preflight, --replay private:<ref>, --inspect component:<id>, --recover <original-prepared-operation-id>, or --execute. Optional --model <server-selected-model> --store <private-directory>. Paid execution requires a private exact one-shot authorization and verified credit; no budgets are inferred.');return;}
  try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
  const app=await createApp({directory:values.store??'.runtime/cloud-proof',...(values.model?{componentModel:values.model}:{})});
  try{
    const access={verified:true,role:'owner',companyId:process.env.SHOP_COMPANY_ID??'local-workspace'};
    const authorization=app.providers.getComponentAuthorization();
    const request=authorization?.request;
    let outcome;
    if(values.inspect)outcome=await app.components.inspect(access,{id:values.inspect});
    else if(values.recover)outcome=await app.components.recover(access,{id:values.recover});
    else if(values.execute){
      if(typeof app.components.execute!=='function')throw Object.assign(Error('The component execution path is not ready.'),{code:'COMPONENT_EXECUTION_UNAVAILABLE'});
      outcome=await app.components.execute(access);
    }else if(values.preflight)outcome=await app.components.preflight(access,{request});
    else if(values.replay)outcome=await app.components.replay(access,{request,evidenceRef:values.replay});
    else{
      const decision=app.components.describe(access,{request});
      outcome={status:decision.status,reasonCode:decision.reasonCode,model:decision.plan?.model,
        verificationSpec:decision.plan?.verificationSpec,requestFingerprint:decision.plan?.requestFingerprint,
        readOnly:true,completionSent:false,grantsSpendingAuthority:false};
    }
    console.log(JSON.stringify(outcome,null,2));
  }finally{await app.close();}
}
if(import.meta.url===new URL(process.argv[1],'file:').href)runCloudProof().catch(error=>{
  console.error(JSON.stringify({status:'blocked',code:error.code??'PROOF_UNAVAILABLE',message:error.code==='POLICY_BLOCK'?error.message:'The proof command could not complete. Inspect private evidence and configuration.'}));process.exitCode=1;
});
