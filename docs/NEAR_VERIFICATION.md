# NEAR verification integration

**14 November update:** the owner explicitly selected a separate encrypted **live-call verification** policy for the owner-funded [real AI demo](REAL_AI_DEMO.md). Two actual generated replies passed official SDK checks and actual billing. Offline plaintext recovery remains unavailable; the strict commercial default below is unchanged.

Current implementation:13 November2026. This is reversible component work under the reviewed real-execution plan. No funded live completion, settlement, payout, supplier purchase or autonomous Cloud funding was run. The reviewed plan and critique are unchanged.

## Installed implementations

The root package and lockfile pin `@nearai/inference-sdk@0.3.0`, `@defuse-protocol/one-click-sdk-typescript@0.1.26` and `@near-intents-agent-api/sdk@0.9.0`. Node24.22.1+ is now required. Current Node26.12.1 loads the official Cloud Node entry successfully. No custom signature or TDX cryptography replaces these SDKs.

- Cloud: `src/inference/verification.mjs` and `capture.mjs` implement actual SDK gateway/model preflight, E2EE preparation, immediate pinned completion dispatch, explicit response verification and private raw evidence capture. The isolated component and business adapter now both use official-SDK preparation. The workflow prepares the frozen request, persists preflight findings, and dispatches the single-use callback through existing M01/Treasury gates. Legacy HTTP completion is no longer the business dispatch path; the HTTP billing read remains separate. Durable plaintext/replay proof is still unavailable, so strict M01 delivery gates remain closed.
- Payments: `src/payments/signatures.mjs` verifies captured quote envelopes with the official SDK's pinned default manager key. Missing/invalid signatures block deposit instructions. Verification of a nested status quote does not authenticate mutable status/swapDetails or establish settlement time/finality. No production quote or deposit was requested for this revision.
- Agent API: `src/custody/proofs.mjs` verifies official operation-proof signatures/Merkle evidence, expected account/action/payload bindings and separately supplied TDX/finality evidence. Audit proof requires independently pinned witness/deployment trust. The adapter can invoke these trusted capture/replay ports. Even verified audit/recorded-transaction stages leave money movement unknown without independent account/asset/amount evidence. No operation hash alone becomes a transfer receipt.

## Read-only Cloud check

Set `NEAR_AI_API_KEY` privately in `.env`. Select a supported NEAR TEE model explicitly. The catalog observation for this revision returned64 models; catalog membership does not verify TEE execution or charge bounds.

```sh
npm run proof:cloud -- --describe --model Qwen/Qwen3.8-27B
npm run proof:cloud -- --preflight --model Qwen/Qwen3.8-27B
```

The displayed model is an observed catalog candidate for a read-only check, not an approved commercial model. The command uses a separate `.runtime/cloud-proof` journal. Use `--store` for another private directory. Stop any writer using that same journal first. `--describe` performs no provider request. `--preflight` requests gateway/model attestations; it sends no completion. Public gateway/model evidence does not require an inference key; private models and paid preparation do. The latest actual anonymous check returned:

```json
{"stage":"preflight","status":"verified","gatewayTcbStatus":"UpToDate","modelCount":1,"completionSent":false}
```

The owner UI at Settings uses POST `/api/workspace/inference/preflight` with an empty object. Model/policy come from the server and M01, not request JSON. Set `SHOP_COMPONENT_MODEL` for setup-only selection; attached policy can select the commercial model. The panel lists the result and checks without claiming that a report was verified. Private evidence remains in the journal. Public `/api/status` returns only M01's fresh, redacted capability projection.

## Paid component boundary

`--execute` is a separate opt-in. It requires an explicit valid live policy, a private0600 `SHOP_COMPONENT_AUTHORIZATION_FILE`, exact request hash, one call, model, credit scope, not-before/expiry, input/output/reasoning/time bounds and numerical request/daily caps. It also needs independently verified attributable credit and request-specific technical charge bounds. Owner JSON and a price catalog cannot establish those provider facts.

M01 returns the exact request/verification spec/action/reservation. The runner prepares encryption and durably records the exact wire bytes before monetary authorization. It then uses the existing Treasury protocol:decision at v → exact plan at v+1 → fresh dispatch validation → permit consumption at v+2 → immediate final Rules gate and pinned POST. There is no fake order, payment or active company requirement for this isolated component. Its scope is wire-proof only; it cannot publish a report or activate sales.

The original operation identity persists before dispatch. Unknown output/cost retains its reservation. Repeating `--execute` for that identity returns the recorded state; it never sends another completion. Inspect after restart or grant removal:

```sh
npm run proof:cloud -- --inspect component:YOUR_AUTHORIZATION_ID
npm run proof:cloud -- --replay private:YOUR_EVIDENCE_HASH --model YOUR_SELECTED_MODEL
```

Replay uses known private evidence and the current matching verification policy. It performs no completion. Actual cost bookkeeping needs an original trusted billing result with matching scope, provider reference and provider watermark. Missing/delayed/attribution-incomplete bills remain held. No local timestamp is invented as a provider watermark.

The current `--execute` result is `COMPONENT_AUTHORIZATION_REQUIRED`. No numerical funded limits or credentials were inferred from the user's approval to implement code.

## Hard SDK limitation

Official SDK0.3.0 keeps E2EE response decryption material in a private closure. Its public APIs do not export/import that key for durable plaintext recovery after a crash. This implementation captures exact ciphertext/signature/attestation bytes and can replay wire-signature checks with official public helpers. It cannot claim independently replayable plaintext/report binding from saved JSON or a saved success flag. Offline attestation replay also needs independently revalidated collateral; the wrapper reports unavailable when that is absent. Some SDK collateral work is not cancellable, though wrapper/provider reads are bounded.

M01 requires UpToDate by default, fresh nonce bindings, gateway/model evidence, provider_tee response signature, prepared-byte binding and independently verified plaintext/replay for business report acceptance/delivery. Those last two requirements remain unavailable with the selected route. Full G6 stays open. A non-E2EE TLS/model-signature alternative was researched only; it is not selected as a silent fallback. Any change needs an explicit route/security decision and its own complete evidence checks.

## Evidence and remaining work

Current local suite:256 passed,0 failed,0 skipped; syntax74 JavaScript files. Logs:`artifacts/near-integration-sdk-tests.log` and `artifacts/near-integration-sdk-check.log`. Native JBrain tests remain included and pass. Provider cryptographic tests use actual installed SDK functions with explicitly synthetic signed fixtures; TDX/finality test ports are controlled. They are not live vendor execution evidence.

Browser owner login → actual missing-key preflight → unavailable panel passes desktop1440/mobile390. No page exceptions or overflow in settings/marketplace/setup infra. Public status has no raw identity/private refs. Evidence:`artifacts/near-sdk-browser-proof.json` and `artifacts/near-sdk-*.png`. T3 initial navigation worked, then snapshots timed out twice; installed Playwright fallback kept the owner token out of tool output.

Actual free public reads:Cloud `/v1/models`200/64 records, response SHA256`a95e1981f3e0ebfed90a4efe57e1fee218acf28f7f2f80469abb8eb898a61f25`; Agent API `/tee/info`200, SHA256`dd886ebfc09705dcb45af4e89484259168b33843d8948c5b442ffdde4dedaaf3`. Private raw observations are under `.runtime/provider-evidence`. These establish reachability only. Their hashes are not automatically approved deployment pins. No Docker verifier was launched.

Still required:actual Cloud credentials/read-only attestation result; request-specific technical bounds and attributable credit; an approved paid proof scope/limits; durable plaintext verification; spendable Intents route and signed/final settlement; executable pre-deposit refund principal+fees/domain; independent money movement verification; autonomous Cloud acquisition and a real supplier entitlement. No public launch/submission is performed by these changes.

## Latest focused improvement pass

See `docs/NEAR_INTEGRATION_IMPROVEMENTS.md` and `artifacts/near-public-attestation-20261113.json`. Public preflight is bounded by M01 to30seconds; the actual result verifies gateway/model evidence only. Business dispatch now consumes official-SDK prepared callbacks rather than the legacy HTTP completion client. Full G6 and paid business acceptance remain open. The earlier256-test/full-browser evidence above is historical to that SDK milestone; this pass ran focused checks rather than another overall acceptance suite.
