import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createControlledAutonomy,intent} from '../helpers/autonomy-fixtures.mjs';
import {resolveEffectiveContext} from '../../src/autonomy/context.mjs';
import {config} from '../rules/fixtures.mjs';

test('controlled manager → specialist → backlog → developer → fixed evaluator loop changes future company context',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-loop-'));let now=Date.parse('2026-11-14T00:00:00Z');
 let f=await createControlledAutonomy({directory,clock:()=>new Date(now),propose:({request})=>{
   const envelope=JSON.parse(request.messages.find(m=>m.role==='user').content);
   const {role,dependencies,context,targets,improvement,catalog,commandSchema}=envelope;
   assert.ok(commandSchema);assert.equal(envelope.companyBrief.customer,'Fictional customers');
   const target=targets[0];assert.ok(target.contract.requiredFields.includes('middleName'));
   if(role==='manager'){
     if(!dependencies.some(w=>w.kind==='specialist'))return [{type:'delegate',kind:'specialist',role:'Document executive',topic:'Inspect a fictional document-name schema',instructions:'Report missing required template fields.',targetId:target.targetId}];
     const service=catalog.find(c=>c.kind==='service');assert.ok(dependencies.some(w=>w.deliverable));
     return [{type:'propose_service',baseListingId:service.id,title:'A sourced market brief',inputs:'A market question',deliverable:'A private evidence-backed brief'},{type:'complete_work',summary:'The fictional template gap is fixed.',deliverable:'An evaluated template revision'}];
   }
   if(role==='specialist'){
     if(!context.skills.length)return [{type:'request_resource',listingId:catalog.find(c=>c.id==='evidence-review').id,version:'1'}];
     return [{type:'report_gap',targetId:target.targetId,failureCode:'MISSING_MIDDLE_NAME',summary:'The fictional contract requires a middle-name field.'},{type:'complete_work',summary:'Reported schema gap',deliverable:'A recorded gap and its target revision'}];
   }
   if(role==='backlog'){
     assert.ok(improvement.id);if(improvement.state==='open')assert.equal(improvement.baseRevision,target.baseRevision);
     if(!dependencies.some(w=>w.kind==='developer'))return [{type:'delegate',kind:'developer',role:'Template developer',topic:'Repair the missing field in the registered template',instructions:'Propose an additive field patch; do not change tests.',targetId:target.targetId,improvementId:improvement.id}];
     return [{type:'complete_work',summary:'Fix validated',deliverable:'A fixed-test evaluation and promoted revision'}];
   }
   assert.ok(improvement.id);
   if(improvement.state==='open'){const missing=target.contract.requiredFields.find(name=>!target.baseline.fields.some(f=>f.name===name));return [{type:'propose_patch',improvementId:improvement.id,targetId:target.targetId,baseRevision:target.baseRevision,operations:[{type:'add_field',name:missing,required:true}]}];}
   return [{type:'complete_work',summary:'Candidate evaluated',deliverable:'An additive template fix'}];
 }});
 // The exact command JSON schema and current context are counted in the request byte
 // bound. This scenario needs room for its final manager draft plus child deliverables.
 const policy=config();policy.autonomy=intent;policy.research.maxInputTokens=40000;f.rules.updateConfig(policy);
 t.after(async()=>{await f.close();await rm(directory,{recursive:true,force:true});});
 const brief={name:'Fictional schema company',purpose:'Test the controlled improvement loop.',industry:'Test only',customer:'Fictional customers',outcome:'Repair one template schema gap',objective:'Review the name template and address its gap'};
 await f.autonomy.configure({version:0,operatingMode:'none',brief,intent},f.owner,'config');
 await f.autonomy.registerTemplate({name:'Fictional names',fields:[{name:'firstName',required:true},{name:'lastName',required:true}],requiredFields:['firstName','middleName','lastName']},f.owner,'template');
 await f.autonomy.bootstrap({version:1},f.owner,'bootstrap');
 const before=resolveEffectiveContext({journal:f.journal,catalog:f.catalog,companyId:f.companyId,agent:f.journal.get('agents','controlled:manager')});
 await f.autonomy.control({version:2,operation:'start'},f.owner,'start');
 const outcomes=[];
 for(let i=0;i<60;i++){
   now+=1000;outcomes.push(await f.autonomy.tick());
   if(f.journal.get('autonomousCompanies','controlled').state==='completed')break;
 }
 const improvements=f.journal.list('improvements');
 assert.equal(improvements[0]?.state,'promoted',JSON.stringify({outcomes:outcomes.map(o=>o.decision?.reasonCode??o.progressed??'controlled'),work:f.journal.list('agentWork').map(({kind,state,reasonCode})=>({kind,state,reasonCode}))}));
 const evaluation=f.journal.list('improvementEvaluations')[0];assert.equal(evaluation.source,'fixed-evaluator');assert.equal(evaluation.observation.baseline.passed,false);assert.equal(evaluation.observation.candidate.passed,true);
 const after=resolveEffectiveContext({journal:f.journal,catalog:f.catalog,companyId:f.companyId,agent:f.journal.get('agents','controlled:manager')});
 assert.equal(before.templates[0].body.fields.length,2);assert.equal(after.templates[0].body.fields.length,3);assert.notEqual(before.contextHash,after.contextHash);
 assert.equal(f.journal.list('resourceRequests')[0]?.state,'installed');
 assert.equal(f.journal.list('serviceDrafts')[0]?.reasonCode,'AUTONOMOUS_PUBLICATION_UNAVAILABLE',JSON.stringify({outcomes:outcomes.map(o=>o.decision?.reasonCode??o.progressed??'controlled'),work:f.journal.list('agentWork').map(({kind,state,reasonCode,logicalStep})=>({kind,state,reasonCode,logicalStep})),company:f.journal.get('autonomousCompanies','controlled').state}));
 assert.equal(f.journal.get('autonomousCompanies','controlled').state,'completed',JSON.stringify(outcomes.slice(-5).map(o=>o.decision?.reasonCode??o.progressed)));
 assert.equal(f.journal.list('agents').length,4);assert.equal(f.journal.list('orders').length,0);assert.equal(Object.keys(f.journal.snapshot().operations).length,0);
 const events=f.journal.events();assert.equal(events.filter(e=>e.type==='improvement.promoted').length,1);assert.ok(events.some(e=>e.type==='agent.started'));
 assert.ok(f.calls<=intent.maxCalls);
 const root=f.journal.get('agentWork','controlled:objective:1:root');assert.equal(root.context.templates[0].revisionId,after.templates[0].revisionId);
 const eventCount=events.length,headId=f.journal.list('companyTargetHeads')[0].revisionId;
 await f.close();f=await createControlledAutonomy({directory,clock:()=>new Date(now),propose:()=>{throw Error('Completed company must not start another run.');}});
 await f.autonomy.tick();assert.equal(f.calls,0);assert.equal(f.journal.events().length,eventCount);assert.equal(f.journal.list('companyTargetHeads')[0].revisionId,headId);

});
