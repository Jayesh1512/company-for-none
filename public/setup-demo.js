import {AUTONOMY_INTENT} from './autonomy-intent.js';

// Explicit UI sample input only. No API calls, provider fixtures, saved records,
// permissions, funds or execution state are created by enabling Demo mode.
export const SETUP_DEMO_BRIEF=Object.freeze({
 name:'Northstar Studio (Demo)',
 purpose:'Help independent businesses make clearer market decisions through sourced research. This is a fictional company for exploring setup.',
 industry:'Research & strategy',
 customer:'Independent bookshops and small business owners',
 outcome:'Research briefs that separate evidence, assumptions and practical next steps',
 objective:'Identify what an independent bookshop should validate before offering a monthly reading subscription.',
});
export const SETUP_DEMO_KNOWLEDGE=Object.freeze({
 title:'Northstar Studio · fictional company brief',
 visibility:'company',
 body:'# Northstar Studio — fictional example\n\nThese company details are fictional. There are no real customers, revenue or results.\n\n## Purpose\nHelp independent bookshops assess market questions through sourced research.\n\n## Working approach\nThe manager coordinates approved work. The backlog tracks process gaps and requests evaluated improvements. Specialists can be requested when permitted. Cite dated sources and separate evidence from assumptions.\n\n## First objective\nAssess audience needs, alternatives and a small validation experiment for a monthly reading subscription.\n\n## Execution\nThis sample does not configure providers, credit, spending authority or accepted model-output proof. Saving it stores real local company knowledge; document grants and selected agent context still apply.\n',
});
export function setupDemoDraft(state,form={}){
 const company=state.autonomy?.company,organization=state.setup?.organization??state.data?.organization??{},draft=state.companySetupDraft??{};
 const brief={};for(const key of Object.keys(SETUP_DEMO_BRIEF)){
  const entered=draft.brief?.[key];
  brief[key]=[form[key],entered!==SETUP_DEMO_BRIEF[key]?entered:undefined,company?.brief?.[key],organization[key],entered,SETUP_DEMO_BRIEF[key]].find(v=>typeof v==='string'&&v.trim());
 }
 const intent={...AUTONOMY_INTENT,...company?.intent,...draft.intent};
 if(form.maxAgents!==undefined&&Number.isSafeInteger(Number(form.maxAgents))&&Number(form.maxAgents)>0)intent.maxAgents=Number(form.maxAgents);
 return {brief,intent};
}
