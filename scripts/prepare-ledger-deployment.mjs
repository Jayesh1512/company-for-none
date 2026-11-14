import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {ledgerCompanyHash} from '../src/rules/onchain-ledger.mjs';

// Review artifact only. No private key is read, account created, transaction signed
// or provider mutation called. Funding does not automatically submit this draft.
const networkId=process.argv[2];if(!['mainnet','testnet'].includes(networkId))throw Error('Choose mainnet or testnet explicitly.');
const wallet=JSON.parse(await readFile(path.resolve('.runtime/company-ledger-wallet',networkId,'public.json'),'utf8'));
if(wallet.networkId!==networkId)throw Error('Wallet network mismatch.');
const bytes=await readFile('artifacts/onchain-ledger/company-ledger.wasm'),hash=createHash('sha256').update(bytes).digest('hex');
const draft={schemaVersion:1,networkId,companyId:wallet.companyId,contractAccountId:wallet.accountId,deploymentSignerId:wallet.accountId,companyHash:ledgerCompanyHash(wallet.companyId),wasmHash:hash,wasmBytes:bytes.length,actions:[{type:'DeployContract',wasmFile:'artifacts/onchain-ledger/company-ledger.wasm',sha256:hash},{type:'FunctionCall',methodName:'new',args:{company_hash:ledgerCompanyHash(wallet.companyId),writer_id:null},depositYocto:'0',gasUnits:null}],atomicDeploymentAndInitializationRequired:true,operationalWriter:'not-bound',unsigned:true,readyToSign:false,mainnetTransactionsSent:0,requires:['Funded deployment account','Exact owner-approved native fee/storage limits and current USD5 common-budget reservation','Current final RPC nonce/block/code facts','Actual company Agent API identity, policy and grant before set_writer or operational append','Final current authorization immediately before signing/submission']};
await mkdir('artifacts/onchain-ledger',{recursive:true});await writeFile('artifacts/onchain-ledger/deployment-plan.json',JSON.stringify(draft,null,2)+'\n');console.log(JSON.stringify({networkId,contractAccountId:wallet.accountId,wasmBytes:bytes.length,wasmHash:hash,readyToSign:false,output:'artifacts/onchain-ledger/deployment-plan.json'}));
