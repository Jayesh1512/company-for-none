import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createApp} from '../src/app.mjs';
import {startServer} from '../server.mjs';
import {startNativeJBrain} from '../test/helpers/native-jbrain.mjs';
import {setupCustomerCareCompany} from './setup-customer-care.mjs';

// Documented repository browser workflow: actual app/HTTP/native JBrain, no fake model.
const directory=await mkdtemp(path.join(os.tmpdir(),'near-care-browser-')),artifacts=path.resolve('artifacts/customer-care');
await mkdir(artifacts,{recursive:true});
const brain=await startNativeJBrain(path.join(directory,'brain'));
let app,runtime,browser;
const errors=[],checks=[];
try{
 const options={directory:path.join(directory,'app'),companyId:'care-browser',configPath:'',jbrainUrl:brain.url,jbrainToken:brain.token,totalCeilingNanoUsd:'5000000000'};
 app=await createApp(options);runtime=await startServer({app,port:0});
 const api=async(route,{body,token,key=crypto.randomUUID()}={})=>{const response=await fetch(runtime.url+route,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json','idempotency-key':key}:{}),...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;};
 const first=await setupCustomerCareCompany(api);assert.equal(first.services.length,2);assert.equal(first.documents.length,4);
 const before=app.treasury.snapshot(),events=app.journal.events().length;
 await setupCustomerCareCompany(api);assert.equal(app.journal.events().length,events,'repeat setup makes no writes');checks.push('explicit idempotent company + 2 real profiles + 4 native JBrain documents');
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(runtime.url+'/#care');await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();await page.setViewportSize({width:356,height:844});assert.ok(await page.locator('.care-listing>div:nth-child(2)').first().evaluate(e=>e.getBoundingClientRect().width>200));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,'portal-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.goto(runtime.url+'/#marketplace');await page.getByRole('heading',{name:'Customer-care agents',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Chat with agent',exact:true}).count(),2);
 await page.getByRole('link',{name:'Chat with agent',exact:true}).first().click();await page.getByRole('button',{name:'Start conversation',exact:true}).click();
 await page.getByLabel('Your message',{exact:true}).fill('What is the auto collision deductible?');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.locator('.care-message.assistant').filter({hasText:'500 demo dollars'}).waitFor();assert.ok(await page.locator('.care-citation').count());checks.push('actual marketplace -> agent chat -> exact auto deductible + source citation');
 await page.screenshot({path:path.join(artifacts,'chat-desktop.png'),fullPage:true});
 await page.getByLabel('Your message',{exact:true}).fill('Please approve my insurance claim.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.locator('.care-tickets').waitFor();assert.equal(app.journal.list('supportTickets').length,1);checks.push('personal claim decision -> persistent escalation, no approval');
 await page.reload();await page.locator('.care-message.assistant').filter({hasText:'500 demo dollars'}).waitFor();assert.equal(app.journal.list('supportMessages').length,4);checks.push('browser refresh restores private transcript without duplicate turns');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'chat-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(runtime.url+'/#support');await page.locator('.support-ticket').waitFor();await page.getByText('Read conversation',{exact:true}).click();await page.locator('.support-ticket').filter({hasText:'approve my insurance claim'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,'owner-mobile.png'),fullPage:true});checks.push('owner escalation inbox + desktop/mobile 390px no overflow');
 const service=first.services[0],opened=await api('/api/support/conversations',{body:{serviceId:service.id},key:'private-open'});
 const other=await api('/api/support/conversations',{body:{serviceId:service.id},key:'other-open'});
 const denied=await fetch(runtime.url+'/api/support/conversations/'+opened.conversation.id,{headers:{authorization:'Bearer '+other.accessToken}});assert.equal(denied.status,403);
 const same=await api('/api/support/conversations',{body:{serviceId:service.id},key:'private-open'});assert.equal(same.accessToken,null);assert.equal(same.conversation.id,opened.conversation.id);checks.push('customer token isolation + open replay never discloses a token');
 const reply=await api('/api/support/conversations/'+opened.conversation.id+'/messages',{body:{text:'What is the travel delay threshold?'},token:opened.accessToken,key:'travel'});assert.match(reply.reply.text,/6 demo hours/);
 const messageCount=app.journal.list('supportMessages').length;
 await runtime.close();runtime=null;app=await createApp(options);runtime=await startServer({app,port:0});
 const replay=await api('/api/support/conversations/'+opened.conversation.id+'/messages',{body:{text:'What is the travel delay threshold?'},token:opened.accessToken,key:'travel'});assert.equal(replay.replayed,true);assert.equal(app.journal.list('supportMessages').length,messageCount);assert.deepEqual(app.treasury.snapshot(),before);checks.push('disk reopen + existing capability + reply replay, unchanged Treasury');
 assert.deepEqual(errors,[]);await writeFile(path.join(artifacts,'browser-proof.json'),JSON.stringify({at:new Date().toISOString(),mode:'actual-native-jbrain-policy-lookup',modelCalls:0,providerCalls:0,spendUsd:0,checks,pageErrors:errors},null,2));console.log(JSON.stringify({passed:checks.length,checks,pageErrors:errors}));
}finally{await browser?.close();await runtime?.close();if(!runtime&&app)await app.close().catch(()=>{});await brain.close();await rm(directory,{recursive:true,force:true});}
