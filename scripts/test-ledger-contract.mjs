import {Worker} from 'near-workspaces';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

// Actual local NEAR Sandbox execution of compiled WASM. No public account or funds.
const wasm=path.resolve('artifacts/onchain-ledger/company-ledger.wasm');
await readFile(wasm);const worker=await Worker.init({network:'sandbox'}),root=worker.rootAccount;
const sha=value=>createHash('sha256').update(value).digest('hex'),zero='0'.repeat(64),companyHash=sha('company-ledger:company:v1\0sandbox-company');
const record=(sequence,previousHash,type='agent.created')=>{const r={sequence,type,at:'2026-11-14T09:00:00.000Z',actorHash:sha('actor'),payloadHash:sha('private record '+sequence),previousHash};r.hash=sha(['company-ledger:record:v1',companyHash,String(sequence),r.type,r.at,r.actorHash,r.payloadHash,previousHash].join('\n'));return r;};
const checks=[];
try{
 const writer=await root.createSubAccount('writer'),stranger=await root.createSubAccount('stranger');
 const contract=await root.devCreateAccount();await contract.deploy(wasm);await contract.call(contract,'new',{company_hash:companyHash,writer_id:writer.accountId});
 const a=record(1,zero),b=record(2,a.hash,'agent.started'),args={company_hash:companyHash,expected_sequence:0,expected_hash:zero,records:[a,b]};
 const head=await writer.call(contract,'append',args);assert.equal(head.sequence,2);assert.equal(head.hash,b.hash);checks.push('compiled real WASM validates and stores2 exact chained event records');
 const listed=await contract.view('get_records',{from_sequence:1,limit:50});assert.deepEqual(listed,[a,b]);checks.push('public view returns exact stored safe records');
 const again=await writer.call(contract,'append',args);assert.equal(again.sequence,2);checks.push('exact replay appends zero duplicate records');
 await assert.rejects(stranger.call(contract,'append',args),/WRITER_REQUIRED/);checks.push('foreign signer rejected on actual chain');
 const c=record(3,b.hash,'agent.stopped');
 await assert.rejects(writer.call(contract,'append',{...args,expected_sequence:2,expected_hash:b.hash,records:[{...c,payloadHash:sha('tampered')}]}),/RECORD_HASH_MISMATCH/);
 assert.equal((await contract.view('get_head',{})).sequence,2);checks.push('tampered payload hash fails atomically');
 await assert.rejects(writer.call(contract,'append',{...args,expected_sequence:1,expected_hash:a.hash,records:[b,c]}),/PARTIAL_OVERLAP/);checks.push('partial overlap cannot reissue or splice records');
 await assert.rejects(writer.call(contract,'append',{...args,company_hash:sha('foreign')}),/COMPANY_MISMATCH/);
 await assert.rejects(stranger.call(contract,'set_writer',{writer_id:stranger.accountId}),/OWNER_REQUIRED/);checks.push('foreign company and unauthorized writer rotation rejected');
 await contract.call(contract,'set_writer',{writer_id:null});
 await assert.rejects(writer.call(contract,'append',{company_hash:companyHash,expected_sequence:2,expected_hash:b.hash,records:[c]}),/WRITER_REQUIRED/);checks.push('owner revocation immediately stops old writer without removing history');
 assert.deepEqual(await contract.view('get_records',{from_sequence:1,limit:50}),[a,b]);
 const dir=path.resolve('artifacts/onchain-ledger');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'sandbox-proof.json'),JSON.stringify({at:new Date().toISOString(),network:'local-near-sandbox',publicChainTransactions:0,realFundsSpent:0,wasmSha256:sha(await readFile(wasm)),checks},null,2));console.log(JSON.stringify({pass:checks.length,checks}));
}finally{await worker.tearDown();}
