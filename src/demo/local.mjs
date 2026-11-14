import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,readFile,writeFile,stat,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {createApp} from '../app.mjs';
import {ContractError} from '../contracts.mjs';

export const LOCAL_DEMO_COMPANY='real-local-demo';
const VERSION=1;
const brief={name:'Northstar Care · Local demo',purpose:'Answer fictional Harbor Mutual policy questions from published company documents, and send unsupported questions for owner review.',industry:'Customer care · fictional insurance',customer:'Harbor Mutual Insurance — fictional local example',outcome:'Exact cited policy replies and persistent escalation tickets, without a model call or payment.',objective:'Explore the local team, company knowledge, cited policy replies, owner escalations and recorded company history.'};
const intent={maxAgents:6,maxOpenWork:12,maxDepth:3,maxSteps:24,maxCalls:0,maxCreations:10,maxInputBytes:262144,maxResultBytes:131072,maxRetries:2,allowedResourceKinds:['skill','soul'],allowedPatchKinds:['template.add_optional_field','template.require_field']};
const fail=(code,message)=>{throw new ContractError(code,message);};

/** Lazily opens ONE actual local company/brain per main server. It never loads
 * .env or copies the original company's profiles, documents or private tokens. */
export function createLocalDemoLauncher({directory,binary,returnUrl,serve}){
 const parent=new URL(returnUrl);if(parent.protocol!=='http:'||parent.hostname!=='127.0.0.1'||parent.pathname!=='/'||parent.search||parent.hash)fail('LOCAL_DEMO_ORIGIN','Use the owning loopback workspace.');
 let active=null,opening=null,closing=false;
 async function open(){
  if(closing)fail('LOCAL_DEMO_CLOSING','The local workspace is closing.');
  if(active)return {active:true,url:active.url+'/#demo',realLocal:true,paidCalls:0};
  if(opening)return opening;
  opening=start().finally(()=>{opening=null;});return opening;
 }
 async function start(){
  await access(binary);
  await mkdir(path.dirname(directory),{recursive:true});
  let fresh=false;try{await mkdir(directory,{mode:0o700});fresh=true;}catch(e){if(e.code!=='EEXIST')throw e;}
  const marker=path.join(directory,'local-demo.json');
  if(fresh)await writeFile(marker,JSON.stringify({version:VERSION,companyId:LOCAL_DEMO_COMPANY,kind:'real-local-demo'})+'\n',{flag:'wx',mode:0o600});
  const saved=JSON.parse(await readFile(marker,'utf8'));if(saved.version!==VERSION||saved.companyId!==LOCAL_DEMO_COMPANY||saved.kind!=='real-local-demo')fail('LOCAL_DEMO_STORE_MISMATCH','This directory is not the isolated local demo.');
  const brainDirectory=path.join(directory,'brain');await mkdir(brainDirectory,{recursive:true,mode:0o700});
  const tokenPath=path.join(brainDirectory,'access.token');let token;
  try{const info=await stat(tokenPath);if(process.platform!=='win32'&&(info.mode&0o077))fail('LOCAL_DEMO_TOKEN_PERMISSIONS','The local brain token must be private.');token=(await readFile(tokenPath,'utf8')).trim();}
  catch(e){if(e.code!=='ENOENT')throw e;token=randomBytes(32).toString('hex');await writeFile(tokenPath,token+'\n',{flag:'wx',mode:0o600});}
  if(!/^[a-f0-9]{64}$/.test(token))fail('LOCAL_DEMO_TOKEN_INVALID','The isolated brain token is invalid.');
  const brain=spawn(binary,['serve'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,JBRAIN_DATA_DIR:brainDirectory,JBRAIN_HOST:'127.0.0.1',JBRAIN_PORT:'0',JBRAIN_TOKEN:token,JBRAIN_HISTORY:'off'},stdio:['ignore','pipe','pipe']});brain.stderr.on('data',()=>{});
  let app,runtime;
  const stopBrain=async()=>{if(!brain.pid||brain.exitCode!==null||brain.signalCode!==null)return;brain.kill('SIGTERM');await new Promise(resolve=>brain.once('exit',resolve));};
  try{
   const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local JBrain startup timed out.')),15000);const lines=createInterface({input:brain.stdout});lines.on('line',line=>{try{const value=JSON.parse(line);if(value.event==='ready'){clearTimeout(timer);resolve(value.url);}}catch{}});brain.once('error',e=>{clearTimeout(timer);reject(e);});brain.once('exit',()=>{clearTimeout(timer);reject(Error('Local JBrain exited before readiness.'));});});
   app=await createApp({directory:path.join(directory,'company'),companyId:LOCAL_DEMO_COMPANY,configPath:'',localDemoContext:{kind:'real-local-demo',returnUrl:parent.origin},totalCeilingNanoUsd:'5000000000',jbrainUrl:url,jbrainToken:token,
    ownerToken:'',ownerTokenFile:'',agentId:'',accountId:'',sourceUrls:[],componentModel:'',agentBalanceSource:'',ledgerBinding:null,ledgerWalletPublicFile:'',outlayerBinding:null,creditOrganizationId:'',creditSessionSecretRef:'',reportingOrganizationId:'',reportingSecretRef:'',allowDeprecatedReporting:false,
    resolveSecret:async()=>null,getAiDemoAuthorization:()=>null,getAuthorization:()=>null,getComponentAuthorization:()=>null,getAgentAuthorization:()=>null,getInferenceBounds:()=>null,getIntegrationAuthorization:()=>null,getLedgerAuthorization:()=>null,integrationAuthorizationPath:'',ledgerAuthorizationPath:''});
   if(app.treasury.snapshot().version!==0||app.journal.list('orders').length||Object.keys(app.journal.snapshot().operations).length)fail('LOCAL_DEMO_ECONOMIC_HISTORY','This local demo cannot adopt economic history.');
   const owner={role:'owner',verified:true,companyId:LOCAL_DEMO_COMPANY};
   if(!app.journal.get('runtime','localDemoInitialized')){
    if(!app.journal.get('autonomousCompanies',LOCAL_DEMO_COMPANY))await app.autonomy.onboard({version:0,organizationVersion:0,brief,intent},owner,'real-local-demo-onboard-v1');
    await app.customerCare.setupDemo(owner,'real-local-demo-care-v1');
    const company=app.journal.get('autonomousCompanies',LOCAL_DEMO_COMPANY);
    await app.autonomy.reviewSetup({version:company.version},owner,'real-local-demo-review-v1');
    await app.journal.transaction({actionId:'real-local-demo-initialized-v1',fingerprint:'real-local-demo-v1'},tx=>tx.put('runtime','localDemoInitialized',{id:'localDemoInitialized',version:VERSION}));
   }
   runtime=await serve({app,port:0,host:'127.0.0.1',enableLocalDemo:false,localOwnerAccess:true});
   const owned={app,runtime,brain,url:runtime.url,close:async()=>{await runtime.close();await stopBrain();}};active=owned;
   brain.once('exit',()=>{if(active===owned){active=null;runtime.close().catch(()=>{});}});
   return {active:true,url:runtime.url+'/#demo',realLocal:true,paidCalls:0};
  }catch(error){await runtime?.close().catch(()=>{});if(!runtime)await app?.close().catch(()=>{});await stopBrain();throw error;}
 }
 return {open,async close(){closing=true;if(opening)await opening.catch(()=>{});if(active){const owned=active;active=null;await owned.close();}}};
}
