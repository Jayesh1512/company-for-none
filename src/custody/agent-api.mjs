import {capability,createOperationRuntime,result,unsupported,moneyValid,digest,realMode} from './adapter-runtime.mjs';
import {createAgentApiProbes} from './probes.mjs';
import {readBoundedJson} from './read-json.mjs';

const BASE='https://api.agentsonintents.com';
/** Existing owner-signed agents/grants only. Never creates accounts or grants. */
export function createAgentApiCustody(options={}){
  const mode=realMode(options.mode);
  const {journal,dispatchAuthorized,clock=()=>new Date(),transport=fetch,resolveSecret,secretRef,grantRef,agentId,accountId,network=null}=options;
  const configured=mode==='live'&&network==='near:mainnet'&&options.balanceSource==='confidential'&&Boolean(agentId&&accountId&&secretRef&&grantRef&&resolveSecret);
  const meta=capability('M04',mode,'near-agent-api',{configured,verified:false,balanceSource:options.balanceSource??'unverified',network,accountId,agentId,methods:['transfer','reconcile'],evidenceLevel:'documented-http',ownerSignatureVerifiedLocally:false,executionProofVerifiedLocally:false});
  const runtime=createOperationRuntime({journal,namespace:'adapters:agent-api',meta,dispatchAuthorized,clock,
    binding:{agentId,accountId,network,balanceSource:options.balanceSource}});
  async function prepare(path,{method='GET',body,key,grant=false}={}){
    const apiKey=await resolveSecret?.(secretRef),token=grant?await resolveSecret?.(grantRef):null;
    if(!apiKey||(grant&&!token))throw new Error('CREDENTIAL_UNAVAILABLE');
    return ()=>transport(BASE+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{'X-API-Key':apiKey,...(grant?{'X-Grant-Token':token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})}).then(async response=>{
      if(!response.ok)throw new Error('PROVIDER_HTTP_ERROR');return readBoundedJson(response,2*1024*1024);
    });
  }
  async function read(path){return (await prepare(path))();}
  const bodyFor=a=>({confidential:true,asset:a.money.asset,amount:a.money.amount,recipient:a.recipient});
  async function observation(action,raw,previous){
    let status=['FAILED','REFUNDED'].includes(raw.status)?'failed':['UNCERTAIN','NEEDS_REVIEW'].includes(raw.status)?'unknown':'pending';
    const request=raw.details?.request,proof=raw.details?.intent_hash;
    const matches=raw.agent_id===agentId&&(!raw.details?.near_account_id||raw.details.near_account_id===accountId)&&raw.type==='transfer'&&request&&request.confidential===true&&request.asset===action.money.asset&&request.amount===action.money.amount&&request.recipient===action.recipient;
    if(!matches)status='unknown';
    // An intent hash/provider SUCCESS is not an execution-proof verification.
    // Keep the original operation unresolved until that separate gate exists.
    let auditProof=null;
    if(raw.status==='SUCCESS'){
      status='unknown';
      if(matches&&/^op_/.test(raw.correlation_id??'')&&options.proofs){
        const payload=bodyFor(action);
        const expected={agentId,accountId,correlationId:raw.correlation_id,action:'transfer',payload,requestFingerprint:digest(payload),requiredEvent:'execute.completed'};
        try{
          if(previous?.auditProof?.evidenceRef&&typeof options.proofs.replay==='function')auditProof=await options.proofs.replay({evidenceRef:previous.auditProof.evidenceRef,expected});
          else if(typeof options.getProofInputs==='function'&&typeof options.proofs.capture==='function'){
            // A private acquisition port aligns the independently verified head
            // with this original op's from_size. Proof JSON cannot supply trust.
            const inputs=await options.getProofInputs({expected:structuredClone(expected),statusEvidence:structuredClone(raw)});
            auditProof=await options.proofs.capture({expected,proof:inputs?.proof,statusEvidence:raw,teeEvidence:inputs?.teeEvidence});
          }
        }catch{auditProof={status:'unavailable',code:'ORIGINAL_OPERATION_PROOF_UNAVAILABLE'};}
      }
    }
    // Exact signed terms from the API's transparency log (receipt + this agent's own operation
    // proof). Strictly `log-attested-exact-terms`: no independent chain finality, no status
    // promotion, no authority. Re-verified from retained private evidence on every reconcile.
    let movementProof=null;
    if(raw.status==='SUCCESS'&&matches&&/^op_/.test(raw.correlation_id??'')&&options.movement){
      const payload=bodyFor(action);
      const expected={agentId,accountId,correlationId:raw.correlation_id,action:'transfer',payload,requestFingerprint:digest(payload),requiredEvent:'execute.completed'};
      try{
        if(previous?.movementProof?.evidenceRef)movementProof=await options.movement.replay({evidenceRef:previous.movementProof.evidenceRef,expected});
        else if(typeof options.getMovementInputs==='function'){
          const inputs=await options.getMovementInputs({expected:structuredClone(expected),statusEvidence:structuredClone(raw)});
          movementProof=await options.movement.capture({expected,receipt:inputs?.receipt,operation:inputs?.operation});
        }
      }catch{movementProof={status:'unavailable',code:'ORIGINAL_OPERATION_MOVEMENT_UNAVAILABLE'};}
      if(movementProof)movementProof={status:movementProof.status,code:movementProof.code,assurance:movementProof.assurance??null,independentChainFinality:'not_established',evidenceRef:movementProof.evidenceRef??null,settledAt:movementProof.settledAt??null,provenance:movementProof.provenance??null,terms:movementProof.terms??null};
    }
    const movementLogAttested=movementProof?.status==='verified'&&movementProof.assurance==='log-attested-exact-terms'&&/^agent-movement:[a-f0-9]{64}$/.test(movementProof.evidenceRef??'');
    // Audit inclusion, TDX and recorded RPC success do not independently prove
    // the account/asset/amount movement. No automatic money/readiness promotion.
    const auditVerified=auditProof?.status==='verified'&&auditProof.scope==='attested-audit-and-recorded-near-finality'&&
      auditProof.sdk?.name==='@near-intents-agent-api/sdk'&&auditProof.sdk?.version==='0.9.0'&&
      ['audit','binding','tee','finality'].every(stage=>auditProof.stages?.[stage]?.status==='verified')&&/^agent-proof:[a-f0-9]{64}$/.test(auditProof.evidenceRef??'');
    return result(meta,status,action,{providerRequestId:raw.correlation_id??null,...(auditProof?{auditProof}:{}),...(movementProof?{movementProof}:{}),receipt:{status,reference:raw.correlation_id??null,recipient:action.recipient,money:structuredClone(action.money),accountId,mode,simulated:false,provider:'near-agent-api',intentHash:matches?proof??null:null,providerStatus:raw.status??null,providerConfirmed:matches&&raw.status==='SUCCESS',proofVerifiedLocally:false,auditProofVerifiedLocally:auditVerified,movementVerification:movementLogAttested?'log-attested-exact-terms':'unavailable',observedAt:new Date(clock()).toISOString()},...(!matches?{code:'RECEIPT_MISMATCH'}:raw.status==='SUCCESS'?{code:movementLogAttested?'MOVEMENT_LOG_ATTESTED_NOT_CHAIN_FINAL':auditVerified?'MOVEMENT_PROOF_UNVERIFIED':proof?'EXECUTION_PROOF_UNVERIFIED':'RECEIPT_MISMATCH'}:{})});
  }
  return {
    capabilities:()=>structuredClone(meta),
    async identity(){if(!configured)return unsupported(meta,null,'Explicit existing mainnet account and protected access references required');try{const raw=await read(`/v1/agents/${encodeURIComponent(agentId)}`);return {...meta,status:raw.wallet?.near_account_id===accountId&&raw.status==='ACTIVE'?'confirmed':'unknown',observedAt:new Date(clock()).toISOString()};}catch{return {...meta,status:'unknown',code:'IDENTITY_UNVERIFIED'};}},
    async transfer({action,decision,facts}={}){
      if(!configured||!agentId||!accountId||!moneyValid(action?.money)||action.money.network!==network||!action.money.asset.startsWith('nep141:')||!action.recipient)return unsupported(meta,action,'An existing agent, Intents token and exact recipient are required');
      const admittedBody=bodyFor(action);
      return runtime.execute({action,decision,facts,payload:admittedBody,
        prepare:async()=>{const agent=await read(`/v1/agents/${encodeURIComponent(agentId)}`);if(agent.status!=='ACTIVE'||agent.wallet?.near_account_id!==accountId)throw new Error('IDENTITY_MISMATCH');return prepare(`/v1/agents/${encodeURIComponent(agentId)}/transfer`,{method:'POST',body:admittedBody,key:`shop:${digest(action)}`,grant:true});},
        send:send=>send().then(raw=>observation(action,raw))});
    },
    async reconcile({action}){if(!configured)return unsupported(meta,action);return runtime.reconcile(action,async op=>{
      const id=op.result?.providerRequestId;if(!id)return op.result??result(meta,'unknown',action,{code:'ORIGINAL_CORRELATION_REQUIRED'});
      const raw=await read(`/v1/status?correlation_id=${encodeURIComponent(id)}`);
      if(raw.correlation_id!==id)return result(meta,'unknown',action,{code:'RECEIPT_MISMATCH'});
      return observation(action,raw,op.result);
    });},
    // Probe evidence remains private and is not an opening/additive cash fact.
    async balance(){if(mode!=='live')return unsupported(meta);return createAgentApiProbes(options).balance();},
  };
}
