import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';
import {renderCloudVerification} from '../../public/verification.js';

const companyId='cloud-component-test',token='owner-test-token';
const owner={authorization:`Bearer ${token}`};
const request=(path,body,authorized=true)=>new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{...(authorized?owner:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function setup(t,options={}){
 const directory=await mkdtemp('/tmp/near-cloud-component-');
 const app=await createApp({directory,configPath:null,companyId,componentModel:'selected-model',ownerToken:token,...options});
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return app;
}

test('Cloud preflight is owner-only, server-selected, read-only and records actual verifier findings privately',async t=>{
 let calls=0;
 const app=await setup(t,{loadCloudVerification:async()=>({createCloudVerification:({journal})=>({
   async preflight(input){calls++;assert.equal(input.request.model,'selected-model');assert.equal(input.verificationSpec.allowedTcbStatuses[0],'UpToDate');
     const evidence=await journal.putArtifact({actionId:input.actionId,content:JSON.stringify({raw:'PRIVATE_ATTESTATION_MARKER'}),mediaType:'application/json'});
     return {id:'local-preflight',stage:'preflight',status:'unavailable',requestFingerprint:input.requestFingerprint,model:input.request.model,
       verificationPolicyFingerprint:input.verificationSpec.policyFingerprint,verifiedAt:new Date().toISOString(),evidenceRef:`private:${evidence.id}`,
       sdk:{name:'@nearai/inference-sdk',version:'0.3.0',nodeEntry:true},plaintextBindingStatus:'unavailable',reasonCode:'CONTROLLED_VERIFIER_RESULT'};
   }
 })})});
 assert.equal(calls,0);
 assert.equal((await app.web.handle(request('/api/workspace/inference/preflight',{},false))).status,403);
 assert.equal((await app.web.handle(request('/api/workspace/inference/preflight',{model:'caller-selected',money:'1'}))).status,400);
 assert.equal(calls,0);
 const response=await app.web.handle(request('/api/workspace/inference/preflight',{}));assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.completionSent,false);assert.equal(body.verification.status,'unavailable');assert.equal(calls,1);
 const records=app.journal.list('verificationResults');assert.equal(records.length,1);assert.equal(records[0].source,'local-sdk');assert.equal(records[0].sdkVersion,'0.3.0');
 assert.equal(app.treasury.snapshot().reservations.length,0);assert.equal(app.journal.list('orders').length,0);
 const status=await(await app.web.handle(request('/api/status',undefined,false))).text();assert.ok(!status.includes('PRIVATE_ATTESTATION_MARKER'));assert.ok(!status.includes(body.verification.evidenceRef));
});

test('public readiness redacts identity/private refs and expires old verified observations',async t=>{
 const identity={companyId,network:null,treasuryAccount:null,bucket:null};
 const app=await setup(t,{getRuntimeFacts:()=>({componentModel:'selected-model',economicIdentity:identity,observations:[
   {id:'PRIVATE_OBSERVER',provider:'PRIVATE_PROVIDER',capability:'jbrain',status:'verified',observedAt:'2020-01-01T00:00:00Z',expiresAt:'2020-01-01T00:01:00Z',identity,evidenceRef:'private:PRIVATE_EVIDENCE'}]})});
 const response=await app.web.handle(request('/api/status',undefined,false));assert.equal(response.status,200);
 const body=await response.json(),text=JSON.stringify(body);
 assert.equal(body.ready,false);assert.equal(body.readiness.find(x=>x.capability==='jbrain').status,'unavailable');
 for(const value of ['PRIVATE_OBSERVER','PRIVATE_PROVIDER','PRIVATE_EVIDENCE','treasuryAccount','evidenceRef'])assert.ok(!text.includes(value),value);
});

test('paid component without exact authorization cannot prepare or dispatch; describe uses no provider',async t=>{
 let loads=0;const app=await setup(t,{loadCloudVerification:async()=>{loads++;throw Error('Must not load before authorization');}});
 const access={verified:true,role:'owner',companyId};
 const described=app.components.describe(access);assert.equal(described.status,'allow');assert.equal(described.plan.readOnly,true);
 await assert.rejects(app.components.execute(access),{code:'POLICY_BLOCK'});assert.equal(loads,0);
 assert.equal(app.journal.recoverableOperations().length,0);assert.equal(app.treasury.snapshot().reservations.length,0);
});

test('attestation view distinguishes missing and unavailable proof, escapes values and never labels a report verified',()=>{
 const html=renderCloudVerification({cloudPlan:{status:'allow',plan:{model:'<img src=x onerror=1>'}},cloudVerification:{verification:{stage:'preflight',status:'unavailable',reasonCode:'KEY_REQUIRED',plaintextBindingStatus:'unavailable',models:[]}}});
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/Attestation check unavailable/);assert.match(html,/this check sends no completion/);
 assert.ok(!html.includes('Attestation check passed'));assert.match(renderCloudVerification(),/data-action="verify-cloud" disabled/);
});

test('one-shot component uses real Rules/Treasury gates and never repeats an unknown SDK completion after restart',async t=>{
 const {componentFixture}=await import('../rules/component-fixtures.mjs');
 const {sdkFinding}=await import('../rules/verification-fixtures.mjs');
 const {NOW}=await import('../rules/fixtures.mjs');
 const directory=await mkdtemp('/tmp/near-component-dispatch-');let app,prepares=0,sends=0;
 const h=componentFixture();
 Object.defineProperty(h.runtime,'verificationResults',{get:()=>app?.journal.list('verificationResults')??[],configurable:true});
 const options={directory,rules:h.rules,companyId:h.companyId,clock:()=>NOW,agentBalanceSource:'confidential',
   getComponentAuthorization:()=>h.authorization,resolveSecret:async()=>{throw Error('No provider credentials used');},
   loadCloudVerification:async()=>({createCloudVerification:()=>({prepare:async()=>{
     prepares++;const send=()=>{sends++;return Promise.resolve({status:'unknown',mode:'live',provider:'controlled-sdk-test',cost:{status:'pending',actualCostNanoUsd:null}});};
     Object.defineProperties(send,{preflight:{value:sdkFinding(h.request)},evidenceRef:{value:'private:controlled-byte-evidence'}});return send;
   }})})};
 app=await createApp({...options,initialize:async({journal})=>journal.transaction({actionId:'controlled-credit-state',fingerprint:'controlled-credit-state'},tx=>tx.put('treasury','financial',h.financial))});
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 const first=await app.components.execute(h.access);assert.equal(first.status,'unknown');assert.equal(first.businessDeliveryAllowed,false);assert.equal(sends,1);
 assert.equal(app.treasury.snapshot().consumedPermits.length,1);assert.equal(app.treasury.snapshot().reservations[0].status,'unknown');
 assert.deepEqual(await app.components.execute(h.access),first);assert.equal(sends,1);assert.equal(prepares,1);
 await app.journal.transaction({actionId:'controlled-missing-last-transition',fingerprint:'controlled-missing-last-transition'},tx=>{
   const record=tx.get('componentRuns',first.operationId);delete record.summary;record.status='prepared';tx.put('componentRuns',record.id,record);return null;
 });
 assert.equal((await app.components.inspect(h.access,{id:first.operationId})).status,'unknown');
 await app.close();app=await createApp(options);
 const restored=await app.components.execute(h.access);assert.equal(restored.status,'unknown');assert.equal(sends,1);
 await app.journal.transaction({actionId:'controlled-restored-summary',fingerprint:'controlled-restored-summary'},tx=>{
   const record=tx.get('componentRuns',first.operationId);tx.put('componentRuns',record.id,{...record,summary:first});return null;
 });
 assert.deepEqual(await app.components.execute(h.access),first);assert.equal(sends,1);assert.equal(prepares,1);
 assert.equal(app.journal.list('orders').length,0);assert.equal(app.treasury.snapshot().credits.availableNanoUsd,h.financial.credits.availableNanoUsd);
 app.providers.getComponentAuthorization=()=>null;assert.deepEqual(await app.components.inspect(h.access,{id:first.operationId}),first);assert.equal(sends,1);
});

test('read-only replay uses known private evidence without a spending grant and refuses a changed request',async t=>{
 let replays=0,last;
 const app=await setup(t,{getComponentAuthorization:()=>null,loadCloudVerification:async()=>({createCloudVerification:()=>({
   preflight:async input=>(last={stage:'preflight',status:'unavailable',model:input.request.model,requestFingerprint:input.requestFingerprint,
     verificationPolicyFingerprint:input.verificationSpec.policyFingerprint,verifiedAt:new Date().toISOString(),evidenceRef:'private:'+'a'.repeat(64),
     sdk:{name:'@nearai/inference-sdk',version:'0.3.0',nodeEntry:true},reasonCode:'CONTROLLED_OFFLINE_LIMIT'}),
   replay:async input=>{replays++;assert.equal(input.requestFingerprint,last.requestFingerprint);return {...last,stage:'response',status:'unavailable',durableReplayStatus:'unavailable'};}
 })})});
 const access={verified:true,role:'owner',companyId},first=await app.components.preflight(access);
 const result=await app.components.replay(access,{evidenceRef:first.verification.evidenceRef});assert.equal(result.verification.status,'unavailable');assert.equal(result.completionSent,false);assert.equal(replays,1);
 await assert.rejects(app.components.replay(access,{evidenceRef:first.verification.evidenceRef,request:{model:'different'}}),{code:'CONFLICT'});assert.equal(replays,1);
});
