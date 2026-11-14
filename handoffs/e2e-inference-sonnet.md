# S2 inference handoff — 14 November 2026

WORKER_BLOCKED for accepted durable E2EE output; all independent owned implementation and checks below are complete. Resumed the same worker thread under codex/gpt-6.1-sol/high. No new chats/agents, commits, dependency/config/env changes, paid calls, funding, provisioning or user-store mutations.

The unfinished custom decryptor and global tweetnacl RNG hook are removed from production. There is no option to enable them as a proof shortcut. The strict E2EE business route remains held. An API key alone cannot remove this security blocker.

## Current changes and frozen interfaces

- `src/inference/verification.mjs`: SDK-only E2EE preparation/decryption; immutable constructor-option snapshot and returned interface; rejects `durableReplyKey:true`, `captureReplyKey` and `nacl` with `SDK_DURABLE_REPLY_KEY_UNSUPPORTED` before SDK loading. `durableReplyKey:false` is compatible with the default closure-only route. Removed all custom plaintext recovery/key-capture imports and code. Every response, replay and recovery finding keeps `plaintextBindingStatus` and `durableReplayStatus` unavailable. A live process signature can still be recorded independently without becoming accepted output.
- `src/inference/e2ee-reply.mjs`: deleted the unfinished unsupported implementation. Earlier source was preserved outside the checkout at `/tmp/s2-resume-originals/`; it has no production import or activation path.
- `src/inference/capture.mjs`: retained exact private byte capture before parsing, bounded evidence, credential-header exclusion, and the immediate single-use prepared dispatch. Individually persisted frames retain action/run identity through the verification wrapper.
- `src/inference/index.mjs`: reexports `CLOUD_DURABLE_RECOVERY`; capability metadata reports `durableRecoverySupported:false` and the reason code. Existing business dispatch remains official-SDK prepared E2EE with current M01/Treasury gates.
- `src/inference/http.mjs`: both legacy completion entry points now emit `max_completion_tokens:maxOutputTokens`, `n:1`, `stream:false`, without legacy `max_tokens`. This is the coordinator-requested follow-up to the shared encoder change; the business transport still uses the official SDK.
- `src/runtime/components.mjs`: adds owner/current-M01-policy-gated `recover(access,{id})`; no HTTP route was added. Inspection never settles cost, frees reserves, overwrites the original operation or admits output.
- `test/near-e2e-inference/durable-e2ee.test.mjs`: supported SDK and explicitly synthetic fault/replay/gate tests; no custom decryptor or RNG-capture implementation. `test/integrations-adapters/http.test.mjs` has the coordinator-authorized payload expectation update.

`createCloudVerification({journal,resolveSecret?,secretRef?,clock?,limits:{maxEvidenceBytes,timeoutMs},loadSdk?})` returns frozen `{preflight,prepare,replay,recover}`. `loadSdk` is the existing trusted composition/test port, never an HTTP/user-supplied verification override. Construction performs no provider I/O. No supported key-export/import option exists.

Frozen export `CLOUD_DURABLE_RECOVERY` is:

```js
{supported:false,reasonCode:'E2EE_PLAINTEXT_REPLAY_UNSUPPORTED',
 evidenceScope:'recorded-wire-signature-only',sdk:CLOUD_VERIFICATION_SDK}
```

`recover({actionId,model,requestFingerprint?,verificationSpec})` requires the prepared record, exact current model/full verification policy, and original action/run/request-frame identity. It reconstructs captured request/response/signature facts from the private journal. It rechecks frame hashes and the official SDK signature over original bytes, with model/signer/nonce consistency checks. It returns:

```js
{verification,output:null,completionSent:false,originalCompletionCaptured:true,
 status:'unknown',cost:{status:'pending',actualCostNanoUsd:null}}
```

`completionSent:false` describes the recovery operation; `originalCompletionCaptured:true` describes the historical response. The SDK closure key is unavailable after restart. Saved plaintext, reply-key references, TCB/proof/success booleans cannot change this. Missing response persistence throws `COMPLETION_RESPONSE_NOT_CAPTURED`; missing signature cannot establish a wire signature. Existing prepared operations cannot be prepared again, including after restart without credentials. Replay/recovery have distinct finding IDs/stages and cannot overwrite a response finding. Old prepared records without the new durable identity/policy fields remain unavailable rather than being migrated by guessing.

Component recovery adds `{operationId,proofScope:'wire-only',businessDeliveryAllowed:false}`. Its selected model/policy come from M01; caller JSON cannot choose security policy. No money mutation or accounting receipt is produced.

## Actual public evidence

Read the existing safe summary `artifacts/near-public-attestation-20261113.json`: the historical check reported gateway/model `UpToDate` with no completion; that is not fresh business authority. Also inspected the separate older `.runtime/cloud-proof` journal read-only; its earlier unavailable record was not relabeled.

Reran the real pinned official SDK on Node **v26.12.1**, with no secret reference or credential, in a newly created isolated private store. Actual result at **2026-11-14T08:31:01.951Z**:

- Model `Qwen/Qwen3.8-27B`; preflight verified; gateway `UpToDate`; one model `UpToDate`.
- Exact raw gateway, metadata and model-attestation request/response frames exist: six frames, all with SHA256 body hashes; model nonce input agrees with the captured report; gateway nonce input exists.
- Zero completion frames; zero paid calls. No plaintext or business-delivery proof.
- Store: `/var/folders/cg/g6zcn0xn237dnp6xrmh694y40000gn/T/near1-s2-public-preflight-b6D46C`.
- Bundle: `private:60454d009641fb32b5bede3b94386b72ebf1bcc5cfda9c8dfb20f6f6f6e58ec1`.
- Safe result: `/tmp/near1-s2-free-preflight-summary.json`; invocation: `/tmp/near1-s2-free-preflight.mjs`.

This store is temporary and must be preserved privately if the coordinator wants longer-lived evidence. No evidence was copied into the user's product store.

## Supported upstream capability and minimal decision

Read current official releases/source on 14 November. Latest release is **v0.3.0**, published 8 November. Current main is **9cc67f723614781f70c8e7475c909780483d35e8**. The installed declarations and current-main `js/src/types/e2ee.ts` expose only `request` and `decryptResponse` on `PreparedE2eeChatRequest`; preparation accepts only `request` and `modelKey`. `js/src/core/e2ee-request.ts` generates fresh client key material internally and captures it in the response-decryption closure. There is no supported durable export/import or caller-provided reply-key API. Current-main QVL hardening does not add one. Upgrading to the current release or main alone therefore does not solve durable plaintext recovery.

Primary sources:

- [Official releases](https://github.com/nearai/inference-sdk/releases/tag/v0.3.0).
- [Current-main public E2EE types](https://github.com/nearai/inference-sdk/blob/9cc67f723614781f70c8e7475c909780483d35e8/js/src/types/e2ee.ts).
- [Current-main preparation/decryption closure](https://github.com/nearai/inference-sdk/blob/9cc67f723614781f70c8e7475c909780483d35e8/js/src/core/e2ee-request.ts).
- [Official v3 protocol, including authenticated reply key/field labels](https://github.com/nearai/inference-proxy/blob/main/docs/e2ee.md).

Minimal upstream request: a reviewed, versioned public SDK API to export and restore the reply decryption state using the same SDK cryptography, persisted before dispatch and bound to the exact prepared request and reply public key. This should not replace fresh per-request keys with a global static key. The application must then reproduce plaintext from the persisted original signed ciphertext, reject wrong request/key/model/signer/nonce/plaintext, and revalidate the original gateway/model evidence with independently valid collateral and the approved TCB/freshness policy. These API names/requirements are a proposal, not a claim that such exports exist today.

A supported state export also needs an explicit protected key-storage design; putting a private key into a JSON string to bypass the journal's raw-credential validation is not an acceptable storage interface. The current implementation stores no reply private key.

Security decision for this demo: keep the existing strict E2EE route and accepted business output held. An authorized component call may demonstrate ciphertext/process signature evidence only, while clearly retaining unavailable durable plaintext proof and pending cost. A different security route would need a separate explicit decision and complete evidence implementation; no TLS/plaintext fallback or stored-proof shortcut is selected. Offline replay here checks wire signatures only; it does not claim SDK quote/collateral verification was replayed.

## Concrete one-request preparation, no paid execution

Candidate for the coordinator's exact one-shot **wire-only component** review, not a commercial default or authorization:

```json
{"model":"Qwen/Qwen3.8-27B","messages":[{"role":"user","content":"Reply with exactly NEAR E2EE component check. Do not call tools."}],"max_completion_tokens":32,"n":1,"stream":false}
```

The model is the actual free-preflight candidate, not an inferred approved commercial selection. No search, tools or other billable service is requested. The exact minified body above is 182 UTF-8 bytes, SHA256 `b0a03d084c7111cf3499106f2aa63989e6d997e7f102bc7f11505589e25a7ad2` (no trailing newline); this is not an input-token count. This is the plaintext pre-encryption body; randomized SDK encryption creates a different prepared wire hash, which must be captured and bound at the final gate. The coordinator changed shared `encodeGenerationRequest` to `max_completion_tokens`; the legacy HTTP client now matches. High-level `requestFingerprint` semantics remain unchanged; a wire hash from a legacy body cannot be reused for the new body.

[Current Chat API documentation](https://docs.near.ai/api-reference/chat/create-chat-completion) specifies that `max_completion_tokens` includes reasoning and supersedes legacy `max_tokens`. The new actual-SDK preparation assertion checks both input and encrypted body for this field, no legacy field, `n:1`, `stream:false`, and the exact prepared-byte hash. A request token parameter is not alone an attributable credit or total billing proof.

Required before any one paid request: coordinator-selected real model/account/credit scope and protected inference key; fresh attributable available-credit evidence; provider-specific input-token bound for the exact serialized messages/schema and reasoning-inclusive output bound; current model price facts and their validity; M01's exact max charge/daily/global reservation plan; exact one-call authorization ID/window/request fingerprint/verification policy; current permit/kill/fence gates. M01 alone computes the monetary limit from these facts, and all workers share the user's **USD5 actual + pending** maximum. No invented per-call or per-worker spending allowance is supplied here.

Billing must bind the original provider completion/inference IDs, account/organization/key/credit scope and provider watermark to trusted cost evidence. Missing/delayed/zero/unattributable rows retain the original pending reservation. A local timestamp is not a provider watermark. [Usage reporting](https://docs.near.ai/cloud/guides/usage-reporting) uses separate organization-scoped reporting credentials; an inference key does not imply that access. [Model pricing](https://docs.near.ai/api-reference/models/list-models-with-pricing) is an observation, not spending permission or an independently established request bound. No reporting token/account was created and no key was requested or printed by S2.

## Checks and scope limits

Supported Node command, after the shared encoder and legacy payload update:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH /Users/jys/.hermes/node/bin/node --test test/near-e2e-inference/*.test.mjs test/integrations-adapters/*.test.mjs
```

**60 passed, 0 failed, 0 skipped**, log `/tmp/near1-s2-owned-tests.log`. Syntax checks passed for all five current `src/inference/*.mjs` files, components, the new inference test and the authorized HTTP test: **8 files**.

Regressions include actual installed SDK API/encrypted request shape; unchanged global RNG and no constructor I/O; rejection of all old shortcut options; strict M01 refusing process-only output as business commands; original signed-byte/whitespace mutation; nonce/signer/model/policy rejection; forged plaintext/key/proof fields remaining unavailable; actual journal close/reopen at crash points before response, before signature and before bundle; pending cost/unknown output/no resend; owner and current-policy checks on component recovery. Final dispatch remains synchronous and single-use.

The tests use real SDK encryption and Ed25519 wire-signature verification. Network, signer identity, attestation/TCB facts and response decryption are explicitly synthetic test ports, never real TEE evidence. The obsolete custom-decryption tests were replaced with fail-closed regressions. Historical full-suite failure in the prior run concerned autonomy kill/recovery outside S2; the coordinator owns current full integration/browser/demo checks. S2 did not rerun that full suite or claim it fixed.

Remaining blockers: no supported durable E2EE state API; no implemented independent collateral replay for accepted recovery; no exact paid authority/key/account/credit/billing facts. No accepted business-output or live paid demo completion is claimed.
