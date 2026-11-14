import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,palette,appear} from './shared';
export const Overhead=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Frame light>
 <div style={{position:'absolute',left:115,top:140,width:1680}}>{['More setup.','More copying.','More supervision.'].map((text,i)=><div key={text} style={{fontSize:118,fontWeight:600,lineHeight:1.33,letterSpacing:-5,color:palette.soft,opacity:appear(f,i*.85*fps)}}>{text}</div>)}</div>
 <div style={{position:'absolute',left:115,bottom:125,fontSize:91,fontWeight:650,letterSpacing:-3,color:palette.ink,opacity:appear(f,2.8*fps)}}>Less actual work.</div>
 </Frame>;};
