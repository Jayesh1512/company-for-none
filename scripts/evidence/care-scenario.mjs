import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createJournal} from '../../src/journal/index.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {createWorkspace} from '../../src/workspace/index.mjs';
import {createCompanyKnowledge} from '../../src/knowledge/index.mjs';
import {createJBrainClient} from '../../src/knowledge/client.mjs';
import {createCustomerCare,readSupportFacts} from '../../src/support/index.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {startNativeJBrain} from '../../test/helpers/native-jbrain.mjs';
import {ROOT,hash,scanText} from './model.mjs';

const output=process.argv[2];
if(!/^evidence\/runs\/[a-zA-Z0-9_-]+\/care-scenario\.json$/.test(output??''))throw Error('ISOLATED_EVIDENCE_OUTPUT_REQUIRED');
const directory=await mkdtemp(path.join(os.tmpdir(),'near-care-evidence-'));
let journal,brain;
try{
 brain=await startNativeJBrain(path.join(directory,'brain'));
 let loopbackRequests=0;
 const client=createJBrainClient({url:brain.url,token:brain.token,fetch:(url,options)=>{
  if(new URL(url).origin!==new URL(brain.url).origin)throw Error('EXTERNAL_REQUEST_REJECTED');loopbackRequests++;return fetch(url,options);
 }});
 const companyId='evidence-care',owner={role:'owner',verified:true,companyId};let care;
 async function open(){
  journal=await createJournal({directory:path.join(directory,'company')});
  const rules=createRules({setupOnly:true,companyId,getSupportFacts:action=>readSupportFacts({journal,companyId,action})});
  const knowledge=createCompanyKnowledge({journal,rules,client,companyId});
  const workspace=createWorkspace({journal,rules,knowledge,companyId});
  care=createCustomerCare({journal,rules,workspace,knowledge,jbrainClient:client,companyId});
 }
 await open();await care.setupDemo(owner,'explicit-fictional-evidence-only');
 const service=care.catalog().services.find(s=>s.kind==='policy'),opened=await care.open({serviceId:service.id},'evidence-conversation');
 const question='What is the auto collision deductible?';
 const answer=await care.message(opened.conversation.id,{text:question},opened.accessToken,'evidence-question');
 assert.equal(answer.reply.reasonCode,'SUPPORT_POLICY_EXCERPTS');assert.equal(answer.aiEnabled,false);assert.ok(answer.reply.citations.length>0);
 const citations=[];
 for(const cite of answer.reply.citations){
  const source=await client.read(cite.documentId);
  assert.equal(source.revision,cite.revision);assert.equal(fingerprint(source.markdown),cite.hash);assert.ok(source.markdown.includes(cite.excerpt));
  citations.push({documentId:cite.documentId,title:cite.title,revision:cite.revision,canonicalMarkdownFingerprint:cite.hash,sourceMarkdownSha256:hash(Buffer.from(source.markdown)),excerpt:cite.excerpt,excerptSha256:hash(Buffer.from(cite.excerpt)),exactNativeSourceMatch:true});
 }
 const unknownQuestion='Quantum banana spaceship warranty';
 const escalated=await care.message(opened.conversation.id,{text:unknownQuestion},opened.accessToken,'evidence-no-match');
 assert.equal(escalated.reply.reasonCode,'SUPPORT_NO_MATCH_ESCALATED');assert.ok(care.ownerView(owner).tickets.some(t=>t.id===escalated.ticket.id));
 const count=journal.list('supportMessages').length;
 await journal.close();await open();
 const replay=await care.message(opened.conversation.id,{text:question},opened.accessToken,'evidence-question');
 assert.equal(replay.replayed,true);assert.deepEqual(replay.reply,answer.reply);assert.equal(journal.list('supportMessages').length,count);
 await assert.rejects(care.view(opened.conversation.id,'incorrect-token'),{code:'ACCESS_DENIED'});
 assert.equal(Object.keys(journal.snapshot().operations).length,0);assert.equal(journal.get('treasury','financial'),null);assert.equal(journal.list('orders').length,0);
 const record={schemaVersion:1,observedAt:new Date().toISOString(),trustScope:'LIVE_LOCAL',fictional:true,replyMode:'policy_lookup',aiEnabled:false,previewUsed:false,scenario:'actual native JBrain cited lookup -> no-match escalation -> owner inbox -> journal reopen/idempotent replay',question,questionSha256:hash(Buffer.from(question)),answer:{text:answer.reply.text,reasonCode:answer.reply.reasonCode,textSha256:hash(Buffer.from(answer.reply.text)),citations},escalation:{question:unknownQuestion,questionSha256:hash(Buffer.from(unknownQuestion)),reasonCode:escalated.reply.reasonCode,ticketId:escalated.ticket.id,ticketInActualOwnerInbox:true},journalReopened:true,replayCreatedNoMessages:true,wrongTokenDenied:true,nativeLoopbackRequests:loopbackRequests,providerOperations:0,orders:0,financialRecordCreated:false,paidCalls:0,publicChainTransactions:0,events:journal.events().map(e=>({sequence:e.sequence,type:e.type,at:e.at})),limitations:'Fictional insurance data; model-free local execution; no customer approval, model inference, settlement or funded service.'};
 const text=JSON.stringify(record,null,2)+'\n';if(scanText(text).length)throw Error('SCENARIO_REDACTION_REQUIRED');
 assert.ok(!text.includes(opened.accessToken));assert.ok(!text.includes(brain.token));
 await writeFile(path.join(ROOT,output),text);
 console.log(JSON.stringify({scenario:'native-care',scope:'LIVE_LOCAL',exactCitations:citations.length,ticketCreated:true,journalReopened:true,providerCalls:0}));
}finally{await journal?.close();await brain?.close();await rm(directory,{recursive:true,force:true});}
