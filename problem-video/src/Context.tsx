import React from 'react';
import {interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,Headline,palette,appear,ease} from './shared';
export const Context=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();const sheets=[{name:'The brief',tag:'What needs doing',x:115,y:340,angle:-3},{name:'Company knowledge',tag:'What the business knows',x:725,y:380,angle:2},{name:'Past decisions',tag:'What was already agreed',x:1335,y:340,angle:-2}];return <Frame light>
 <Headline light size={102}>Your context is scattered.</Headline>
 {sheets.map((s,i)=><div key={s.name} style={{position:'absolute',left:s.x,top:s.y,width:465,height:390,padding:'42px 35px',background:'#fffdf8',border:'2px solid #d5d8ce',borderRadius:5,rotate:`${s.angle}deg`,opacity:appear(f,i*.7*fps),translate:`0 ${interpolate(f,[i*.7*fps,i*.7*fps+30],[45,0],ease)}px`}}><div style={{fontSize:37,fontWeight:600,letterSpacing:-1,lineHeight:1.2,height:95}}>{s.name}</div><div style={{fontSize:25,color:palette.soft,marginTop:15}}>{s.tag}</div>{[1,.76,.9].map((w,j)=><div key={j} style={{height:3,width:`${w*100}%`,background:'#d7dbd2',marginTop:30}}/>)}</div>)}
 <div style={{position:'absolute',left:110,bottom:105,fontSize:58,fontWeight:600,letterSpacing:-2,opacity:appear(f,3.4*fps)}}>Copy. Paste. Explain again.</div>
 </Frame>;};
