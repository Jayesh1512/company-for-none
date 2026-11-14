import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';
import {renderWorkspace} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';

test('workspace navigation opens private company history; denied public disclosure has an explicit recovery link',()=>{
 const state={route:parseRoute('#overview'),data:{agents:[],tasks:[],catalog:[],activity:[],workspace:{name:'Test company'}}};
 const html=renderWorkspace(state);
 assert.match(html,/<a href="#autonomy\/ledger"[^>]*>[\s\S]*?<span>Company ledger<\/span>/);
 assert.doesNotMatch(html,/<a href="#ledger"[^>]*>[\s\S]*?<span>Company ledger<\/span>/);
 const unavailable=renderWorkspace({...state,route:parseRoute('#ledger'),ledgerUnavailable:{reasonCode:'COMMERCIAL_POLICY_REQUIRED'}});
 assert.match(unavailable,/Public financial disclosure is not enabled/);assert.match(unavailable,/Open company ledger/);
 assert.doesNotMatch(unavailable,/This access context is not permitted/);
});
test('setup owner history is readable without enabling anonymous public financial disclosure',async t=>{
 const directory=await mkdtemp('/tmp/near-ledger-nav-'),app=await createApp({directory,configPath:'',companyId:'ledger-nav'});
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 const publicLedger=await app.web.handle(new Request('http://localhost/api/ledger'));
 assert.equal(publicLedger.status,409);assert.equal((await publicLedger.json()).error.code,'COMMERCIAL_POLICY_REQUIRED');
 const ownerHistory=await app.web.handle(new Request('http://localhost/api/workspace/autonomy'),{localOwner:true});
 assert.equal(ownerHistory.status,200);assert.ok(Array.isArray((await ownerHistory.json()).events));
 assert.equal((await app.web.handle(new Request('http://localhost/api/workspace/autonomy'))).status,403);
});
