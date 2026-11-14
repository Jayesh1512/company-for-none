import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';
import {AUTONOMY_INTENT} from '../../public/autonomy-intent.js';
import {renderCompanySetup} from '../../public/company-setup.js';
import {renderWorkspace,icon} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';
const companyId='unified-test',owner={companyId,role:'owner',verified:true};
const brief={name:'Owner Company',purpose:'Improve scoped business operations.',industry:'Operations',customer:'Small companies',outcome:'Useful reviewed work',objective:'Review the initial business process'};
async function fixture(t){const directory=await mkdtemp('/tmp/near-unified-');let app;const options={directory,companyId,configPath:null,resolveSecret:async()=>{throw Error('No provider I/O authorized');}};app=await createApp(options);t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return {get app(){return app;},async restart(){await app.close();app=await createApp(options);}};}
const input=(version=0,organizationVersion=0)=>({version,organizationVersion,brief,intent:AUTONOMY_INTENT});

test('one atomic setup defaults to Company for none, aligns organization and creates editable real core agents without starting work',async t=>{
 const f=await fixture(t);await f.app.workspace.create({name:'Existing analyst',role:'Research',instructions:'Keep this existing profile.',skillIds:[]},owner);
 const result=await f.app.autonomy.onboard(input(),owner,'first-brief');assert.equal(result.company.operatingMode,'none');assert.equal(result.company.started,false);assert.equal(result.company.state,'paused');assert.equal(f.app.workspace.view().organization.name,brief.name);
 const agents=f.app.journal.list('agents'),core=agents.filter(a=>a.autonomyRole);assert.equal(core.length,2);assert.equal(agents.length,3);assert.ok(agents.find(a=>a.name==='Existing analyst'));assert.deepEqual(core.map(a=>a.autonomyRole).sort(),['backlog','manager']);
 assert.equal(f.app.journal.list('agentWork').length,1);assert.equal(f.app.journal.list('agentRuns').length,0);assert.equal(f.app.treasury.snapshot().version,0);assert.equal(Object.keys(f.app.journal.snapshot().operations).length,0);
 const events=f.app.journal.events().length;assert.equal((await f.app.autonomy.onboard(input(),owner,'first-brief')).replayed,true);assert.equal(f.app.journal.events().length,events);
 await f.restart();assert.equal(f.app.workspace.view().organization.name,brief.name);assert.equal((await f.app.autonomy.view(owner)).company.operatingMode,'none');assert.equal(f.app.journal.list('agents').length,3);
 const a=f.app.journal.get('agents',companyId+':manager');await f.app.workspace.update(a.id,{version:a.version,name:'Operations manager',role:'Operations lead',instructions:'Coordinate approved business tasks and report uncertainty.',skillIds:['evidence-review']},owner);
 assert.equal(f.app.journal.get('agents',a.id).autonomyRole,'manager');assert.equal(f.app.journal.get('agents',a.id).name,'Operations manager');assert.ok(f.app.journal.events().some(e=>e.type==='agent.updated'&&e.data.agentId===a.id));assert.equal(f.app.treasury.snapshot().version,0);
});

test('stale versions, replay collisions and insufficient capacity cannot partially configure organization or duplicate the team',async t=>{
 const f=await fixture(t);await assert.rejects(f.app.autonomy.onboard({...input(),version:4},owner,'stale'),{code:'AUTONOMY_INPUT_INVALID'});assert.equal(f.app.journal.get('organization',companyId),null);assert.equal(f.app.journal.list('agents').length,0);
 await f.app.workspace.create({name:'Existing',role:'Existing role',instructions:'Existing instructions.',skillIds:[]},owner);
 await assert.rejects(f.app.autonomy.onboard({...input(),intent:{...AUTONOMY_INTENT,maxAgents:2}},owner,'capacity'),{code:'MAX_AGENTS'});assert.equal(f.app.journal.get('organization',companyId),null);assert.equal(f.app.journal.get('autonomousCompanies',companyId),null);assert.equal(f.app.journal.list('agents').length,1);
 await f.app.autonomy.onboard(input(),owner,'valid');const before=f.app.journal.events().length;
 await assert.rejects(f.app.autonomy.onboard({...input(),brief:{...brief,name:'Changed'}},owner,'valid'),{code:'CONFLICT'});
 const c=(await f.app.autonomy.view(owner)).company;
 await assert.rejects(f.app.autonomy.onboard({...input(c.version,0),brief:{...brief,name:'Wrong version'}},owner,'wrong-org'),{code:'AUTONOMY_VERSION_CONFLICT'});
 assert.equal(f.app.journal.events().length,before);assert.equal(f.app.workspace.view().organization.name,brief.name);
});

test('finishing records only current configuration review; profile changes invalidate it without financial or lifecycle resets',async t=>{
 const f=await fixture(t);await f.app.autonomy.onboard(input(),owner,'brief');let v=await f.app.autonomy.view(owner);assert.equal(v.setup.reviewed,false);
 const counters=f.app.journal.list('companyObjectives')[0].counters;await f.app.autonomy.reviewSetup({version:v.company.version},owner,'review');v=await f.app.autonomy.view(owner);assert.equal(v.setup.reviewed,true);assert.equal(v.company.started,false);
 const a=f.app.journal.get('agents',companyId+':backlog');await f.app.workspace.update(a.id,{version:a.version,instructions:'Group process gaps and request evaluated fixes.'},owner);assert.equal((await f.app.autonomy.view(owner)).setup.reviewed,false);assert.deepEqual(f.app.journal.list('companyObjectives')[0].counters,counters);
 await assert.rejects(f.app.autonomy.reviewSetup({version:v.company.version}, {...owner,verified:false,role:'public'},'forged-review'),{code:'ACCESS_DENIED'});assert.equal(f.app.treasury.snapshot().version,0);
});

test('unified API rejects authority/actor fields and preserves existing objective and running-company controls',async t=>{
 const f=await fixture(t),post=(body,key='http')=>f.app.web.handle(new Request('http://localhost/api/workspace/autonomy/onboard',{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)}),{localOwner:true});
 assert.equal((await post({...input(),verified:true})).status,409);assert.equal(f.app.journal.list('agents').length,0);
 assert.equal((await post(input(),'valid-http')).status,200);let c=(await f.app.autonomy.view(owner)).company;
 await assert.rejects(f.app.autonomy.onboard({...input(c.version,1),brief:{...brief,objective:'Changed objective'}},owner,'objective-change'),{code:'USE_OBJECTIVE_CONTROL'});
 await f.app.autonomy.control({version:c.version,operation:'start'},owner,'start-intent');c=(await f.app.autonomy.view(owner)).company;
 await assert.rejects(f.app.autonomy.onboard(input(c.version,1),owner,'running-edit'),{code:'PAUSE_REQUIRED'});assert.equal(f.app.journal.list('agentRuns').length,0);
});

test('one setup surface shows configured editable agents, optional brain and canonical legacy links without a mode-choice fork',async t=>{
 const f=await fixture(t);let d=await f.app.autonomy.view(owner),setup=await f.app.workspace.setup(owner),data=f.app.workspace.view();
 let state={autonomy:d,setup,data,route:parseRoute('#setup')};let html=renderWorkspace(state);assert.match(html,/Company for none · default/);assert.doesNotMatch(html,/company-mode-choice|Set up an agentic company/);assert.match(html,/Configure agent team/);
 await f.app.autonomy.onboard(input(),owner,'brief');d=await f.app.autonomy.view(owner);data=f.app.workspace.view();setup=await f.app.workspace.setup(owner);
 state={...state,autonomy:d,data,setup,route:parseRoute('#setup/agents')};html=renderCompanySetup(state,icon);assert.match(html,/Your configured agent team/);assert.match(html,/Company manager/);assert.match(html,/Company backlog/);assert.match(html,/data-setup-agent=/);assert.match(html,/name="instructions"/);assert.match(html,/Save agent/);
 assert.equal(parseRoute('#autonomy/setup?step=0').page,'setup');assert.equal(parseRoute('#autonomy/setup?step=2').sub,'boundaries');
 const boundary=renderCompanySetup({...state,route:parseRoute('#setup/infra')},icon);assert.match(boundary,/Review operating limits/);
 const brain=renderCompanySetup({...state,route:parseRoute('#setup/brain')},icon);assert.match(brain,/optional during setup/);assert.match(brain,/#knowledge\/new\?setup=brain/);
 const unsafe={...d,company:{...d.company,brief:{...brief,name:'<script>bad</script>'}}};assert.doesNotMatch(renderCompanySetup({...state,autonomy:unsafe,route:parseRoute('#setup/review')},icon),/<script>/);
});
