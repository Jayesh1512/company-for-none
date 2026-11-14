import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../../src/app.mjs';
import {startNativeJBrain} from '../helpers/native-jbrain.mjs';
import {renderCare,renderSupport} from '../../public/customer-care.js';

async function fixture(t){
 const directory=await mkdtemp(path.join(os.tmpdir(),'near-care-http-')),brain=await startNativeJBrain(path.join(directory,'brain'));
 const app=await createApp({directory:path.join(directory,'app'),configPath:'',companyId:'support-http',jbrainUrl:brain.url,jbrainToken:brain.token});
 t.after(async()=>{await app.close();await brain.close();await rm(directory,{recursive:true,force:true});});
 const call=async(route,{body,token,key='one',owner=false,origin}={})=>{const response=await app.web.handle(new Request('http://localhost'+route,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json','idempotency-key':key}:{}),...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})}),{localOwner:owner});return {status:response.status,value:await response.json()};};
 const pack=await call('/api/workspace/support/demo',{body:{},owner:true});assert.equal(pack.status,200);
 return {app,call,service:pack.value.services.find(s=>s.kind==='policy')};
}
test('public support HTTP is customer-scoped; owner publication and private company APIs stay protected',async t=>{
 const {app,call,service}=await fixture(t),financial=app.treasury.snapshot();
 assert.equal((await call('/api/support/services')).value.services.length,2);
 assert.equal((await call('/api/workspace/support')).status,403);assert.equal((await call('/api/knowledge')).status,403);
 assert.equal((await call('/api/workspace/support/demo',{body:{},key:'remote-setup'})).status,403);
 const a=(await call('/api/support/conversations',{body:{serviceId:service.id},key:'a'})).value,b=(await call('/api/support/conversations',{body:{serviceId:service.id},key:'b'})).value;
 assert.equal((await call('/api/support/conversations/'+a.conversation.id,{token:b.accessToken})).status,403);
 assert.equal((await call('/api/support/conversations/'+a.conversation.id,{token:a.accessToken})).status,200);
 assert.equal((await call('/api/support/conversations/'+a.conversation.id+'?token='+a.accessToken)).status,400);
 assert.equal((await call('/api/support/conversations',{body:{serviceId:service.id},key:'a'})).value.accessToken,null);
 const reply=await call('/api/support/conversations/'+a.conversation.id+'/messages',{body:{text:'What is the auto collision deductible?'},token:a.accessToken,key:'msg'});assert.equal(reply.status,200);assert.match(reply.value.reply.text,/500 demo dollars/);
 const noAuthority=await call('/api/support/conversations/'+a.conversation.id+'/messages',{body:{text:'Hello',access:{role:'owner'},sources:[]},token:a.accessToken,key:'forged'});assert.notEqual(noAuthority.status,200);
 assert.equal((await call('/api/support/conversations',{body:{serviceId:service.id},key:'cross-origin',origin:'https://foreign.invalid'})).status,403);
 assert.deepEqual(app.treasury.snapshot(),financial);assert.equal(Object.keys(app.journal.snapshot().operations).length,0);
});
test('HTTP transcript redacts stale source excerpts, including old keyed response replay',async t=>{
 const {app,call,service}=await fixture(t),a=(await call('/api/support/conversations',{body:{serviceId:service.id},key:'a'})).value,url='/api/support/conversations/'+a.conversation.id;
 const first=await call(url+'/messages',{body:{text:'What is the auto collision deductible?'},token:a.accessToken,key:'question'});assert.match(first.value.reply.text,/500 demo dollars/);
 const id=first.value.reply.citations[0].documentId,old=(await app.knowledge.read(id,{verified:true,role:'owner',companyId:'support-http'})).document;
 await app.knowledge.save({id,title:old.title,body:'Private revised policy. No public approval.',visibility:'restricted',agentIds:[],version:old.version,expectedRevision:old.revision},{requestId:'private-revision',access:{verified:true,role:'owner',companyId:'support-http'}});
 const view=await call(url,{token:a.accessToken});assert.equal(view.status,200);assert.doesNotMatch(JSON.stringify(view.value),/500 demo dollars|Private revised policy/);
 const replay=await call(url+'/messages',{body:{text:'What is the auto collision deductible?'},token:a.accessToken,key:'question'});assert.equal(replay.status,200);assert.doesNotMatch(JSON.stringify(replay.value),/500 demo dollars|Private revised policy/);
});
test('support transport bounds uploads before domain dispatch',async t=>{
 const {call,service}=await fixture(t);
 assert.equal((await call('/api/support/conversations',{body:{serviceId:service.id,text:'x'.repeat(17000)},key:'huge'})).status,413);
 assert.equal((await call('/api/support/conversations',{body:{serviceId:service.id},key:''})).status,400);
});
test('customer and owner templates keep all transcript/source text inert and show lookup provenance',()=>{
 const attack='<img src=x onerror=alert(1)>',service={id:'safe',name:attack,description:attack,kind:'policy'},state={route:{sub:'safe'},supportCatalog:{services:[service]},careView:{conversation:{serviceId:'safe'},messages:[{role:'assistant',text:attack,citations:[{title:attack,section:attack,excerpt:attack,revision:'r',documentId:'d'}]}],tickets:[]},supportOwner:{services:[service],tickets:[{id:'t',conversationId:'c',summary:attack}],messages:[{conversationId:'c',role:'customer',text:attack}]}};
 for(const html of [renderCare(state),renderSupport(state)]){assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/type="password"/);}
 assert.match(renderCare(state),/Policy lookup/);assert.match(renderSupport(state),/No paid AI/);
});
