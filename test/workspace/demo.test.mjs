import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {loadDemo,demoOrganization,demoProfiles,hasDemoData} from '../helpers/onboarding-fixtures.mjs';
import {renderWorkspace} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';

export function demoApi(app,requests=[]){return async(path,{method='GET',body,key}={})=>{
 requests.push({path,method});
 const response=await app.web.handle(new Request('http://localhost'+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 const value=await response.json();if(!response.ok)throw Error(value.error?.message??response.status);return value;
};}
async function fixture(t){const directory=await mkdtemp('/tmp/near-demo-'),app=await createApp({directory});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return app;}

test('demo fills durable profiles and empty organization fields, replays without duplicates and never starts execution',async t=>{
 const app=await fixture(t),requests=[],api=demoApi(app,requests),before=app.treasury.snapshot();
 const result=await loadDemo(api);assert.equal(result.brainReady,false);assert.equal(app.workspace.view().organization.name,demoOrganization.name);
 const agents=app.workspace.view().agents;assert.equal(agents.length,4);assert.equal(hasDemoData(app.workspace.view()),true);
 for(const sample of demoProfiles){const saved=agents.find(a=>a.name===sample.name);assert.equal(saved.instructions,sample.instructions);assert.deepEqual(saved.skillIds,sample.skillIds);}
 await loadDemo(api);assert.equal(app.workspace.view().agents.length,4);
 assert.deepEqual(app.treasury.snapshot(),before);assert.equal(app.workspace.view().tasks.length,0);assert.equal((await app.workspace.setup()).progress.complete,false);
 assert.ok(requests.every(r=>!r.path.includes('/orders')&&!r.path.endsWith('/tasks')&&!r.path.endsWith('/review')));
});

test('demo preserves existing organization and edited agent details and obeys the current kill gate',async t=>{
 const app=await fixture(t),api=demoApi(app);await app.workspace.saveOrganization({name:'My real company',purpose:'Keep this purpose',industry:'Consulting',version:0});
 await loadDemo(api);let a=app.workspace.view().agents.find(a=>a.name==='Scout · Demo');await app.workspace.update(a.id,{name:'My edited analyst',version:a.version});
 await loadDemo(api);assert.equal(app.workspace.view().organization.name,'My real company');assert.equal(app.workspace.view().organization.purpose,'Keep this purpose');assert.equal(app.workspace.get(a.id).agent.name,'My edited analyst');
 app.rules.updateConfig({...app.rules.snapshot().config,killSwitch:true});await assert.rejects(loadDemo(api),/KILL_SWITCH/);assert.equal(app.workspace.view().agents.length,4);
});

test('product UI offers explicit demo input without fixture seeding or simulated payment controls',async t=>{
 const app=await fixture(t);await loadDemo(demoApi(app));const state={data:app.workspace.view(),setup:await app.workspace.setup(),route:parseRoute('#setup/org')};
 const html=renderWorkspace(state);assert.ok(html.includes('data-action="setup-demo"'));assert.ok(!html.includes('data-action="load-demo"'));assert.ok(!html.includes('data-action="approve-run"'));assert.ok(html.includes('Set up your organization'));
});

test('explicit setup demo drafts keep entered and saved company data and contain no provider or financial configuration',async()=>{
 const {setupDemoDraft,SETUP_DEMO_BRIEF}=await import('../../public/setup-demo.js');
 const empty=setupDemoDraft({});assert.deepEqual(empty.brief,SETUP_DEMO_BRIEF);assert.deepEqual(Object.keys(empty).sort(),['brief','intent']);
 const original={autonomy:{company:{brief:{...SETUP_DEMO_BRIEF,name:'Real company',customer:'Real audience'},intent:{maxCalls:0,maxAgents:9}}},companySetupDraft:{brief:{...SETUP_DEMO_BRIEF,outcome:'Owner-edited outcome'}}};
 const draft=setupDemoDraft(original,{industry:'Owner-entered industry'});
 assert.equal(draft.brief.name,'Real company');assert.equal(draft.brief.customer,'Real audience');assert.equal(draft.brief.industry,'Owner-entered industry');assert.equal(draft.brief.outcome,'Owner-edited outcome');assert.equal(draft.intent.maxCalls,0);assert.equal(draft.intent.maxAgents,9);
 assert.deepEqual(original.companySetupDraft.brief, {...SETUP_DEMO_BRIEF,outcome:'Owner-edited outcome'});
 assert.deepEqual(setupDemoDraft({data:{organization:{name:'Saved organization',purpose:'Saved purpose'}}}).brief.name,'Saved organization');
});

test('demo control and fictional notice use the existing workspace and do not imply running agents or provider readiness',async t=>{
 const app=await fixture(t),state={data:app.workspace.view(),autonomy:{company:null},setup:await app.workspace.setup(),route:parseRoute('#setup/org'),exampleMode:true};
 const html=renderWorkspace(state);assert.match(html,/data-action="setup-example" aria-pressed="true"/);assert.match(html,/Example setup text/);assert.match(html,/Execution and spending stay unchanged/);assert.match(html,/Open AI demo/);assert.doesNotMatch(html,/data-action="load-demo"|data-action="approve-run"/);
});
