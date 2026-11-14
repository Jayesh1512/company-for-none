import React from 'react';
import {Composition,Folder,Series,staticFile,useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {OneJob} from './OneJob';
import {Toolchain} from './Toolchain';
import {Context} from './Context';
import {Coordinator} from './Coordinator';
import {Spend} from './Spend';
import {Overhead} from './Overhead';
import {Needs} from './Needs';
import {Outcome} from './Outcome';

// Original typography and vector diagrams only. No product images or footage.
export const AgentProblem=()=>{const {fps}=useVideoConfig();return <>
 <Audio name="Synthetic narration and original score" src={staticFile('audio/narration-score.wav')} premountFor={fps}/>
 <Series>
  <Series.Sequence name="One business task" durationInFrames={225} premountFor={fps}><OneJob/></Series.Sequence>
  <Series.Sequence name="The toolchain" durationInFrames={348} premountFor={fps}><Toolchain/></Series.Sequence>
  <Series.Sequence name="Scattered context" durationInFrames={254} premountFor={fps}><Context/></Series.Sequence>
  <Series.Sequence name="The human coordinator" durationInFrames={284} premountFor={fps}><Coordinator/></Series.Sequence>
  <Series.Sequence name="Spend and responsibility" durationInFrames={299} premountFor={fps}><Spend/></Series.Sequence>
  <Series.Sequence name="The hidden work" durationInFrames={230} premountFor={fps}><Overhead/></Series.Sequence>
  <Series.Sequence name="Business requirements" durationInFrames={243} premountFor={fps}><Needs/></Series.Sequence>
  <Series.Sequence name="The real goal" durationInFrames={171} premountFor={fps}><Outcome/></Series.Sequence>
 </Series>
 </>;};
export const ProblemRoot=()=> <>
 <Composition id="TheAgentProblem" component={AgentProblem} durationInFrames={2054} width={1920} height={1080} fps={30} defaultProps={{}}/>
 <Folder name="Problem-scenes">
  <Composition id="OneJob" component={OneJob} durationInFrames={225} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Toolchain" component={Toolchain} durationInFrames={348} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Context" component={Context} durationInFrames={254} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Coordinator" component={Coordinator} durationInFrames={284} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Spend" component={Spend} durationInFrames={299} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Overhead" component={Overhead} durationInFrames={230} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Needs" component={Needs} durationInFrames={243} width={1920} height={1080} fps={30} defaultProps={{}}/>
  <Composition id="Outcome" component={Outcome} durationInFrames={171} width={1920} height={1080} fps={30} defaultProps={{}}/>
 </Folder>
 </>;
