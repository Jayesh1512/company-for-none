import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {stringify} from 'yaml';
import {createApp} from '../../src/app.mjs';
import {config} from '../rules/fixtures.mjs';

const companyId='product-setup-test',token='isolated-owner-test-token';
const owner={verified:true,role:'owner',companyId};
const request=(route,body,authorized=true)=>new Request('http://localhost'+route,{method:body?'POST':'GET',headers:{...(authorized?{authorization:`Bearer ${token}`} :{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function product(t,extra={}){
 const directory=await mkdtemp('/tmp/near-real-setup-');let app;
 const options={directory,configPath:null,companyId,ownerToken:token,getAuthorization:()=>null,resolveSecret:async()=>{throw Error('External access is not authorized');},...extra};
 app=await createApp(options);t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 return {get app(){return app;},directory,async reopen(changes={}){await app.close();app=await createApp({...options,...changes});return app;}};
}

test('fresh product permits authenticated zero-budget setup with no seeded agents, funds or provider effects',async t=>{
 let calls=0;const deny=async()=>{calls++;throw Error('No provider calls expected');};
 const h=await product(t,{paymentTransport:deny,inferenceTransport:deny,agentTransport:deny});
 assert.equal(h.app.rules.snapshot().mode,'setup');assert.equal(h.app.rules.snapshot().config,null);
 assert.equal((await h.app.web.handle(request('/api/workspace',undefined,false))).status,403);
 assert.equal((await h.app.web.handle(request('/api/workspace',undefined,true))).status,200);
 assert.equal((await h.app.web.handle(request('/api/owner/status'))).status,200);assert.equal((await h.app.web.handle(request('/api/owner/status',undefined,false))).status,403);
 assert.equal((await h.app.web.handle(request('/api/workspace/organization',{name:'Owner company',purpose:'Research with bounded real sources.',version:0}))).status,200);
 const created=await h.app.web.handle(request('/api/agents',{name:'Research analyst',role:'Research',instructions:'Use permitted sources and qualify uncertainty.',skillIds:['evidence-review']}));assert.equal(created.status,201);
 assert.equal(h.app.workspace.view().agents.length,1);assert.equal(h.app.workspace.view().agents[0].runtime,'setup');
 assert.equal(h.app.treasury.snapshot().balances.length,0);assert.equal(h.app.treasury.snapshot().credits.lots.length,0);assert.equal(calls,0);
 const sale=await h.app.web.handle(request('/api/orders',{question:'A market question'},false));assert.notEqual(sale.status,201);assert.equal(h.app.journal.list('orders').length,0);assert.equal((await h.app.web.handle(request('/api/orders/unknown/fixture-payment',{},true))).status,404);
 const readiness=await (await h.app.web.handle(request('/api/workspace/readiness'))).json();assert.equal(readiness.ready,false);assert.equal(readiness.commercialPolicyRequired,true);
 await h.reopen();assert.equal(h.app.workspace.view().agents.length,1);assert.equal(h.app.workspace.view().organization.name,'Owner company');assert.equal(calls,0);
});

test('read-only probe uses server scope and private evidence; request URLs, money and anonymous probes cannot run',async t=>{
 let healthReads=0,paidCalls=0;
 const h=await product(t,{jbrainClient:{health:async()=>{healthReads++;return {status:'ready'};}},inferenceTransport:async()=>{paidCalls++;throw Error('Forbidden');}});
 assert.equal((await h.app.web.handle(request('/api/workspace/probes',{capability:'jbrain'},false))).status,403);
 assert.equal(healthReads,0);
 assert.equal((await h.app.web.handle(request('/api/workspace/probes',{capability:'jbrain',url:'https://unapproved.example'}))).status,400);assert.equal(healthReads,0);
 const response=await h.app.web.handle(request('/api/workspace/probes',{capability:'jbrain'}));assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.observation.status,'verified');assert.match(value.observation.evidenceRef,/^private:/);assert.equal(healthReads,1);assert.equal(paidCalls,0);assert.equal(value.readiness.ready,false);
 assert.equal(h.app.journal.list('privateArtifacts').length,1);const ledger=await h.app.web.handle(request('/api/ledger',undefined,false));assert.ok(ledger.status>=400);assert.ok((await ledger.json()).error);
});

test('economic store rejects changed treasury, network, settlement token and balance domain without mutating history',async t=>{
 const directory=await mkdtemp('/tmp/near-economic-identity-');t.after(()=>rm(directory,{recursive:true,force:true}));
 const c=config();c.mode='live';c.settlementRecipientType='CONFIDENTIAL_INTENTS';const configPath=directory+'/policy.yaml';await writeFile(configPath,stringify(c));
 const options={directory:directory+'/store',configPath,companyId,ownerToken:token,agentBalanceSource:'confidential',getAuthorization:()=>null};
 let app=await createApp(options);await app.close();
 const before=await readFile(directory+'/store/journal.json','utf8');
 for(const changed of [{agentBalanceSource:'public'}, {config:{...c,treasuryAccount:'another-owner.near'}}, {config:{...c,settlementAsset:{...c.settlementAsset,asset:'changed-token'},fixtureBootstrap:{...c.fixtureBootstrap,asset:'changed-token'}}}]){
  if(changed.config)await writeFile(configPath,stringify(changed.config));
  await assert.rejects(createApp({...options,...(changed.agentBalanceSource?{agentBalanceSource:changed.agentBalanceSource}:{})}),{code:'ECONOMIC_IDENTITY_MISMATCH'});
  assert.equal(await readFile(directory+'/store/journal.json','utf8'),before);await writeFile(configPath,stringify(c));
 }
 app=await createApp(options);await app.close();
});

test('unconfigured workspace can select a commercial identity once before economic work; profile transition remains explicit',async t=>{
 const h=await product(t);
 const created=await h.app.workspace.create({name:'Owner analyst',role:'Research',instructions:'Use approved evidence.',skillIds:[]},owner);
 const c=config();c.mode='live';c.settlementRecipientType='CONFIDENTIAL_INTENTS';const configPath=h.directory+'/owner.yaml';await writeFile(configPath,stringify(c));
 await h.reopen({configPath,agentBalanceSource:'confidential'});
 assert.equal(h.app.workspace.get(created.agent.id).agent.runtime,'setup');
 const updated=await h.app.workspace.update(created.agent.id,{runtime:'live',version:created.agent.version},owner);assert.equal(updated.agent.runtime,'live');
 assert.equal(h.app.treasury.snapshot().balances.length,0);assert.equal(h.app.workspace.services().length,0);
});

test('product dependency graph cannot load fixture factories, canned reports or fictional onboarding',async()=>{
 const visited=new Set();
 async function walk(file){file=path.resolve(file);if(visited.has(file))return;visited.add(file);const source=await readFile(file,'utf8');
  assert.ok(!/fixtureOutput|createFixture(?:Custody|Payments|CloudFunding|Inference)Adapter|fixtureSources|loadDemo\(/.test(source),file);
  const imports=[...source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
  for(const spec of imports){if(!spec.startsWith('.'))continue;const target=path.resolve(path.dirname(file),spec);assert.ok(!target.includes('/test/'),target);if(/\.(mjs|js)$/.test(target))await walk(target);}
 }
 await walk('src/app.mjs');await walk('server.mjs');await walk('public/app.js');
 assert.ok(visited.size>30);
});
