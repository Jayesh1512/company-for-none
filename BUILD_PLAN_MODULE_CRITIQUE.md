# Independent self-critique — modular research-shop plan

11 November 2026 · Reviewed source: `BUILD_PLAN.md`, module plan for Autonomous Business (`business`). This reviews the proposed decomposition, not a completed implementation. It does not reuse the old Council critique's line references as findings against this plan.

## Verdict

**Ready to build the foundation and independent modules. Not yet proven as a complete live autonomous business.** The user's direction to proceed with planning is respected: missing vendor capabilities do not block config, journaling, treasury, report, workflow, ledger or UI development against honest contracts.

The decomposition is useful because each module owns one outcome and can be demonstrated independently. Its main danger would be treating module separation, mocks, or stored action ids as proof that external money and inference are safe. The plan must keep those distinctions explicit.

The twelve modules are folders/interfaces in one application. M01 Rules is the only business-rule owner; all other modules supply facts, store records or execute its decisions. They are not twelve independent services, wallets, stores or agents. One experienced builder can work through small reviewable increments; this is not a request for a parallel agent team.

## Material findings and applied corrections

### C01 — Too much modularity can consume the hackathon

**Severity:** High for delivery scope. **Reference:** plan §1, §2 and build increments A–G.

**Failure:** building a service per module, a generic event framework, or exhaustive schemas before one report works creates deployment and coordination work without improving the demo.

**Correction applied:** one application, one background workflow and one durable store. Shared records are simple versioned types/examples, not a contract registry. Implement the records needed for Increment A first and expand with the next module. Use a pending-work record rather than a separate queue system. Keep the web surface small.

**Verify:** the foundation starts locally without running vendor services; M01 can be reviewed alone; the first headless full loop runs before visual polish. Do not count infrastructure as product progress.

**Residual:** twelve boundaries still require discipline. Combine small files when useful; preserve the contracts and ownership, not an arbitrary file count.

### C02 — Separate modules can accidentally create separate versions of the money

**Severity:** Critical before real money. **Reference:** M02, M03, M05, M09 and §2 durable effect protocol.

**Failure:** payment marks an order paid, payout independently computes a contributor share, and the ledger subtracts a different cost. A crash between these writes can leave available money overstated or pay contributors twice.

**Correction applied:** M01 alone calculates/authorizes financial allocations and limits. M03 alone records the resulting allocations/reservations; it is bookkeeping, not another rules engine. M02 commits local state/events atomically. M05 supplies verified settlement facts; M09 executes the frozen obligation after M01 authorization; M11 projects approved facts. No executor recomputes shares or cap rules.

**Verify:** duplicate settlement, partial local-write failure, repeated delivery, and restart preserve one allocation and one contributor obligation. Sum disjoint allocations in each asset to actual controlled funds, with credit separately accounted.

**Residual:** an external transfer cannot be atomic with the local store. C04's reconciliation is still required.

### C03 — Buying inference and using inference are different capabilities

**Severity:** High; blocks the autonomous-funding claim, not other modules. **Reference:** M06, M07; increments C–D and §5.

**Failure:** a report produced with an owner's prepaid key is presented as the agent purchasing its own compute. A second failure is logging both a $1 credit top-up and $0.10 consumption as $1.10 of inference expense.

**Correction applied:** separate funding receipts, available credits, and consumption receipts. M06 must establish the agent's funding provenance; M07 proves generation and usage. An inference-only development run is valid but labeled. Treasury distinguishes cash converted to credit from credit consumed as expense.

**Verify:** one funding movement, its credited service, and correlated inference charges reconcile independently. Unknown actual costs stay pending. A fake funding receipt or a provider-admin limit edit cannot pass live M06 acceptance.

**Residual:** a supported autonomous Cloud purchasing route remains unverified; an interface does not create vendor support. [Cloud quickstart](https://docs.near.ai/cloud/quickstart), [usage reporting](https://docs.near.ai/cloud/guides/usage-reporting).

### C04 — Local idempotency does not guarantee exactly-once external effects

**Severity:** Critical before paid requests/transfers. **Reference:** common OperationRef/ExternalResult, M04–M07, M09 and §5 scenarios 1–6.

**Failure:** a provider accepts a transfer or paid generation, but the response is lost before the result is stored. Retrying a new request charges or pays twice even though the local journal has one action id.

**Correction applied:** persist intent before dispatch; preserve pending and unknown outcomes; bind immutable action payloads; use provider-supported idempotency or reconcile the original operation. Retry an unknown action only after establishing its result. If correlation/reconciliation is unavailable, stop that action for resolution rather than claim automatic exactly-once behavior.

**Verify:** drop the response immediately after simulated provider acceptance, restart, and observe no second effect. For each real adapter, establish what actual reference/status path supports that recovery. A fixture's support must not be mistaken for the provider's.

**Residual:** some ambiguous provider incidents may require human support. They are exceptions and do not count as a successful autonomous timed run.

### C05 — A kill switch checked only at order start is insufficient

**Severity:** Critical before unattended spending. **Reference:** OfferPolicy versus SafetyView; M01, M03–M04, M06–M07, M09–M10.

**Failure:** the owner turns the shop off while an inference or payout command is queued. A worker uses an earlier approval and spends anyway. Conversely, applying a new split to an old sale changes money already owed.

**Correction applied:** M01 owns both frozen commercial terms and current safety rules. It issues permits bound to the action/current safety epoch and reevaluates them immediately before dispatch. Serialize the final local dispatch decision against accepted kill/config changes. Old obligations retain recipient/share; kill stops new effects and leaves read-only reconciliation running.

**Verify:** flip kill between authorization and dispatch in every effect adapter; no new dispatch follows the accepted kill. Test lowered cap, malformed reload, old invoice under new split, and safe resume. Measure detection, not just a visual toggle.

**Residual:** a network call already sent cannot be recalled. Never promise the kill switch reverses committed transfers or cancels every provider-side computation.

### C06 — A thin coordinator can become the whole application again

**Severity:** High for maintainability and contract independence. **Reference:** M08–M10; §1 ownership and §2 effect protocol.

**Failure:** M10 embeds vendor payloads, prompts, split formulas, retries and balances. Its tests become the only way to test anything; every adapter change rewrites the workflow.

**Correction applied:** M01 owns every business decision, including financial calculations, eligibility, retries, remedies and report acceptance. M10 coordinates the next action approved by M01. M03 records balances, M08 assembles evidence/prompts and supplies report facts, adapters handle provider formats/status, and M09 records payout progress. Dependency direction is inward to common records; M01 accepts supplied snapshots rather than importing those modules. M08 returns a generation request rather than calling a paid endpoint.

**Verify:** replace M05, M06 or M07 with another contract-compatible test implementation without changing M10 sequencing. Review imports and reject direct vendor calls or split arithmetic inside workflow code.

**Residual:** the application is intentionally one process. These boundaries are maintainability and authority rules, not a sandbox against arbitrary trusted-server compromise. Do not execute model-generated code.

### C07 — Report quality can fail while every financial contract passes

**Severity:** High for the product claim. **Reference:** M08, M10 completion rules and §5 scenarios 1/6.

**Failure:** a sourced-looking but irrelevant or unsupported report is sold, then the contributor is paid and the job marked complete. A schema-valid response does not establish useful market research.

**Correction applied:** M01 defines bounded research/report requirements and acceptance. M08 collects evidence, assembles prompts and reports factual checks back to M01 rather than defining its own thresholds. Require evidence links, dates and visible uncertainty; insufficient evidence produces an M01 hold/rejection. Report delivery means a checked artifact is available to the entitled customer, not that the customer clicked accept. No mandatory human approval is added to ordinary autonomous fulfillment.

**Verify:** use brief-specific samples with missing, conflicting, old and misleading evidence; inspect actual reports for relevance and support. Check that source references correspond to retrieved evidence. A rejected report cannot trigger the normal successful-delivery payout path; paid costs and obligations still appear in remedy handling.

**Residual:** automated checks cannot prove all claims true or establish willingness to pay. Research that cannot support a report must fail visibly rather than manufacture certainty.

### C08 — The ledger can become a misleading accounting system or leak private data

**Severity:** Critical for disclosure; High for trust. **Reference:** M02/M03/M11/M12 and Money records.

**Failure:** a public UI sums NEAR, stablecoin and Cloud credits into one number, treats an estimate as final expense, exposes the private question, or loses a sale when its projection crashes.

**Correction applied:** M02 is authoritative; M11 is a rebuildable projection applying the disclosure allowlist returned by M01. Totals are per asset; USD costs are explicitly separate. Cash funding and consumption differ. Late corrections append. Private artifacts and credentials never enter public-safe payloads; rendering report/source content treats it as untrusted input.

**Verify:** reconstruct the ledger from scratch after mixed successes/failures and obtain identical totals. Include top-up/partial consumption, failed payout, late invoice cost, and refund cases. Exercise public/customer/owner access and malicious report text; public views must not expose private fields or execute content.

**Residual:** linking a transaction proves that transaction, not the truth of an off-chain report or the provider's entire bill. Do not market a centralized page as a fully on-chain audit.

### C09 — The money failure path must be deliberately small but real

**Severity:** Critical before public sales. **Reference:** M03, M05, M09–M10 and §5 scenarios 2/4/6.

**Failure:** payment arrives after kill or report generation fails after a billed request. The system has no cash available for a refund, or silently removes the contributor's due amount without reversing the sale.

**Correction applied:** preserve allocations and costs; route paid-but-unfulfillable work into a visible remedy state. Reserve needed refund exposure; reverse allocations only with confirmed refund evidence. M01 decides the remedy/allocation plan, M03 records it, M04 executes an authorized movement, and M10 coordinates the permitted sequence; no general dispute platform is needed.

**Verify:** exercise one refund path and one late-payment remedy on the selected supported route. The customer sees which asset/account receives the refund and any disclosed fee treatment; an upstream swap refund and a shop-service refund are distinct. A prior contributor payment cannot be assumed clawed back. No routine manual payout/refund can be hidden inside an alleged autonomous success.

**Residual:** exact refund currency/route and funding reserve must be frozen before public sales. If not ready, retain the controlled demo rather than expand the scope or quietly charge customers.

### C10 — Development progress and final demo success need different gates

**Severity:** High for sequencing and honest delivery. **Reference:** increments A–G, real adapter gates and §5 timed run.

**Failure:** all modules wait for the unresolved testnet/funding path, or the opposite happens: a fast fake loop is advertised as a fully live under-two-minute testnet business. UI work then hides the missing integrations.

**Correction applied:** local contracts, controlled fixtures and headless loop can progress independently. Begin provider feasibility early. Replace adapters one at a time using the same acceptance cases, then require real evidence for their claims. Keep the strict demo requirement visible and permit no automatic network substitution.

**Verify:** readiness records distinguish contract-tested, fixture-integrated, live-proven and blocked for each module. The final timer includes customer checkout through fresh report, confirmed payout and reconciled ledger. Run it three times; a recorded run is a presentation backup only.

**Residual:** official Intents has no testnet deployment; Cloud funding and final cost latency remain uncertain. These block the corresponding live claim, not the independent build. [NEAR Intents FAQ](https://docs.near-intents.org/resources/faqs), [OutLayer custody](https://app.outlayer.ai/docs/agent-custody).

### C11 — Centralizing rules must not centralize execution or duplicate decisions elsewhere

**Severity:** High for the module boundary; Critical if an executor bypasses a denial. **Reference:** plan §1, M01/M03, RulesDecision and shared verification scenario 9.

**Failure:** M01 grows vendor clients, database writes and report generation, or other modules retain their own price/cap/split checks and disagree with it. A financial snapshot also becomes stale between evaluation and application.

**Correction applied:** all business rules/calculations live in M01 as small functions within one module, driven by one config. It takes versioned facts and returns allow/deny/hold plus exact plans. M03 stores facts and applies plans; adapters execute approved actions. Technical schema/signature/storage checks stay in their respective modules. Commit/dispatch checks bind the decision to state versions and current Rules epoch; conflict requires reevaluation in M01. Rules imports no provider or treasury implementation.

**Verify:** change the daily cap, minimum price, split or report requirement only in M01/config and observe changed behavior without editing executors. Check that no other module reads config or duplicates business formulas. Inject deny/hold and stale decisions at every side-effect boundary; no permissive fallback is allowed. If Rules is unavailable, new business effects fail closed while already recorded safe ledger data remains readable.

**Residual:** central policy is a critical dependency and needs focused tests. The user requested one module, not one giant function or a new remote service. Keep that module deterministic and its external effects limited to config/decision versioning.

## Final recheck and first action

C01 is addressed in §1 and the incremental build order; C02/C04 in the journal/bookkeeping/effect protocol; C03 in separate M06/M07; C05 in M01 live safety versus frozen terms; C06 in M01 decision ownership and thin execution modules; C07 in M01 report acceptance and M08 evidence facts; C08 in M01 disclosure/access plans and read-only projection; C09 in M01 remedy rules and recorded obligations; C10 in distinct development/live/demo gates; C11 in the central Rules contract and its dependency/consistency checks. Remaining production/provider evidence is expressly not marked complete.

The only policy details to settle before their real-money use are actual prices/caps/percentages/accounts, refund treatment, and the acceptable network path. They do not prevent the first local module. No new architecture permission round is necessary to finish this planning work.

**Start implementation with M01 Rules and minimal fact/decision examples, then M02.** Test the complete required rule set in M01 before adding M03 bookkeeping or provider integrations. An early M05/M06 documentation/access probe should run alongside this work, so external limitations are discovered before the UI consumes the budget. This turn delivers planning artifacts only; it does not resume the stopped Council code.
