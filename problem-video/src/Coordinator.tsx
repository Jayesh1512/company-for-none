import React from 'react';
import {interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,Headline,palette,appear,ease} from './shared';
export const Coordinator=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Frame>
 <Headline width={900} size={112}>You become<br/>the coordinator.</Headline>
 <div style={{position:'absolute',left:115,top:520,fontSize:42,lineHeight:1.65,color:palette.muted,opacity:appear(f,fps)}}>Different instructions.<br/>Missing sources.<br/>Conflicting answers.</div>
 <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
  <path d="M1440 500 Q1220 330 1120 370 M1440 500Q1650 300 1690 390 M1440 580Q1200 820 1120 780 M1440 580Q1680 840 1710 780" fill="none" stroke={palette.line} strokeWidth="3"/>
  <path d="M1150 370Q1110 650 1160 780 M1680 390Q1800 650 1680 780" fill="none" stroke={palette.coral} strokeWidth="2" strokeDasharray="8 14" opacity={appear(f,fps)}/>
  <circle cx={1280+Math.sin(f/20)*120} cy={425+Math.cos(f/20)*35} r="7" fill={palette.lime}/><circle cx={1575+Math.sin(f/18)*95} cy={720+Math.cos(f/18)*60} r="7" fill={palette.coral}/>
 </svg>
 <div style={{position:'absolute',left:1310,top:440,width:250,height:220,border:`2px solid ${palette.lime}`,borderRadius:110,background:palette.dark,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,opacity:appear(f)}}><svg width="70" height="75" viewBox="0 0 70 75"><circle cx="35" cy="20" r="15" fill="none" stroke={palette.paper} strokeWidth="3"/><path d="M8 70v-8c0-26 54-26 54 0v8" fill="none" stroke={palette.paper} strokeWidth="3"/></svg><span style={{fontSize:32}}>You</span></div>
 {[{x:1030,y:310,text:'Research'},{x:1580,y:320,text:'Strategy'},{x:1030,y:740,text:'Content'},{x:1580,y:740,text:'Review'}].map((n,i)=><div key={n.text} style={{position:'absolute',left:n.x,top:n.y,width:250,height:96,border:`1px solid ${palette.line}`,borderRadius:5,background:palette.dark,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,opacity:appear(f,.3*fps+i*8)}}>{n.text}</div>)}
 <div style={{position:'absolute',right:150,bottom:100,color:palette.coral,fontSize:31,opacity:appear(f,3*fps)}}>Every handoff comes back to you.</div>
 </Frame>;};
