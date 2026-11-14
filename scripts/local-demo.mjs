import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{parent:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('npm run demo:local -- [--parent http://127.0.0.1:4173]\nOpen the real isolated local demo through an already running local workspace. No .env, provider calls, payments or funds.');}
else{
 const parent=new URL(values.parent??'http://127.0.0.1:4173');if(parent.protocol!=='http:'||parent.hostname!=='127.0.0.1'||parent.pathname!=='/'||parent.search||parent.hash||parent.username||parent.password)throw Error('Use the owning loopback workspace URL.');
 const r=await fetch(parent.origin+'/api/workspace/local-demo/open',{method:'POST',headers:{Origin:parent.origin,'Sec-Fetch-Site':'same-origin','content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)}),v=await r.json();
 if(!r.ok)throw Error(v.error?.message??'Start the local workspace and open its demo from the owner connection.');
 console.log(JSON.stringify({url:v.url,mode:'real-local-demo',paidCalls:0,originalCompanyUnchanged:true},null,2));
}
