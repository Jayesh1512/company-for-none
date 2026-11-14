# Company for None — Near Agent Workspace

**Start with [How Company for None works](docs/COMPANY_FOR_NONE_GUIDE.md).** It explains the operating loop, a fictional insurance day-in-the-life, healing, upgrades, resource buying, current capability status and the owner setup checklist.

The product turns a company brief into a managed agent workspace. The intended routine is manager → scoped specialists → delivery → observed gaps → permanent backlog → developer → tested improvement → future work uses the new version. The owner sets purpose, knowledge, policy and budget. Company for none is the default for new companies; Company for one retains owner-managed work.

The local workspace, native JBrain knowledge and fictional customer-care service work now. The complete reasoning/improvement loop has controlled test evidence. **Real funded operations are demonstrated on mainnet** (see below); a single loop-driven mainnet spend is also evidenced; the remaining gap is the autonomous sale-to-payout loop where customer revenue funds the agent's own inference. The guide’s [single status table](docs/COMPANY_FOR_NONE_GUIDE.md#current-capability-and-status) separates local evidence, controlled tests, required inputs and remaining implementation.

**Earlier public-only evidence (14 November):** the run verified a real **1Click dry quote** with the official SDK’s default production root, plus **Cloud gateway/model UpToDate attestation** with fresh nonces and attested gateway TLS. Public responses include 64 models, 231 tokens and the deployment wallet's then-current `UNKNOWN_ACCOUNT` result, before its later funding and deployment. No completion, swap, transaction or spend occurred in that run. [Evidence, exact reproduction, hashes and limits](docs/LIVE_EVIDENCE.md) keep these results separate from paid business proof; deployment provenance was not checked.

**Mainnet execution (14 November):** the company ledger contract is **deployed on NEAR mainnet** and written by the **Agent API native-call route** (agent account, owner-signed policy + grant). `node scripts/verify-mainnet-evidence.mjs` passes **20/20 checks**: **14 live public-chain checks** (contract account, code hash, 22 hash-chained records, 7 FINAL transactions) and **6 local artifact checks**. [Transactions, artifacts and exact scope](docs/MAINNET_EVIDENCE.md).

### Real funded operations

The following are real, paid, on mainnet — not simulated:

1. **NEAR AI Cloud inference (TEE-verified, E2EE).** Two actual encrypted calls via the official `@nearai/inference-sdk` v0.3.0. Gateway + model attestation verified with fresh nonces; wire signature and plaintext verified in the original process. Provider billing confirmed at **$0.00322116** total. The second call produced a cited answer from the fictional Harbor Mutual policy with `status: "answered"`, `cost.status: "confirmed"`, `verification.status: "verified"`. [Flow, evidence and limits](docs/REAL_AI_DEMO.md).

2. **Marketplace x402 tasks (real USDC payments).** Two tasks completed on `market.near.ai` via the x402 protocol. Task `c41a599b` delivered a research answer on NEAR Intents with sources; paid in USDC (`nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`) on `near:mainnet`. [Marketplace artifacts](artifacts/marketplace/).

3. **Mainnet ledger records via Agent API.** The Agent API agent account (`b2c5b8f3…`) wrote hash-chained records to the company ledger contract on NEAR mainnet via the native-call route (tx `B5uKmgFDs8…`, FINAL + SuccessValue). The ledger now has 22 records with an intact hash chain. 14/14 live chain checks pass. [Ledger details](docs/NEAR_ONCHAIN_LEDGER.md).

4. **1Click NEAR Intents quote.** Real dry quote obtained from `1click.chaindefuser.com` with the official SDK's default production root. Quote was verified offline after disk reopen and an explicitly synthetic altered amount was rejected. No swap completion or settlement occurred in this run.

**The funded loop that exists:** customer question → agent reads native JBrain knowledge → agent calls NEAR AI Cloud (real paid TEE inference) → cited answer or owner-review ticket → operation recorded on mainnet ledger via Agent API. Separately, the agent completes paid marketplace x402 tasks in USDC.

**What remains incomplete:** the autonomous sale-to-payout loop — a customer paying the agent for a service, the agent using that revenue to fund its own inference, and the surplus settling to contributors. The inference is owner-funded, not customer-funded. Closing this loop (even one end-to-end transaction) is the highest-leverage improvement.

**Loop-driven spend (14 November):** one autonomy-loop turn, whose decision came from a real NEAR AI Cloud completion (E2EE, signature-verified), executed a **0.025 USDC** spend through the Agent API under the owner-signed grant. The loop then auto-committed `spend.requested`/`spend.completed` plus agent lifecycle events to the mainnet ledger ([append tx](https://nearblocks.io/txns/VsMbQdnVXAk2aJrVne2fZhnyTaPmS9fXhYi4Up6f3NT)). `node scripts/verify-loop-receipt.mjs` re-reads mainnet: **18/18 checks** (14 LIVE_PUBLIC, 1 LIVE_AUTHED needing the Agent API key, 3 LOCAL_ARTIFACT). **Limits, stated plainly:** the swap is confidential (USDC→wNEAR) so the public chain proves the *commitment*, not fund movement; this is outbound spending, not a customer sale or revenue; the model-written purpose says "buy inference credits" but no credits were bought; the Cloud decision call was paid from the owner key outside treasury reservations. We have **no customer payment, delivery-for-payment, refund or live seller**. See the [payment inventory](docs/MAINNET_EVIDENCE.md#payment-inventory-what-moved-and-how-to-check-it).

Offline replay also verified the original production-signed quote after disk reopen and rejected an explicitly synthetic altered amount despite its recomputed wire checksum. It made no network request and did not reverify TEE attestation. The new collector/verifier syntax check passes **138 files**; the **512-test suite remains earlier evidence**, not rerun for this increment.

**Mentor implementation increment:** [every recommendation and its exact disposition](docs/MENTOR_IMPLEMENTATION.md). Native ledger calls now use shared native/USD reservations, final dispatch and original-operation recovery, with independent final-RPC fee parsing exercised against actual local Sandbox success and billed failure. Settings adds private provider request preparation, original wallet-intent handling and unsigned scoped-key/account/feed plans. Recorded mentor regression: **544 passed, 0 failed/skipped**, with **44 focused checks**, **12 native JBrain checks** and **151 syntax files**. That increment created no new paid call, public/vendor account, grant, mainnet transaction or public seller. Missing production proof/fee producers and G6 remain hard live gates.

**The main demo now uses actual NEAR AI.** Open [Real AI demo](http://127.0.0.1:4173/#demo): select an existing agent/documents and ask a question. Two actual encrypted, official-SDK-verified calls produced a cited answer and an owner-review ticket; provider bills total **$0.00322116**. Refresh/restart reuses accepted records without another completion. This is the explicitly approved **owner-funded, live-call verification** scope within the existing $5 ceiling. The funded inference and ledger loop is demonstrated; autonomous customer-funded commerce remains the next step. [Flow, authority, evidence and limits](docs/REAL_AI_DEMO.md).

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

Official Cloud **0.3.0**, 1Click **0.1.26** and Agent API **0.9.0** SDKs are pinned. Actual free preflight verifies nonce and gateway/model TCB, without a completion. The current SDK cannot supply supported durable original plaintext replay/proof. Accepted production commands remain held. No custom decryption or security-route switch is used. [Verification contracts](docs/NEAR_VERIFICATION.md), [Cloud products](docs/NEAR_CLOUD_PRODUCTS.md) and [business operation](docs/BUSINESS_OPERATION.md) carry the technical details and remaining economic evidence gates.

Company documents live in native JBrain. PDF, Markdown/text and public webpage imports produce editable previews; explicit Save persists reviewed text/provenance. PDF extraction has no OCR; webpage import does not crawl or execute scripts. Original uploads and unsaved previews remain in memory. **Saved knowledge, grants, conversations, tickets, reports, provider evidence and journal history persist.** Back up the journal and company-brain directory together while stopped. This is a local single-owner workspace, not a no-retention or multi-tenant service. See [JBrain integration](docs/JBRAIN_INTEGRATION.md).

Private knowledge is not general public service context. The customer-care path separately checks exact owner-approved fictional revisions before exposure. The on-chain projection contains safe event types, times and linked hashes, not raw customer/policy data. No mainnet record, fee, paid provider call or external sale is established by local persistence or Sandbox execution.

## Product and historical records

[PRODUCT.md](PRODUCT.md) describes the current mission and constraints. [DESIGN.md](DESIGN.md) preserves the visual direction. [MVP_STATUS.md](MVP_STATUS.md) is a chronological evidence record; earlier counts and runtime descriptions are historical snapshots.

The reviewed [Company for none plan](docs/COMPANY_FOR_NONE_BUILD_PLAN.md), [critique](docs/COMPANY_FOR_NONE_CRITIQUE.md) and [real-execution plan](docs/REAL_EXECUTION_PLAN.md) remain unchanged. Historical BUILD_PLAN/PRD/architecture and earlier Council/Bonfire plans are preserved; use the [current guide](docs/COMPANY_FOR_NONE_GUIDE.md) for product behavior. The [recorded walkthrough](walkthrough/README.md) shows the earlier fixture workspace. The [problem film](problem-video/README.md) contains no project footage.
