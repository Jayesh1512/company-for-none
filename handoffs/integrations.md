# Current Cloud/1Click/Agent SDK handoff — 13 November 2026

WORKER_DONE for authorized reversible SDK/provider integration. No actual provider/paid call, key/account/grant request, provisioning, transfer, quote, supplier purchase or external deployment. Coordinator owns/pinned package/lock/Node/app/config/runner/UI changes. Previous handoffs below remain historical.

## Files and exact ports

**Cloud new:** `src/inference/verification.mjs`, `src/inference/capture.mjs`; factory reexport in `src/inference/index.mjs`. `createCloudVerification({journal,clock?,secretRef?,resolveSecret?,limits:{timeoutMs,maxEvidenceBytes}})` returns `preflight`, `prepare`, `replay`. Loader verifies installed Node >=24.22.1 and @nearai/inference-sdk/node version0.3.0. No fallback.

- `preflight({actionId?,requestFingerprint?,request?,model?,verificationSpec})` returns actual normalized local SDK attestation finding; no completion hash until a completion exists. Bare model/spec scope fingerprints separately.
- `prepare({action,request,verificationSpec})` returns a single-use FUNCTION `send` with immutable `.preflight`, `.requestFingerprint`, `.requestBytesHash`, `.evidenceRef`. The full request's verificationSpec and action's request fingerprint must agree. Actual encrypted wire bytes/preflight evidence are durable before this returns. Same prepared action cannot be regenerated after restart; reconcile original evidence.
- Coordinator persists its exact operation/reservation and consumed permit, then invokes `send()` directly in M01 final dispatch callback. It reaches pinned POST synchronously before any await. It returns ExternalResult `{status,mode:'live',simulated:false,provider:'near-ai-cloud',providerRequestId,inferenceId,generation:{output,providerRequestId,inferenceId,usage,finishReason,proof,cost},proof,cost:{status:'pending',actualCostNanoUsd:null}}`.
- `replay({evidenceRef,requestFingerprint,verificationSpec})` reads its private artifact and reruns official public signature helpers over exact wire bytes; no provider/network calls. It does not reuse stored TCB/verified booleans.

M01 spec is required exactly: near-tee-e2ee-chat, official sdk{name,version,nodeEntry}, ed25519, mandatory gateway/model/signature, accepted TCB statuses and age, cacheTTL0, provider_tee, policyFingerprint. The module uses public/protected SDK hooks only, no private members or custom cryptography. Actual raw gateway/model/signature/completion exchanges are persisted before SDK parsing, with safe header allowlists excluding credentials. Exact plaintext report-text UTF8 hash is separate from full decrypted JSON/ciphertext hashes.

Findings live latest-per-ID in private journal `inferenceVerification`. Normalized canonical fields match `handoffs/rules.md`: source local-sdk/sdkVersion/sdk, stage/status/requestFingerprint/model/policyFingerprint, same-authority verificationPolicyFingerprint alias, verifiedAt ISO/evidenceRef, gateway/models actual TCB/nonces/signers/local SDK times, optional exact completion hashes/signature fields. Evidence refs are `private:<sha256>` journal artifacts. Raw bytes/input bundle remains private. A failed/unavailable preflight supersedes its current old finding where the same scoped ID is used.

**G6 hard limit:** public SDK0.3.0 E2EE ephemeral response private key is closure-only, with no public export/import. Process verifyResponse/decryption is separately recorded, but durable plaintext binding is NOT independently replayable. Offline attestation collateral revalidation is also unsupported here. Response `status`, `plaintextBindingStatus`, `durableReplayStatus` remain unavailable even when wireSignatureVerified is true. M01 strict business report/delivery holds. No saved boolean or JSON/ciphertext-body hash becomes report proof. SDK third-party collateral checks are not fully cancellable; wrapper timeout aborts owned provider I/O without authorizing paid dispatch.

Business `createInferenceAdapter.generate()` remains legacy HTTP with explicit proof-unavailable metadata, per coordinator decision. No prepareVerified alias or silent migration. Actual SDK component entry is wired by coordinator. Billing costs remain pending without actual attributed receipt/watermark; no invented balance/sequence/time placeholder.

**Non-E2EE feasibility only:** documented SDK e2ee:false + canonical supported NEAR model/x-no-aliasing + pinned TLS/provider_tee could permit durable plaintext wire replay without the ephemeral-key issue. It still needs original attestation/collateral/provenance trust and an explicit separate security/route decision. Not selected, no fallback implemented.

**1Click new:** `src/payments/signatures.mjs`, changes to `http.mjs`/`index.mjs`. `createPaymentSignatureVerifier({journal,clock}) -> verifyQuote({evidenceRef})/verifyStatus({evidenceRef})` uses actual official 0.1.26 pinned default manager key; no product key override/custom verifier. `quoteWithEvidence`/`statusWithEvidence` retain exact private request/response bytes before JSON. Invalid/missing signature blocks real deposit instructions. Status verifies only nested quoteResponse; mutable status/swapDetails/finality/time remain unproven and settlement stays unknown. SDK excludes some request metadata/fees from signed fields; evidence doc lists exact scope. updatedAt is no longer a settlement timestamp.

**Agent wiring:** new isolated proofs.mjs belongs to State & Money per coordinator handoff; this worker changed only agent-api.mjs. Inject trusted `options.proofs` and `getProofInputs({expected,statusEvidence})`. Expected payload is EXACT admitted `{confidential:true,asset,amount,recipient}` and its shared hash, separate from whole action. The acquisition port must align original op proof from_size and independently verified private checkpoint; historical tee/info must match birth/deployment pins, never assume current info. Existing evidence can replay via proof module.

An Agent proof verified only for attested audit + recorded NEAR finality does NOT prove money movement. Adapter still returns unknown/MOVEMENT_PROOF_UNVERIFIED, preserving audit subresults; receipt.proofVerifiedLocally false/movementVerification unavailable. Missing ports/pins/TDX/RPC/bindings remain unresolved. No balance/credit/readiness promotion or new transfer from an audit SDK boolean.

## Tests and evidence

- `node --test test/integrations-adapters/*.test.mjs` -> **49/49 passing**.
- `node --test test/integrations-adapters/*.test.mjs test/state-money/agent-proofs.test.mjs` -> **59/59 passing**.
- Syntax of 27 provider/adapter test files checked successfully.
- Actual SDK cryptographic helpers verify explicitly synthetic keys/documents; local HTTP captures/bounds/replay/unknown checks remain local evidence. No actual provider preflight/hardware/settlement/deployed-manager-key success proof was performed.
- Exact official docs/source API limitations and historical records: `docs/INTEGRATION_EVIDENCE.md` current top section.

Next coordinator: run full cross-suite/runner/UI checks; wire only exact trusted findings into getRuntimeFacts; keep G1/G3/G4/G5/G6 and autonomous funding blocked until their actual evidence. Component execution still requires separate exact authorized request/credit/caps and current final gate. Do not ask for keys or execute funded calls from this handoff. Concrete follow-ups remain in this same integration worker thread.

---

## Earlier integration handoffs (historical)

# R1 integrations handoff — 13 November 2026

Status: assigned reversible fixture isolation and read-only probe implementation complete. Real economic/proof gates remain open. Prior handoff below is historical; this section is the current factory/probe contract. No changes to plan/critique, dependencies/SDKs, shared composition/contracts, accounts/grants, suppliers or funded providers.

## Exact exports for composition

`test/integrations-adapters/fixture-adapters.mjs` exports **createFixtureCustodyAdapter, createFixturePaymentsAdapter, createFixtureCloudFundingAdapter, createFixtureInferenceAdapter**. Same commands/results/options as the previous fixture branches. Mode is forced to fixture; they never resolve credentials or use transport. `clock` and `scenarios` explicitly set to undefined retain defaults. Inject research's test-only output function. Coordinator owns `test/helpers/create-fixture-app.mjs` and rewires cross-module tests.

Real factories keep **createCustodyAdapter, createAgentApiCustody, createPaymentsAdapter, createCloudFundingAdapter, createInferenceAdapter**. Default/unsupported modes fail closed as unavailable. Product providers contain no synthetic receipt/identity/quote/output implementations. No real factory imports test providers. The shared durable operation runtime preserves unknown effects and rejects cross-provider/mode replay. M06 non-fixture purchase is always unsupported; caller-authored credit JSON is refused rather than confirmed.

Agent API now requires explicit mode live/mainnet/existing identity/confidential/secret+grant references. Its provider SUCCESS/hash remains unknown/EXECUTION_PROOF_UNVERIFIED, preserving provider status and correlation, until actual execution-proof verification exists. Balance returns the private-evidence probe observation. Payment receipts explicitly mark signedEnvelopeVerified:false/field-comparison-only; Cloud generation explicitly marks proof unavailable. These are not G1/G4/G5/G6 closure.

Probe exports (no requests at construction):

- `src/inference/probes.mjs`: **createCloudModelProbe(options)** -> `{probe()}`. Capability inference_model; exact selected model catalog membership only.
- `src/payments/probes.mjs`: **createPaymentTokensProbe(options)** -> `{probe()}`. Capability payments_route; catalog success is configured/ROUTE_UNVERIFIED, never route/refund verification.
- `src/custody/probes.mjs`: **createAgentApiProbes(options)** -> `{identity(),policy(),grant(),balance(),probe()}`. Named methods return one observation; probe returns the four-observation array. Capability names custody_identity/custody_policy/custody_grant/custody_balance. Only exact provider ACTIVE/account identity may be verified; missing policy-signature/grant-token binding/balance watermark stays unavailable.

Common options `{binding:{companyId,network,treasuryAccount,bucket},policyVersion?,clock?,ttlMs,timeoutMs?,maxResponseBytes?,transport?,persistEvidence}`. TTL required; technical timeout/response defaults 10 seconds/1 MiB. Clock defaults to actual time. Cloud requires `model`. Agent requires `agentId,secretRef,resolveSecret,balanceSource:'confidential'`, and uses optional remote `providerPolicyVersion`/`grantId` to diagnose the missing contract. Grant refs/tokens are not resolved/sent for reads. Neither environment credentials nor mode imply verified facts.

Every result is exactly the accepted `{id,capability,provider,status,observedAt,expiresAt,identity,policyVersion?,evidenceRef?,reasonCode?}`. Missing binding/TTL/private storage produces unavailable before requests. Private evidence callback gets `{provider,capability,observedAt,identity,policyVersion?,reads:[{request:{method,url,protocol},response:{httpStatus,bodyBase64,bodyHash,contentType,observedAt}}]}`. Return a private journal artifact ref `{id,hash,visibility:'private'}` or `private:<opaque>`. No request auth headers, credential values/references or grant tokens are persisted. Returned observations have no raw provider body.

Named probe limits: model 1 public GET; tokens 1 public GET; Agent identity 1 authenticated GET; policy/grant/balance each identity+target =2 GET; all-four Agent batch =7 GET. No retries/pagination/effects/provisioning, no startup calls. Exact documented URLs/schema restrictions are in exported protocol constants and `docs/INTEGRATION_EVIDENCE.md`. These constants set deployedContractVerified:false. Absolute balance observations are not G3 capital/credit facts and never modify Treasury.

## Checks and current scope

- `node --test test/integrations-adapters/*.test.mjs` -> **38 passed, 0 failed**.
- Syntax-check every `.mjs` in the four owned source directories and `test/integrations-adapters/` before completion.
- All new HTTP/probe checks use injected local/loopback transports and temporary stores. No current real-provider probe was run; historical public catalog observations remain dated historical evidence.
- Coordinator is adapting old business expectations to real/setup readiness and the new unverified Agent proof state. This worker did not edit cross-module tests/app/server/contracts/package files.

Remaining: G1 spendable route/policy/grant; G3 independent balances/credit reconciliation; G4 exact signed provider envelopes and confidential finality/time semantics; G5 funded executable refund; G6 durable proof SDK/byte capture/current billing contract. No autonomous funding or supplier purchase exists. `docs/INTEGRATION_EVIDENCE.md` records current scope and preserves the original fixture milestone below it.

Next coordinator step: wire only owner-authorized runtime_probe invocations and private raw evidence/sanitized facts; let M01 consume them through getRuntimeFacts. Preserve separate historical stores. Run cross-module product import/browser/missing-access checks after test composition rewiring. No broadening of real gates or funded action is authorized by this handoff. Continue concrete follow-ups in this same worker thread.

---

## Historical integrations handoff (before R1)

# Integrations handoff — M04/M05/M06/M07

Status: implementation complete for the controlled fixture milestone; documented HTTP paths locally exercised. Real custody/payment/funding/paid-inference acceptance remains unproven. Exclusive paths retained; no shared setup/contracts/package edits, external deployment, staging or account creation.

## Files and exports

- `src/custody/index.mjs`: `createCustodyAdapter(options)` → capabilities, identity, balance, transfer, call, reconcile.
- `src/custody/adapter-runtime.mjs`: internal shared adapter persistence/technical mechanics using coordinator-owned shared fingerprint/Money helpers. Not another business-rule/config layer.
- `src/custody/http.mjs`: documented protected-credential OutLayer HTTP transport; no account/key/policy provisioning.
- `src/custody/near-rpc.mjs`: read-only exact-payload/finality/gas reconciliation.
- `src/payments/index.mjs`: `createPaymentsAdapter(options)` → capabilities, quote, verifySettlement/reconcile; `src/payments/http.mjs` documented 1Click client.
- `src/cloud-funding/index.mjs`: `createCloudFundingAdapter(options)` → capabilities, observeCredit, fund, reconcile. Every non-fixture funding attempt is unsupported.
- `src/inference/index.mjs`: `createInferenceAdapter(options)` → capabilities, generate, reconcile; `src/inference/http.mjs` documented completion and read-only billing client.
- `test/integrations-adapters/{fixtures.mjs,effects.test.mjs,payments.test.mjs,http.test.mjs}`; evidence at `docs/INTEGRATION_EVIDENCE.md`.

## Composition details

All factories default to **unavailable**. For the local MVP pass `mode:'fixture'`, the shared durable `journal`, `clock` if needed and the coordinator's real `dispatchAuthorized` port for custody/funding/inference. Its final Rules decision must use canonical `status:'allow'`, `actionFingerprint` and a matching permit. Missing or mismatched authorization fails closed. No adapter reads config.

Commands for M04/M06/M07 are `{action,decision,facts,...}`. The action itself is immutable and is what M01 fingerprints. Module journal operation keys use `adapters:m04:`, `adapters:m06:`, `adapters:m07:`. Pending/unknown operations are replayed as recorded, never resubmitted; `.reconcile()` queries/observes the original effect only. Fixture scenario controls are trusted factory options, not request-body options.

**Custody:** fixture default network `fixture`, account `fixture-agent.testnet` (synthetic identity); pass an explicit `accountId` if the app wants another display identity. Transfer action `{id,type,recipient,money,network?}`; network defaults from Money. Call additionally needs `methodName,args`. `.receipt` has exact recipient/money, transaction evidence and fees. Live/testnet HTTP requires `network:'near:mainnet'|'near:testnet'`, expected `accountId`, protected `secretRef/resolveSecret` and optional injected transport/rpcTransport. Native endpoint supports native NEAR only; approved token operations use restricted calls. Chain-confirmed transfers can still have pending storage/custody fee evidence.

**Payments:** `quote({action,offer,sourceAsset,recipient,refundTo,expiresAt,decision,fixtureInputMoney?})`. Frozen `offer.price` is destination and `offer.treasuryAccount` recipient. `decision.status='allow'` required. Fixture source defaults match M01 example assets: `{network:'fixture',asset:'demo-usdc',decimals:6}` and `demo-near`/24. For cross-asset quotes inject exact provider fixture facts via `fixtureQuotes:{'demo-near':Money}` or per-command `fixtureInputMoney`; no local FX/price rule. The quote is at `.quote` with `id,invoiceId,requiredInput,destination,recipient,refundTo,expiresAt,depositAddress,providerReference,costs,mode,simulated`.

`verifySettlement({action,quote,observation?})`: trusted fixture composition can supply `{status:'confirmed'}` for the synthetic local settlement. Pending is the default. Live mode ignores supplied observations. Arrived money remains external status `confirmed` even when mismatched/late: M01 **must assess** `.settlement.verified`, `.mismatches`, `.withinInvoiceWindow`; this adapter does not start a sale. Settlement also appears at `.receipt`. Store/dedupe by `.settlement.id` in treasury. Live catalog networks use `${blockchain}:mainnet`; no testnet fallback. HTTP `slippageTolerance` must be explicit.

**Funding:** action requires `{id,type:'funding',agentId,requiredCreditNanoUsd,creditId?,money?,recipient?}`. `.receipt` contains `kind:'credit_purchase',agentId,creditId,fundingProvenance:'agent_funded',requestedCreditNanoUsd,purchasedCreditNanoUsd,availableCreditNanoUsd,cashSpent,fundingOperationId`. Only confirmed fixture purchases have credited amounts. `observeCredit({credit:{availableNanoUsd,fundingProvenance,...}})` returns a credit observation with `autonomousPurchase:false`; accepted provenance values `agent_funded|owner_prepaid|unknown`.

**Inference:** inject `fixtureOutput` from `src/research/index.mjs`. `generate({action,decision,facts,request,credit})`; credit `{status:'confirmed',availableNanoUsd,...}` is supplied verified evidence for M01, not independently authorized by M07. Require `action.requestFingerprint=fingerprint(request)` and `action.maxCostNanoUsd=request.chargeBound.maxCostNanoUsd`. Request fields follow the guide. Default fixture actual cost `10000000` nanoUSD; override `fixtureCostNanoUsd` or trusted scenario facts. Output at `.generation.output`, IDs at `.generation.providerRequestId`, usage at `.generation.usage`, cost at both `.cost` and `.generation.cost`. Actual cost `{status:'actual',actualCostNanoUsd:'...'}`; pending `{status:'pending',actualCostNanoUsd:null}`. Confirmed output alone must not release the reservation or count as fully reconciled completion.

Factory `scenarios` keyed by action id support `{status:'pending'|'failed'|'unknown'|'confirmed',lostResponse:true,reconcileStatus:...,actualCostNanoUsd:...,costPending:true,reconciledCostPending:...}`. Changing a reconciliation scenario models delayed provider evidence and does not make another effect. M05 scenarios keyed quote id can contain `observation`.

## Exact verification and evidence

- `node --test test/integrations-adapters/*.test.mjs` → **25 passed, 0 failed**.
- `node --check src/custody/index.mjs && node --check src/payments/index.mjs && node --check src/inference/index.mjs && node --check src/cloud-funding/index.mjs` → passed.
- Public GET Intents token catalog → 200/229 records at 2026-11-10T20:14:57.093Z; public GET Cloud model catalog → 200/64 at 20:14:57.950Z. Read-only catalog evidence only.
- Local HTTP tests use the actual adapter code against loopback vendor stand-ins. They prove serialization, correlation, finality comparison, delayed billing, redaction and unknown-effect behavior under those controlled scenarios. They do not prove vendor-side execution or idempotency.
- Postman CLI `status` unsupported in installed 1.73.0; official docs and local Node HTTP checks used. No dependency/setup changes requested.

## Blockers and next step

No blocker to the coordinator's fixture loop. No credentials or funded cap are established. Official Intents testnet is unsupported; autonomous Cloud purchase is unverified; the live model's reasoning-inclusive charge bound is not established. Real next-proof sequence and source URLs are in `docs/INTEGRATION_EVIDENCE.md`. No paid action, account provisioning or network substitution is authorized by this handoff.

Coordinator next: wire these factories and final permit-consumption/Rules gate; supply exact M06 credit/cash plan fields and M07 request fingerprint; run normal fixture loop plus restart/unknown scenarios. Send any integration mismatch to this same worker thread; ownership remains here for follow-ups.
