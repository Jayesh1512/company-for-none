import {fixtureOutput} from '../helpers/research-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {stringify} from 'yaml';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {config,NOW,financial,order,evidencePack,inference,persisted} from '../rules/fixtures.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {verificationSpec,sdkFinding} from '../rules/verification-fixtures.mjs';
import {fixtureRetrieve,fixtureSources} from '../helpers/source-fixtures.mjs';
import {} from '../../src/research/index.mjs';
import {renderOperation,renderService} from '../../public/operation.js';
import {createAgentApiCustody} from '../../src/custody/agent-api.mjs';
import {createIntentsClient} from '../../src/payments/http.mjs';

const request=(path,body,token)=>new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
function brain(){const docs=new Map();return {health:async()=>({status:'ready'}),write:async p=>{const revision=fingerprint(p.markdown);docs.set(p.id,{id:p.id,revision,markdown:p.markdown});return {id:p.id,revision,requestId:p.requestId};},read:async id=>docs.get(id),operation:async()=>({state:'absent'})};}
async function prepare(t,options={}){const directory=await mkdtemp('/tmp/near-business-');let app=await createApp({directory,jbrainClient:brain(),...options});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return {directory,get app(){return app;},async restart(){await app.close();app=await createApp({directory,jbrainClient:brain(),...options});return app;}};}
async function setup(app){await app.workspace.saveOrganization({name:'Test research company',purpose:'Sell sourced research within approved limits.',version:0});await app.knowledge.save({title:'Private owner context',body:'Do not share this PRIVATE-MARKER with customers.',visibility:'company',agentIds:[]},{requestId:'company-context'});for(const stepId of ['agents','profiles','skills','infra','brain']){const s=await app.workspace.setup();await app.workspace.reviewSetup({stepId,version:s.organization.version});}const s=await app.workspace.setup();await app.workspace.activate({version:s.organization.version,agentId:'research-agent',serviceId:'market-opportunity',knowledgeIds:[]});}

test('activation publishes selected service, excludes company knowledge by default, freezes bindings and pauses sales',async t=>{
  const {app}=await prepare(t);assert.deepEqual(app.workspace.services(),[]);
  await setup(app);assert.equal(app.workspace.services().length,1);
  let agent=app.workspace.get('research-agent').agent;
  await app.workspace.bindResource(agent.id,{listingId:'evidence-review',version:agent.version});
  await assert.rejects(app.workspace.createServiceOrder('market-opportunity',{question:'What research evidence should a small business validate?'}),/ACTIVATION_REVIEW_REQUIRED/);
  let s=await app.workspace.setup();for(const stepId of ['agents','profiles','skills','infra','brain']){s=await app.workspace.setup();if(!s.progress.steps.find(x=>x.id===stepId).complete)await app.workspace.reviewSetup({stepId,version:s.organization.version});}
  await app.workspace.activate({version:(await app.workspace.setup()).organization.version,agentId:agent.id,serviceId:'market-opportunity',knowledgeIds:[]});
  const created=await app.workspace.createServiceOrder('market-opportunity',{question:'What research evidence should a small business validate?'});
  const raw=app.journal.get('orders',created.order.id);assert.equal(raw.agentContext.companyKnowledge.documents.length,0);assert.equal(raw.agentContext.resourceBindings[0].id,'evidence-review');
  await app.workflow.confirmFixturePayment(created.order.id);await app.workflow.recover();assert.equal(app.workflow.getOrder(created.order.id).status,'complete');
  const report=await app.workflow.getReport(created.order.id,{token:created.accessToken});assert.ok(!JSON.stringify(report).includes('PRIVATE-MARKER'));
  await app.workspace.pause({version:(await app.workspace.setup()).organization.version});assert.deepEqual(app.workspace.services(),[]);
  await assert.rejects(app.workspace.createServiceOrder('market-opportunity',{question:'Another order'}),/COMPANY_NOT_ACTIVE/);
});

test('configured skill procurement pays once, records a licence and survives restart without another purchase',async t=>{
  const c=config();c.procurement={enabled:true,listingId:'licensed-research-checklist',recipient:'fixture-supplier',money:{...c.settlementAsset,amount:'100000'},maxCostNanoUsd:'100000000'};
  const h=await prepare(t,{rules:createRules({config:c})});await setup(h.app);
  await assert.rejects(h.app.workspace.install('research-agent','licensed-research-checklist'),/LICENCE_REQUIRED/);
  assert.ok(h.app.workspace.view().catalog.find(x=>x.id==='licensed-research-checklist').purchaseRequired);
  const created=await h.app.workspace.createServiceOrder('market-opportunity',{question:'What research evidence should a small business validate?'});await h.app.workflow.confirmFixturePayment(created.order.id);await h.app.workflow.run(created.order.id);
  assert.equal(h.app.workflow.getOrder(created.order.id).status,'complete');assert.equal(h.app.journal.list('resourceLicenses').length,1);
  assert.equal(h.app.journal.events({}).filter(x=>x.type==='procurement.confirmed').length,1);
  await h.restart();await h.app.workflow.recover();assert.equal(h.app.journal.list('resourceLicenses').length,1);assert.equal(h.app.journal.events({}).filter(x=>x.type==='procurement.confirmed').length,1);
});

test('live permits recheck authorization expiry, renewal and policy caps immediately before dispatch',()=>{
  const c=config();c.mode='live';const policyVersion=createRules({config:c}).snapshot().policyVersion;
  let authorization={id:'owner-v1',mode:'live',companyId:'company',policyVersion,expiresAt:new Date(NOW+10000).toISOString(),actions:['inference'],maxRequestNanoUsd:'100000000',dailyInferenceCapNanoUsd:'1000000000'};
  let runtime;
  const engine=createRules({config:c,clock:()=>NOW,companyId:'company',getRuntimeFacts:()=>runtime,getAuthorization:()=>authorization,getOperationState:()=>({state:'live_ready',policyVersion})});
  const f=financial();f.credits.lots[0].expiresAt=new Date(NOW+10000).toISOString();
  const binding={provider:'near-ai-cloud',companyId:'company',accountId:'controlled-credit-account',organizationId:null,credentialId:null,network:'cloud:test',asset:'nanoUSD',decimals:0,bucket:'prepaid'};
  const identity={companyId:'company',provider:'controlled-wallet',network:c.settlementAsset.network,treasuryAccount:c.treasuryAccount,accountId:c.treasuryAccount,bucket:'confidential',settlementAsset:c.settlementAsset,creditBinding:binding};
  const capabilities=['custody_identity','custody_policy','custody_grant','custody_balance','payments_route','refund_route','inference_model','inference_bounds','inference_credit','inference_proof','jbrain','public_retrieval'];
  const providerObservation={id:'controlled-balance',resource:'credit',binding,watermark:{stream:'controlled-credit',position:'1'},availableNanoUsd:f.credits.availableNanoUsd,observedAt:new Date(NOW).toISOString(),evidenceRef:'private:controlled-balance'};
  runtime={economicIdentity:identity,observations:capabilities.map(capability=>({id:'controlled:'+capability,capability,provider:'test-only-observer',status:'verified',observedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),identity,policyVersion,evidenceRef:'private:controlled-'+capability})),economicObservations:[{...providerObservation,status:'verified'}]};
  const scopeId=fingerprint({resource:'credit',binding});f.providerObservations=[{...providerObservation,scopeId}];f.balanceReconciliations=[{scopeId,resource:'credit',observationId:providerObservation.id,watermark:providerObservation.watermark,status:'matched',observedAmount:f.credits.availableNanoUsd,expectedAmount:f.credits.availableNanoUsd,unresolvedOperationIds:[]}];
  // Explicit synthetic SDK findings keep this authorization test isolated from real inference.
  const generationRequest={model:c.research.model,messages:[{role:'user',content:'Controlled policy test'}],maxInputBytes:1000,maxOutputTokens:32,timeoutMs:1000,verificationSpec:verificationSpec(c),chargeBound:{verified:true,completionTokensIncludeReasoning:true,reference:'bounded-price-evidence'}};
  runtime.verificationResults=[sdkFinding(generationRequest)];
  const a={...inference(),mode:'live',requestFingerprint:fingerprint(generationRequest)},o={...order(),mode:'live'},facts={action:a,financial:f,order:o,evidencePack:evidencePack(),creditId:'credit1',request:generationRequest};
  const d=engine.evaluate(a,facts);assert.equal(d.status,'allow',JSON.stringify(d));
  const proof=persisted(d,f,true);let calls=0;
  authorization={...authorization,expiresAt:new Date(NOW-1).toISOString()};assert.equal(engine.dispatch(d.permit,{...facts,financial:proof},()=>calls++).reasonCode,'LIVE_AUTHORIZATION_REQUIRED');
  authorization={...authorization,expiresAt:new Date(NOW+10000).toISOString(),id:'owner-v2'};assert.equal(engine.dispatch(d.permit,{...facts,financial:proof},()=>calls++).reasonCode,'STALE_AUTHORIZATION');
  authorization={...authorization,id:'owner-v1',maxRequestNanoUsd:'1'};assert.equal(engine.dispatch(d.permit,{...facts,financial:proof},()=>calls++).reasonCode,'OWNER_REQUEST_CAP_EXCEEDED');assert.equal(calls,0);
});

test('prepaid evidence expires and cannot be reused to replenish a consumed credit lot',async t=>{
  const {app}=await prepare(t);const owner=app.rules.snapshot().config.treasuryAccount;
  const observation={id:'owner-credit',status:'confirmed',owner,provider:'near-ai-cloud',provenance:'owner_prepaid',reference:'receipt-1',availableNanoUsd:'10000000',expiresAt:new Date(Date.now()+60000).toISOString()};
  const action={id:'credit-observation',type:'credit_record',mode:'fixture'};
  const d=app.rules.evaluate(action,{observation,financial:app.treasury.snapshot()});assert.equal(d.status,'allow');await app.treasury.applyDecision({actionId:action.id,decision:d});
  const before=app.treasury.snapshot();await app.treasury.applyDecision({actionId:action.id,decision:d});assert.equal(app.treasury.snapshot().credits.availableNanoUsd,before.credits.availableNanoUsd);
  const reused=app.rules.evaluate({...action,id:'new-receipt-command'},{observation:{...observation,id:'different-id'},financial:before});assert.equal(reused.reasonCode,'CREDIT_REFERENCE_REUSED');
  const expired=app.rules.evaluate({...action,id:'expired-credit'},{observation:{...observation,expiresAt:'2000-01-01T00:00:00Z'},financial:before});assert.equal(expired.reasonCode,'CREDIT_EVIDENCE_REQUIRED');
  assert.equal(app.journal.events({}).filter(x=>x.type==='funding.confirmed').length,0);
});

test('activation and customer service views escape supplied text and separate demo authority',async t=>{
  const {app}=await prepare(t);await setup(app);const operation=await app.workspace.operation();operation.activation.state='<img src=x>';
  const html=renderOperation({operation,setup:await app.workspace.setup()});assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('Activate demo company'));
  const service=renderService({services:app.workspace.services(),route:{sub:'market-opportunity'}});assert.ok(service.includes('Demonstration service'));assert.ok(service.includes('service-refund'));
});

test('unselected wallet bucket cannot dispatch, and payment authentication schemes are explicit',async t=>{
  const {app}=await prepare(t);let sends=0;
  const isolated=await mkdtemp('/tmp/near-reject-fixture-live-');
  try{const c=config();c.mode='live';await assert.rejects(import('../../src/app.mjs').then(m=>m.createApp({directory:isolated,rules:createRules({config:config()})})),{code:'TEST_COMPOSITION_REQUIRED'});}finally{await rm(isolated,{recursive:true,force:true});}
  const custody=createAgentApiCustody({journal:app.journal,agentId:'existing-agent',accountId:'owner.near',transport:()=>{sends++;throw Error('Must not send');}});
  const result=await custody.transfer({action:{id:'unverified-bucket',type:'payout',recipient:'payee.near',money:{network:'near:mainnet',asset:'nep141:usdt.tether-token.near',decimals:6,amount:'1000000'}}});
  assert.equal(result.status,'not_submitted');assert.equal(sends,0);
  for(const [scheme,header,value] of [['bearer','authorization','Bearer test-api-key'],['api-key','x-api-key','test-api-key']]){
    const server=createServer((req,res)=>{assert.equal(req.headers[header],value);res.setHeader('content-type','application/json');res.end('[]');});server.listen(0,'127.0.0.1');await once(server,'listening');
    try{const client=createIntentsClient({secretRef:'payment-reference',resolveSecret:async()=> 'test-api-key',authScheme:scheme,transport:(url,init)=>fetch(`http://127.0.0.1:${server.address().port}/tokens`,init)});assert.deepEqual(await client.tokens(),[]);}finally{await new Promise(r=>server.close(r));}
  }
  const invalid=createIntentsClient({secretRef:'payment-reference',resolveSecret:async()=> 'test-api-key',authScheme:null,transport:()=>{sends++;}});await assert.rejects(invalid.tokens(),/AUTH_SCHEME_UNVERIFIED/);assert.equal(sends,0);
});

test('real product never auto-imports owner balance assertions or enables a sale from credentials and mode',async t=>{
 const {createApp:createProductApp}=await import('../../src/app.mjs');
 const directory=await mkdtemp('/tmp/near-real-guard-');let app;t.after(async()=>{await app?.close();await rm(directory,{recursive:true,force:true});});
 const c=config();c.mode='live';c.settlementRecipientType='CONFIDENTIAL_INTENTS';const configPath=directory+'/policy.yaml';await writeFile(configPath,stringify(c));
 let network=0;const transport=async()=>{network++;throw Error('No provider read was requested');};
 app=await createProductApp({directory:directory+'/store',configPath,companyId:'company',ownerToken:'owner-test',agentBalanceSource:'confidential',getAuthorization:()=>({capital:{id:'owner-assertion',money:{...c.settlementAsset,amount:'999999999'}},credit:{id:'owner-credit',availableNanoUsd:'999999999'}}),paymentTransport:transport,agentTransport:transport,inferenceTransport:transport});
 assert.equal((await app.web.handle(request('/api/workspace'))).status,403);
 assert.equal((await app.web.handle(request('/api/workspace',undefined,'owner-test'))).status,200);
 const result=await app.web.handle(request('/api/workspace/organization',{name:'Real company',purpose:'Prepare a bounded research service.',version:0},'owner-test'));assert.equal(result.status,200);
 assert.equal(app.treasury.snapshot().balances.length,0);assert.equal(app.treasury.snapshot().credits.lots.length,0);assert.equal(app.workspace.view().agents.length,0);
 const sale=await app.web.handle(request('/api/orders',{question:'A market question',refundRecipient:'customer.near'}));assert.notEqual(sale.status,201);assert.equal(network,0);assert.equal(app.journal.list('orders').length,0);
});
