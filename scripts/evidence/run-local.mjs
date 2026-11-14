import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {ROOT,hash,scanText} from './model.mjs';
import {LOCAL_SUITES,SCOPE_BY_KIND} from './catalog.mjs';

// Opt-in isolated tests only. The running preview and its company are never used.
const startedAt=new Date().toISOString(),runId=startedAt.replaceAll(/[:.]/g,'-');
const directory=`evidence/runs/${runId}`;
await mkdir(path.join(ROOT,directory),{recursive:true});
const results=[];
const scenarioOutput=`${directory}/care-scenario.json`;
{
 const child=spawn(process.execPath,['scripts/evidence/care-scenario.mjs',scenarioOutput],{cwd:ROOT,env:{PATH:process.env.PATH,HOME:process.env.HOME,...(process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{}),...(process.env.JBRAIN_TEST_BINARY?{JBRAIN_TEST_BINARY:process.env.JBRAIN_TEST_BINARY}:{})},stdio:['ignore','pipe','pipe']});
 const chunks=[];for(const stream of [child.stdout,child.stderr])stream.on('data',b=>chunks.push(b));
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 if(code!==0)throw Error('ACTUAL_NATIVE_CARE_SCENARIO_FAILED');
 console.log(Buffer.concat(chunks).toString('utf8').trim());
}
for(const suite of LOCAL_SUITES){
 const sourceHashes={};for(const f of suite.tests)sourceHashes[f]=hash(await readFile(path.join(ROOT,f)));
 const env={PATH:process.env.PATH,HOME:process.env.HOME,FORCE_COLOR:'0',...(process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{}),...(process.env.JBRAIN_TEST_BINARY?{JBRAIN_TEST_BINARY:process.env.JBRAIN_TEST_BINARY}:{}),...(suite.id==='healing-controlled'?{NEAR_CONTROLLED_TRACE:'1'}:{})};
 const args=['--test','--test-reporter=spec',...suite.tests],began=new Date().toISOString();
 const child=spawn(process.execPath,args,{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
 const chunks=[];let bytes=0,tooLarge=false;
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{bytes+=b.length;if(bytes>4*1024*1024){tooLarge=true;child.kill('SIGTERM');}else chunks.push(b);});
 const timer=setTimeout(()=>child.kill('SIGTERM'),180000);
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);}).finally(()=>clearTimeout(timer));
 const output=Buffer.concat(chunks).toString('utf8');
 if(tooLarge)throw Error('LOCAL_EVIDENCE_OUTPUT_TOO_LARGE');
 if(scanText(output).length)throw Error(`LOCAL_EVIDENCE_REDACTION_REQUIRED:${suite.id}`);
 await writeFile(path.join(ROOT,directory,`${suite.id}.log`),output);
 const sourceUnchanged=(await Promise.all(suite.tests.map(async f=>hash(await readFile(path.join(ROOT,f)))===sourceHashes[f]))).every(Boolean);
 const metric=name=>Number(new RegExp(`(?:ℹ |# )${name} (\\d+)`).exec(output)?.[1]??0);
 const counts={testCount:metric('tests'),passCount:metric('pass'),failCount:metric('fail'),skipCount:metric('skipped')};
 const passed=code===0&&sourceUnchanged&&counts.testCount>0&&counts.passCount===counts.testCount&&counts.failCount===0&&counts.skipCount===0;
 const result={id:suite.id,kind:suite.kind,trustScope:SCOPE_BY_KIND[suite.kind],tests:suite.tests,command:[process.execPath,...args],startedAt:began,completedAt:new Date().toISOString(),passed,exitCode:code,sourceUnchanged,sourceHashes,...counts,doesNotProve:suite.doesNotProve};
 results.push(result);console.log(JSON.stringify({suite:suite.id,scope:result.trustScope,passed:result.passed,tests:result.testCount}));
}
const record={schemaVersion:1,directory,scenarioOutput,startedAt,completedAt:new Date().toISOString(),sourceScope:'Selected test file hashes; not a whole-checkout source freeze.',previewUsed:false,inheritedProviderCredentials:false,publicProviderCalls:0,paidCalls:0,mainnetTransactions:0,results};
await writeFile(path.join(ROOT,directory,'run.json'),JSON.stringify(record,null,2)+'\n');
await writeFile(path.join(ROOT,'evidence/latest-local.json'),JSON.stringify(record,null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
console.log('Isolated local evidence only. SDK/proof/billing in healing and native-protocol suites are CONTROLLED. Rebuild the evidence index after this run.');
