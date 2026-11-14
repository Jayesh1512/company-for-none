// Offline media preparation: installed macOS synthetic voice + original generated score.
// No project capture, provider request, credential, paid model or external media.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'problem-video');
const story=JSON.parse(await readFile(path.join(dir,'story.json'),'utf8'));
await mkdir(path.join(dir,'public/audio'),{recursive:true});
const timeline=[];let from=0;
for(const scene of story.scenes){
 const txt=path.join(dir,`public/audio/${scene.id}.txt`),aiff=path.join(dir,`public/audio/${scene.id}.aiff`),wav=path.join(dir,`public/audio/${scene.id}.wav`);
 await writeFile(txt,scene.narration+'\n');
 execFileSync('/usr/bin/say',['-v',story.voice,'-r',String(story.rate),'-f',txt,'-o',aiff]);
 execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',aiff,'-ar','48000','-ac','1',wav]);
 const seconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',wav],{encoding:'utf8'}).trim());
 const frames=Math.ceil((seconds+1.1)*story.fps);
 timeline.push({...scene,from,durationInFrames:frames,voiceSeconds:seconds,voiceFrom:Math.round(.45*story.fps),audio:`audio/${scene.id}.wav`});from+=frames;
}
const metadata={title:story.title,fps:story.fps,durationInFrames:from,durationSeconds:from/story.fps,voice:{engine:'macOS say',voice:story.voice,rate:story.rate,synthetic:true},scenes:timeline};
await writeFile(path.join(dir,'timings.json'),JSON.stringify(metadata,null,2)+'\n');
const captions=timeline.map(scene=>({text:scene.narration,startMs:(scene.from+scene.voiceFrom)/story.fps*1000,endMs:(scene.from+scene.voiceFrom)/story.fps*1000+scene.voiceSeconds*1000,timestampMs:null,confidence:null}));
await writeFile(path.join(dir,'captions.json'),JSON.stringify(captions,null,2)+'\n');
const stamp=ms=>{const t=Math.round(ms);return `${String(Math.floor(t/3600000)).padStart(2,'0')}:${String(Math.floor(t/60000)%60).padStart(2,'0')}:${String(Math.floor(t/1000)%60).padStart(2,'0')},${String(t%1000).padStart(3,'0')}`;};
await writeFile(path.join(root,'artifacts/agent-problem-statement.srt'),captions.map((c,i)=>`${i+1}\n${stamp(c.startMs)} --> ${stamp(c.endMs)}\n${c.text}\n`).join('\n'));
execFileSync('python3',[path.join(root,'scripts/score-problem-video.py')],{stdio:'inherit'});
execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',path.join(dir,'public/audio/premaster.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','48000','-c:a','pcm_s16le',path.join(dir,'public/audio/narration-score.wav')]);
console.log(JSON.stringify({durationSeconds:metadata.durationSeconds,frames:from,scenes:timeline.map(s=>({id:s.id,from:s.from,frames:s.durationInFrames,voiceSeconds:s.voiceSeconds}))},null,2));
