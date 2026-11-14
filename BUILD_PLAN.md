# Autonomous Business — module-wise build plan

Track: **Autonomous Business** · id: **business** · 11 November 2026  
Status: architecture is the planning baseline; module plan and critique prepared; no product implementation in this turn.

The user has asked to proceed with a module-wise plan using the proposed one-agent research-shop architecture. The two unresolved integrations no longer block planning or independent local module work. They still block claims that the full live requirements have been met. Do not ask for architecture approval again merely to develop this plan. Funded operations require a defined amount cap; network substitutions require explicit agreement.

The previous architecture plan is preserved in `BUILD_PLAN_ARCHITECTURE_BASELINE.md`. The earlier Council plan is in `BUILD_PLAN_COUNCIL_HACKATHON.md`; its PRD, review documents, and partial implementation are historical. This scope has one research agent, NEAR Intents payments, agent-funded NEAR AI Cloud inference, contributor revenue sharing, owner rules in `config.yaml`, secure agent custody, a public ledger, and a testnet loop under 120 seconds. It has no Council, expert-profile marketplace, or Bonfire dependency.

## 1. Build small modules inside one application

Build **12 modules in one application**, with one background workflow, one durable store, and explicit internal contracts. Modules are code boundaries, not 12 services, deployments, databases, or AI agents. No message broker, plugin system, generic financial platform, or open-ended agent framework is needed for this scope.

**M01 is the single owner of all business rules.** It reads `config.yaml`, calculates prices and splits, evaluates spending and eligibility, controls stop/retry/refund decisions, and defines report/access/disclosure requirements. Other modules provide facts and execute its decisions: the journal stores records; treasury records money and reservations; custody submits permitted transfers; payments verifies provider facts; Cloud funding buys usable credit; inference consumes it; the agent researches/writes; payouts fulfills approved obligations; workflow coordinates; the ledger and web surface present approved views.

One Rules module does not mean one giant function or file. Keep small pricing, spending, split, lifecycle, quality, and access functions together inside that module. No other module imports `config.yaml`, copies a threshold, calculates a contributor percentage, or independently decides whether an action is permitted. Technical validation—such as a malformed response, signature check, unique operation id, or storage-version conflict—stays with the module performing that job; it must not become a second business-policy engine.

Use one settlement asset per network and one active order initially. Treasury remainder and contributor share are computed from the confirmed report revenue, before inference costs. Use two supported customer input assets in validation to demonstrate token choice. Do not support arbitrary tokens or promise every route meets the latency target.

## 2. Shared contracts before module code

These are proposed application contracts, not claims about vendor API shapes. Every boundary validates input and returns a typed result. Store schema version 1 and representative valid, invalid, pending, and unknown examples with the implementation. Do not create a separate schema service or code generator.

### Common records

- **Money:** network, asset identifier, decimals, and nonnegative integer atomic amount. USD accounting costs use integer nano-USD separately. No floating-point token arithmetic, cross-network balance mixing, or addition of unlike assets.
- **OrderSpec:** order id, customer delivery-access reference, question, geography/time horizon, report format, and requested payment asset/network. Keep private question/access data out of public events.
- **OfferPolicy:** config version/hash, minimum invoice price, settlement asset, contributor account/share in basis points, treasury remainder, and offered terms. Freeze when issuing the invoice; later owner changes affect new invoices. Require shares to total 10,000 basis points.
- **SafetyView:** current kill state/epoch, daily UTC inference cap, allowed actions/destinations, per-request bounds, and whether config/custody policy is ready. Current safety rules can halt an old order; they do not rewrite its commercial terms.
- **OperationRef:** stable action id, purpose, order/obligation id, network, immutable payload fingerprint, provider, attempt records, and any external request/transaction reference. The same action id with different contents is a conflict.
- **ExternalResult:** `not_submitted`, `pending`, `confirmed`, `failed`, or `unknown`, plus OperationRef and evidence. `unknown` means an external effect may have happened. A definitive failure can still have incurred cost; include that fact. Never turn a timeout into proof that no money moved.
- **EvidenceReceipt:** source/provider, observed time, network where relevant, reference, verified amount/status, fee items with known/provisional state, and safe public evidence link/hash. A browser assertion is not a settlement receipt.
- **SpendReservation:** id, request/action id, accounting day, upper-bound cost, locked treasury resource if relevant, actual cost when reconciled, and status. Keep uncertain reservations across restarts and midnight until resolved.
- **ExecutionPermit:** an internal, short-lived permission tied to one action fingerprint, reservation, recipient, maximum amount, policy epoch, and expiry. Issued by M01 Rules, recorded/consumed by M03 bookkeeping; never accepted from the browser/model. It is a proposed local safeguard, not a vendor-supported authorization format.
- **ReportArtifact:** report id, order id, content/hash, source references/dates, qualifications, generation references, and validation result. No provider credentials or payment instructions inside the report contract.
- **ContributorObligation:** obligation id, originating settled sale, frozen recipient/share, exact Money due as calculated by Rules, completed amount, payout operation, and status.
- **FinancialSnapshot:** versioned balances, actual daily costs, unresolved reservations, credit ownership, and existing obligations. M03 supplies facts; M01 applies business limits and formulas.
- **RulesDecision:** `allow`, `deny`, or `hold`, with reason code, action fingerprint, policy version/epoch and input-state versions. Where relevant it includes a frozen offer, exact allocation/reservation plan, report acceptance, retry/remedy plan, permitted next action, disclosure/access plan, and ExecutionPermit. Decisions are context-bound, not reusable blanket approvals.

Every command carries an action id and expected record version where it changes durable state. Failure codes distinguish invalid input, policy block, insufficient funds, unsupported capability, provider unavailability, conflict, and unknown outcome. Only retry a rejected/not-submitted operation directly; pending/unknown effects require reconciliation or documented provider idempotency first.

### Durable effect protocol

Before any outbound money movement or paid inference: obtain facts from M03/M02 and an M01 RulesDecision; persist its exact operation/reservation plan atomically; immediately before dispatch, ask M01 to validate the permit against current rules and state. Serialize the final dispatch decision against accepted kill/config changes, record permit consumption, then call the provider and record evidence. If a policy or financial version changed, return a conflict and reevaluate in M01; M03 or an adapter cannot substitute its own rule. Journal and local money/state changes occur together in one storage transaction. External calls never occur inside that transaction.

Adapters may record their own provider operations and evidence in their assigned journal namespace. They cannot mark an order paid, allocate revenue, modify another module's balances, or declare overall fulfillment. Workflow applies validated facts through the responsible module. A local action id alone does not guarantee exactly-once external execution: if the provider cannot reconcile an ambiguous submission, hold it for resolution and do not double-submit. That exceptional run does not count as successful autonomous completion.

## 3. Module contracts and acceptance gates

### M01 — Rules

**Specific job:** own and evaluate every business rule from the owner's single `config.yaml`; return a decision for the requested action.

**Input:** owner-controlled YAML/config change, action and order context, frozen offer where applicable, current versioned FinancialSnapshot, verified payment/provider/report/access facts, and custody-capability readiness. It receives facts as data; it does not fetch them from vendors.

**Output:** validated OfferPolicy/SafetyView and a RulesDecision: allow, deny, or hold with a reason and versioned decision evidence. An allowed decision supplies the exact price, allocation, reservation, payout/refund instruction, report acceptance, permitted next action, or public/access view required by that operation, and a short-lived ExecutionPermit where necessary. Invalid or missing rules fail closed.

**Owns / effects:** all rule definitions, calculations and business decisions: minimum pricing; asset/recipient permissions; daily inference budget and affordability; revenue percentages and rounding; kill behavior; request/research/report limits and acceptance criteria; order-stage eligibility; retry/unknown-outcome handling; refunds; access/disclosure. It alone reads config and owns accepted config versions/current safety epoch. Evaluate using pure functions over facts, with a small config reload/versioning boundary. No provider calls, balance ownership, report generation, signing, or persistence implementation. The owner alone changes rules; the model cannot.

**Dependencies:** shared contracts; M02 for config/decision records through its storage contract. Financial and provider facts are supplied as snapshots, avoiding imports back into treasury or vendor adapters.

**Done when:** pricing, split calculation, spend/affordability, stop/resume, retry/refund, report and access/disclosure decisions are all tested here. Invalid percentages/currencies/missing fields deny new effects. Frozen offers/obligations retain their terms while current kill/lower caps halt later actions. Measure kill detection within one second without claiming reversal of a submitted action. Other modules have no config reader or copied business formula.

**Example contract:** evaluate an inference action with its maximum charge, current FinancialSnapshot, frozen order and live rules → allow with an exact reservation/permit, deny for the daily cap, or hold for an unknown earlier charge. No inference call is made during evaluation.

### M02 — Durable journal and operation registry

**Specific job:** persist state transitions and operation identities so work can resume without inventing duplicate obligations.

**Input:** version-checked record changes, append-only events, immutable operation intent/evidence, and read queries.

**Output:** committed version/event sequence or conflict, operation history, recoverable work list, and private/public-safe record references.

**Owns / effects:** durable storage, atomic local transactions, operation identity uniqueness, version checks, and private artifact references. No provider calls, financial policy, report judgments, or public rendering. Raw credentials are never persisted here. A simple pending-work record in this store is sufficient; no separate queue service.

**Dependencies:** shared records only. It does not import workflow or vendor adapters.

**Done when:** replaying an action returns its existing result; different payload reuse is rejected; interrupted writes leave either all or none of a local allocation; restart preserves reservations, obligations, artifacts, and unknown effects. A journal fault before dispatch prevents that effect.

### M03 — Treasury bookkeeping and reservations

**Specific job:** maintain financial facts and atomically apply the exact allocation/reservation plans issued by M01 Rules.

**Input:** verified money/cost facts, M01 RulesDecision with an explicit allocation/reservation/reconciliation plan, expected financial version, and recorded operation evidence.

**Output:** updated FinancialSnapshot, recorded allocations/SpendReservations/obligations, permit-consumption record, or a stale-version/data-integrity conflict. It does not issue an affordability or policy decision of its own.

**Owns / effects:** financial state changes through M02: treasury balances, contributor/refund reserves, available credits, daily cost facts, reservations, and consumed-permit records. This is the sole owner of those recorded balances. It records M01's exact percentage amounts and plans; all percentage, price-floor, cap, affordability and refund formulas live in M01. On a stale snapshot or changed policy epoch, request a new M01 evaluation rather than recomputing a decision here.

**Dependencies:** M01 decision contract and M02. No Cloud, Intents, or custody client; no config reader.

**Done when:** M01's approved $5 illustrative sale/20% plan records a $1 contributor obligation exactly; repeated receipts/plans cannot record it twice; a state/version race rejects the stale plan; unknown reservations survive restart/day changes; no local cap/split/refund decision is introduced. Dollar examples are fixtures, not approved values.

**Important distinction:** record a Cloud-credit purchase as cash converted to credit, and inference consumption as expense. Provide both facts to Rules; do not double-count them or decide independently how much may be spent.

### M04 — Agent identity and custody execution

**Specific job:** submit and reconcile only a permitted blockchain action for the agent's own NEAR account.

**Input:** action id/fingerprint, internal ExecutionPermit, network, approved recipient/asset/amount or restricted method call, and protected custody-secret reference.

**Output:** agent identity/capability status, ExternalResult, balance observation, and transaction evidence including gas, storage and custody charges when known. Unknown fees remain unreconciled. Never return a signing secret.

**Owns / effects:** OutLayer custody interaction, an M01 final authorization check before submission, and provider-operation evidence in M02. It cannot choose revenue shares, redirect payouts, edit policy as the agent, or sign arbitrary model-supplied payloads. Expose purpose-specific transfer/call actions, not a general raw-sign endpoint.

**Dependencies:** M01–M03; a replaceable custody adapter. Prefer OutLayer. A function-call-key fallback requires a separately reviewed restricted treasury design; it cannot silently become a plaintext full-access key.

**Done when:** own account identity is demonstrated; unpermitted recipient/amount/purpose is refused; secrets never reach browser/model/logs; duplicate and lost-response cases reconcile; owner freeze/kill blocks new signing. Local fixture mode needs no real wallet; live custody requires actual evidence.

### M05 — Customer payment quotes and settlement verification

**Specific job:** translate a report invoice into a supported NEAR Intents payment and verified incoming settlement.

**Input:** order/invoice id, OfferPolicy, requested source asset/network, recipient treasury, refund destination, expiry, and quote/status evidence.

**Output:** PaymentQuote with exact required input, destination amount, costs, network, expiry and provider reference; then verified SettlementReceipt or pending/failed/unknown result.

**Owns / effects:** Intents quote/status integration and its operation records. Verify factual network/asset/recipient/amount/finality against the order and provider evidence, then ask M01 whether that settlement satisfies the frozen offer. The customer signs their payment; this module never gets the customer's private key. It does not choose the minimum price, generate reports or allocate revenue. M03 records the M01-approved allocation once.

**Dependencies:** M01, M02, settlement asset/account identity from M04. No dependency on research or Cloud funding.

**Done when:** a stale quote, wrong network/recipient/asset, insufficient settlement, or repeated callback cannot start a sale twice; unknown payment stays unresolved; expired/late receipts go to a recorded remedy path. Unsupported assets are rejected before asking for a deposit.

### M06 — Autonomous Cloud funding

**Specific job:** obtain sufficient usable NEAR AI Cloud credit using the agent's authorized treasury resources.

**Input:** bounded required credit, funding action id, agent identity, available agent-owned credit evidence, permitted funding amount/recipient, ExecutionPermit, and provider credential references.

**Output:** confirmed FundingReceipt linked to the agent, updated available-credit observation, or pending/unknown/unsupported result. Receipt distinguishes a new purchase from reusing previously agent-funded credit and from owner-funded bootstrap credit.

**Owns / effects:** the funding/credit-purchase integration and its provider-operation records. Ask M01 to authorize funding or hold an ambiguous retry; do not choose a local top-up threshold. Route an on-chain movement through M04 if the verified provider arrangement requires it. Never change provider-admin balances and call that a purchase. It does not generate text or declare inference cost.

**Dependencies:** M01–M04 and a documented supported funding route. No dependency on customer UI or report composition.

**Done when:** an authorized agent-funded purchase produces evidence of credited service; unknown top-up is not repeated blindly; an absent route returns `UNSUPPORTED_CAPABILITY`. Owner-prepaid credits can support a clearly labeled inference-only development run, but do not pass this module's real funding acceptance.

### M07 — NEAR AI Cloud inference and usage reconciliation

**Specific job:** execute one bounded inference request and return generated output plus its billing evidence.

**Input:** GenerationRequest, selected model/rate reference, hard input/output/reasoning/request bounds, SpendReservation/ExecutionPermit, verified credit availability, action id, and protected Cloud credential reference.

**Output:** GenerationResult with provider request id, output, finish reason, token/service usage, actual cost receipt when available, or a pending/unknown/failure result with known incurred cost. Cost not yet known remains unreconciled, not zero.

**Owns / effects:** paid Cloud calls and usage-status reconciliation. No customer checkout, top-up, payout, allocation, config reading or local budget rule. Supply current rate/charge-bound facts to M01 and require its final permit before the call; a changed bound needs a fresh RulesDecision. If a safe bound cannot be established, return that fact for M01 to hold/deny the request. Rules alone decides whether provider search or a retry is allowed; the adapter enforces the approved request parameters.

**Dependencies:** M01–M03; M06 credit-readiness contract; Cloud adapter. Tests can inject confirmed credit fixtures without testing a real purchase.

**Done when:** no request without headroom executes; billed reasoning/retries and incomplete calls are accounted for; lost output does not trigger an automatic duplicate paid request; output and actual usage correlate to the action; uncertain charges remain reserved. Unavailable cost evidence prevents a fully accounted completion claim.

### M08 — Research and report agent

**Specific job:** turn a bounded market question and source evidence into a useful report request and a validated report artifact.

**Input:** ResearchBrief, M01-approved research/report specification and source/time/query limits, evidence records, and GenerationResult from M07.

**Output:** first an EvidencePack and GenerationRequest; after generation, a candidate ReportArtifact plus ReportFacts for M01 acceptance, or evidence/error facts explaining why it cannot proceed. Proposed report defaults in M01 are 400–700 words with 3–5 dated sources, findings, implications and uncertainty; M08 does not define those thresholds.

**Owns / effects:** bounded read-only retrieval, prompt assembly, source-reference checks, candidate report preparation and factual quality observations. It cannot call paid inference or financial tools independently. M10 obtains M01 authorization before M07 executes its GenerationRequest. It follows M01's research/report specification and returns facts for acceptance rather than inventing a separate quality policy. Retrieval rejects unsafe technical destinations and treats page text as evidence, not instructions. The initial M01 rule permits free public sources only; paid feeds remain deferred.

**Dependencies:** shared records, M01 rule/specification contract, read-only retrieval port, M07 output shape. No dependency on Intents/custody internals.

**Done when:** changed evidence changes candidate content; source/link and missing-evidence observations reach M01; the same candidate can pass or fail when only M01's approved report requirements change, without editing M08. Structural facts cannot prove all conclusions true: inspect representative reports for support before release. M01-rejected drafts are not delivered.

### M09 — Contributor payout fulfillment

**Specific job:** turn a recorded contributor obligation into a confirmed payment to its frozen recipient.

**Input:** recorded ContributorObligation from M03, report-availability facts, action id, and M01 authorization with exact amount/recipient and applicable timing/remedy decision.

**Output:** pending/confirmed/failed/unknown payout result, recipient receipt, and obligation progress recorded atomically when locally possible. Only M03 changes protected balances.

**Owns / effects:** payout submission/reconciliation through M04 and recording provider facts. Ask M01 whether to pay, wait, retry or enter a remedy; do not define payout timing, retry limits, split formulas or refund policy here. There is one obligation per settled sale/recipient, and M03 records confirmed progress. A partial payment cannot reset the obligation.

**Dependencies:** M01–M04 contracts and report-delivery facts. No vendor-specific Intents/Cloud dependency.

**Done when:** the exact frozen share arrives automatically; a pending response stays owed; restart resumes payout only; repeated delivery events cannot pay twice; config changes cannot redirect old obligations. Full refunds reverse an allocation only with confirmed refund evidence; already paid contributions need treasury-funded remediation, not assumed clawback.

### M10 — Order workflow and recovery

**Specific job:** coordinate module calls and persist order progress according to M01's permitted next action.

**Input:** customer order command, current OrderState/version, module facts/results, safety updates, elapsed-time/recovery facts, and M01 RulesDecision.

**Output:** the approved typed module command and customer-visible OrderStatus, or the hold/deny/remedy status specified by Rules. It cannot invent provider success or override a denied action.

**Owns / effects:** order-state records through M02, gathering context for Rules, and dispatch to execution modules. M01 owns business sequencing/eligibility, retry/remedy decisions and completion criteria; M10 implements the mechanics of progressing them. No pricing/split/budget logic, provider formats or local policy branches. Keep payment, report, funding/cost and payout substates explicit. Proposed M01 delivery rule: a checked report is durably available to its entitled customer; a download or acceptance click is not required.

**Dependencies:** M01–M09 through contracts. Fakes implement those same contracts. The UI is not a dependency.

**Done when:** every new business action/completion uses an M01 decision; denials/holds survive restart; the normal loop follows the configured rules; no workflow fallback silently turns a hold into paid work. Kill blocks new effects while Rules permits read-only reconciliation. Paid-but-unfulfillable facts produce the M01 remedy action, not a fabricated success.

**Normal sequence, defined in M01:** preflight/quote → verify payment → allocate/reserve → fund Cloud → collect evidence → authorize/run inference → assess/deliver report → pay contributor → reconcile completion. M10 coordinates that sequence; it does not define another version of it.

### M11 — Public ledger projection

**Specific job:** transform journal facts into a safe public accounting view.

**Input:** journal events, verified evidence references, M01 disclosure plan/public-field allowlist, and projection checkpoint.

**Output:** LedgerEntries and per-asset revenue/cost/credit/payout totals with due, pending, confirmed, and unknown states, plus last-updated/reconciliation status.

**Owns / effects:** read-side projection/cache and accounting presentation only. Apply M01's disclosure plan; do not define another privacy policy. It cannot update spend, mark an order paid or authorize a payout. Rebuild from M02; ledger unavailability does not lose economic records. Never render arbitrary raw journal data publicly.

**Dependencies:** M01 disclosure contract, M02 and event contracts. No runtime vendor call is needed to render recorded facts.

**Done when:** every sale, funding movement, consumed cost, payout and reversal is visible once; replay rebuilds the same totals; late cost corrections append transparently; gas, storage, custody and conversion charges are included when incurred, with unrelated operational costs kept separate; cash top-up and consumption are not double-counted; no secret/customer report text leaks. An unaudited estimate is visibly provisional.

### M12 — Customer and owner web surface

**Specific job:** present permitted commands and views without owning business logic.

**Input:** customer brief/payment selection, server-verified identity/access facts, M01 access decision, M10 status, permitted report artifact, M11 ledger data, and owner-readable safety status.

**Output:** validated order commands, checkout instructions, private report view/download, public ledger page, and clear status/errors. The owner edits `config.yaml`; a full admin dashboard is unnecessary.

**Owns / effects:** technical request/identity verification, delivery-access tokens, rendering, and enforcement of M01 access decisions. No independent access/pricing policy, config reader, signing credential, trusted client-side role selector, confirmation claim or background paid work. M01 defines public-ledger, private-report and owner-control permissions; M12 enforces the returned decisions. Do not claim production identity security from prepared demo identities.

**Dependencies:** M01 access contract, M10–M11 read/command contracts and ReportArtifact. Develop against fixtures; domain modules do not import web code.

**Done when:** a customer can order and obtain only their report, an outsider can inspect redacted ledger entries, and owner/customer/public access cannot be substituted by editing browser input. Refresh/back/retry does not repeat financial actions. Render report/source text as untrusted content without executing supplied HTML or scripts. No production customer data is used for the first demo.

## 4. Build order and reviewable increments

One implementation lead owns delivery; the owner supplies accounts, config values and any approved funding cap. No other agents are assumed. Work on provider documentation/proofs can overlap independent modules without pretending it is finished.

**Increment A — Build M01 Rules first, then M02.** Freeze minimal shared facts/decision examples. Test the complete required rule set—daily cap, minimum price, share calculation and kill—against fixed financial snapshots before any provider integration. Add eligibility/retry/remedy/report/access rule cases as their modules arrive. Then prove config reload, decision versions, action replay and durability in M02. No wallet/inference needed.

**Increment B — M03, then M04 and M09 against a controlled fake.** Demonstrate M01 decisions applied as recorded sale allocations, protected contributor shares, bounded reservations, permitted payouts, kill rejection and held unknown transfers; those modules must add no business rules. This produces a money-safe local path before real signing. Begin actual custody/Intents/funding feasibility work alongside A–B when authorized access exists; do not postpone it until UI completion.

**Increment C — M08 + M07.** Demonstrate evidence → bounded generation request → report validation. Start with recorded fake output. Then swap only M07 to real Cloud inference if credentials/allowed credit and budget are available; label this inference-only proof if M06 is not live. This proves useful output without claiming autonomous funding.

**Increment D — M05 + M06.** Give each adapter its capability probe, fixture implementation, and separately verified real implementation. M05 proves supported checkout/settlement; M06 proves agent-funded Cloud credit. Each publishes supported network/mode, receipts, constraints and unresolved issues. An unavailable real adapter does not prevent its local contract or increments E–F; it prevents the corresponding live acceptance claim.

**Increment E — M10 + minimal M11.** Run the full headless workflow with controlled adapters and a basic public ledger projection. Crash after settlement, after a charge, after report delivery, and after payout submission; resume without another charge or duplicated obligation. Do not wait for a polished website to see the entire loop.

**Increment F — M12 + real adapter replacement.** Add a small storefront/report view and ledger page. Replace one fixture adapter at a time, rerunning the same contract cases and recording real evidence. Protect funds and private data; do not enable public sales with incomplete money paths.

**Increment G — Demo runner and presentation.** A test driver, not a thirteenth business module, submits a fresh order through the same workflow and gathers timestamps/evidence. Complete three new live loops on the approved route, each under 120 seconds, plus separate cap/price/kill/retry checks. Record current proof status accurately.

Reference effort: one experienced builder, a new product, no completed reusable modules. Allow roughly 4–7 focused builder-days for contracts, fixture-driven domain/workflow, minimal UI and meaningful checks; real adapters, recovery verification and demo reliability can add another 3–7 days plus unbounded provider/access waiting. These are provisional allowances, not a hackathon deadline or commitment. Re-estimate after B and the first real funding/payment proof. With less time, cut visual polish and ancillary views before cutting money controls or mislabeling fixtures as live.

## 5. Shared verification and demo gates

Every module ships with its public contract, valid/invalid/result examples, meaningful acceptance checks, side-effect declaration, and dependency list. All business-rule tests live with M01. Execution modules test enforcement of allow/deny/hold decisions and factual/technical behavior, not copied policy formulas. Add a dependency/import check: only M01 reads `config.yaml`; adapters/workflow/UI cannot introduce independent business thresholds or rule tables. Pure modules use deterministic checks. Provider modules use a shared contract suite plus real smoke evidence. Passing fakes does not establish vendor behavior. Existing Council package scripts reference unfinished assets/tests; replace or validate them during implementation rather than claiming they already cover this system.

Essential integration scenarios:

1. Normal sale → real funding → real inference → delivered report → confirmed contributor payout → public ledger, without per-order operator actions.
2. Wrong/underpaid/stale settlement and duplicated provider observations; no unauthorized paid work.
3. A capped request, simultaneous/replayed authorization, restart and UTC rollover; no cap reset or released unknown spend.
4. Kill before checkout, before funding/inference, and before payout signing; late external effects remain visible and owed money is preserved.
5. Lost response after inference/top-up/transfer; reconcile the original operation, do not blindly repeat it.
6. Report failure with real incurred cost, refund handling, and payout failure after valid delivery; no invented success and no repeat research just to retry payout.
7. Old invoice/obligation under new config; preserve commercial terms and apply current safety limits.
8. Ledger rebuild and late-cost update; correct per-asset totals without private data or top-up/consumption double counting.
9. Change only M01's pricing, cap, share, report requirement or access policy: dependent behavior changes without editing an executor. M01 unavailable/invalid or a stale decision blocks business effects; no module supplies a permissive fallback.

The two documented limitations remain localized. Official NEAR Intents has no testnet deployment; OutLayer testnet does not provide its Intents path. A real alternate sandbox must be verified or a clearly described exception accepted before claiming the requested testnet loop. [NEAR Intents FAQ](https://docs.near-intents.org/resources/faqs), [OutLayer custody](https://app.outlayer.ai/docs/agent-custody).

Cloud inference and usage reporting are documented; a supported agent-funded credit-purchase path is not established by the quickstart. Keep M06 honest: unavailable is a valid capability result; pretending owner-prepaid credits are an automatic purchase is not. [Cloud quickstart](https://docs.near.ai/cloud/quickstart), [usage reporting](https://docs.near.ai/cloud/guides/usage-reporting).

For the timed strict run, create/fund accounts as disclosed setup, then start the timer at customer checkout initiation and stop after the fresh report, payout confirmation, and reconciled public ledger. No pregenerated report, prepaid invoice, hidden manual top-up, or timer beginning after settlement. Do not claim complete accounting while actual charge evidence remains unknown. Use a selected fast supported route, not a universal latency promise. Fixture loops and real component proofs remain useful progress even before this final gate passes.

## 6. Critique incorporated and remaining risks

The detailed self-review is in `BUILD_PLAN_MODULE_CRITIQUE.md`. Its fixes are already reflected here: one application; M01 as the sole business-rule owner; separate Cloud funding/inference; one treasury record owner; durable effect records before dispatch; frozen offer terms versus live stop rules; unknown-outcome reconciliation; read-only ledger; and a thin workflow coordinator.

The modules are independent enough to build and test, not independent of shared financial truth. The largest residual risks are M06 funding availability, the testnet requirement, real settlement/billing latency, provider ambiguity, and report usefulness. Tests can establish local rules and contracts; only real evidence can establish integration behavior, and neither establishes paid demand.

Next implementation unit: **Increment A, beginning with M01 Rules and shared fact/decision examples, then M02 durability.** In parallel with that work, investigate M05/M06 provider feasibility when access is available. Do not begin by rebuilding the old Council UI or by writing an all-purpose autonomous agent.
