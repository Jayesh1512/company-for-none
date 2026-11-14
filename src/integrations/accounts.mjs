import {ContractError,fingerprint} from '../contracts.mjs';
import {ledgerBindingHash} from '../rules/onchain-ledger.mjs';
const fail=code=>{throw new ContractError(code,code);};
const account=v=>typeof v==='string'&&v.length>=2&&v.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(v);
export function accountPlan({parentId,companyLabel,roles=[],initialBalanceYocto,ownerPublicKey,writerPublicKey,gasAllowanceYocto,contractId}){
 if(!account(parentId)||!/^[a-z0-9][a-z0-9_-]{0,29}$/.test(companyLabel??'')||!/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ownerPublicKey??'')||!/^[1-9]\d*$/.test(initialBalanceYocto??'')||!Array.isArray(roles)||roles.length>16)fail('ACCOUNT_PLAN_INVALID');
 const companyAccount=`${companyLabel}.${parentId}`;if(!account(companyAccount))fail('ACCOUNT_NAME_TOO_LONG');
 const accounts=[{role:'ledger',accountId:companyAccount},...roles.map(role=>{if(!/^[a-z][a-z0-9-]{0,15}$/.test(role))fail('ROLE_NAME_INVALID');return {role,accountId:`${role}.${companyAccount}`};})];
 if(new Set(accounts.map(a=>a.accountId)).size!==accounts.length||accounts.some(a=>!account(a.accountId)))fail('ACCOUNT_PLAN_INVALID');
 const externalFunding=(BigInt(initialBalanceYocto)*BigInt(accounts.length)).toString();
 const transactions=accounts.map((a,index)=>({signerId:index===0?parentId:companyAccount,receiverId:a.accountId,actions:[{type:'CreateAccount'},{type:'Transfer',params:{deposit:index===0?externalFunding:initialBalanceYocto}},{type:'AddKey',params:{publicKey:ownerPublicKey,accessKey:{nonce:0,permission:'FullAccess'}}}],role:a.role,spendingGrant:false}));
 let writerKey=null;
 if(writerPublicKey||gasAllowanceYocto){
  if(!/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(writerPublicKey??'')||writerPublicKey===ownerPublicKey||!/^[1-9]\d*$/.test(gasAllowanceYocto??'')||!account(contractId))fail('WRITER_KEY_PLAN_INVALID');
  writerKey={receiverId:companyAccount,actions:[{type:'AddKey',params:{publicKey:writerPublicKey,accessKey:{nonce:0,permission:{FunctionCall:{receiver_id:contractId,method_names:['append'],allowance:gasAllowanceYocto}}}}}],route:'alternative-owner-review-only',depositAllowed:false,allowanceUnit:'gas-yoctoNEAR',rotation:{requiresOwnerKey:true,removeOldBeforeActivatingReplacement:true}};
 }
 const plan={companyAccount,transactions,writerKey,executionAllowed:false,routeChanged:false,totalFundingYocto:(BigInt(initialBalanceYocto)*BigInt(accounts.length)).toString(),requires:['Exact funded parent/account approval','Owner wallet signing','Storage and transaction fee budget','Post-creation final RPC/account-key inspection']};
 return {...plan,hash:fingerprint(plan)};
}
export function checkpointFeedPlan({checkpoint,binding,destination}){
 if(!checkpoint||!Number.isSafeInteger(checkpoint.sequence)||checkpoint.sequence<1||!/^([a-f0-9]{64})$/.test(checkpoint.hash??'')||!/^[a-f0-9]{64}$/.test(checkpoint.companyHash??'')||!Number.isFinite(Date.parse(checkpoint.updatedAt))||!binding?.contractId||checkpoint.bindingHash!==ledgerBindingHash(checkpoint.companyHash,binding))fail('CONFIRMED_CHECKPOINT_REQUIRED');
 if(destination!=='near.social')fail('CHECKPOINT_DESTINATION_INVALID');
 const content={companyHash:checkpoint.companyHash,sequence:checkpoint.sequence,hash:checkpoint.hash,confirmedAt:checkpoint.updatedAt,networkId:binding.networkId,contractId:binding.contractId};
 return {destination,content,contentHash:fingerprint(content),executionAllowed:false,reasonCode:'SOCIAL_PUBLICATION_PROTOCOL_REQUIRED',requires:['Verified current platform write contract and transaction semantics','Exact publication approval','Bounded fees and final readback'],rawDataPublished:false};
}
