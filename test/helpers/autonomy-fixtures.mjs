// Controlled accepted-proposal port for LOCAL TESTS ONLY. This deliberately
// does not establish live inference, accepted SDK proof or financial evidence.
import {createJournal} from '../../src/journal/index.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {config,financial} from '../rules/fixtures.mjs';
import {catalog as baseCatalog} from '../../src/workspace/catalog.mjs';
import {readAutonomyFacts} from '../../src/autonomy/facts.mjs';
import {createAutonomy} from '../../src/autonomy/index.mjs';
import {createAutonomyWriter} from '../../src/autonomy/plans.mjs';
import {resolveEffectiveContext} from '../../src/autonomy/context.mjs';
import {fingerprint} from '../../src/contracts.mjs';

export const intent={maxAgents:8,maxOpenWork:16,maxDepth:4,maxSteps:48,maxCalls:24,maxCreations:12,maxInputBytes:524288,maxResultBytes:262144,maxRetries:3,allowedResourceKinds:['skill','soul'],allowedPatchKinds:['template.add_optional_field','template.require_field']};
export async function createControlledAutonomy({directory,propose,clock=()=>new Date('2026-11-14T00:00:00Z')}) {
 const companyId='controlled',journal=await createJournal({directory,clock}),catalog=baseCatalog.map(x=>({...x,version:x.version??'1'}));
 const policy=config();policy.autonomy=intent;
 const rules=createRules({config:policy,companyId,clock,getAutonomyFacts:()=>readAutonomyFacts({journal,catalog,companyId})});
 const apply=createAutonomyWriter({journal,rules,companyId});
 const owner={verifiedLocal:true,role:'owner',companyId};
 let calls=0;const requests=[];
 const internalWork={async execute(frame){
   calls++;
   const w=journal.get('agentWork',frame.workId),run=journal.get('agentRuns',frame.runId),agent=journal.get('agents',w.actorId);
   const context=resolveEffectiveContext({journal,catalog,companyId,agent});
   const captured={id:`${w.id}:${run.id}:${run.fence}`,companyId,workId:w.id,runId:run.id,fence:run.fence,profileRevision:agent.version,context,contextHash:context.contextHash};
   await journal.transaction({actionId:`test-only-context:${run.id}`,fingerprint:fingerprint(captured)},tx=>tx.put('internalContexts',captured.id,captured));
   const prepared=await apply({id:`test-only-request:${run.id}`,type:'agent_prepare',workId:w.id,runId:run.id,fence:run.fence},{financial:financial()});
   if(prepared.decision.status!=='allow')return prepared;
   const request=prepared.decision.plan.request;requests.push(structuredClone(request));
   // The test reasoner sees ONLY the exact real request, not the ambient journal.
   const commands=await propose({request:structuredClone(request)});
   // Explicit synthetic acceptance is isolated here. Product composition cannot
   // load this port; live M01 agent_result still demands durable SDK proof.
   await journal.transaction({actionId:`test-only-proposal:${run.id}`,fingerprint:fingerprint(commands)},tx=>{
     const latestWork=tx.get('agentWork',w.id),latestRun=tx.get('agentRuns',run.id);
     tx.put('agentRuns',run.id,{...latestRun,state:'accepted',acceptedCommands:commands,candidateHash:fingerprint({commands}),version:latestRun.version+1});
     tx.put('agentWork',w.id,{...latestWork,state:'accepted',context,providerStatus:'confirmed',costStatus:'actual',version:latestWork.version+1});
   });
   return {controlledTestOnly:true};
 },async reconcile(){throw Error('This controlled proposal port never submits provider operations.');}};
 const autonomy=createAutonomy({journal,rules,internalWork,companyId,clock});
 return {journal,rules,autonomy,apply,owner,catalog,companyId,requests,get calls(){return calls;},async close(){await autonomy.close();await journal.close();}};
}
