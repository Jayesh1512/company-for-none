import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRules} from '../../src/rules/index.mjs';
import {hash} from '../../src/rules/config.mjs';
import {ledgerCompanyHash,ledgerRecordHash,ledgerBindingHash,projectChainRecords,LEDGER_ZERO_HASH} from '../../src/rules/onchain-ledger.mjs';
import {config} from '../rules/fixtures.mjs';
const NOW=Date.parse('2026-11-14T16:00:00Z'),companyId='ledger-test',owner={companyId,role:'owner',verified:true};
function fixture(){
 const events=[{sequence:1,type:'support.replied',at:new Date(NOW-2000).toISOString(),data:{companyId,actorId:'PRIVATE-CUSTOMER-123',text:'PRIVATE medical claim text',tokenHash:'private-token-digest'}},{sequence:2,type:'a-private-customer-event-name',at:new Date(NOW-1000).toISOString(),data:{companyId,actorId:'PRIVATE-AGENT',money:{amount:'12345678'}}}];
 const binding={networkId:'mainnet',contractId:'company-ledger.near',signerId:'writer.near'},p=projectChainRecords(events,companyId),data={companyId,events,binding,checkpoint:null,batches:[],rpc:{source:'near-json-rpc',networkId:binding.networkId,contractId:binding.contractId,signerId:binding.signerId,companyHash:p.companyHash,sequence:0,hash:LEDGER_ZERO_HASH,blockHeight:100,blockHash:'controlled-final-block-hash',observedAt:new Date(NOW).toISOString(),finality:'final'},authorization:null,feeBound:null,financial:{version:0,reservations:[]}};let n=0,clock=NOW;
 const make=()=>createRules({setupOnly:true,totalCeilingNanoUsd:'5000000000',companyId,clock:()=>clock,getLedgerFacts:()=>data});let rules=make();
 const action=type=>({id:`chain:${++n}`,type}),evaluate=(a,input={},access=owner)=>rules.evaluate(a,{access,input});
 const apply=d=>{assert.equal(d.status,'allow',JSON.stringify(d));for(const put of d.plan.puts){if(put.namespace==='ledgerChainCheckpoints'){assert.equal(data.checkpoint?.version??null,put.expectedVersion);data.checkpoint=structuredClone(put.value);}else{assert.equal(put.namespace,'ledgerChainBatches');const i=data.batches.findIndex(b=>b.id===put.id);assert.equal(data.batches[i]?.version??null,put.expectedVersion);if(i<0)data.batches.push(structuredClone(put.value));else data.batches[i]=structuredClone(put.value);}}return d;};
 const prepare=(input={})=>evaluate(action('ledger_chain_prepare'),input);
 const publish=b=>evaluate(action('ledger_chain_publish'),{batchId:b.id});
 function auth(b){data.authorization={id:'protected-one-shot',route:'near-agent-api-native-call',companyId,companyHash:b.companyHash,bindingHash:b.bindingHash,batchHash:b.batchHash,operationId:b.id,notBefore:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),maxCalls:1,agentId:'private-agent',grantId:'private-grant',allowedReceiverId:binding.contractId,allowedMethod:'append',maxGasUnits:'30000000000000',maxDepositYocto:'0',maxFeeYocto:'3000000000000000000000',maxCostNanoUsd:'1000000',maxTotalNanoUsd:'5000000000'};data.feeBound={source:'near-rpc-fee-bound',bindingHash:b.bindingHash,batchHash:b.batchHash,reference:'native-gas-envelope',usdReference:'private-fx-bound',validUntil:new Date(NOW+60000).toISOString(),gasUnits:'30000000000000',depositYocto:'0',maxFeeYocto:'3000000000000000000000',maxCostNanoUsd:'1000000'};}
 return {data,rules,action,evaluate,prepare,publish,apply,auth,p,restart:()=>{rules=make();return rules;},setTime:t=>clock=t};
}

test('setup export is a scoped redacted contiguous hash chain with no signing or raw identity/payload disclosure',()=>{
 const h=fixture();h.data.binding=null;h.data.rpc=null;const d=h.evaluate(h.action('ledger_chain_export'));assert.equal(d.status,'allow');assert.equal(d.plan.records.length,2);const serialized=JSON.stringify(d.plan);for(const privateValue of ['PRIVATE','private-token','a-private-customer-event-name','medical','12345678'])assert.ok(!serialized.includes(privateValue));
 for(const [i,r] of d.plan.records.entries()){assert.deepEqual(Object.keys(r),['sequence','type','at','actorHash','payloadHash','previousHash','hash']);assert.equal(r.previousHash,i?d.plan.records[i-1].hash:LEDGER_ZERO_HASH);const expected=createHash('sha256').update(['company-ledger:record:v1',d.plan.companyHash,String(r.sequence),r.type,r.at,r.actorHash,r.payloadHash,r.previousHash].join('\n')).digest('hex');assert.equal(r.hash,expected);}
 assert.equal(d.plan.records[1].type,'private.event');assert.equal(d.plan.executionAllowed,false);assert.equal(d.permit,undefined);assert.notEqual(ledgerCompanyHash('other-company'),d.plan.companyHash);const other=projectChainRecords(h.data.events.map(e=>({...e,data:{...e.data,companyId:'other-company'}})),'other-company');assert.notEqual(other.records[0].actorHash,d.plan.records[0].actorHash);assert.notEqual(other.records[0].payloadHash,d.plan.records[0].payloadHash);
});

test('every operation is owner-only and ignores caller journal/RPC/authorization booleans',()=>{
 const h=fixture();for(const type of ['ledger_chain_view','ledger_chain_export','ledger_chain_prepare','ledger_chain_publish','ledger_chain_reconcile'])for(const access of [null,{...owner,verified:false},{...owner,companyId:'other'},{...owner,role:'support_customer'}])assert.equal(h.evaluate(h.action(type),{},access).reasonCode,'ACCESS_DENIED');
 h.data.rpc=null;assert.equal(h.rules.evaluate(h.action('ledger_chain_prepare'),{access:owner,input:{},rpc:{verified:true},events:h.data.events,authorization:{allow:true}}).reasonCode,'LEDGER_CHAIN_RPC_REQUIRED');
});

test('unsigned prepare binds current local checkpoint and actual RPC head, with no gas/deposit/key invented',()=>{
 const h=fixture(),d=h.apply(h.prepare({limit:1})),b=d.plan.batch;assert.equal(b.startSequence,1);assert.equal(b.endSequence,1);assert.equal(b.bindingHash,ledgerBindingHash(b.companyHash,h.data.binding));assert.equal(b.unsignedCall.receiverId,'company-ledger.near');assert.equal(b.unsignedCall.methodName,'append');assert.deepEqual(b.unsignedCall.args,{company_hash:b.companyHash,expected_sequence:0,expected_hash:LEDGER_ZERO_HASH,records:b.records});assert.equal(b.unsignedCall.gas,undefined);assert.equal(b.unsignedCall.deposit,undefined);assert.equal(d.permit,undefined);assert.equal(h.data.checkpoint.sequence,0);assert.equal(h.prepare().reasonCode,'LEDGER_CHAIN_BATCH_PENDING');
 const restarted=h.restart();assert.equal(restarted.evaluate(h.action('ledger_chain_prepare'),{access:owner,input:{}}).reasonCode,'LEDGER_CHAIN_BATCH_PENDING');
});

test('binding cannot be swapped across prepared work, checkpoint, restart or caller input',()=>{
 for(const key of ['networkId','contractId','signerId']){const h=fixture();h.apply(h.prepare());h.data.binding={...h.data.binding,[key]:key==='networkId'?'testnet':'other.near'};assert.equal(h.prepare().reasonCode,'LEDGER_CHAIN_BINDING_IMMUTABLE');}
 const h=fixture();assert.equal(h.evaluate(h.action('ledger_chain_prepare'),{networkId:'testnet'}).reasonCode,'LEDGER_CHAIN_INPUT_INVALID');
});

test('gaps, reordered or rewritten private journal facts, invalid checkpoint and stale/mismatched RPC hold preparation',()=>{
 for(const mutation of ['gap','reorder','foreign','invalid-time','rpc-old','rpc-future','rpc-company','rpc-writer','rpc-unfinal','rpc-head']){const h=fixture();
  if(mutation==='gap')h.data.events[1].sequence=3;if(mutation==='reorder')h.data.events.reverse();if(mutation==='foreign')h.data.events[1].data.companyId='foreign';if(mutation==='invalid-time')h.data.events[0].at='not-date';if(mutation==='rpc-old')h.data.rpc.observedAt=new Date(NOW-30001).toISOString();if(mutation==='rpc-future')h.data.rpc.observedAt=new Date(NOW+1).toISOString();if(mutation==='rpc-company')h.data.rpc.companyHash=ledgerCompanyHash('foreign');if(mutation==='rpc-writer')h.data.rpc.signerId='other.near';if(mutation==='rpc-unfinal')h.data.rpc.finality='optimistic';if(mutation==='rpc-head'){h.data.rpc.sequence=1;h.data.rpc.hash=h.p.records[0].hash;}
  assert.notEqual(h.prepare().status,'allow',mutation);
 }
 const h=fixture();h.apply(h.prepare());h.data.events[0].data.text='rewritten';const b=h.data.batches[0];assert.equal(h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id}).reasonCode,'LEDGER_CHAIN_BATCH_INVALID');
});

test('publish fails closed without protected authorization and cannot be enabled by a key/success/receipt flag',()=>{
 const h=fixture(),b=h.apply(h.prepare()).plan.batch;assert.equal(h.publish(b).reasonCode,'LEDGER_CHAIN_AUTHORIZATION_REQUIRED');h.auth(b);assert.equal(h.publish(b).reasonCode,'LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED');assert.equal(h.publish(b).permit,undefined);assert.equal(h.publish(b).plan.executionAllowed,false);
 h.data.authorization.expiresAt=new Date(NOW).toISOString();assert.equal(h.publish(b).reasonCode,'LEDGER_CHAIN_AUTHORIZATION_REQUIRED');h.auth(b);h.data.feeBound=null;assert.equal(h.publish(b).reasonCode,'LEDGER_CHAIN_FEE_BOUND_REQUIRED');
});

test('native gas/deposit/fee caps and common USD5 lifetime actual+pending are checked without invented asset conversion',()=>{
 for(const mutation of ['gas','deposit','native-fee','usd','total','unknown']){const h=fixture(),b=h.apply(h.prepare()).plan.batch;h.auth(b);
  if(mutation==='gas')h.data.feeBound.gasUnits='30000000000001';if(mutation==='deposit')h.data.feeBound.depositYocto='1';if(mutation==='native-fee')h.data.feeBound.maxFeeYocto='3000000000000000000001';if(mutation==='usd')h.data.feeBound.maxCostNanoUsd='1000001';if(mutation==='total')h.data.financial.reservations=[{actionId:'old-worker-spend',status:'reconciled',upperBoundNanoUsd:'5000000000',actualCostNanoUsd:'4999000001'}];if(mutation==='unknown')h.data.financial.reservations=[{actionId:'old-unknown',status:'unknown',upperBoundNanoUsd:'5000000000'}];
  assert.equal(h.publish(b).reasonCode,['total','unknown'].includes(mutation)?'TOTAL_CEILING_EXCEEDED':mutation==='deposit'?'LEDGER_CHAIN_DEPOSIT_UNSUPPORTED':'LEDGER_CHAIN_FEE_CAP_EXCEEDED',mutation);
 }
});

test('exact finalized RPC batch confirmation advances checkpoint but never claims cost reconciliation',()=>{
 const h=fixture(),b=h.apply(h.prepare({limit:1})).plan.batch;assert.equal(h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id}).reasonCode,'LEDGER_CHAIN_FINALITY_PROOF_REQUIRED');h.data.rpc.sequence=1;h.data.rpc.hash=b.records[0].hash;
 const d=h.apply(h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id}));assert.equal(d.plan.costReconciled,false);assert.equal(h.data.checkpoint.sequence,1);assert.equal(h.data.batches[0].status,'confirmed');const next=h.prepare();assert.equal(next.status,'allow');assert.equal(next.plan.batch.startSequence,2);assert.equal(next.plan.batch.previousHash,b.records[0].hash);
 const replay=h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id});assert.equal(replay.plan.replay,true);assert.equal(replay.plan.puts.length,0);
});

test('a later RPC head needs every exact contiguous actual record from batch end through the observed head',()=>{
 for(const mutation of ['valid','missing','wrong','duplicate','order']){const h=fixture(),b=h.apply(h.prepare({limit:1})).plan.batch;h.data.rpc.sequence=2;h.data.rpc.hash=h.p.records[1].hash;h.data.rpc.records=structuredClone(h.p.records);
  if(mutation==='missing')h.data.rpc.records.shift();if(mutation==='wrong')h.data.rpc.records[0].hash='f'.repeat(64);if(mutation==='duplicate')h.data.rpc.records=[h.p.records[0],h.p.records[0]];if(mutation==='order')h.data.rpc.records.reverse();
  const d=h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id});assert.equal(d.status,mutation==='valid'?'allow':'hold',mutation);if(mutation==='valid'){h.apply(d);assert.equal(h.data.checkpoint.sequence,2);}
 }
});

test('tampered unsigned args and standalone success/tx IDs never become a chain confirmation',()=>{
 const h=fixture(),b=h.apply(h.prepare()).plan.batch;h.data.batches[0].unsignedCall.args.secret='PRIVATE';assert.equal(h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id}).reasonCode,'LEDGER_CHAIN_BATCH_INVALID');
 const h2=fixture(),b2=h2.apply(h2.prepare()).plan.batch;assert.equal(h2.rules.evaluate(h2.action('ledger_chain_reconcile'),{access:owner,input:{batchId:b2.id},confirmed:true,transactionHash:'pasted-hash',receipt:{success:true}}).reasonCode,'LEDGER_CHAIN_FINALITY_PROOF_REQUIRED');
});

test('read/export/reconcile remain separate from paid readiness, while current kill and all historical gates persist',()=>{
 const h=fixture(),b=h.apply(h.prepare()).plan.batch;h.rules.updateConfig({...config(),mode:'live',killSwitch:true});assert.equal(h.publish(b).reasonCode,'KILL_SWITCH');assert.equal(h.evaluate(h.action('ledger_chain_export')).status,'allow');assert.equal(h.evaluate(h.action('ledger_chain_view')).status,'allow');h.data.rpc.sequence=b.endSequence;h.data.rpc.hash=b.records.at(-1).hash;assert.equal(h.evaluate(h.action('ledger_chain_reconcile'),{batchId:b.id}).status,'allow');
 const setup=fixture();assert.equal(setup.rules.evaluate({id:'inference',type:'inference'},{access:owner}).reasonCode,'COMMERCIAL_POLICY_REQUIRED');assert.equal(setup.rules.evaluate({id:'funding',type:'funding'},{access:owner}).reasonCode,'COMMERCIAL_POLICY_REQUIRED');
});

test('owner-only deployment address/artifact projection never exposes secrets or becomes an operational writer binding',()=>{
 const h=fixture(),accountId='755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b';h.data.binding=null;h.data.rpc=null;
 h.data.deploymentWallet={companyId,networkId:'mainnet',accountId,publicKey:`ed25519:${'2'.repeat(44)}`,accountExists:false,balanceYocto:null,observedAt:new Date(NOW).toISOString(),credentialFile:'/PRIVATE/wallet.json',privateKey:'DO_NOT_EXPOSE'};
 h.data.deployment={wasmHash:'a'.repeat(64),wasmBytes:162000,codeHash:null,secret:'PRIVATE-BUILD',compilerFlags:'PRIVATE'};
 const view=h.evaluate(h.action('ledger_chain_view'));assert.equal(view.status,'allow');assert.equal(view.plan.deploymentWallet.accountId,accountId);assert.equal(view.plan.deploymentWallet.accountExists,false);assert.equal(view.plan.binding,null);assert.equal(view.plan.contractArtifact.wasmBytes,162000);assert.ok(!JSON.stringify(view).includes('PRIVATE'));assert.ok(!JSON.stringify(view).includes('privateKey'));assert.equal(h.prepare().reasonCode,'LEDGER_CHAIN_BINDING_REQUIRED');
 assert.equal(h.evaluate(h.action('ledger_chain_view'),{},null).reasonCode,'ACCESS_DENIED');h.data.deploymentWallet.companyId='foreign';assert.equal(h.evaluate(h.action('ledger_chain_view')).plan.deploymentWallet,null);
 const a=h.action('ledger_chain_view');assert.equal(h.rules.evaluate(a,{access:owner,input:{},deploymentWallet:{...h.data.deploymentWallet,companyId}}).plan.deploymentWallet,null);
});
