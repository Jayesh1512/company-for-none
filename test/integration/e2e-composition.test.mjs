import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';
import {SETUP_DEMO_BRIEF} from '../../public/setup-demo.js';
import {AUTONOMY_INTENT} from '../../public/autonomy-intent.js';
import {renderWorkspace} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';
import {fingerprint} from '../../src/contracts.mjs';
const companyId='e2e-composition',owner={companyId,role:'owner',verified:true};
async function harness(t,extra={}){
 const directory=await mkdtemp('/tmp/near-e2e-composition-'),calls=[],secretReads=[];
 const app=await createApp({directory,companyId,configPath:null,totalCeilingNanoUsd:'5000000000',creditOrganizationId:'org-1',creditSessionSecretRef:'SESSION',cloudSecretRef:'KEY',resolveSecret:async ref=>{secretReads.push(ref);return {KEY:'sk-controlled-secret',SESSION:'controlled.session.secret'}[ref];},cloudCreditTransport:async(url,init)=>{
  calls.push({url,method:init.method});const body=url.endsWith('/check_api_key')?{valid:true,organization_id:'org-1',workspace_id:'workspace-1',api_key_id:'key-1'}:{organization_id:'org-1',credit_limits:[{type:'payment',currency:'USD',amount:5000000000,transferred_out:0,effective_capacity:5000000000,consumed:1000000000,available:4000000000}],updated_at:'2026-11-14T12:00:00Z',unfunded_amount:0,legacy_unattributed_amount:0};
  return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
 },...extra});
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 const request=(route,body,localOwner=true)=>app.web.handle(new Request('http://localhost'+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','idempotency-key':'test:'+fingerprint({route,body:body??null})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{localOwner});
 return {app,calls,secretReads,request};
}
test('USD5 lifetime ceiling reaches setup-only Rules without policy/credit/grants; owner credit reads stay scoped and nonadditive',async t=>{
 const h=await harness(t),base='/api/workspace/cloud/';assert.equal(h.app.rules.snapshot().config,null);assert.equal(h.app.rules.snapshot().mode,'setup');assert.equal(h.app.rules.snapshot().safety.totalCeilingNanoUsd,'5000000000');assert.equal(h.secretReads.length,0);
 const settings=renderWorkspace({data:h.app.workspace.view(),route:parseRoute('#settings'),operation:await h.app.workspace.operation(owner),owner:{safety:h.app.rules.snapshot().safety}});assert.match(settings,/Lifetime cost ceiling/);assert.match(settings,/5 USD/);
 assert.equal((await h.request(base+'credit-balance',{},false)).status,403);assert.equal(h.calls.length,0);
 assert.equal((await h.request(base+'credit-balance',{organizationId:'another'})).status,400);assert.equal(h.secretReads.length,0);
 const attr=await h.request(base+'credit-attribution',{});assert.equal(attr.status,200);assert.equal((await attr.json()).grantsSpendingAuthority,false);
 const response=await h.request(base+'credit-balance',{}),body=await response.json();assert.equal(response.status,200);assert.equal(body.observation.status,'unwatermarked');assert.equal(body.observation.watermark,null);assert.equal(body.observation.aggregateAvailableNanoUsd,null);assert.equal(body.observation.arithmeticVerified,false);assert.equal(body.accountingApplied,false);assert.equal(body.grantsSpendingAuthority,false);assert.equal(body.observation.creditLimits[0].availableNanoUsd,'4000000000');assert.equal(body.observation.raw,undefined);
 assert.equal(h.calls.length,3);assert.equal(h.app.treasury.snapshot().version,0);assert.equal(h.app.treasury.snapshot().credits.availableNanoUsd,'0');assert.equal(h.app.journal.list('economicObservations').length,0);assert.equal(Object.keys(h.app.journal.snapshot().operations).length,0);
 const serialized=JSON.stringify(h.app.journal.snapshot());assert.doesNotMatch(serialized,/sk-controlled-secret|controlled\.session\.secret/);
});
test('private trace and owner review use real current M01 decisions; inert rejection creates no profile/code/financial effect',async t=>{
 const h=await harness(t);await h.app.autonomy.onboard({version:0,organizationVersion:0,brief:SETUP_DEMO_BRIEF,intent:AUTONOMY_INTENT},owner,'onboard');
 const path='/api/workspace/autonomy/';assert.equal((await h.request(path+'trace',undefined,false)).status,403);assert.equal((await h.request(path+'trace?raw=true')).status,400);
 assert.equal((await h.request(path+'trace')).status,200);
 await h.app.journal.transaction({actionId:'test-inert-host-proposal',fingerprint:'controlled'},tx=>tx.put('improvements','inert-change',{id:'inert-change',companyId,version:1,state:'owner_review',summary:'Controlled inert host proposal',changeProposal:{kind:'host_code',targetId:'host:manual-note',rationale:'Owner review only',proposedText:'<script>must-stay-text</script>'}}));
 const input={improvementId:'inert-change',version:1,decision:'reject',reviewNote:'Keep this proposal inert.'};assert.equal((await h.request(path+'change-review',input,false)).status,403);
 const invalid=await h.request(path+'change-review',{...input,verified:true});assert.equal(invalid.status,409);assert.equal((await invalid.json()).error.code,'REVIEW_DECISION_INVALID');
 const view=await h.app.autonomy.view(owner),html=renderWorkspace({data:h.app.workspace.view(),autonomy:view,autonomyTrace:await h.app.autonomy.trace(owner),route:parseRoute('#autonomy/improvements')});assert.match(html,/Acknowledge manual work/);assert.match(html,/Reject proposal/);assert.doesNotMatch(html,/<script>must-stay-text/);assert.match(html,/&lt;script&gt;must-stay-text/);
 const before=h.app.journal.list('agents');assert.equal((await h.request(path+'change-review',input)).status,200);assert.equal(h.app.journal.get('improvements','inert-change').state,'rejected');assert.deepEqual(h.app.journal.list('agents'),before);assert.equal(h.app.journal.list('companyRevisions').length,0);assert.equal(h.app.treasury.snapshot().version,0);assert.equal(h.app.journal.events().filter(e=>e.type==='improvement.owner_reviewed').length,1);
});
