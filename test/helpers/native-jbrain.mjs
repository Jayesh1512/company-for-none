import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import path from 'node:path';

export async function startNativeJBrain(directory){
 const token=randomBytes(32).toString('hex');
 const binary=process.env.JBRAIN_TEST_BINARY??path.resolve('.runtime/dependencies/jbrain/target/release/jbrain');
 const child=spawn(binary,['serve'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,JBRAIN_DATA_DIR:directory,JBRAIN_PORT:'0',JBRAIN_HOST:'127.0.0.1',JBRAIN_TOKEN:token,JBRAIN_HISTORY:'off'},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Native JBrain startup timeout'));},15000);const lines=createInterface({input:child.stdout});lines.on('line',line=>{try{const v=JSON.parse(line);if(v.event==='ready'){clearTimeout(timer);resolve(v.url);}}catch{}});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native JBrain exited: ${code}`));});});
 return {url,token,async close(){if(child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}};
}
