# Current SDK verification integration — 13 November 2026

This section supersedes the earlier R1/historical implementation inventories below. The user approved reversible SDK integration, not execution. No provider preflight, paid generation, quote/deposit request, transfer, account/grant provisioning, supplier purchase, secrets request or funded proof was run in this work. Coordinator installed/pinned dependencies and owns app/config/package/runner/UI changes; this worker did not edit those files. Local tests use real SDK cryptographic helpers with explicitly synthetic keys/documents and local HTTP stand-ins. They do not establish deployed-provider, TDX, balance, credit, movement or economic proof.

## Cloud: implemented capture and exact port

`src/inference/verification.mjs` exports `createCloudVerification({journal,clock?,secretRef?,resolveSecret?,limits:{timeoutMs,maxEvidenceBytes}})` and `loadCloudVerificationSdk()`. `src/inference/index.mjs` reexports the factory. The loader requires the actual Node entry of **@nearai/inference-sdk 0.3.0**, checks installed package metadata, and rejects Node versions below **24.22.1**. No version/route/provider fallback exists.

The factory returns:

- `preflight({actionId?,requestFingerprint?,request?,model?,verificationSpec})`: explicit read-only SDK deployment verification. No call occurs at construction/startup. A bare model/spec preflight has its own fingerprint and no completion-body hash.
- `prepare({action,request,verificationSpec})`: prepares an exact full request and returns a **function** `send`, with immutable `.preflight`, `.requestFingerprint`, `.requestBytesHash`, `.evidenceRef`. It uses the official public `prepareE2eeChatRequest()` after actual SDK preflight, persists the encrypted request before returning, and refuses regeneration under the same prepared action identity.
- `send()`: single use; synchronously reaches the existing attested-SPKI-pinned SDK POST transport before any await. Composition must first persist the operation/reservation and consume/check the current M01 permit immediately before invoking it. It resolves ExternalResult with generated output/provider/inference IDs/usage, pending actual cost and a separate normalized proof finding. No callback retry is offered.
- `replay({evidenceRef,requestFingerprint,verificationSpec})`: reads a private retained bundle, checks its identity/spec/hash bindings, and reruns actual public SDK signature helpers over exact recorded wire bytes. It makes no provider/collateral request and never trusts a stored verified boolean. Full attestation/ephemeral-key replay remains unavailable as explained below.

Spec is the exact M01-approved `{route:'near-tee-e2ee-chat',sdk:{name:'@nearai/inference-sdk',version:'0.3.0',nodeEntry:true},signingAlgo:'ed25519',requireGatewayAttestation:true,requireModelAttestation:true,requireResponseSignature:true,allowedTcbStatuses,maxAttestationAgeMs,attestationCacheTimeToLiveMs:0,signatureKind:'provider_tee',policyFingerprint,...}`. It must match the spec inside the full request; request fingerprint and any action fingerprint field cannot name different inputs. The adapter does not choose spending limits or acceptable TCB/deployment policy.

Actual SDK integration uses its public/protected extension points only: Node `AttestationClient.requestGatewayAttestation`, `InferenceClient.fetchGatewayAttestation`, `createGatewayFetch`, `createVerificationState`, and `registerResponse`. No private SDK field is inspected or patched. Gateway preflight records actual observed TLS SPKI; gateway/model reports use fresh client nonces; both receive the M01 TCB status policy; session cache lifetime is zero. All returned model candidates must pass the SDK; a provider-TEE response must identify one matching candidate. The explicit actual `client.verifyResponse(completion.id)` runs after response bytes are captured. The SDK does not itself verify image provenance by default; returned `deploymentProvenance` and authenticated measurements are recorded honestly, never relabeled.

`src/inference/capture.mjs` bounds reads and persistence, retains exact bytes before SDK JSON parsing/decryption or application parsing, and provides the immediate single-use dispatch callback. Captures include gateway/model requests and full responses, nonces, TLS SPKI, completion encrypted request/response and signature response, normalized SDK inputs, and process-decrypted output bytes if obtained. Request/response header allowlists exclude Authorization, API keys, grants, cookies and secret references. Private artifacts use `private:<sha256>` references. Raw completion hashes are distinct from attestation exchange hashes. The response report hash is SHA-256 of exact output text UTF-8; the full decrypted JSON body hash is kept separately and is never substituted for report content.

Normalized results are current-per-ID private journal records in `inferenceVerification`:

`{id,stage,status,source:'local-sdk',sdkVersion:'0.3.0',sdk,requestFingerprint,model,policyFingerprint,verificationPolicyFingerprint,verifiedAt,evidenceRef,gateway,models,requestBytesHash?,responseBytesHash?,responsePlaintextHash?,signatureKind?,wireSignatureVerified?,plaintextBindingStatus?,durableReplayStatus?,reasonCode?,processVerificationStatus?}`.

Gateway/models contain actual SDK TCB, nonce verification, signer, local SDK verification time, deployment provenance/measurements and TLS binding where present. No signed quote timestamp is invented. Preparation upgrades the same preflight ID with the actual encrypted completion hash. Unavailable/failed updates replace the previous current finding. Read-only preflight can omit that hash. Actual dispatch requires its frozen prepared hash in M01's reservation/final-gate contract.

## Cloud: verified source limitations and strict hold

Public source inspection of the published npm 0.3.0 tarball and its source maps established:

1. Node high-level client options omit a fetch override, and response/session records are private process caches. Protected hooks allow bounded capture; serialized SDK booleans are not restart verification.
2. `prepareE2eeChatRequest()` exposes only `{request,decryptResponse}`. Its generated private response key lives in a closure; no supported public export/import exists. After crash, original ciphertext/signature can be rechecked, but original plaintext cannot be independently re-decrypted/rebound with the public API. Saving plaintext JSON does not prove that link.
3. Public manual `verifyGatewayAttestation`/`verifyModelAttestation` exist, but their default Intel/NVIDIA verification may fetch collateral. The SDK has no complete public archival/offline collateral export/import port for this wrapper. Our offline replay verifies wire signature/payload bytes only, not a fresh TDX/deployment/nonce trust chain. It returns no saved TCB assertions as verified facts.
4. The bounded wrapper aborts its own provider fetches on timeout. SDK third-party collateral/GPU verification lacks complete cancellation hooks and may finish in the background; timeout does not authorize a paid POST or turn incomplete evidence into success.
5. Gateway and provider-TEE response signatures have different scope. Current source/docs do not establish a complete cryptographic model-to-gateway-to-final-response chain from one signature.

Therefore a current E2EE response always keeps strict overall `status:'unavailable'`, `plaintextBindingStatus:'unavailable'` and `durableReplayStatus:'unavailable'`, even if actual in-process verification/decryption and wire signature verification succeed. `processVerificationStatus` is reported separately. M01's strict report/delivery checks hold. **G6 is not closed.** Actual billing uses `inference-id`, never `x-request-id`; consumption cost stays pending until a real attributed billing receipt/watermark is obtained. The deprecated billing/base-URL transition is unresolved, so no fake cost, credit snapshot or timestamp-watermark is created.

The documented non-E2EE route was examined only for feasibility: the same Node SDK can use a supported NEAR model with `e2ee:false`, verified model routing, `x-no-aliasing:true`, pinned TLS and provider-TEE signatures over exact plaintext request/response bytes. That removes this particular ephemeral decryption-key replay problem, but still needs actual retained attestation/collateral verification, accepted provenance/pins and separately approved security/route scope. **It was not selected as a fallback.**

Business M07 `generate()` remains the old HTTP path with explicit proof-unavailable metadata. No `prepareVerified` alias or silent business migration was added. The coordinator's standalone bounded component entry uses the new SDK factory; strict M01 prevents the legacy path from supplying a complete business proof.

Primary SDK/source references: [official JavaScript guide](https://docs.near.ai/cloud/inference-sdk/javascript), [verification policy](https://docs.near.ai/cloud/verification/reference/verification-policy), [exact response-signature scope](https://docs.near.ai/cloud/verification/cloud-api/response-signatures), [published 0.3.0 npm package](https://www.npmjs.com/package/@nearai/inference-sdk/v/0.3.0), [official source repository](https://github.com/nearai/inference-sdk).

## 1Click: implemented signed-envelope verification

`src/payments/signatures.mjs` exports `createPaymentSignatureVerifier({journal,clock?}) -> {verifyQuote({evidenceRef}),verifyStatus({evidenceRef})}` using **@defuse-protocol/one-click-sdk-typescript 0.1.26** and its default pinned manager public key. Product code exposes no caller-selected signing-key override and contains no replacement signature algorithm. Private exact raw request/response envelopes are persisted by `http.mjs` before JSON parsing, then reread for verification. Missing/invalid signatures block live deposit instructions. SDK/version/private capture failure remains unavailable. Replaying a saved result always reruns the SDK, not its stored verdict.

The status method verifies **only `status.quoteResponse`**, as documented. It does not authenticate `status`, `swapDetails`, actual credited amount, deposit/settlement timestamps or chain finality. Source inspection also confirms the SDK signs a selected field set, excluding `sessionId`, `connectedWallets`, `correlationId`, `appFees`, `partnerId`, `userAccountId` and `depositMode`. These exclusions are not hidden by an “entire response signed” label.

A provider SUCCESS with a valid nested quote still yields an unknown settlement with missing independent finality/time proof. A later `updatedAt` value is retained as status-update provenance, never substituted as deposit/settlement time. Route, refund, expiry/remedy decisions remain M01-owned; signed quote authenticity alone does not close G1/G4/G5 or prove the confidential bucket was credited.

Sources: [official quote-signature guide](https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature), [official 0.1.26 source package](https://www.npmjs.com/package/@defuse-protocol/one-click-sdk-typescript/v/0.1.26).

## Agent API: isolated proof module plus adapter wiring

Per explicit coordinator handoff, State & Money authored only new `src/custody/proofs.mjs` and `test/state-money/agent-proofs.test.mjs`; this worker did not edit those files. Its actual official **@near-intents-agent-api/sdk 0.9.0** operation verifier checks audit bindings against an independently pinned checkpoint and separate actual TDX/finality ports. The source/state handoff details those requirements.

`agent-api.mjs` now accepts private composition options `proofs` and `getProofInputs`. Expected proof terms are derived from the immutable admitted provider body `{confidential:true,asset,amount,recipient}` and `fingerprint(body)`, intentionally distinct from M01's whole-action fingerprint. Only the original `op_` correlation is eligible. `getProofInputs({expected,statusEvidence})` must acquire the matching proof/historical TEE info under a privately aligned independently verified witness/retained head. Proof JSON cannot choose a trusted head, key, deployment pin or authority. Saved capture replay uses the same expected bindings and current trusted verifier ports.

The documented read is `GET /v1/agents/{agent_id}/operations/{op_id}/proof?from_size=<trusted size>`, with backend partner authentication. Actual `/tee/info` must match the historical birth quote and approved pins; current info is never assumed to describe a prior deployment. This adapter does not manufacture missing acquisition/TDX/finality ports.

Crucially, the module's verified scope is **attested audit plus recorded NEAR finality**, not an independent account/asset/amount movement proof. Even a complete normalized audit finding leaves the financial ExternalResult unknown / `MOVEMENT_PROOF_UNVERIFIED`, with `auditProofVerifiedLocally` separated from `proofVerifiedLocally:false` and `movementVerification:'unavailable'`. No balances, credits, receipts or readiness are promoted from provider SUCCESS, an intent hash or an audit-only SDK verdict. Original-operation retries/reconciliation retain the same identity; no transfer is repeated.

## Exact checks for this implementation

- `node --test test/integrations-adapters/*.test.mjs` -> **49 passed, 0 failed**.
- `node --test test/integrations-adapters/*.test.mjs test/state-money/agent-proofs.test.mjs` -> **59 passed, 0 failed** (49 adapter + 10 isolated Agent proof checks).
- Syntax checks of 27 provider/adapter test modules passed.

New checks exercise actual SDK Node export/version loading; actual Ed25519 signature/payload verification on synthetic keys; request/response whitespace and byte mutation; missing/rotated signatures and policy mismatch; raw-byte private persistence/no auth headers; bounds/storage failure; single-use synchronous transport start and expiry; replay without cached proof booleans; official 1Click signed/excluded field scope; unsigned quote refusal; and audit-to-money nonpromotion. Synthetic TDX/RPC observations in the Agent tests are labeled. **No actual Cloud preflight, provider quote, deployed manager-key fixture or live hardware/money proof was performed.** Coordinator owns whole-product checks and component/UI integration.

---

## Previous R1 and historical evidence

# R1 integration isolation and read-only probes — 13 November 2026

This section supersedes the earlier implementation inventory below. The earlier record remains historical evidence, with its original fixture/public-probe labels. This R1 work did not call any funded provider, provision an account/grant, create deposit instructions against a deployed provider, run paid inference, install/change SDKs or dependencies, buy from a supplier, or edit the execution plan/critique. All new protocol/probe checks used local transports and isolated temporary journals. No current real-provider readiness or economic proof is claimed.

## Delivered R1 boundary

All synthetic custody/payment/funding/inference providers, scenario controls, fake identities, canned output hooks, fixed quotes and simulated receipts are now in `test/integrations-adapters/fixture-adapters.mjs`. Its four named factories are `createFixtureCustodyAdapter`, `createFixturePaymentsAdapter`, `createFixtureCloudFundingAdapter`, and `createFixtureInferenceAdapter`. They force simulated test mode and never resolve credentials or use a network transport. Explicit `undefined` clock/scenario options retain their test defaults. Product modules do not import these factories or their helpers. The coordinator owns the separate test application composition.

Real factories retain their existing names and command/result vocabulary, default to unavailable, and normalize unsupported modes to unavailable. They no longer accept fixture scenarios or produce fake success/credit/output. M06 has no purchase implementation and always returns `UNSUPPORTED_CAPABILITY`; `observeCredit()` refuses caller-authored balances with `CREDIT_EVIDENCE_UNVERIFIED`. Existing unknown effects/reservations are retained. Operation replay/reconciliation now rejects provider or mode changes as `PROVIDER_MODE_MISMATCH` instead of relabeling historical evidence.

The existing Agent API adapter was returned to this worker. It now requires explicit live/mainnet/account/confidential/protected credential configuration. Provider `SUCCESS` with a request-matching intent hash remains `unknown / EXECUTION_PROOF_UNVERIFIED` because no local execution-proof verifier is implemented. The provider-reported status/reference is retained for original-operation reconciliation; it never causes another transfer. An unverified intent hash is not finality proof. Its balance method delegates to the private-evidence probe instead of exposing raw balance data as additive capital.

Legacy 1Click factual comparison is explicitly labeled `verificationLevel: provider-reported-fields-only` and `signedEnvelopeVerified: false`. It is not G4 signed-quote/route/finality closure. The previous destination-hash/status-update-time assumptions remain unproven for the proposed confidential route. Cloud output carries `proof.status: unavailable / DURABLE_INFERENCE_PROOF_UNIMPLEMENTED`; no SDK verifier was added. Its old billing lookup still needs a deployed-contract check because current official docs mark the billing/balance paths as moving/deprecated. New runtime readiness must remain blocked on those capabilities.

## Probe exports and exact observation shape

- `src/inference/probes.mjs`: `createCloudModelProbe(options) -> {probe()}`.
- `src/payments/probes.mjs`: `createPaymentTokensProbe(options) -> {probe()}`.
- `src/custody/probes.mjs`: `createAgentApiProbes(options) -> {identity(),policy(),grant(),balance(),probe()}`. `probe()` explicitly requests the complete four-observation batch; focused methods observe only their named capability plus required identity preflight.

All methods are asynchronous. Construction performs zero requests, startup performs no requests, and no ambient environment variables are read. The coordinator calls a focused method only after M01 authorizes the authenticated owner's `runtime_probe(capability)` action. These adapters report facts; M01 alone derives readiness or spending decisions.

Returned records contain `{id,capability,provider,status,observedAt,expiresAt,identity:{companyId,network,treasuryAccount,bucket},policyVersion?,evidenceRef?,reasonCode?}`. Bindings and local `policyVersion` are injected by trusted composition; they are never inferred from adapter mode or fabricated from provider data. Records are bound into a stable content fingerprint. Missing binding, explicit positive `ttlMs`, bounded I/O limits, or private evidence storage yields unavailable before any read. Freshness expires during a slow read rather than being renewed after it. M01 must also invalidate facts when company/account/bucket/policy changes.

Common options: `{binding,policyVersion?,clock?,ttlMs,timeoutMs?,maxResponseBytes?,transport?,persistEvidence}`. Technical defaults are a 10-second read timeout and 1 MiB response cap; business freshness TTL has no adapter default. Cloud additionally requires `model`. Agent additionally uses `{agentId,secretRef,resolveSecret,balanceSource:'confidential',providerPolicyVersion?,grantId?,grantRef?}`; these reads do not resolve or send a grant token. `providerPolicyVersion` is the remote revision to compare; it does not replace the local M01 version.

`persistEvidence()` receives only a private payload `{provider,capability,observedAt,identity,policyVersion?,reads:[{request:{method,url,protocol},response:{httpStatus,bodyBase64,bodyHash,contentType,observedAt}}]}` and returns a private journal artifact reference `{id,hash,visibility:'private'}` or `private:<opaque>`. Exact response bytes/hash are retained privately before a public-safe record is returned. Request headers, API-key values, grant tokens and secret references are omitted. Evidence persistence failure/public references produce unavailable. Probe observations never append deposits, credit lots, allocations, financial adjustments or ledger events.

## Documented read protocol and limits

| Capability | Explicit read | Maximum calls per invocation | Result scope |
| --- | --- | --- | --- |
| `inference_model` | Public `GET https://cloud-api.near.ai/v1/models` | 1 | Exact selected model catalog membership can be verified. Does not verify model execution, tools, price/token/reasoning bounds, credits, attestation or response proof. |
| `payments_route` | Public `GET https://1click.chaindefuser.com/v0/tokens` | 1 | Valid catalog is only configured / `ROUTE_UNVERIFIED`. No deposit-generating quote, transfer, refund or settlement read occurs. |
| `custody_identity` | `GET https://api.agentsonintents.com/v1/agents/{agent_id}` | 1 | Provider-reported ACTIVE status and exact expected agent wallet account; no ownership signature/proof claim. |
| `custody_policy` | identity preflight, then `GET …/{agent_id}/policy` | 2 | APPLIED/synchronization/revision facts captured privately; absent signature verification remains unavailable. |
| `custody_grant` | identity preflight, then `GET …/{agent_id}/grants` | 2 | Matching grant lifecycle facts captured privately; token-to-grant/owner verification remains unavailable. |
| `custody_balance` | identity preflight, then `GET …/{agent_id}/balances?source=confidential` | 2 | Explicit private-bucket absolute observation only. Missing reconciliation watermark remains unavailable / `BALANCE_WATERMARK_UNVERIFIED`; never an opening balance or additive cash. |

The all-four Agent batch has at most seven GETs, including independent identity preflights. There are no retries, pagination loops, effect endpoints or provisioning operations. Agent reads require the partner `X-API-Key`; no `X-Grant-Token` is sent. Wrong network/bucket/account, absent credentials, errors, excessive payloads and stale responses cannot become verified. The grant list may show an active grant without proving that the protected token belongs to it; that remains explicitly unavailable.

The exported `CLOUD_MODEL_PROTOCOL`, `PAYMENT_TOKENS_PROTOCOL` and `AGENT_READ_PROTOCOL` freeze these implemented read limits and source references, reviewed 13 November. They explicitly set `deployedContractVerified:false`. Documentation establishes a read contract, not current deployed compatibility. Cloud's model-list schema is the official OpenAPI 1.0.0 OpenAI-compatible array under `data`; the path permits unauthenticated reads. The token catalog expects `assetId`, `blockchain` and integer `decimals`. Agent documentation describes the current-policy read's `revision`, `status`, `provider_policy_synced`, and grants' lifecycle fields. Undocumented/missing shapes remain unavailable rather than guessed.

Primary sources read for this revision: [Cloud model-list API](https://docs.near.ai/api-reference/chat/list-available-models), [Cloud docs index and deprecated billing entries](https://docs.near.ai/llms.txt), [1Click token catalog](https://docs.near-intents.org/api-reference/oneclick/get-supported-tokens), [Agent overview](https://docs.agentsonintents.com/integration/agent-api/overview), [Agent SDK read endpoints](https://docs.agentsonintents.com/integration/agent-api/sdk), [Agent policy read and synchronization](https://docs.agentsonintents.com/integration/agent-api/policies-and-limits), [Grant list and token boundary](https://docs.agentsonintents.com/integration/agent-api/grants), [Explicit confidential balance read](https://docs.agentsonintents.com/integration/agent-api/funding). Some Agent `.md`/index reads returned 404; readable official documentation snapshots were used, not invented replacement endpoints.

## Current verification and open gates

`node --test test/integrations-adapters/*.test.mjs`: **38 passed, 0 failed**. This includes prior durability/ambiguity checks, real-factory mode isolation, cross-mode/provider historical replay rejection, test-factory no-network behavior, transitive provider import checks, no-startup probes, missing binding/TTL/storage, exact model selection, route-not-promoted catalog reads, private evidence/no-secret-header capture, expiry during read, wrong identity/network/bucket, and an Agent SUCCESS/hash that remains unknown without proof. Local HTTP stand-ins exercise protocol code; they do not prove deployed behavior.

No real provider probes were run in this revision. Earlier public-only catalog observations below remain historical and must not be treated as fresh company-bound observations. The coordinator owns full cross-module test rewiring and product startup/browser/static-graph acceptance.

**G1/G3/G4/G5/G6 are not closed:** actual spendable route/account-policy-grant proof; independently reconciled balances/credit; signed exact-output quote and confidential settlement semantics; executable funded remedy; durable Cloud preflight/request/response/signature/billing verification all remain open. Autonomous Cloud purchasing remains unsupported. No supplier procurement was enabled.

Next reversible step: wire these explicit probe functions behind owner-authorized M01 actions and private journal evidence, then present the precise missing facts. Next external proof requires the separately approved account/route/numeric limits and missing proof protocol; this handoff authorizes no paid/provisioning action.

---

## Historical integration record (before R1 isolation)

# M04–M07 integration evidence

As of 11 November 2026 (workspace date). Public probe timestamps below are UTC on 10 November. This is an implementation and local-fixture milestone, not a live autonomous-business proof. No wallet/account was provisioned, no money moved, and no paid inference was called.

## Actual verification

`node --test test/integrations-adapters/*.test.mjs`: **25 passed, 0 failed**. Tests use the real M02 durable journal, controlled provider fixtures and local Node HTTP stand-ins. They exercise the adapter implementations and request serialization, not real vendor execution. The HTTP tests route injected transport to loopback; `mode: live`/`testnet` in those cases selects the production code path against a simulated upstream and is not live evidence.

The focused checks cover:

- Exact action fingerprints, allow/deny/hold enforcement, missing final gate, concurrent/repeated submissions and payload conflicts.
- Durable intent before effect, journal fault preventing dispatch, lost response after simulated acceptance, restart and delayed reconciliation without another submission.
- Pending/failed/unknown fixture outcomes, known incurred cost on failure, output with pending actual cost, and late billing reconciliation.
- Exact-output payment quotes with two explicitly simulated input assets; unsupported asset, stale quote, wrong network/asset/recipient/amount/finality, altered quote, duplicate settlement and late settlement facts.
- Documented HTTP request shapes, credential resolution before the final gate, redaction of upstream fields/errors, and absence of credentials in the durable journal.
- A local OutLayer response followed by a local NEAR `tx`/`FINAL` response verifying the expected signer, recipient and exact native transfer; gas amounts are recorded separately from unknown storage/custody costs.
- Cloud `inference-id` correlation (never `x-request-id`), delayed/missing billing records, and an accepted HTTP request whose socket closes before its response.

Public, unauthenticated read-only probes:

| Endpoint | Observed UTC | Result | Proves |
| --- | --- | --- | --- |
| `GET https://1click.chaindefuser.com/v0/tokens` | 2026-11-10T20:14:57.093Z | HTTP 200, 229 token records | Public catalog reachability and returned field names only |
| `GET https://cloud-api.near.ai/v1/models` | 2026-11-10T20:14:57.950Z | HTTP 200, 64 model records | Public model catalog reachability only |

No quote, settlement, custody operation, funding purchase, generation or billing lookup was probed against a funded real account. No testnet end-to-end loop or under-120-second real run is claimed.

## Capability status and authoritative sources

**M04 custody:** fixture transfer/call/reconciliation is implemented. The HTTP adapter uses OutLayer protected API credentials resolved through an injected secret reference. It has no registration, key export, policy mutation, account deletion or raw-sign API. Native NEAR transfers and exact M01-approved restricted calls use documented endpoints. An expected account identity is required and compared with the provider address before dispatch. A transaction hash is pending evidence; read-only NEAR RPC reconciliation verifies the final transaction and its exact payload. Lost responses with no provider/transaction reference remain unknown and are not resubmitted. These paths have local HTTP evidence only. Actual protected credentials, account ownership, custody policy and funds are absent. [OutLayer custody documentation](https://app.outlayer.ai/docs/agent-custody), [NEAR transaction RPC](https://docs.near.org/api/rpc/transactions).

OutLayer documents mainnet and testnet native custody operations, and explicitly says its Intents-dependent testnet endpoints return 503. The payment adapter therefore returns `UNSUPPORTED_CAPABILITY` for testnet rather than substituting a network. [OutLayer API and network limits](https://app.outlayer.ai/docs/agent-custody).

**M05 payments:** fixture checkout and settlement facts work with `demo-usdc` and supplied `demo-near` quote facts. Deposit instructions begin `fixture-only-do-not-send:`. The HTTP adapter checks the current `/v0/tokens` catalog, requests `/v0/quote` with `swapType: EXACT_OUTPUT`, checks echoed assets/recipient and destination amount, and reads `/v0/status` directly using the stored deposit address/memo. Caller observations cannot assert a live settlement. A successful provider status is checked against the original quote, actual output, recipient and destination transaction references. This is provider-reported settlement evidence over authenticated transport, not an independent destination-chain audit. `updatedAt` is labeled as the provider status timestamp; it is not asserted to be an independently measured deposit time. Official docs explicitly state there is no Intents testnet deployment. [Quote schema](https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote), [Status schema](https://docs.near-intents.org/api-reference/oneclick/check-swap-execution-status), [Official FAQ](https://docs.near-intents.org/resources/faqs).

M05 returns arrived money as an external `confirmed` observation even when the factual comparison fails or arrives late. `settlement.verified`, `mismatches` and `withinInvoiceWindow` go to M01. Only M01 decides acceptance, eligibility and remedy; M05 never marks an order paid or allocates a sale. All local quote/settlement records are in its journal namespace.

**M06 funding:** controlled fixture purchase/reconciliation is implemented. Receipt provenance explicitly distinguishes agent-funded purchases from credit observations. All non-fixture purchase modes return `UNSUPPORTED_CAPABILITY`; they make no HTTP request. An owner-prepaid credit observation is not a purchase. The Cloud quickstart describes owner account setup and buying credits through the UI; that does not establish an agent-controlled purchase API. The documented administrator limit endpoint changes limits and is not proof of payment. No admin limit mutation is implemented. A staking-farm integration is also not assumed to be a spend-authorized credit-purchase route for this MVP. [Cloud quickstart](https://docs.near.ai/cloud/quickstart), [Administrator limits](https://docs.near.ai/api-reference/admin/update-organization-limits-admin-only), [Billing summary distinction](https://docs.near.ai/api-reference/admin/get-the-platform-billing-summary-admin-only).

**M07 inference:** controlled fixture generation uses an injected evidence-derived `fixtureOutput(request)`. Simulated usage/costs are labeled and cannot pass live billing acceptance. The HTTP path implements documented non-streaming `POST /v1/chat/completions`, with one completion, approved `max_tokens`, input-byte bounds and timeout; tools/search are not added. The request's complete fingerprint is bound into the M01 action. Live calls require independently established reasoning-inclusive provider charge-bound evidence, verified credit facts, an M01 permit and the final dispatch gate. The current demonstration Rules configuration does not authorize paid live work. [Cloud chat completion schema](https://docs.near.ai/api-reference/chat/create-chat-completion), [Quickstart](https://docs.near.ai/cloud/quickstart).

Generated output can be `confirmed` while its separate `cost.status` is `pending` and `actualCostNanoUsd` is null. Read-only `POST /v1/billing/costs` uses the `inference-id` UUID returned in the completion response header. The docs warn that unmatched IDs return zero and recently finished usage can be delayed; a warning, absent row or zero does not release the pending cost here. A lost response without an inference ID/output has no documented recovery guarantee in this implementation and remains unknown without a new paid call. Organization usage export is documented for investigation but is not automatically matched to an ambiguous action. [Request-cost schema](https://docs.near.ai/api-reference/billing/get-costs-by-request-ids), [Usage reporting](https://docs.near.ai/cloud/guides/usage-reporting).

## Dispatch and persistence contract

M04/M06/M07 need `journal` and `dispatchAuthorized({action,decision,facts}, callback)` supplied by composition. They persist an immutable operation and unknown dispatch marker before the gate. Composition consumes the permit through M03, obtains fresh facts, and invokes M01's serialized final check. The callback must start transport immediately and exactly once. Protected credentials and account preflight occur before this gate. Adapters do not load config or define prices, revenue splits, spending caps, retry/refund rules or report eligibility.

The operation key is module-prefixed and immutable. Repeating pending/unknown/failed/confirmed actions returns existing evidence; it never repeats the external effect. A new attempt requires a new M01-approved action identity after M01 has assessed the original outcome. Reconciliation is read-only. Local operation IDs are not advertised as provider idempotency guarantees.

## Discovery limits

Official vendor schemas were read directly, with Agent Reach/Exa used for source discovery. Postman Orbit search returned unrelated providers rather than authoritative NEAR contracts; none were used. Installed Postman CLI reports 1.73.0, but `postman status` returns `error: unknown command 'status'`, so authenticated workspace/context discovery was skipped. No account login, shared Postman initialization or publishing was performed. Dependency transport checks use local Node HTTP servers within the assigned test directory.

## Next real proof

1. Establish one protected OutLayer account credential, owner-enforced policy and an explicit authorized network/amount cap. Run a single bounded native transfer, then reconcile its final RPC payload and fees. Do not create or fund the account implicitly.
2. Resolve the official Intents testnet requirement explicitly before any mainnet substitution. On an approved funded route, get an exact-output quote for each intended input asset, retain the signed/provider quote and deposit reference, and reconcile actual recipient settlement plus expiry/refund behavior.
3. Obtain vendor confirmation of an agent-usable Cloud purchase route and its payment-to-credit reconciliation. Prove one authorized cash-to-credit event linked to the agent. Prepaid credits may support a separately labeled inference-only proof meanwhile.
4. With separately approved paid-inference limits, establish the chosen model's input/output/reasoning charge bound, execute one request, retain both response and inference IDs, and obtain actual billing evidence. Keep the reservation pending until billing is final.
5. Only after these component proofs should the coordinator attempt strict live loops and timed end-to-end acceptance. The current local fixture loop remains useful without claiming those gates passed.
