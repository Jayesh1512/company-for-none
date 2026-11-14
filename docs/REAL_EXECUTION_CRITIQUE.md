# Real execution plan — independent critique

Date: 13 November 2026. First formal review, by the existing project critique thread. Reviewed **revision 1 including its frozen source additions**, all 162 lines of `docs/REAL_EXECUTION_PLAN.md`.

Reviewed plan SHA-256: `e25de90d9069bfa649d3f9493550373c18fb7ca9bca7172790de3513943b6e21`.

## Verdict

**Implementation plan: ready with conditions for reversible R0/R1 work; revise the critical/high gates below before treating the whole sequence as executable. Funded-execution product: not ready.** There is a credible local implementation and useful contract/recovery testing. There is no established funded payment/inference/payout loop, independently reconciled capital/credit, verified execution proof, or autonomous Cloud purchase. No amount of local test success closes those gates.

The plan preserves the important strengths: one organization workspace and serialized service runner; M01 as sole business-rule/config authority; M03 as sole money-record owner; frozen commercial terms; disjoint refund/contributor reserves; protected company knowledge; durable original-operation recovery; and explicit failure rather than a simulated production fallback. It correctly distinguishes written guidance from tools, prepaid inference from autonomous purchasing, and supplier payment from delivery. These are strengths to retain, not reasons to approve unverified integrations.

The main planning weakness is that several exit gates describe desired properties without specifying the evidence transitions and failure decisions that establish them. The largest delivery risk is treating every part of R0–R5 as one hackathon commitment while the critical provider route and funding capability remain unresolved.

## Review basis and limits

I inspected current composition, Rules/setup/business decisions, workspace/service publication, knowledge capture/grants, payment and inference clients, Agent API custody, Treasury, workflow/recovery, startup, and the new business tests. Runtime changed during this review; I reread the confidential-bucket and payment-auth changes before writing this report. The final reported baseline is **164 tests, 57 syntax checks, and seven focused business tests passing**. I read test implementations and logs but did not independently rerun that final suite. An in-memory Rules diagnostic independently reproduced setup mutations requiring live authorization before any spending was requested. It performed no I/O or provider effects.

The new `test/business/operation.test.mjs` is meaningful: actual clients use local HTTP, payment is observed, Cloud output/billing is correlated, and an original pending payout reconciles after restart without another transfer. These tests exist and deserve credit. Their supplied provider responses, money/credit assertions, evidence and generated report remain controlled. They do not prove the deployed schemas, real custody/balance domains, proof roots, vendor idempotency or actual charges.

Primary documentation was read on the review date. Conflicting pages are recorded as uncertainties, not as proof of an actual failed vendor request. No accounts, grants, funds, paid calls, dependencies, submissions or runtime changes were made by this review. Only this new critique file was written.

## Prioritized findings

Severity describes the consequence if the gate is bypassed. **Critical** blocks accepting money or claiming the full live product. **High** requires a concrete plan correction before its affected implementation/effect. **Medium** is a bounded readiness improvement. Findings marked “recognized” are current blockers the plan already acknowledges; the required change is to make their closure testable, not to rediscover them.

### RE-01 — Critical: freeze a spendable balance route, not matching configuration labels

**Plan:** vendor constraints lines 32–36; R0 lines 74–80; R3 lines 112–120. **Current files:** `src/custody/agent-api.mjs:7`, `src/app.mjs:76`, `src/rules/business.mjs:40`, `src/payments/index.mjs:119`.

**Confirmed state / unsupported assumption:** The latest correction is valuable: custody requires an explicit confidential bucket, sends `confidential:true`, reads confidential balances, and Rules requires `CONFIDENTIAL_INTENTS` settlement. This removes the earlier implicit public route. It establishes configured intent, not provider compatibility or usable control. The [current Agent API overview](https://docs.agentsonintents.com/integration/agent-api/overview) describes private balances as the default and legacy public balances as drain-only. The [current 1Click quote contract](https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote) explicitly supports Confidential Intents output by signed transfer intent. Older quickstart examples differ.

**Failure and impact:** Checkout credits an account/bucket that the granted wallet cannot spend, or a public-transaction finality check rejects valid confidential settlement. The shop takes payment but cannot deliver its promised automatic payout/refund.

**Smallest correction:** Keep this recognized issue as an R0 hard stop. Freeze a route record binding deployed API/SDK version or dated schema evidence, actual agent/account identity, balance bucket, origin deposit type, settlement recipient type, exact token, transfer/withdraw action and recipient domain. Include provider policy `APPLIED`/synchronization, grant scope and supported receipt fields. R3 may implement only this selected route; do not build a generic multi-route platform.

**Verification / exit:** Before a sale, read the actual identity/policy/grant/balance facts and reject mismatches/stale observations. Under separately approved tiny funding, correlate one real receipt to the credited spendable bucket and a subsequent exact authorized transfer. A configured flag or stand-in response cannot close this gate. If the route cannot be established, checkout remains disabled.

### RE-02 — High: define the setup/authorization bootstrap as an explicit action table

**Plan:** R0 lines 75–80; R2 line 97. **Current files:** `src/rules/index.mjs:15`, `src/rules/index.mjs:87`, `src/rules/setup.mjs:10`, `src/workspace/index.mjs:14`, `src/knowledge/index.mjs:11`, `src/rules/knowledge.mjs:8`.

**Confirmed state / unsupported assumption:** The plan recognizes the bootstrap problem, but does not enumerate the permissions that remove it. Currently live `agent_manage` and organization mutations require a live authorization; knowledge internals still manufacture `verifiedLocal` owner context. Infrastructure review and connected cards largely derive from adapter mode. Remote ACTIVE/account preflight is a useful improvement, but is not a full grant, policy, model or credit readiness check.

**Failure and impact:** An owner cannot finish real setup until given a spending authorization, or the implementation “fixes” setup by broadly bypassing Rules. Meanwhile a mode-only connected badge encourages activation with unusable credentials.

**Smallest correction:** Add a M01 action table: authenticated owner metadata/import/setup operations; non-spending read-only probes; publication/activation; new paid effects; reconciliation; emergency stop. Setup needs authenticated ownership, not a funded spend permit. Activation needs current factual prerequisites and the required execution authorization. Pass server-verified owner identity into knowledge decisions instead of treating loopback or a module-created flag as proof. Keep zero-budget setup useful without weakening effect gates.

**Verification / exit:** Fresh real-mode store, valid owner authentication, no spend authorization: create organization/agent, import/review knowledge, inspect missing prerequisites; **zero external paid effects**. Anonymous callers fail. Probe missing/revoked grants, wrong account, unreachable JBrain, unsupported model and expired facts; each must prevent the relevant ready state. Refresh/policy/grant changes invalidate readiness and affected permits.

### RE-03 — High: a verified balance snapshot must not become an additive deposit or credit lot

**Plan:** R0 line 77; R3 line 116; R5 lines 138–142. **Current files:** `src/app.mjs:48`, `src/rules/business.mjs:51`, `src/treasury/index.mjs:69`, `src/treasury/index.mjs:73`.

**Unsupported assumption:** Replacing an owner assertion with a provider response is sufficient. Current capital/credit paths add amounts to cash/credit state. Their identity protection prevents replay of one reference; it does not prevent adding two different observations of the same underlying balance. A provider snapshot is an absolute observation, not a fresh purchase/deposit.

**Failure and impact:** The same 10 units are observed twice under fresh IDs and recorded as 20; an opening balance already containing a sale is followed by a separate credit for that sale; or another application consumes shared Cloud credit. Internal solvency/reserve checks pass against overstated assets.

**Smallest correction:** Specify opening balances, transaction receipts and absolute balance observations as distinct facts. Bind them to account/organization/key, asset/bucket and observation watermark. Reconcile snapshots against posted movements and unresolved effects; never automatically mint a deposit, lot or balancing adjustment from a difference. Choose a dedicated credit allocation/account where possible; otherwise account for external consumption and hold on unexplained deficits. Include actual/provisional fees and platform services in the reconciliation and reserve model.

**Verification / exit:** Reobserve identical and changing balances under fresh observation IDs, overlap opening capital with a sale, repeat after restart, consume credit externally, and delay billing. No observation replenishes previously spent credit. Unexplained deficits prevent new spending. M03 records only exact M01-approved reconciliation plans; no second money owner is introduced.

### RE-04 — High: checkout must retain and validate the signed quote and route-specific settlement evidence

**Plan:** R0 line 74; R3 lines 114–116. **Current files:** `src/payments/http.mjs:2`, `src/payments/index.mjs:73`, `src/payments/index.mjs:91`, `src/payments/index.mjs:125`, `test/business/operation.test.mjs:85`.

**Confirmed state / unsupported assumption:** Payment secret injection and explicit auth-scheme selection now exist; do not report them missing. Current references disagree about Bearer versus `X-API-Key`, so neither should be asserted universally correct. The normalized quote still omits the full signed provider envelope. Settlement treats a nonempty destination-transaction array as finality and uses status `updatedAt` as the payment time. Echoed fields and a fabricated hash in a stand-in do not establish those meanings. The [quote/signature contract](https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature) provides an authenticity check; the [status contract](https://docs.near-intents.org/api-reference/oneclick/check-swap-execution-status) exposes several kinds of settlement evidence.

**Failure and impact:** A route validly settling by intent is held forever; an unrelated/empty hash object is accepted; or a status refresh makes a timely payment appear late. Losing the signed envelope also prevents verification and useful dispute diagnosis.

**Smallest correction:** Freeze and test the actual deployed authentication contract. Persist the exact signed quote/status envelope and verified signer result privately. Normalize route-specific settlement identity, output, fees, finality and timestamp provenance; do not require an irrelevant destination-chain withdrawal. Separate invoice deadline, deposit observation, settlement time and later status-update time. Define treatment of extra/partial/late deposits and provider refunds independently from a service refund.

**Verification / exit:** Use dated primary-schema examples, then sanitized actual responses from the approved route. Reject mutated signed fields, wrong bucket/recipient/asset/memo/invoice, empty or unrelated evidence, and replay. A later status read must not alone convert a timely payment into a late one. No funded compatibility claim before a real component proof.

### RE-05 — Critical: chain equality does not establish a usable refund, and principal alone does not cover liability

**Plan:** R0 line 78; R3 lines 115–120. **Current files:** `src/rules/policies.mjs:263`, `src/workflow/index.mjs:256`, `src/custody/agent-api.mjs:18`, `src/treasury/index.mjs:108`.

**Unsupported assumption:** A same-network customer address can be repaid by the existing transfer method. Currently cross-chain refunds hold, but a same-chain refund still calls custody transfer. A native NEAR account, public Intents account and Confidential Intents account are distinct receiving domains even if their strings or chain labels match. An origin-chain swap refund and a later rejected-service refund are different obligations. The [Agent API execution guide](https://docs.agentsonintents.com/integration/agent-api/quickstart/execute-actions) distinguishes internal transfer from chain withdrawal.

**Failure and impact:** A NEAR payer expects native-chain tokens but receives an inaccessible internal credit, or the shop holds the full settlement principal yet lacks separately spendable withdrawal/gas fees. The sale was accepted with a remedy the shop cannot fulfil.

**Smallest correction:** Freeze refund destination domain, action, asset, amount rule, address/memo, route, allowlist/grant permission and fee payer in the offer. Prove the recipient can receive that route. Check and reserve refund principal **plus worst-case remedy fees**, separately from contributor obligations and inference/procurement working capital, before issuing a deposit quote. Restrict first sales to one proven remedy route. Specify the authorization needed to finish existing refunds after new-sale authority expires; do not grant it implicitly.

**Verification / exit:** Reject unsupported routes before deposit instructions exist. Test same-chain/wrong-domain addresses, a second input token, partial/late payment, billed report failure, fee spikes and expired/revoked destination permissions. Execute one separately authorized actual service refund to the promised destination domain. A failed or unknown refund remains an outstanding liability, never a completed order.

### RE-06 — High: proof verification needs a durable byte-level record and a fixed policy before paid inference

**Plan:** source additions lines 38–44; R2 lines 100–106; R5 lines 139–142. **Current files:** `src/inference/http.mjs:3`, `src/inference/http.mjs:12`, `src/inference/index.mjs:30`, `src/runtime/providers.mjs:18`, `src/rules/index.mjs:24`.

**Unsupported assumption:** A verifier can be added after the existing JSON client. That client discards raw response bytes through `response.json()` and has no durable preflight/byte record. The [Cloud signature guide](https://docs.near.ai/cloud/verification/cloud-api/response-signatures) requires exact request/response bytes and matching preflight identities. The [verification policy](https://docs.near.ai/cloud/verification/reference/verification-policy) requires explicit acceptance and fail-closed handling. Parsed JSON reserialization cannot substitute for those bytes.

**Failure and impact:** Paid output arrives, the process crashes or parsing normalizes it, and signature verification becomes impossible. A generic SDK success/default TCB policy is confused with M01 acceptance. Customer data may already have been sent before required preflight verification fails.

**Smallest correction:** Choose one supported model/route and pin the maintained [official SDK](https://docs.near.ai/cloud/inference-sdk/javascript) if suitable; update the declared Node floor if adopted. Before dispatch, persist request bytes/hash and preflight evidence/nonce/signer/policy identity. Capture private raw response bytes, IDs and headers durably before parsing, verifying or delivering. Separate generation, proof and billing states. M01 chooses accepted TCB/provenance/age/signature requirements; an unavailable required proof cannot become `not-required` automatically. Never release a cost reservation merely because proof or parsing failed.

**Verification / exit:** Crash after response receipt, mutate whitespace/one byte, rotate a signer, replay a nonce, omit a signature and simulate delayed/zero billing. Recovery verifies the original bytes or retains an honest unverified/unknown state without new paid generation. The actual bill matches the original inference ID. Verify the deployed billing contract: the [current docs index](https://docs.near.ai/llms.txt) marks balance/cost endpoints as moving/deprecated, so the current host/path is a live contract gate.

The plan's updated search limits are correct: result count does not cap paid search calls, and streaming Chat differs from the existing client. Keep free bounded URL retrieval initially unless aggregate reasoning/token/service charges have a defensible hard ceiling. A pricing JSON reference is not independent verification. Staking principal/yield is not an immediate credit purchase.

### RE-07 — High: distinguish safe original-operation recovery from permanent uncertainty, and local stop from remote cancellation

**Plan:** R2 line 104; R3 lines 114–120; R5 lines 137–142. **Current files:** `src/custody/adapter-runtime.mjs:79`, `src/custody/agent-api.mjs:35`, `src/inference/index.mjs:88`, `src/workflow/index.mjs:130`, `src/rules/index.mjs:89`.

**Unsupported assumption:** The existing no-resubmit behavior alone provides an operable recovery and kill switch for real providers. If the first response/correlation ID is lost, current custody reconciliation cannot look it up. Cloud explicitly cannot recover a lost output/unknown inference ID. A submitted provider action may remain queued or processing after a local pause/kill.

**Failure and impact:** One lost response indefinitely occupies the only order slot with customer money and reservations held. Alternatively, the UI promises a stopped business while a previously accepted transfer executes remotely. Timeout is incorrectly treated as failure and leads to duplicate payment or an unfunded refund.

**Smallest correction:** Document a recovery matrix per provider/action: durable pre-send identity; exact response evidence; original-key lookup or vendor-guaranteed same-key/same-body replay; retention window; definitive failure; and unresolved/manual-review outcome. The [Agent API status guide](https://docs.agentsonintents.com/integration/agent-api/status-and-errors) describes same-key recovery, which is distinct from issuing new work; permit it only under a verified contract and an explicit M01 recovery decision. Never assume Cloud offers the same guarantee. Specify that local stop prevents new dispatch but does not undo accepted work; show pending obligations and any owner-signed remote freeze/cancel requirements. Accounting/reconciliation continues while stopped.

**Verification / exit:** Lose the first response before any provider ID is saved; restart; stop while the provider queues an action; settle after local stop; and exceed the recovery window. There is no new operation identity, duplicate transfer, false failure or released unknown reserve. The operator sees the blocked obligation and a concrete next action. Three happy-path runs do not replace these failure proofs.

### RE-08 — High: agent document access is not permission to disclose every future revision to customers

**Plan:** outcome line 7; R2 lines 97–106; R3 public service loop. **Current files:** `src/workspace/index.mjs:28`, `src/workspace/index.mjs:44`, `src/workspace/index.mjs:47`, `src/knowledge/index.mjs:66`, `src/knowledge/index.mjs:73`.

**Unsupported assumption:** Selecting document IDs for an agent/public service is a lasting customer-publication approval. Activation records IDs; each new task captures the then-current content. Current snapshot checks recheck grants, not canonical revision equality. A capability-protected customer report is still disclosure outside the company, even though it is not a public ledger entry.

**Failure and impact:** An owner approves a benign service document, later adds private strategy to that same document, and a public customer's next report incorporates the new private text. Or a queued task uses an obsolete revision despite R2 promising revision-change blocking.

**Smallest correction:** Separate company/agent-read permissions from service-customer disclosure permission. For the initial service, use no private company documents or explicitly approve particular document revisions/excerpts for that service audience. Bind publication to those content hashes/revisions and invalidate it on change/revocation. Define whether an internal task keeps its frozen historical revision or needs refresh; R2's revision-change promise must be consistent with that decision. Do not silently recapture changed content into an already authorized paid request.

**Verification / exit:** Publish revision A, edit to private B, revoke an agent or service grant, and create/resume a customer order. B never enters a customer prompt/report without renewed publication approval. Test two agents and customer capabilities, including malicious document instructions. A prompt asking the model to keep secrets is not the access boundary.

### RE-09 — High: the sequence has no credible effort/capacity or cut-line decisions for the deadline

**Plan:** sequence line 68; R2–R5; ownership line 148; dependencies lines 154–158. **Current files:** `src/cloud-funding/index.mjs:31`, `src/workflow/index.mjs:174`, `scripts/dev.mjs:16`, `package.json`.

**Unsupported assumption:** Multiple named owners make R0–R5 fit before the deadline. No task effort or available capacity is stated; supplier onboarding, proof verification, packaging and funding all contend for the coordinator/integrations owner. Line 68's instruction to finish all code/local work before requesting a funded proof postpones the most informative component test. The [live event instructions](https://nearhackathon.com/HACKATHON.md) confirm 14 November 2026, 23:59 UTC; at review time about 42 hours remained. They do not make every suggested integration mandatory.

**Failure and impact:** Broad fixture extraction, callable tools, procurement and proof work consume the remaining time without a single real report/sale. A last-minute prepaid path is then mislabeled full autonomous funding, or the team has no reproducible real milestone.

**Smallest correction:** Add effort ranges, named available owner and a decision time to each gate. Separate (A) useful real bounded research, (B) real prepaid service/payment/payout, and (C) full autonomous funding plus real procurement. Preserve C as unmet when unsupported. Prepare and test each exact component action before requesting its bounded proof; do not wait for unrelated R4/UI work. Investigate funding/supplier feasibility immediately, with a short explicit timebox. Free authored skills/templates stay valid content; a generic model-selected tool loop and broad paid marketplace can wait. Procurement is enabled only for one actual chosen supplier/deliverable, not a generic licence framework.

**Effort assumption to challenge, not a delivery promise:** allow roughly 0.5–1 engineer-day for contract/setup/test-boundary work, 1–2 for the minimal real inference/proof/report path, and 1–2 for payment/refund/recovery/clean-start evidence, with overlap only where contracts are frozen. Supplier/funding lead time is external; custom cryptographic verifier work can exceed this. The coordinator must replace these rough ranges with current owner estimates before committing the deadline.

**Verification / exit:** A revised dependency list shows critical path, resource capacity, first component-proof time and go/change/stop decisions. If Cloud purchase support is absent at the feasibility deadline, mark the full objective blocked and ship only an explicitly labeled real intermediate milestone if the user chooses it. Never remove the target silently or promise a score. Submission/publication remains a separate user decision.

### RE-10 — Medium: define which research questions the first real service can fulfil before charging

**Plan:** outcome line 7; R2 lines 98–106. **Current files:** `src/research/index.mjs:19`, `src/research/index.mjs:53`, `src/rules/policies.mjs:144`, `src/workspace/catalog.mjs`.

**Unsupported assumption:** Replacing fixture sources/output and whole-source quotation checks makes the service useful for arbitrary market briefs. Current public retrieval uses a fixed supplied list; overlap checks can pass common words without establishing topic/geography relevance. The plan fixes the bad full-source-substring criterion but leaves the first service's evidence coverage and acceptance example unspecified.

**Failure and impact:** A customer buys a report about a market the approved sources do not cover. Real inference generates a well-cited but unhelpful summary, or the shop refunds every normal paraphrase after paying inference costs.

**Smallest correction:** Choose one service topic, audience, output length and decision it helps. State evidence/date/coverage limitations before checkout. Reject clearly unsupported questions before deposit instructions. Use bounded cited excerpts and observable claim-source mapping; distinguish unsupported assertions from unverified conclusions. Evaluate one ordinary real summary and one adversarial irrelevant summary, without pretending deterministic checks prove truth.

**Verification / exit:** A real report passes human usefulness review against the disclosed offer; invented/missing citations and irrelevant-source examples fail. Unknown dates remain explicitly unknown. Cost, latency, failures and refunds are measured against this actual offer. Broader autonomous discovery is later work unless a bounded paid capability is proven.

### RE-11 — Medium: isolate tests and bind historical stores to economic identity, not just mode/company

**Plan:** R1 lines 86–91; R5 lines 139–142. **Current files:** `src/runtime/providers.mjs:26`, `src/app.mjs:23`, `src/research/index.mjs:62`, `test/knowledge/jbrain.test.mjs:15`, `scripts/dev.mjs:16`.

**Unsupported assumption:** Existing mode/company binding and a green test suite cover the product-only transition. Current binding does not include treasury/provider account, balance bucket or settlement network/asset; changing these while retaining a company/live mode can reuse old financial facts. Native JBrain tests can skip when the sibling binary is absent.

**Failure and impact:** A clean judge checkout appears green while omitting real knowledge checks, or a new wallet is connected to an old ledger/reservations. Removing demo routes accidentally destroys access to preserved historical reports or tests still import fixture helpers transitively through the product.

**Smallest correction:** Retain R1's test-only composition requirement. Extend immutable economic binding to the selected account/provider/bucket/network/settlement identity; define a deliberate migration or require a new store on change. Historical fixture stores stay read-only under their original identity. Provide one pinned JBrain setup and a required integration-check command that fails, rather than skips, when the service is missing. Keep a fast explicitly labeled offline test command if useful.

**Verification / exit:** Product transitive imports contain no fixture effect implementation. Missing credentials yield setup-required, not fake success. Tests use temporary isolated stores and cannot move real funds even if developer secrets exist. Attempt to reopen with a changed account/bucket/network, restore both app/JBrain data, and view old fixture history without mutation. A clean checkout runs the required native-service checks with zero unexpected skips.

## Coverage, accepted choices and remaining dependencies

- **Workspace and six setup stages:** preserved. Multiple profiles sharing one runner is an honest MVP; no demand for independent model sessions or multi-agent concurrency is added here.
- **Templates, SOUL.md and skills:** real downloadable/written guidance can remain prompt-only, free and clearly attributed. It need not become executable merely to count as real content. A connected tool needs an actual adapter, permission, bounded cost and result; installing text never supplies them. No celebrity/expert endorsement is established.
- **JBrain/imports:** real existing integrations, not candidates for replacement. Preserve grants, CAS/revisions, explicit sharing, provenance and unknown-write recovery. RE-08 adds the missing customer audience distinction.
- **M01/M03 and durable accounting:** strong existing boundaries. RE-02/03/05/07 specify facts/actions within them; they do not authorize a second policy engine or ledger.
- **Cloud tools, SDK and verification:** the updated plan correctly identifies maintained options and cost limitations. Adopt only the supported subset needed for one report; verification policy and byte durability remain required. Built-in search and staking are documented possibilities, not proven integrations in this repository.
- **Paid supply and funding:** R4 correctly refuses a made-up entitlement or top-up endpoint. No actual supplier/delivery contract or autonomous purchase route is established. Those remain external dependencies and full-claim blockers, not implementation tasks with guaranteed completion dates.
- **Customer payment/report/payout:** new composition/restart tests are useful local evidence. They do not prove money entered the right spendable domain or that a customer can receive the promised remedy. RE-01/04/05 are required before sales.
- **Historical evidence/video/score:** retain labels and history. Local fixture videos and prior estimated scores must not be presented as fresh real economic proof. Do not publish new claims solely because the suite grew to 164 tests.

## Focused readiness checklist

Before implementation is called an executable whole plan:

- [ ] Track RE-01–RE-11 dispositions against the reviewed hash, with owner and evidence for each closure.
- [ ] Name one route/model/service, required proof policy, initial refund domain and approved customer-publication policy.
- [ ] Define setup/probe versus spending permissions and snapshot-versus-receipt reconciliation.
- [ ] Add realistic effort/capacity, early component probes and timeboxed dependency/cut-line decisions.

Before the first funded component or customer deposit:

- [ ] Owner approves exact accounts/network/actions/principal/fees/request/daily/aggregate limits/expiry; secrets enter privately through the supported secure flow.
- [ ] Actual identity, synchronized policy, grant, spendable bucket, capital and Cloud credit evidence are established and attributable.
- [ ] Route-specific quote/status/proof and an executable funded refund route are ready; fee/obligation reserves are sufficient.
- [ ] Exact Cloud bytes/preflight, charge bounds and required verifier policy survive restart; no dummy fallback is reachable.
- [ ] Missing IDs, submitted effects after stop, expiry/revocation and unknown costs have safe operator-visible outcomes.

Before claiming the strict final objective:

- [ ] Real autonomous credit acquisition and real supplier delivery are demonstrated, or the corresponding objective remains explicitly blocked.
- [ ] Three fresh approved-route loops measure checkout through report, automatic payout, actual cost and required proof finality in under 120 seconds, with acquisition included when claimed.
- [ ] Sanitized evidence correlates original operations; controlled stand-ins and public/private disclosure are clearly separated.
- [ ] Clean-checkout/JBrain proof, customer privacy, recovery and an actual remedy have passed. The user separately approves publication/submission.

## Decisions needing user input and residual risk

Only a few decisions need the user: exact funded run limits/accounts/route; whether to accept a clearly labeled prepaid real milestone if autonomous purchasing remains unsupported; which service content may be disclosed to customers; and whether a proven narrower milestone is sufficient for this deadline. Prepare concrete choices first. No general architecture approval is needed to finish reversible R0/R1 work.

Even after these corrections, provider beta behavior, documentation drift, balance/proof/billing latency, external supplier availability and report usefulness remain risks. Attestation does not prove a market conclusion true. A careful plan/review cannot guarantee vendor capability, the latency target, commercial value or judging success.

## Revision 2 recheck

Rechecked revision 2 at SHA-256 `66ece30643ef99f9ed64148f8142f695b6e16a1cc40334dc06d4fcd658cf56da`. I read the revised plan, its G1–G9 gates, capacity/milestone section and all 11 finding dispositions. The final consistency edits distinguish internal frozen knowledge from customer-publication approval, replace the stale pending-review record, and explicitly require a user decision before the proposed API-capability brief changes the market-report service.

**Planning verdict: ready with conditions to implement the revised sequence, honoring its dependency gates. No new critical planning objection.** RE-01–RE-11 are addressed in the plan; they are **not closed in the implementation or funded evidence**. The product remains **not ready for funded execution or a strict-live completion claim** until the applicable checks pass. In particular, spendable settlement/refund routes, independent balance/credit reconciliation, durable proof verification, customer disclosure boundaries and autonomous Cloud acquisition remain outstanding.

The staged A/B/C milestones and timeboxes are a material improvement. They permit useful reversible work now while retaining an explicit blocked state for unsupported vendor capabilities. A proposed narrower service, prepaid milestone or different funding mechanism must not silently replace the user's full objective. This recheck changed only this critique; the drafting thread owns the revised plan, and no runtime edits or funded actions were performed by the reviewer.
