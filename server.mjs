import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from './src/app.mjs';
import {loadEnvFile} from 'node:process';
import {isDirectLocalOwner} from './src/web/local-access.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
export async function startServer(options={}) {
  const app=options.app??await createApp(options);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('Cache-Control','no-store');
    try {
      const url=new URL(req.url,`http://${req.headers.host??'localhost'}`);
      if(url.pathname.startsWith('/api/')) {
        const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
        // Socket-derived trust stays out of request headers/body. Remote and
        // forwarded requests still need their configured authentication.
        const response=await app.web.handle(request,{localOwner:isDirectLocalOwner(req,{enabled:options.localOwnerAccess??process.env.SHOP_LOCAL_OWNER_ACCESS!=='false'})});
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
      const decoded=decodeURIComponent(url.pathname),relative=decoded==='/'?'index.html':decoded.slice(1);
      const publicRoot=path.join(root,'public'),target=path.resolve(publicRoot,relative);
      if(!target.startsWith(publicRoot+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
      if(!(await stat(target)).isFile()){res.writeHead(404);res.end('Not found');return;}
      const content=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]??'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});res.end(error.code==='ENOENT'?'Not found':'Request failed');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port??Number(process.env.PORT??4173),options.host??process.env.HOST??'127.0.0.1',resolve);});
  const address=server.address(),url=`http://127.0.0.1:${address.port}`;
  let localDemo=null,demoLoading=null,closing=false;
  if(options.enableLocalDemo!==false&&!app.localDemoContext&&app.demoControl)app.demoControl.open=async()=>{
    if(closing)throw Object.assign(Error('Workspace closing'),{code:'LOCAL_DEMO_CLOSING'});
    demoLoading??=(async()=>{const {createLocalDemoLauncher}=await import('./src/demo/local.mjs');return localDemo=createLocalDemoLauncher({directory:options.demoDirectory??path.join(root,'.runtime/local-real-demo-v1'),binary:options.demoBinary??process.env.SHOP_JBRAIN_BINARY??path.join(root,'.runtime/dependencies/jbrain/target/release/jbrain'),returnUrl:url,serve:startServer});})();
    await demoLoading;if(closing)throw Object.assign(Error('Workspace closing'),{code:'LOCAL_DEMO_CLOSING'});
    return localDemo.open();
  };
  return {app,server,url,close:async()=>{closing=true;await demoLoading?.catch(()=>{});await localDemo?.close();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await app.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const runtime=await startServer();console.log(`Autonomous Research Shop (${runtime.app.rules.snapshot().mode}): ${runtime.url}`);
  let recovering=false;
  const timer=setInterval(()=>{if(!recovering){recovering=true;Promise.all([runtime.app.workflow.recover(),runtime.app.knowledge?.recover(),runtime.app.autonomy?.tick()]).catch(error=>console.error('Recovery:',error.code??error.message)).finally(()=>{recovering=false;});}},1000);timer.unref();
  let shuttingDown=false;
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(shuttingDown)return;shuttingDown=true;clearInterval(timer);runtime.close().then(()=>process.exit(0));});
}
