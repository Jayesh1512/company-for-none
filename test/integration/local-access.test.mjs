import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {startServer} from '../../server.mjs';
import {isDirectLocalOwner} from '../../src/web/local-access.mjs';
import {renderWorkspace} from '../../public/workspace.js';
import {request as httpRequest} from 'node:http';

async function localServer(t,extra={}){
 const directory=await mkdtemp('/tmp/near-local-access-');let running;
 const options={directory,companyId:'local-access-test',configPath:null,port:0,host:'127.0.0.1',resolveSecret:async()=>{throw Error('No provider credential access authorized');},...extra};
 running=await startServer(options);t.after(async()=>{await running.close();await rm(directory,{recursive:true,force:true});});
 return {get runtime(){return running;},async restart(){await running.close();running=await startServer(options);}};
}

test('direct local workspace opens and mutates metadata without a token across refresh and restart; spending remains blocked',async t=>{
 const h=await localServer(t);
 for(const route of ['/api/workspace','/api/owner/status','/api/workspace/cloud','/api/workspace/autonomy','/api/knowledge'])assert.equal((await fetch(h.runtime.url+route)).status,200,route);
 const created=await fetch(h.runtime.url+'/api/agents',{method:'POST',headers:{'content-type':'application/json',origin:h.runtime.url,'sec-fetch-site':'same-origin'},body:JSON.stringify({name:'Local analyst',role:'Research',instructions:'Use permitted company sources.',skillIds:[]})});assert.equal(created.status,201);
 const cloud={product:'privacy_redact',input:{model:'test/privacy',input:'Fictional context'},timeoutMs:1000,maxInputBytes:10000,maxResponseBytes:10000};
 const attempted=await fetch(h.runtime.url+'/api/workspace/cloud/execute',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'no-budget'},body:JSON.stringify(cloud)});const result=await attempted.json();assert.equal(result.status,'not_submitted');assert.equal(result.completionSent,false);
 await h.restart();const view=await (await fetch(h.runtime.url+'/api/workspace')).json();assert.equal(view.agents.length,1);assert.equal(view.agents[0].name,'Local analyst');assert.equal(h.runtime.app.treasury.snapshot().version,0);assert.equal(Object.keys(h.runtime.app.journal.snapshot().operations).length,0);
});

test('cross-site, rebound host, proxy-forwarded and caller-asserted local identity cannot open private workspace',async t=>{
 const h=await localServer(t);
 for(const headers of [{'sec-fetch-site':'cross-site'},{'sec-fetch-site':'same-site'},{origin:'https://other.example'},{host:'rebound.example'},{'x-forwarded-for':'198.51.100.9'},{forwarded:'for=198.51.100.9'},{via:'proxy'},{'sec-fetch-dest':'image'},{'sec-fetch-site':'cross-site','x-local-owner':'true','x-owner-verified':'true'}]){
  const status=await new Promise((resolve,reject)=>{const r=httpRequest(h.runtime.url+'/api/workspace',{headers},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));});r.once('error',reject);r.end();});assert.equal(status,403,JSON.stringify(headers));
 }
 const post=await fetch(h.runtime.url+'/api/agents',{method:'POST',headers:{'content-type':'application/json',origin:'https://other.example'},body:JSON.stringify({name:'Blocked',role:'Blocked',instructions:'Blocked',skillIds:[]})});assert.equal(post.status,403);
 assert.equal(h.runtime.app.journal.list('agents').length,0);
 // A URL alone is not transport trust; direct library callers retain authentication checks.
 assert.equal((await h.runtime.app.web.handle(new Request(h.runtime.url+'/api/workspace'))).status,403);
});

test('remote or forwarded deployment can disable local access and retain protected API bearer authentication',async t=>{
 const h=await localServer(t,{localOwnerAccess:false,ownerToken:'test-only-api-owner'});
 assert.equal((await fetch(h.runtime.url+'/api/workspace')).status,403);
 assert.equal((await fetch(h.runtime.url+'/api/workspace',{headers:{authorization:'Bearer test-only-api-owner'}})).status,200);
 assert.equal((await fetch(h.runtime.url+'/api/owner/status',{headers:{authorization:'Bearer test-only-api-owner'}})).status,200);
 assert.equal((await fetch(h.runtime.url+'/api/workspace',{headers:{authorization:'Bearer incorrect'}})).status,403);
});

test('automatic access requires actual loopback socket and exact listening authority, never supplied forwarding headers',()=>{
 const req={socket:{remoteAddress:'127.0.0.1',localPort:4173},headers:{host:'localhost:4173'}};
 assert.equal(isDirectLocalOwner(req),true);assert.equal(isDirectLocalOwner(req,{enabled:false}),false);
 for(const address of ['198.51.100.1','10.0.0.1','::ffff:198.51.100.1',undefined])assert.equal(isDirectLocalOwner({...req,socket:{remoteAddress:address,localPort:4173}}),false);
 for(const host of ['localhost:9999','localhost:4173@other.example','localhost:4173/path','127.0.0.1.evil:4173'])assert.equal(isDirectLocalOwner({...req,headers:{host}}),false);
 assert.equal(isDirectLocalOwner({socket:{remoteAddress:'::1',localPort:4173},headers:{host:'[::1]:4173'}}),true);
});

test('UI has no owner-token entry form, storage credential or repeated login step',async()=>{
 const {readFile}=await import('node:fs/promises');const app=await readFile(new URL('../../public/app.js',import.meta.url),'utf8');
 assert.doesNotMatch(app,/ownerSession|sessionStorage\.getItem\('one:owner'\)/);
 const base={route:{page:'settings',params:new URLSearchParams()},data:{agents:[],tasks:[],catalog:[],activity:[]},status:{mode:'setup'},owner:{safety:{killSwitch:true}}};
 const html=renderWorkspace(base);assert.doesNotMatch(html,/id="owner-form"|Owner access token|name="token"/);assert.match(html,/opens the workspace automatically/);
 const denied=renderWorkspace({...base,workspaceAccessDenied:true});assert.match(denied,/Workspace access unavailable/);assert.doesNotMatch(denied,/owner-form|type="password"/);
});
