import {randomUUID} from 'node:crypto';
import {fingerprint,ContractError} from '../contracts.mjs';
import {createCloudModelProbe} from '../inference/probes.mjs';
import {createPaymentTokensProbe} from '../payments/probes.mjs';
import {createAgentApiProbes} from '../custody/probes.mjs';
import {retrievePublicSource} from '../research/retrieve.mjs';

/** Observation only. It cannot dispatch a financial or inference operation. */
export function createReadinessRuntime({journal,rules,identity,providers,knowledgeClient,sourceUrls=[],clock=()=>new Date(),transports={}}){
  const evaluate=(type,access,extra={})=>{
    const d=rules.evaluate({id:`runtime:${type}:${randomUUID()}`,type,...extra},{access});
    if(d.status!=='allow')throw new ContractError('POLICY_BLOCK',d.reasonCode);
    return d;
  };
  const persistEvidence=async data=>{
    const ref=await journal.putArtifact({actionId:`probe-evidence:${randomUUID()}`,content:JSON.stringify(data),mediaType:'application/json'});
    return `private:${ref.id??ref.hash}`;
  };
  async function probe(capability,access){
    const decision=evaluate('runtime_probe',access,{capability}),plan=decision.plan,state=rules.snapshot(),binding=identity();
    const observedAt=new Date(clock()).toISOString(),expiresAt=new Date(Date.parse(observedAt)+plan.ttlMs).toISOString();
    const options={binding,policyVersion:state.policyVersion,clock,ttlMs:plan.ttlMs,persistEvidence};
    let result;
    if(capability==='inference_model')result=await createCloudModelProbe({...options,model:state.config?.research?.model,transport:transports.inference}).probe();
    else if(capability==='payments_route')result=await createPaymentTokensProbe({...options,transport:transports.payments}).probe();
    else if(capability.startsWith('custody_')){
      const api=createAgentApiProbes({...options,transport:transports.custody,agentId:providers.agentId,secretRef:providers.agentSecretRef,grantRef:providers.grantRef,resolveSecret:providers.resolveSecret,balanceSource:binding.bucket});
      const method=({custody_identity:'identity',custody_policy:'policy',custody_grant:'grant',custody_balance:'balance'})[capability];
      result=method?await api[method]():null;
    }else if(['jbrain','public_retrieval'].includes(capability)){
      let status='unavailable',reasonCode='PROBE_ACCESS_REQUIRED',evidence;
      try{
        if(capability==='jbrain'&&knowledgeClient){let timer;const health=await Promise.race([Promise.resolve().then(()=>knowledgeClient.health()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Health read timed out')),plan.timeoutMs);})]).finally(()=>clearTimeout(timer));status=health.status==='ready'?'verified':'unavailable';reasonCode=status==='verified'?'JBRAIN_HEALTH_OBSERVED':'JBRAIN_UNAVAILABLE';evidence={provider:'jbrain',capability,observedAt,response:{status:health.status}};}
        if(capability==='public_retrieval'&&sourceUrls[0]){
          const page=await retrievePublicSource({url:sourceUrls[0],maxBytes:plan.maxBytes,timeoutMs:plan.timeoutMs,maxRedirects:plan.maxRedirects});
          status='verified';reasonCode='PUBLIC_SOURCE_OBSERVED';evidence={provider:'public-http',capability,observedAt,response:page};
        }
      }catch{reasonCode='PROVIDER_READ_FAILED';}
      const evidenceRef=evidence?await persistEvidence(evidence):undefined;
      result={id:`probe:${randomUUID()}`,capability,provider:capability==='jbrain'?'jbrain':'public-http',status,reasonCode,observedAt,expiresAt,identity:binding,...(evidenceRef?{evidenceRef}:{})};
    }
    result??={id:`probe:${randomUUID()}`,capability,provider:'unconfigured',status:'unavailable',reasonCode:'VERIFIED_PROTOCOL_REQUIRED',observedAt,expiresAt,identity:binding};
    await journal.transaction({actionId:`runtime-fact:${result.id}`,fingerprint:fingerprint(result)},tx=>{tx.put('runtimeFacts',result.id,result);return null;});
    return {observation:result,readiness:evaluate('runtime_readiness',access).plan};
  }
  return {probe,readiness:access=>evaluate('runtime_readiness',access).plan};
}
