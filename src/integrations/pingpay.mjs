import {fingerprint,ContractError} from '../contracts.mjs';
import {credential,jsonRequest,readExchange,fixedOrigin} from './http.mjs';
export const PING_ORIGINS=Object.freeze(['https://pay.pingpay.io']);
const fail=code=>{throw new ContractError(code,code);};
export function validatePingRequirement(r){
 if(!r||r.scheme!=='exact'||typeof r.network!=='string'||typeof r.asset!=='string'||r.extra?.assetTransferMethod!=='near-intents'||r.extra?.paymentFlow!=='upfront')fail('PINGPAY_REQUIREMENT_UNSUPPORTED');return structuredClone(r);
}
export function pingRequest({kind,origin='https://pay.pingpay.io',amountOut,requirements,refundTo,quote,txHash,depositMemo,resourceId}){
 origin=fixedOrigin(origin,PING_ORIGINS);
 const binding={provider:'pingpay',origin,resourceId};
 if(typeof resourceId!=='string'||!resourceId||resourceId.length>160)fail('PINGPAY_RESOURCE_REQUIRED');
 if(kind==='pingpay_offers'){
  if(!/^[1-9]\d*$/.test(amountOut??''))fail('PINGPAY_PRICE_REQUIRED');
  return {binding,path:'/agentpay/x402/offers?amountOut='+amountOut,method:'GET',body:null};
 }
 const r=validatePingRequirement(requirements);
 let payload;
 if(kind==='pingpay_quote'){
  if(typeof refundTo!=='string'||!refundTo||refundTo.length>256)fail('PINGPAY_REFUND_REQUIRED');
  payload={type:'quote',refundTo};
 }else if(kind==='pingpay_settle'){
  if(!quote||quote.requirementsHash!==fingerprint(r)||typeof quote.operationToken!=='string'||typeof quote.depositAddress!=='string'||typeof txHash!=='string'||!txHash||txHash.length>256)fail('PINGPAY_ORIGINAL_QUOTE_REQUIRED');
  payload={type:'deposit',operationToken:quote.operationToken,depositAddress:quote.depositAddress,txHash,...(depositMemo?{depositMemo}:{})};
 }else fail('PINGPAY_OPERATION_UNSUPPORTED');
 return {binding,path:'/agentpay/x402/'+(kind==='pingpay_quote'?'verify':'settle'),method:'POST',body:{x402Version:2,paymentPayload:{x402Version:2,payload},paymentRequirements:r},requirementsHash:fingerprint(r)};
}
export function createPingPay({resolveSecret,secretRef='PING_API_KEY',transport=fetch,verifySettlement}={}){
 return {
  async prepare(request){const origin=fixedOrigin(request.binding.origin,PING_ORIGINS);if(!/^\/agentpay\/x402\/(offers\?amountOut=[1-9]\d*|verify|settle)$/.test(request.path))fail('PINGPAY_PATH_DENIED');const key=await credential(resolveSecret,secretRef);return {start:()=>jsonRequest(transport,origin+request.path,{'X-Api-Key':key},request.method==='GET'?undefined:request.body,{method:request.method}),request};},
  async decode(exchange,request){const v=exchange.value;
   if(!exchange.ok&&!request.path.endsWith('/settle'))return {status:exchange.httpStatus>=500?'unknown':'failed',code:'PINGPAY_PROVIDER_REFUSED',settlementVerified:false};
   if(request.path.startsWith('/agentpay/x402/offers')){if(!Array.isArray(v.accepts)||v.accepts.length>256)fail('PINGPAY_OFFERS_INVALID');return {status:'confirmed',offers:v.accepts.map(validatePingRequirement),settlementVerified:false};}
   if(request.path.endsWith('/verify')){
    const q=v.extra;
    if(v.isValid!==true||!q||typeof q.operationToken!=='string'||!q.operationToken||typeof q.depositAddress!=='string'||!q.depositAddress||!/^[1-9]\d*$/.test(q.amountIn??'')||!Number.isFinite(Date.parse(q.refundDeadline)))return {status:'unknown',code:'PINGPAY_QUOTE_UNAVAILABLE'};
    return {status:'confirmed',quote:{operationToken:q.operationToken,depositAddress:q.depositAddress,amountIn:q.amountIn,refundDeadline:q.refundDeadline,refundTo:request.body.paymentPayload.payload.refundTo,requirementsHash:request.requirementsHash},settlementVerified:false};
   }
   if(v.success!==true)return {status:exchange.httpStatus===402?'failed':v.errorReason==='settlement_pending'||v.extra?.status==='INCOMPLETE_DEPOSIT'?'pending':'unknown',code:v.extra?.status??v.errorReason??'PINGPAY_SETTLEMENT_UNKNOWN',settlementVerified:false};
   const proof=await verifySettlement?.({request,response:v,exchangeHash:exchange.wireHash});
   const verified=proof?.source==='independent-pingpay-settlement'&&proof.requestHash===fingerprint(request)&&proof.transaction===v.transaction&&proof.network===v.network;
   return {status:verified?'confirmed':'unknown',code:verified?null:'INDEPENDENT_SETTLEMENT_REQUIRED',transaction:v.transaction??null,network:v.network??null,settlementVerified:verified,proof:verified?proof:null};
  },
  async supported(){return readExchange(await jsonRequest(transport,'https://pay.pingpay.io/agentpay/x402/supported',{},undefined,{method:'GET'}));},
 };
}
