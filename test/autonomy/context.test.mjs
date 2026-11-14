import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {resolveEffectiveContext} from '../../src/autonomy/context.mjs';
import {evaluateTemplateChange} from '../../src/autonomy/evaluation.mjs';

test('fixed evaluator observes baseline failure, candidate repair and mandatory negative cases',()=>{
 const baseline={fields:[{name:'firstName',required:true},{name:'lastName',required:true}]};
 const candidate={fields:[...baseline.fields,{name:'middleName',required:true}]};
 const contract={id:'names-v1',companyId:'c',targetId:'c:names',requiredFields:['firstName','middleName','lastName']};
 const result=evaluateTemplateChange({baseline,candidate,contract});
 assert.equal(result.baseline.passed,false);assert.equal(result.candidate.passed,true);assert.equal(result.repaired,true);
 assert.equal(result.candidate.cases.length,4);assert.deepEqual(result.candidate.cases.map(c=>c.accepted),[true,false,false,false]);
 const destructive={fields:candidate.fields.filter(f=>f.name!=='lastName')};
 assert.equal(evaluateTemplateChange({baseline,candidate:destructive,contract}).repaired,false);
 assert.equal(evaluateTemplateChange({baseline,candidate:{fields:[...candidate.fields,candidate.fields[0]]},contract}).candidate.schemaValid,false);
 assert.notEqual(evaluateTemplateChange({baseline,candidate,contract:{...contract,requiredFields:['firstName']}}).testSetHash,result.testSetHash);
 for(const invalid of [baseline,{fields:candidate.fields.map(f=>({...f,required:false}))},{fields:[...candidate.fields,{name:'unexpectedRequired',required:true}]},{fields:[...candidate.fields,{name:'unsafe-name',required:false}]}]){
  assert.equal(evaluateTemplateChange({baseline,candidate:invalid,contract}).repaired,false);
 }
});

test('accepted instructions affect only the named profile and expose an immutable future-context revision link',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-instructions-')),journal=await createJournal({directory});
 t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 const agent={id:'manager',companyId:'c',version:1,instructions:'Original instructions',skillIds:[]};
 const before=resolveEffectiveContext({journal,catalog:[],companyId:'c',agent});
 const body={text:'Proposed owner-accepted company instructions'},revision={id:'accepted1',companyId:'c',targetId:'agent:manager',kind:'instructions',scope:'agent',agentId:'manager',body,hash:fingerprint(body)};
 await journal.transaction({actionId:'test-only-accepted-instructions',fingerprint:fingerprint(revision)},tx=>{tx.put('companyRevisions',revision.id,revision);tx.put('companyTargetHeads',revision.targetId,{companyId:'c',targetId:revision.targetId,revisionId:revision.id,version:1});});
 const after=resolveEffectiveContext({journal,catalog:[],companyId:'c',agent});
 assert.equal(before.instructions,'Original instructions');assert.equal(before.instructionRevision,null);
 assert.equal(after.instructions,body.text);assert.equal(after.untrusted,true);assert.equal(after.profileRevision,1);
 assert.deepEqual(after.instructionRevision,{targetId:'agent:manager',revisionId:'accepted1',hash:revision.hash});
 const other=resolveEffectiveContext({journal,catalog:[],companyId:'c',agent:{...agent,id:'other'}});
 assert.equal(other.instructions,agent.instructions);assert.equal(other.instructionRevision,null);
 assert.notEqual(after.contextHash,before.contextHash);
});

test('active heads change future context, prior snapshots remain immutable and catalog mutations fail closed',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cfn-context-'));const journal=await createJournal({directory});
 t.after(async()=>{await journal.close();await rm(directory,{recursive:true,force:true});});
 const agent={id:'a',companyId:'c',version:1,instructions:'Use evidence.',skillIds:['s'],resourceBindings:[]};
 const catalog=[{id:'s',kind:'skill',name:'Skill',version:'1',instructions:'Cite sources.'}];
 async function head(id,body,version){const revision={id,companyId:'c',targetId:'c:template',kind:'template',scope:'company',body,hash:fingerprint(body),version};await journal.transaction({actionId:id,fingerprint:fingerprint(revision)},tx=>{tx.put('companyRevisions',id,revision);tx.put('companyTargetHeads','c:template',{companyId:'c',targetId:'c:template',revisionId:id,version});});}
 await head('r1',{fields:[{name:'firstName',required:true}]},1);
 const before=resolveEffectiveContext({journal,catalog,companyId:'c',agent});
 await head('r2',{fields:[{name:'firstName',required:true},{name:'lastName',required:true}]},2);
 const after=resolveEffectiveContext({journal,catalog,companyId:'c',agent});
 assert.equal(before.templates[0].revisionId,'r1');assert.equal(before.templates[0].body.fields.length,1);
 assert.equal(after.templates[0].revisionId,'r2');assert.notEqual(before.contextHash,after.contextHash);
 const bound={...agent,resourceBindings:[{id:'s',version:'1',contentHash:fingerprint(catalog[0])}]};
 assert.throws(()=>resolveEffectiveContext({journal,catalog:[{...catalog[0],instructions:'Changed'}],companyId:'c',agent:bound}),{code:'CATALOG_REVISION_CHANGED'});
 assert.throws(()=>resolveEffectiveContext({journal,catalog,companyId:'other',agent}),{code:'COMPANY_SCOPE_MISMATCH'});
 const persona={id:'persona',kind:'soul',version:'1',instructions:'Independent guidance: ask what evidence is missing.'};
 const withPersona={...agent,skillIds:[],resourceBindings:[{id:persona.id,version:'1',contentHash:fingerprint(persona)}]};
 const frozen=resolveEffectiveContext({journal,catalog:[persona],companyId:'c',agent:withPersona});
 assert.equal(frozen.resources[0].instructions,persona.instructions);assert.equal(frozen.resources[0].untrusted,true);
 assert.throws(()=>resolveEffectiveContext({journal,catalog:[{...persona,instructions:'Changed guidance'}],companyId:'c',agent:withPersona}),{code:'CATALOG_REVISION_CHANGED'});
});
