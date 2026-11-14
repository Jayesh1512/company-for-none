// Fictional onboarding content. Uses the same Rules-gated APIs as manual setup.
// No task, payment, funding, inference, credential or policy changes are made here.
export const demoOrganization={
  name:'Northstar Studio (Demo)',
  purpose:'Help small businesses turn market questions into sourced research, clear positioning and useful content. This is a fictional company for exploring the workspace.',
  industry:'Research & strategy',
};
export const demoProfiles=[
  {templateId:'market-researcher',name:'Scout · Demo',role:'Market research analyst',description:'Fictional demo profile. Finds evidence, compares alternatives and flags uncertainty.',instructions:'You are Scout, the research analyst at fictional Northstar Studio. Investigate customer and market questions, cite dated public sources, separate evidence from assumptions, and identify what needs validation. Use shared company context as background, never as public evidence.',skillIds:['competitive-research','evidence-review']},
  {templateId:'launch-strategist',name:'Sage · Demo',role:'Strategy & positioning lead',description:'Fictional demo profile. Turns research into positioning hypotheses and launch experiments.',instructions:'You are Sage, the strategy lead at fictional Northstar Studio. Clarify the intended customer, their current alternative and our proposed advantage. Use Scout’s sourced findings when provided, label assumptions, and suggest a small reversible validation experiment. Do not imply automatic agent collaboration.',skillIds:['positioning-framework','evidence-review']},
  {templateId:'content-writer',name:'Quill · Demo',role:'Content & communications specialist',description:'Fictional demo profile. Explains findings clearly while preserving sources and caveats.',instructions:'You are Quill, the content specialist at fictional Northstar Studio. Write clear, practical material for small business owners. Preserve source citations and uncertainty. Use a calm, direct voice and never invent customer quotes, performance metrics or endorsements.',skillIds:['evidence-review','positioning-framework']},
];
export const demoDocument={title:'Northstar Studio · fictional company brief',visibility:'company',agentIds:[],body:`# Northstar Studio — fictional demo company

This document and its business details are fictional sample data.

## Purpose
Help small businesses make clearer market decisions through sourced research, positioning hypotheses and useful content.

## Audience and offer
Our sample audience is independent business owners exploring a new service. Our example offer is a short research brief that compares alternatives, explains uncertainty and proposes a validation step. We have no real customers, revenue or market results.

## Team
Scout investigates evidence. Sage develops positioning hypotheses. Quill communicates the findings. The owner assigns tasks; these profiles share the local fixture runner and do not automatically collaborate.

## Working principles
Use plain language. Cite sources and distinguish facts from assumptions. Treat this brief as private company background, not independent public evidence. Never invent statistics, testimonials or expert endorsements.

## Infrastructure
Payments, custody, Cloud funding and inference are simulated local fixtures. JBrain stores this shared document in the local company brain. No live credentials or real spending are enabled by demo setup.

## Example task
What evidence should an independent bookshop validate before launching a monthly reading subscription? Focus on audience needs, alternatives, uncertainty and a small experiment.
`};

export function hasDemoData(data){return !!data?.agents?.some(a=>a.description?.startsWith('Fictional demo profile.'));}

export async function loadDemo(api,{onProgress=()=>{}}={}){
  const setup=await api('/api/workspace/setup');
  // Fail before mutations if this is ever connected to a non-fixture runtime.
  if(setup.infrastructure.length!==4||setup.infrastructure.some(x=>x.mode!=='fixture'))throw Error('Demo setup requires the local fixture runtime. No changes were made.');
  onProgress('Filling organization…');
  const current=setup.organization;
  const details=Object.fromEntries(Object.entries(demoOrganization).map(([key,value])=>[key,current[key]?.trim()?current[key]:value]));
  if(Object.keys(details).some(key=>details[key]!==current[key]))await api('/api/workspace/organization',{method:'POST',body:{...details,version:current.version}});
  const agents=[];
  for(const profile of demoProfiles){
    onProgress(`Adding ${profile.name}…`);
    const result=await api('/api/agents',{method:'POST',body:profile,key:`onboarding-demo:v1:agent:${profile.templateId}`});
    agents.push(result.agent);
  }
  onProgress('Adding company knowledge…');
  const brain=await api('/api/knowledge');
  if(brain.status==='connected')await api('/api/knowledge/documents',{method:'POST',body:demoDocument,key:'onboarding-demo:v1:company-brief'});
  // Reviews stay explicit: sample content is not proof of setup approval.
  return {agentCount:agents.length,brainReady:brain.status==='connected'};
}
