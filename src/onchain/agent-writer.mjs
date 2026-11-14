import {createOperationRuntime,capability,result,digest} from '../custody/adapter-runtime.mjs';
import {readBoundedJson} from '../custody/read-json.mjs';
import {readExchange} from '../integrations/http.mjs';
import {createLedgerRpc} from './rpc.mjs';

// Documented Agent API native contract-call port. It is NOT the 1Click quote API.
// Exact native fee/resource admission is independent from Intents transfer budgets.
export function createAgentLedgerWriter({journal,binding,agentId,secretRef,grantRef,resolveSecret,dispatchAuthorized,transport=fetch,rpcTransport=fetch,clock=()=>new Date()}){
 const meta=capability('ledger-chain','live','near-agent-api-native-call',{network:'near:mainnet',configured:binding?.networkId==='mainnet'&&!!agentId,verified:false});
 const runtime=createOperationRuntime({journal,namespace:'ledger-agent-call',meta,dispatchAuthorized,binding,clock});
 const reject=(action,code)=>result(meta,'not_submitted',action,{code});
 async function credentials(){const key=await resolveSecret?.(secretRef),grant=await resolveSecret?.(grantRef);if(!key||!grant)throw Error('CREDENTIAL_UNAVAILABLE');return {key,grant};}
 async function read(path,key){const response=await transport('https://api.agentsonintents.com'+path,{headers:{'X-API-Key':key},redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('PROVIDER_UNAVAILABLE');return readBoundedJson(response,262144);}
 return Object.freeze({
  async publish({action,decision,facts}={}){
   if(!meta.configured||action?.type!=='ledger_chain_publish'||decision?.status!=='allow'||!decision.permit||decision.plan?.operationKind!=='ledger_chain_publish'||decision.plan?.executionAllowed!==true)return reject(action,'LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED');
   const call=structuredClone(decision.plan.nativeCall);
   if(decision.plan.custody?.agentId!==agentId)return reject(action,'PROVIDER_ACCOUNT_MISMATCH');
   if(call?.receiver_id!==binding.contractId||call?.method_name!=='append'||call?.deposit!=='0'||typeof call?.gas!=='string'||!/^\d+$/.test(call.gas)||!call.args||decision.plan.nativeCallHash!==digest(call))return reject(action,'LEDGER_CHAIN_CALL_MISMATCH');
   return runtime.execute({action,decision,facts,payload:call,prepare:async()=>{
    const {key,grant}=await credentials(),agent=await read('/v1/agents/'+encodeURIComponent(agentId),key);
    if(agent.status!=='ACTIVE'||agent.wallet?.near_account_id!==binding.signerId)throw Error('PROVIDER_ACCOUNT_MISMATCH');
    // All awaits precede the common final dispatch gate. One stable original key.
    return ()=>transport(`https://api.agentsonintents.com/v1/agents/${encodeURIComponent(agentId)}/native/near/call`,{method:'POST',headers:{'X-API-Key':key,'X-Grant-Token':grant,'Idempotency-Key':'ledger:'+digest(action),'content-type':'application/json'},body:JSON.stringify(call),redirect:'error',signal:AbortSignal.timeout(30000)});
   },send:async send=>{const e=await readExchange(await send());const artifact=await journal.putArtifact({actionId:`${action.id}:native-artifact:${e.wireHash}`,content:e.raw.toString('utf8'),mediaType:'application/json'});await journal.transaction({actionId:`${action.id}:native-wire:${e.wireHash}`,fingerprint:e.wireHash},tx=>{tx.put('nativeExchanges',action.id,{id:action.id,raw:e.raw.toString('utf8'),wireHash:e.wireHash,evidenceRef:`private:${artifact.id}`});});const raw=e.value;if(!e.ok||e.parseError)throw Error('PROVIDER_HTTP_ERROR');return result(meta,'unknown',action,{code:'LEDGER_CHAIN_FINALITY_REQUIRED',providerRequestId:/^op_[A-Za-z0-9_-]{43}$/.test(raw.correlation_id??'')?raw.correlation_id:null,cost:{status:'pending',actualCostNanoUsd:null}});}});
  },
  async reconcile({action}={}){return runtime.reconcile(action,async op=>{if(op.result?.finalityVerified)return op.result;let id=op.result?.providerRequestId;if(!id)try{id=JSON.parse(journal.get('nativeExchanges',action.id)?.raw??'null')?.correlation_id;}catch{}if(!/^op_[A-Za-z0-9_-]{43}$/.test(id??''))return op.result??result(meta,'unknown',action,{code:'ORIGINAL_CORRELATION_REQUIRED'});const {key}=await credentials();const raw=await read('/v1/status?correlation_id='+encodeURIComponent(id),key),d=raw.details;
   const matches=raw.correlation_id===id&&raw.agent_id===agentId&&raw.type==='native'&&d?.method==='near_call'&&d.account_id===binding.signerId&&d.target===binding.contractId&&d.method_name==='append';
   return result(meta,'unknown',action,{code:matches?'LEDGER_CHAIN_FINALITY_REQUIRED':'PROVIDER_ACCOUNT_MISMATCH',providerRequestId:id,providerStatus:raw.status??null,transactionHash:matches&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(d.tx_hash??'')?d.tx_hash:null,cost:{status:'pending',actualCostNanoUsd:null}});});},
  async finalize({action}={}){
   const observed=await this.reconcile({action});
   if(!observed.transactionHash||observed.finalityVerified)return observed;
   let receipt;
   try{receipt=await createLedgerRpc({networkId:binding.networkId,transport:rpcTransport,clock}).transaction(observed.transactionHash,binding.signerId);}
   catch{return result(meta,'unknown',action,{...observed,code:'LEDGER_CHAIN_FINALITY_PENDING'});}
   const raw=receipt.result,tx=raw.transaction,submission=journal.get('ledgerChainSubmissions',action.id),call=submission?.nativeCall;
   let actualCall;try{const f=tx?.actions?.[0]?.FunctionCall;actualCall={receiver_id:tx.receiver_id,method_name:f.method_name,args:JSON.parse(Buffer.from(f.args,'base64').toString('utf8')),gas:String(f.gas),deposit:f.deposit};}catch{}
   if(tx?.hash!==observed.transactionHash||tx?.signer_id!==binding.signerId||tx?.receiver_id!==binding.contractId||tx?.actions?.length!==1||!call||!actualCall||digest(actualCall)!==digest(call))return result(meta,'unknown',action,{...observed,code:'NATIVE_TRANSACTION_BINDING_MISMATCH'});
   if(raw.final_execution_status!=='FINAL'||!raw.status||!Object.hasOwn(raw.status,'SuccessValue'))return result(meta,'unknown',action,{...observed,code:'LEDGER_CHAIN_FINALITY_PENDING'});
   const artifact=await journal.putArtifact({actionId:`${action.id}:finality:${receipt.wireHash}`,content:JSON.stringify(raw),mediaType:'application/json'});
   return runtime.save(action,result(meta,'confirmed',action,{...observed,status:'confirmed',code:null,finalityVerified:true,settledBlockHeight:receipt.settledBlockHeight,evidence:[{source:'near-json-rpc',wireHash:receipt.wireHash,evidenceRef:`private:${artifact.id}`}]}));
  },
 });
}
