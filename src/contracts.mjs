import { createHash } from 'node:crypto';

/** @typedef {{network:string,asset:string,decimals:number,amount:string}} Money */
/** @typedef {{status:'allow'|'deny'|'hold',reasonCode:string,actionFingerprint:string,policyVersion:string,policyEpoch:number,financialVersion:number,plan?:object,permit?:object}} RulesDecision */
/** @typedef {{actionId:string,fingerprint:string,purpose:string,provider:string,network:string,status?:string}} OperationRef */
/** @typedef {{status:'not_submitted'|'pending'|'confirmed'|'failed'|'unknown',mode:'fixture'|'testnet'|'live'|'unavailable',operation?:OperationRef,evidence:object[]}} ExternalResult */
/** @typedef {{id:string,actionId:string,accountingDay:string,upperBoundNanoUsd:string,status:string}} SpendReservation */
/** @typedef {{id:string,orderId:string,recipient:string,money:Money,completedAmount:string,status:string}} ContributorObligation */
/** @typedef {{id:string,orderId:string,content:string,hash:string,sources:object[],qualifications:string[],validation:object}} ReportArtifact */

export const SCHEMA_VERSION = 1;
export const EXTERNAL_STATUSES = Object.freeze(['not_submitted','pending','confirmed','failed','unknown']);
export const MODES = Object.freeze(['fixture','testnet','live','unavailable']);
export class ContractError extends Error {
  constructor(code, message) { super(message); this.name='ContractError'; this.code=code; }
}
export function assert(condition, message, code='INVALID_INPUT') { if (!condition) throw new ContractError(code,message); }
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}
export function fingerprint(value) { return createHash('sha256').update(canonicalize(value)).digest('hex'); }
export const hash = fingerprint;
export function assertIntegerString(value, name='amount') { assert(typeof value==='string' && /^(0|[1-9]\d*)$/.test(value),`${name} must be a nonnegative integer string`); return value; }
export function assertMoney(value) {
  assert(value && typeof value==='object','Money required');
  assert(typeof value.network==='string' && value.network.length>0,'Money.network required');
  assert(typeof value.asset==='string' && value.asset.length>0,'Money.asset required');
  assert(Number.isInteger(value.decimals) && value.decimals>=0 && value.decimals<=30,'Money.decimals invalid');
  assertIntegerString(value.amount,'Money.amount'); return value;
}
export const validateMoney = assertMoney;
export function sameAsset(a,b) { assertMoney(a); assertMoney(b); return a.network===b.network && a.asset===b.asset && a.decimals===b.decimals; }
export function assertExternalResult(value) { assert(value && EXTERNAL_STATUSES.includes(value.status),'ExternalResult.status invalid'); assert(MODES.includes(value.mode),'ExternalResult.mode invalid'); return value; }
export function assertRulesDecision(value) { assert(value && ['allow','deny','hold'].includes(value.status),'RulesDecision.status invalid'); assert(typeof value.reasonCode==='string','RulesDecision.reasonCode required'); return value; }
export function assertOperation(value) { assert(value && typeof value.actionId==='string' && value.actionId,'Operation.actionId required'); assert(typeof value.fingerprint==='string' && value.fingerprint,'Operation.fingerprint required'); return value; }
export function assertOrderSpec(value) { assert(value && typeof value.id==='string' && value.id,'Order.id required'); assert(typeof value.question==='string' && value.question.trim(),'Order.question required'); return value; }
export const examples = Object.freeze({
  money: {network:'fixture',asset:'usdc',decimals:6,amount:'5000000'},
  invalidMoney: {network:'fixture',asset:'usdc',decimals:6,amount:'5.0'},
  operation: {actionId:'order:example:inference',fingerprint:fingerprint({orderId:'example',purpose:'inference'}),purpose:'inference',orderId:'example',provider:'fixture',network:'fixture'},
  pending: {status:'pending',mode:'fixture',evidence:[]},
  unknown: {status:'unknown',mode:'fixture',code:'UNKNOWN_OUTCOME',evidence:[],reconciliationRequired:true},
});
