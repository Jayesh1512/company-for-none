import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../src/app.mjs';
import {startServer} from '../server.mjs';

// Documented actual-product/native-JBrain browser workflow. No fixture provider,
// recorded reply, paid request or change to the user's existing company.
const directory=await mkdtemp(path.join(tmpdir(),'near-local-demo-browser-')),out=path.resolve('artifacts/local-real-demo');await mkdir(out,{recursive:true});
const app=await createApp({directory:path.join(directory,'main'),companyId:'demo-browser-main',configPath:''}),main=await startServer({app,port:0,demoDirectory:path.join(directory,'demo')});
let browser;
try{
 const original=app.journal.snapshot();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(main.url+'/#setup');await page.getByRole('button',{name:'Open local demo',exact:true}).click();
 await page.getByRole('heading',{name:'Explore the working company',exact:true}).waitFor();const demo=new URL(page.url()).origin;assert.notEqual(demo,main.url);checks.push('one-click isolated real local workspace');
 const metadata=await page.evaluate(async()=>await(await fetch('/api/workspace/local-demo')).json());assert.equal(metadata.agentCount,4);assert.equal(metadata.documentCount,4);assert.equal(metadata.knowledgeStatus,'connected');
 await page.screenshot({path:path.join(out,'guide-desktop.png'),fullPage:true});
 await page.getByRole('link',{name:'Review agents',exact:true}).click();await page.getByRole('heading',{name:'Agents',exact:true}).waitFor();
 await page.goto(demo+'/#agents/'+encodeURIComponent('real-local-demo:manager')+'?tab=settings');await page.getByLabel('Working instructions',{exact:true}).fill('Coordinate the local policy demonstration. Do not call a model or authorize payments.');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('main[aria-busy=true]'));await page.reload();await page.getByLabel('Working instructions',{exact:true}).waitFor();assert.match(await page.getByLabel('Working instructions',{exact:true}).inputValue(),/Coordinate the local policy demonstration/);assert.equal(await page.getByRole('link',{name:'Assign task',exact:true}).count(),0);checks.push('actual agent edit and durable revision');
 await page.goto(demo+'/#knowledge');await page.getByRole('heading',{name:'Company knowledge',exact:true}).waitFor();await page.getByText('Harbor Mutual — Fictional Auto Policy HM-AUTO-DEMO',{exact:true}).first().click();await page.getByText('500 demo dollars',{exact:false}).first().waitFor();checks.push('actual native JBrain document read');
 await page.goto(demo+'/#demo');await page.getByRole('link',{name:'Try customer chat',exact:true}).click();await page.getByRole('button',{name:'Start conversation',exact:true}).click();await page.getByLabel('Your message',{exact:true}).fill('What is the auto collision deductible?');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.locator('.care-message.assistant').filter({hasText:'500 demo dollars'}).waitFor();assert.ok(await page.locator('.care-citation').count());checks.push('real cited model-free customer reply');
 await page.getByLabel('Your message',{exact:true}).fill('Please approve my insurance claim.');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.locator('.care-tickets').waitFor();await page.reload();await page.locator('.care-message.assistant').filter({hasText:'500 demo dollars'}).waitFor();checks.push('real review ticket and private transcript refresh');
 await page.goto(demo+'/#support');await page.locator('.support-ticket').waitFor();checks.push('actual owner escalation inbox');
 await page.goto(demo+'/#autonomy/ledger');await page.getByRole('heading',{name:'Company ledger',exact:true}).waitFor();await page.locator('.cfn-ledger').waitFor();assert.match(await page.locator('.cfn-ledger').innerText(),/support[ .]replied|support[ .]escalated/i);assert.equal(await page.getByRole('button',{name:'Start company',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'NEAR on-chain ledger',exact:true}).count(),0);checks.push('actual private company ledger without irrelevant live blockers');
 await page.goto(demo+'/#settings');await page.getByRole('heading',{name:'Local demo settings',exact:true}).waitFor();assert.equal(await page.getByText('Verification required',{exact:true}).count(),0);assert.equal(await page.getByText('Company operation needs configuration',{exact:true}).count(),0);checks.push('local component status separated from live prerequisites');
 await page.goto(demo+'/#demo');await page.getByRole('heading',{name:'Explore the working company',exact:true}).waitFor();const final=await page.evaluate(async()=>await(await fetch('/api/workspace/local-demo')).json());assert.equal(final.ticketCount,1);assert.equal(final.replyCount,2);assert.equal(final.financialVersion,0);assert.equal(final.providerOperations,0);
 const widths=[];for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?1000:844});if(width===390)await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.equal(size.width,size.scrollWidth);widths.push(size);await page.screenshot({path:path.join(out,width===1440?'guide-desktop.png':'guide-mobile.png'),fullPage:true});}
 await page.getByRole('button',{name:'Exit local demo',exact:true}).click();await page.waitForURL(main.url+'/#autonomy');assert.deepEqual(app.journal.snapshot(),original);checks.push('exit returns to unchanged original company');assert.deepEqual(errors,[]);
 const proof={at:new Date().toISOString(),mode:'real isolated local product + native JBrain',recordedResponses:false,fixtureProviders:false,checks,widths,pageErrors:errors,paidCalls:0,providerOperations:0,financialVersion:0,originalStoreUnchanged:true};await writeFile(path.join(out,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await browser?.close();await main.close();await rm(directory,{recursive:true,force:true});}
