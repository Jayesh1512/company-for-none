import React from 'react';
import {interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,Headline,palette,appear,ease} from './shared';
export const OneJob=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Frame light>
 <Headline light size={132} width={1170}>You wanted<br/>one job done.</Headline>
 <div style={{position:'absolute',left:120,top:520,fontSize:44,lineHeight:1.55,color:palette.soft,opacity:appear(f,.8*fps)}}>Research a market.<br/>Prepare a launch.<br/>Move the business forward.</div>
 <div style={{position:'absolute',left:1330,top:245,width:385,height:505,background:'#fffdf8',border:'2px solid #d3d7cd',borderRadius:8,rotate:`${interpolate(f,[0,45],[-8,-3],ease)}deg`,translate:`0 ${interpolate(f,[0,45],[70,0],ease)}px`,opacity:appear(f,8)}}>
  <svg width="120" height="120" viewBox="0 0 120 120" style={{position:'absolute',left:42,top:45}}><circle cx="60" cy="60" r="48" fill={palette.lime}/><path d="M35 60l16 17 34-35" fill="none" stroke={palette.ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  <div style={{position:'absolute',left:47,top:210,width:280,fontSize:45,fontWeight:600,lineHeight:1.2,letterSpacing:-1.5}}>One clear<br/>business task.</div>
  <div style={{position:'absolute',left:47,top:385,width:245,height:2,background:'#d3d7cd'}}/>
 </div>
 <div style={{position:'absolute',left:120,bottom:110,fontSize:31,color:palette.soft,opacity:appear(f,2.2*fps)}}>A brief in. A useful result out.</div>
 </Frame>;};
