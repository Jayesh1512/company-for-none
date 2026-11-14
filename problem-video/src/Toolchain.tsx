import React from 'react';
import {interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,Headline,palette,appear,ease} from './shared';
export const Toolchain=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();const nodes=[{label:'Inference',x:170,y:365},{label:'Company knowledge',x:740,y:345},{label:'Skills',x:1350,y:365},{label:'Working principles',x:170,y:735},{label:'External services',x:740,y:765},{label:'Payments & wallets',x:1350,y:735}];return <Frame>
 <Headline size={101}>First, connect everything.</Headline>
 <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>{nodes.map((n,i)=><path key={n.label} d={`M960 600 Q${n.x+230} 600 ${n.x+190} ${n.y+50}`} fill="none" stroke={palette.line} strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1-interpolate(f,[i*.6*fps,i*.6*fps+30],[0,1],ease)}/>)}</svg>
 <div style={{position:'absolute',left:859,top:500,width:202,height:202,borderRadius:202,border:`2px solid ${palette.lime}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:42,fontWeight:500,background:palette.dark,opacity:appear(f)}}>Your task</div>
 {nodes.map((n,i)=><div key={n.label} style={{position:'absolute',left:n.x,top:n.y,width:400,height:110,border:`1px solid ${palette.line}`,background:palette.dark,borderRadius:6,display:'flex',alignItems:'center',padding:'0 26px',gap:16,opacity:appear(f,i*.6*fps),translate:`0 ${interpolate(f,[i*.6*fps,i*.6*fps+28],[22,0],ease)}px`}}><span style={{height:10,width:10,borderRadius:10,background:palette.lime,flexShrink:0}}/><span style={{fontSize:n.label.length>16?31:36,fontWeight:500,letterSpacing:-.6}}>{n.label}</span></div>)}
 <div style={{position:'absolute',left:110,bottom:95,color:palette.muted,fontSize:32,opacity:appear(f,4*fps)}}>Before the real work has even started.</div>
 </Frame>;};
