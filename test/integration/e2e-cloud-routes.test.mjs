import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../../src/app.mjs';

// Transport-only tests against the real owner/M01/web composition, not provider proof.
const companyId='cloud-route-tests';
async function harness(t){
 const directory=await mkdtemp('/tmp/near-cloud-routes-'),calls=[];
 const app=await createApp({directory,companyId,configPath:null,resolveSecret:async()=>{throw Error('No credentials authorized');},cloudProductTransport:async(url,options)=>{
  calls.push({url,method:options?.method??'GET'});assert.equal(new URL(url).pathname,'/v1/services');
  return new Response(JSON.stringify({services:[{serviceName:'web_search',unit:'request',costPerUnit:'5000000',isActive:true}],total:1}),{headers:{'content-type':'application/json'}});
 }});
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 const post=(operation,body={},transport={localOwner:true},headers={})=>app.web.handle(new Request('http://localhost/api/workspace/cloud/'+operation,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)}),transport);
 return {app,calls,post};
}
test('new Cloud read and advisory routes require owner/origin and never grant execution or create financial effects',async t=>{
 const h=await harness(t);
 for(const route of ['services','knowledge-ranking','billing-costs']){
  assert.equal((await h.post(route,{},{})).status,403);assert.equal((await h.post(route,{}, {localOwner:true},{origin:'https://other.example'})).status,403);
 }
 assert.equal(h.calls.length,0);
 const response=await h.post('services'),data=await response.json();assert.equal(response.status,200);assert.equal(data.services[0].costPerUnit,'5000000');assert.equal(data.grantsSpendingAuthority,false);assert.equal(h.calls.length,1);
 assert.equal((await h.post('services',{url:'https://other.example'})).status,400);assert.equal(h.calls.length,1);
 const billing=await h.post('billing-costs',{inferenceIds:['11111111-1111-4111-8111-111111111111']});assert.equal((await billing.json()).error.code,'REPORTING_MIGRATION_PENDING');assert.equal(h.calls.length,1);
 assert.equal((await h.post('billing-costs',{inferenceIds:[],credential:'caller-key'})).status,400);
 assert.equal((await h.post('knowledge-ranking',{agentId:'missing',knowledgeIds:[],query:'q',model:'m'})).status,400);
 assert.equal(h.app.treasury.snapshot().version,0);assert.equal(Object.keys(h.app.journal.snapshot().operations).length,0);
});
