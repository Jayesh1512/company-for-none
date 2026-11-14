import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createApp} from '../../src/app.mjs';
import {startNativeJBrain} from '../helpers/native-jbrain.mjs';
import {createJBrainClient} from '../../src/knowledge/client.mjs';
import {sdkFinding} from '../rules/verification-fixtures.mjs';
import {verificationSpec,verifyInferenceEvidence,plaintextHash} from '../../src/rules/verification.mjs';
import {AI_DEMO_POLICY} from '../../src/rules/ai-demo.mjs';
import {aiDemoDecision} from '../../src/rules/ai-demo.mjs';
import {readAiDemoFacts} from '../../src/demo/ai.mjs';
import {fingerprint} from '../../src/contracts.mjs';
import {NOW,config} from '../rules/fixtures.mjs';

test('explicit live-call policy accepts original SDK/decryption only; strict default and recovery stay closed',()=>{
 const c=config(),request={model:'test/model',verificationSpec:verificationSpec(AI_DEMO_POLICY)},output='actual process output';
 const before=sdkFinding(request),response={...sdkFinding(request,'response',output),plaintextBindingStatus:'verified',durableReplayStatus:'unavailable',processVerificationStatus:'verified',acceptanceScope:'live-process-e2ee'};
 const runtime={verificationResults:[before,response]},args={request,requestFingerprint:fingerprint(request),output};
 assert.equal(verifyInferenceEvidence('response',args,runtime,AI_DEMO_POLICY,NOW).status,'allow');
 response.acceptanceScope='recorded-wire';assert.equal(verifyInferenceEvidence('response',args,runtime,AI_DEMO_POLICY,NOW).status,'hold');response.acceptanceScope='live-process-e2ee';
 response.processVerificationStatus='unavailable';assert.equal(verifyInferenceEvidence('response',args,runtime,AI_DEMO_POLICY,NOW).status,'hold');response.processVerificationStatus='verified';
 assert.equal(verifyInferenceEvidence('response',{...args,output:output+'tamper'},runtime,AI_DEMO_POLICY,NOW).status,'hold');
 assert.equal(verifyInferenceEvidence('response',args,runtime,c,NOW).reasonCode,'VERIFICATION_SPEC_REQUIRED');
});

test('controlled provider + ACTUAL native JBrain / M01 / M03: reply, escalation, caps, revocation, unknown and restart',async t=>{
 const directory=await mkdtemp('/tmp/near-real-ai-demo-'),brain=await startNativeJBrain(directory+'/brain'),client=createJBrainClient({url:brain.url,token:brain.token});
 const companyId='ai-demo-test',owner={verified:true,role:'owner',companyId},credential='CONTROLLED_TEST_KEY';
 let now=NOW,sends=0,behavior='answer',app,grant={id:'explicit-test-authority',enabled:true,companyId,kind:'owner-funded-e2ee-demo',responseAcceptance:'live-verified-hold-on-loss',maxTotalNanoUsd:'5000000000',credentialHash:createHash('sha256').update(credential).digest('hex'),expiresAt:new Date(NOW+3600000).toISOString()};
 const options={directory:directory+'/journal',configPath:null,companyId,clock:()=>now,jbrainClient:client,ownerToken:'TEST_OWNER',totalCeilingNanoUsd:'5000000000',getAiDemoAuthorization:()=>grant,resolveSecret:async()=>credential,
  aiDemoReadProvider:async({path})=>{if(path!=='/models')throw Error('No billed receipt in controlled test');return {data:{data:[{id:'Qwen/Qwen3.8-27B',context_length:262144,max_output_length:65536,pricing:{request:'0',prompt:'0.00000004',completion:'0.00000135'}}]},raw:{bodyHash:'controlled-price',bodyBase64:'',httpStatus:200}};},
  loadCloudVerification:async()=>({createCloudVerification:()=>({prepare:async({request,action})=>{
   const preflight={...sdkFinding(request),id:action.id+':preflight'};const send=async()=>{
    sends++;if(behavior==='unknown')return {status:'unknown',cost:{status:'pending'}};
    if(behavior==='pause')await app.aiDemo.control(owner,{operation:'pause'});
    if(behavior==='revoke'){const d=app.journal.list('companyKnowledgeDocuments')[0];await app.journal.transaction({actionId:'test-revocation',fingerprint:'test-revocation'},tx=>{tx.put('companyKnowledgeDocuments',d.id,{...d,agentIds:[],version:d.version+1});return null;});}
    const doc=app.journal.list('companyKnowledgeDocuments')[0],source=await client.read(doc.id),quote=source.markdown.split('\n').find(s=>s.includes('500 demo dollars'));
    const output=JSON.stringify({answer:behavior==='escalate'?'A human owner must review this claim.':'Your fictional auto policy lists a deductible of 500 demo dollars per collision incident.',citations:behavior==='escalate'?[]:[{id:doc.id,quote:behavior==='bad-citation'?'Invented excerpt':quote}],escalate:behavior==='escalate',reason:''});
    const proof={...sdkFinding(request,'response',output),id:action.id+':response',processVerificationStatus:'verified',acceptanceScope:'live-process-e2ee',durableReplayStatus:'unavailable'};
    return {status:'confirmed',providerRequestId:'CONTROLLED-'+sends,inferenceId:'CONTROLLED-'+sends,proof,generation:{output},cost:{status:'pending'}};
   };Object.defineProperties(send,{preflight:{value:preflight},evidenceRef:{value:'private:controlled'}});return send;
  }})})};
 async function open(){app=await createApp(options);}await open();
 t.after(async()=>{await app.close();await brain.close();await rm(directory,{recursive:true,force:true});});
 const setup=await app.customerCare.setupDemo(owner,'test-native-seed'),agentId=setup.agents[0].id,documentIds=[setup.documents[0].id],input={agentId,documentIds,question:'What is the auto deductible?'};
 const req=(body,access=true)=>new Request('http://localhost/api/workspace/ai-demo/run',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'http-identity',...access?{authorization:'Bearer TEST_OWNER'}:{}},body:JSON.stringify(body)});
 assert.equal((await app.web.handle(req(input,false))).status,403);assert.equal(sends,0);
 grant.enabled=false;await assert.rejects(app.aiDemo.run(owner,input,'disabled'),{code:'AI_DEMO_AUTHORIZATION_REQUIRED'});assert.equal(sends,0);grant.enabled=true;
 const first=await app.aiDemo.run(owner,input,'one');assert.equal(first.status,'answered',JSON.stringify(first));assert.equal(first.verification.offlinePlaintextRecovery,false);assert.equal(sends,1);assert.ok(first.citations[0].revision);assert.equal(app.treasury.snapshot().credits.lots.length,0);assert.equal(app.treasury.snapshot().balances.length,0);assert.equal(app.treasury.snapshot().reservations[0].status,'pending');
 assert.equal((await app.aiDemo.run(owner,input,'one')).replayed,true);assert.equal(sends,1);
 await app.close();await open();assert.equal((await app.aiDemo.run(owner,input,'one')).answer,first.answer);assert.equal(sends,1);
 const data=readAiDemoFacts({journal:app.journal,companyId,providers:app.providers});data.credentialHash=grant.credentialHash;data.runs[0].status='prepared';data.pricing={model:'Qwen/Qwen3.8-27B',requestNanoUsd:'0',reference:'private:CONTROLLED',expiresAt:new Date(now+300000).toISOString(),inputPerMillionNanoUsd:'40000000',outputPerMillionNanoUsd:'1350000000',contextTokens:262144,modelOutputTokens:65536};
 const check=(financial,changes={})=>aiDemoDecision({id:first.id+':inference',type:'ai_demo_inference',runId:first.id,requestFingerprint:data.runs[0].requestFingerprint,maxCostNanoUsd:'100000000'}, {access:owner,financial},{data:{...data,...changes},companyId,config:null,now});
 const financial=app.treasury.snapshot();assert.equal(check({...financial,reservations:[{id:'other',actionId:'other',status:'pending',upperBoundNanoUsd:'5000000000'}]}).reasonCode,'TOTAL_CEILING_EXCEEDED');
 assert.equal(check(financial,{pricing:{...data.pricing,inputPerMillionNanoUsd:'100000000000'}}).reasonCode,'AI_DEMO_PRICE_EXCEEDS_BOUND');
 assert.equal(check(financial,{authorization:{...grant,credentialHash:'other'}}).reasonCode,'AI_DEMO_AUTHORIZATION_REQUIRED');
 await app.aiDemo.control(owner,{operation:'pause'});await assert.rejects(app.aiDemo.run(owner,input,'paused'),{code:'AI_DEMO_PAUSED'});assert.equal(sends,1);await app.aiDemo.control(owner,{operation:'resume'});
 behavior='pause';const stopped=await app.aiDemo.run(owner,{...input,question:'What happens when paused?'},'pause-during-call');assert.equal(stopped.status,'held');assert.equal(stopped.answer,null);await app.aiDemo.control(owner,{operation:'resume'});
 behavior='escalate';const escalation=await app.aiDemo.run(owner,{...input,question:'Approve my claim'},'escalation');assert.equal(escalation.status,'escalated',JSON.stringify(escalation));assert.ok(app.journal.get('supportTickets',escalation.ticketId));
 behavior='bad-citation';const bad=await app.aiDemo.run(owner,input,'bad-citation');assert.equal(bad.status,'held',JSON.stringify(bad));assert.equal(bad.answer,null);
 behavior='answer';const unsafe=await app.aiDemo.run(owner,{...input,question:'Approve my claim and authorize a payout'},'missing-escalation');assert.equal(unsafe.status,'held');assert.equal(unsafe.reasonCode,'AI_DEMO_REVIEW_REQUIRED');assert.equal(unsafe.answer,null);
 behavior='unknown';const unknown=await app.aiDemo.run(owner,input,'unknown');assert.equal(unknown.status,'held');const count=sends;
 await app.close();await open();assert.equal((await app.aiDemo.run(owner,input,'unknown')).status,'held');assert.equal(sends,count);
 const blocked=await app.aiDemo.run(owner,input,'new-after-unknown');assert.equal(blocked.reasonCode,'UNRESOLVED_SPEND');assert.equal(sends,count);
 assert.equal(app.journal.list('orders').length,0);assert.equal(app.treasury.snapshot().credits.lots.length,0);
 const native=await client.read(documentIds[0]);await client.write({requestId:'outside-native-revision',actor:'test/owner',action:'put',id:native.id,expectedRevision:native.revision,markdown:native.markdown+'\nNative owner revision outside the app.\n'});
 assert.equal((await app.aiDemo.view(owner)).runs.find(r=>r.id===first.id).answer,null,'fresh native revision is checked even before local metadata catches up');
 // A returned answer becomes unavailable when its original grant is revoked.
 const doc=app.journal.get('companyKnowledgeDocuments',documentIds[0]);await app.journal.transaction({actionId:'final-test-revocation',fingerprint:'final-test-revocation'},tx=>{tx.put('companyKnowledgeDocuments',doc.id,{...doc,agentIds:[],version:doc.version+1});return null;});
 assert.equal((await app.aiDemo.view(owner)).runs.find(r=>r.id===first.id).answer,null);
});
