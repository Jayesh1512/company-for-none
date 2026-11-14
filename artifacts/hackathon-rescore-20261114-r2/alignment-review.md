# Fresh Loops House alignment review — 14 November 2026

This review executes the three freshly downloaded Loops House evaluator prompts against this repository. The platform returns qualitative evaluator instructions, not a numeric judge assessment. Separate, explicitly unofficial estimates requested by the builder are in [score-estimates.json](score-estimates.json). No submission was created or updated.

## Assessment boundary

The [project lookup](project-status.json) reports `exists:false`. CLI0.6.0 authentication succeeded. The [source comparison](source-comparison.json) independently matches all264 files in the completed mentor implementation manifest, aggregate `1bc3e202a2f5b4e221f379f7bced724e5cde7e8873accb080dc961bac6befd3b`. The concurrent demo-UX diagnosis is outside this assessment; no credit is assigned to work in flight.

Fresh `npm run test:mentor` passes44/44 with zero failures/skips; [log](focused-validation.log). The earlier544 full tests,12 native JBrain checks,151 syntax checks and5 actual local Sandbox fee checks were inspected in the [completed implementation evidence](../mentor-implementation/), not rerun for this review. Controlled HTTP responses, injected proof producers and Sandbox funds are not live provider or mainnet evidence.

## Alignment summary

**Autonomous Business remains the strongest fit.** The project now has a more complete conditional native-ledger execution/accounting path, exact owner-signing clients, OutLayer evaluator plumbing and PingPay request/recovery components. Real public attestation and a production-root signed dry quote improve credibility. The essential funded business chain—accepted private reasoning, supplier acquisition, independently proved customer settlement, delivery and payout—still has not executed.

**NEAR Grand Prize alignment improves through implementation depth**, particularly shared native/USD reservations and actual receipt-fee verification. It remains limited by the absence of a public deployed contract or funded core path.

**Privacy & Private AI remains partial.** Actual fresh-nonce Cloud attestation is established. New payment/native integrations do not solve the existing accepted-output/durable plaintext gate and should not receive private-AI credit merely for increasing module count.

## Verified strengths

- The app actually composes the integrations and private facts into Rules and web routes: [app.mjs](../../src/app.mjs), [web/index.mjs](../../src/web/index.mjs). These are wired conditional components, rather than README-only claims.
- Native ledger publication uses an original durable submission, M03 reservation and writer dispatch; fee reconciliation checks actual final RPC data and records an exact operational cost: [onchain/index.mjs](../../src/onchain/index.mjs), [fees.mjs](../../src/onchain/fees.mjs), [onchain-ledger Rules](../../src/rules/onchain-ledger.mjs). The actual [Sandbox fee checks](../mentor-implementation/sandbox-native-fees.log) include billed failures and exact call binding. They are local chain execution, not mainnet deployment.
- Optional integration policy, exact one-shot authorization, current kill, request identity, resource attribution and shared lifetime exposure are enforced centrally: [integrations Rules](../../src/rules/integrations.mjs), [ceiling Rules](../../src/rules/ceiling.mjs). No owner JSON supplies cryptographic proof or creates a spendable credit lot.
- OutLayer and PingPay have fixed-origin request codecs, bounded reads, original operation handling and explicit unknown/proof gates: [OutLayer](../../src/integrations/outlayer.mjs), [PingPay](../../src/integrations/pingpay.mjs), [integration orchestration](../../src/integrations/index.mjs). The fixed Rust evaluator is implemented at [contracts/template-evaluator](../../contracts/template-evaluator/); native/WASI compilation is not remote verified execution.
- Owner intent generation/submission preserves exact provider-selected signature formats: [owner-signing.mjs](../../src/integrations/owner-signing.mjs). Unsigned account/key/feed preparation is explicit: [accounts.mjs](../../src/integrations/accounts.mjs). These do not mean a NEAR wallet or public feed is connected.
- The [actual live evidence](../../docs/LIVE_EVIDENCE.md) includes a1Click dry quote verified using the official SDK's unchanged production root. [Offline verification](../live-evidence/2026-11-14-readonly-r1/offline-verification.json) repeats signature checking after journal reopen and rejects an explicitly synthetic altered signed amount even after recomputing its wire checksum. No swap or settlement occurred.
- Actual Cloud SDK verification uses fresh gateway/model nonces, strict TCB policy and attested gateway TLS. The source refuses unsupported durable-key shortcuts: [verification.mjs](../../src/inference/verification.mjs). Its saved [live summary](../live-evidence/2026-11-14-readonly-r1/cloud-attestation-summary.json) records deployment provenance `not_checked` and no completion.
- The private company/customer-care path is functional with native JBrain, exact source grants/revisions, cited model-free answers and persistent tickets: [support domain](../../src/support/index.mjs), [support Rules](../../src/rules/support.mjs), [customer-care documentation](../../docs/CUSTOMER_CARE.md). Its fictional policies and model-free lookup are clearly separated from paid AI reasoning.

## Gaps and risks

1. **The production native signing/fee-envelope producer is absent.** `getLedgerFeeBound` and `getLedgerSigningEnvelope` are private optional composition ports. Rules correctly holds without independently established facts. Implementing reservation/dispatch/recovery is a meaningful improvement; it is not a live-ready deployment route. See [app.mjs](../../src/app.mjs), [Rules gate](../../src/rules/onchain-ledger.mjs) and [current handoff](../../handoffs/mentor-implementation.md).
2. **Actual accepted private output remains blocked.** SDK0.3.0 exposes only process-local response decryption. Production normalized findings keep durable plaintext/replay unavailable; Rules requires both before command/report acceptance. See [verification source](../../src/inference/verification.mjs), [Rules output gate](../../src/rules/verification.mjs), [internal workflow](../../src/workflow/internal.mjs). A configured key alone does not close this engineering gap.
3. **No funded business lifecycle is proved.** A signed dry quote authenticates selected quote fields, not mutable status, movement, settlement time, service refund or payout. See [payment settlement](../../src/payments/settlement.mjs), [custody movement](../../src/custody/movement.mjs), and the saved [dry quote](../live-evidence/2026-11-14-readonly-r1/intents-dry-quote-summary.json).
4. **OutLayer and PingPay remain conditional components.** Product OutLayer proof acquisition/verifier is absent. PingPay lacks the public seller, actual resource/delivery/allocation and independently verified settlement/refund binding. Do not score either as a completed public business feature. [Current dispositions](../../docs/MENTOR_IMPLEMENTATION.md) and the actual clients above agree.
5. **Account/key/feed plans are unsigned.** Connected NEAR-wallet selection and near.social publication are not implemented. Existing Agent API operational route must not silently become direct-wallet signing. See [accounts](../../src/integrations/accounts.mjs), [owner signing](../../src/integrations/owner-signing.mjs), [current ledger guide](../../docs/NEAR_ONCHAIN_LEDGER.md).
6. **Discovery is not acquisition.** Autonomous Cloud cash purchase remains unsupported; balance observations are unwatermarked/nonadditive; marketplace task delivery is not a reusable skill/persona licence. See [Cloud funding](../../src/cloud-funding/index.mjs), [credit facts](../../src/cloud-funding/credit.mjs), [procurement](../../src/procurement/index.mjs).
7. **Submission/reproducibility remains unfinished.** Loops has no project record. No Git remote is configured in this checkout, and `git ls-files` shows only README and the icon. Local untracked code is real working evidence, but is not an accessible public submission. Publication still needs the builder's explicit approved destination/content.

## Per-criterion assessments

### Autonomous Business

- **NEAR Tech Usage (35%):** stronger conditional Agent API/native Treasury/fee implementation and real production quote verification; close one correctly authorized critical path before adding more integrations.
- **Real, Not Simulated (25%):** real public TEE/quote checks and actual local nearcore fees; no accepted paid AI, public deployed ledger or funded commerce. This remains the largest deduction.
- **Track Fit (20%):** strong company-for-none purpose, manager/backlog/developer roles, treasury and marketplace design. Functional local customer care is concrete; autonomous commercial operations remain partial.
- **Execution & Completeness (20%):** strong recovery, isolation, policy and test coverage; default setup correctly holds unavailable production capabilities. Current draft-only Demo UX is being diagnosed separately and receives no future-work credit here.

### NEAR Grand Prize

- **NEAR Tech Usage (40%):** broader wired ecosystem components plus exact native-account/receipt accounting, with several production verification producers still missing.
- **Real, Not Simulated (30%):** stronger actual signed provider data and local-chain receipts; funded/public critical-path execution remains absent.
- **Innovation & Ambition (15%):** scoped agentic company and causal repair/context updates are substantial; extra protocol clients alone do not add originality.
- **Execution & Completeness (15%):** mature local safety/recovery and usable cited customer care; live delivery and public reproduction/submission remain incomplete.

### Privacy & Private AI

- **NEAR Tech Usage (35%):** genuine fresh-nonce official-SDK TEE verification; new payment clients do not increase private-inference depth.
- **Real, Not Simulated (25%):** actual attestation is established; no actual accepted private completion or replayable original plaintext proof. No new credit for simply repeating preflight.
- **Track Fit (20%):** private company knowledge and controlled disclosure matter, but local policy lookup is not a private AI workload.
- **Execution & Completeness (20%):** stronger shared execution/accounting boundaries; the actual private inference outcome remains incomplete.

## Bounty fit

Autonomous Business1st/2nd/3rd, Privacy & Private AI1st/2nd/3rd and the NEAR Grand Prize have **partial technical alignment**, not satisfied end-to-end execution. Rank cannot be inferred. The same missing accepted live critical path affects each placement; placement is decided by human judges, not this review. No entry exists on Loops and no registration/submission write was attempted.

## Top three next steps

1. Resolve the explicit supported security/output route and actual scoped credit/cost facts, then demonstrate one bounded real customer-care/agent result with correlated actual billing. Do not weaken proof to earn a demo checkmark.
2. Implement and verify the production exact native fee/signing-envelope producer, obtain the selected Agent API scope and fund accounts, then deploy/initialize and anchor one real safe batch. Preserve shared reservations and unknown/no-resend recovery. More unsigned plans do not substitute for this proof.
3. Make the tested source and a truthful customer/owner demo reproducible for judges, then review a concrete public repository/demo/submission draft with the builder. Adding PingPay/OutLayer breadth should follow one proved critical path, not precede it.

No new credentialed/provider calls, readiness probes, paid inference, transaction, account/grant creation, route change or allowance increase occurred during this review. Only free Loops rubric/project reads, local source/evidence inspection and44 isolated focused tests ran.
