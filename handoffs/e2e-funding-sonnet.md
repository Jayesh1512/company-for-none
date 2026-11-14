# S6 funding and supplier work delivery — final handoff

14 November 2026. Resumed in the same assigned thread with GPT-6.1-Sol/high, preserving the earlier Sonnet implementation. **WORKER_DONE for independent implementation; live acquisition and skill/license fulfillment remain blocked by the documented capability and authorization gaps below.** Source/tests are frozen for coordinator integration.

## Owned files

- `src/cloud-funding/index.mjs`, `credit.mjs`
- New `src/procurement/index.mjs`, `marketplace.mjs`, `entitlement.mjs`, `http.mjs`
- New `test/near-e2e-funding/cloud-credit.test.mjs`, `supplier.test.mjs`, `helpers.mjs`
- This handoff

No app/provider/rules/config/UI/Treasury/catalog/dependency files changed by S6. No user store mutation, provisioning, purchase, signing with a real key, paid provider call, transfer, grant creation, staking or public listing. No commits/staging/reset. No additional agents/chats.

## Exact Cloud composition contract

Exports from `src/cloud-funding/index.mjs`:

```js
createCloudFundingAdapter({
  mode,                  // ONLY 'live' enables production reads
  resolveSecret,         // async protected reference -> string|null
  transport = fetch,
  clock = () => new Date(),
  timeoutMs = 10000,
})
createCloudCreditReadPort({
  adapter, organizationId, sessionSecretRef, keySecretRef,
})
toEconomicObservation(observation, binding)
parseBalance(providerJson, organizationId)
```

All other Cloud modes, including `testnet`, `setup`, `fixture` and missing mode, become `unavailable`: no secret resolution or provider request. The inspected docs supply no Cloud testnet origin. `autonomousPurchaseSupported`, `configured`, `verified` and `liveProven` remain false. A successful read means only that this observation was obtained, not that the purchase or inference route is ready.

The bridge requires an adapter and three nonempty pinned strings. It returns a frozen object exposing **zero-argument** `attributeKey()` and `observeBalance()`. Any caller argument is rejected before I/O. The bridge performs no policy/config read; coordinator must wrap it with current M01 owner-read admission. Caller/browser JSON must never select organization, secret references, mode or transport. No automatic startup refresh.

Current `src/app.mjs` creates funding with `createCloudFundingAdapter({...adapterOptions})`, which does not supply `resolveSecret`. Existing supported injection is `options.funding`, or the `funding` result of `options.createAdapters({journal,clock,dispatchAuthorized,rules})`. Coordinator owns any direct factory option additions, private runtime config/env resolution and web service. No new environment variable names or values are imposed by S6. Supplying `resolveSecret` while mode is unavailable performs no credential read and claims no route.

Adapter reads:

- `attributeKey({keySecretRef})`: protected inference key must start with `sk-`. One `POST https://cloud-api.near.ai/v1/check_api_key`, no body, Bearer authentication. Returns `attribution.{organizationId,workspaceId,apiKeyId,sufficientCreditClaim,raw,migration}`. The boolean claim is not a numerical credit limit, owner identity or purchase receipt.
- `observeBalance({organizationId,sessionSecretRef,keySecretRef?})`: protected **user session JWT**, not an inference key/reporting token/org credential. Local JWT checking validates only its three-segment wire format; provider authenticates it. The bridge always supplies the inference key reference too: attribute the key first, reject a foreign organization, then GET `/v1/organizations/{organizationId}/usage/balance`. No redirect, retry or pagination. Failure returns a sanitized code, never token material or raw exception text.
- `observeCredit(callerJson)` refuses caller-authored credit with `CREDIT_EVIDENCE_UNVERIFIED`.
- `fund({action})` and `reconcile({action})` remain `UNSUPPORTED_CAPABILITY`; even the original unknown operation cannot trigger a funding retry. These methods perform no I/O.

`observeBalance` returns `status:'confirmed'`, `kind:'credit_observation'`, `code:'OBSERVED_UNWATERMARKED'` at the transport-result level. Its **observation** has:

```js
{
  kind: 'cloud_credit_observation', provider: 'near-ai-cloud', mode: 'live',
  status: 'unwatermarked', id: 'cloud-credit:<scope/body fingerprint>',
  scope: {
    organizationId, workspaceId, apiKeyId, creditScope: 'organization',
    keyLimitVerified: false, ownerBindingVerified: false,
  },
  creditLimits: [{
    type, currency: 'USD', source,
    amountNanoUsd, transferredOutNanoUsd, effectiveCapacityNanoUsd,
    consumedNanoUsd, availableNanoUsd, provenanceClaim,
  }],
  arithmeticVerified: false, aggregateAvailableNanoUsd: null,
  unfundedNanoUsd, legacyUnattributedNanoUsd, providerUpdatedAt, observedAt,
  watermark: null, watermarkReason: 'PROVIDER_BALANCE_HAS_NO_SEQUENCE',
  additive: false, opening: false, grantsSpendingAuthority: false,
  autonomousPurchase: false, attributedToKey, sufficientCreditClaim,
  raw: {path, httpStatus, bodyHash, bodyBase64}, migration,
}
```

Amounts are exact nonnegative integer strings normalized from safe JSON integers. Unsafe numbers, floats, foreign organizations and unsupported currency/source types fail closed. Source types remain distinct: `payment`, `grant`, `staking_farm`, `transfer`, `postpay`. Provenance is a provider **claim**; `payment` does not establish owner identity. No addition, financial arithmetic verification, conversion, usable-credit calculation or postpay-to-prepaid substitution occurs here. Duplicate source rows remain raw claims and are never summed/imported. M01 owns every aggregate, consistency decision and permission.

`updated_at` is informational, not a sequence. An observation's deterministic identity deduplicates equal raw reads; neither that hash nor local `observedAt` is a provider watermark. There are no accounting writes. `toEconomicObservation` produces only an unwatermarked candidate with binding/financial verification false and raw rows, without a fabricated aggregate or unresolved-operation list. Current M01 holds it at evidence admission. It cannot create an opening/lot, clear reservations or justify the USD5 demo. Organization availability also does not prove a per-key allowance, exact owner account, exclusivity or request-specific charge bound.

## Autonomous acquisition findings

The inspected official OpenAPI documents organization credit transfer and scoped organization credentials, but transfer/capacity/history success responses have empty schemas. No usable cash-to-credit purchase and receipt/reconciliation contract was established. Admin credit reconciliation changes an allowance; it is not proof of purchase. The adapter executes none of these mutation routes.

Staking for Inference directs **yield** into compute credits. Principal, yield, credit capacity and validator fees are different facts. The organization bind/sync routes require separate user-session and wallet evidence. No staking authorization or wallet scope was supplied. Neither existing prepaid usage nor staking documentation establishes autonomous acquisition.

The remaining live-demo need is attributable real credit/owner/key evidence plus a lawful provider watermark/receipt path accepted by M01, exact request/provider charge bounds and the coordinator's aggregate actual+pending USD5 ceiling. No timestamp, log position from a different domain, locally approved boolean or owner balance JSON substitutes for those facts. No credentials/account/network/recipient/purchase scope was inferred.

## Supplier contract is a separate work-procurement class

`createSupplierProcurementAdapter({mode,journal,transport=fetch,settlementAsset,signPayment,dispatchAuthorized,clock,timeoutMs=20000})` implements the documented NEAR Agents Marketplace x402/A2A task protocol. It is **not integrated or activated**. No supplier/network selection is supplied and the real signing port must remain absent. No additional package is required for the observation/codec implementation.

Free ports: `discover({query?,category?,limit?})`, `quote({handle,task})`. Catalog rows are supplier claims. A quote is a TLS-observed 402 challenge, not a cryptographically signed supplier quote. It must match the M01-selected settlement asset and the platform's published recipient list, with one unambiguous row; no cheapest-price, recipient, domain or network policy is chosen here. The supplier card version and exact response hash are pinned. Fixed marketplace/subdomain routing prevents arbitrary endpoint selection.

Future execution shape, for a separately implemented M01 policy only:

```js
request = {handle, task, quote, terms: optionalPinnedTerms};
action = {
  id, type: 'supplier_order', mode,
  supplier: {kind: 'near-agents-marketplace', handle},
  money: quote.money, recipient: quote.recipient,
  requestFingerprint: requestFingerprint(request),
};
decision.plan = {
  kind: 'supplier_order', requestFingerprint: action.requestFingerprint,
  request, // exact request, not caller substitute
};
adapter.execute({action, decision, facts, request});
adapter.reconcile({action, request});
```

M01 must admit this **new class**, select exact supplier/network/asset/domain and disclosure scope, compute/bind principal+fees and aggregate reservations, preserve current kill/lease/fence/grant/private-context controls, and issue the final permit. Current product M01 does not admit this action. Existing legacy `procurement`/catalog-license flows must never consume these results as skill fulfillment. No paid/signing option should be connected just because this codec exists.

The future `signPayment({row,quote,action})->{header}` dependency is currently missing. It would need an independently reviewed payer implementation that returns the exact documented x402 envelope. S6 checks canonical base64 JSON, version and exact accepted row, **not the cryptographic delegate action**. No signature or chain-proof library is installed by S6. Any signer preparation must perform no monetary/provider mutation; only the final gated SendMessage may dispatch. One opaque header hash is recorded; the transferable header is never persisted or returned.

The sole possible paid dispatch is SendMessage with X-PAYMENT, after durable unknown intent and final gate. Price/card/recipient drift refuses preparation. Request/action bytes are snapshotted before awaits. Unknown outcomes retain the original operation; no replacement message/payment is sent. GetTask reads only the original task ID, matching request, supplier and hire context. Task IDs are bearer read credentials and belong in private storage.

Completed state plus nonempty inline text/raw artifact bytes produces a content-hashed **received-work record** (`kind:'supplier_work_product'`). A bare payment/working task/empty content/URL-only artifact does not. Hashes bind supplier card/version, original action, full request/quote, task/hire context and delivered bytes. `licenseGranted:false`, `useRightsStatus:'unverified'`, `scope:'received_work_product'`, `grantsSpendingAuthority:false`. Pinned terms are hash observations, not legal-rights verification. Terms reads only use the same supplier/platform origins; arbitrary hosts, ports, credentials and redirects are rejected.

`importEntitlement(record)` requires a fresh matching supplier read in the current adapter instance and the exact original operation result. Caller-authored records, self-hashes, saved proof booleans and restart replays alone fail. After restart, free GetTask must re-establish delivery; it never signs/pays again. Changed task/context/content cannot overwrite the first delivery. Imports are once-only for order/task and identical replay is a no-op. Only `supplierEntitlements` and supplier operation/journal events are written; no catalog license, skill activation or Treasury entry is created.

Settlement remains independently unverified even after delivery; a supplier's terminal failure/no-charge claim does not release money. x402 work completion is provider-TLS evidence, not TEE/onchain proof or accepted company knowledge. M01 must separately decide any use of that work. Genuine free local skills/personas remain unaffected.

## Verification and public evidence

Supported runtime used throughout resumed checks: `PATH=/Users/jys/.hermes/node/bin:$PATH`, Node **v26.12.1**.

- `node --test test/near-e2e-funding/*.test.mjs test/integrations-adapters/effects.test.mjs test/integrations-adapters/isolation.test.mjs`: **48 passed, 0 failed, 0 skipped** (31 S6 tests plus 17 existing compatibility tests). Log `/tmp/s6-sol-focused-20261114.log`.
- `npm run check`: **117 JavaScript files**. No dependencies/config changed.
- Full suite was already running when coordinator asked for focused checks only: **450/454 passed**, four failures outside ownership in `test/autonomy/loop.test.mjs` (OBJECTIVE_INPUT_LIMIT) and `test/rules/preparation-blockers.test.mjs` (two stale allow assertions and missing `tx.putOperation`). Reported to coordinator; no cross-scope edits or further full rerun. Log `/tmp/s6-sol-full-20261114.log`. This is a shared-checkout observation during S1/S7 work, not a claimed final integration result.

All execution tests use explicitly synthetic local transports/rows/payer envelopes and isolated temporary journals. Tests cover denial/final kill, quote/asset/amount/payee/terms drift, async request mutation, response loss/replay, original unknown funding identity, restart import admission, duplicate credit/imports, changed hire context, bare-payment/no-artifact refusal and unverified usage rights. They are not funded-provider evidence or cryptographic payment verification.

Refreshed actual free public GETs on 14 November 2026, no credentials/completions/quotes/signing:

| Source | HTTP / bytes | SHA256 |
|---|---|---|
| [Cloud OpenAPI](https://docs.near.ai/api-reference/openapi.json) | 200 / 859712 | `0329b9e318396e56789a2c76915ea2dbc30136cc29ab7ab75f2c2863493865cc` |
| [Marketplace caller protocol](https://market.near.ai/skill/x402-caller/SKILL.md) | 200 / 11499 | `cd156d246362a5681ded143bf02dfab8ca721d24b800534a2101d2136505ffe4` |
| [Public x402 configuration](https://market.near.ai/.well-known/x402) | 200 / 209, 1 recipient | `c56cd5ccd7978d86db321c55336c5f4d6ca5d0311185a8561e4c492c08b24c7a` |
| [Public catalog, limit 1](https://market.near.ai/v1/agents?limit=1) | 200 / 2678, 1 row | `ead820cfd79d77eca81d8ff91b76feb6db81cf45fd0e5d68ab1bcbfaeff01515` |

These establish documentation/reachability only, not selected supplier availability, an approved recipient pin, usable credit, payment or license. The actual transfer-history success schema remains `{}`. Agent-reach web-reader also retrieved the official caller protocol; direct vendor documents supplied the implementation contract. [Staking overview](https://docs.near.ai/cloud/staking-for-inference/overview) was rechecked against the principal/yield distinction. No credit-query/ideation purchase was made.

Coordinator owns the private M01-gated read bridge integration, UI redaction, any S1 contract additions, full test/browser/demo verification and any eventual exact authorization request. No current S6 output permits live acquisition or supplier activation.
