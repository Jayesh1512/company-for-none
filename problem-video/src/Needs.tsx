import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,palette,appear} from './shared';
export const Needs=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Frame>
 <div style={{position:'absolute',left:115,top:110,fontSize:46,lineHeight:1.35,color:palette.muted,opacity:appear(f)}}>For agents to work as a business:</div>
 <div style={{position:'absolute',left:115,top:290,width:1680}}>{['Shared context.','Clear responsibility.','Visible limits.'].map((text,i)=><div key={text} style={{display:'flex',alignItems:'center',gap:38,fontSize:105,lineHeight:1.35,fontWeight:600,letterSpacing:-4,marginBottom:35,opacity:appear(f,(.5+i*1.1)*fps)}}><span style={{width:22,height:22,borderRadius:22,background:palette.lime,flexShrink:0}}/>{text}</div>)}</div>
 </Frame>;};
