# Company for None — A Living Organization on NEAR

**A living organization, not just a chatbot.** Company for None explores a business that can serve, spend and improve after its owner sets the purpose, approved knowledge, policy and budget. A master agent coordinates specialists and a permanent backlog. The goal is a self-sustaining organization whose customer revenue pays for its services and maintenance. **Self-repair and bounded spending have recorded execution evidence; customer-funded sustainability is not yet demonstrated.**

## The operating model: earn, spend, learn, improve

The business model below is the target architecture, not a claim that every step is live:

```text
Customer request + x402 payment                 [revenue: not yet demonstrated]
                    |
                    v
Treasury: receipts, costs, reservations, surplus [financial accounting]
                    |
                    v
Master agent -> scoped specialists -> delivery
                    |
                    v
Missing knowledge / failed validation -> permanent backlog
                    |
                    v
Knowledge curator + template developer -> evaluated repair
                    |
                    v
Updated knowledge and template -> retry / future permitted work
```

### The actual example: an agent repairs an incomplete intake process

The [recorded live recovery scenario](docs/LIVE_RECOVERY_DEMO.md) uses fictional insurance documents, real native JBrain storage and real NEAR AI Cloud responses:

1. **Support encounters a knowledge gap.** A customer asks which contact preference an intake must record and chooses `portal`. The runbook does not explain the requirement, so the support agent escalates rather than inventing an answer. The intake template also lacks `contactPreference`.
2. **The backlog coordinates repair.** Within the predefined recovery workflow, the manager delegates support work and the backlog selects a **knowledge curator** and a **template developer**.
3. **Knowledge changes from an approved source.** The curator selects the exact approved passage: contact preference must be `portal` or `email`. The runtime checks that excerpt and saves a new native JBrain runbook revision. This updates the knowledge base; it is not an invented policy or an unverified knowledge-graph write.
4. **The developer repairs the template.** It proposes the missing field. A local fixed evaluator compares old and new templates against the same mandatory-field contract; the baseline fails and the candidate passes. This verifies required-field coverage, not an enum validator for `portal` versus `email`. Rules check the current revision before promotion. This demonstrated evaluator is not a verified remote OutLayer run.
5. **The same request now succeeds.** Support reads the new runbook and template revisions, cites the updated guidance and produces an intake containing `contactPreference: portal`. It creates no insurance approval or payment.

The retained [browser evidence](artifacts/live-recovery/browser-proof.json) records **six distinct, original-process-verified NEAR AI responses**, changed knowledge/template revisions and **$0.005128148** in matched provider bills. The [restart evidence](artifacts/live-recovery/restart-proof.json) records no extra provider calls. This is a bounded, owner-funded recovery scenario with a **private company journal**, not a customer-funded business or a mainnet publication of those recovery events. No external customer database is needed for this demonstration.

### Treasury and the path to sustainability

- **Revenue — intended:** customers pay via x402 for delivered services or approved premium documents. **There are currently no customer-paid transactions or received revenue in the retained payment evidence.**
- **Expenses — evidenced:** owner-funded inference, separately purchased marketplace tasks and a loop-driven Agent API confidential swap. Marketplace task purchases are expenses, not our sales. Their evidence scopes and authorization limits differ; they are not all one treasury-funded run.
- **Accounting — implemented with limits:** Rules and Treasury maintain reservations, costs and receipt handling. The Rust mainnet ledger stores safe event/hash commitments; it is not a public balance sheet and does not independently prove customer revenue, confidential fund movement or profitability. See the [payment inventory](docs/MAINNET_EVIDENCE.md#payment-inventory-what-moved-and-how-to-check-it).
- **Self-improvement — demonstrated narrowly:** the recovery scenario updates source-backed knowledge and an additive template. It does not autonomously rewrite arbitrary application code, invent policy or prove paid hiring of external agents. Instruction changes still need owner review.

**Hypothetical commercial extension:** customers could pay an extra fee for a document with approved additional fields, such as an address or requested monetary detail. The organization would detect the missing capability, route a repair through its backlog and use the approved revision for later work. Customer data integration, paid delivery and continued earnings during updates still need implementation and evidence; this is not a live insurance service.

## How it works

The intended organization loop is manager → scoped specialists → delivery → observed gaps → permanent backlog → developer → evaluation → approved improvement → subsequent work using the new revision. Company for none is the default for new companies; Company for one retains owner-managed work. The [full guide](docs/COMPANY_FOR_NONE_GUIDE.md) separates setup, current capabilities, controlled tests and remaining live gates. Owners still supply authority, credentials, budget and exceptional decisions; agents cannot grant themselves permission.

The local workspace, native JBrain knowledge and fictional customer-care service work now. The general autonomy loop has controlled-test evidence; the separate recovery scenario above records a bounded live knowledge/template repair. Public NEAR ledger writes and a loop-driven confidential spend are evidenced separately below. These do not establish customer-funded inference, paid service delivery, revenue sharing or a complete autonomous business.

**Earlier public-only evidence (14 November):** the run verified a real **1Click dry quote** with the official SDK’s default production root, plus **Cloud gateway/model UpToDate attestation** with fresh nonces and attested gateway TLS. Public responses include 64 models, 231 tokens and the deployment wallet's then-current `UNKNOWN_ACCOUNT` result, before its later funding and deployment. No completion, swap, transaction or spend occurred in that run. [Evidence, exact reproduction, hashes and limits](docs/LIVE_EVIDENCE.md) keep these results separate from paid business proof; deployment provenance was not checked.

**Mainnet execution (14 November):** the company ledger contract is **deployed on NEAR mainnet** and written by the **Agent API native-call route** (agent account, owner-signed policy + grant). `node scripts/verify-mainnet-evidence.mjs` passes **20/20 checks**: **14 live public-chain checks** (contract account, code hash, reported head of 22 records, links in the first 20 records, and 7 FINAL successful transactions) and **6 local artifact checks**. [Transactions, artifacts and exact scope](docs/MAINNET_EVIDENCE.md).

### Real funded operations

These are distinct execution paths. Cloud inference runs off chain; ledger transactions run on NEAR mainnet. Stored provider artifacts are not fresh independent verification of delivery, signatures, billing or settlement:

1. **NEAR AI Cloud inference (TEE-verified, E2EE).** Two actual encrypted calls via the official `@nearai/inference-sdk` v0.3.0. Gateway + model attestation verified with fresh nonces; wire signature and plaintext verified in the original process. Provider billing confirmed at **$0.00322116** total. The second call produced a cited answer from the fictional Harbor Mutual policy with `status: "answered"`, `cost.status: "confirmed"`, `verification.status: "verified"`. [Flow, evidence and limits](docs/REAL_AI_DEMO.md).

2. **Marketplace x402 task purchases (outbound expenses).** Retained artifacts report two completed tasks purchased from `market.near.ai` via x402. These are not customer payments to our organization, and the public checker does not independently reverify their payment or delivery. Task `c41a599b` delivered a research answer on NEAR Intents with sources; paid in USDC (`nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`) on `near:mainnet`. [Marketplace artifacts](artifacts/marketplace/).

3. **Mainnet ledger records via Agent API.** The Agent API agent account (`b2c5b8f3…`) wrote hash-chained records to the company ledger contract on NEAR mainnet via the native-call route (tx `B5uKmgFDs8…`, FINAL + SuccessValue). At the recorded check the head reported 22 records; the public checklist inspected previous-hash links in the first 20. That alone does not validate every payload or establish financial truth. 14/14 live chain checks passed. [Ledger details](docs/NEAR_ONCHAIN_LEDGER.md).

4. **1Click NEAR Intents quote.** Real dry quote obtained from `1click.chaindefuser.com` with the official SDK's default production root. Quote was verified offline after disk reopen and an explicitly synthetic altered amount was rejected. No swap completion or settlement occurred in this run.

**Keep the evidence paths separate:** the owner-funded AI demo reads JBrain and produces cited answers or review tickets in its private journal. The recovery scenario additionally demonstrates knowledge/template repair and a successful retry. Separate scripts and the spend loop write mainnet ledger commitments. We have not shown one customer-paid transaction linking service delivery, treasury-funded inference and a payout.

**What remains incomplete:** the autonomous sale-to-payout loop — a customer paying the agent for a service, the agent using that revenue to fund its own inference, and the surplus settling to contributors. The inference is owner-funded, not customer-funded. Closing this loop (even one end-to-end transaction) is the highest-leverage improvement.

**Loop-driven spend (14 November):** one autonomy-loop turn, whose decision came from a real NEAR AI Cloud completion (E2EE, signature-verified), executed a **0.025 USDC** spend through the Agent API under the owner-signed grant. The loop then auto-committed `spend.requested`/`spend.completed` plus agent lifecycle events to the mainnet ledger ([append tx](https://nearblocks.io/txns/VsMbQdnVXAk2aJrVne2fZhnyTaPmS9fXhYi4Up6f3NT)). `node scripts/verify-loop-receipt.mjs` re-reads mainnet: **18/18 checks** (14 LIVE_PUBLIC, 1 LIVE_AUTHED needing the Agent API key, 3 LOCAL_ARTIFACT). **Limits, stated plainly:** the swap is confidential (USDC→wNEAR) so the public chain proves the *commitment*, not fund movement; this is outbound spending, not a customer sale or revenue; the model-written purpose says "buy inference credits" but no credits were bought; the Cloud decision call was paid from the owner key outside treasury reservations. We have **no customer payment, delivery-for-payment, refund or live seller**. See the [payment inventory](docs/MAINNET_EVIDENCE.md#payment-inventory-what-moved-and-how-to-check-it).

Offline replay also verified the original production-signed quote after disk reopen and rejected an explicitly synthetic altered amount despite its recomputed wire checksum. It made no network request and did not reverify TEE attestation. The new collector/verifier syntax check passes **138 files**; the **512-test suite remains earlier evidence**, not rerun for this increment.

**Mentor implementation increment:** [every recommendation and its exact disposition](docs/MENTOR_IMPLEMENTATION.md). Native ledger calls now use shared native/USD reservations, final dispatch and original-operation recovery, with independent final-RPC fee parsing exercised against actual local Sandbox success and billed failure. Settings adds private provider request preparation, original wallet-intent handling and unsigned scoped-key/account/feed plans. Recorded mentor regression: **544 passed, 0 failed/skipped**, with **44 focused checks**, **12 native JBrain checks** and **151 syntax files**. That increment created no new paid call, public/vendor account, grant, mainnet transaction or public seller. Missing production proof/fee producers and G6 remain hard live gates.

**The main demo now uses actual NEAR AI.** Open [Real AI demo](http://127.0.0.1:4173/#demo): select an existing agent/documents and ask a question. Two actual encrypted, official-SDK-verified calls produced a cited answer and an owner-review ticket; provider bills total **$0.00322116**. Refresh/restart reuses accepted records without another completion. This is the explicitly approved **owner-funded, live-call verification** scope within the existing $5 ceiling. The funded inference demo is recorded; it does not itself establish a mainnet ledger write or customer-funded commerce. Offline plaintext recovery remains unavailable. [Flow, authority, evidence and limits](docs/REAL_AI_DEMO.md).

The earlier [isolated local demo](docs/LOCAL_REAL_DEMO.md) remains a model-free knowledge/records flow available via its explicit local-demo API/CLI. The main top bar now opens the AI demo. The original setup prefill is **Fill example fields**.

## Current company and entry points

The current preview is **Northstar Care**, serving fictional **Harbor Mutual Insurance**, on **port 4173**.

- [Customer chat](http://127.0.0.1:4173/#care): two saved support profiles use four real native JBrain fictional auto/home/travel/claims documents. Ask “What is the auto collision deductible?” Replies quote approved passages with source revisions. This is model-free lookup, not generated AI conversation.
- [Owner inbox](http://127.0.0.1:4173/#support): unknown questions and claim-decision requests create persistent local tickets. No insurer claim, approval, email or external contact occurs.
- [Company operations](http://127.0.0.1:4173/#autonomy): objective, responsible agents, durable work, blockers, improvements, resource requests and service drafts.
- [Company ledger](http://127.0.0.1:4173/#autonomy/ledger): private lifecycle/effect history and the NEAR audit panel. The Rust contract is **deployed on mainnet**, hash-chained (22 records at last check) with the Agent API account as writer. `node scripts/verify-mainnet-evidence.mjs` passes 20/20 checks (14 live chain + 6 artifact). Routine app publishing still requires a verified native fee/signing envelope and exact operation authority; deployment alone does not enable it. See [ledger details](docs/NEAR_ONCHAIN_LEDGER.md).
- [Marketplace](http://127.0.0.1:4173/#marketplace): local guidance, resource definitions and customer-care listings. A listing is not an external NEAR marketplace sale or a reusable supplier licence.

The fictional policy pack was an explicit owner setup action. Ordinary startup seeds no sample company, provider, money or report. Existing profiles and history are preserved. [Customer-care details](docs/CUSTOMER_CARE.md) cover exact source publication, private conversation access and real-client inputs.

## Setup and routine operation

[Organization setup](http://127.0.0.1:4173/#setup) follows **Define company → Review agents → optional Company brain → Boundaries & infra → Review & finish**. Saving the brief creates real persisted, paused manager/backlog profiles from Rules-defined roles. Users can edit names, roles, instructions and written skills. Bootstrap is not an AI-generated decision or model call. Finishing setup records review; Start is separate and subject to readiness.

Grant document access in Company knowledge, then select each role’s bounded context under Company operations → Agents while paused. Later work freezes exact profile, skill/SOUL, document and active template revisions. Current grants are checked again before inference. The top-right **Open local demo** opens a separate working local company. **Fill example fields** in ordinary setup retains the earlier sample-text behavior; normal Save actions persist those drafts.

The internal workflow is separate from customer orders. It uses the official SDK path, durable claims/fences, stable effect identities and existing Rules/Treasury gates. Automatic healing supports additive structured document-template changes with a fixed baseline/candidate evaluator and exact-head promotion. Instruction proposals require paused owner review. Host-code proposals remain inert manual work. This is versioned operational improvement, not model training.

Free skills/SOUL are real written guidance. They grant no tools or financial authority. Paid requests and commercial service drafts stay distinct from actual purchases, entitlements, publication and revenue. See the [guide](docs/COMPANY_FOR_NONE_GUIDE.md) and [unified setup contracts](docs/UNIFIED_COMPANY_SETUP.md).

## Run

Requires Node **24.22.1+**, npm, Git and Rust/Cargo. Recorded checks used Node **26.12.1**.

```sh
npm ci
npm run setup:jbrain
npm run dev
```

JBrain setup clones commit `35836b0972a6471b22db3155f78b26749c78b6ac` into `.runtime/dependencies/jbrain` and builds with `cargo build --release --locked`. It refuses to overwrite an edited or mismatched checkout. Alternatives are `SHOP_JBRAIN_BINARY`, or an existing service with `SHOP_JBRAIN_URL` and `SHOP_JBRAIN_TOKEN_FILE`.

Open [setup](http://127.0.0.1:4173/#setup). Development startup loads local environment configuration when present and starts isolated model-free JBrain. The server binds loopback. Direct local browser access needs no owner-token entry. Identity comes from the socket, exact local Host/port and same-origin metadata; cross-site/rebound/forwarded requests do not receive this access. This trusts other users/processes on the same computer. Shared or remote operation needs configured authentication; see [local access](docs/LOCAL_WORKSPACE_ACCESS.md).

Configuration names are in [.env.example](.env.example). With no explicit `SHOP_CONFIG_PATH`, the app has no commercial policy. Invalid explicit policy fails closed. Historical `config.yaml` is a fixture policy and is not loaded by default. Setup needs no budget; workspace access and Start do not grant spending authority.

## Checks and demonstrations

```sh
npm test                         # recursive suite; native checks need the JBrain binary
npm run test:native              # required native JBrain checks
npm run check                    # JavaScript syntax
npm run test:autonomy             # local and controlled-loop checks
npm run demo:e2e:controlled       # isolated synthetic SDK/proof/credit/billing inputs
npm run demo:fixtures             # isolated financial/report regression fixtures
node scripts/verify-mainnet-evidence.mjs   # read-only: live ledger checks + labeled local provider artifacts
```

Maintenance verification on 14 November: **563 tests passed, 0 failed/skipped; 185 JavaScript files syntax-checked**. Native writer tests use the shared RPC configuration. Swap CLI regression tests run with public wallet metadata only and verify `--dry-run` sends no transaction, uses a `dry:true` quote without requiring a deposit address, and preserves exact yoctoNEAR amounts. This maintenance run made no paid call or chain write.

Recorded on-chain baseline: **512 passed, 0 failed, 0 skipped; 136 syntax files; 17 focused on-chain policy/HTTP/wallet checks; 8 actual local NEAR Sandbox checks on nearcore 2.6.2 and 2.14.1**. Existing browser evidence covers the ledger at 1440/390 widths without errors or overflow. Logs: [on-chain ledger](artifacts/onchain-ledger/), [customer care](artifacts/customer-care/) and [E2E integration](artifacts/near-e2e-fixes/). These results predate this documentation update; no broad tests were rerun for prose. The subsequent evidence collector/verifier syntax result is **138 files**.

The controlled loop uses real application modules, Rules, Treasury, native JBrain and the fixed evaluator, with only the serialized work request supplied to its test reasoner. Its SDK output/proof/credit/billing are controlled inputs. Normal startup imports no controlled reasoner/provider. Passing these tests does not prove live model judgment or paid execution.

The earlier **separate setup-only E2E demo** can run with:

```sh
npm run demo:e2e -- --local --serve --port 4185
```

It uses actual local JBrain and public retrieval and reports real execution holds. **4185 is not the current customer-care company; use 4173 for that.** Scope and earlier counts are retained in the [E2E result](docs/NEAR_E2E_RESULT.md).

## Provider, accounting and data contracts

M01 alone reads policy and decides permissions, limits, readiness, amounts and refunds. M03 records exact reservations and receipts. Stable original operation identities survive restart; unknown effects are reconciled, never blindly resent. The existing **USD5 lifetime actual-plus-pending cap** is an upper bound, not a spending grant. Balance snapshots are nonadditive observations, not new funds or owned credit. Autonomous Cloud cash-to-credit purchase and reusable paid skill acquisition remain unsupported.

Official Cloud **0.3.0**, 1Click **0.1.26** and Agent API **0.9.0** SDKs are pinned. Actual free preflight verifies nonce and gateway/model TCB, without a completion. The current SDK cannot supply supported durable original plaintext replay/proof. The strict commercial route remains gated; the separately authorized AI demo and recovery scenario use original-process live verification with hold-on-loss, not offline replay guarantees. No custom decryption or security-route switch is used. [Verification contracts](docs/NEAR_VERIFICATION.md), [Cloud products](docs/NEAR_CLOUD_PRODUCTS.md) and [business operation](docs/BUSINESS_OPERATION.md) carry the technical details and remaining economic evidence gates.

Company documents live in native JBrain. PDF, Markdown/text and public webpage imports produce editable previews; explicit Save persists reviewed text/provenance. PDF extraction has no OCR; webpage import does not crawl or execute scripts. Original uploads and unsaved previews remain in memory. **Saved knowledge, grants, conversations, tickets, reports, provider evidence and journal history persist.** Back up the journal and company-brain directory together while stopped. This is a local single-owner workspace, not a no-retention or multi-tenant service. See [JBrain integration](docs/JBRAIN_INTEGRATION.md).

Private knowledge is not general public service context. The customer-care path separately checks exact owner-approved fictional revisions before exposure. The on-chain projection contains safe event types, times and linked hashes, not raw customer/policy data. No mainnet record, fee, paid provider call or external sale is established by local persistence or Sandbox execution.

## Product and historical records

[PRODUCT.md](PRODUCT.md) describes the current mission and constraints. [DESIGN.md](DESIGN.md) preserves the visual direction. [MVP_STATUS.md](MVP_STATUS.md) is a chronological evidence record; earlier counts and runtime descriptions are historical snapshots.

The reviewed [Company for none plan](docs/COMPANY_FOR_NONE_BUILD_PLAN.md), [critique](docs/COMPANY_FOR_NONE_CRITIQUE.md) and [real-execution plan](docs/REAL_EXECUTION_PLAN.md) remain unchanged. Historical BUILD_PLAN/PRD/architecture and earlier Council/Bonfire plans are preserved; use the [current guide](docs/COMPANY_FOR_NONE_GUIDE.md) for product behavior. The [recorded walkthrough](walkthrough/README.md) shows the earlier fixture workspace. The [problem film](problem-video/README.md) contains no project footage.
