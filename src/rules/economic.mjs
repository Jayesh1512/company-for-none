import {hash, integer, sameAsset, validateMoney} from './config.mjs';
import {allow, deny, hold} from './policies.mjs';

const text = x => typeof x === 'string' && !!x.trim();
const scope = (resource,binding) => hash({resource,binding});
function bound(binding, runtime, config, companyId, resource) {
  const e=runtime?.economicIdentity;
  if(!binding||!e||binding.companyId!==companyId||e.companyId!==companyId)return false;
  if(Object.keys(binding).some(k=>!['provider','companyId','accountId','organizationId','credentialId','network','asset','decimals','bucket'].includes(k)))return false;
  if(['provider','accountId','network','asset','bucket'].some(k=>!text(binding[k])))return false;
  if(!Number.isInteger(binding.decimals)||binding.decimals<0||binding.decimals>30)return false;
  if(!['organizationId','credentialId'].every(k=>binding[k]===null||text(binding[k])))return false;
  // Independent provider accounts have independent bindings. The composition
  // must explicitly select them; sharing a chain/asset never establishes scope.
  const expected=resource==='credit'?e.creditBinding:(e.cashBinding??e);
  if(!expected)return false;
  const accountId=expected.accountId??expected.treasuryAccount;
  if(accountId!==binding.accountId||expected.provider!==binding.provider||expected.bucket!==binding.bucket||expected.network!==binding.network)return false;
  const asset=expected.settlementAsset??expected;
  if(asset.asset!==binding.asset||asset.decimals!==binding.decimals)return false;
  if((expected.organizationId??null)!==binding.organizationId||(expected.credentialId??null)!==binding.credentialId)return false;
  return resource!=='cash'||(binding.accountId===config.treasuryAccount&&sameAsset(binding,config.settlementAsset)&&(config.mode!=='live'||binding.bucket==='confidential')&&(e.bucket==null||binding.bucket===e.bucket));
}
function validWatermark(value) { return value&&text(value.stream)&&integer(value.position)>=0n; }
function trustedRecord(records,id) {
  const matches=(Array.isArray(records)?records:[]).filter(r=>r?.id===id||r?.receiptId===id);
  return matches.length===1?matches[0]:null;
}
function amount(record,resource) {
  if(resource==='cash'){validateMoney(record.money);return integer(record.money.amount);}
  return integer(record.availableNanoUsd??record.credit?.availableNanoUsd);
}

export function economicDecision(action,facts,config,policyVersion,now,runtime,companyId) {
  const snapshot=action.type==='balance_snapshot';
  const r=trustedRecord(snapshot?runtime?.economicObservations:runtime?.economicReceipts,snapshot?action.observationId:action.receiptId);
  if(!r||r.status!=='verified'||!text(r.evidenceRef))return hold('ECONOMIC_EVIDENCE_REQUIRED');
  const resource=snapshot?r.resource:action.type.startsWith('cash_')?'cash':'credit';
  if(!['cash','credit'].includes(resource)||(!snapshot&&r.kind!==action.type))return deny('ECONOMIC_RESOURCE_MISMATCH');
  if(!bound(r.binding,runtime,config,companyId,resource))return deny('ECONOMIC_BINDING_MISMATCH');
  if(!validWatermark(r.watermark))return deny('ECONOMIC_WATERMARK_REQUIRED');
  if(resource==='cash'&&!sameAsset(r.money,r.binding))return deny('ECONOMIC_ASSET_MISMATCH');
  const observed=amount(r,resource),financial=facts.financial;
  if(!financial||!Number.isSafeInteger(financial.version))return hold('FINANCIAL_FACTS_REQUIRED');
  const scopeId=scope(resource,r.binding);
  const opening=financial.openingRecords?.find(x=>x.scopeId===scopeId||scope(resource,x.binding)===scopeId);
  if(snapshot){
    if(!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>now)return deny('ECONOMIC_OBSERVATION_TIME_INVALID');
    const prior=(financial.providerObservations??[]).filter(x=>x.scopeId===scopeId||scope(x.resource,x.binding)===scopeId).sort((a,b)=>integer(a.watermark.position)<integer(b.watermark.position)?1:-1)[0];
    if(prior&&(prior.watermark.stream!==r.watermark.stream||integer(r.watermark.position)<=integer(prior.watermark.position)))return hold('ECONOMIC_OBSERVATION_STALE');
    const expected=resource==='cash'?(financial.balances??[]).filter(x=>sameAsset(x,r.money)).reduce((sum,x)=>sum+integer(x.amount),0n):integer(financial.credits?.availableNanoUsd??'0');
    if(r.unresolvedOperationIds!=null&&(!Array.isArray(r.unresolvedOperationIds)||r.unresolvedOperationIds.some(x=>!text(x))))return deny('ECONOMIC_OPERATION_FACTS_INVALID');
    const unresolved=[...new Set([...(r.unresolvedOperationIds??[]),...(financial.reservations??[]).filter(x=>['unknown','pending'].includes(x.status)).map(x=>x.actionId??x.id)])].sort();
    const movements=(financial.economicMovements??[]).filter(x=>x.scopeId===scopeId);
    const latest=[opening,...movements].filter(Boolean).sort((a,b)=>integer(a.watermark.position)<integer(b.watermark.position)?1:-1)[0];
    const positionBehind=latest&&(latest.watermark.stream!==r.watermark.stream||integer(r.watermark.position)<integer(latest.watermark.position));
    const status=!opening||positionBehind?'unreconciled':unresolved.length?'pending':observed<expected?'deficit':observed>expected?'surplus':'matched';
    const observation={id:r.id,resource,binding:structuredClone(r.binding),watermark:structuredClone(r.watermark),observedAt:r.observedAt,evidenceRef:r.evidenceRef,...(resource==='cash'?{money:structuredClone(r.money)}:{availableNanoUsd:observed.toString()})};
    return allow({plan:{kind:'balance_snapshot',observation,reconciliation:{status,expectedAmount:expected.toString(),observedAmount:observed.toString(),unresolvedOperationIds:unresolved,...(!opening?{reasonCode:'ECONOMIC_OPENING_REQUIRED'}:positionBehind?{reasonCode:'ECONOMIC_SNAPSHOT_BEHIND_MOVEMENT'}:{})},grantsSpendingAuthority:false}});
  }
  if(!text(r.receiptId)||!text(r.provenance))return hold('ECONOMIC_RECEIPT_REQUIRED');
  const isOpening=action.type.endsWith('_opening');
  if(isOpening){
    const approval=r.ownerBindingApproval;
    if(!approval||!text(approval.id)||approval.companyId!==companyId||approval.scopeId!==scopeId||approval.policyVersion!==policyVersion)return hold('OWNER_BINDING_APPROVAL_REQUIRED');
    if(opening)return deny('ECONOMIC_OPENING_ALREADY_RECORDED');
    if(resource==='cash'?(financial.balances??[]).some(x=>sameAsset(x,r.money)):(financial.credits?.lots?.length||integer(financial.credits?.availableNanoUsd??'0')>0n))return deny('LEGACY_RESOURCE_ALREADY_RECORDED');
    if((financial.economicMovements??[]).some(x=>x.resource===resource))return deny('ECONOMIC_MOVEMENT_ALREADY_RECORDED');
  }else{
    if(!opening)return hold('ECONOMIC_OPENING_REQUIRED');
    if(!text(r.providerReference)||(runtime.economicObservations??[]).some(o=>o.id===r.providerReference))return hold('PROVIDER_TRANSACTION_REFERENCE_REQUIRED');
    if(r.watermark.stream!==opening.watermark.stream||integer(r.watermark.position)<=integer(opening.watermark.position))return deny('ECONOMIC_RECEIPT_STALE');
    if((financial.economicMovements??[]).some(x=>x.providerReference===r.providerReference))return deny('ECONOMIC_REFERENCE_REUSED');
  }
  if(financial.receipts?.some(x=>x.id===r.receiptId||x.id===`receipt:${r.receiptId}`))return deny('ECONOMIC_RECEIPT_ALREADY_RECORDED');
  const credit=r.credit;
  if(resource==='credit'&&(!credit||!text(credit.id)||credit.owner!==r.binding.accountId||credit.provider!==r.binding.provider||!text(credit.provenance)))return deny('CREDIT_BINDING_MISMATCH');
  return allow({plan:{kind:action.type,receiptId:r.receiptId,binding:structuredClone(r.binding),watermark:structuredClone(r.watermark),evidenceRef:r.evidenceRef,provenance:r.provenance,...(isOpening?{}:{providerReference:r.providerReference}),...(resource==='cash'?{money:structuredClone(r.money)}:{credit:structuredClone(credit)}),grantsSpendingAuthority:false}});
}

export function economicSafety(financial, runtime, config, companyId, resources, now) {
  if(!financial)return hold('FINANCIAL_FACTS_REQUIRED');
  if(!Number.isFinite(now))return hold('ECONOMIC_TIME_FACTS_REQUIRED');
  for(const resource of resources){
    const rows=(financial.balanceReconciliations??[]).filter(x=>x.resource===resource);
    if(!rows.length)return hold('BALANCE_RECONCILIATION_REQUIRED');
    for(const row of rows){
      const observation=(financial.providerObservations??[]).find(x=>x.id===row.observationId&&scope(x.resource,x.binding)===row.scopeId);
      if(!observation||!bound(observation.binding,runtime,config,companyId,resource))return hold('ECONOMIC_BINDING_MISMATCH');
      const records=(runtime?.economicObservations??[]).filter(x=>x.resource===resource&&x.binding&&scope(x.resource,x.binding)===row.scopeId);
      if(!records.length)return hold('CURRENT_ECONOMIC_OBSERVATION_REQUIRED');
      if(records.some(x=>!Number.isFinite(Date.parse(x.observedAt))))return hold('ECONOMIC_OBSERVATION_TIME_INVALID');
      records.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)|| (integer(a.watermark?.position)<integer(b.watermark?.position)?1:-1));
      const latest=records[0],observedAt=Date.parse(latest.observedAt);
      if(latest.status!=='verified'||!text(latest.evidenceRef))return hold('ECONOMIC_OBSERVATION_UNVERIFIED');
      if(observedAt>now||now-observedAt>=60000||(latest.expiresAt!=null&&(!Number.isFinite(Date.parse(latest.expiresAt))||Date.parse(latest.expiresAt)<=now)))return hold('ECONOMIC_OBSERVATION_EXPIRED');
      if(records.some(x=>x.watermark?.stream!==observation.watermark.stream))return hold('ECONOMIC_OBSERVATION_STREAM_MISMATCH');
      const latestPosition=records.reduce((max,x)=>integer(x.watermark.position)>max?integer(x.watermark.position):max,integer(observation.watermark.position));
      if(latestPosition>integer(observation.watermark.position)||latest.id!==observation.id||hash(latest.watermark)!==hash(observation.watermark)||amount(latest,resource)!==amount(observation,resource)||latest.evidenceRef!==observation.evidenceRef)return hold('ECONOMIC_OBSERVATION_NOT_RECONCILED');
      if(row.status!=='matched')return hold('BALANCE_RECONCILIATION_REQUIRED',{reconciliationStatus:row.status});
      const expected=resource==='cash'?(financial.balances??[]).filter(x=>sameAsset(x,observation.money)).reduce((sum,x)=>sum+integer(x.amount),0n):integer(financial.credits?.availableNanoUsd??'0');
      if(integer(row.expectedAmount)!==expected||integer(row.observedAmount)!==expected)return hold('BALANCE_RECONCILIATION_STALE');
      if((financial.economicMovements??[]).some(x=>x.scopeId===row.scopeId&&(x.watermark.stream!==row.watermark.stream||integer(x.watermark.position)>integer(row.watermark.position))))return hold('BALANCE_RECONCILIATION_STALE');
    }
  }
  return null;
}
