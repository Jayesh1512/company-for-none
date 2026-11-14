import {chromium} from 'playwright';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';

const dir=resolve('walkthrough/public/recordings');await mkdir(dir,{recursive:true});
const cachedBrowser='/Users/jys/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser=await chromium.launch({headless:true,executablePath:process.env.WALKTHROUGH_BROWSER||(existsSync(cachedBrowser)?cachedBrowser:undefined)});
const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir,size:{width:1600,height:900}}});
await context.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const p=document.createElement('div');p.id='walkthrough-pointer';p.style.cssText='position:fixed;left:1120px;top:210px;width:22px;height:22px;border-radius:50%;border:2px solid #c64b2c;background:#c64b2c22;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%)';document.body.append(p);addEventListener('mousemove',e=>{p.style.left=e.clientX+'px';p.style.top=e.clientY+'px'});addEventListener('mousedown',()=>{p.style.background='#c64b2c99'});addEventListener('mouseup',()=>{p.style.background='#c64b2c22'});});});
const page=await context.newPage(),start=performance.now(),marks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const pause=ms=>page.waitForTimeout(ms),ready=()=>page.waitForFunction(()=>!document.querySelector('main[aria-busy="true"]'));
const mark=name=>{marks.push({name,seconds:(performance.now()-start)/1000});console.log(name);};
const click=async locator=>{const l=page.locator(locator);await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:24});await pause(350);await l.click();await ready();await pause(500);};
let agentId,orderId;
try{
 await page.goto('http://127.0.0.1:4173/#agents',{waitUntil:'networkidle'});await ready();mark('agents');await pause(3500);
 await click('.sidebar nav a[href="#marketplace"]');mark('marketplace');await pause(2600);
 await click('a[href="#marketplace/market-researcher"]');await pause(2500);
 await click('a[href="#agents/new/market-researcher"]');mark('create');
 await page.locator('#agent-name').fill('Opportunity analyst');await pause(2200);
 await page.locator('#agent-description').fill('Help our team evaluate markets, test assumptions, and turn evidence into decisions.');await pause(1800);
 await page.locator('#create-agent-form button[type="submit"]').scrollIntoViewIfNeeded();await pause(1600);
 await click('#create-agent-form button[type="submit"]');await page.waitForURL(/#agents\/[a-f0-9-]+$/);agentId=page.url().split('/').at(-1);mark('profile');await pause(3500);
 await click('.sidebar nav a[href="#marketplace"]');await click('a[href="#marketplace/positioning-framework"]');mark('skill');
 await pause(1800);await page.locator('#listing-agent').selectOption(agentId);await pause(1200);await click('#use-listing-form button');await pause(1800);
 await click('.sidebar nav a[href="#marketplace"]');await click('a[href="#marketplace/market-opportunity"]');mark('service');await pause(2300);
 await page.locator('#listing-agent').selectOption(agentId);await pause(1000);await click('#use-listing-form button');mark('brief');
 await page.locator('#task-question').fill('What research evidence should a small business validate before choosing a market?');await pause(2300);
 const response=page.waitForResponse(r=>r.url().endsWith('/tasks')&&r.request().method()==='POST');await click('#task-form button[type="submit"]');const created=await (await response).json();orderId=created.order.id;mark('approve');await pause(2800);
 await click('button[data-action="approve-run"]');await page.locator('.report-body').waitFor({timeout:60000});mark('report');await pause(4000);
 await page.evaluate(()=>scrollBy({top:440,behavior:'smooth'}));await pause(3000);await page.evaluate(()=>scrollBy({top:400,behavior:'smooth'}));await pause(3000);
 await click('.sidebar nav a[href="#tasks"]');mark('tasks');await pause(3000);
 await click('.sidebar nav a[href="#ledger"]');mark('ledger');await pause(4000);
 mark('end');
}finally{
 const video=page.video();await context.close();const path=await video.path();await rename(path,resolve(dir,'product-session.webm'));await browser.close();
 await writeFile(resolve(dir,'capture.json'),JSON.stringify({mode:'fixture',viewport:{width:1600,height:900},agentId,orderId,marks,pageErrors:errors,recordedAt:new Date().toISOString()},null,2)+'\n');
}
if(errors.length)throw new Error(errors.join('\n'));
