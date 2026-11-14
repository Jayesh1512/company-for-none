import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {createApp} from '../src/app.mjs';
import {startServer} from '../server.mjs';

// Actual HTTP/browser flow in an isolated setup store. No provider fixtures,
// financial seed, model call or modification of the user's preview workspace.
const directory=await mkdtemp(path.join(os.tmpdir(),'near1-cfn-browser-'));
const functionalOnly=process.argv.includes('--functional-only'),demoMode=process.argv.includes('--demo');
const expectedCompanyName=demoMode?'Northstar Studio (Demo)':'Fictional operations QA';
const artifactDir=path.resolve(demoMode?'artifacts/setup-demo':'artifacts/unified-company-setup');await mkdir(artifactDir,{recursive:true});
const owner=randomBytes(32).toString('hex');
const app=await createApp({directory,configPath:'',ownerToken:owner,companyId:'browser-company'});
const runtime=await startServer({app,port:0});
let browser;
try {
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);
 page.on('response',async r=>{if(r.url().includes('/api/')&&r.status()>=400)console.error('API failure',r.status(),r.url(),await r.text());});
 page.on('pageerror',e=>errors.push(e.message));
 const api=async(route,options={})=>{const response=await fetch(runtime.url+route,{...options,headers:{authorization:`Bearer ${owner}`,'content-type':'application/json','idempotency-key':randomBytes(8).toString('hex')}});return {status:response.status,body:await response.json()};};
 await page.goto(runtime.url+'/#setup');assert.equal(await page.locator('#owner-form').count(),0);
 await page.getByRole('heading',{name:'Set up your organization',exact:true}).waitFor();
 assert.equal(await page.locator('.company-mode-choice').count(),0);
 await page.getByText('Company for none · default',{exact:true}).waitFor();
 if(demoMode){
  await page.waitForFunction(()=>!document.querySelector('main[aria-busy="true"]'));
  const version=app.journal.snapshot().version;
  await page.getByRole('button',{name:'Fill example fields',exact:true}).click();
  await page.getByLabel('Company name',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Company name',{exact:true}).inputValue(),expectedCompanyName);
  await page.getByLabel('Industry or focus',{exact:true}).fill('Owner-entered industry');
  await page.getByRole('button',{name:'Fill example fields',exact:true}).click();
  await page.getByRole('button',{name:'Fill example fields',exact:true}).click();
  assert.equal(await page.getByLabel('Industry or focus',{exact:true}).inputValue(),'Owner-entered industry');
  assert.equal(app.journal.snapshot().version,version);assert.equal(app.journal.list('agents').length,0);
  await page.reload();await page.getByText('Example setup text',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Company name',{exact:true}).inputValue(),expectedCompanyName);
  assert.equal(app.journal.snapshot().version,version);
 }else{
 await page.getByLabel('Company name',{exact:true}).fill('Fictional operations QA');
 await page.getByLabel('Company purpose',{exact:true}).fill('Validate the local autonomous-company setup flow.');
 await page.getByLabel('Industry or focus',{exact:true}).fill('Controlled QA');
 await page.getByLabel('Who does it serve?',{exact:true}).fill('Fictional sample customers');
 await page.getByLabel('Desired outcome',{exact:true}).fill('A durable, honestly blocked work queue');
 await page.getByLabel('First objective',{exact:true}).fill('Inspect the company document workflow for process gaps.');
 }
 await page.getByRole('button',{name:'Configure agent team',exact:true}).click();
 await page.getByRole('heading',{name:'Your configured agent team',exact:true}).waitFor();
 let configured=(await api('/api/workspace/autonomy')).body;
 assert.equal(configured.company.operatingMode,'none');assert.equal(configured.company.started,false);assert.equal(configured.agents.length,2);
 const manager=configured.agents.find(a=>a.autonomyRole==='manager'),profile=page.locator(`form[data-setup-agent="${manager.id}"]`);
 await profile.locator('..').locator('summary').click();
 await profile.getByLabel('Agent name',{exact:true}).fill('Operations coordinator');
 await profile.getByLabel('Role',{exact:true}).fill('Company operations lead');
 await profile.getByLabel('Working instructions',{exact:true}).fill('Coordinate approved work and report uncertainty to the company backlog.');
 await profile.getByLabel('Evidence review',{exact:true}).check();
 await profile.getByRole('button',{name:'Save agent',exact:true}).click();
 await page.getByRole('heading',{name:'Operations coordinator',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'Operations coordinator',exact:true}).waitFor();
 configured=(await api('/api/workspace/autonomy')).body;
 assert.equal(configured.agents.find(a=>a.id===manager.id).role,'Company operations lead');
 assert.ok(configured.agents.find(a=>a.id===manager.id).skillIds.includes('evidence-review'));
 assert.equal(configured.company.started,false);
 await page.getByRole('link',{name:'Continue to company brain',exact:true}).click();
 if(demoMode){
  await page.getByRole('link',{name:'Add company knowledge',exact:true}).click();
  await page.getByLabel('Document title',{exact:true}).waitFor();
  assert.match(await page.getByLabel('Document title',{exact:true}).inputValue(),/fictional company brief/);
  assert.equal(app.journal.list('knowledgeDocuments').length,0);
  await page.getByRole('link',{name:'Back to organization setup',exact:false}).click();
 }
 await page.getByRole('link',{name:'Continue to boundaries',exact:true}).click();
 await page.getByRole('button',{name:'Save boundaries & review',exact:true}).click();
 await page.getByRole('button',{name:'Finish setup',exact:true}).click();
 await page.getByRole('heading',{name:'What agents are working on',exact:true}).waitFor();
 assert.equal((await api('/api/workspace/autonomy')).body.agents.length,2);
 assert.equal((await api('/api/workspace/autonomy')).body.company.started,false);
 assert.equal((await api('/api/workspace/autonomy')).body.setup.reviewed,true);
 assert.equal((await api('/api/workspace')).body.organization.name,expectedCompanyName);
 await page.getByRole('button',{name:'Start company',exact:true}).click();
 await api('/api/workspace/autonomy/advance',{method:'POST',body:'{}'});
 await page.getByRole('button',{name:'Refresh company',exact:true}).click();
 const scans=[];
 async function capture(name,width,height,route){
   await page.setViewportSize({width,height});await page.goto(runtime.url+'/#'+route);await page.locator('main h1').waitFor();
   await page.waitForFunction(()=>!document.querySelector('main[aria-busy="true"]'));
   if(route==='setup/agents')await page.locator('.configured-agent details').first().evaluate(d=>d.open=true);
   const measure=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,heading:document.querySelector('main h1')?.textContent}));
   assert.ok(measure.documentWidth<=width+1,`${name} horizontal overflow ${JSON.stringify(measure)}`);
   if(!functionalOnly)await page.screenshot({path:path.join(artifactDir,name+'.png'),fullPage:true});scans.push({name,...measure});
 }
 await capture('operations-desktop',1440,1000,'autonomy');
 await page.goto(runtime.url+'/#autonomy');await page.getByRole('button',{name:'Pause company',exact:true}).click();
 await page.getByRole('button',{name:'Start company',exact:true}).waitFor();
 await capture('setup-desktop',1440,1000,'setup/agents');
 await capture('operations-mobile',390,844,'autonomy');
 await capture('agents-mobile',390,844,'autonomy/agents');
 await capture('ledger-mobile',390,844,'autonomy/ledger');
 await capture('setup-mobile',390,844,'setup/agents');
 for(const route of ['setup/org','setup/brain','setup/boundaries','setup/review','setup/profiles','autonomy/setup?step=1','autonomy/improvements','autonomy/purchases','autonomy/services','agents','setup']){
   await page.goto(runtime.url+'/#'+route);await page.waitForFunction(()=>!document.querySelector('main[aria-busy="true"]'));assert.equal(await page.locator('main [role="alert"]').count(),0,route);
 }
 await page.goto(runtime.url+'/#autonomy/template');
 await page.getByLabel('Template name',{exact:true}).fill('Fictional sample names');
 await page.getByLabel('Current fields, one per line',{exact:true}).fill('firstName*\nlastName*');
 await page.getByLabel('Required contract fields, one per line',{exact:true}).fill('firstName\nmiddleName\nlastName');
 await page.getByRole('button',{name:'Register template',exact:true}).click();
 await page.getByRole('heading',{name:'The company improves through evidence',exact:true}).waitFor();
 await page.getByRole('link',{name:'Record a gap',exact:true}).click();
 await page.getByLabel('Failure code',{exact:true}).fill('MISSING_SAMPLE_FIELD');
 await page.getByLabel('What went wrong?',{exact:true}).fill('The fictional contract requires a middle-name field.');
 await page.getByRole('button',{name:'Send to backlog',exact:true}).click();
 await page.getByText('The fictional contract requires a middle-name field.',{exact:true}).waitFor();
 const before=(await api('/api/workspace/autonomy')).body;
 await page.reload();await page.getByText('The fictional contract requires a middle-name field.',{exact:true}).waitFor();
 const after=(await api('/api/workspace/autonomy')).body;assert.equal(after.events.length,before.events.length);
 await page.goto(runtime.url+'/#autonomy/agents');await page.getByRole('link',{name:'Select company context',exact:true}).first().click();
 await page.getByRole('button',{name:'Save context selection',exact:true}).click();await page.getByRole('heading',{name:'The company’s team',exact:true}).waitFor();
 assert.equal((await fetch(runtime.url+'/api/workspace/autonomy',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
 assert.equal(Object.keys(app.journal.snapshot().operations).length,0);assert.equal(app.journal.list('orders').length,0);assert.equal(app.treasury.snapshot().version,0);
 assert.deepEqual(errors,[]);
 const proof={checkedAt:new Date().toISOString(),mode:'isolated actual HTTP/browser setup',demoMode,exampleDraftsOnly:demoMode,autoSeededRecords:0,functionalOnly,screenshotsCaptured:!functionalOnly,providerEffects:0,orders:0,financialVersion:0,agents:2,defaultOperatingMode:'none',editableProfilesPersisted:true,reviewDoesNotStart:true,canonicalOrganizationAligned:true,backlogItems:after.improvements.length,contextSelectionRoute:true,refreshStable:true,crossSiteStatus:403,tokenEntryRequired:false,consoleExceptions:errors,scans};
 await writeFile(path.join(artifactDir,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
} finally {await browser?.close();await runtime.close();await rm(directory,{recursive:true,force:true});}
