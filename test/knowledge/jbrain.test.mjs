import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {createJBrainClient} from '../../src/knowledge/client.mjs';
import {renderKnowledge} from '../../public/knowledge.js';
import {loadDemo,demoDocument} from '../helpers/onboarding-fixtures.mjs';
import {samplePdf} from './import-fixtures.mjs';
const binary=process.env.JBRAIN_TEST_BINARY??path.resolve('.runtime/dependencies/jbrain/target/release/jbrain');
const native={skip:!existsSync(binary)?'Build JBrain or set JBRAIN_TEST_BINARY for actual service integration tests.':false};
const profile={name:'Analyst',role:'Research analyst',instructions:'Research the question. Cite sources and explain uncertainty.',skillIds:[]};
const brief='What research evidence should a small business validate before choosing a market?';
const input=(body='Company context MARKER: our product serves small research teams.',extra={})=>({title:'Company profile',body,visibility:'company',agentIds:[],...extra});
const req=(url,method='GET',body,headers={})=>new Request('http://localhost'+url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
async function brain(directory){
 const child=spawn(binary,['serve'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,JBRAIN_DATA_DIR:directory,JBRAIN_PORT:'0',JBRAIN_HOST:'127.0.0.1',JBRAIN_TOKEN:'test-local-token',JBRAIN_HISTORY:'off'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',d=>stderr+=d);
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('JBrain startup timeout: '+stderr)),15000);const lines=createInterface({input:child.stdout});lines.on('line',line=>{try{const v=JSON.parse(line);if(v.event==='ready'){clearTimeout(timer);resolve(v.url);}}catch{}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('JBrain exit '+code+': '+stderr));});});
 return {url,close:async()=>{if(child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}};
}
async function fixture(t){const root=await mkdtemp('/tmp/near-jbrain-');let service=await brain(path.join(root,'brain'));let app=await createApp({directory:path.join(root,'app'),jbrainUrl:service.url,jbrainToken:'test-local-token'});t.after(async()=>{await app.close();await service.close();await rm(root,{recursive:true,force:true});});return {get app(){return app;},get service(){return service;},root,async connect(url){await app.close();app=await createApp({directory:path.join(root,'app'),jbrainUrl:url,jbrainToken:'test-local-token'});},async restart(){await app.close();await service.close();service=await brain(path.join(root,'brain'));app=await createApp({directory:path.join(root,'app'),jbrainUrl:service.url,jbrainToken:'test-local-token'});}};}
const save=(app,body,key=randomUUID())=>app.knowledge.save(body,{requestId:key});

test('uploaded PDF preview is ephemeral; only owner-reviewed text is saved to actual JBrain with agent grants',native,async t=>{
 const f=await fixture(t),app=f.app,a=(await app.workspace.create(profile)).agent,b=(await app.workspace.create({...profile,name:'Other agent'})).agent,before=app.journal.snapshot();
 const response=await app.web.handle(new Request('http://localhost/api/knowledge/import',{method:'POST',headers:{'content-type':'application/pdf','x-import-kind':'pdf','x-file-name':'handbook.pdf'},body:samplePdf('Fictional private company handbook.')}));
 assert.equal(response.status,200);const {preview}=await response.json();assert.match(preview.body,/Fictional private company handbook/);assert.deepEqual(app.journal.snapshot(),before);
 const document=(await save(app,{title:preview.title,body:preview.body+'\nOwner reviewed this import.',visibility:'restricted',agentIds:[a.id]})).document;
 const context=await app.knowledge.capture(a.id,[document.id]);assert.match(context.documents[0].markdown,/Owner reviewed this import/);assert.match(context.documents[0].markdown,/File SHA-256/);
 await assert.rejects(app.knowledge.capture(b.id,[document.id]),{code:'KNOWLEDGE_ACCESS_DENIED'});await f.restart();assert.match((await f.app.knowledge.read(document.id)).document.body,/Owner reviewed this import/);
});

test('one-click demo writes actual JBrain context once, preserves edits and survives restart without financial effects',native,async t=>{
 const f=await fixture(t),before=f.app.treasury.snapshot();
 const api=async(path,{method='GET',body,key}={})=>{const response=await f.app.web.handle(req(path,method,body,key?{'idempotency-key':key}:{})),value=await response.json();if(!response.ok)throw Error(value.error?.message);return value;};
 assert.equal((await loadDemo(api)).brainReady,true);
 const first=(await f.app.knowledge.view()).documents;assert.equal(first.length,1);assert.equal(first[0].title,demoDocument.title);
 const read=(await f.app.knowledge.read(first[0].id)).document;assert.match(read.body,/fictional demo company/);
 await save(f.app,{title:read.title,body:'Owner edited this fictional brief.',visibility:'company',agentIds:[],id:read.id,version:read.version,expectedRevision:read.revision});
 await loadDemo(api);assert.equal((await f.app.knowledge.view()).documents.length,1);assert.equal((await f.app.knowledge.read(read.id)).document.body.trim(),'Owner edited this fictional brief.');
 assert.deepEqual(f.app.treasury.snapshot(),before);assert.equal(f.app.workspace.view().tasks.length,0);assert.equal((await f.app.workspace.setup()).progress.complete,false);
 await f.restart();await loadDemo(api);assert.equal(f.app.workspace.view().agents.length,4);assert.equal((await f.app.knowledge.view()).documents.length,1);
});

test('actual JBrain shares company context across permitted agents, blocks restricted and foreign documents',native,async t=>{
 const f=await fixture(t),app=f.app,a=(await app.workspace.create(profile)).agent,b=(await app.workspace.create({...profile,name:'Writer'})).agent;
 const shared=(await save(app,input())).document,privateDoc=(await save(app,input('CONFIDENTIAL-BOARD-MARKER',{title:'Board notes',visibility:'restricted',agentIds:[a.id]}))).document;
 assert.equal((await app.knowledge.view()).status,'connected');assert.equal((await app.knowledge.capture(a.id,[shared.id,privateDoc.id])).documents.length,2);
 const context=await app.knowledge.capture(b.id,[shared.id]);assert.match(context.documents[0].markdown,/MARKER/);assert.equal(context.documents[0].revision,shared.revision);
 await assert.rejects(app.knowledge.capture(b.id,[privateDoc.id]),{code:'KNOWLEDGE_ACCESS_DENIED'});
 await assert.rejects(app.knowledge.read('companies/another/documents/secret'),{code:'KNOWLEDGE_ACCESS_DENIED'});
 assert.deepEqual((await app.knowledge.capture(b.id,[])).documents,[]);
 assert.deepEqual((await app.knowledge.view(b.id)).documents.map(d=>d.id),[shared.id]);
 assert.equal((await app.web.handle(new Request('http://public.example/api/knowledge'))).status,403);
 assert.equal((await app.web.handle(req('/api/knowledge/documents','POST',{...input(),companyId:'another'},{'idempotency-key':'spoof'}))).status,400);
 assert.equal(JSON.stringify(await app.ledger.view()).includes('CONFIDENTIAL-BOARD-MARKER'),false);
});

test('actual JBrain revisions persist through service/app restart, stale writes conflict and unknown YAML fields survive',native,async t=>{
 const f=await fixture(t),doc=(await save(f.app,input())).document;const client=createJBrainClient({url:f.service.url,token:'test-local-token'});
 const raw=await client.read(doc.id);const receipt=await client.write({requestId:randomUUID(),actor:'external/test',action:'put',id:doc.id,expectedRevision:raw.revision,markdown:raw.markdown.replace('type: Reference','type: Reference\nx-extra: preserved')});
 const read=(await f.app.knowledge.read(doc.id)).document;
 const updated=(await save(f.app,input('Updated context',{id:doc.id,expectedRevision:receipt.revision,version:doc.version}))).document;
 assert.match((await client.read(doc.id)).markdown,/x-extra: preserved/);
 await assert.rejects(save(f.app,input('Stale',{id:doc.id,expectedRevision:read.revision,version:doc.version})),{code:'CONFLICT'});
 await f.restart();assert.equal((await f.app.knowledge.read(doc.id)).document.revision,updated.revision);assert.match((await f.app.knowledge.read(doc.id)).document.body,/Updated context/);
 assert.equal((await f.app.knowledge.view()).documents.length,1);
});

test('task freezes permitted company revisions, generates attributed context and publishes only with its private capability',native,async t=>{
 const f=await fixture(t),app=f.app,a=(await app.workspace.create(profile)).agent,doc=(await save(app,input('SNAPSHOT-V1 company research background.'))).document;
 const task=await app.workspace.createTask(a.id,{question:brief,knowledgeIds:[doc.id]});
 await save(app,input('SNAPSHOT-V2 updated background',{id:doc.id,expectedRevision:doc.revision,version:doc.version}));
 await app.workflow.confirmFixturePayment(task.order.id);const result=await app.workflow.run(task.order.id);assert.equal(result.order.status,'complete');
 const raw=app.journal.get('orders',task.order.id);assert.equal(raw.agentContext.companyKnowledge.documents[0].revision,doc.revision);assert.match(raw.request.messages[1].content,/SNAPSHOT-V1/);assert.doesNotMatch(raw.request.messages[1].content,/SNAPSHOT-V2/);
 const report=await app.workflow.getReport(task.order.id,{token:task.accessToken});assert.match(report.content,/Company background \(owner supplied/);assert.match(report.content,/SNAPSHOT-V1/);
 const url=`/api/orders/${task.order.id}/publish-knowledge`,body={title:'Shared findings',visibility:'company',agentIds:[]},key=randomUUID();
 assert.equal((await app.web.handle(req(url,'POST',body,{'idempotency-key':key}))).status,403);
 const response=await app.web.handle(req(url,'POST',body,{'idempotency-key':key,authorization:`Bearer ${task.accessToken}`}));assert.equal(response.status,200);const shared=(await response.json()).document;
 assert.equal(shared.sourceOrderId,task.order.id);assert.equal((await app.knowledge.view()).documents.length,2);
 const other=(await app.workspace.create({...profile,name:'Content agent'})).agent;assert.match((await app.knowledge.capture(other.id,[shared.id])).documents[0].markdown,/SNAPSHOT-V1/);
 assert.equal(JSON.stringify(await app.ledger.view()).includes('SNAPSHOT-V1'),false);
});

test('revoking access blocks fresh inference dispatch while refunds remain executable',native,async t=>{
 const f=await fixture(t),app=f.app,a=(await app.workspace.create(profile)).agent,doc=(await save(app,input('Private strategy',{visibility:'restricted',agentIds:[a.id]}))).document;
 const task=await app.workspace.createTask(a.id,{question:brief,knowledgeIds:[doc.id]});
 await save(app,input('Private strategy',{id:doc.id,expectedRevision:doc.revision,version:doc.version,visibility:'restricted',agentIds:[]}));
 await app.workflow.confirmFixturePayment(task.order.id);const outcome=await app.workflow.run(task.order.id);assert.equal(outcome.order.status,'refunded');
 assert.equal(app.journal.get('orders',task.order.id).generationComplete??false,false);
 assert.equal(Object.values(app.treasury.snapshot().dailyCosts).every(v=>v==='0'),true);
 assert.throws(()=>app.knowledge.assertSnapshot(app.journal.get('orders',task.order.id).agentContext.companyKnowledge),{code:'KNOWLEDGE_ACCESS_DENIED'});
});

test('actual accepted JBrain write with lost HTTP response recovers original receipt after restart without a second write',native,async t=>{
 const f=await fixture(t);let writes=0,drop=true;
 const proxy=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const response=await fetch(f.service.url+req.url,{method:req.method,headers:{authorization:'Bearer test-local-token',...(raw?{'content-type':'application/json'}:{})},...(raw?{body:raw}:{})});const bytes=await response.text();if(req.method==='POST'){writes++;if(drop){drop=false;res.destroy();return;}}res.writeHead(response.status,{'content-type':'application/json'});res.end(bytes);});await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>proxy.close(resolve)));
 await f.connect(`http://127.0.0.1:${proxy.address().port}`);let app=f.app;const data=input('DURABLE-RECEIPT');
 await assert.rejects(save(app,data,'lost-response'),{code:'JBRAIN_UNAVAILABLE'});assert.equal(app.journal.list('companyKnowledgeWrites')[0].status,'unknown');
 await f.connect(f.service.url);app=f.app;
 assert.equal((await app.knowledge.view()).documents.length,1);assert.equal(writes,1);assert.equal((await save(app,data,'lost-response')).replayed,true);
 await assert.rejects(save(app,input('changed-payload'),'lost-response'),{code:'CONFLICT'});
});

test('company document UI escapes content and missing JBrain blocks selected context without a fallback',native,async t=>{
 const f=await fixture(t),a=(await f.app.workspace.create(profile)).agent,doc=(await save(f.app,input('<script>DO_NOT_EXECUTE</script>'))).document;
 await f.service.close();await assert.rejects(f.app.workspace.createTask(a.id,{question:brief,knowledgeIds:[doc.id]}),{code:'JBRAIN_UNAVAILABLE'});assert.equal(f.app.journal.list('orders').length,0);assert.equal((await f.app.knowledge.view()).status,'unavailable');
 const html=renderKnowledge({data:f.app.workspace.view(),route:{sub:doc.id},knowledge:{status:'connected',limits:{maxDocumentChars:24000}},knowledgeDocument:{document:{...doc,body:'</textarea><script>bad()</script>'}}});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});

test('M01 owns company scope, grant validation, bounds and kill decisions',async t=>{
 const directory=await mkdtemp('/tmp/near-knowledge-rules-'),app=await createApp({directory});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 const a=(await app.workspace.create(profile)).agent,company={id:'local-workspace'},document=input(),facts={company,documents:[],agents:[a],access:{role:'owner',verifiedLocal:true},document};
 assert.equal(app.rules.evaluate({id:'valid-note',type:'knowledge_manage'},facts).status,'allow');
 assert.equal(app.rules.evaluate({id:'overlong',type:'knowledge_manage'},{...facts,document:input('x'.repeat(24001))}).reasonCode,'KNOWLEDGE_DOCUMENT_INVALID');
 assert.equal(app.rules.evaluate({id:'spoof-grant',type:'knowledge_manage'},{...facts,document:input('Test',{agentIds:['not-a-company-agent']})}).reasonCode,'KNOWLEDGE_GRANT_INVALID');
 assert.equal(app.rules.evaluate({id:'wrong-company',type:'knowledge_context'},{company:{id:'other-company'},agent:a,documents:[]}).reasonCode,'COMPANY_SCOPE_MISMATCH');
 app.rules.updateConfig({...app.rules.snapshot().config,killSwitch:true});
 assert.equal(app.rules.evaluate({id:'kill-note',type:'knowledge_manage'},facts).reasonCode,'KILL_SWITCH');
 assert.equal(app.rules.evaluate({id:'kill-read',type:'knowledge_read'},facts).status,'allow');
});

test('JBrain context selection is bounded by M01 and excerpts retain revisions and truncation',native,async t=>{
 const f=await fixture(t),a=(await f.app.workspace.create(profile)).agent,docs=[];
 for(let i=0;i<5;i++)docs.push((await save(f.app,input('Context '.repeat(800),{title:'Long document '+i}))).document);
 await assert.rejects(f.app.knowledge.capture(a.id),{code:'KNOWLEDGE_SELECTION_REQUIRED'});
 const context=await f.app.knowledge.capture(a.id,docs.slice(0,4).map(d=>d.id));
 assert.equal(context.documents.length,4);assert.ok(context.documents.every(d=>d.markdown.length<=2000&&d.truncated&&d.revision.length===64));assert.ok(context.documents.reduce((n,d)=>n+d.markdown.length,0)<=8000);
});

test('a persisted workspace cannot be rebound to another company, and a rejected reopen releases its lock',async t=>{
 const directory=await mkdtemp('/tmp/near-company-bind-');t.after(()=>rm(directory,{recursive:true,force:true}));
 const original=await createApp({directory});await original.close();
 await assert.rejects(createApp({directory,companyId:'another-company'}),{code:'STORE_COMPANY_MISMATCH'});
 const reopened=await createApp({directory});assert.equal(reopened.workspace.view().workspace.id,'local-workspace');await reopened.close();
});

test('all six organization steps complete against actual JBrain and resume after both services restart',native,async t=>{
 const f=await fixture(t),app=f.app;await app.workspace.saveOrganization({name:'Setup test company',purpose:'Research our customers and share useful evidence.',industry:'Research',version:0});
 async function review(id){const setup=await app.workspace.setup();await app.workspace.reviewSetup({stepId:id,version:setup.organization.version});}
 for(const id of ['agents','profiles','skills','infra'])await review(id);
 await assert.rejects(review('brain'),/share a document/);
 await save(app,input('Shared company mission for setup.'));
 await review('brain');assert.equal((await app.workspace.setup()).progress.complete,true);
 await f.restart();const setup=await f.app.workspace.setup();assert.equal(setup.progress.complete,true);assert.equal(setup.progress.completedCount,6);assert.equal(setup.brain.status,'connected');assert.equal(setup.organization.name,'Setup test company');assert.equal(setup.progress.grantsSpendingAuthority,false);
});
