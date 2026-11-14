import {fingerprint,ContractError} from '../contracts.mjs';
const fail=code=>{throw new ContractError(code,code);};
const amount=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v);
/** Only call with a final response acquired by the pinned NEAR RPC client. */
export function nativeFeeReceipt(raw,{operationId,transactionHash,binding,nativeCall,settledBlockHeight,usdBound,now=Date.now(),evidenceRef}){
 if(raw?.final_execution_status!=='FINAL'||raw.transaction?.hash!==transactionHash||raw.transaction.signer_id!==binding.signerId||raw.transaction.receiver_id!==binding.contractId||!Array.isArray(raw.transaction.actions)||raw.transaction.actions.length!==1)fail('NATIVE_TRANSACTION_BINDING_MISMATCH');
 const call=raw.transaction.actions[0]?.FunctionCall;
 let args;try{args=JSON.parse(Buffer.from(call?.args??'','base64').toString('utf8'));}catch{fail('NATIVE_TRANSACTION_ARGS_INVALID');}
 if(call.method_name!==nativeCall.method_name||String(call.gas)!==nativeCall.gas||call.deposit!==nativeCall.deposit||fingerprint(args)!==fingerprint(nativeCall.args))fail('NATIVE_TRANSACTION_CALL_MISMATCH');
 const outcomes=[raw.transaction_outcome,...raw.receipts_outcome??[]];
 if(outcomes.length<1||outcomes.length>100||new Set(outcomes.map(o=>o?.id)).size!==outcomes.length||outcomes.some(o=>!o?.id||!amount(o.outcome?.tokens_burnt)))fail('NATIVE_FEE_RECEIPT_INVALID');
 if(!Number.isSafeInteger(settledBlockHeight)||settledBlockHeight<1)fail('NATIVE_FEE_BLOCK_REQUIRED');
 if(!usdBound||usdBound.source!=='native-usd-upper-bound'||!amount(usdBound.nanoUsdPerNear)||!usdBound.reference||!Number.isFinite(Date.parse(usdBound.validUntil))||Date.parse(usdBound.validUntil)<=now)fail('NATIVE_USD_BOUND_REQUIRED');
 const fee=outcomes.reduce((n,o)=>n+BigInt(o.outcome.tokens_burnt),0n),unit=10n**24n,cost=(fee*BigInt(usdBound.nanoUsdPerNear)+unit-1n)/unit;
 return {source:'near-json-rpc-final-fee',operationId,accountId:binding.signerId,networkId:binding.networkId,transactionHash,settledBlockHeight,actualFeeYocto:fee.toString(),actualCostNanoUsd:cost.toString(),receiptId:`native-fee:${binding.networkId}:${transactionHash}`,evidenceRef,usdReference:usdBound.reference,executionSucceeded:!!raw.status&&Object.hasOwn(raw.status,'SuccessValue')};
}
