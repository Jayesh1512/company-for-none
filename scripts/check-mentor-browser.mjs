import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../src/app.mjs';
import {startServer} from '../server.mjs';

// Actual setup-only composition. No fixture adapters, company seed, env loader,
// provider probes, merchant publication, account creation or paid API calls.
const directory=await mkdtemp(path.join(tmpdir(),'near-mentor-browser-')),out=path.resolve('artifacts/mentor-implementation');
await mkdir(out,{recursive:true});
const app=await createApp({directory,configPath:'',companyId:'mentor-browser'}),server=await startServer({app,port:0});
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/#settings');await page.getByRole('heading',{name:'NEAR execution connections',exact:true}).waitFor();
 await page.locator('#near-integration-kind').selectOption('owner_generate');
 await page.locator('#near-integration-input').fill(JSON.stringify({type:'agent_freeze',agent_id:'a'.repeat(64)}));
 await page.locator('#near-integration-form').getByRole('button',{name:'Prepare for review',exact:true}).click();
 await page.locator('[data-integration-execute]').waitFor();assert.equal(await page.locator('[data-integration-execute]').isDisabled(),true);
 await page.getByText('Enable this action in the owner policy before execution.',{exact:true}).waitFor();
 assert.equal(app.journal.list('integrationPlans').length,1);assert.equal(app.journal.list('integrationRuns').length,0);
 await page.reload();await page.locator('[data-integration-execute]').waitFor();assert.equal(app.journal.list('integrationPlans').length,1);
 await page.getByText('Named accounts and scoped ledger keys',{exact:true}).click();
 await page.locator('#near-account-input').fill(JSON.stringify({parentId:'owner.near',companyLabel:'review',roles:['manager','developer'],initialBalanceYocto:'100',ownerPublicKey:'ed25519:'+'2'.repeat(44),writerPublicKey:'ed25519:'+'3'.repeat(44),gasAllowanceYocto:'20',contractId:'ledger.near'}));
 await page.getByRole('button',{name:'Prepare unsigned account plan',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.near-integrations pre')?.innerText.includes('"totalFundingYocto": "300"'));
 assert.equal(app.journal.list('orders').length,0);assert.equal(Object.keys(app.journal.snapshot().operations).length,0);assert.equal(app.treasury.snapshot().version,0);
 const desktop=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.equal(desktop.scrollWidth,desktop.width);
 await page.locator('.near-integrations').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'settings-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.equal(mobile.scrollWidth,mobile.width);
 await page.screenshot({path:path.join(out,'settings-mobile.png'),fullPage:true});
 const denied=await fetch(server.url+'/api/workspace/near-integrations',{headers:{Origin:'https://foreign.invalid','Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'cors'}});assert.equal(denied.status,403);
 const status=await(await fetch(server.url+'/api/status')).text();assert.ok(!status.includes('owner_generate'));assert.ok(!status.includes(app.journal.list('integrationPlans')[0].id));
 assert.deepEqual(errors,[]);
 const proof={at:new Date().toISOString(),composition:'actual setup-only product; no provider fixtures',browser:'repository Playwright fallback after explicit native automation-host-unavailable error',desktop,mobile,requestPrepared:true,unapprovedExecutionDisabled:true,refreshKeepsOnePlan:true,unsignedRoleAndScopedKeyPlan:true,crossSiteStatus:denied.status,pageErrors:errors,providerOperations:0,financialVersion:0,orders:0,paidCalls:0,mainnetWrites:0};
 await writeFile(path.join(out,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await browser?.close();await server.close();await rm(directory,{recursive:true,force:true});}
