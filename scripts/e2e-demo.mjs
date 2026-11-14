import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,mkdtemp,writeFile,access,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.mjs';
import {startServer} from '../server.mjs';
import {SETUP_DEMO_BRIEF,SETUP_DEMO_KNOWLEDGE} from '../public/setup-demo.js';
import {AUTONOMY_INTENT} from '../public/autonomy-intent.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// This runner deliberately does NOT load .env. --local pins setup-only mode,
// null paid authorization/credentials and a NEW store. It imports no test provider.
export async function runEndToEndDemo(args=process.argv.slice(2)){
 const {values}=parseArgs({args,options:{local:{type:'boolean'},serve:{type:'boolean'},attest:{type:'boolean'},model:{type:'string'},port:{type:'string'},store:{type:'string'},help:{type:'boolean'}}});
 if(values.help||!values.local){console.log('Usage: npm run demo:e2e -- --local [--attest --model <NEAR-TEE-model>] [--serve --port 4185] [--store <NEW-directory>]\nCreates explicit fictional company metadata in isolated real local JBrain/journal; no paid calls, simulated providers or funds. Optional public attestation is real read-only evidence. A held agent loop is reported as blocked, never live success.');return;}
 if(values.attest&&!values.model)throw Object.assign(Error('Choose an exact server-side model for the public attestation.'),{code:'MODEL_REQUIRED'});
 const port=values.port===undefined?0:Number(values.port);if(!Number.isSafeInteger(port)||port<0||port>65535)throw Error('Invalid port.');
 const binary=process.env.SHOP_JBRAIN_BINARY??path.join(root,'.runtime/dependencies/jbrain/target/release/jbrain');await access(binary);
 await mkdir(path.join(root,'.runtime'),{recursive:true});
 const directory=values.store?path.resolve(values.store):await mkdtemp(path.join(root,'.runtime/e2e-demo-'));
 if(values.store){try{await stat(directory);throw Object.assign(Error('Use a new directory; existing stores are never overwritten.'),{code:'STORE_EXISTS'});}catch(error){if(error.code!=='ENOENT')throw error;}await mkdir(directory,{recursive:true,mode:0o700});}
 const artifactDir=path.join(root,'artifacts/near-e2e-fixes');await mkdir(artifactDir,{recursive:true});
 const companyId='e2e-demo',owner={companyId,role:'owner',verified:true},steps=[];
 let brain,app,runtime;let cleaned=false;
 const clean=async()=>{if(cleaned)return;cleaned=true;if(runtime)await runtime.close();else await app?.close();if(brain&&brain.exitCode===null){brain.kill('SIGTERM');await new Promise(resolve=>brain.once('exit',resolve));}};
 const step=(id,status,details={})=>{const row={id,status,...details};steps.push(row);console.log(JSON.stringify(row));};
 try{
  const token=randomBytes(32).toString('hex');await mkdir(path.join(directory,'brain'),{mode:0o700});
  brain=spawn(binary,['serve'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,JBRAIN_DATA_DIR:path.join(directory,'brain'),JBRAIN_HOST:'127.0.0.1',JBRAIN_PORT:'0',JBRAIN_TOKEN:token,JBRAIN_HISTORY:'off'},stdio:['ignore','pipe','pipe']});
  const brainUrl=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('JBrain startup timed out.')),15000);const lines=createInterface({input:brain.stdout});lines.on('line',line=>{try{const data=JSON.parse(line);if(data.event==='ready'){clearTimeout(timer);resolve(data.url);}}catch{}});brain.once('error',reject);brain.once('exit',code=>{clearTimeout(timer);reject(Error('JBrain exited before ready: '+code));});});
  const options={totalCeilingNanoUsd:'5000000000',directory:path.join(directory,'journal'),companyId,configPath:null,jbrainUrl:brainUrl,jbrainToken:token,componentModel:values.model??null,sourceUrls:['https://www.iana.org/help/example-domains'],resolveSecret:async()=>null,getAuthorization:()=>null,getComponentAuthorization:()=>null,getAgentAuthorization:()=>null,getInferenceBounds:()=>null};
  app=await createApp(options);
  assert.equal(app.rules.snapshot().safety.totalCeilingNanoUsd,'5000000000');
  assert.equal((await app.knowledge.view(undefined,owner)).status,'connected');step('native-jbrain','passed',{provider:'actual local JBrain'});
  const created=await app.autonomy.onboard({version:0,organizationVersion:0,brief:SETUP_DEMO_BRIEF,intent:AUTONOMY_INTENT},owner,'e2e-onboard');assert.equal(created.company.started,false);step('company-and-core-team','passed',{operatingMode:created.company.operatingMode,coreAgents:2,started:false});
  const manager=app.journal.get('agents',companyId+':manager');await app.workspace.update(manager.id,{version:manager.version,name:'Northstar manager (Demo)',instructions:'Coordinate the current approved objective. Cite evidence, report uncertainty and route process gaps to the backlog.',skillIds:['evidence-review']},owner);step('editable-agent-profile','passed');
  const {document}=await app.knowledge.save({...SETUP_DEMO_KNOWLEDGE,visibility:'restricted',agentIds:[companyId+':manager',companyId+':backlog']},{access:owner,requestId:'e2e-knowledge'});
  for(const id of [companyId+':manager',companyId+':backlog']){const agent=app.journal.get('agents',id);await app.autonomy.selectKnowledge({agentId:id,version:agent.version,knowledgeIds:[document.id]},owner,'e2e-context:'+id);}
  step('saved-and-selected-company-knowledge','passed',{documents:1,revisionRecorded:!!document.revision});
  await app.autonomy.registerTemplate({name:'Fictional subscriber record',fields:[{name:'firstName',required:true},{name:'lastName',required:true}],requiredFields:['firstName','middleName','lastName']},owner,'e2e-template');
  const target=(await app.autonomy.view(owner)).heads[0].targetId;
  await app.autonomy.recordGap({targetId:target,failureCode:'MISSING_SUBSCRIBER_FIELD',summary:'Fictional example: the subscriber template lacks the required middle-name field.'},owner,'e2e-gap');step('real-durable-backlog','passed',{improvements:(await app.autonomy.view(owner)).improvements.length,automaticRepairClaimed:false});
  const health=await app.runtime.probe('jbrain',owner);step('fresh-jbrain-observation',health.observation.status==='verified'?'passed':'blocked',{reasonCode:health.observation.reasonCode});
  const source=await app.runtime.probe('public_retrieval',owner);step('public-source-read',source.observation.status==='verified'?'passed':'blocked',{reasonCode:source.observation.reasonCode,scope:'free public retrieval, not a generated report'});
  if(values.attest){const result=await app.components.preflight(owner);const finding=result.verification??result.proof??result;step('public-tee-preflight',finding.status==='verified'?'passed':'blocked',{status:finding.status,reasonCode:finding.reasonCode??result.reasonCode,completionSent:false,scope:'gateway/model evidence only'});}
  let view=await app.autonomy.view(owner);await app.autonomy.reviewSetup({version:view.company.version},owner,'e2e-review');view=await app.autonomy.view(owner);assert.equal(view.setup.reviewed,true);assert.equal(view.company.started,false);step('unified-configuration-review','passed',{executionStarted:false});
  const before={agents:view.agents.map(a=>({id:a.id,version:a.version})),knowledgeRevision:document.revision,reviewed:view.setup.reviewed};
  await app.close();app=await createApp(options);view=await app.autonomy.view(owner);assert.deepEqual(view.agents.map(a=>({id:a.id,version:a.version})),before.agents);assert.equal(view.setup.reviewed,true);assert.equal((await app.knowledge.read(document.id,owner)).document.revision,before.knowledgeRevision);step('persistent-restart','passed');
  await app.autonomy.control({version:view.company.version,operation:'start'},owner,'e2e-start');const advance=await app.autonomy.advance(owner);view=await app.autonomy.view(owner);step('autonomous-execution','blocked',{reasonCode:advance.decision?.reasonCode??view.company.reasonCode??'COMMERCIAL_POLICY_REQUIRED',acceptedModelOutput:false,scope:'No commercial/paid authority supplied; real gate remains active'});
  assert.equal(app.treasury.snapshot().version,0);assert.equal(Object.keys(app.journal.snapshot().operations).length,0);assert.equal(app.journal.list('orders').length,0);
  runtime=await startServer({app,port,host:'127.0.0.1'});const response=await fetch(runtime.url+'/api/workspace/autonomy');assert.equal(response.status,200);step('actual-http-workspace','passed',{url:runtime.url+'/#autonomy'});
  const proof={schemaVersion:1,checkedAt:new Date().toISOString(),mode:'actual-isolated-local-setup',fictionalBusinessInput:true,localSetupComplete:true,autonomousBusinessComplete:false,simulatedProviders:false,paidDispatches:0,financialVersion:0,orders:0,approvedTotalDemoBudgetUsd:'5',runtimeTotalCeilingNanoUsd:app.rules.snapshot().safety.totalCeilingNanoUsd,store:directory,url:runtime.url+'/#autonomy',steps};
  await writeFile(path.join(artifactDir,'local-demo.json'),JSON.stringify(proof,null,2)+'\n');await writeFile(path.join(directory,'demo-proof.json'),JSON.stringify(proof,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({localSetupComplete:true,autonomousBusinessComplete:false,proof:'artifacts/near-e2e-fixes/local-demo.json',url:proof.url,paidDispatches:0},null,2));
  if(values.serve){console.log('Local demo remains open. Stop with Ctrl+C. No background paid execution is enabled.');await new Promise(resolve=>{for(const signal of ['SIGINT','SIGTERM'])process.once(signal,resolve);});}
  return proof;
 }finally{await clean();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runEndToEndDemo().catch(error=>{console.error(JSON.stringify({status:'blocked',code:error.code??'DEMO_FAILED',message:error.message}));process.exitCode=1;});
