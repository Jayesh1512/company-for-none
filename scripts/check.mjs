import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function scan(dir) { return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?scan(`${dir}/${e.name}`):/\.(mjs|js)$/.test(e.name)?[`${dir}/${e.name}`]:[]))).flat(); }
const files=['server.mjs',...await scan('src'),...await scan('public'),...await scan('scripts')];
for(const file of files) { const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'}); if(r.status) { process.stderr.write(r.stderr); process.exitCode=1; } }
if(!process.exitCode) console.log(`Syntax checked ${files.length} JavaScript files.`);
