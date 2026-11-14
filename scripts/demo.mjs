import { mkdtemp,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../test/helpers/create-fixture-app.mjs';

await mkdir('.runtime',{recursive:true});
const directory=await mkdtemp(path.resolve('.runtime/demo-'));
const app=await createApp({directory});
const runs=[];
try {
  for(const [index,sourceAsset] of ['demo-usdc','demo-near','demo-usdc'].entries()) {
    const started=performance.now();
    const {order,accessToken}=await app.workflow.createOrder({question:`What research evidence should a small business validate before choosing a market? Demonstration ${index+1}.`,geography:'Local fixture',timeHorizon:'Current demonstration',sourceAsset});
    await app.workflow.quote(order.id);await app.workflow.confirmFixturePayment(order.id);
    const finished=await app.workflow.run(order.id),artifact=await app.workflow.getReport(order.id,{token:accessToken});
    const elapsedMs=Math.round(performance.now()-started);
    if(finished.order.status!=='complete')throw new Error(`Run ${index+1}: ${finished.order.reasonCode??finished.order.status}`);
    runs.push({orderId:order.id,sourceAsset,status:finished.order.status,elapsedMs,mode:'fixture',sources:artifact.sources.length,reportHash:artifact.hash});
    console.log(`Fixture run ${index+1}: complete in ${elapsedMs} ms (${sourceAsset}; ${artifact.sources.length} controlled sources).`);
  }
  const result={schemaVersion:1,recordedAt:new Date().toISOString(),mode:'fixture',liveProven:false,disclosure:'Simulated payments, custody, credit purchases, deterministic generation and payouts. No live research/inference or real money movement. Timings do not prove the strict live/testnet target.',directory,runs,financial:app.treasury.snapshot(),ledger:await app.ledger.view(),liveGates:app.workflow.status().strictGates};
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/mvp-demo.json',JSON.stringify(result,null,2)+'\n');
  console.log('Evidence saved to artifacts/mvp-demo.json; private journal remains in the displayed .runtime/demo-* directory.');
}finally{await app.close();}
