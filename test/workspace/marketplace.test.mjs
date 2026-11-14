import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {requirements,resourceStatus,soulInstructions} from '../../public/marketplace.js';
import {renderMarketplace,renderListing,renderAgentDetail} from '../../public/workspace.js';
import {parseRoute} from '../../public/app.js';
async function fixture(t){const directory=await mkdtemp('/tmp/near-market-');let app=await createApp({directory});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return {get app(){return app;},async restart(){await app.close();app=await createApp({directory});}};}
async function state(app,hash='#marketplace'){return {data:app.workspace.view(),status:{...await app.workflow.status(),readiness:app.readiness()},marketKnowledge:await app.knowledge.view(),route:parseRoute(hash)};}

test('marketplace displays all six agent requirements and preserves legacy templates, skills and services',async t=>{
 const f=await fixture(t),s=await state(f.app),html=renderMarketplace(s);
 assert.deepEqual(requirements.map(g=>g.label),['Inference','Knowledge Base','Skills','Industry Leaders’ SOUL.md','External Services','Agentic Wallet Services']);
 for(const g of requirements){assert.ok(html.includes(g.label));assert.ok(s.data.catalog.some(x=>x.requirement===g.id));}
 assert.ok(html.includes('Agent templates'));assert.ok(html.includes('Market opportunity brief'));assert.ok(html.includes('Configure for'));
 for(const id of ['market-researcher','competitive-research','launch-review'])assert.ok(s.data.catalog.some(x=>x.id===id));
});

test('requirement and search filters operate on actual listings without changing financial state',async t=>{
 const f=await fixture(t),before=f.app.treasury.snapshot(),s=await state(f.app,'#marketplace?requirement=inference');
 const html=renderMarketplace(s);assert.ok(html.includes('NEAR AI Cloud'));assert.ok(!html.includes('Local demo inference'));assert.ok(!html.includes('Steve Jobs · Craft'));
 const soul=renderMarketplace({...s,route:parseRoute('#marketplace?requirement=soul'),marketSearch:'Bezos'});assert.ok(soul.includes('Jeff Bezos · Customer-first'));assert.ok(!soul.includes('Reed Hastings · Context'));
 assert.ok(renderMarketplace({...s,marketSearch:'nothing-can-match-this'}).includes('No matches in this requirement'));
 assert.ok(renderMarketplace({...s,route:parseRoute('#marketplace?requirement=unknown')}).includes('NEAR AI Cloud'));
 assert.ok(renderMarketplace({...s,route:parseRoute('#marketplace'),marketRequirement:'wallet',marketSearch:'Bezos'}).includes('Jeff Bezos · Customer-first'));
 assert.deepEqual(f.app.treasury.snapshot(),before);
});

test('inference, knowledge and wallet states reflect facts and unconfigured services are never offered as live connections',async t=>{
 const f=await fixture(t),s=await state(f.app),find=id=>s.data.catalog.find(x=>x.id===id);
 assert.equal(find('local-inference'),undefined);assert.equal(find('fixture-wallet'),undefined);
 assert.equal(resourceStatus(find('near-cloud-inference'),s).label,'Setup required');assert.equal(resourceStatus(find('intents-wallet'),s).label,'Setup required');
 assert.equal(resourceStatus(find('jbrain-knowledge'),s).label,'JBrain unavailable');
 assert.equal(resourceStatus(find('jbrain-knowledge'),{...s,marketKnowledge:{status:'connected',documents:[]}}).label,'Connected · local JBrain');
 for(const id of ['near-cloud-inference','intents-wallet']){const html=renderListing({...s,route:parseRoute('#marketplace/'+id)});assert.ok(html.includes('Setup required'));assert.ok(html.includes('href="#settings"'));assert.ok(!html.includes('id="use-listing-form"'));}
});

test('SOUL.md preview/download is independently sourced and review does not write until an ordinary Rules-gated save',async t=>{
 const f=await fixture(t),s=await state(f.app,'#marketplace/soul-bezos'),item=s.data.catalog.find(x=>x.id==='soul-bezos'),agent=s.data.agents[0],before=f.app.treasury.snapshot();
 const listing=renderListing(s);assert.ok(listing.includes('download="SOUL.md"'));assert.ok(listing.includes(item.sourceUrl));assert.ok(listing.includes('Independent study profile'));assert.ok(listing.includes('id="review-soul-form"'));
 const combined=soulInstructions(agent,item);assert.ok(combined.startsWith(agent.instructions));assert.ok(combined.includes('## SOUL.md profile: soul-bezos'));assert.equal(soulInstructions({...agent,instructions:combined},item),combined);
 const review=renderAgentDetail({...s,route:parseRoute(`#agents/${agent.id}?tab=settings&soul=soul-bezos`),agentTab:'settings'});assert.ok(review.includes('Your existing instructions are preserved'));assert.equal(f.app.workspace.get(agent.id).agent.instructions,agent.instructions);
 await f.app.workspace.update(agent.id,{version:agent.version,instructions:combined});await f.restart();assert.equal(f.app.workspace.get(agent.id).agent.instructions,combined);assert.deepEqual(f.app.treasury.snapshot(),before);
 const current=f.app.workspace.get(agent.id).agent;f.app.rules.updateConfig({...f.app.rules.snapshot().config,killSwitch:true});await assert.rejects(f.app.workspace.update(agent.id,{version:current.version,instructions:'Blocked profile change'}),/KILL_SWITCH/);
});

test('resource names, selected agents and SOUL content render inertly',async t=>{
 const f=await fixture(t),s=await state(f.app,'#marketplace/soul-jobs');const item=s.data.catalog.find(x=>x.id==='soul-jobs');item.instructions='<script>doNotRun()</script>';item.name='<img src=x onerror=run()>';s.data.agents[0].name='<script>agent</script>';
 const listing=renderListing(s);assert.ok(listing.includes('&lt;script&gt;'));assert.ok(listing.includes('&lt;img'));assert.ok(!listing.includes('<script>'));assert.ok(!listing.includes('<img'));
 const html=renderMarketplace({...s,route:parseRoute('#marketplace')});assert.ok(html.includes('&lt;script&gt;agent'));assert.ok(!html.includes('<script>'));
});
