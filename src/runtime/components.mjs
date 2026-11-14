import {randomUUID} from 'node:crypto';
import {fingerprint,ContractError} from '../contracts.mjs';
import {createOperationRuntime,capability} from '../custody/adapter-runtime.mjs';

/** Owner-invoked Cloud component checks. No completion runs during construction or preflight. */
export function createCloudComponents({journal,rules,treasury,providers,clock=()=>new Date(),
  loadVerification=()=>import('../inference/verification.mjs')}) {
  let queue=Promise.resolve();
  const serial=work=>{const pending=queue.then(work);queue=pending.catch(()=>{});return pending;};
  const ownerDecision=(action,access,extra={})=>rules.evaluate(action,{access,...extra});
  const requireAllow=decision=>{
    if(decision.status!=='allow')throw new ContractError('POLICY_BLOCK',decision.reasonCode);
    return decision;
  };
  async function persistVerification(result) {
    const id=result.id??`verification:${fingerprint(result)}`;
    const record={...result,id,source:result.source??'local-sdk',sdkVersion:result.sdk?.version,
      policyFingerprint:result.policyFingerprint??result.verificationPolicyFingerprint};
    await journal.transaction({actionId:`${id}:${fingerprint(record)}`,fingerprint:fingerprint(record)},tx=>{
      tx.put('verificationResults',id,record);return null;
    });
    return record;
  }
  async function verifier(plan) {
    const {createCloudVerification}=await loadVerification();
    return createCloudVerification({journal,clock,secretRef:providers.cloudSecretRef,resolveSecret:providers.resolveSecret,
      limits:{timeoutMs:plan.timeoutMs??plan.request?.timeoutMs,maxEvidenceBytes:4*1024*1024}});
  }
  function describe(access,{request}={}) {
    const action={id:`component-preflight:${randomUUID()}`,type:'component_preflight',...(request?{requestFingerprint:fingerprint(request)}:{})};
    return ownerDecision(action,access,request?{request}:{});
  }
  async function failure(plan,error,stage='preflight') {
    const reasonCode=typeof error.code==='string'&&/^[A-Z0-9_.:-]{1,100}$/.test(error.code)?error.code:'VERIFICATION_UNAVAILABLE';
    const observedAt=new Date(clock()).toISOString();
    const ref=await journal.putArtifact({actionId:`component-failure:${randomUUID()}`,content:JSON.stringify({stage,reasonCode,observedAt,model:plan.model}),mediaType:'application/json'});
    return persistVerification({source:'component-runtime',stage,status:'unavailable',reasonCode,model:plan.model,
      requestFingerprint:plan.requestFingerprint,verificationPolicyFingerprint:plan.verificationSpec.policyFingerprint,
      verifiedAt:observedAt,evidenceRef:`private:${ref.id}`,plaintextBindingStatus:'unavailable',durableReplayStatus:'unavailable'});
  }
  async function preflight(access,{request}={}) {
    const decision=requireAllow(describe(access,{request})),plan=decision.plan;
    let record;
    try{const engine=await verifier(plan);
      const result=await engine.preflight({actionId:decision.actionId,requestFingerprint:plan.requestFingerprint,request:plan.request,verificationSpec:plan.verificationSpec});
      record=await persistVerification(result);
    }catch(error){record=await failure(plan,error);}
    return {verification:record,scope:'gateway-and-model-attestation',completionSent:false};
  }
  async function replay(access,{evidenceRef,request}={}) {
    // Replay is read-only and remains available after the one-shot spending grant expires.
    const decision=requireAllow(describe(access)),plan=decision.plan;
    const saved=journal.list('verificationResults').find(r=>r.evidenceRef===evidenceRef);
    if(!saved||saved.model!==plan.model||saved.policyFingerprint!==plan.verificationSpec.policyFingerprint||
      (request&&fingerprint(request)!==saved.requestFingerprint))throw new ContractError('CONFLICT','Recorded verification scope does not match the selected policy and request.');
    const engine=await verifier(plan);
    const result=await engine.replay({evidenceRef,requestFingerprint:saved.requestFingerprint,verificationSpec:plan.verificationSpec});
    const record=await persistVerification(result);
    return {verification:record,scope:'recorded-wire-evidence',completionSent:false};
  }
  function ownerRead(access){requireAllow(ownerDecision({id:`component-read:${randomUUID()}`,type:'runtime_readiness'},access));}
  async function inspect(access,{id}={}) {
    ownerRead(access);
    const record=journal.get('componentRuns',id)??journal.get('inferencePrepared',id);
    const operation=journal.getOperation(`components:cloud:${id}`);
    if(!record&&!operation)throw new ContractError('NOT_FOUND','Component operation not found.');
    return record?.summary??{operationId:id,status:operation?.result?.status??operation?.status??record.status,
      code:operation?.result?.code??null,requestFingerprint:record?.requestFingerprint,
      proofScope:'wire-only',businessDeliveryAllowed:false};
  }
  async function recover(access,{id}={}) {
    ownerRead(access);
    const prepared=journal.get('inferencePrepared',id);
    if(!prepared)throw new ContractError('NOT_FOUND','Prepared inference operation not found.');
    const plan=requireAllow(describe(access)).plan;
    if(prepared.model!==plan.model||fingerprint(prepared.verificationSpec)!==fingerprint(plan.verificationSpec))
      throw new ContractError('CONFLICT','Recorded verification scope does not match the selected policy.');
    const engine=await verifier(plan);
    const recovered=await engine.recover({actionId:id,model:prepared.model,
      requestFingerprint:prepared.requestFingerprint,verificationSpec:plan.verificationSpec});
    const verification=await persistVerification(recovered.verification);
    // Evidence inspection never settles cost, frees reserves or admits output.
    return {...recovered,verification,operationId:id,proofScope:'wire-only',businessDeliveryAllowed:false};
  }
  async function execute(access) {return serial(async()=>{
    ownerRead(access);
    const authorization=providers.getComponentAuthorization(),request=authorization?.request;
    if(!authorization?.id||!request)throw new ContractError('POLICY_BLOCK','COMPONENT_AUTHORIZATION_REQUIRED');
    const operationId=`component:${authorization.id}`,existing=journal.get('componentRuns',operationId)??journal.get('inferencePrepared',operationId);
    if(existing){
      if(existing.requestFingerprint!==fingerprint(request))throw new ContractError('CONFLICT','The original component request is immutable.');
      return inspect(access,{id:operationId});
    }
    const plan=requireAllow(describe(access,{request})).plan;
    const verification=await verifier(plan);
    let send;
    try{send=await verification.prepare({action:plan.action,request:plan.request,verificationSpec:plan.verificationSpec});}
    catch(error){if(error.result)await persistVerification(error.result);throw error;}
    if(typeof send!=='function'||!send.preflight)throw new ContractError('VERIFICATION_UNAVAILABLE','A prepared verified request is required.');
    await persistVerification(send.preflight);
    const facts=()=>({access,request:plan.request,creditId:plan.creditId,financial:treasury.snapshot()});
    const decision=requireAllow(rules.evaluate(plan.action,facts()));
    await journal.transaction({actionId:`component-intent:${operationId}`,fingerprint:fingerprint({action:plan.action,request:plan.request})},tx=>{
      tx.put('componentRuns',operationId,{id:operationId,status:'prepared',authorizationId:authorization.id,
        requestFingerprint:plan.requestFingerprint,action:plan.action,creditId:plan.creditId,decision});return null;
    });
    await treasury.applyDecision({actionId:operationId,decision});
    const runtime=createOperationRuntime({journal,namespace:'components:cloud',
      meta:capability('M07','live','near-ai-cloud-verified-component'),clock,
      dispatchAuthorized:async(command,callback)=>{
        const before=rules.validateDispatch(command.decision.permit,{...facts(),action:plan.action});
        if(before.status!=='allow')return before;
        await treasury.consumePermit({actionId:operationId,permit:command.decision.permit,decision:before});
        return rules.dispatch(command.decision.permit,{...facts(),action:plan.action},callback);
      }});
    const result=await runtime.execute({action:plan.action,decision,facts:facts(),payload:plan.request,send:()=>send()});
    if(result.proof)await persistVerification(result.proof);
    const resultId=`component-result:${operationId}:${fingerprint(result)}`;
    const record={id:resultId,source:'local-sdk',authorizationId:authorization.id,actionId:operationId,
      requestFingerprint:plan.requestFingerprint,evidenceRef:result.proof?.evidenceRef??send.evidenceRef,result};
    await journal.transaction({actionId:resultId,fingerprint:fingerprint(record)},tx=>{tx.put('componentResults',resultId,record);return null;});
    const cost=rules.evaluate({id:`component-cost:${resultId}`,type:'component_consumption',resultId},{access,financial:treasury.snapshot()});
    if(cost.status==='allow')await treasury.applyDecision({actionId:cost.actionId,decision:cost});
    else{
      const update=rules.evaluate({id:`component-reservation:${resultId}`,type:'reservation_update'},
        {access,financial:treasury.snapshot(),result,reservationId:decision.plan.reservation.id});
      if(update.status==='allow')await treasury.applyDecision({actionId:update.actionId,decision:update});
    }
    const summary={operationId,status:result.status,proofScope:'wire-only',requestFingerprint:plan.requestFingerprint,
      providerRequestId:result.providerRequestId??result.generation?.providerRequestId??null,
      inferenceId:result.inferenceId??result.generation?.inferenceId??null,
      proof:result.proof??null,cost:result.cost??{status:'pending',actualCostNanoUsd:null},
      accounting:{status:cost.status,reasonCode:cost.reasonCode},businessDeliveryAllowed:false};
    await journal.transaction({actionId:`component-summary:${operationId}:${fingerprint(summary)}`,fingerprint:fingerprint(summary)},tx=>{
      tx.put('componentRuns',operationId,{...tx.get('componentRuns',operationId),status:result.status,resultId,summary});return null;
    });
    return summary;
  });}
  return {describe,preflight:(...args)=>serial(()=>preflight(...args)),replay:(...args)=>serial(()=>replay(...args)),
    recover:(...args)=>serial(()=>recover(...args)),inspect,execute};
}
