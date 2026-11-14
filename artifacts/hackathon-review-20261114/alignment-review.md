# Loops House rubric review —14 November2026

Fresh evaluator prompts were fetched with authenticated Loops CLI0.6.0 for the existing Autonomous Business, NEAR Protocol and Privacy & Private AI scopes. Loops returns qualitative prompts, **not numeric judge scores**. This is a private repository assessment. The separate `score-estimates.json` contains unofficial numerical estimates requested by the user, with approximately±5-point uncertainty. Neither report predicts placement or awards.

`loops project get --event near-hackathon --json` returned `exists:false`. No project, submission, remote artifact or public sale was created/updated. Evaluator commands are free; no knowledge-graph credits, paid inference or transaction fees were used. Existing facts were checked in source. A fresh public mainnet account read still returned `UNKNOWN_ACCOUNT` for the generated deployment wallet. Forty-two local care/ledger checks were rerun and passed; the existing complete512-test run and eight actual local Sandbox checks were read, not represented as fresh public-network execution.

## Autonomous Business

### Alignment summary

The code implements a substantial local company operating system with policy-bound work, knowledge, recovery, versioned improvement mechanics and a usable fictional customer-care service. It does not yet demonstrate the track's real earn → spend → deliver → share/refund business loop. It remains the closest of the selected track scopes to the product's intended purpose.

### Verified strengths

- Real internal work is separate from customer orders and component proofs. It freezes scoped request/context, prepares the official SDK path, uses Treasury permits and fences work at dispatch and command admission. See [app composition](../../src/app.mjs), [internal work](../../src/workflow/internal.mjs) and [autonomy Rules](../../src/rules/autonomy.mjs).
- Backlog deduplication, fixed same-case template evaluation, revision/head checks, recovery and future context consumption are implemented. The full loop is tested with controlled SDK/proof/credit/billing inputs, not live model judgment. See [fixed evaluator](../../src/autonomy/evaluation.mjs), [context resolver](../../src/autonomy/context.mjs), [pipeline test](../../test/autonomy/pipeline.test.mjs).
- Customer-care profiles, actual native JBrain policy revisions, exact source citations, private conversations and owner tickets work together. This is real model-free lookup; it is not paid autonomous inference. See [domain](../../src/support/index.mjs), [policy](../../src/rules/support.mjs), [HTTP checks](../../test/customer-care-app/http.test.mjs), [browser proof](../customer-care/browser-proof.json).
- Shared actual-plus-pending lifetime cap, nonadditive balance snapshots, exact reserve accounting and unknown-effect recovery are substantive safeguards. See [ceiling](../../src/rules/ceiling.mjs), [Treasury](../../src/treasury/index.mjs), [observations](../../src/treasury/observations.mjs).

### Gaps and risks

- Live accepted agent output remains held by the supported durable original-plaintext/proof requirement and other authority/credit/bound prerequisites. Positive full-loop tests inject findings; they are not actual Cloud completions. See [verification response/recovery](../../src/inference/verification.mjs), [pipeline fixture](../../test/autonomy/pipeline.test.mjs).
- Signed1Click quote verification does not authenticate mutable settlement/finality. Service refunds remain provider estimates without an executable custody proof. See [payments](../../src/payments/index.mjs), [settlement](../../src/payments/settlement.mjs), [refund route](../../src/payments/refund-route.mjs).
- Cloud cash-to-credit purchase is unsupported. Supplier task output records do not grant reusable skill/persona licences. See [funding](../../src/cloud-funding/index.mjs), [entitlement](../../src/procurement/entitlement.mjs).
- The actual Rust ledger is an audit application, not an Agent API permissioning replacement. It earns implementation credit, but it is only locally deployed in Sandbox; mainnet `publish` always holds pending native-fee/common-Treasury/final-signing work. See [contract](../../contracts/company-ledger/src/lib.rs), [on-chain Rules](../../src/rules/onchain-ledger.mjs).

### Per-criterion assessment

| Criterion | Weight | Assessment and improvement |
| --- | --- | --- |
| NEAR Tech Usage |35%| Official SDK/signature/proof clients and real Rust contract are stronger. Finish critical-path Cloud, payment and scoped Agent API execution; do not count disabled ports as completed integrations. |
| Real, Not Simulated |25%| Actual free attestation and native local services exist. Sandbox is not testnet/mainnet, and controlled bills/credit are not real economic evidence. Prove one bounded real business path. |
| Track Fit |20%| Company-for-none, treasury, procurement requests and service model fit well. Make the economic business operate, rather than relying on written intent. |
| Execution & Completeness |20%| Strong local persistence, privacy, recovery and browser behavior. Major core live paths still cannot finish; test volume does not erase that gap. |

### Bounty fit

All three placement bounties share the technical track brief. Requirements are **partially met**; there is no defensible placement prediction. The smallest meaningful closure is a supported bounded real payment/inference/delivery/accounting loop with payout or a correct refund, using current scoped authority and original-operation recovery. A model-free customer-care demo alone does not close it.

### Top three next steps

1. Resolve one supported accepted-output and cost/credit route, then demonstrate one exact bounded real model result and actual correlated bill. Keep strict verification; do not fabricate or silently weaken it.
2. Complete the native fee/reservation/signing protocol, obtain the approved Agent API identity/policy/grant, then deploy and anchor a real ledger batch under the exact owner-approved scope. This helps chain evidence, but is not a substitute for commerce.
3. Prepare a reviewable public code snapshot and a demo of the actual paths, then complete the Loops project fields and submit only after owner approval.

## NEAR Protocol / Grand Prize

### Alignment summary

The project now has deeper NEAR-specific source than the previous review: official encrypted inference preparation and attestation checks, signed quote verification, Agent API proof/native-call ports and a compiled audit contract with real local-chain tests. No funded public-chain business execution has been demonstrated, and the audit publisher is not executable from current Rules.

### Verified strengths

- The business inference adapter uses the official SDK prepared E2EE transport, rather than merely claiming an OpenAI-compatible request. See [adapter](../../src/inference/index.mjs).
- Actual SDK nonce/TCB preflight is evidenced without a completion. See [public attestation evidence](../near-public-attestation-20261113.json) and [verification call site](../../src/inference/verification.mjs).
- The Rust contract enforces writer, company, contiguous hashes and exact replay. Eight checks execute compiled WASM on actual local NEAR Sandbox. See [contract](../../contracts/company-ledger/src/lib.rs), [test runner](../../scripts/test-ledger-contract.mjs), [proof](../onchain-ledger/sandbox-proof.json).
- Policy-versioned work/recovery and fixed-evaluated upgrades add a concrete mechanism beyond a basic agent dashboard. Its controlled test scope remains explicit.

### Gaps and risks

The new wallet is only a generated keypair; actual mainnet RPC still reports no account. There is no mainnet contract, actual ledger batch, approved company Agent API grant, real settlement or accepted paid inference loop. A broad collection of gated clients is not equivalent to those integrations executing. Only README and an icon are tracked locally and no Git remote is configured; the substantial local implementation is not yet an inspectable public submission.

### Per-criterion assessment

| Criterion | Weight | Assessment and improvement |
| --- | --- | --- |
| NEAR Tech Usage |40%| Real official SDK and contract code improves depth. Connect the supported native Agent API route and complete the critical economic/proof path. |
| Real, Not Simulated |30%| Free public attestation counts as limited real API evidence; Sandbox/control fixtures do not prove public-network business execution. Produce bounded real receipts and outcomes. |
| Innovation & Ambition |15%| Fenced agent work, effective future revisions and controlled fixed-evaluator repair are substantive. Demonstrate the mechanism with accepted real reasoning. |
| Execution & Completeness |15%| Strong local engineering; live gates and missing submission materially limit completeness. Finish one supported path before adding breadth. |

### Bounty fit

Grand Prize requirements are **partial**. The title bounty is automatic consideration after a valid submission, not proof that this code satisfies it now. No project record currently exists, so submission eligibility is also incomplete.

### Top three next steps

1. Prioritize verifiable public-network/API critical-path execution over additional UI or documentation.
2. Keep the audit contract's actual role clear and use Agent API for scoped operational signing; complete the currently missing native fee protocol.
3. Make the reviewed code and real demonstration accessible to judges and create the approved project submission.

## Privacy & Private AI

### Alignment summary

This scope improves substantially because the official SDK now fetches fresh-nonce gateway/model attestation and explicitly verifies response signatures, with private exact-byte capture and strict unavailable states. The live customer-facing service still performs model-free document lookup, so confidential AI inference is not yet its demonstrated core service.

### Verified strengths

- Official SDK `verify(model)` and explicit `verifyResponse(id)` call sites exist; policy binds strict TCB, model/request and freshness. See [verification](../../src/inference/verification.mjs), [verification Rules](../../src/rules/verification.mjs).
- Actual free preflight verified gateway and model `UpToDate` with fresh nonces, without claiming a completion. This closes the earlier review's absence of attestation retrieval/verification.
- Credentials are excluded from evidence, captured bytes remain private, replay does not trust saved booleans, and supported crash recovery neither returns unproven plaintext nor resends. See [capture](../../src/inference/capture.mjs), [verification tests](../../test/integrations-adapters/cloud-verification.test.mjs).
- Current source grants/revisions are rechecked before customer disclosure, including safe redaction on transcript replay. This is access control, not itself confidential inference. See [support policy](../../src/rules/support.mjs).

### Gaps and risks

The current official SDK cannot export/import its E2EE reply state for the required durable original plaintext proof. Normalized `plaintextBindingStatus` and `durableReplayStatus` remain unavailable, and strict production admission holds. There is no accepted paid model response used by customer care. The old expense-auditor/no-retention idea is not implemented: this company intentionally persists approved knowledge, conversations and tickets. On-chain commitments reveal metadata and are not encryption or a truth proof; private content must not be published to improve a blockchain score.

### Per-criterion assessment

| Criterion | Weight | Assessment and improvement |
| --- | --- | --- |
| NEAR Tech Usage |35%| Fresh nonce/TCB and actual official SDK integration are materially better. Demonstrate an accepted confidential computation through a supported proof route. |
| Real, Not Simulated |25%| Actual attestation is real but no completion was sent. Produce one bounded real private inference and validate its original output/cost under the selected policy. |
| Track Fit |20%| Scoped sensitive company knowledge is relevant. The demonstrated application remains lookup; do not call persistent storage a no-retention auditor. |
| Execution & Completeness |20%| Strong capture, isolation, recovery and fail-closed behavior. The principal live AI feature remains unavailable. |

### Bounty fit

All three placement tiers are **partially met**. Fresh-nonce attestation now has actual evidence, but a real accepted private-AI computation is missing. Neither local source citations nor a Sandbox ledger replaces that requirement.

### Top three next steps

1. Resolve a supported original-output verification/recovery route or an explicitly reviewed different security route; never install an unsupported private-key/decryptor shortcut.
2. Run one narrowly scoped approved private inference with numerical token/cost bounds and actual credit/billing attribution.
3. Show exactly which checks passed and what data persists, and publish the inspected code/demo through an approved submission.

## What changed since the13November review

The prior numeric report assessed a codebase with217 tests and no attestation path. Current source adds official SDK attestation/prepared inference, recovery/proof capture, controlled full company work, actual native JBrain customer care, a real Rust ledger contract and stronger economic/receipt gates. These are code/evidence changes. Documentation cleanup and a generated wallet receive no independent “real execution” credit. The remaining missing earn/spend/deliver proof still dominates the weighted gap.
