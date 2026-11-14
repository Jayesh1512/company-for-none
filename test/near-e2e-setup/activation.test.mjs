import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp as createFixtureApp} from '../helpers/create-fixture-app.mjs';
import {createApp as createProductApp} from '../../src/app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {setupBasis} from '../../src/rules/activation.mjs';
import {readAutonomyFacts} from '../../src/autonomy/facts.mjs';
import {catalog as baseCatalog} from '../../src/workspace/catalog.mjs';
import {AUTONOMY_INTENT} from '../../public/autonomy-intent.js';
import {renderOperation} from '../../public/operation.js';

const brief={name:'Owner Company',purpose:'Improve scoped business operations.',industry:'Operations',customer:'Small companies',outcome:'Useful reviewed work',objective:'Review the initial business process'};
const local={verified:true,verifiedLocal:true,role:'owner',companyId:'local-workspace'};
const jbrain=(status='ready')=>({health:async()=>({status}),write:async()=>{throw Error('not used');},read:async()=>null,operation:async()=>({state:'absent'})});
// The shared fixture helper builds Rules without private autonomy facts, so compose them here
// exactly like src/app.mjs does. The catalog is the module catalog; tests that change a listing
// mutate it in place and restore it, so each restart sees a genuinely different listing.
function rulesFor(){let app=null;const rules=createRules({configPath:'config.example.yaml',companyId:'local-workspace',getAutonomyFacts:()=>readAutonomyFacts({journal:app?.journal??null,catalog:baseCatalog.map(x=>({...x,version:x.version??'1'})),companyId:'local-workspace'})});return {rules,bind:a=>{app=a;}};}
async function fixture(t,options={}){
  const directory=await mkdtemp('/tmp/near-e2e-setup-');
  const make=async()=>{const r=rulesFor();const a=await createFixtureApp({directory,jbrainClient:jbrain(),rules:r.rules,...options});r.bind(a);return a;};
  let app=await make();
  t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
  return {directory,get app(){return app;},async restart(){await app.close();app=await make();}};
}
function editListing(t,id,patch){const item=baseCatalog.find(x=>x.id===id),before={...item};t.after(()=>Object.assign(item,before));return ()=>Object.assign(item,patch(item));}
const onboard=async app=>{const v=await app.autonomy.view(local);return app.autonomy.onboard({version:v.company?.version??0,organizationVersion:app.workspace.view().organization.version,brief,intent:AUTONOMY_INTENT},local,`brief-${Math.random()}`);};
const review=async app=>{const v=await app.autonomy.view(local);return app.autonomy.reviewSetup({version:v.company.version},local,`review-${Math.random()}`);};
const activate=async(app,extra={})=>app.workspace.activate({version:app.workspace.view().organization.version,agentId:'research-agent',serviceId:'market-opportunity',knowledgeIds:[],...extra},local);

test('activation consumes the merged setup review and execution prerequisites, not legacy steps or private documents',async t=>{
  const f=await fixture(t),app=f.app;
  await onboard(app);
  // No review yet: blocked with an exact reason, status explains it.
  await assert.rejects(activate(app),/SETUP_REVIEW_REQUIRED/);
  let status=(await app.workspace.operation(local)).activationStatus;assert.equal(status.ready,false);assert.equal(status.blockers[0].reasonCode,'SETUP_REVIEW_REQUIRED');
  await review(app);
  // Legacy infra/brain steps were never reviewed and no company document exists.
  assert.equal((await app.workspace.setup(local)).progress.complete,false);assert.equal(app.journal.list('companyKnowledgeDocuments').length,0);
  status=(await app.workspace.operation(local)).activationStatus;assert.equal(status.ready,true);assert.equal(status.basis,'unified');assert.equal(status.grantsSpendingAuthority,false);
  const {organization}=await activate(app);assert.equal(organization.activation.state,'demo_active');assert.equal(organization.activation.setupBasis,'unified');
  assert.equal(app.treasury.snapshot().version,(await app.treasury.snapshot()).version);
});

test('profile, brief and catalog changes invalidate the relevant review; a later edit also blocks new service orders',async t=>{
  const f=await fixture(t),app=f.app;await onboard(app);await review(app);
  const manager=app.journal.get('agents','local-workspace:manager');
  await app.workspace.update(manager.id,{version:manager.version,instructions:'Changed operating instructions after review.'},local);
  await assert.rejects(activate(app),/SETUP_REVIEW_REQUIRED/);
  await review(app);await activate(app);
  assert.equal(app.workspace.services().length,1);
  // A catalog listing change (service text) invalidates the activation binding for new orders.
  editListing(t,'market-opportunity',x=>({prompt:`${x.prompt??''} (changed)`}))();
  await f.restart();
  assert.deepEqual(f.app.workspace.services(),[]);
  await assert.rejects(f.app.workspace.createServiceOrder('market-opportunity',{question:'What research evidence should a small business validate?'}),/ACTIVATION_REVIEW_REQUIRED/);
});

test('a skill listing change in the catalog invalidates the unified review itself',async t=>{
  const f=await fixture(t),app=f.app;await onboard(app);const agent=app.journal.get('agents','research-agent');
  await app.workspace.update(agent.id,{version:agent.version,skillIds:['evidence-review']},local);
  await review(app);assert.equal((await app.autonomy.view(local)).setup.reviewed,true);
  editListing(t,'evidence-review',x=>({instructions:`${x.instructions} Also be brief.`}))();
  await f.restart();
  assert.equal((await app.autonomy.view(local)).setup.reviewed,false);await assert.rejects(activate(app),/SETUP_REVIEW_REQUIRED/);
});

test('setup-only review cannot activate, and caller-supplied setup facts are ignored by Rules',async t=>{
  const directory=await mkdtemp('/tmp/near-e2e-setup-');const owner={companyId:'local-workspace',role:'owner',verified:true};
  const app=await createProductApp({directory,companyId:'local-workspace',configPath:null,jbrainClient:jbrain(),resolveSecret:async()=>{throw Error('No provider I/O authorized');}});
  t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
  await app.autonomy.onboard({version:0,organizationVersion:0,brief,intent:AUTONOMY_INTENT},owner,'brief');
  const v=await app.autonomy.view(owner);await app.autonomy.reviewSetup({version:v.company.version},owner,'review-1');
  assert.equal((await app.autonomy.view(owner)).setup.reviewed,true);
  await assert.rejects(app.workspace.activate({version:app.workspace.view().organization.version,agentId:`local-workspace:manager`,serviceId:'market-opportunity',knowledgeIds:[]},owner),/COMMERCIAL_POLICY_REQUIRED/);
  const spoof=app.rules.evaluate({id:'spoof',type:'company_activate'},{access:owner,agent:app.journal.get('agents','local-workspace:manager'),listing:baseCatalog.find(x=>x.id==='market-opportunity'),knowledgeIds:[],setup:{complete:true,steps:[]},unifiedSetup:{reviewed:true,fingerprint:'x',agents:{}}});
  assert.equal(spoof.status,'hold');assert.equal(spoof.reasonCode,'COMMERCIAL_POLICY_REQUIRED');
  const status=(await app.workspace.operation(owner)).activationStatus;assert.equal(status.ready,false);assert.equal(status.blockers[0].reasonCode,'COMMERCIAL_POLICY_REQUIRED');
  assert.equal(app.treasury.snapshot().version,0);assert.equal(Object.keys(app.journal.snapshot().operations).length,0);
});

test('operation UI enables activation only from the Rules activation status and lists real blockers',async t=>{
  const f=await fixture(t),app=f.app;await onboard(app);
  const state=async()=>({operation:await app.workspace.operation(local),setup:await app.workspace.setup(local)});
  let html=renderOperation(await state());assert.match(html,/disabled/);assert.match(html,/Finish the current company setup review/);assert.ok(!html.includes('six setup steps'));
  await review(app);html=renderOperation(await state());assert.ok(!/type="submit" disabled/.test(html));
});

test('legacy review records cannot override a changed unified review; kill switch remains an activation blocker',async t=>{
 assert.equal(setupBasis({unifiedSetup:{present:true,reviewed:false},setup:{complete:true}}),null);assert.equal(setupBasis({unifiedSetup:{present:false},setup:{complete:true}}),'legacy-six-step');
 const f=await fixture(t),app=f.app;await onboard(app);await review(app);
 const org=app.journal.get('organization','local-workspace'),steps=(await app.workspace.setup(local)).progress.steps;
 // Persist genuine current legacy review fingerprints as an old client would.
 await app.journal.transaction({actionId:'controlled-old-client-reviews',fingerprint:'controlled-old-client-reviews'},tx=>tx.put('organization','local-workspace',{...org,setupReviews:Object.fromEntries(steps.map(s=>[s.id,s.reviewFingerprint]))}));
 const c=(await app.autonomy.view(local)).company;await app.autonomy.configure({version:c.version,operatingMode:c.operatingMode,brief:{...c.brief,purpose:'A changed company purpose'},intent:c.intent},local,'change-brief');
 await assert.rejects(activate(app),/SETUP_REVIEW_REQUIRED/);
 app.rules.updateConfig({...app.rules.snapshot().config,killSwitch:true});const status=(await app.workspace.operation(local)).activationStatus;assert.equal(status.ready,false);assert.ok(status.blockers.some(b=>b.reasonCode==='KILL_SWITCH'));
});
