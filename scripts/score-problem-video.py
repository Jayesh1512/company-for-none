"""Create an original understated score and mix the offline synthetic narration."""
import json, wave
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parents[1]
video=root/'problem-video'
meta=json.loads((video/'timings.json').read_text())
rate=48000
count=round(meta['durationSeconds']*rate)
mix=np.zeros((count,2),dtype=np.float64)

# Independently synthesized chords: no samples, songs or external assets.
chords=[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,60]]
for i,start in enumerate(np.arange(0,meta['durationSeconds'],8)):
    length=min(9,meta['durationSeconds']-start)
    t=np.arange(round(length*rate))/rate
    env=np.minimum(t/1.8,1)*np.minimum((length-t)/1.8,1)
    l=np.zeros(len(t)); r=l.copy()
    for note in chords[i%len(chords)]:
        hz=440*2**((note-69)/12)
        l+=(np.sin(2*np.pi*hz*t)+.16*np.sin(2*np.pi*2*hz*t))*.008*env
        r+=(np.sin(2*np.pi*(hz+.13)*t)+.16*np.sin(2*np.pi*2*hz*t))*.008*env
    at=round(start*rate);end=min(count,at+len(t))
    mix[at:end,0]+=l[:end-at];mix[at:end,1]+=r[:end-at]

for start in np.arange(.8,meta['durationSeconds']-1,.75):
    t=np.arange(round(.16*rate))/rate
    pulse=np.sin(2*np.pi*(100*t+8*(1-np.exp(-30*t))))*np.exp(-36*t)*np.minimum(t/.006,1)*.016
    at=round(start*rate);end=min(count,at+len(t));mix[at:end]+=pulse[:end-at,None]

for i,scene in enumerate(meta['scenes']):
    start=scene['from']/meta['fps'];at=round(start*rate)
    t=np.arange(round(.5*rate))/rate
    hz=[392,440,349.23,329.63][i%4]
    accent=(np.sin(2*np.pi*hz*t)+.35*np.sin(2*np.pi*hz*2*t))*np.exp(-9*t)*np.minimum(t/.012,1)*.018
    end=min(count,at+len(t));mix[at:end]+=accent[:end-at,None]
    with wave.open(str(video/'public'/scene['audio']),'rb') as f:
        assert f.getframerate()==rate and f.getnchannels()==1 and f.getsampwidth()==2
        voice=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
    rms=np.sqrt(np.mean(voice**2))
    voice*=min(.16/max(rms,1e-6),.72/max(abs(voice).max(),1e-6))
    at=round((scene['from']+scene['voiceFrom'])/meta['fps']*rate)
    end=min(count,at+len(voice));mix[at:end]+=voice[:end-at,None]

fade=np.minimum(np.arange(count)/rate/.1,1)*np.minimum((count-np.arange(count))/rate/.6,1)
mix*=fade[:,None]
assert abs(mix).max()<1
target=video/'public/audio/premaster.wav'
with wave.open(str(target),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate)
    f.writeframes((mix*32767).astype('<i2').tobytes())
print(json.dumps({'seconds':meta['durationSeconds'],'sampleRate':rate,'premasterPeak':float(abs(mix).max()),'originalScore':True,'syntheticNarrator':meta['voice']}))
