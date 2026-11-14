import {KeyPair,keyToImplicitAddress} from 'near-api-js';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

/** Explicit local key generation only. Does not call RPC, provision an account or move funds. */
export async function createLedgerWallet({networkId,directory,companyId}){
 if(!['mainnet','testnet'].includes(networkId)||typeof companyId!=='string'||!companyId||!directory)throw Error('Explicit network, company and private directory are required.');
 await mkdir(directory,{recursive:true,mode:0o700});
 const filename=path.join(directory,'credential.json');
 try{
   const info=await stat(filename);if(process.platform!=='win32'&&(info.mode&0o077))throw Error('Ledger wallet credential must be private (0600).');
   const old=JSON.parse(await readFile(filename,'utf8'));
   if(old.network_id!==networkId||old.company_id!==companyId)throw Error('This wallet belongs to a different network or company.');
   const key=KeyPair.fromString(old.private_key);if(keyToImplicitAddress(key.getPublicKey())!==old.account_id||key.getPublicKey().toString()!==old.public_key)throw Error('Wallet credential integrity mismatch.');
   const result={networkId,companyId,accountId:old.account_id,publicKey:old.public_key,credentialFile:filename,created:false};
   const publicFile=path.join(directory,'public.json');
   try{const published=JSON.parse(await readFile(publicFile,'utf8'));if(published.accountId!==result.accountId||published.networkId!==networkId||published.companyId!==companyId||published.publicKey!==result.publicKey)throw Error('Wallet public metadata integrity mismatch.');}
   catch(e){if(e.code!=='ENOENT')throw e;await writeFile(publicFile,JSON.stringify({...result,credentialFile:undefined,accountProvisioned:false,fundsMoved:false},null,2)+'\n',{flag:'wx',mode:0o600});}
   return result;
 }catch(e){if(e.code!=='ENOENT')throw e;}
 const key=KeyPair.fromRandom('ed25519'),accountId=keyToImplicitAddress(key.getPublicKey());
 const record={network_id:networkId,company_id:companyId,account_id:accountId,public_key:key.getPublicKey().toString(),private_key:key.toString(),created_at:new Date().toISOString()};
 await writeFile(filename,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
 const result={networkId,companyId,accountId,publicKey:record.public_key,credentialFile:filename,created:true};
 await writeFile(path.join(directory,'public.json'),JSON.stringify({...result,credentialFile:undefined,accountProvisioned:false,fundsMoved:false},null,2)+'\n',{flag:'wx',mode:0o600});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const networkId=process.argv[2];
 const result=await createLedgerWallet({networkId,directory:path.resolve('.runtime/company-ledger-wallet',networkId??'missing'),companyId:process.env.SHOP_COMPANY_ID??'local-workspace'});
 console.log(JSON.stringify({...result,accountProvisioned:false,fundsMoved:false},null,2));
}
