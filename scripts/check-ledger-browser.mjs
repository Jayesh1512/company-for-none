import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.argv[2]??'http://127.0.0.1:4173',dir=path.resolve('artifacts/onchain-ledger');await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?onchain-browser=1#autonomy/ledger');await page.getByRole('heading',{name:'NEAR on-chain ledger',exact:true}).waitFor();
 await page.getByText('No confirmed batch',{exact:true}).waitFor();assert.equal(await page.locator('.near-ledger-panel input[type=password]').count(),0);
 assert.ok(await page.locator('.near-ledger-properties').innerText().then(s=>s.includes('755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b')));
 await page.screenshot({path:path.join(dir,'ledger-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Read chain status',exact:true}).click();await page.getByText('Account not funded',{exact:true}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export safe ledger records',exact:true}).click();const download=await downloadPromise,filename=path.join(dir,'safe-records-browser-export.json');await download.saveAs(filename);
 const exported=JSON.parse(await readFile(filename,'utf8'));assert.equal(exported.rawDataPublished,false);assert.ok(exported.records.length>0);assert.ok(exported.records.every(r=>Object.keys(r).sort().join(',')==='actorHash,at,hash,payloadHash,previousHash,sequence,type'));
 assert.doesNotMatch(JSON.stringify(exported),/private_key|PRIVATE CUSTOMER TEXT|500 demo dollars|Northstar Care/);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(dir,'ledger-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);const proof={at:new Date().toISOString(),url:base+'/#autonomy/ledger',network:'mainnet-selected',mainnetTransactions:0,paidCalls:0,wallet:'unfunded',privateKeyVisible:false,exportedRecords:exported.records.length,rawDataExported:false,desktopWidth:1440,mobileWidth:390,mobileOverflow:false,mobileNavigationHidden:true,pageErrors:errors};await writeFile(path.join(dir,'browser-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser.close();}
