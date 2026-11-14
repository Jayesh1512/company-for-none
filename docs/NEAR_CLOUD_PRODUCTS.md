# NEAR Cloud products

Implementation contract, 14 November 2026. This is an additive integration, not a change to the frozen Company for none or real-execution plans.

## Scope and authority

`src/cloud/` contains real, fixed-origin NEAR Cloud protocol clients. No fixture provider is imported by the product. M01 owns all view/read/execute decisions; M03 continues to own money. Construction and request planning perform no provider I/O. Catalog reads require an authenticated owner action. Reporting additionally requires an explicitly selected organization and a separate protected reporting token. No token creation, account management, purchases or credit transfers are included.

Implemented paid request codecs: embeddings, rerank, similarity score, privacy classification/redaction, stateless Responses with client functions, native search, image generation, audio transcription, vision and System One. Codecs reject unknown fields, arbitrary endpoints, server conversation storage and unsupported tool types. The adapter requires an exact M01 plan, permit and final dispatch port. Raw HTTP responses have **unavailable proof** and **pending cost**; they cannot become accepted agent commands, company context, publication or accounting receipts.

The product's M01 `cloud_product_execute` decision currently holds these additional routes with `CLOUD_PRODUCT_VERIFICATION_REQUIRED` (search also needs an aggregate service-call bound). This is intentional: implementing the protocol does not establish the new routes' attestation, durable plaintext binding, attributable credit or enforceable total cost. The existing verified E2EE chat route remains the only business-inference transport. No silent non-E2EE fallback is selected. Tests inject isolated final gates to exercise the real HTTP codecs, not to claim production permission or real TEE proof.

## Ports

- `createCloudProductAdapter({journal,mode,dispatchAuthorized,resolveSecret,secretRef,transport?,clock?})`: `execute({action,decision,facts,request})`, `reconcile({action,request})`. `request` is `{product,input,timeoutMs,maxInputBytes,maxResponseBytes}`; `action.requestFingerprint` binds it. The approved plan must contain that exact request and request fingerprint. Paid retries are never automatic. Response loss or a process crash preserves the original unknown operation.
- `describeCloudRequest(request)`: validates/encodes a request without credentials or I/O, returning fixed method/path/content type and exact input bytes/hash. Multipart audio content is bound by the decoded file hash as well as the request fingerprint.
- `createCloudReadClient({transport?,resolveSecret,reportingSecretRef,organizationId,allowDeprecatedReporting?,clock?})`: `catalog()` performs public model/pricing reads; `usage({startTime,endTime,cursor?,limit?})` performs one read-only page with a fixed time range; `summary({startTime,endTime})` performs one read-only summary. No automatic pagination, no tenant-header override, redirects or retries. Deprecated reporting remains disabled unless explicitly opted in; no replacement base URL is invented.
- `createNearCloudProducts(...)`: owner workspace service, `view(access)`, `catalog(access)`, `plan(input,access)`, `execute(input,access,key)`, `usage(input,access)`, `summary(input,access)`, `rankKnowledge(input,access)` (prepare only, current JBrain document grants), `usageForWork(access)` (joins original local provider IDs; never mutates money).
- M01 actions `cloud_products_view`, `cloud_catalog`, `cloud_usage`, `cloud_product_plan`, `cloud_product_execute`. All are owner-only; the execute action remains fail-closed. Request JSON, catalog membership, model pricing and owner workspace access are never paid-call authority.

## HTTP

Owner-only routes under `/api/workspace/cloud`: GET view; POST `catalog`, `plan`, `execute`, `knowledge-plan`, `usage`, `summary`. Mutations/execute use a stable Idempotency-Key. Bounded JSON inputs; origin checks and existing owner authentication apply. No caller URL, credential, organization, grant, proof or pass boolean is accepted. Settings displays this view; fetching catalog is explicit, not a startup side effect.

## Typed agent commands

M01 builds a JSON Schema from its own command definitions. The exact schema is included in the frozen GenerationRequest and encrypted SDK body. Input byte checks include the schema. Provider structured output is a formatting aid; strict SDK output binding and M01 command/scope/fence checks remain mandatory. Client-function output/history helpers preserve the original call item and provider metadata; they never execute tools.

## Provider references and migration

- [Specialized endpoints](https://docs.near.ai/cloud/guides/specialized-endpoints)
- [Stateless Responses](https://docs.near.ai/cloud/guides/stateless-responses)
- [Native search](https://docs.near.ai/cloud/guides/web-search): result count is not a maximum paid search-call count; charges include service fees and additional inference rounds.
- [Model pricing](https://docs.near.ai/api-reference/models/list-models-with-pricing): preserve integer amount/currency/scale; pricing is not a verified request-cost bound.
- [Usage reporting](https://docs.near.ai/cloud/guides/usage-reporting): reporting credentials cannot infer or manage resources.
- [API reference](https://docs.near.ai/api-reference/introduction): organization reporting/billing are deprecated, replacement cloud-platform base not yet announced. Existing billing remains a read-only compatibility client, and absent/delayed/zero rows never establish a free request.

Public catalog data and private operational evidence may be retained in the local journal. Company documents remain in JBrain. This application does not claim zero server-side retention. New specialized outputs and private evidence never enter the public financial ledger automatically.

## Verification evidence

- `npm test`: **316 passed**, no failures/skips. `npm run test:native`: **12 passed** against actual local JBrain. `npm run check`: **95 JavaScript files**. `npm run test:cloud`: **29 passed**, including all eleven real codecs over local Node HTTP stand-ins, multipart boundaries, loss/overflow, strict replay identity, current owner/knowledge boundaries, separate reporting tokens, unchanged financial version, scoped cursor restart and exact schema delivery to the SDK preparation port.
- Actual public read: `artifacts/near-cloud-products/public-catalog.json`, **64 models and 64 with pricing**. Two public GETs, no credentials or completion. No specialized paid endpoint, organization report or funded operation was called against the real provider.
- T3 collaborative browser: isolated setup store, explicit real catalogue refresh, local privacy request plan, held execute, anonymous403, zero page exceptions and no horizontal overflow at actual CSS widths1315 and356 (requested1440/390; native preview scales its viewport). A local CSS correction prevents the existing connection-check buttons from collapsing the text column on mobile. `browser-proof.json` records the checks. Native screenshot compositing duplicated narrow captures, so responsive evidence uses DOM geometry and interactions rather than screenshot pixel dimensions.
- Postman CLI1.73.0 was present, but `postman status` is unsupported and provider discovery returned `No authorization data found`. No login, install or publication was attempted. Tests reuse this repository's actual Node HTTP stand-in pattern; they do not claim a Postman simulation run or live paid-provider proof.

### Example: local preparation only

Authenticated `POST /api/workspace/cloud/plan` accepts:

```json
{
  "product": "privacy_redact",
  "input": {"model": "openai/privacy-filter", "input": "Fictional contact: alex@example.test"},
  "timeoutMs": 30000,
  "maxInputBytes": 65536,
  "maxResponseBytes": 2097152
}
```

This returns an M01 plan with `executionAllowed:false`, required evidence and a request fingerprint. It sends no provider request. The execute route returns `not_submitted` until a separately implemented and reviewed proof/financial path can be admitted; it cannot accept a `verified`, `allow`, credential or budget field from the browser.
