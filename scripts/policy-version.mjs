import {createRules} from '../src/rules/index.mjs';
import path from 'node:path';
const configPath=path.resolve(process.argv[2]??process.env.SHOP_CONFIG_PATH??'config.yaml');
const state=createRules({configPath}).snapshot();
if(!state.valid){console.error(state.error);process.exitCode=1;}
else console.log(JSON.stringify({mode:state.mode,policyVersion:state.policyVersion},null,2));
