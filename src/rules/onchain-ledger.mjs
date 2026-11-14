import {createHash} from 'node:crypto';
import {hash,integer,isIntegerAmount,freeze} from './config.mjs';
import {allow,deny,hold} from './policies.mjs';
import {ownerAccess} from './runtime.mjs';
import {lifetimeExposure,totalCeiling} from './ceiling.mjs';

export const LEDGER_CHAIN_ACTIONS=Object.freeze(['ledger_chain_view','ledger_chain_export','ledger_chain_prepare','ledger_chain_publish','ledger_chain_reconcile','ledger_chain_balance','ledger_chain_cost','ledger_chain_release','ledger_chain_pending']);
export const LEDGER_CHAIN_LIMITS=freeze({maxBatch:50,maxEvents:100000,maxEventBytes:1048576,maxRpcAgeMs:30000,maxTotalNanoUsd:'5000000000'});
export const LEDGER_ZERO_HASH='0'.repeat(64);
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
export const ledgerCompanyHash=companyId=>sha(`company-ledger:company:v1\0${companyId}`);
export const ledgerRecordHash=(companyHash,r)=>sha(['company-ledger:record:v1',companyHash,String(r.sequence),r.type,r.at,r.actorHash,r.payloadHash,r.previousHash].join('\n'));
export const ledgerBindingHash=(companyHash,binding)=>hash({domain:'company-ledger:binding:v1',companyHash,binding});
const text=(s,max=300)=>typeof s==='string'&&!!s.trim()&&s.length<=max;
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(v,keys,required=keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const account=s=>typeof s==='string'&&s.length>=2&&s.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(s);
const count=n=>Number.isSafeInteger(n)&&n>=0;
const at=ctx=>new Date(ctx.now).toISOString();
const put=(namespace,value,old=null)=>({namespace,id:value.id,value,expectedVersion:old?.version??null});
const plan=(action,extra={})=>({kind:action.type,puts:[],events:[],executionAllowed:false,grantsSpendingAuthority:false,...extra});
const event=(action,ctx,type,data)=>({type,data:{companyId:ctx.companyId,actorId:'owner',causationId:action.id,...data}});
const SAFE_TYPES=new Set(['private.event','organization.updated','agent.created','agent.updated','agent.started','agent.stopped','agent.delegated','spend.requested','spend.completed','spend.refused','resource.connected','resource.installed','resource.requested','knowledge.saved','company.configured','company.bootstrap','company.start','company.pause','company.resume','company.switch_mode','company.replace_objective','company.bind_runtime','work.queued','work.blocked','work.completed','work.resumed','work.recovery_claimed','gap.recorded','gap.observed','template.registered','improvement.proposed','improvement.evaluation_requested','improvement.promoted','improvement.rolled_back','improvement.owner_review_requested','improvement.owner_reviewed','improvement.owner_accepted','service.proposed','command.rejected','support.published','support.opened','support.replied','support.escalated','ledger.chain_prepared','ledger.chain_confirmed','sale.confirmed','obligation.due','funding.confirmed','inference.consumed','fee.recorded','payout.pending','payout.unknown','payout.confirmed','payout.failed','payout.not_submitted','refund.confirmed','accounting.correction','operational_cost.recorded','reservation.recorded','reservation.updated','payment.late','fixture.bootstrap','capital.recorded','credit.observed','procurement.confirmed','cash.opened','cash.received','credit.opened','credit.received','balance.observed']);

/** All private event data and identities become company-domain-separated commitments.
 * Arbitrary event names are not a public disclosure channel. No raw payload is retained. */
export function projectChainRecords(events,companyId){
 if(!text(companyId,80)||!Array.isArray(events)||events.length>LEDGER_CHAIN_LIMITS.maxEvents)throw new TypeError('Invalid ledger facts');
 const companyHash=ledgerCompanyHash(companyId),records=[];let previousHash=LEDGER_ZERO_HASH;
 for(const [i,e] of events.entries()){
  if(!e||e.sequence!==i+1||!count(e.sequence)||!Number.isFinite(Date.parse(e.at))||e.data?.companyId!==undefined&&e.data.companyId!==companyId||Buffer.byteLength(JSON.stringify(e),'utf8')>LEDGER_CHAIN_LIMITS.maxEventBytes)throw new TypeError('Invalid journal sequence or company scope');
  const r={sequence:e.sequence,type:SAFE_TYPES.has(e.type)?e.type:'private.event',at:new Date(e.at).toISOString(),actorHash:hash({domain:'company-ledger:actor:v1',companyHash,actor:e.data?.actorId??e.data?.agentId??null}),payloadHash:hash({domain:'company-ledger:payload:v1',companyHash,data:e.data??null}),previousHash};
  r.hash=ledgerRecordHash(companyHash,r);records.push(r);previousHash=r.hash;
 }
 return {companyHash,records,head:{sequence:records.length,hash:previousHash}};
}
function validBinding(b){return exact(b,['networkId','contractId','signerId'])&&['mainnet','testnet','sandbox'].includes(b.networkId)&&account(b.contractId)&&account(b.signerId);}
function safeRecord(r,companyHash){return exact(r,['sequence','type','at','actorHash','payloadHash','previousHash','hash'])&&count(r.sequence)&&r.sequence>0&&SAFE_TYPES.has(r.type)&&typeof r.at==='string'&&Number.isFinite(Date.parse(r.at))&&r.at===new Date(r.at).toISOString()&&[r.actorHash,r.payloadHash,r.previousHash,r.hash].every(digest)&&ledgerRecordHash(companyHash,r)===r.hash;}
function rpcState(ctx,companyHash,binding){
 const r=ctx.data.rpc;
 if(!validBinding(binding))return {reasonCode:'LEDGER_CHAIN_BINDING_REQUIRED'};
 if(!r||r.source!=='near-json-rpc'||r.finality!=='final'||r.networkId!==binding.networkId||r.contractId!==binding.contractId||r.signerId!==binding.signerId||r.companyHash!==companyHash)return {reasonCode:'LEDGER_CHAIN_RPC_REQUIRED'};
 if(!count(r.sequence)||!digest(r.hash)||!count(r.blockHeight)||r.blockHeight<1||!text(r.blockHash,100)||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>ctx.now||ctx.now-Date.parse(r.observedAt)>LEDGER_CHAIN_LIMITS.maxRpcAgeMs||r.sequence===0&&r.hash!==LEDGER_ZERO_HASH)return {reasonCode:'LEDGER_CHAIN_RPC_STALE_OR_INVALID'};
 return {rpc:r};
}
function checkpointState(ctx,projection,binding){
 const c=ctx.data.checkpoint,bindingHash=ledgerBindingHash(projection.companyHash,binding);
 if(!c)return {checkpoint:{sequence:0,hash:LEDGER_ZERO_HASH},bindingHash};
 if(c.companyId!==ctx.companyId||c.companyHash!==projection.companyHash||c.bindingHash!==bindingHash||c.id!==projection.companyHash||!Number.isSafeInteger(c.version)||c.version<1||!count(c.sequence)||c.sequence>projection.head.sequence||c.hash!==(c.sequence===0?LEDGER_ZERO_HASH:projection.records[c.sequence-1].hash))return {reasonCode:'LEDGER_CHAIN_CHECKPOINT_MISMATCH'};
 return {checkpoint:c,bindingHash};
}
// Public deployment metadata is owner-visible but never a writer/key fallback.
function deploymentWallet(ctx){
 const w=ctx.data.deploymentWallet;
 if(!w||w.companyId!==ctx.companyId||!['mainnet','testnet','sandbox'].includes(w.networkId)||!account(w.accountId)||typeof w.publicKey!=='string'||!/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w.publicKey))return null;
 const observed=w.observedAt===null?null:typeof w.observedAt==='string'&&Number.isFinite(Date.parse(w.observedAt))&&Date.parse(w.observedAt)<=ctx.now?new Date(w.observedAt).toISOString():null;
 const accountExists=observed!==null&&typeof w.accountExists==='boolean'?w.accountExists:null;
 return {companyId:ctx.companyId,networkId:w.networkId,accountId:w.accountId,publicKey:w.publicKey,accountExists,balanceYocto:accountExists===true&&isIntegerAmount(w.balanceYocto)?w.balanceYocto:null,observedAt:observed};
}
function contractArtifact(ctx){
 const d=ctx.data.deployment;
 if(!d||!digest(d.wasmHash)||!Number.isSafeInteger(d.wasmBytes)||d.wasmBytes<1)return null;
 const codeHash=typeof d.codeHash==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(d.codeHash)?d.codeHash:null;
 return {wasmHash:d.wasmHash,wasmBytes:d.wasmBytes,codeHash};
}
const batchSummary=b=>({id:b.id,companyHash:b.companyHash,bindingHash:b.bindingHash,startSequence:b.startSequence,endSequence:b.endSequence,batchHash:b.batchHash,status:b.status,version:b.version});
export const ledgerBatchHash=b=>hash({domain:'company-ledger:batch:v1',companyHash:b.companyHash,bindingHash:b.bindingHash,expectedHead:b.expectedHead,records:b.records});
function validBatch(b,ctx,p,binding){
 if(!b||b.companyId!==ctx.companyId||b.companyHash!==p.companyHash||b.bindingHash!==ledgerBindingHash(p.companyHash,binding)||hash(b.binding)!==hash(binding)||!Array.isArray(b.records)||b.records.length<1||b.records.length>LEDGER_CHAIN_LIMITS.maxBatch||b.batchHash!==ledgerBatchHash(b)||b.startSequence!==b.expectedHead?.sequence+1||b.endSequence!==b.startSequence+b.records.length-1||b.previousHash!==b.expectedHead.hash)return false;
 const call={receiverId:binding.contractId,methodName:'append',args:{company_hash:p.companyHash,expected_sequence:b.expectedHead.sequence,expected_hash:b.expectedHead.hash,records:b.records}};
 if(hash(b.unsignedCall??null)!==hash(call))return false;
 return b.records.every((r,i)=>safeRecord(r,p.companyHash)&&r.sequence===b.startSequence+i&&r.previousHash===(i?b.records[i-1].hash:b.previousHash)&&hash(r)===hash(p.records[r.sequence-1]??null));
}
function provesBatch(rpc,batch,projection){
 if(rpc.sequence<batch.endSequence)return false;
 if(rpc.sequence===batch.endSequence)return rpc.hash===batch.records.at(-1).hash;
 if(!Array.isArray(rpc.records)||rpc.records.length>LEDGER_CHAIN_LIMITS.maxBatch)return false;
 const suffix=rpc.records.filter(r=>r?.sequence>=batch.endSequence&&r?.sequence<=rpc.sequence);
 if(suffix.length!==rpc.sequence-batch.endSequence+1)return false;
 return suffix.every((r,i)=>r.sequence===batch.endSequence+i&&safeRecord(r,projection.companyHash)&&hash(r)===hash(projection.records[r.sequence-1]??null)&&(!i||r.previousHash===suffix[i-1].hash))&&suffix.at(-1).hash===rpc.hash;
}
function publishHold(action,ctx,batch,bindingHash){
 if(ctx.config?.killSwitch)return deny('KILL_SWITCH');
 const a=ctx.data.authorization;
 if(!a||a.route!=='near-agent-api-native-call'||!text(a.id)||a.companyId!==ctx.companyId||a.companyHash!==batch.companyHash||a.bindingHash!==bindingHash||a.batchHash!==batch.batchHash||a.operationId!==batch.id||a.maxCalls!==1||!text(a.agentId)||!text(a.grantId)||a.allowedReceiverId!==batch.binding.contractId||a.allowedMethod!=='append'||!Number.isFinite(Date.parse(a.notBefore))||Date.parse(a.notBefore)>ctx.now||!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=ctx.now)return hold('LEDGER_CHAIN_AUTHORIZATION_REQUIRED');
 for(const key of ['maxGasUnits','maxDepositYocto','maxFeeYocto','maxCostNanoUsd','maxTotalNanoUsd'])if(!isIntegerAmount(a[key]))return hold('LEDGER_CHAIN_AUTHORIZATION_REQUIRED');
 if(integer(a.maxGasUnits)===0n||integer(a.maxFeeYocto)===0n||integer(a.maxCostNanoUsd)===0n||integer(a.maxTotalNanoUsd)===0n)return hold('LEDGER_CHAIN_AUTHORIZATION_REQUIRED');
 const f=ctx.data.feeBound;
 if(!f||f.source!=='near-rpc-fee-bound'||f.bindingHash!==bindingHash||f.batchHash!==batch.batchHash||!text(f.reference)||!text(f.usdReference)||!Number.isFinite(Date.parse(f.validUntil))||Date.parse(f.validUntil)<=ctx.now||!['gasUnits','depositYocto','maxFeeYocto','maxCostNanoUsd'].every(k=>isIntegerAmount(f[k])))return hold('LEDGER_CHAIN_FEE_BOUND_REQUIRED');
 if(f.depositYocto!=='0')return deny('LEDGER_CHAIN_DEPOSIT_UNSUPPORTED');
 if(integer(f.gasUnits)>integer(a.maxGasUnits)||integer(f.depositYocto)>integer(a.maxDepositYocto)||integer(f.maxFeeYocto)>integer(a.maxFeeYocto)||integer(f.maxCostNanoUsd)>integer(a.maxCostNanoUsd))return deny('LEDGER_CHAIN_FEE_CAP_EXCEEDED');
 const financial=ctx.data.financial;
 if(!financial||!Number.isSafeInteger(financial.version)||!Array.isArray(financial.reservations))return hold('FINANCIAL_FACTS_REQUIRED');
 let used;try{used=lifetimeExposure(financial,action.id);}catch{return hold('TOTAL_CEILING_FACTS_REQUIRED');}
 const total=totalCeiling(ctx.config,[...(ctx.authorizations??[]),a,{maxTotalNanoUsd:LEDGER_CHAIN_LIMITS.maxTotalNanoUsd}]);
 if(total?.invalid)return deny('TOTAL_CEILING_INVALID');
 if(used+integer(f.maxCostNanoUsd)>total)return deny('TOTAL_CEILING_EXCEEDED');
 const call={receiver_id:batch.binding.contractId,method_name:'append',args:batch.unsignedCall.args,gas:f.gasUnits,deposit:'0'};
 const envelope=ctx.data.signingEnvelope;
 // This private producer must verify the current native signing route. An owner
 // manifest, provider status or caller "verified" boolean is not a fee certificate.
 if(ctx.config?.mode!=='live'||!envelope||envelope.source!=='native-signing-envelope-verifier'||envelope.companyId!==ctx.companyId||envelope.bindingHash!==bindingHash||envelope.batchHash!==batch.batchHash||envelope.nativeCallHash!==hash(call)||envelope.agentId!==a.agentId||envelope.grantId!==a.grantId||envelope.maxFeeYocto!==f.maxFeeYocto||!text(envelope.evidenceRef)||!Number.isFinite(Date.parse(envelope.validUntil))||Date.parse(envelope.validUntil)<=ctx.now)return hold('LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED',{plan:plan(action,{batch:batchSummary(batch),required:['Verified exact native signing/fee envelope','Protected native Agent API identity and grant','Current shared Treasury native resource and USD budget']})});
 const native=financial.nativeAccounts?.find(n=>n.networkId===batch.binding.networkId&&n.accountId===batch.binding.signerId);
 if(!native||native.source!=='near-json-rpc-final-account'||!isIntegerAmount(native.balanceYocto)||!Number.isFinite(Date.parse(native.observedAt))||(Date.parse(native.observedAt)>ctx.now||ctx.now-Date.parse(native.observedAt)>LEDGER_CHAIN_LIMITS.maxRpcAgeMs))return hold('LEDGER_CHAIN_NATIVE_RESOURCE_REQUIRED');
 const held=(financial.reservations??[]).filter(r=>r.actionId!==action.id&&r.nativeResource?.accountId===native.accountId&&r.nativeResource.networkId===native.networkId&&r.status!=='released').reduce((sum,r)=>sum+(['reconciled','failed'].includes(r.status)?!Number.isSafeInteger(r.nativeSettledBlockHeight)||r.nativeSettledBlockHeight>native.blockHeight?integer(r.actualNativeFeeYocto??r.nativeResource.amountYocto):0n:integer(r.nativeResource.amountYocto)),0n);
 if(integer(native.balanceYocto)<held+integer(f.maxFeeYocto))return hold('LEDGER_CHAIN_NATIVE_RESOURCE_INSUFFICIENT');
 const existing=financial.reservations.find(r=>r.actionId===action.id);
 if(existing&&!ctx.dispatch)return hold('LEDGER_CHAIN_RECONCILE_REQUIRED');
 return allow({authorizationId:a.id,plan:{kind:'reservation',operationKind:'ledger_chain_publish',custody:{agentId:a.agentId,grantId:a.grantId},nativeCall:call,nativeCallHash:hash(call),executionAllowed:true,grantsSpendingAuthority:true,batchId:batch.id,reservation:{id:`reservation:${action.id}`,actionId:action.id,purpose:'native_ledger',status:'reserved',accountingDay:at(ctx).slice(0,10),upperBoundNanoUsd:f.maxCostNanoUsd,nativeResource:{networkId:native.networkId,accountId:native.accountId,amountYocto:f.maxFeeYocto},batchHash:batch.batchHash}}});
}

export function onchainLedgerDecision(action,facts,ctx){
 if(!LEDGER_CHAIN_ACTIONS.includes(action.type))return deny('UNKNOWN_LEDGER_CHAIN_ACTION');
 if(!ownerAccess(facts.access,ctx.companyId,ctx.config?.mode??'setup'))return deny('ACCESS_DENIED');
 if(!exact(action,['id','type']))return deny('LEDGER_CHAIN_INPUT_INVALID');
 if(!ctx.data||ctx.data.companyId!==ctx.companyId||!Array.isArray(ctx.data.batches))return hold('LEDGER_CHAIN_FACTS_REQUIRED');
 const input=facts.input??{};
 if(action.type==='ledger_chain_pending'){
  const s=ctx.data.submissions?.find(s=>s.id===input.operationId&&s.companyId===ctx.companyId),r=ctx.data.financial?.reservations?.find(r=>r.actionId===input.operationId);
  if(!exact(input,['operationId'])||!s||!['unknown','pending','failed'].includes(s.result?.status)||!r||r.purpose!=='native_ledger'||['reconciled','released'].includes(r.status))return hold('ORIGINAL_UNRESOLVED_OPERATION_REQUIRED');
  return allow({plan:{kind:'reconciliation',reservationId:r.id,status:'unknown',evidenceRef:`local-native-unresolved:${hash(s.result)}`}});
 }
 if(action.type==='ledger_chain_release'){
  const s=ctx.data.submissions?.find(s=>s.id===input.operationId&&s.companyId===ctx.companyId),r=ctx.data.financial?.reservations?.find(r=>r.actionId===input.operationId);
  if(!exact(input,['operationId'])||!s||s.result?.status!=='not_submitted'||!r||r.purpose!=='native_ledger')return hold('PROVEN_NO_DISPATCH_REQUIRED');
  return allow({plan:{kind:'reconciliation',reservationId:r.id,status:'released',actualCostNanoUsd:'0',evidenceRef:`local-native-no-dispatch:${hash(s.result)}`}});
 }
 if(action.type==='ledger_chain_balance'){
  if(ctx.config?.mode!=='live')return hold('LIVE_POLICY_REQUIRED');
  const n=ctx.data.nativeAccount;
  if(!exact(input,[])||!validBinding(ctx.data.binding)||!n||n.source!=='near-json-rpc-final-account'||n.accountId!==ctx.data.binding.signerId||n.networkId!==ctx.data.binding.networkId||!isIntegerAmount(n.balanceYocto)||!Number.isSafeInteger(n.blockHeight)||n.blockHeight<1||!text(n.reference)||!Number.isFinite(Date.parse(n.observedAt))||(Date.parse(n.observedAt)>ctx.now||ctx.now-Date.parse(n.observedAt)>LEDGER_CHAIN_LIMITS.maxRpcAgeMs))return hold('LEDGER_CHAIN_NATIVE_RESOURCE_REQUIRED');
  return allow({plan:{kind:'native_balance_snapshot',observation:structuredClone(n),grantsSpendingAuthority:false}});
 }
 if(action.type==='ledger_chain_cost'){
  const c=ctx.data.costEvidence,financial=ctx.data.financial,r=financial?.reservations?.find(r=>r.actionId===input.operationId);
  if(!exact(input,['operationId'])||!c||c.source!=='near-json-rpc-final-fee'||c.operationId!==input.operationId||!r||r.purpose!=='native_ledger'||c.accountId!==r.nativeResource?.accountId||c.networkId!==r.nativeResource?.networkId||!isIntegerAmount(c.actualFeeYocto)||!isIntegerAmount(c.actualCostNanoUsd)||integer(c.actualFeeYocto)>integer(r.nativeResource.amountYocto)||integer(c.actualCostNanoUsd)>integer(r.upperBoundNanoUsd)||!text(c.receiptId)||!text(c.evidenceRef))return hold('LEDGER_CHAIN_FEE_RECEIPT_REQUIRED');
  if(!Number.isSafeInteger(c.settledBlockHeight)||c.settledBlockHeight<1)return hold('NATIVE_FEE_BLOCK_REQUIRED');
  return allow({plan:{kind:'operational_cost',reservationId:r.id,actualCostNanoUsd:c.actualCostNanoUsd,nativeFeeYocto:c.actualFeeYocto,nativeSettledBlockHeight:c.settledBlockHeight,receiptId:c.receiptId,evidenceRef:c.evidenceRef,accountingDay:r.accountingDay,expenseCategory:'native_ledger'}});
 }
 if(['ledger_chain_view','ledger_chain_export'].includes(action.type)&&!exact(input,[]))return deny('LEDGER_CHAIN_INPUT_INVALID');
 let p;try{p=projectChainRecords(ctx.data.events,ctx.companyId);}catch{return hold('LEDGER_CHAIN_JOURNAL_INVALID');}
 if(action.type==='ledger_chain_export')return allow({plan:plan(action,{schemaVersion:1,companyHash:p.companyHash,records:p.records,head:p.head,rawDataPublished:false})});
 const binding=ctx.data.binding,rpc=rpcState(ctx,p.companyHash,binding),check=validBinding(binding)?checkpointState(ctx,p,binding):null;
 const changedBinding=validBinding(binding)&&ctx.data.batches.some(b=>b.companyId!==ctx.companyId||b.companyHash!==p.companyHash||b.bindingHash!==ledgerBindingHash(p.companyHash,binding));
 if(action.type==='ledger_chain_view')return allow({plan:plan(action,{companyHash:p.companyHash,localHead:p.head,deploymentWallet:deploymentWallet(ctx),contractArtifact:contractArtifact(ctx),binding:validBinding(binding)?structuredClone(binding):null,checkpoint:check?.checkpoint??null,chain:rpc.rpc?{sequence:rpc.rpc.sequence,hash:rpc.rpc.hash,blockHeight:rpc.rpc.blockHeight,blockHash:rpc.rpc.blockHash,observedAt:rpc.rpc.observedAt,finality:'final'}:null,reasonCode:changedBinding?'LEDGER_CHAIN_BINDING_IMMUTABLE':check?.reasonCode??rpc.reasonCode??'LEDGER_CHAIN_HEAD_OBSERVED',batches:ctx.data.batches.map(b=>{let admission;try{admission=validBatch(b,ctx,p,binding)?publishHold({id:`onchain:${ctx.companyId}:ledger_chain_publish:${hash(b.id)}`,type:'ledger_chain_publish'},ctx,b,b.bindingHash):hold('LEDGER_CHAIN_BATCH_INVALID');}catch{admission=hold('LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED');}return {...batchSummary(b),publishing:{executionAllowed:b.status!=='confirmed'&&admission.status==='allow',reasonCode:admission.reasonCode}};}),submissions:(ctx.data.submissions??[]).filter(s=>s.companyId===ctx.companyId).map(s=>({id:s.id,batchId:s.input?.batchId,status:s.status,providerRequestId:s.result?.providerRequestId??null,costReconciled:ctx.data.financial?.reservations?.some(r=>r.actionId===s.id&&r.status==='reconciled')??false})),rawDataPublished:false})});
 if(!validBinding(binding))return hold('LEDGER_CHAIN_BINDING_REQUIRED');
 if(changedBinding)return deny('LEDGER_CHAIN_BINDING_IMMUTABLE');
 if(check.reasonCode)return hold(check.reasonCode);
 if(rpc.reasonCode)return hold(rpc.reasonCode);
 const {checkpoint,bindingHash}=check,r=rpc.rpc;
 if(action.type==='ledger_chain_prepare'){
  if(!exact(input,['limit'],[])||input.limit!==undefined&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>LEDGER_CHAIN_LIMITS.maxBatch))return deny('LEDGER_CHAIN_INPUT_INVALID');
  if(ctx.config?.killSwitch)return deny('KILL_SWITCH');
  if(r.sequence!==checkpoint.sequence||r.hash!==checkpoint.hash)return hold('LEDGER_CHAIN_HEAD_MISMATCH');
  if(ctx.data.batches.some(b=>b.status!=='confirmed'))return hold('LEDGER_CHAIN_BATCH_PENDING');
  const records=p.records.slice(checkpoint.sequence,checkpoint.sequence+(input.limit??LEDGER_CHAIN_LIMITS.maxBatch));
  if(!records.length)return hold('LEDGER_CHAIN_NO_NEW_RECORDS');
  const batch={id:`${action.id}:batch`,companyId:ctx.companyId,companyHash:p.companyHash,binding:structuredClone(binding),bindingHash,startSequence:records[0].sequence,endSequence:records.at(-1).sequence,previousHash:checkpoint.hash,expectedHead:{sequence:checkpoint.sequence,hash:checkpoint.hash},records,status:'prepared',version:1,createdAt:at(ctx),updatedAt:at(ctx)};batch.batchHash=ledgerBatchHash(batch);
  batch.unsignedCall={receiverId:binding.contractId,methodName:'append',args:{company_hash:p.companyHash,expected_sequence:checkpoint.sequence,expected_hash:checkpoint.hash,records:structuredClone(records)}};
  const genesis=ctx.data.checkpoint?null:{id:p.companyHash,companyId:ctx.companyId,companyHash:p.companyHash,bindingHash,sequence:0,hash:LEDGER_ZERO_HASH,version:1,updatedAt:at(ctx)};
  return allow({plan:plan(action,{batch,puts:[...genesis?[put('ledgerChainCheckpoints',genesis)]:[],put('ledgerChainBatches',batch)],events:[event(action,ctx,'ledger.chain_prepared',{batchId:batch.id,batchHash:batch.batchHash,startSequence:batch.startSequence,endSequence:batch.endSequence})]})});
 }
 if(!exact(input,['batchId'])||!text(input.batchId,500))return deny('LEDGER_CHAIN_INPUT_INVALID');
 const b=ctx.data.batches.find(b=>b.id===input.batchId);if(!validBatch(b,ctx,p,binding))return hold('LEDGER_CHAIN_BATCH_INVALID');
 if(action.type==='ledger_chain_publish'){
  if(b.status!=='prepared')return hold('LEDGER_CHAIN_RECONCILE_REQUIRED');
  if(checkpoint.sequence!==b.expectedHead.sequence||checkpoint.hash!==b.expectedHead.hash||r.sequence!==b.expectedHead.sequence||r.hash!==b.expectedHead.hash)return hold('LEDGER_CHAIN_HEAD_MISMATCH');
  return publishHold(action,ctx,b,bindingHash);
 }
 if(action.type==='ledger_chain_reconcile'){
  if(!provesBatch(r,b,p))return hold('LEDGER_CHAIN_FINALITY_PROOF_REQUIRED');
  if(checkpoint.sequence>r.sequence)return hold('LEDGER_CHAIN_CHECKPOINT_MISMATCH');
  if(b.status==='confirmed'&&checkpoint.sequence>=b.endSequence)return allow({plan:plan(action,{batch:batchSummary(b),checkpoint,replay:true})});
  const nextCheckpoint={id:p.companyHash,companyId:ctx.companyId,companyHash:p.companyHash,bindingHash,sequence:r.sequence,hash:r.hash,version:(ctx.data.checkpoint?.version??0)+1,updatedAt:at(ctx)},nextBatch={...b,status:'confirmed',version:b.version+1,updatedAt:at(ctx),finalBlockHeight:r.blockHeight,finalBlockHash:r.blockHash};
  return allow({plan:plan(action,{batch:batchSummary(nextBatch),checkpoint:nextCheckpoint,puts:[put('ledgerChainCheckpoints',nextCheckpoint,ctx.data.checkpoint),put('ledgerChainBatches',nextBatch,b)],events:[event(action,ctx,'ledger.chain_confirmed',{batchId:b.id,batchHash:b.batchHash,sequence:r.sequence,hash:r.hash})],costReconciled:false})});
 }
 return deny('UNKNOWN_LEDGER_CHAIN_ACTION');
}
