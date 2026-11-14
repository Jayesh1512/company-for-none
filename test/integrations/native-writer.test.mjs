import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createTreasury} from '../../src/treasury/index.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createOnchainLedger,readLedgerFacts} from '../../src/onchain/index.mjs';
import {createAgentLedgerWriter} from '../../src/onchain/agent-writer.mjs';
import {NEAR_RPC} from '../../src/onchain/rpc.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {config} from '../rules/fixtures.mjs';
import {LEDGER_ZERO_HASH,ledgerCompanyHash} from '../../src/rules/onchain-ledger.mjs';
const NOW=Date.parse('2026-11-14T16:00:00Z'),companyId='native-integration',owner={companyId,role:'owner',verified:true},binding={networkId:'mainnet',contractId:'ledger.near',signerId:'writer.near'},txHash='2'.repeat(44),blockHash='3'.repeat(44),agentId='a'.repeat(64),correlation='op_'+'b'.repeat(43);
async function fixture(t,{acceptedCrash=false,finalStatus='FINAL',executionStatus={SuccessValue:''},rpcUnavailable=false}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'native-mentor-'));let journal=await createJournal({directory,clock:()=>new Date(NOW)}),rules,treasury,ledger,writer,authorization,feeBound,envelope,call,sends=0,statusReads=0,rpcAlter=false,stopAtIdentity=false;
 await journal.transaction({actionId:'real-local-event',fingerprint:'local-event'},tx=>tx.append('support.replied',{companyId,text:'private customer text'}));
 const agentTransport=async(url,options)=>{
  if(url.endsWith('/native/near/call')){sends++;call=JSON.parse(options.body);if(acceptedCrash)throw Error('connection lost after provider acceptance');return new Response(JSON.stringify({correlation_id:correlation}));}
  if(url.includes('/v1/status?')){statusReads++;return new Response(JSON.stringify({correlation_id:correlation,agent_id:agentId,type:'native',status:'SUCCESS',details:{method:'near_call',chain:'near',account_id:binding.signerId,target:binding.contractId,method_name:'append',tx_hash:txHash}}));}
  if(stopAtIdentity)rules.updateConfig({...rules.snapshot().config,killSwitch:true});return new Response(JSON.stringify({status:'ACTIVE',wallet:{near_account_id:binding.signerId}}));
 };
 const rpcTransport=async(url,options)=>{assert.equal(url,NEAR_RPC.mainnet);const q=JSON.parse(options.body);if(rpcUnavailable&&q.method==='tx')throw Error('RPC unavailable');let result;
  if(q.method==='tx')result={final_execution_status:finalStatus,transaction:{hash:txHash,signer_id:rpcAlter?'other.near':binding.signerId,receiver_id:binding.contractId,actions:[{FunctionCall:{...call,args:Buffer.from(JSON.stringify(call.args)).toString('base64')}}]},transaction_outcome:{id:'tx',block_hash:blockHash,outcome:{tokens_burnt:'5'}},receipts_outcome:[{id:'receipt',block_hash:blockHash,outcome:{tokens_burnt:'7'}}],status:executionStatus};
  else if(q.method==='block')result={header:{hash:blockHash,height:101}};
  else if(q.params.request_type==='view_account')result={amount:'1000',code_hash:'test-pinned-code',block_height:100,block_hash:blockHash};
  else result={result:[...Buffer.from(JSON.stringify({writerId:binding.signerId,sequence:0,hash:LEDGER_ZERO_HASH,companyHash:ledgerCompanyHash(companyId)}))],block_height:100,block_hash:blockHash};
  return new Response(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));
 };
 const ledgerSubmissionAction=()=>journal.list('ledgerChainSubmissions')[0].action;
 function init(){
  rules=createRules({config:{...config(),mode:'live'},companyId,clock:()=>NOW,totalCeilingNanoUsd:'5000000000',getLedgerFacts:()=>readLedgerFacts({journal,companyId,binding,deployment:{codeHash:'test-pinned-code'},authorization,feeBound,signingEnvelope:envelope,nativeAccount:ledger?.nativeObservation(),costEvidence:ledger?.costEvidence()})});
  treasury=createTreasury({journal,clock:()=>new Date(NOW),getPolicyState:()=>rules.snapshot()});
  const dispatchAuthorized=async({action,decision,facts},send)=>{const d=rules.validateDispatch(decision.permit,{...facts,action,financial:treasury.snapshot()});if(d.status!=='allow')return d;await treasury.consumePermit({actionId:action.id,permit:decision.permit,decision:d});return rules.dispatch(decision.permit,{...facts,action,financial:treasury.snapshot()},send);};
  writer=createAgentLedgerWriter({journal,binding,agentId,resolveSecret:async()=> 'stand-in-secret',dispatchAuthorized,transport:agentTransport,rpcTransport,clock:()=>new Date(NOW)});
  ledger=createOnchainLedger({journal,rules,treasury,writer,companyId,binding,deployment:{codeHash:'test-pinned-code'},transport:rpcTransport,clock:()=>new Date(NOW),getUsdBound:()=>({source:'native-usd-upper-bound',reference:'controlled-fx',nanoUsdPerNear:'1000000000',validUntil:new Date(NOW+60000).toISOString()})});
 }
 init();t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 return {get writer(){return writer;},get ledger(){return ledger;},get journal(){return journal;},get treasury(){return treasury;},get rules(){return rules;},counts:()=>({sends,statusReads}),alterRpc:()=>rpcAlter=true,
  async prepare(){const b=(await ledger.prepare({limit:1},owner,'batch')).batch;authorization={id:'exact-native',route:'near-agent-api-native-call',companyId,companyHash:b.companyHash,bindingHash:b.bindingHash,batchHash:b.batchHash,operationId:b.id,maxCalls:1,agentId,grantId:'grant',allowedReceiverId:binding.contractId,allowedMethod:'append',notBefore:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),maxGasUnits:'30',maxDepositYocto:'0',maxFeeYocto:'100',maxCostNanoUsd:'100',maxTotalNanoUsd:'5000000000'};feeBound={source:'near-rpc-fee-bound',bindingHash:b.bindingHash,batchHash:b.batchHash,reference:'controlled-native-envelope',usdReference:'controlled-fx',validUntil:new Date(NOW+60000).toISOString(),gasUnits:'30',depositYocto:'0',maxFeeYocto:'100',maxCostNanoUsd:'100'};envelope={source:'native-signing-envelope-verifier',companyId,bindingHash:b.bindingHash,batchHash:b.batchHash,nativeCallHash:fingerprint({receiver_id:binding.contractId,method_name:'append',args:b.unsignedCall.args,gas:'30',deposit:'0'}),agentId,grantId:'grant',maxFeeYocto:'100',evidenceRef:'private:test-only-signing-envelope',validUntil:new Date(NOW+60000).toISOString()};return b;},
  stopAtIdentity(){stopAtIdentity=true;},clearEnvelope(){envelope=null;},async restart(){await journal.close();journal=await createJournal({directory,clock:()=>new Date(NOW)});init();}};
}
test('actual native client/M01/M03 composition reserves both units, writes once, reopens original and verifies actual RPC fees',async t=>{
 const f=await fixture(t),batch=await f.prepare(),r=await f.ledger.publish({batchId:batch.id},owner);assert.equal(r.status,'unknown');assert.equal(f.counts().sends,1);assert.equal(f.treasury.snapshot().reservations[0].nativeResource.amountYocto,'100');
 const submission=f.journal.list('ledgerChainSubmissions')[0];assert.ok(f.journal.get('nativeExchanges',submission.id).raw.includes(correlation));await f.restart();await f.ledger.publish({batchId:batch.id},owner);assert.equal(f.counts().sends,1);
 assert.equal((await f.ledger.fees({operationId:submission.id},owner)).costReconciled,true);const state=f.treasury.snapshot();assert.equal(state.reservations[0].actualNativeFeeYocto,'12');assert.equal(state.reservations[0].nativeSettledBlockHeight,101);assert.equal(state.reservations[0].actualCostNanoUsd,'1');assert.equal(state.dailyCosts['2026-11-14'],'1');assert.equal(state.credits.availableNanoUsd,'0');
 const reads=f.counts().statusReads;assert.equal((await f.ledger.fees({operationId:submission.id},owner)).replayed,true);assert.equal(f.counts().statusReads,reads);
});
test('provider SUCCESS/tx hash never defeats a mismatched final native receipt',async t=>{
 const f=await fixture(t),b=await f.prepare();await f.ledger.publish({batchId:b.id},owner);const s=f.journal.list('ledgerChainSubmissions')[0];f.alterRpc();await assert.rejects(f.ledger.fees({operationId:s.id},owner),{code:'NATIVE_TRANSACTION_BINDING_MISMATCH'});assert.equal(f.treasury.snapshot().reservations[0].status,'unknown');assert.equal(f.counts().sends,1);
});
test('unknown acceptance without provider correlation survives restart and is never blindly resent',async t=>{
 const f=await fixture(t,{acceptedCrash:true}),b=await f.prepare();assert.equal((await f.ledger.publish({batchId:b.id},owner)).status,'unknown');await f.restart();await f.ledger.publish({batchId:b.id},owner);assert.equal(f.counts().sends,1);assert.equal(f.treasury.snapshot().reservations.length,1);
 const s=f.journal.list('ledgerChainSubmissions')[0];await assert.rejects(f.ledger.fees({operationId:s.id},owner),{code:'NATIVE_TRANSACTION_HASH_REQUIRED'});assert.equal(f.counts().sends,1);
});
test('no private verified signing envelope means no native POST, reservation or inferred success',async t=>{
 const f=await fixture(t),b=await f.prepare();f.clearEnvelope();await assert.rejects(f.ledger.publish({batchId:b.id},owner),{code:'LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED'});assert.equal(f.counts().sends,0);assert.equal(f.treasury.snapshot().reservations.length,0);assert.equal(f.journal.list('ledgerChainSubmissions').length,0);
});
test('a stop during the free native preflight yields no POST and releases the exact proven unsubmitted fee reserve',async t=>{
 const f=await fixture(t),b=await f.prepare();f.stopAtIdentity();assert.equal((await f.ledger.publish({batchId:b.id},owner)).status,'not_submitted');assert.equal(f.counts().sends,0);assert.equal(f.treasury.snapshot().reservations[0].status,'released');assert.equal(f.treasury.snapshot().reservations[0].actualCostNanoUsd,'0');
});

test('finalize independently verifies the exact native call at FINAL and persists evidence across restart',async t=>{
 const f=await fixture(t),b=await f.prepare();await f.ledger.publish({batchId:b.id},owner);const action=f.journal.list('ledgerChainSubmissions')[0].action;
 const final=await f.writer.finalize({action});assert.equal(final.status,'confirmed');assert.equal(final.finalityVerified,true);assert.equal(final.transactionHash,txHash);assert.equal(final.providerRequestId,correlation);assert.equal(final.settledBlockHeight,101);assert.ok(final.evidence[0].evidenceRef.startsWith('private:'));
 await f.restart();assert.equal((await f.writer.reconcile({action})).finalityVerified,true);assert.equal((await f.writer.finalize({action})).status,'confirmed');assert.equal(f.counts().sends,1);
});
for(const [name,options]of Object.entries({pending:{finalStatus:'EXECUTED_OPTIMISTIC'},failed:{executionStatus:{Failure:{error_message:'contract failed'}}},unavailable:{rpcUnavailable:true},uncorrelated:{acceptedCrash:true}}))test('finalize leaves '+name+' execution unconfirmed without resubmitting',async t=>{
 const f=await fixture(t,options),b=await f.prepare();await f.ledger.publish({batchId:b.id},owner);const action=f.journal.list('ledgerChainSubmissions')[0].action;
 const final=await f.writer.finalize({action});assert.equal(final.status,'unknown');assert.notEqual(final.finalityVerified,true);assert.equal(f.counts().sends,1);
});
test('finalize rejects a provider hash whose final RPC transaction has another signer',async t=>{
 const f=await fixture(t),b=await f.prepare();await f.ledger.publish({batchId:b.id},owner);f.alterRpc();const final=await f.writer.finalize({action:f.journal.list('ledgerChainSubmissions')[0].action});assert.equal(final.status,'unknown');assert.equal(final.code,'NATIVE_TRANSACTION_BINDING_MISMATCH');assert.equal(f.counts().sends,1);
});
