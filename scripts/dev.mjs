import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnvFile} from 'node:process';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try{loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const children=[];let stopping=false;
async function stop(code=0){if(stopping)return;stopping=true;for(const child of children.toReversed())child.kill('SIGTERM');await Promise.all(children.map(child=>child.exitCode!==null?null:new Promise(resolve=>child.once('exit',resolve))));process.exit(code);}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop());
try{
 let url=process.env.SHOP_JBRAIN_URL,tokenFile=process.env.SHOP_JBRAIN_TOKEN_FILE;
 if(!url){
  const binary=process.env.SHOP_JBRAIN_BINARY??path.resolve(root,'.runtime/dependencies/jbrain/target/release/jbrain');
  try{await access(binary);}catch{throw Error('JBrain binary unavailable. Run npm run setup:jbrain, set SHOP_JBRAIN_BINARY, or configure an existing SHOP_JBRAIN_URL.');}
  const directory=path.resolve(root,process.env.SHOP_JBRAIN_DATA_DIR??path.join(process.env.SHOP_DATA_DIR??'.runtime/company-workspace','company-brain'));
  await mkdir(directory,{recursive:true,mode:0o700});tokenFile=path.join(directory,'access.token');let token;
  try{token=(await readFile(tokenFile,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;token=randomBytes(32).toString('hex');await writeFile(tokenFile,token+'\n',{flag:'wx',mode:0o600});}
  const brain=spawn(binary,['serve'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,JBRAIN_DATA_DIR:directory,JBRAIN_HOST:'127.0.0.1',JBRAIN_PORT:'0',JBRAIN_TOKEN:token,JBRAIN_HISTORY:'off'},stdio:['ignore','pipe','inherit']});children.push(brain);
  url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('JBrain startup timed out.')),15000);const lines=createInterface({input:brain.stdout});lines.on('line',line=>{try{const value=JSON.parse(line);if(value.event==='ready'){clearTimeout(timer);resolve(value.url);}}catch{}});brain.once('error',reject);brain.once('exit',code=>{clearTimeout(timer);if(!stopping)reject(Error(`JBrain exited with ${code}.`));});});
  brain.on('exit',code=>{if(!stopping)stop(code||1);});
  console.log('Company knowledge: JBrain connected (isolated local storage; model-free).');
 }
 const app=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,SHOP_JBRAIN_URL:url,...(tokenFile?{SHOP_JBRAIN_TOKEN_FILE:tokenFile}:{})},stdio:'inherit'});children.push(app);app.once('error',e=>{console.error(e.message);stop(1);});app.once('exit',code=>{if(!stopping)stop(code??1);});
}catch(e){console.error(e.message);await stop(1);}
