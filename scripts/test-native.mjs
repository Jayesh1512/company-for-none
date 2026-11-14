import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const binary=process.env.JBRAIN_TEST_BINARY??path.resolve('.runtime/dependencies/jbrain/target/release/jbrain');
if(!existsSync(binary)){
  console.error('Required JBrain integration service is missing. Run npm run setup:jbrain or set JBRAIN_TEST_BINARY. This check cannot skip.');
  process.exitCode=1;
}else{
  const child=spawn(process.execPath,['--test','test/knowledge/jbrain.test.mjs'],{stdio:'inherit',env:{...process.env,JBRAIN_TEST_BINARY:binary}});
  child.on('exit',code=>{process.exitCode=code??1;});
}
