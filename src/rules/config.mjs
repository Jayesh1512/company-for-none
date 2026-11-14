import { canonicalize, fingerprint } from '../contracts.mjs';
import {validateAutonomyPolicy} from './autonomy-policy.mjs';
import {validateIntegrationPolicy} from './integrations.mjs';
export const TCB_STATUSES = Object.freeze(['UpToDate','SWHardeningNeeded','ConfigurationNeeded','ConfigurationAndSWHardeningNeeded','OutOfDate','OutOfDateConfigurationNeeded','TDRelaunchAdvised','TDRelaunchAdvisedConfigurationNeeded']);

export class ConfigError extends Error {
  constructor(message) { super(message); this.name = 'ConfigError'; this.code = 'INVALID_CONFIG'; }
}
const fail = message => { throw new ConfigError(message); };
export const isIntegerAmount = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
export function integer(value, name = 'amount') {
  if (!isIntegerAmount(value)) throw new TypeError(`${name} must be a nonnegative decimal integer string`);
  return BigInt(value);
}
export const stableStringify = canonicalize;
export const hash = fingerprint;
export function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function object(value, keys, path) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail(`${path} must be an object`);
  for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${path}.${key} is required`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key} is unknown`);
}
function text(value, path) { if (typeof value !== 'string' || !value.trim() || value.length > 512) fail(`${path} must be nonempty text`); }
function bool(value, path) { if (typeof value !== 'boolean') fail(`${path} must be boolean`); }
function int(value, min, max, path) { if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${path} must be an integer in ${min}..${max}`); }
function amount(value, path, positive = false) { if (!isIntegerAmount(value) || (positive && BigInt(value) === 0n)) fail(`${path} must be ${positive ? 'positive' : 'nonnegative'} integer text`); }
function list(value, path, check) { if (!Array.isArray(value) || !value.length) fail(`${path} must be a nonempty array`); value.forEach((x, i) => check(x, `${path}[${i}]`)); }
export function validateAsset(value, path = 'asset') {
  object(value, ['network', 'asset', 'decimals'], path);
  text(value.network, `${path}.network`); text(value.asset, `${path}.asset`); int(value.decimals, 0, 30, `${path}.decimals`);
  return value;
}
export function validateMoney(value, path = 'money') {
  if (!value || typeof value !== 'object') throw new TypeError(`${path} must be Money`);
  const { network, asset, decimals, amount: atomic, ...extra } = value;
  validateAsset({ network, asset, decimals }, path);
  if (Object.keys(extra).length) throw new TypeError(`${path} has unknown fields`);
  integer(atomic, `${path}.amount`);
  return value;
}
export const sameAsset = (a, b) => a?.network === b?.network && a?.asset === b?.asset && a?.decimals === b?.decimals;
export const money = (asset, amount) => ({ network: asset.network, asset: asset.asset, decimals: asset.decimals, amount: String(amount) });

/** Validate already parsed owner data. No defaults can silently authorize missing policy. */
export function validateConfig(input) {
  if(!input||Object.getPrototypeOf(input)!==Object.prototype)fail('config must be an object');
  const {procurement,settlementRecipientType,inferenceVerification,autonomy,nearIntegrations,...base}=input;
  object(base, ['schemaVersion', 'mode', 'liveAuthorized', 'killSwitch', 'settlementAsset', 'treasuryAccount', 'fixtureBootstrap', 'customerAssets', 'pricing', 'revenue', 'spending', 'research', 'retry', 'refund', 'access'], 'config');
  if (input.schemaVersion !== 1) fail('config.schemaVersion must be 1');
  if (!['fixture', 'testnet', 'live'].includes(input.mode)) fail('config.mode is unsupported');
  bool(input.liveAuthorized, 'config.liveAuthorized'); bool(input.killSwitch, 'config.killSwitch');
  // A funded authorization is deliberately not representable by demonstration YAML.
  if (input.liveAuthorized) fail('live authorization must be supplied out of band, not in config');
  validateAsset(input.settlementAsset, 'config.settlementAsset'); text(input.treasuryAccount, 'config.treasuryAccount');
  validateMoney(input.fixtureBootstrap, 'config.fixtureBootstrap');
  if (!sameAsset(input.fixtureBootstrap, input.settlementAsset)) fail('fixtureBootstrap must use settlement asset');
  list(input.customerAssets, 'config.customerAssets', validateAsset);
  if (new Set(input.customerAssets.map(x => `${x.network}:${x.asset}`)).size !== input.customerAssets.length) fail('customerAssets must be unique');
  object(input.pricing, ['minimumAtomic', 'invoiceTtlMs'], 'config.pricing');
  amount(input.pricing.minimumAtomic, 'config.pricing.minimumAtomic', true); int(input.pricing.invoiceTtlMs, 1000, 86_400_000, 'config.pricing.invoiceTtlMs');
  object(input.revenue, ['contributors', 'treasuryBps'], 'config.revenue');
  int(input.revenue.treasuryBps, 0, 10000, 'config.revenue.treasuryBps');
  list(input.revenue.contributors, 'config.revenue.contributors', (x, p) => { object(x, ['account', 'bps'], p); text(x.account, `${p}.account`); int(x.bps, 1, 10000, `${p}.bps`); });
  if (new Set(input.revenue.contributors.map(x => x.account)).size !== input.revenue.contributors.length) fail('contributor accounts must be unique');
  if (input.revenue.contributors.some(x => x.account === input.treasuryAccount)) fail('contributor and treasury accounts must differ');
  if (input.revenue.treasuryBps + input.revenue.contributors.reduce((sum, x) => sum + x.bps, 0) !== 10000) fail('revenue shares must total 10000 basis points');
  // totalCeilingNanoUsd is OPTIONAL and, when present, is the lifetime actual+pending ceiling
  // across every paid action (funding, inference, procurement, specialized tools). See ceiling.mjs.
  const {totalCeilingNanoUsd,...spendingCore}=input.spending??{};
  object(spendingCore, ['dailyInferenceCapNanoUsd', 'maxRequestNanoUsd', 'maxFundingNanoUsd', 'permitTtlMs', 'fundingRecipients', 'fixtureFundingAtomicPerUsd'], 'config.spending');
  if (totalCeilingNanoUsd !== undefined) amount(totalCeilingNanoUsd, 'config.spending.totalCeilingNanoUsd', true);
  amount(input.spending.fixtureFundingAtomicPerUsd, 'config.spending.fixtureFundingAtomicPerUsd', true);
  for (const key of ['dailyInferenceCapNanoUsd', 'maxRequestNanoUsd', 'maxFundingNanoUsd']) amount(input.spending[key], `config.spending.${key}`);
  if (BigInt(input.spending.maxRequestNanoUsd) > BigInt(input.spending.dailyInferenceCapNanoUsd)) fail('request maximum exceeds daily cap');
  int(input.spending.permitTtlMs, 1, 60_000, 'config.spending.permitTtlMs');
  list(input.spending.fundingRecipients, 'config.spending.fundingRecipients', text);
  object(input.research, ['minWords', 'maxWords', 'minSources', 'maxSources', 'maxSourceAgeDays', 'maxQueries', 'maxInputTokens', 'maxOutputTokens', 'maxReasoningTokens', 'freeSourcesOnly', 'requiredSections', 'maxBytesPerSource', 'timeoutMs', 'maxRedirects', 'maxInputChars', 'model', 'minQuestionOverlapTokens', 'minEvidenceExcerpts', 'allowUnknownPublicationDates'], 'config.research');
  for (const key of ['minWords', 'maxWords', 'minSources', 'maxSources', 'maxSourceAgeDays', 'maxQueries', 'maxInputTokens', 'maxOutputTokens']) int(input.research[key], 1, 1_000_000, `config.research.${key}`);
  int(input.research.maxReasoningTokens, 0, 1_000_000, 'config.research.maxReasoningTokens');
  for (const key of ['maxBytesPerSource', 'timeoutMs', 'maxInputChars']) int(input.research[key], 1, 10_000_000, `config.research.${key}`);
  int(input.research.maxRedirects, 0, 5, 'config.research.maxRedirects'); text(input.research.model, 'config.research.model');
  int(input.research.minQuestionOverlapTokens, 1, 100, 'config.research.minQuestionOverlapTokens');
  int(input.research.minEvidenceExcerpts, 1, 100, 'config.research.minEvidenceExcerpts');
  if (input.research.minWords > input.research.maxWords || input.research.minSources > input.research.maxSources) fail('research minimum exceeds maximum');
  bool(input.research.freeSourcesOnly, 'config.research.freeSourcesOnly');
  bool(input.research.allowUnknownPublicationDates, 'config.research.allowUnknownPublicationDates');
  if (!input.research.freeSourcesOnly) fail('paid research sources are unsupported');
  list(input.research.requiredSections, 'config.research.requiredSections', text);
  object(input.retry, ['maxAttempts'], 'config.retry'); int(input.retry.maxAttempts, 1, 10, 'config.retry.maxAttempts');
  object(input.refund, ['fullSettlement', 'feeTreatment'], 'config.refund');
  if (input.refund.fullSettlement !== true || input.refund.feeTreatment !== 'shop_pays') fail('only full-settlement, shop-pays-fees refunds are supported');
  object(input.access, ['publicLedger', 'customerReports', 'ownerControls'], 'config.access');
  Object.entries(input.access).forEach(([key, value]) => bool(value, `config.access.${key}`));
  if(settlementRecipientType!==undefined&&settlementRecipientType!=='CONFIDENTIAL_INTENTS')fail('Explicit confidential settlement route required');
  if(autonomy!==undefined){try{validateAutonomyPolicy(autonomy);}catch(e){fail(e.message);}}
  if(nearIntegrations!==undefined){try{validateIntegrationPolicy(nearIntegrations);}catch(e){fail(e.message);}}
  if(inferenceVerification!==undefined){
    const {responseAcceptance,...verificationCore}=inferenceVerification;
    object(verificationCore,['allowedTcbStatuses','maxAttestationAgeMs'],'config.inferenceVerification');
    if(responseAcceptance!==undefined&&responseAcceptance!=='live-verified-hold-on-loss')fail('Unsupported response acceptance policy');
    list(inferenceVerification.allowedTcbStatuses,'inferenceVerification.allowedTcbStatuses',(x,p)=>{if(!TCB_STATUSES.includes(x))fail(`${p} is not an admissible TCB status`);});
    if(new Set(inferenceVerification.allowedTcbStatuses).size!==inferenceVerification.allowedTcbStatuses.length)fail('TCB statuses must be unique');
    int(inferenceVerification.maxAttestationAgeMs,1,3600000,'inferenceVerification.maxAttestationAgeMs');
  }
  if(procurement!==undefined){
    object(procurement,['enabled','listingId','recipient','money','maxCostNanoUsd'],'config.procurement');
    bool(procurement.enabled,'procurement.enabled');text(procurement.listingId,'procurement.listingId');text(procurement.recipient,'procurement.recipient');validateMoney(procurement.money);amount(procurement.maxCostNanoUsd,'procurement.maxCostNanoUsd',true);
    if(!sameAsset(procurement.money,input.settlementAsset))fail('procurement asset must match settlement asset');
  }
  return freeze(structuredClone(input));
}
