import { fingerprint } from '../contracts.mjs';
import { boundedRequest } from '../procurement/http.mjs';

// Fixed origin; every documented Cloud route is currently marked deprecated by the provider
// (cloud-platform base URL unannounced). Report that; never invent a replacement origin.
export const CLOUD_ORIGIN = 'https://cloud-api.near.ai/v1';
export const CLOUD_MIGRATION = Object.freeze({ deprecated: true, replacementBaseUrl: null, documentation: 'https://docs.near.ai/api-reference/introduction' });
// Preserve the provider's distinct source classes. M01 alone calculates usable prepaid capacity.
const PREPAID = ['grant', 'payment', 'staking_farm', 'transfer'];
const PROVENANCE = { payment: 'payment_credit', grant: 'platform_grant', staking_farm: 'staking_yield', transfer: 'received_transfer' };

const bad = (code, message) => { throw Object.assign(new Error(message), { code }); };
const name = x => typeof x === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(x);
const nano = (x, field) => Number.isSafeInteger(x) && x >= 0 ? BigInt(x) : bad('BALANCE_SCHEMA_INVALID', `${field} must be a lossless nonnegative nanoUSD integer`);

/** Server-authoritative identity of an inference key. `valid` is a boolean claim, never an amount. */
export async function readKeyAttribution({ transport, token, timeoutMs }) {
  if (typeof token !== 'string' || !token.startsWith('sk-')) bad('INFERENCE_CREDENTIAL_REQUIRED', 'A protected inference key is required for key attribution.');
  const res = await boundedRequest({ transport, url: `${CLOUD_ORIGIN}/check_api_key`, method: 'POST', timeoutMs, headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) bad('PROVIDER_ACCESS_DENIED', 'NEAR Cloud rejected the key.');
  if (!res.ok) bad('PROVIDER_READ_FAILED', 'NEAR Cloud attribution read failed. No retry was sent.');
  const data = res.json();
  if (!data || typeof data.valid !== 'boolean' || !name(data.organization_id) || !name(data.workspace_id) || !name(data.api_key_id)) bad('PROVIDER_SCHEMA_INVALID', 'Attribution response has an unsupported shape.');
  return { organizationId: data.organization_id, workspaceId: data.workspace_id, apiKeyId: data.api_key_id, sufficientCreditClaim: data.valid,
    raw: { path: '/check_api_key', httpStatus: res.status, bodyHash: res.bodyHash }, migration: CLOUD_MIGRATION };
}

export function parseBalance(data, organizationId) {
  if (!data || data.organization_id !== organizationId || !Array.isArray(data.credit_limits) || typeof data.updated_at !== 'string' || !Number.isFinite(Date.parse(data.updated_at))) bad('BALANCE_SCHEMA_INVALID', 'Balance response has an unsupported shape or another organization.');
  const creditLimits = [];
  for (const row of data.credit_limits) {
    if (!row || ![...PREPAID, 'postpay'].includes(row.type) || row.currency !== 'USD' || row.source != null && typeof row.source !== 'string') bad('BALANCE_SCHEMA_INVALID', 'Unsupported credit type, source or currency.');
    const amount = nano(row.amount, 'amount'), out = nano(row.transferred_out, 'transferred_out'), capacity = nano(row.effective_capacity, 'effective_capacity'),
      consumed = nano(row.consumed, 'consumed'), avail = nano(row.available, 'available');
    creditLimits.push({ type: row.type, currency: row.currency, source: row.source ?? null, amountNanoUsd: amount.toString(),
      transferredOutNanoUsd: out.toString(), effectiveCapacityNanoUsd: capacity.toString(), consumedNanoUsd: consumed.toString(), availableNanoUsd: avail.toString(),
      provenanceClaim: PROVENANCE[row.type] ?? 'postpay_ceiling' });
  }
  return { creditLimits, arithmeticVerified: false, aggregateAvailableNanoUsd: null,
    unfundedNanoUsd: nano(data.unfunded_amount, 'unfunded_amount').toString(), legacyUnattributedNanoUsd: nano(data.legacy_unattributed_amount, 'legacy_unattributed_amount').toString(),
    providerUpdatedAt: data.updated_at };
}

/** One absolute prepaid-credit read. Comparison fact only: never an opening, lot, receipt or additive movement. */
export async function readBalanceObservation({ transport, token, organizationId, attribution = null, mode, clock, timeoutMs }) {
  if (!name(organizationId)) bad('INVALID_INPUT', 'An explicit organization id is required.');
  if (attribution && attribution.organizationId !== organizationId) bad('ATTRIBUTION_MISMATCH', 'The key belongs to another organization.');
  // Only a user session JWT may read this route; inference, reporting and organization credentials are not accepted.
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) bad('SESSION_CREDENTIAL_REQUIRED', 'Balance reads require a protected user session token. An inference key cannot read it.');
  const res = await boundedRequest({ transport, url: `${CLOUD_ORIGIN}/organizations/${encodeURIComponent(organizationId)}/usage/balance`, timeoutMs, headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) bad('PROVIDER_ACCESS_DENIED', 'NEAR Cloud rejected the session token.');
  if (!res.ok) bad('PROVIDER_READ_FAILED', 'NEAR Cloud balance read failed. No retry was sent.');
  const parsed = parseBalance(res.json(), organizationId);
  const scope = { organizationId, workspaceId: attribution?.workspaceId ?? null, apiKeyId: attribution?.apiKeyId ?? null, creditScope: 'organization', keyLimitVerified: false, ownerBindingVerified: false };
  return { schemaVersion: 1, kind: 'cloud_credit_observation', provider: 'near-ai-cloud', mode, status: 'unwatermarked',
    id: `cloud-credit:${fingerprint({ scope, bodyHash: res.bodyHash })}`,
    scope, ...parsed, observedAt: new Date(clock()).toISOString(),
    // The provider publishes no sequence for balances; updated_at is informational and is NOT a watermark.
    watermark: null, watermarkReason: 'PROVIDER_BALANCE_HAS_NO_SEQUENCE',
    additive: false, opening: false, grantsSpendingAuthority: false, autonomousPurchase: false,
    attributedToKey: !!attribution, sufficientCreditClaim: attribution?.sufficientCreditClaim ?? null,
    raw: { path: `/organizations/${organizationId}/usage/balance`, httpStatus: res.status, bodyHash: res.bodyHash, bodyBase64: Buffer.from(res.bytes).toString('base64') }, migration: CLOUD_MIGRATION };
}

/**
 * Candidate economicObservations record. status is 'unwatermarked', never 'verified': M01 holds it with
 * ECONOMIC_EVIDENCE_REQUIRED before any accounting plan. No local position or spendable total is invented.
 */
export function toEconomicObservation(observation, binding) {
  if (observation?.kind !== 'cloud_credit_observation' || !binding || binding.provider !== observation.provider) bad('BINDING_MISMATCH', 'Observation and binding differ.');
  const { organizationId, apiKeyId } = observation.scope;
  if (binding.organizationId !== organizationId || (apiKeyId !== null && binding.credentialId !== apiKeyId)) bad('BINDING_MISMATCH', 'Binding organization/key differs from the observed scope.');
  return { id: observation.id, resource: 'credit', binding: structuredClone(binding), watermark: null, observedAt: observation.observedAt,
    evidenceRef: `cloud-credit-raw:${observation.raw.bodyHash}`, creditLimits: structuredClone(observation.creditLimits), bindingVerified: false, arithmeticVerified: false,
    status: 'unwatermarked', grantsSpendingAuthority: false };
}
