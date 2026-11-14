import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {createLedgerRpc,wasmCodeHash} from '../../src/onchain/rpc.mjs';
import {createLedgerWallet} from '../../scripts/create-ledger-wallet.mjs';
import {createAgentLedgerWriter} from '../../src/onchain/agent-writer.mjs';
import {renderOnchainLedger} from '../../public/onchain-ledger.js';
import {ledgerCompanyHash} from '../../src/rules/onchain-ledger.mjs';

test('generated wallet is network/company-bound, private, idempotent and never uses RPC',async t=>{
 const directory=await mkdtemp('/tmp/near-ledger-wallet-test-');t.after(()=>rm(directory,{recursive:true,force:true}));
 const first=await createLedgerWallet({networkId:'mainnet',companyId:'company',directory}),again=await createLedgerWallet({networkId:'mainnet',companyId:'company',directory});
 assert.equal(first.accountId,again.accountId);assert.equal(again.created,false);assert.match(first.accountId,/^[a-f0-9]{64}$/);
 const publicData=await readFile(path.join(directory,'public.json'),'utf8');assert.doesNotMatch(publicData,/private_key|credentialFile|ed25519:[^"\n]+.*ed25519:/);
 await rm(path.join(directory,'public.json'));const recovered=await createLedgerWallet({networkId:'mainnet',companyId:'company',directory});assert.equal(recovered.accountId,first.accountId);assert.equal(JSON.parse(await readFile(path.join(directory,'public.json'),'utf8')).accountId,first.accountId);
 await assert.rejects(createLedgerWallet({networkId:'testnet',companyId:'company',directory}),/different network/);
});
test('actual setup app exports safe hash records; owner-only routes do not change Treasury or send transactions',async t=>{
 const directory=await mkdtemp('/tmp/near-ledger-app-'),companyId='chain-company';const app=await createApp({directory,configPath:'',companyId,totalCeilingNanoUsd:'5000000000'});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 await app.journal.transaction({actionId:'private-record',fingerprint:'private'},tx=>{tx.append('agent.updated',{companyId,agentId:'private-agent',summary:'PRIVATE CUSTOMER TEXT'});return null;});
 const req=(suffix,body={})=>new Request('http://localhost/api/workspace/ledger-chain'+suffix,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'stable-chain-key'},body:JSON.stringify(body)});
 const financial=app.treasury.snapshot();assert.equal((await app.web.handle(req('/export'))).status,403);
 const response=await app.web.handle(req('/export'),{localOwner:true});assert.equal(response.status,200);const value=await response.json();assert.equal(value.companyHash,ledgerCompanyHash(companyId));assert.match(value.records.at(-1).hash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(value),/PRIVATE CUSTOMER TEXT|private-agent/);
 const prepare=await app.web.handle(req('/prepare',{limit:50}),{localOwner:true});assert.equal(prepare.status,409);assert.equal((await prepare.json()).error.code,'LEDGER_CHAIN_BINDING_REQUIRED');assert.equal(app.journal.list('ledgerChainBatches').length,0);assert.deepEqual(app.treasury.snapshot(),financial);assert.equal(Object.keys(app.journal.snapshot().operations).length,0);
});
test('RPC inspect pins exact deployed WASM code, writer, company and single final block across record reads',async()=>{
 const binding={networkId:'mainnet',contractId:'ledger.near',signerId:'agent.near'},companyHash=ledgerCompanyHash('company'),hash='a'.repeat(64),codeHash=wasmCodeHash(Buffer.from('test WASM bytes')),requests=[];
 const transport=async(_url,init)=>{const d=JSON.parse(init.body);requests.push(d);const result=d.params.request_type==='view_account'?{amount:'1',code_hash:codeHash,block_hash:'block',block_height:123}:{result:[...Buffer.from(JSON.stringify(d.params.method_name==='get_head'?{companyHash,sequence:1,hash,writerId:'agent.near'}:[{sequence:1,hash}]))],block_hash:'block',block_height:123};return Response.json({jsonrpc:'2.0',id:d.id,result});};
 const rpc=createLedgerRpc({networkId:'mainnet',transport,expectedCodeHash:codeHash});const value=await rpc.inspect(binding,{fromSequence:1});assert.equal(value.finality,'final');assert.equal(value.signerId,'agent.near');assert.ok(requests.slice(1).every(r=>r.params.block_id==='block'));
 await assert.rejects(createLedgerRpc({networkId:'mainnet',transport,expectedCodeHash:'wrong'}).inspect(binding),{code:'LEDGER_CHAIN_CODE_MISMATCH'});
 await assert.rejects(rpc.inspect({...binding,signerId:'foreign.near'}),{code:'LEDGER_CHAIN_HEAD_INVALID'});
});
test('native Agent API writer cannot resolve secrets or dispatch on held or unsigned Rules decisions',async t=>{
 const directory=await mkdtemp('/tmp/near-ledger-port-');const app=await createApp({directory,configPath:''});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 let secrets=0,sends=0;const writer=createAgentLedgerWriter({journal:app.journal,binding:{networkId:'mainnet',contractId:'ledger.near',signerId:'agent.near'},agentId:'a'.repeat(64),resolveSecret:async()=>{secrets++;return 'secret';},transport:async()=>{sends++;throw Error('must not send');}});
 const result=await writer.publish({action:{id:'original',type:'ledger_chain_publish'},decision:{status:'hold'}});assert.equal(result.status,'not_submitted');assert.equal(secrets,0);assert.equal(sends,0);
});
test('ledger panel never labels local records as anchored or renders unsafe values as markup',()=>{
 const html=renderOnchainLedger({ledgerChain:{localHead:{sequence:5},checkpoint:null,deploymentWallet:{networkId:'mainnet',accountId:'<script>',accountExists:false},contractArtifact:{wasmBytes:10,wasmHash:'a'.repeat(64)}}});assert.match(html,/No confirmed batch/);assert.match(html,/Account not funded/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/do not sign, deploy or spend/);
});
