import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
async function discover(dir) { return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(entry=>entry.isDirectory()?discover(`${dir}/${entry.name}`):entry.name.endsWith('.test.mjs')?[`${dir}/${entry.name}`]:[]))).flat(); }
const files=(await discover('test')).sort();
if(!files.length)throw new Error('No tests discovered.');
const child=spawn(process.execPath,['--test',...files],{stdio:'inherit'});
child.on('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exitCode=code??1;});
