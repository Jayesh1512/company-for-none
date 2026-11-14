import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {parseArgs} from 'node:util';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createApp} from '../src/app.mjs';
import {createRules} from '../src/rules/index.mjs';
import {createRecoveryRules,RECOVERY_LIMITS} from '../src/rules/recovery.mjs';
import {recoveryScenario,DEFAULT_RECOVERY_SCENARIO} from '../src/demo/recovery-scenarios.mjs';
import {createRecovery,RECOVERY_COMPANY} from '../src/demo/recovery.mjs';
import {readAutonomyFacts} from '../src/autonomy/facts.mjs';
import {catalog} from '../src/workspace/catalog.mjs';
import {startServer} from '../server.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {values}=parseArgs({options:{port:{type:'string',default:'4187'},start:{type:'boolean'},directory:{type:'string'},'outlayer-verifier':{type:'string'},scenario:{type:'string',default:DEFAULT_RECOVERY_SCENARIO}}});
const scenario=recoveryScenario(values.scenario);
try{loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const credential=process.env.NEAR_AI_API_KEY;
if(!credential)throw Error('Configure NEAR_AI_API_KEY privately before starting the live recovery workspace.');
const directory=path.resolve(values.directory??path.join(root,scenario.id===DEFAULT_RECOVERY_SCENARIO?'.runtime/near-ai-recovery-v1':'.runtime/near-ai-recovery-'+scenario.id+'-v1'));
await mkdir(directory,{recursive:true,mode:0o700});
const digest=v=>createHash('sha256').update(v).digest('hex'),credentialHash=digest(credential);
const authorizationFile=path.join(directory,'authorization.json');
let authorization;
try{const info=await stat(authorizationFile);if(info.mode&0o077)throw Error('Recovery authorization must be private (0600).');authorization=JSON.parse(await readFile(authorizationFile,'utf8'));}
catch(e){if(e.code!=='ENOENT')throw e;authorization={id:'owner-requested-near-ai-recovery-v1',enabled:true,companyId:RECOVERY_COMPANY,model:RECOVERY_LIMITS.model,maxTotalNanoUsd:RECOVERY_LIMITS.maxTotalNanoUsd,responseAcceptance:'live-verified-hold-on-loss',credentialHash,expiresAt:new Date(Date.now()+24*3600000).toISOString(),scope:'One fictional intake recovery, six original model calls, local documents and additive intake template only.'};await writeFile(authorizationFile,JSON.stringify(authorization,null,2)+'\n',{mode:0o600,flag:'wx'});}
const brainDirectory=path.join(directory,'brain');await mkdir(brainDirectory,{recursive:true,mode:0o700});
const tokenFile=path.join(brainDirectory,'access.token');let token;
try{token=(await readFile(tokenFile,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;token=randomBytes(32).toString('hex');await writeFile(tokenFile,token+'\n',{mode:0o600,flag:'wx'});}
const binary=process.env.SHOP_JBRAIN_BINARY??path.join(root,'.runtime/dependencies/jbrain/target/release/jbrain');
const brain=spawn(binary,['serve'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,JBRAIN_DATA_DIR:brainDirectory,JBRAIN_TOKEN:token,JBRAIN_HOST:'127.0.0.1',JBRAIN_PORT:'0',JBRAIN_HISTORY:'off'},stdio:['ignore','pipe','pipe']});brain.stderr.on('data',()=>{});
let app,runtime;
try{
 const brainUrl=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Recovery JBrain startup timed out.')),15000);const lines=createInterface({input:brain.stdout});lines.on('line',line=>{try{const d=JSON.parse(line);if(d.event==='ready'){clearTimeout(timer);resolve(d.url);}}catch{}});brain.once('error',e=>{clearTimeout(timer);reject(e);});brain.once('exit',()=>{clearTimeout(timer);reject(Error('Recovery JBrain exited.'));});});
 const base=createRules({companyId:RECOVERY_COMPANY,setupOnly:true,getAutonomyFacts:()=>readAutonomyFacts({journal:app?.journal,catalog,companyId:RECOVERY_COMPANY})});
 const rules=createRecoveryRules({base,scenarioId:scenario.id,companyId:RECOVERY_COMPANY,facts:()=>{const s=app?.journal.get('recoveryScenarios','intake'),head=s&&app.journal.get('companyTargetHeads',s.targetId);return {authorization,credentialHash,runs:app?.journal.list('recoveryRuns')??[],agents:app?.journal.list('agents')??[],documents:app?.journal.list('companyKnowledgeDocuments')??[],verificationResults:app?.journal.list('inferenceVerification')??[],sourceId:s?.sourceId,pricing:app?.journal.get('recoveryPricing','current'),head,baseline:head&&app.journal.get('companyRevisions',head.revisionId),contract:app?.journal.list('companyTemplateContracts').find(c=>c.targetId===s?.targetId),candidate:app?.journal.get('recoveryCandidates','current'),evaluation:app?.journal.get('improvementEvaluations','recovery:fixed-evaluation')};}});
 app=await createApp({directory:path.join(directory,'company'),companyId:RECOVERY_COMPANY,configPath:'',rules,jbrainUrl:brainUrl,jbrainToken:token,ownerToken:'',ownerTokenFile:'',accountId:'',agentId:'',ledgerBinding:null,ledgerWalletPublicFile:'',sourceUrls:[],getAuthorization:()=>null,getAgentAuthorization:()=>null,getComponentAuthorization:()=>null,getLedgerAuthorization:()=>null,getIntegrationAuthorization:()=>null,getInferenceBounds:()=>null,resolveSecret:async()=>null});
 if(authorization.credentialHash!==credentialHash){authorization.credentialHash=credentialHash;await writeFile(authorizationFile,JSON.stringify(authorization,null,2)+'\n',{mode:0o600});await app.journal.transaction({actionId:'recovery:credential-binding:'+credentialHash,fingerprint:credentialHash},tx=>{tx.append('recovery.credential_updated',{companyId:RECOVERY_COMPANY,actorId:'owner',summary:'Reloaded the privately updated NEAR AI credential. Limits and prior operations are unchanged.'});return null;});}
 const outlayerBinding=process.env.SHOP_OUTLAYER_PROJECT_OWNER?{projectOwner:process.env.SHOP_OUTLAYER_PROJECT_OWNER,projectName:process.env.SHOP_OUTLAYER_PROJECT_NAME,versionHash:process.env.SHOP_OUTLAYER_VERSION_HASH,computeMicroUsd:process.env.SHOP_OUTLAYER_COMPUTE_MICRO_USD??'1000',networkId:process.env.SHOP_OUTLAYER_NETWORK??'mainnet',paymentKeyOwner:process.env.SHOP_OUTLAYER_PAYMENT_KEY_OWNER,paymentKeyNonce:Number(process.env.SHOP_OUTLAYER_PAYMENT_KEY_NONCE)}:null;
 const verifyOutlayerExecution=values['outlayer-verifier']?(await import(pathToFileURL(path.resolve(values['outlayer-verifier'])).href)).verifyExecution:undefined;
 const recovery=createRecovery({app,authorization,credential,scenarioId:scenario.id,outlayerBinding,verifyOutlayerExecution,resolveSecret:async ref=>ref==='OUTLAYER_PAYMENT_KEY'?process.env.OUTLAYER_PAYMENT_KEY:null});await recovery.seed();await recovery.recover();
 const original=app.web.handle.bind(app.web);app.web.handle=(request,transport)=>new URL(request.url).pathname.startsWith('/api/workspace/recovery')?recovery.handle(request,transport):original(request,transport);
 runtime=await startServer({app,port:Number(values.port),host:'127.0.0.1',localOwnerAccess:true,enableLocalDemo:false});
 console.log(JSON.stringify({url:runtime.url+'/recovery.html',ledger:runtime.url+'/#autonomy/ledger',mode:'live-near-ai-recovery',scenario:scenario.id,model:RECOVERY_LIMITS.model,maxCalls:RECOVERY_LIMITS.maxCalls,maxTotalUsd:Number(RECOVERY_LIMITS.maxTotalNanoUsd)/1e9,state:recovery.view().scenario.state}));
 if(values.start)await recovery.start();
 let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{if(stopping)return;stopping=true;while(recovery.busy)await new Promise(r=>setTimeout(r,250));await runtime.close();brain.kill('SIGTERM');process.exit(0);});
}catch(e){console.error(e.code??e.message);await runtime?.close();if(!runtime)await app?.close();brain.kill('SIGTERM');process.exitCode=1;}
