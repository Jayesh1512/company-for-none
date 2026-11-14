import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {renderSetup} from '../../public/setup.js';
import {renderWorkspace,icon} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';
const request=(path,body,origin)=>new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function fixture(t){const directory=await mkdtemp('/tmp/near-setup-');let app=await createApp({directory});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return {get app(){return app;},async restart(){await app.close();app=await createApp({directory});}};}
const org={name:'Aurora Research',purpose:'Help our customers make evidence-backed market decisions.',industry:'Research',version:0};
async function review(app,stepId){const current=await app.workspace.setup();return app.workspace.reviewSetup({stepId,version:current.organization.version});}

test('organization setup persists metadata and explicit ordered reviews, with CAS and no client completion claims',async t=>{
 const f=await fixture(t);let setup=await f.app.workspace.setup();assert.deepEqual(setup.progress.steps.map(s=>s.label),['Define Org','Define Agents','Add Profiles','Enhance Skills','Set Up Infra','Company Brain']);assert.equal(setup.progress.completedCount,0);
 await assert.rejects(review(f.app,'skills'),/earlier|SETUP_PREVIOUS_STEPS_REQUIRED/);
 const response=await f.app.web.handle(request('/api/workspace/organization',org));assert.equal(response.status,200);assert.equal(f.app.workspace.view().workspace.name,org.name);
 await assert.rejects(f.app.workspace.saveOrganization({...org,name:'Stale'}),{code:'CONFLICT'});
 assert.equal((await f.app.web.handle(request('/api/workspace/setup/review',{stepId:'agents',version:1,complete:true}))).status,400);
 await review(f.app,'agents');await review(f.app,'profiles');await review(f.app,'skills');await review(f.app,'infra');
 setup=await f.app.workspace.setup();assert.equal(setup.progress.completedCount,5);assert.equal(setup.progress.steps[5].ready,false);await assert.rejects(review(f.app,'brain'),/Connect JBrain/);
 await f.restart();setup=await f.app.workspace.setup();assert.equal(setup.organization.name,org.name);assert.equal(setup.progress.completedCount,5);assert.equal(setup.progress.complete,false);
});

test('role, profile and skill review fingerprints follow actual metadata changes',async t=>{
 const f=await fixture(t),app=f.app;await app.workspace.saveOrganization(org);for(const id of ['agents','profiles','skills'])await review(app,id);
 let a=app.workspace.get('research-agent').agent;await app.workspace.update(a.id,{version:a.version,instructions:'Updated instructions: cite evidence, identify uncertainty and show implications.'});
 let steps=(await app.workspace.setup()).progress.steps;assert.equal(steps[1].complete,true);assert.equal(steps[2].complete,false);assert.equal(steps[3].complete,true);
 await review(app,'profiles');a=app.workspace.get(a.id).agent;await app.workspace.update(a.id,{version:a.version,skillIds:[]});steps=(await app.workspace.setup()).progress.steps;assert.equal(steps[2].complete,true);assert.equal(steps[3].ready,false);assert.equal(steps[3].complete,false);
 a=app.workspace.get(a.id).agent;await app.workspace.update(a.id,{version:a.version,role:'Competitive analyst'});steps=(await app.workspace.setup()).progress.steps;assert.equal(steps[1].complete,false);assert.equal(steps[2].complete,false);
});

test('setup routes keep local access, current kill, input validation and mutation-origin boundaries',async t=>{
 const f=await fixture(t),app=f.app;assert.equal((await app.web.handle(new Request('http://public.example/api/workspace/setup'))).status,403);
 assert.equal((await app.web.handle(request('/api/workspace/organization',org,'https://attacker.example'))).status,403);
 assert.equal((await app.web.handle(request('/api/workspace/organization',{...org,purpose:' '}))).status,409);
 await app.workspace.saveOrganization(org);app.rules.updateConfig({...app.rules.snapshot().config,killSwitch:true});await assert.rejects(review(app,'agents'),/KILL_SWITCH/);assert.equal((await app.workspace.setup()).progress.steps[0].complete,true);
});

test('setup rendering escapes organization content and depicts truthful infra and linked return flows',async t=>{
 const f=await fixture(t),app=f.app;await app.workspace.saveOrganization({...org,name:'<img src=x onerror=alert(1)>'});
 const setup=await app.workspace.setup(),state={setup,data:app.workspace.view(),route:parseRoute('#setup/infra')};
 const html=renderSetup(state,icon);assert.ok(html.includes('Organization setup steps'));for(const label of ['Define Org','Define Agents','Add Profiles','Enhance Skills','Set Up Infra','Company Brain'])assert.ok(html.includes(label));assert.ok(html.includes('Local fixture mode'));assert.ok(html.includes('No real funds or live inference.'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
 const profiles=renderSetup({...state,route:parseRoute('#setup/profiles')},icon);assert.ok(profiles.includes('tab=settings&setup=profiles'));
 const brain=renderSetup({...state,route:parseRoute('#setup/brain')},icon);assert.ok(brain.includes('#knowledge/new?setup=brain'));assert.ok(brain.includes('Unavailable'));assert.ok(!renderSetup({...state,route:parseRoute('#setup/complete')},icon).includes('is set up.'));
 assert.equal(parseRoute('').page,'setup');assert.equal(parseRoute('#agents/new?setup=agents').params.get('setup'),'agents');
 assert.ok(renderWorkspace({...state,route:parseRoute('#setup'),agentFilter:'all'}).includes('Set up your organization'));
});
