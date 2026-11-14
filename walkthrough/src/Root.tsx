import React from 'react';
import {AbsoluteFill,Composition,Folder,Series,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
const ink='#222825',accent='#c64b2c',paper='#f1f3ef';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const Brand=()=> <div style={{display:'flex',alignItems:'center',gap:15,fontSize:30,fontWeight:650,letterSpacing:-1}}><span style={{display:'grid',placeItems:'center',width:46,height:46,background:ink,color:'white',borderRadius:10,fontSize:26}}>N</span><span>near<span style={{fontWeight:400,color:'#68716b'}}> / workspace</span></span></div>;
const DemoBadge=()=> <div style={{fontSize:19,fontWeight:600,letterSpacing:1.3,color:'#a63b22',background:'#f7e6dc',padding:'13px 19px',borderRadius:24}}>LOCAL DEMO · SIMULATED EXECUTION</div>;
export const Opening=()=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:paper,color:ink,fontFamily:'Arial, sans-serif',padding:'66px 88px'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><Brand/><DemoBadge/></div>
  <div style={{marginTop:185,opacity:interpolate(frame,[0,fps*.5],[0,1],clamp),translate:`0 ${interpolate(frame,[0,fps*.7],[24,0],clamp)}px`}}>
   <div style={{fontSize:26,color:accent,letterSpacing:3,fontWeight:600,marginBottom:32}}>PRODUCT WALKTHROUGH</div>
   <div style={{fontSize:108,lineHeight:1.04,letterSpacing:-5,fontWeight:600}}>Build your team.<br/>Give it a clear brief.</div>
   <div style={{fontSize:34,lineHeight:1.4,color:'#647067',marginTop:36}}>Create agents. Add skills. Discover services. Review the work.</div>
  </div>
  <div style={{position:'absolute',left:88,bottom:74,fontSize:23,color:'#6d756f'}}>Actual product footage · Edited for pace · No live funds or paid inference</div>
 </AbsoluteFill>;
};
type ChapterProps={src:string;step:string;eyebrow:string;title:string;description:string;caption:string};
export const Chapter=({src,step,eyebrow,title,description,caption}:ChapterProps)=>{
 const frame=useCurrentFrame();const {fps,durationInFrames}=useVideoConfig();
 return <AbsoluteFill style={{background:paper,color:ink,fontFamily:'Arial, sans-serif'}}>
  <div style={{position:'absolute',left:64,right:64,top:48,display:'flex',alignItems:'center',justifyContent:'space-between'}}><Brand/><DemoBadge/></div>
  <div style={{position:'absolute',left:64,top:222,width:270,opacity:interpolate(frame,[0,.35*fps],[0,1],clamp),translate:`0 ${interpolate(frame,[0,.4*fps],[15,0],clamp)}px`}}>
   <div style={{fontSize:76,color:accent,fontWeight:500,letterSpacing:-4,marginBottom:25}}>{step}<span style={{fontSize:24,color:'#8b938c',letterSpacing:0}}> / 06</span></div>
   <div style={{fontSize:18,letterSpacing:2,color:'#707a72',fontWeight:600,marginBottom:19}}>{eyebrow}</div>
   <div style={{fontSize:40,lineHeight:1.12,letterSpacing:-1.6,fontWeight:600,whiteSpace:'pre-line'}}>{title}</div>
   <div style={{fontSize:24,lineHeight:1.45,color:'#68736a',marginTop:27}}>{description}</div>
  </div>
  <div style={{position:'absolute',left:384,top:142,width:1472,height:828,borderRadius:13,overflow:'hidden',boxShadow:'0 18px 50px #26352b15',border:'1px solid #d7ddd6',background:'white'}}>
   <Video name="Recorded product interaction" src={staticFile(src)} muted premountFor={fps} style={{width:'100%',height:'100%'}}/>
  </div>
  <div style={{position:'absolute',left:384,bottom:49,fontSize:25,color:'#505d53',display:'flex',alignItems:'center',gap:14}}><span style={{width:7,height:7,borderRadius:7,background:accent}}/>{caption}</div>
  <div style={{position:'absolute',left:64,right:64,bottom:22,height:2,background:'#d8dfd7'}}><div style={{height:2,width:`${interpolate(frame,[0,durationInFrames],[0,100],clamp)}%`,background:accent}}/></div>
 </AbsoluteFill>;
};
export const Closing=()=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:ink,color:'#f5f7f2',fontFamily:'Arial, sans-serif',padding:'66px 88px'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:32,letterSpacing:-1}}>near / workspace</div><DemoBadge/></div>
  <div style={{marginTop:225,opacity:interpolate(frame,[0,.5*fps],[0,1],clamp)}}>
   <div style={{fontSize:104,lineHeight:1.08,letterSpacing:-5,fontWeight:600}}>Create. Equip. Assign.</div>
   <div style={{fontSize:38,color:'#b4c0b6',maxWidth:1300,lineHeight:1.4,marginTop:36}}>Your agents, reusable templates and skills,<br/>and focused services — in one workspace.</div>
   <div style={{fontSize:28,color:'#ed9b77',marginTop:65}}>Try the local workspace → 127.0.0.1:4173</div>
  </div>
  <div style={{position:'absolute',left:88,bottom:74,fontSize:23,color:'#a8b5ab'}}>Current execution uses controlled evidence, deterministic reports and simulated payments.</div>
 </AbsoluteFill>;
};
export const Walkthrough=()=>{
 const {fps}=useVideoConfig();
 return <Series>
  <Series.Sequence name="Introduction" durationInFrames={4*fps} premountFor={fps}><Opening/></Series.Sequence>
  <Series.Sequence name="01 · Agent roster" durationInFrames={5*fps} premountFor={fps}><Chapter src="recordings/agents.mp4" step="01" eyebrow="YOUR WORKSPACE" title={'Meet your\nagent team.'} description="See every agent, its role, skills and recent work." caption="Start with a clear view of the team you already have."/></Series.Sequence>
  <Series.Sequence name="02 · Discover a template" durationInFrames={8*fps} premountFor={fps}><Chapter src="recordings/marketplace.mp4" step="02" eyebrow="TEMPLATES" title={'Start with\na useful role.'} description="Browse the marketplace and choose a reusable agent template." caption="Templates prefill the role, working instructions and starter skills."/></Series.Sequence>
  <Series.Sequence name="02 · Create the agent" durationInFrames={8*fps} premountFor={fps}><Chapter src="recordings/create.mp4" step="02" eyebrow="CREATE AN AGENT" title={'Make the\nrole your own.'} description="Name the agent, refine its responsibility and review its skills." caption="Create Opportunity analyst from the Market researcher template."/></Series.Sequence>
  <Series.Sequence name="02 · Agent profile" durationInFrames={5*fps} premountFor={fps}><Chapter src="recordings/profile.mp4" step="02" eyebrow="AGENT PROFILE" title={'A home for\nevery agent.'} description="Keep the role, instructions, skills and assigned tasks together." caption="The new agent is saved in the workspace and ready for a task."/></Series.Sequence>
  <Series.Sequence name="03 · Add a reusable skill" durationInFrames={8*fps} premountFor={fps}><Chapter src="recordings/skill.mp4" step="03" eyebrow="REUSABLE SKILLS" title={'Add a sharper\nway to work.'} description="Choose a skill, select an agent and add the guidance to its profile." caption="Add Positioning framework to Opportunity analyst."/></Series.Sequence>
  <Series.Sequence name="04 · Choose a service" durationInFrames={5*fps} premountFor={fps}><Chapter src="recordings/service.mp4" step="04" eyebrow="FOCUSED SERVICES" title={'Choose a\nclear deliverable.'} description="Services define the scope, required inputs and expected output." caption="Assign the Market opportunity brief service to the new agent."/></Series.Sequence>
  <Series.Sequence name="04 · Write a brief" durationInFrames={5*fps} premountFor={fps}><Chapter src="recordings/brief.mp4" step="04" eyebrow="THE BRIEF" title={'Give the agent\na clear question.'} description="Describe the decision you need evidence for, then create the task." caption="A specific brief gives the task a clear purpose."/></Series.Sequence>
  <Series.Sequence name="05 · Approve and run" durationInFrames={6*fps} premountFor={fps}><Chapter src="recordings/approve.mp4" step="05" eyebrow="REVIEW & APPROVE" title={'You decide\nwhen it runs.'} description="Review the simulated price, then approve the bounded local workflow." caption="Approve & run collects evidence, generates the report and records the demo payout."/></Series.Sequence>
  <Series.Sequence name="05 · Read the private report" durationInFrames={11*fps} premountFor={fps}><Chapter src="recordings/report.mp4" step="05" eyebrow="REVIEW THE WORK" title={'Read the output.\nInspect the sources.'} description="The private report includes findings, implications, sources and uncertainty." caption="This report is explicitly labeled as deterministic fixture output."/></Series.Sequence>
  <Series.Sequence name="06 · Track tasks" durationInFrames={4*fps} premountFor={fps}><Chapter src="recordings/tasks.mp4" step="06" eyebrow="TASK HISTORY" title={'Keep the work\nin one place.'} description="Find completed tasks and see which agent owns each brief." caption="The completed service task stays linked to Opportunity analyst."/></Series.Sequence>
  <Series.Sequence name="06 · Public accounting" durationInFrames={5*fps} premountFor={fps}><Chapter src="recordings/ledger.mp4" step="06" eyebrow="PUBLIC LEDGER" title={'See what\nwas recorded.'} description="Review redacted accounting records while reports remain private." caption="Funding, inference usage and contributor payouts remain distinct accounting facts."/></Series.Sequence>
  <Series.Sequence name="Closing" durationInFrames={5*fps} premountFor={fps}><Closing/></Series.Sequence>
 </Series>;
};
export const RemotionRoot=()=> <>
 <Composition id="NearWalkthrough" component={Walkthrough} durationInFrames={2370} fps={30} width={1920} height={1080} defaultProps={{}}/>
 <Folder name="Scenes">
  <Composition id="Opening" component={Opening} durationInFrames={120} fps={30} width={1920} height={1080} defaultProps={{}}/>
  <Composition id="AgentRoster" component={Chapter} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{src:'recordings/agents.mp4',step:'01',eyebrow:'YOUR WORKSPACE',title:'Meet your\nagent team.',description:'See every agent, its role, skills and recent work.',caption:'Start with a clear view of the team you already have.'}}/>
  <Composition id="Closing" component={Closing} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{}}/>
 </Folder>
</>;
