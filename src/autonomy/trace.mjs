import {explainBlock} from './blocks.mjs';

const TERMINAL=['completed','failed','cancelled','superseded'];
const BLOCKED=['blocked','waiting','proof_held','reconciling','unknown'];
/** Pure causal projection over an OWNER autonomy view (already filtered through M01's field
 * allowlists). It reads no journal, creates no record and never infers success from a boolean.
 * Ordering is the append-only event sequence; every link is an identifier carried by a record
 * or an event's causationId. Missing links are reported, not invented. */
export function buildLifecycleTrace(view){
 const events=[...(view.events??[])].sort((a,b)=>a.sequence-b.sequence);
 const work=new Map((view.work??[]).map(w=>[w.id,w])),agents=new Map((view.agents??[]).map(a=>[a.id,a]));
 const evaluations=new Map((view.evaluations??[]).map(e=>[e.id,e]));
 const ancestry=id=>{const chain=[];const seen=new Set();for(let w=work.get(id);w&&!seen.has(w.id);w=work.get(w.parentWorkId)){seen.add(w.id);chain.push({workId:w.id,actorId:w.actorId,kind:w.kind,topic:w.topic});}return chain.reverse();};
 const byImprovement=id=>events.filter(e=>e.data?.improvementId===id);
 const improvements=(view.improvements??[]).map(imp=>{
  const mine=byImprovement(imp.id),steps=[];
  const step=(kind,e,extra={})=>steps.push({kind,sequence:e?.sequence??null,at:e?.at??null,actorId:e?.data?.actorId??null,workId:e?.data?.workId??e?.data?.taskId??null,causationId:e?.data?.causationId??null,...extra});
  const gap=mine.find(e=>e.type==='gap.recorded');
  if(gap)step('gap_reported',gap,{failureCode:imp.failureCode,summary:gap.data.summary??imp.summary,origin:ancestry(gap.data.taskId??gap.data.workId)});
  const triage=work.get(`${imp.id}:triage`);
  if(triage)steps.push({kind:'backlog_triage',sequence:null,at:triage.createdAt??null,actorId:triage.actorId,workId:triage.id,state:triage.state});
  const developer=(view.work??[]).find(w=>w.kind==='developer'&&w.parentWorkId===`${imp.id}:triage`);
  if(developer)steps.push({kind:'developer_delegated',sequence:null,at:developer.createdAt??null,actorId:developer.actorId,workId:developer.id,state:developer.state});
  const proposed=mine.find(e=>e.type==='improvement.proposed'),owner=mine.find(e=>e.type==='improvement.owner_review_requested');
  if(proposed)step('candidate_proposed',proposed,{candidateRevisionId:imp.candidateRevisionId??null,candidateHash:imp.candidateHash??null});
  if(owner)step('owner_review_requested',owner,{reasonCode:'OWNER_REVIEW_REQUIRED'});
  const evaluated=mine.find(e=>e.type==='improvement.evaluated'),record=evaluations.get(imp.evaluationId)??(view.evaluations??[]).find(e=>e.improvementId===imp.id);
  if(evaluated||record){const o=record?.observation;step('fixed_evaluation',evaluated,{evaluationId:record?.id??imp.evaluationId??null,evaluatorVersion:o?.evaluatorVersion??null,evaluatorHash:o?.evaluatorHash??null,baselinePassed:o?.baseline?.passed??null,candidatePassed:o?.candidate?.passed??null,repaired:o?.repaired??null,preservesFields:o?.preservesFields??null});}
  const promoted=mine.find(e=>e.type==='improvement.promoted'),reviewed=mine.filter(e=>e.type==='improvement.owner_reviewed'||e.type==='improvement.owner_accepted');
  if(promoted)step('head_promoted',promoted,{priorRevision:promoted.data.priorRevision,newRevision:promoted.data.newRevision,revisionId:imp.promotedRevisionId??null});
  for(const e of reviewed)step(e.type==='improvement.owner_accepted'?'owner_accepted':'owner_reviewed',e,{decision:e.data.decision??null,revisionId:e.data.newRevision??e.data.revisionId??null});
  const accepted=reviewed.find(e=>e.type==='improvement.owner_accepted');
  const effectiveRevision=imp.promotedRevisionId??promoted?.data?.newRevision??accepted?.data?.newRevision??accepted?.data?.revisionId??null;
  const future=effectiveRevision?(view.work??[]).filter(w=>w.context?.templates?.some(t=>t.revisionId===effectiveRevision)||w.context?.instructionRevision?.revisionId===effectiveRevision).map(w=>({workId:w.id,actorId:w.actorId,kind:w.kind,state:w.state})):[];
  if(effectiveRevision)steps.push({kind:'future_context',sequence:null,at:null,revisionId:effectiveRevision,workItems:future,observed:future.length>0});
  const kinds=steps.map(s=>s.kind),required=['gap_reported','candidate_proposed','fixed_evaluation','head_promoted','future_context'];
  const missing=imp.state==='promoted'?required.filter(k=>!kinds.includes(k)||k==='future_context'&&!steps.find(x=>x.kind==='future_context')?.observed):[];
  return {improvementId:imp.id,targetId:imp.targetId,state:imp.state,failureCode:imp.failureCode,occurrences:imp.occurrences?.length??0,reasonCode:imp.reasonCode??null,steps,complete:imp.state==='promoted'&&missing.length===0,missing};
 });
 const ledger=new Map();
 for(const e of events.filter(e=>['agent.created','agent.started','agent.stopped','agent.updated'].includes(e.type))){
  const id=e.data?.actorId??e.data?.agentId;if(!id)continue;
  const row=ledger.get(id)??ledger.set(id,{agentId:id,name:agents.get(id)?.name??null,role:agents.get(id)?.autonomyRole??null,createdSequence:null,runs:[],updates:[]}).get(id);
  if(e.type==='agent.created')row.createdSequence=e.sequence;
  else if(e.type==='agent.updated')row.updates.push({sequence:e.sequence,reasonCode:e.data.reasonCode??null,revision:e.data.revision??null});
  else if(e.type==='agent.started')row.runs.push({runId:e.data.runId??null,workId:e.data.workId??null,startedSequence:e.sequence,causationId:e.data.causationId??null,stoppedSequence:null,stopReason:null});
  else{const open=[...row.runs].reverse().find(r=>r.runId===(e.data.runId??null)&&r.stoppedSequence===null);if(open){open.stoppedSequence=e.sequence;open.stopReason=e.data.reasonCode??null;open.remoteCancelled=e.data.remoteCancelled===true;}}
 }
 const blockers=(view.work??[]).filter(w=>!TERMINAL.includes(w.state)&&BLOCKED.includes(w.state)&&w.reasonCode).map(w=>({workId:w.id,actorId:w.actorId,kind:w.kind,state:w.state,...explainBlock(w.reasonCode)}));
 const rejected=events.filter(e=>e.type==='command.rejected').map(e=>({sequence:e.sequence,commandId:e.data.causationId??null,workId:e.data.workId??null,...explainBlock(e.data.reasonCode)}));
 // Delegation lineage: who started whom, resolved to readable identities locally.
 // On chain these identities are hashed commitments, not raw ids or names.
 const delegations=events.filter(e=>e.type==='agent.delegated').map(e=>({
  sequence:e.sequence,
  parentAgentId:e.data.parentAgentId??null,
  parentName:e.data.parentName??agents.get(e.data.parentAgentId)?.name??null,
  parentRole:e.data.parentRole??agents.get(e.data.parentAgentId)?.autonomyRole??null,
  childAgentId:e.data.childAgentId??null,
  childName:e.data.childName??agents.get(e.data.childAgentId)?.name??null,
  childRole:e.data.childRole??null,
  kind:e.data.kind??null,topic:e.data.topic??null,
  workId:e.data.workId??null,parentWorkId:e.data.parentWorkId??null,objectiveId:e.data.objectiveId??null,
  reused:e.data.reused===true,
 }));
 const spendEvents=events.filter(e=>['spend.requested','spend.completed','spend.refused'].includes(e.type)).map(e=>({
  sequence:e.sequence,type:e.type,agentId:e.data.actorId??null,asset:e.data.asset??null,amount:e.data.amount??null,
  purpose:e.data.purpose??null,txHash:e.data.txHash??null,reasonCode:e.data.reasonCode??null,
 }));
 return {improvements,agents:[...ledger.values()],delegations,spendEvents,blockers,rejectedCommands:rejected,
  causalOrder:improvements.every(i=>{const s=i.steps.filter(x=>x.sequence!==null).map(x=>x.sequence);return s.every((n,k)=>k===0||n>=s[k-1]);})};
}
