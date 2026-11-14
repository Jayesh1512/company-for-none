import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,Headline,palette,appear} from './shared';
export const Spend=()=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Frame>
 <Headline size={102}>A useful answer<br/>is only half the job.</Headline>
 <div style={{position:'absolute',left:170,top:485,width:420,height:390,opacity:appear(f,fps)}}><svg width="420" height="390" viewBox="0 0 420 390"><circle cx="210" cy="170" r="142" fill="none" stroke={palette.line} strokeWidth="2"/><circle cx="210" cy="170" r="113" fill="none" stroke={palette.lime} strokeWidth="3"/><path d="M210 92v156M255 115c-44-34-105-15-100 21 4 36 108 23 107 62-1 40-69 55-111 16" fill="none" stroke={palette.paper} strokeWidth="4" strokeLinecap="round"/><path d="M20 340h380" stroke={palette.line} strokeWidth="2"/></svg></div>
 <div style={{position:'absolute',left:790,top:450,width:980}}>{['Which service was paid?','What did inference cost?','Who approved the spend?','Can you trace the payment?'].map((text,i)=><div key={text} style={{fontSize:46,lineHeight:1.2,letterSpacing:-1.4,padding:'22px 0',borderBottom:`1px solid ${palette.line}`,opacity:appear(f,(.4+i*1.2)*fps),color:i===2?palette.lime:palette.paper}}>{text}</div>)}</div>
 </Frame>;};
