import {spawn} from 'node:child_process';
import {mkdir,access,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source='https://github.com/Jayesh1512/jbrain.git';
const revision='35836b0972a6471b22db3155f78b26749c78b6ac';
const directory=path.resolve('.runtime/dependencies/jbrain');
async function run(command,args,cwd){await new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd,stdio:'inherit',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error(`${command} exited ${code}`)));});}
try{
  await mkdir(path.dirname(directory),{recursive:true});
  let existing=false;try{await access(directory);existing=true;}catch{}
  if(!existing){await run('git',['clone','--no-checkout',source,directory]);await run('git',['checkout','--detach',revision],directory);}
  else{
    // Never reset or overwrite a dependency someone has edited.
    const {execFileSync}=await import('node:child_process');
    if(execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim()!==revision||execFileSync('git',['status','--porcelain'],{cwd:directory,encoding:'utf8'}).trim())throw Error('Existing dependency differs from the pinned revision. Preserve it and use a separate configured binary.');
  }
  await run('cargo',['build','--release','--locked'],directory);
  const binary=path.join(directory,'target/release/jbrain'),hash=createHash('sha256').update(await readFile(binary)).digest('hex');
  await writeFile(path.join(path.dirname(directory),'jbrain-manifest.json'),JSON.stringify({source,revision,binary,sha256:hash},null,2));
  console.log('Pinned JBrain built. Configure SHOP_JBRAIN_BINARY and JBRAIN_TEST_BINARY to .runtime/dependencies/jbrain/target/release/jbrain.');
}catch(error){console.error(error.message);process.exitCode=1;}
