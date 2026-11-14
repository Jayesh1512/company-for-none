import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';

// Read-only verification of the running REAL scenario. This script does not
// start a scenario, call a model, install a test reasoner, or manufacture events.
const origin='http://127.0.0.1:4187',out=path.resolve('artifacts/live-recovery'),review=path.resolve('.impeccable/review/live-recovery');
await mkdir(out,{recursive:true});await mkdir(review,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/recovery.html');await page.getByRole('heading',{name:'Watch a company repair its process'}).waitFor();
 await page.waitForFunction(async()=>{const d=await(await fetch('/api/workspace/recovery')).json();return ['completed','held'].includes(d.scenario.state);},{},{timeout:180000});
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 const d=await page.evaluate(async()=>await(await fetch('/api/workspace/recovery')).json());
 assert.equal(d.scenario.state,'completed',JSON.stringify({state:d.scenario.state,reasonCode:d.scenario.reasonCode}));
 const runs=d.runs.filter(r=>r.attempt===d.scenario.attempt);assert.equal(runs.length,6);assert.ok(runs.every(r=>r.state==='completed'&&r.proof.status==='verified'&&r.proof.signatureKind==='provider_tee'&&r.proof.acceptanceScope==='live-process-e2ee'));assert.equal(new Set(runs.map(r=>r.inferenceId)).size,6);assert.ok(runs.every(r=>r.model==='Qwen/Qwen3.8-27B'));checks.push('six actual NEAR AI model responses with official original-process verification and distinct inference IDs');
 assert.notEqual(d.scenario.knowledgeBefore,d.scenario.knowledgeAfter);assert.notEqual(d.scenario.templateBefore,d.scenario.templateAfter);assert.equal(runs.find(r=>r.role==='support_after').documents[0].revision,d.scenario.knowledgeAfter);assert.equal(runs.find(r=>r.role==='support_before').value.escalate,true);assert.equal(runs.find(r=>r.role==='support_after').value.escalate,false);checks.push('observed first failure, real knowledge and template revision changes, and successful retry using the new knowledge');
 for(const type of ['gap.recorded','knowledge.revised','improvement.proposed','improvement.evaluated','improvement.promoted','recovery.completed'])assert.ok(d.events.some(e=>e.type===type),type);checks.push('every repair stage has an actual company ledger event');
 const widths=[];for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?1000:844});await page.evaluate(()=>scrollTo(0,0));const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.equal(metrics.width,metrics.scrollWidth);widths.push(metrics);const name=width===1440?'desktop.png':'mobile.png';await page.screenshot({path:path.join(review,name),fullPage:true});await page.screenshot({path:path.join(review,width===1440?'desktop-viewport.png':'mobile-viewport.png')});await copyFile(path.join(review,name),path.join(out,name));}
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('link',{name:'Company knowledge',exact:true}).click();await page.getByRole('heading',{name:'Company knowledge',exact:true}).waitFor();await page.getByText('Fictional claims intake runbook',{exact:true}).first().click();await page.getByText('The contactPreference must be portal or email.',{exact:false}).first().waitFor();checks.push('new source-backed runbook visible in the standard Company knowledge screen');
 await page.goto(origin+'/#autonomy/ledger');await page.locator('.cfn-ledger').waitFor();for(let i=0;i<6;i++){const more=page.getByRole('button',{name:'Load more events',exact:true});if(!await more.count())break;await Promise.all([page.waitForResponse(r=>r.url().includes('/api/workspace/autonomy?cursor=')),more.click()]);await page.waitForFunction(()=>!document.querySelector('main[aria-busy=true]'));}assert.match(await page.locator('.cfn-ledger').innerText(),/same question was answered from the new JBrain revision/);checks.push('complete recovery history visible in the existing Company ledger');
 await page.goto(origin+'/recovery.html');await page.getByRole('heading',{name:'The same request now succeeds'}).waitFor();assert.equal(await page.getByRole('button',{name:'Recovery completed',exact:true}).isDisabled(),true);assert.deepEqual(errors,[]);
 // This one UI-only fixture changes the displayed state to exercise polling.
 // It never changes the real server, sends a model request, or becomes live proof.
 await page.route('**/api/workspace/recovery',route=>route.fulfill({json:{...d,scenario:{...d.scenario,state:'running',stage:'support_after'}}}));
 await page.reload();const summary=page.locator('.recovery-run details').first().locator('summary');await summary.click();await summary.focus();await page.waitForResponse(r=>r.url().endsWith('/api/workspace/recovery'));await page.waitForFunction(()=>document.querySelector('.recovery-run details')?.open&&document.activeElement===document.querySelector('.recovery-run details>summary'));
 const pollingUi={controlledUiStateOnly:true,detailStayedOpen:true,keyboardFocusPreserved:true,rootIsLiveRegion:await page.locator('#recovery-app').getAttribute('aria-live')};assert.equal(pollingUi.rootIsLiveRegion,null);await page.unroute('**/api/workspace/recovery');await page.reload();await page.getByRole('heading',{name:'The same request now succeeds'}).waitFor();
 const proof={at:new Date().toISOString(),mode:'actual NEAR AI + native JBrain + fixed evaluator',fixtureProviders:false,recordedResponses:false,checks,widths,pageErrors:errors,scenario:d.scenario,runs,financial:d.financial,events:d.events,pollingUi};await writeFile(path.join(out,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({at:proof.at,checks,widths,pageErrors:errors,financial:d.financial,pollingUi}));
}finally{await browser.close();}
