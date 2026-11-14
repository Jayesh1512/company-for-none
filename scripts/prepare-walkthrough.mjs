import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root='walkthrough/public/recordings';
const capture=JSON.parse(await readFile(`${root}/capture.json`,'utf8'));
const targets={agents:5,marketplace:8,create:8,profile:5,skill:8,service:5,brief:5,approve:6,report:11,tasks:4,ledger:5};
const chapters=[];
for(let i=0;i<capture.marks.length-1;i++){
 const mark=capture.marks[i],end=capture.marks[i+1].seconds,duration=end-mark.seconds,target=targets[mark.name];
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(mark.seconds),'-t',String(duration),'-i',`${root}/product-session.webm`,'-an','-vf',`setpts=${target/duration}*(PTS-STARTPTS),fps=30,tpad=stop_mode=clone:stop_duration=1`,'-t',String(target),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${root}/${mark.name}.mp4`],{stdio:'inherit'});
 if(result.status!==0)throw new Error(`Failed ${mark.name}`);
 chapters.push({name:mark.name,sourceStart:mark.seconds,sourceDuration:duration,editedDuration:target});
}
await writeFile(`${root}/edit.json`,JSON.stringify({chapters,changes:'Pauses retimed per chapter; no execution results fabricated.'},null,2)+'\n');
console.log('Prepared',chapters.length,'chapters');
