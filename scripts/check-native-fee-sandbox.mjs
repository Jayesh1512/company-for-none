import {Worker} from 'near-workspaces';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fingerprint} from '../src/contracts.mjs';
import {ledgerCompanyHash,ledgerRecordHash,LEDGER_ZERO_HASH} from '../src/rules/onchain-ledger.mjs';
import {createLedgerRpc} from '../src/onchain/rpc.mjs';
import {nativeFeeReceipt} from '../src/onchain/fees.mjs';

// Real local nearcore RPC, compiled contract and burned gas. Sandbox balances
// and the explicitly test-only USD conversion are never live economic proof.
await readFile('artifacts/onchain-ledger/company-ledger.wasm');
const worker=await Worker.init({network:'sandbox'});
try{
 const writer=await worker.rootAccount.createSubAccount('fee-writer'),contract=await worker.rootAccount.devCreateAccount(),companyHash=ledgerCompanyHash('native-fee-sandbox');
 await contract.deploy('artifacts/onchain-ledger/company-ledger.wasm');await contract.call(contract,'new',{company_hash:companyHash,writer_id:writer.accountId});
 const r={sequence:1,type:'private.event',at:'2026-11-14T11:00:00.000Z',actorHash:fingerprint('actor'),payloadHash:fingerprint('private'),previousHash:LEDGER_ZERO_HASH};r.hash=ledgerRecordHash(companyHash,r);
 const args={company_hash:companyHash,expected_sequence:0,expected_hash:LEDGER_ZERO_HASH,records:[r]},gas='30000000000000',nativeCall={method_name:'append',gas,deposit:'0',args},binding={networkId:'sandbox',signerId:writer.accountId,contractId:contract.accountId};
 const rpc=createLedgerRpc({networkId:'sandbox',rpcUrl:worker.provider.connection.url});
 const actual=await writer.callRaw(contract,'append',args,{gas:BigInt(gas),attachedDeposit:0n});assert.equal(actual.succeeded,true);
 const final=await rpc.transaction(actual.result.transaction.hash,writer.accountId);
 const options={operationId:'sandbox-original',transactionHash:actual.result.transaction.hash,binding,nativeCall,settledBlockHeight:final.settledBlockHeight,usdBound:{source:'native-usd-upper-bound',nanoUsdPerNear:'1000000000',reference:'TEST-ONLY-NOT-A-MARKET-RATE',validUntil:new Date(Date.now()+60000).toISOString()},evidenceRef:'local-sandbox:final-rpc'};
 const fee=nativeFeeReceipt(final.result,options);assert.equal(fee.executionSucceeded,true);assert.ok(BigInt(fee.actualFeeYocto)>0n);
 assert.throws(()=>nativeFeeReceipt(final.result,{...options,nativeCall:{...nativeCall,args:{...args,expected_sequence:7}}}),{code:'NATIVE_TRANSACTION_CALL_MISMATCH'});
 const failed=await writer.callRaw(contract,'append',{...args,company_hash:'f'.repeat(64)},{gas:BigInt(gas),attachedDeposit:0n});assert.equal(failed.failed,true);
 const failedFinal=await rpc.transaction(failed.result.transaction.hash,writer.accountId),failedFee=nativeFeeReceipt(failedFinal.result,{...options,operationId:'sandbox-billed-failure',transactionHash:failed.result.transaction.hash,nativeCall:{...nativeCall,args:{...args,company_hash:'f'.repeat(64)}},settledBlockHeight:failedFinal.settledBlockHeight});assert.equal(failedFee.executionSucceeded,false);assert.ok(BigInt(failedFee.actualFeeYocto)>0n);
 await mkdir('artifacts/mentor-implementation',{recursive:true});
 const proof={at:new Date().toISOString(),network:'actual local NEAR Sandbox',publicChainTransactions:0,realFundsSpent:0,usdConversion:'test-only; not an observed market rate or live USD cost',checks:['compiled actual contract append','final RPC exact original call binding','actual burned native fee across receipts','modified args rejected','actual failed contract call still billed'],success:fee,billedFailure:failedFee};
 await writeFile('artifacts/mentor-implementation/sandbox-native-fees.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await worker.tearDown();}
