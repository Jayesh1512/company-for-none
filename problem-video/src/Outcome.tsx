import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,palette,appear} from './shared';
export const Outcome=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Frame light>
 <div style={{position:'absolute',left:115,top:205,width:1690,fontSize:112,fontWeight:600,lineHeight:1.2,letterSpacing:-5,opacity:appear(f)}}><span style={{color:palette.soft}}>Less tool management.</span><br/><span style={{color:palette.ink}}>More work that matters.</span></div>
 <div style={{position:'absolute',left:120,top:660,width:1470,fontSize:42,lineHeight:1.45,color:palette.soft,opacity:appear(f,1.6*fps)}}>You wanted to delegate the work.<br/>Not become the integration layer.</div>
 <div style={{position:'absolute',left:120,bottom:105,width:90,height:8,background:palette.ink,opacity:appear(f,2.4*fps)}}/>
 </Frame>;};
