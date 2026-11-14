import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Explicit test-only demonstration: never an app/provider composition default.
// Do not inherit NEAR keys, grants or any funded authorization from the shell.
const env={NEAR_CONTROLLED_TRACE:'1'};
for(const name of ['PATH','HOME','TMPDIR','JBRAIN_TEST_BINARY'])if(process.env[name])env[name]=process.env[name];
console.log('CONTROLLED DEMO: actual native JBrain, Rules, journal, Treasury and fixed evaluator; synthetic SDK output/proof/credit/billing. No live paid/provider effect.');
const child=spawn(process.execPath,['--test','--test-name-pattern=real pipeline: brief','test/autonomy/pipeline.test.mjs'],{cwd:root,env,stdio:'inherit'});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
