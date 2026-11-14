import {mkdtemp,rm} from 'node:fs/promises';
import {createJournal} from '../../src/journal/index.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createAutonomyWriter} from '../../src/autonomy/plans.mjs';
import {resolveEffectiveContext} from '../../src/autonomy/context.mjs';
import {config,NOW} from './fixtures.mjs';
import {sdkFinding} from './verification-fixtures.mjs';

export const INTENT={maxAgents:6,maxOpenWork:12,maxDepth:3,maxSteps:24,maxCalls:12,maxCreations:10,maxInputBytes:262144,maxResultBytes:131072,maxRetries:2,allowedResourceKinds:['skill','soul'],allowedPatchKinds:['template.add_optional_field','template.require_field']};
export const BRIEF={name:'Controlled company',purpose:'Exercise bounded local decisions',industry:'Testing',customer:'Test reader',outcome:'Documented local behavior',objective:'Produce one reviewed test deliverable'};
export async function autonomyFixture(t,{setup=false,policy=true,live=false}={}){
 const directory=await mkdtemp('/tmp/near-rules-autonomy-'),journal=await createJournal({directory});t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 const companyId='autonomy-test',access={verified:true,role:'owner',companyId},c=config();if(live)c.mode='live';if(policy)c.autonomy=structuredClone(INTENT);
 const catalog=[{id:'free-skill',kind:'skill',version:'1',instructions:'Check sources and cite evidence.'},{id:'paid-skill',kind:'skill',version:'1',purchaseRequired:true},{id:'known-service',kind:'service',version:'1',name:'Known static service'}],runtime={verificationResults:[]};let clock=NOW,n=0;
 const namespaces={objectives:'companyObjectives',agents:'agents',work:'agentWork',runs:'agentRuns',improvements:'improvements',heads:'companyTargetHeads',revisions:'companyRevisions',contracts:'companyTemplateContracts',evaluations:'improvementEvaluations',resourceRequests:'resourceRequests',serviceDrafts:'serviceDrafts',contexts:'internalContexts',internalResults:'internalResults',documents:'companyKnowledgeDocuments'};
 namespaces.preparationFailures='internalPreparationFailures';
 const getFacts=()=>({company:journal.get('autonomousCompanies',companyId),...Object.fromEntries(Object.entries(namespaces).map(([k,ns])=>[k,journal.list(ns)])),catalog,operations:Object.values(journal.snapshot().operations),financial:journal.get('treasury','financial')});
 let agentAuthorization=null;
 const bounds={status:'verified',model:c.research.model,reference:'controlled-bound-observation',validUntil:new Date(NOW+3600000).toISOString(),completionTokensIncludeReasoning:true,inputNanoUsdPerMillionTokens:'1000',outputNanoUsdPerMillionTokens:'1000'};
 const rules=createRules({...setup?{setupOnly:true}:{config:c},companyId,clock:()=>clock,getAutonomyFacts:getFacts,getRuntimeFacts:()=>runtime,getAgentAuthorization:()=>agentAuthorization,getInferenceBounds:()=>bounds});
 const apply=createAutonomyWriter({journal,rules,companyId});
 const owner=async(type,input,key=`test:${++n}`)=>apply({id:key,type},{access,input},{allowHold:true});
 const bootstrap=async()=>{await owner('autonomy_configure',{version:0,operatingMode:'none',brief:BRIEF,intent:INTENT});await owner('autonomy_bootstrap',{version:getFacts().company.version});return owner('autonomy_control',{version:getFacts().company.version,operation:'start'});};
 const claim=async id=>{const w=journal.get('agentWork',id);return apply({id:`claim:${id}:${w.version}`,type:'autonomy_claim',workId:id},{},{allowHold:true});};
 const write=async(ns,value)=>journal.transaction({actionId:`fixture-fact:${++n}`,fingerprint:`fixture:${n}`},tx=>tx.put(ns,value.id??value.targetId,value));
 const prepare=async(workId)=>{
  let w=journal.get('agentWork',workId),run=journal.get('agentRuns',w.lease.runId),agent=journal.get('agents',w.actorId),frame={workId,runId:run.id,fence:run.fence};
  const context=resolveEffectiveContext({journal,catalog,companyId,agent});await write('internalContexts',{id:`${workId}:${run.id}`,companyId,workId,runId:run.id,fence:run.fence,profileRevision:agent.version,contextHash:context.contextHash,context});
  return apply({id:`prepare:${workId}:${run.fence}`,type:'agent_prepare',...frame},{},{allowHold:true});
 };
 const accept=async(workId,commands)=>{
  let w=journal.get('agentWork',workId),run=journal.get('agentRuns',w.lease.runId),frame={workId,runId:run.id,fence:run.fence};
  const prepared=await prepare(workId);if(prepared.decision.status!=='allow')return prepared;
  w=journal.get('agentWork',workId);const output=JSON.stringify({commands}),result={status:'confirmed',mode:'fixture',cost:{status:'actual',actualCostNanoUsd:'0'},generation:{output}};
  const before=sdkFinding(w.request),after=sdkFinding(w.request,'response',output);before.id=`${workId}:pre`;after.id=`${workId}:response`;runtime.verificationResults.push(before,after);
  const id=`${w.effectId}:result`;await write('internalResults',{id,companyId,workId,effectId:w.effectId,requestFingerprint:w.requestFingerprint,runId:run.id,fence:run.fence,result});
  return apply({id:`accept:${workId}:${run.fence}`,type:'agent_result',...frame,resultId:id},{},{allowHold:true});
 };
 const command=async(workId,index)=>{const w=journal.get('agentWork',workId),runId=w.lease?.runId;return apply({id:`${workId}:${w.logicalStep}:command:${index}`,type:'autonomy_command',workId,runId,fence:w.lease?.fence,commandIndex:index},{},{allowHold:true});};
 return {journal,rules,c,bounds,companyId,access,catalog,runtime,getFacts,apply,owner,bootstrap,claim,prepare,accept,command,write,setTime:t=>clock=t,setAgentAuthorization:a=>agentAuthorization=a};
}
