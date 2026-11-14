# S3 handoff — specialized NEAR Cloud tools, 14 November 2026

Scope: `src/cloud/**`, `src/runtime/cloud-products.mjs`, `test/cloud/**`, `test/near-e2e-tools/**`. No paid or credentialed provider call was made. No rules/config/package/shared-contract edits.

## What changed

- `src/cloud/technical-facts.mjs` (new, pure): `cloudTechnicalFacts(request)` returns exact byte shape and the billing *dimensions* per product, plus `localTokenCeilingSupported` / `unboundedReasonCode`. **No prices, caps or money arithmetic** (M01 owns those; an earlier draft with formulas was deleted). Also `responseEvidence` (SHA-256 of exact request/response bytes + honest proof status) and `validateRerankOutput` (structural only).
- `src/cloud/read-only.mjs`: `services()` (public, unauthenticated, lossless nanoUSD integers) and `billingCosts({inferenceIds})` (explicit deprecated-route opt-in, **inference key only**, 1–100 distinct UUID IDs, unsafe/unrequested numbers rejected; zero/warning returned as provider data, never as "free").
- `src/cloud/index.mjs`: result carries `exactBytes{requestHash,responseHash}`, `proof` (unavailable + reason), provider IDs as received (no derived/inferred IDs), `cost.plannedBound` = `decision.plan.costBound` copied verbatim from M01 (never interpreted). A rerank response that does not structurally match the request becomes `unknown` (original operation kept, no retry), not `confirmed`.
- `src/runtime/cloud-products.mjs`: `services(access)` (explicit free read, raw bytes+hash kept privately), `technicalFacts()`, `plan()` now also returns `technicalFacts`; `execute` hands M01 `facts.pricing={models,services,observedAt,catalogComplete}` and `facts.technicalFacts` (inputs only; M01 still holds). `rankKnowledge` unchanged contract plus technical facts. New `bindRanking(...)` and `billingCosts(...)`.

## Supported vs unavailable matrix (14 Nov 2026)

| Product | Real codec | Policy today | Output proof | Cost facts available to M01 | Notes |
|---|---|---|---|---|---|
| rerank | yes | M01 HOLD | **unavailable** (no documented signature route) | per-token in/out price (10 nano each), byte shape, pair count | the one wired into company knowledge (`rankKnowledge` → M01 → `bindRanking`); query is evaluated once per document pair, template overhead per pair undocumented |
| embeddings | yes | HOLD | unavailable | per-token price, bytes | no consumer wired |
| score | yes | HOLD | unavailable | per-token price, bytes | no consumer wired |
| privacy_classify / privacy_redact | yes | HOLD | unavailable | per-token (10 in / 0 out), bytes | **only routes whose OpenAPI declares an `Inference-Id` response header** → documented billing join |
| image_generation | yes | HOLD | unavailable | per-image 12,000,000 nano + token price | |
| web_search | yes | HOLD (`SEARCH_TOTAL_BOUND_REQUIRED`) | n/a | service fee 5,000,000 nano **per search request**, plus inference rounds | `count` = results per search, NOT a charge bound; no documented max searches/rounds → aggregate bound **unavailable** |
| responses | yes | HOLD | `resp_*` gateway signature documented, **not verified by this adapter** (S2 owns crypto) | tokens, cache tokens | round count/reasoning not documented as capped |
| vision | yes | HOLD | unavailable | image-token count undocumented | |
| transcription | yes | HOLD | unavailable | audio billing unit undocumented | |
| system_one | yes | HOLD | unavailable | price unit undocumented | |

Not "all eleven enabled": all eleven *codecs* exist; **zero** are policy-enabled and **none** has response proof. Specialized routes are plain TLS + Bearer key to the gateway (not the SDK E2EE path); disclosure scope is the exact request body.

Reporting/billing replacement: provider marks organization reporting, `/v1/billing/costs` and `/v1/services` as *moving to cloud-platform, base URL not announced*. No host is invented (`replacementBaseUrl:null`); calls use the current documented `cloud-api.near.ai/v1` path and billing/reporting stay behind `allowDeprecatedReporting`. Whether specialized-route IDs resolve in `/v1/billing/costs` is documented only for chat/completions and messages → **unverified for rerank until an actual wire response**.

## Evidence

- Free public reads, 14 Nov 2026, raw bytes + SHA-256 in `test/near-e2e-tools/evidence/` (`manifest.json`, `services.raw.json`, `model-list.raw.json`; OpenAPI/doc hashes listed). Facts: web_search 5,000,000 nanoUSD/request; reranker/embedding/whisper 10 nano/token; privacy-filter 10 in/0 out; FLUX 12,000,000/image.
- `node --test test/near-e2e-tools/*.test.mjs test/cloud/*.test.mjs`: 39 pass (29 existing + 10 new), 0 fail. `npm run check`: 110 files. Mutation check: removing the stale-fingerprint check makes the bridge test fail.
- Fixture vs real: all HTTP tests use local Node servers; evidence files are real public bytes; no live paid, reporting, billing or signature call.

## Narrow path for the coordinator (needs credentials + exact scope + S1/M01 work)

1. Free: `app.cloudProducts.catalog(owner)` + `services(owner)` (a `POST /api/workspace/cloud/services` route is **coordinator-owned and not added**).
2. `rankKnowledge({agentId,knowledgeIds,query,model:'Qwen/Qwen3-Reranker-0.6B'})` → exact JBrain granted documents + revisions, `technicalFacts`, M01 plan. Disclosure = those documents' text to the Cloud gateway.
3. M01 (S1) must turn technical + price facts into an acceptable bound and decide whether a local ceiling satisfies the enforced-bound requirement (I assume **not** automatically). Without that it stays `CLOUD_PRODUCT_VERIFICATION_REQUIRED`.
4. After a permitted one-time execute: `bindRanking({...input,requestFingerprint,documentRevisions,output})` re-reads current grants/revisions; changed/removed/tampered → `STALE_KNOWLEDGE_CONTEXT` / `KNOWLEDGE_ACCESS_DENIED` / `PROVIDER_OUTPUT_SCHEMA_INVALID`. Result is advisory ordering only: `accepted:false`, proof unavailable, no document text returned.
5. `billingCosts({inferenceIds:[<header inference-id values>]})` with the inference key to read actual provider cost; keep status `pending` until a nonzero matching row exists; reconciliation against any bound is M01's.

Total-spend note: the reranker price is scale-9 nanoUSD per token; the whole call is orders of magnitude below USD 5 for a 64 KB request, but the authoritative bound/reservation is M01/M03's, not this document's.

## S2 agreement (verification path)

S2 exports no new verifier. The SDK's `verifyGatewayResponse`/`verifyModelResponse` (`@nearai/inference-sdk/node` 0.3.0) check a signature against exact bytes only; they prove TEE execution only if the signer came from a live-verified S2 preflight. S3 does **not** call them: rerank/embeddings/score/privacy/image/transcription/system_one stay proof-unavailable with exact byte hashes, and `responses`/`web_search` stay unavailable (any future call would be wire-signature-only, never `provider_tee`, unless paired with a fresh S2 preflight for the same signer). S2's E2EE chat route is the only route that can carry accepted-output proof. Web routes for `services`/`bindRanking`/`billingCosts` are integrated by the coordinator; S1 must supply the M01 bound plan before any execute.

## Still unavailable

Provider-enforced charge cap; response signature/attestation for specialized routes; replacement reporting host; web_search aggregate bound; E2EE for specialized routes; any credentialed live evidence.
