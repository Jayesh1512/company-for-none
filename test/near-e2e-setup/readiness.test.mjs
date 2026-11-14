import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';
import {createReadinessRuntime} from '../../src/runtime/readiness.mjs';
import {CAPABILITIES} from '../../src/rules/runtime.mjs';
import {renderReadiness} from '../../public/operation.js';

const owner={companyId:'local-workspace',role:'owner',verified:true};
async function setup(t,client){
  const directory=await mkdtemp('/tmp/near-e2e-ready-');let now=Date.parse('2026-11-14T10:00:00Z');
  const app=await createApp({directory,companyId:'local-workspace',configPath:null,clock:()=>now,jbrainClient:client,resolveSecret:async()=>{throw Error('No provider I/O authorized');}});
  t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
  return {app,advance:ms=>{now+=ms;},get now(){return now;}};
}
const brain=(health)=>({health,write:async()=>{throw Error('no write');},read:async()=>null,operation:async()=>({state:'absent'})});
const jbrain=plan=>plan.requirements.find(r=>r.capability==='jbrain');

test('setup and operation project one current M01 decision per capability, not raw expired duplicates',async t=>{
  let calls=0;const h=await setup(t,brain(async()=>{calls++;return {status:'ready'};}));
  for(let i=0;i<4;i++){await h.app.runtime.probe('jbrain',owner);h.advance(400000);}
  assert.equal(h.app.journal.list('runtimeFacts').length,4,'raw observation history is retained');
  const setupView=await h.app.workspace.setup(owner),operation=await h.app.workspace.operation(owner);
  for(const infra of [setupView.infrastructure,operation.infrastructure]){
    assert.equal(infra.length,CAPABILITIES.length);assert.deepEqual(infra.map(x=>x.capability).sort(),[...CAPABILITIES].sort());
    const j=infra.find(x=>x.capability==='jbrain');assert.equal(j.status,'unavailable');assert.equal(j.reasonCode,'OBSERVATION_EXPIRED');assert.ok(j.observedAt);
  }
  assert.equal(jbrain(setupView.readiness).reasonCode,'OBSERVATION_EXPIRED');assert.equal(h.app.journal.list('runtimeFacts').length,4,'viewing never records a new observation');assert.ok(calls>=4);
  const html=renderReadiness(operation.readiness);assert.match(html,/expired/);assert.match(html,/Refresh/);
});

test('an explicit refresh reads real health, is bounded to five minutes, and never reuses an older observation',async t=>{
  const h=await setup(t,brain(async()=>({status:'ready'})));
  const first=await h.app.runtime.probe('jbrain',owner);
  assert.equal(first.observation.status,'verified');assert.equal(Date.parse(first.observation.expiresAt)-Date.parse(first.observation.observedAt),300000);
  assert.equal(first.observation.identity.companyId,'local-workspace');assert.match(first.observation.evidenceRef,/^private:/);
  h.advance(299000);assert.equal(jbrain(h.app.runtime.readiness(owner)).status,'verified');
  h.advance(2000);assert.equal(jbrain(h.app.runtime.readiness(owner)).reasonCode,'OBSERVATION_EXPIRED');
  // Setup-only mode: a healthy brain is still not commercial readiness and grants nothing.
  const plan=h.app.runtime.readiness(owner);assert.equal(plan.ready,false);assert.equal(plan.commercialPolicyRequired,true);assert.equal(plan.grantsSpendingAuthority,false);
  assert.equal(h.app.treasury.snapshot().version,0);assert.equal(Object.keys(h.app.journal.snapshot().operations).length,0);
});

test('unhealthy, failing or hostile JBrain health is never fabricated as verified',async t=>{
  for(const client of [brain(async()=>({status:'degraded'})),brain(async()=>{throw Object.assign(Error('secret-token-123'),{code:'ECONNREFUSED'});}),brain(async()=>({status:'ready',extra:true,verified:true})),null]){
    const h=await setup(t,client??undefined);
    const {observation}=await h.app.runtime.probe('jbrain',owner);
    if(client&&observation.status==='verified')assert.equal(observation.reasonCode,'JBRAIN_HEALTH_OBSERVED');else assert.notEqual(observation.status,'verified');
    assert.ok(!JSON.stringify(observation).includes('secret-token-123'));
  }
});

test('non-owner and unknown-capability probes are denied before any provider read',async t=>{
  let calls=0;const h=await setup(t,brain(async()=>{calls++;return {status:'ready'};}));
  await assert.rejects(h.app.runtime.probe('jbrain',{role:'public',companyId:'local-workspace'}),/ACCESS_DENIED/);
  await assert.rejects(h.app.runtime.probe('funding',owner),/PROBE_SCOPE_DENIED/);assert.equal(calls,0);
});


test('a stuck local health client is bounded by the exact M01 probe deadline and remains unavailable',async()=>{
 const observations=[],runtime=createReadinessRuntime({journal:{putArtifact:async()=>{throw Error('No health evidence exists');},transaction:async(_,fn)=>fn({put:(_ns,_id,value)=>observations.push(value)})},rules:{evaluate:action=>({status:'allow',plan:action.type==='runtime_probe'?{ttlMs:300000,timeoutMs:10}:{requirements:[]}}),snapshot:()=>({policyVersion:null})},identity:()=>({companyId:'local-workspace'}),providers:{},knowledgeClient:{health:()=>new Promise(()=>{})}});
 const result=await runtime.probe('jbrain',owner);assert.equal(result.observation.status,'unavailable');assert.equal(result.observation.reasonCode,'PROVIDER_READ_FAILED');assert.equal(observations.length,1);
});
