// Public read-only catalogs only: no credentials, accounts, quotes, funds or inference.
import { mkdir,writeFile } from 'node:fs/promises';
const targets=[
  {module:'M05',provider:'near-intents',url:'https://1click.chaindefuser.com/v0/tokens'},
  {module:'M07',provider:'near-ai-cloud',url:'https://cloud-api.near.ai/v1/models'},
];
async function probe(target) {
  const started=performance.now();
  try {
    const response=await fetch(target.url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
    const body=await response.json();const rows=Array.isArray(body)?body:body.data;
    return {...target,httpStatus:response.status,count:Array.isArray(rows)?rows.length:null,elapsedMs:Math.round(performance.now()-started),evidence:'public-catalog-only',liveExecutionProven:false};
  }catch(error){return {...target,httpStatus:null,error:error.name,elapsedMs:Math.round(performance.now()-started),liveExecutionProven:false};}
}
const probes=await Promise.all(targets.map(probe));
const result={schemaVersion:1,checkedAt:new Date().toISOString(),mode:'real-free-public-read-only',credentialValuesRead:false,fundsMoved:false,inferenceCalled:false,probes,liveGates:['Official Intents testnet route unresolved','Autonomous Cloud credit purchase unverified','Explicit funded credentials/caps and execution evidence absent']};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/research-shop-public-probes.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
