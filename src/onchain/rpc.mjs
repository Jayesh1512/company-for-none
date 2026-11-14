import {createHash} from 'node:crypto';
import {baseEncode} from 'near-api-js';

export const NEAR_RPC=Object.freeze({mainnet:'https://free.rpc.fastnear.com',testnet:'https://rpc.testnet.fastnear.com'});
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createLedgerRpc({networkId,transport=fetch,rpcUrl,clock=()=>new Date(),expectedCodeHash}){
 const endpoint=NEAR_RPC[networkId]??(networkId==='sandbox'?rpcUrl:null);
 if(!endpoint||networkId==='sandbox'&&!/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(endpoint))fail('LEDGER_CHAIN_NETWORK_REQUIRED');
 let id=0;
 async function request(method,params){
  const response=await transport(endpoint,{method:'POST',headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(10000),body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});
  if(!response.ok)fail('LEDGER_CHAIN_RPC_UNAVAILABLE');
  const reader=response.body?.getReader(),chunks=[];let size=0;if(!reader)fail('LEDGER_CHAIN_RPC_UNAVAILABLE');
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>262144){await reader.cancel();fail('LEDGER_CHAIN_RPC_TOO_LARGE');}chunks.push(r.value);}
  const raw=Buffer.concat(chunks),body=JSON.parse(raw.toString('utf8'));
  if(body.error){if(body.error.cause?.name==='UNKNOWN_ACCOUNT')fail('LEDGER_CHAIN_ACCOUNT_UNFUNDED');throw Object.assign(Error('LEDGER_CHAIN_RPC_UNAVAILABLE'),{code:'LEDGER_CHAIN_RPC_UNAVAILABLE'});}
  if(!body.result)fail('LEDGER_CHAIN_RPC_UNAVAILABLE');
  return {result:body.result,wireHash:createHash('sha256').update(raw).digest('hex')};
 }
 async function account(accountId,blockHash){const r=await request('query',{request_type:'view_account',account_id:accountId,...(blockHash?{block_id:blockHash}:{finality:'final'})});return r.result;}
 async function call(contractId,methodName,args,blockHash){
  const r=await request('query',{request_type:'call_function',account_id:contractId,method_name:methodName,args_base64:Buffer.from(JSON.stringify(args)).toString('base64'),...(blockHash?{block_id:blockHash}:{finality:'final'})});
  if(blockHash&&r.result.block_hash!==blockHash)fail('LEDGER_CHAIN_RPC_BLOCK_MISMATCH');
  if(!Array.isArray(r.result.result)||r.result.result.length>200000)fail('LEDGER_CHAIN_RPC_UNAVAILABLE');
  return {...r,output:JSON.parse(Buffer.from(r.result.result).toString('utf8'))};
 }
 return Object.freeze({
  account,
  async transaction(transactionHash,signerId){
   if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(transactionHash??''))fail('NATIVE_TRANSACTION_HASH_REQUIRED');
   const r=await request('tx',{tx_hash:transactionHash,sender_account_id:signerId,wait_until:'FINAL'});
   const hashes=[...new Set([r.result.transaction_outcome,...r.result.receipts_outcome??[]].map(o=>o?.block_hash))];
   if(hashes.length>100||hashes.some(h=>typeof h!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(h)))fail('NATIVE_FEE_BLOCK_REQUIRED');
   const blocks=[];for(const hash of hashes){const b=(await request('block',{block_id:hash})).result.header;if(b?.hash!==hash||!Number.isSafeInteger(b.height)||b.height<1)fail('NATIVE_FEE_BLOCK_REQUIRED');blocks.push(b.height);}
   return {...r,source:'near-json-rpc',finality:r.result.final_execution_status,settledBlockHeight:Math.max(...blocks)};
  },
  async inspect(binding,{fromSequence}={}){
   if(binding.networkId!==networkId)fail('LEDGER_CHAIN_BINDING_MISMATCH');
   if(typeof expectedCodeHash!=='string'||!expectedCodeHash)fail('LEDGER_CHAIN_CODE_PIN_REQUIRED');
   const a=await account(binding.contractId);
   if(a.code_hash!==expectedCodeHash)fail('LEDGER_CHAIN_CODE_MISMATCH');
   const r=await call(binding.contractId,'get_head',{},a.block_hash),h=r.output;
   if(h.writerId!==binding.signerId||!Number.isSafeInteger(h.sequence)||h.sequence<0||!/^([a-f0-9]{64})$/.test(h.hash)||!/^([a-f0-9]{64})$/.test(h.companyHash))fail('LEDGER_CHAIN_HEAD_INVALID');
   const observation={source:'near-json-rpc',networkId,contractId:binding.contractId,signerId:h.writerId,companyHash:h.companyHash,sequence:h.sequence,hash:h.hash,blockHeight:r.result.block_height,blockHash:r.result.block_hash,observedAt:new Date(clock()).toISOString(),finality:'final',codeHash:a.code_hash};
   if(fromSequence!==undefined&&h.sequence>=fromSequence){
    if(!Number.isSafeInteger(fromSequence)||fromSequence<1||h.sequence-fromSequence>=50)fail('LEDGER_CHAIN_RECONCILE_RANGE_REQUIRED');
    const records=await call(binding.contractId,'get_records',{from_sequence:fromSequence,limit:50},r.result.block_hash);
    if(!Array.isArray(records.output)||records.output.length>50)fail('LEDGER_CHAIN_HEAD_INVALID');observation.records=records.output;
   }
   return observation;
  },
 });
}
export const wasmCodeHash=bytes=>baseEncode(createHash('sha256').update(bytes).digest());
