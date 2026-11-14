import {parseArgs} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {createApp} from '../src/app.mjs';
import {createIntentsClient} from '../src/payments/http.mjs';
import {createPaymentSignatureVerifier} from '../src/payments/signatures.mjs';

// Explicit read-only evidence collection. No .env load, credential use, paid
// inference, invoice creation, account/grant provisioning, signing or broadcast.
const {values}=parseArgs({options:{network:{type:'string'},account:{type:'string'},model:{type:'string'},out:{type:'string'}}});
if(values.network!=='mainnet'||!values.model||!values.account||!(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(values.account))||values.account.length>64)throw Error('Explicit approved mainnet account and exact selected model are required.');
const startedAt=new Date().toISOString(),runId=startedAt.replaceAll(/[:.]/g,'-'),out=path.resolve(values.out??`artifacts/live-evidence/${runId}`),privateStore=path.resolve('.runtime/live-evidence',runId);
await mkdir(path.dirname(out),{recursive:true});
await mkdir(out,{recursive:false}); // Preserve each evidence run; choose a new directory.
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[],parsed=new Map();
async function capture(name,url,{body}={}){
 const method=body?'POST':'GET',observedAt=new Date().toISOString(),start=performance.now();
 try{
  const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const reader=response.body?.getReader(),chunks=[];let size=0;if(!reader)throw Error('RESPONSE_UNAVAILABLE');
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>2097152){await reader.cancel();throw Error('RESPONSE_TOO_LARGE');}chunks.push(r.value);}
  const bytes=Buffer.concat(chunks),filename=name+'.response.json';await writeFile(path.join(out,filename),bytes);
  let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{value=null;}
  if(value!==null)parsed.set(name,value);
  const record={name,url,method,requestBody:body??null,observedAt,httpStatus:response.status,bytes:bytes.length,sha256:sha(bytes),responseFile:filename,contentType:response.headers.get('content-type'),elapsedMs:Math.round(performance.now()-start),authenticated:false,readOnly:true};results.push(record);console.log(JSON.stringify({captured:name,httpStatus:record.httpStatus,bytes:record.bytes}));return value;
 }catch(error){const record={name,url,method,observedAt,httpStatus:null,error:error.name==='TimeoutError'?'TIMEOUT':error.message==='RESPONSE_TOO_LARGE'?error.message:'READ_UNAVAILABLE',authenticated:false,readOnly:true};results.push(record);console.log(JSON.stringify({captured:name,error:record.error}));return null;}
}
await Promise.allSettled([
 capture('cloud-models','https://cloud-api.near.ai/v1/models'),
 capture('cloud-pricing','https://cloud-api.near.ai/v1/model/list?limit=1000&offset=0'),
 capture('cloud-services','https://cloud-api.near.ai/v1/services'),
 capture('intents-tokens','https://1click.chaindefuser.com/v0/tokens'),
 capture('agent-api-schema','https://api.agentsonintents.com/openapi.json'),
 capture('agent-public-tee-info','https://api.agentsonintents.com/tee/info'),
 capture('near-mainnet-status','https://rpc.mainnet.near.org',{body:{jsonrpc:'2.0',id:'live-evidence-status',method:'status',params:[]}}),
 capture('near-mainnet-final-block','https://rpc.mainnet.near.org',{body:{jsonrpc:'2.0',id:'live-evidence-block',method:'block',params:{finality:'final'}}}),
 capture('deployment-wallet','https://rpc.mainnet.near.org',{body:{jsonrpc:'2.0',id:'live-evidence-wallet',method:'query',params:{request_type:'view_account',finality:'final',account_id:values.account}}}),
]);
const app=await createApp({directory:privateStore,configPath:'',companyId:'local-workspace',componentModel:values.model});
let attestation,dryQuote={attempted:false,reasonCode:'TOKEN_PAIR_NOT_IN_CURRENT_CATALOG',spendAuthorized:false};
try{
 const access={verified:true,role:'owner',companyId:'local-workspace'};
 console.log('Starting actual official-SDK attestation preflight; no completion.');
 const preflight=await app.components.preflight(access),v=preflight.verification;
 attestation={status:v.status,reasonCode:v.reasonCode??null,scope:'gateway-and-model-attestation-only',model:v.model,sdk:v.sdk,verifiedAt:v.verifiedAt,policyFingerprint:v.verificationPolicyFingerprint??v.policyFingerprint,gateway:v.gateway,models:v.models,requestFingerprint:v.requestFingerprint,evidenceRef:v.evidenceRef,completionSent:false,acceptedModelOutput:false,plaintextBindingStatus:v.plaintextBindingStatus??'unavailable',durableReplayStatus:v.durableReplayStatus??'unavailable'};
 await writeFile(path.join(out,'cloud-attestation-summary.json'),JSON.stringify(attestation,null,2)+'\n');
 console.log(JSON.stringify({attestation:attestation.status,reasonCode:attestation.reasonCode}));
 const tokens=parsed.get('intents-tokens');
 const origin=Array.isArray(tokens)?tokens.find(t=>t.blockchain==='near'&&t.symbol==='USDC'&&t.decimals===6):null,destination=Array.isArray(tokens)?tokens.find(t=>t.assetId==='nep141:wrap.near'):null;
 if(origin&&destination){
  // Illustrative one-USDC input only. dry:true asks for market data, not a
  // customer quote/invoice, deposit instructions or an authorized swap.
  const request={dry:true,swapType:'EXACT_INPUT',slippageTolerance:100,originAsset:origin.assetId,depositType:'ORIGIN_CHAIN',destinationAsset:destination.assetId,amount:'1000000',refundTo:values.account,refundType:'ORIGIN_CHAIN',recipient:values.account,recipientType:'DESTINATION_CHAIN',deadline:new Date(Date.now()+15*60*1000).toISOString()};
  let exchangeRecord;
  const client=createIntentsClient({persistExchange:async exchange=>{exchangeRecord=exchange;await writeFile(path.join(out,'intents-dry-quote-exchange.json'),JSON.stringify(exchange,null,2)+'\n');const ref=await app.journal.putArtifact({actionId:'live-dry-quote:'+randomUUID(),content:JSON.stringify(exchange),mediaType:'application/json'});return 'private:'+ref.id;}});
  try{
   const received=await client.quoteWithEvidence(request),verification=await createPaymentSignatureVerifier({journal:app.journal}).verifyQuote({evidenceRef:received.evidenceRef});
   const echoed=received.body.quoteRequest??received.body.request;
   dryQuote={attempted:true,httpStatus:exchangeRecord?.response.httpStatus??null,illustrativeInput:true,request,requestDryEcho:echoed?.dry??null,signature:verification,depositInstructionsAccepted:false,settlementVerified:false,transactionSent:false,spendAuthorized:false,quoteAmountIn:received.body.quote?.amountIn??null,quoteAmountOut:received.body.quote?.amountOut??null};
  }catch(error){dryQuote={attempted:true,httpStatus:exchangeRecord?.response.httpStatus??null,request,reasonCode:error.code??'PROVIDER_QUOTE_UNAVAILABLE',illustrativeInput:true,depositInstructionsAccepted:false,settlementVerified:false,transactionSent:false,spendAuthorized:false};}
 }
 await writeFile(path.join(out,'intents-dry-quote-summary.json'),JSON.stringify(dryQuote,null,2)+'\n');
}finally{await app.close();}
const models=parsed.get('cloud-models'),services=parsed.get('cloud-services'),tokens=parsed.get('intents-tokens'),status=parsed.get('near-mainnet-status'),block=parsed.get('near-mainnet-final-block'),wallet=parsed.get('deployment-wallet');
const observations={cloudModelCount:Array.isArray(models?.data)?models.data.length:null,tokenCount:Array.isArray(tokens)?tokens.length:null,servicesShape:Array.isArray(services)?'array':services&&typeof services==='object'?'object':'unavailable',network:status?.result?.chain_id??null,finalBlockHeight:block?.result?.header?.height??null,finalBlockHash:block?.result?.header?.hash??null,wallet:{accountId:values.account,exists:Boolean(wallet?.result),rpcError:wallet?.error?.cause?.name??null,codeHash:wallet?.result?.code_hash??null},attestationStatus:attestation?.status??'unavailable',dryQuoteHttpStatus:dryQuote.httpStatus??null,dryQuoteSignatureStatus:dryQuote.signature?.status??'unavailable'};
const manifest={schemaVersion:1,runId,startedAt,completedAt:new Date().toISOString(),collectionKind:'actual-free-live-read-only',networkSelected:values.network,modelSelected:values.model,requests:results,observations,attestationSummary:'cloud-attestation-summary.json',dryQuoteSummary:'intents-dry-quote-summary.json',privateRawSdkStore:path.relative(process.cwd(),privateStore),credentialsUsed:false,paidInferenceCalls:0,swapOrTransferSubmitted:false,mainnetTransactionsSent:0,providerAccountsCreated:0,spendUsd:'0',provesAcceptedPrivateInference:false,provesLiveBusinessLoop:false,scoreChangeClaimed:false};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const filename of ['cloud-attestation-summary.json','intents-dry-quote-summary.json']){const bytes=await readFile(path.join(out,filename));await writeFile(path.join(out,filename+'.sha256'),sha(bytes)+'  '+filename+'\n');}
console.log(JSON.stringify({output:out,observations,spendUsd:'0',mainnetTransactionsSent:0}));
