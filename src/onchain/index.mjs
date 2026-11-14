import {randomUUID} from 'node:crypto';
import {fingerprint,ContractError} from '../contracts.mjs';
import {ledgerCompanyHash} from '../rules/onchain-ledger.mjs';
import {createLedgerRpc} from './rpc.mjs';
import {nativeFeeReceipt} from './fees.mjs';

const observations=new WeakMap();
const fail=(code,status=409)=>{throw Object.assign(new ContractError(code,code),{httpStatus:status});};
export function readLedgerFacts({journal,companyId,binding=null,deploymentWallet=null,deployment=null,authorization=null,feeBound=null,signingEnvelope=null,nativeAccount=null,costEvidence=null}={}){
 const companyHash=ledgerCompanyHash(companyId);
 return {companyId,events:journal?.events()??[],binding,checkpoint:journal?.get('ledgerChainCheckpoints',companyHash)??null,batches:journal?.list('ledgerChainBatches')??[],submissions:journal?.list('ledgerChainSubmissions')??[],costs:journal?.list('nativeCostEvidence')??[],rpc:journal?observations.get(journal)??null:null,authorization,feeBound,signingEnvelope,nativeAccount,costEvidence,financial:journal?.get('treasury','financial')??null,deploymentWallet,deployment};
}
export function createOnchainLedger({journal,rules,treasury,writer,companyId,binding=null,deploymentWallet=null,deployment=null,clock=()=>new Date(),transport,rpcUrl,getUsdBound}){
 let queue=Promise.resolve(),walletObservation=null,nativeAccount=null,costEvidence=null;
 const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const action=(type,key=randomUUID())=>({id:`onchain:${companyId}:${type}:${fingerprint(key)}`,type});
 const allowed=d=>{if(d.status!=='allow')fail(d.reasonCode,d.reasonCode==='ACCESS_DENIED'?403:409);return d.plan;};
 const decide=(a,access,input={})=>rules.evaluate(a,{access,input});
 const client=networkId=>createLedgerRpc({networkId,transport,rpcUrl,clock,expectedCodeHash:deployment?.codeHash});
 function view(access){return allowed(decide(action('ledger_chain_view'),access));}
 async function inspect(access,batchId){
  view(access); // Authorize before any public RPC traffic.
  if(deploymentWallet){try{const a=await client(deploymentWallet.networkId).account(deploymentWallet.accountId);walletObservation={...deploymentWallet,accountExists:true,balanceYocto:a.amount,observedAt:new Date(clock()).toISOString()};}catch(e){walletObservation={...deploymentWallet,accountExists:e.code==='LEDGER_CHAIN_ACCOUNT_UNFUNDED'?false:null,balanceYocto:null,observedAt:new Date(clock()).toISOString()};}}
  if(binding){const batch=batchId?journal.get('ledgerChainBatches',batchId):null;try{observations.set(journal,await client(binding.networkId).inspect(binding,{...(batch?{fromSequence:batch.endSequence}:{})}));}catch(e){observations.delete(journal);return {...view(access),observationError:e.code??'LEDGER_CHAIN_RPC_UNAVAILABLE'};}}
  return view(access);
 }
 async function balance(access){
  view(access);if(!binding||!treasury)fail('LEDGER_CHAIN_BINDING_REQUIRED');
  const a=await client(binding.networkId).account(binding.signerId);
  nativeAccount={source:'near-json-rpc-final-account',networkId:binding.networkId,accountId:binding.signerId,balanceYocto:a.amount,blockHeight:a.block_height,blockHash:a.block_hash,reference:`near:${binding.networkId}:${a.block_hash}:${binding.signerId}`,observedAt:new Date(clock()).toISOString()};
  const actionId=action('ledger_chain_balance',fingerprint(nativeAccount)),d=rules.evaluate(actionId,{access,input:{},financial:treasury.snapshot()});allowed(d);await treasury.applyDecision({actionId:actionId.id,decision:d});return {observed:true,blockHeight:a.block_height,executionAllowed:false};
 }
 async function publish(input,access){
  view(access);if(!writer||!treasury)fail('LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED');
  if(Object.keys(input).some(k=>k!=='batchId')||typeof input.batchId!=='string')fail('LEDGER_CHAIN_INPUT_INVALID',400);
  const a=action('ledger_chain_publish',input.batchId),old=journal.get('ledgerChainSubmissions',a.id);
  if(old)return {operationId:a.id,status:'reconcile_required',reasonCode:'ORIGINAL_OPERATION_RECONCILIATION_REQUIRED'};
  await inspect(access,input.batchId);
  // Native balance remains separate from confidential Intents and never becomes
  // a cash deposit or credit lot. Snapshot reads cannot create funds.
  await balance(access);
  const facts={access,input,financial:treasury.snapshot()},d=rules.evaluate(a,facts);allowed(d);
  await journal.transaction({actionId:`${a.id}:submission`,fingerprint:fingerprint({a,input,plan:d.plan})},tx=>{tx.put('ledgerChainSubmissions',a.id,{id:a.id,companyId,action:a,input,nativeCall:d.plan.nativeCall,status:'reserved'});});
  await treasury.applyDecision({actionId:a.id,decision:d});
  const outcome=await writer.publish({action:a,decision:d,facts});
  await journal.transaction({actionId:`${a.id}:outcome:${fingerprint(outcome)}`,fingerprint:fingerprint(outcome)},tx=>{const s=tx.get('ledgerChainSubmissions',a.id);tx.put('ledgerChainSubmissions',a.id,{...s,status:outcome.status,result:outcome});});
  if(outcome.status==='not_submitted')await release(a.id,access);
  else{const pending=action('ledger_chain_pending',a.id),d=rules.evaluate(pending,{access,input:{operationId:a.id},financial:treasury.snapshot()});if(d.status==='allow')await treasury.applyDecision({actionId:pending.id,decision:d});}
  return outcome;
 }
 async function release(operationId,access){const a=action('ledger_chain_release',operationId),d=rules.evaluate(a,{access,input:{operationId},financial:treasury.snapshot()});allowed(d);await treasury.applyDecision({actionId:a.id,decision:d});return {reservationReleased:true};}
 async function fees(input,access){
  view(access);const s=journal.get('ledgerChainSubmissions',input.operationId);if(!s||s.companyId!==companyId||!binding)fail('ORIGINAL_OPERATION_REQUIRED');
  if(treasury.snapshot().reservations.some(r=>r.actionId===s.id&&['reconciled','released'].includes(r.status)))return {costReconciled:true,replayed:true};
  if(s.result?.status==='not_submitted')return release(s.id,access);
  const observed=await writer.reconcile({action:s.action});
  const transactionHash=observed.transactionHash;if(!transactionHash)fail('NATIVE_TRANSACTION_HASH_REQUIRED');
  const r=await client(binding.networkId).transaction(transactionHash,binding.signerId);
  const artifact=await journal.putArtifact({actionId:`${s.id}:final-fee:${r.wireHash}`,content:JSON.stringify(r.result),mediaType:'application/json'});
  costEvidence=nativeFeeReceipt(r.result,{operationId:s.id,transactionHash,binding,nativeCall:s.nativeCall,settledBlockHeight:r.settledBlockHeight,usdBound:getUsdBound?.(),now:new Date(clock()).getTime(),evidenceRef:`private:${artifact.id}`});
  await journal.transaction({actionId:`${s.id}:verified-fee:${fingerprint(costEvidence)}`,fingerprint:fingerprint(costEvidence)},tx=>tx.put('nativeCostEvidence',s.id,{id:s.id,...costEvidence}));
  const a=action('ledger_chain_cost',transactionHash),d=rules.evaluate(a,{access,input:{operationId:s.id},financial:treasury.snapshot()});allowed(d);await treasury.applyDecision({actionId:a.id,decision:d});return {costReconciled:true,evidenceRef:costEvidence.evidenceRef};
 }
 async function apply(type,input,access,key){
  if(typeof key!=='string'||!key||key.length>160)fail('IDEMPOTENCY_KEY_REQUIRED',400);
  const a=action(type,key),identity=fingerprint({action:a,input}),old=journal.snapshot().commands[a.id];
  view(access);
  if(old){if(old.fingerprint!==identity)fail('CONFLICT');return {...old.result,replayed:true};}
  await inspect(access,input.batchId);
  allowed(decide(a,access,input));
  const result=await journal.transaction({actionId:a.id,fingerprint:identity},tx=>{
   const plan=allowed(decide(a,access,input));
   if(plan.grantsSpendingAuthority!==false||plan.executionAllowed!==false)fail('INVALID_LEDGER_CHAIN_PLAN');
   for(const put of plan.puts??[]){if(!['ledgerChainBatches','ledgerChainCheckpoints'].includes(put.namespace)||put.value?.companyId!==companyId)fail('INVALID_LEDGER_CHAIN_PLAN');tx.put(put.namespace,put.id,put.value,{expectedVersion:put.expectedVersion===null?0:put.expectedVersion});}
   for(const e of plan.events??[])tx.append(e.type,e.data);
   return plan;
  });return {...result.result,replayed:result.replayed};
 }
 return Object.freeze({view,inspect:access=>serial(()=>inspect(access)),balance:access=>serial(()=>balance(access)),fees:(input,access)=>serial(()=>fees(input,access)),export:access=>allowed(decide(action('ledger_chain_export'),access)),prepare:(input,access,key)=>serial(()=>apply('ledger_chain_prepare',input,access,key)),publish:(input,access)=>serial(()=>publish(input,access)),reconcile:(input,access,key)=>serial(()=>apply('ledger_chain_reconcile',input,access,key)),walletObservation:()=>walletObservation,nativeObservation:()=>nativeAccount,costEvidence:()=>costEvidence});
}
