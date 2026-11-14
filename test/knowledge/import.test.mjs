import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../helpers/create-fixture-app.mjs';
import {createKnowledgeImporter,extractPdf} from '../../src/knowledge/import.mjs';
import {renderKnowledge} from '../../public/knowledge.js';
import {samplePdf} from './import-fixtures.mjs';
const path='/api/knowledge/import';
const file=(body,name='company.md',kind='markdown',extra={})=>new Request('http://localhost'+path,{method:'POST',headers:{'content-type':kind==='pdf'?'application/pdf':'text/plain','x-file-name':encodeURIComponent(name),'x-import-kind':kind,...extra},body});
const website=url=>new Request('http://localhost'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'website',url})});
async function fixture(t){const directory=await mkdtemp('/tmp/near-import-'),app=await createApp({directory});t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});return app;}

test('Markdown/text import previews real bytes with provenance, bounded text and no journal or financial mutation',async t=>{
 const app=await fixture(t),before=app.journal.snapshot();
 const response=await app.web.handle(file('# Company\n\nFictional PRIVATE_IMPORT_MARKER.'));assert.equal(response.status,200);
 const {preview}=await response.json();assert.match(preview.body,/PRIVATE_IMPORT_MARKER/);assert.match(preview.body,/Imported from: company.md/);assert.equal(preview.title,'company');assert.equal(preview.source.sha256.length,64);
 assert.deepEqual(app.journal.snapshot(),before);assert.equal((await app.knowledge.view()).documents.length,0);
 const long=await(await app.web.handle(file('a'.repeat(30000),'long.txt','text'))).json();assert.equal(long.preview.characters,24000);assert.ok(long.preview.warnings.some(w=>w.includes('shortened')));
});

test('actual isolated PDF parser extracts selectable text and rejects fake, unreadable and excessive-page documents',async t=>{
 const app=await fixture(t),before=app.journal.snapshot();
 const response=await app.web.handle(file(samplePdf(),'handbook.pdf','pdf'));assert.equal(response.status,200);const {preview}=await response.json();assert.match(preview.body,/Fictional Company Handbook/);assert.equal(preview.source.pages,1);assert.deepEqual(app.journal.snapshot(),before);
 const fake=await app.web.handle(file('Not a PDF','bad.pdf','pdf'));assert.equal(fake.status,400);assert.equal((await fake.json()).error.code,'PDF_INVALID');
 const broken=await app.web.handle(file('%PDF-1.4 corrupted','bad.pdf','pdf'));assert.equal(broken.status,400);
 const blank=await app.web.handle(file(samplePdf(''),'scanned.pdf','pdf'));assert.equal(blank.status,400);assert.match((await blank.json()).error.message,/OCR/);
 await assert.rejects(extractPdf(samplePdf('many pages',2),{maxPdfPages:1,maxDocumentChars:24000,timeoutMs:10000}),{code:'PDF_PAGE_LIMIT'});
});

test('import rejects oversized, binary, unsupported and malformed uploads without saving',async t=>{
 const app=await fixture(t);
 for(const request of [file(Buffer.from([0xff,0x00]),'binary.txt'),file('data','image.png'),file('','empty.md'),file('data','wrong.pdf','markdown')])assert.ok((await app.web.handle(request)).status>=400);
 assert.equal((await app.web.handle(file('x','huge.md','markdown',{'content-length':String(6*1024*1024)}))).status,413);
 assert.equal((await app.web.handle(file('data','name.md','unsupported'))).status,403);
 assert.equal((await app.knowledge.view()).documents.length,0);
});

test('website preview reuses public-only transport and retains source facts, including failures',async t=>{
 const app=await fixture(t);
 for(const url of ['http://localhost/secret','http://127.0.0.1/secret','http://169.254.169.254/latest','file:///etc/passwd']){
  const response=await app.web.handle(website(url));assert.equal(response.status,400);assert.equal((await response.json()).error.code,'UNSAFE_SOURCE');
 }
 const inputs=[];const importer=createKnowledgeImporter({rules:app.rules,companyId:'local-workspace',retrieve:async spec=>{inputs.push(spec);return {url:'https://public.example/about',text:'Fictional public page text.',bytes:30};}});
 const {preview}=await importer.preview(website('https://public.example/about'));assert.equal(preview.source.url,'https://public.example/about');assert.match(preview.body,/Fictional public page/);assert.equal(inputs[0].maxRedirects,3);assert.ok(preview.warnings.some(w=>w.includes('One public page')));
 const failed=createKnowledgeImporter({rules:app.rules,companyId:'local-workspace',retrieve:async()=>{throw Object.assign(Error(),{code:'SOURCE_TIMEOUT'});}});await assert.rejects(failed.preview(website('https://public.example')),{code:'SOURCE_TIMEOUT'});
});

test('import obeys current Rules kill, workspace access and mutation-origin gates',async t=>{
 const app=await fixture(t);assert.equal((await app.web.handle(new Request('http://public.example'+path,{method:'POST',body:'data'}))).status,403);
 assert.equal((await app.web.handle(file('body','company.md','markdown',{origin:'https://attacker.example'}))).status,403);
 app.rules.updateConfig({...app.rules.snapshot().config,killSwitch:true});const response=await app.web.handle(file('body'));assert.equal(response.status,403);assert.equal((await response.json()).error.code,'KILL_SWITCH');
});

test('company knowledge editor presents four real source options, escaped preview and truthful limits',async t=>{
 const app=await fixture(t),state={data:app.workspace.view(),knowledge:await app.knowledge.view(),route:{sub:'new'},knowledgeSource:'pdf',knowledgeFile:{name:'<script>.pdf',size:200},knowledgeImportPreview:{source:{name:'<script>.pdf',pages:1},characters:20,warnings:['<script>warning</script>']}};
 const html=renderKnowledge(state);for(const label of ['Write or paste','PDF upload','Markdown / text','Website link','Preview extracted text'])assert.ok(html.includes(label));assert.ok(html.includes('no OCR'));assert.ok(html.includes('Original files are not stored'));assert.ok(!html.includes('<script>'));
 const web=renderKnowledge({...state,knowledgeSource:'website'});assert.ok(web.includes('Public website URL'));assert.ok(web.includes('Preview page text'));
});
