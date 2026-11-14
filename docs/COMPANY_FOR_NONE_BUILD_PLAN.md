# Company for none — build plan

Revision 2 · 14 November 2026 · Status: critique dispositions written; awaiting exact-hash recheck. Product implementation has not started.

## 1. Outcome and scope

Add a dedicated **Company for none** mode beside **Company for one**. The owner defines a company once, supplies its knowledge and operating constraints, and supervises its agents through an operations view. A manager delegates work, a permanent backlog agent tracks gaps, and developer agents propose tested improvements. Agents can request marketplace resources and prepare services for sale. Every consequential step has a persistent, attributable company record.

The user's organisation diagram is the interaction reference: company brief → manager and executive work → shared company intelligence → detected gap → backlog → developer → tested correction → future work uses the new revision. A persistent backlog agent is also created at bootstrap. A manager creates specialist/executive/developer agents only when an admitted task needs them.

This changes the earlier single-research-agent/product-navigation scope. It does not change M01's sole policy authority, M03's exact accounting, access controls, verified payment/credit requirements, current kill checks, or private report delivery rules. Historical plans and stores remain intact. The existing manual organisation setup remains available.

**Meaning of self-learning:** versioned improvements to company-owned agent instructions, task templates and structured workflow data, with reproducible evaluation and rollback. It does not mean training model weights, unrestricted host-code edits, or sharing private learning across companies.

## 2. Current evidence and hard limits

- Real journal, JBrain document operations/imports, bounded public URL retrieval, owner authentication and exact Rules/Treasury permits already exist.
- Agent profiles currently share a bounded research workflow. There is no durable autonomous manager/developer scheduler yet. A saved profile is not a running agent.
- Business inference now prepares the official NEAR AI SDK request before reservation and final dispatch. An actual anonymous public gateway/model preflight passed with UpToDate findings. It sent no completion and proves no paid capability.
- Current SDK E2EE response keys cannot be exported for durable plaintext replay. Strict accepted-output/delivery requirements remain unsatisfied. No model output may be silently treated as verified to make the new loop appear autonomous.
- Real 1Click quote signatures are checked. Mutable settlement/finality and Agent API money movement still lack the required independent proof; autonomous Cloud purchasing and paid supplier entitlement remain unavailable.
- Credentials, exact paid inference bounds, funded credit scopes and spending authorisations are not supplied by this task.

Implement local orchestration and truthful blocked states now. Test autonomous reasoning with isolated test ports only. Production must use the existing real SDK path; no fixture imports, canned plans, fake purchases, invented revenue or success timers in its graph. A full live autonomous company is a separate evidence milestone, not the acceptance label for metadata alone.

## 3. UX contract

### Entry and setup

Organisation setup starts with two choices: **Company for one — I assemble and manage the team** and **Company for none — agents organise the work**. Existing organisations retain their current mode until an explicit owner change; no automatic conversion or overwrite of current agents.

Autonomous setup has four steps:

1. **Company brief:** name, purpose, industry, customer, desired outcome and the first objective. No invented insurance authority or claims.
2. **Company brain:** optional JBrain documents/imports and explicit access scope. Private documents remain internal; public services require independently publishable context.
3. **Operating boundaries:** owner-approved resource limits, permitted local tools/marketplace categories, improvement targets and validation requirements. Spending defaults to zero and paid authority stays in existing protected policy/authorisation files. The owner cannot accidentally authorise payments through a descriptive brief.
4. **Create the company:** preview the manager/backlog roles and exact local effects. One idempotent commit creates these records, the root objective and lifecycle ledger entries. It does not call a model, start paid work or claim running status. Show the actual next execution gate and allow authorised operation when ready.

### Operations view — the primary autonomous screen

Keep the existing sidebar, compact type, quiet light surfaces and restrained orange action colour. Add **Company for none** as a clear navigation destination, with a selected-company name and persistent operating state.

The first viewport answers: **What is the company trying to achieve? Who is working now? What is blocked?** Its main area is a work queue grouped by current status, with task topic, responsible agent, next action, duration and evidence link. A narrow side panel shows the manager's latest recorded decision and the next blocker. A compact team lane shows the manager → backlog → specialists, with textual parent relationships available without a graph. No animated fictional activity or meaningless pulse counters.

Tabs in the same section:

| View | Required content and interaction |
| --- | --- |
| Overview / Work | Current objective; queued/running/blocked/reconciling work; agent, topic, parent task and factual last event; pause company; open task trace. |
| Agents | Manager, backlog and dynamically requested specialists; role, supervisor, profile revision, current task and real execution state; open history. Profile ready and worker running are distinct. |
| Improvements | Gap → backlog item → developer → proposed change → evaluation → applied/rolled back. Show before/after diff, failure example, regression results and affected future tasks. |
| Purchases | Resource requested by which agent and why; approved cap, amount/unit, provider operation, receipt/entitlement and status. A free skill installation is labelled free and is not a payment. |
| Services & sales | Agent-authored service draft, responsible agent, published state, real orders, delivered/held work and recorded revenue. Drafts are not sales; holds never become revenue. |
| Company ledger | Append-only private operational and financial event timeline, filters for agent/event/task, cursor pagination, causal links and exact receipt refs. Financial amounts retain their asset and units. |

Every view supports first-use, loading, empty, blocked, denied, unknown outcome and error states. A blocked task says what fact is missing and the permitted next step. No fake live badges. Refresh uses durable state, not browser counters. Poll only this view at a modest interval; preserve focus and scroll. Mobile stacks work before decision details and uses a horizontally scrollable tab row; long IDs wrap. Keyboard labels, visible focus, reduced motion, status text and a manual refresh are required.

### Improvement scenario used for validation

Use a fictional, nonbinding policy-document template. A missing middle-name field is recorded as a structured gap against an exact template revision. A developer proposes an additive schema/template change. The fixed evaluator requires first, middle and last names, retains existing required fields, rejects instructions/policy changes outside the allowed target and checks a negative case. After promotion, a later test/customer task captures the new revision. Earlier accepted tasks retain their original snapshots. This is controlled test evidence, not a claim that a live insurance business ran.

## 4. Authority and separation

All agent output and marketplace/JBrain text is untrusted data. Agents submit typed proposals; they never call provider APIs or journal mutation APIs directly. Server-side orchestration resolves company identity, actor, current task, grants and catalog revisions before M01 evaluates each command.

New Rules module `src/rules/autonomy.mjs` owns bootstrap, delegation, limits, agent lifecycle transitions, permitted resource selection, gap deduplication, patch target/transition/evaluation/promotion and owner-visible projection plans. Only M01 reads any config. `src/autonomy/` supplies facts, persists exact admitted plans and executes approved ports. M03 and existing provider code retain all financial calculations/dispatch safety.

Authority records distinguish owner intent from internal agent capability. An internal agent actor is derived from a durable admitted run and a company-bound, version-bound action scope. A request body cannot claim `owner`, `verified`, manager identity, a test pass or a provider receipt. No broad owner token is put into prompts or agent tool arguments.

An optional explicit M01 autonomy policy controls maximum active agents, delegation depth, open tasks, steps per objective, concurrent runs, retries and allowed free resource/patch categories. Absence permits owner setup/local bootstrap only; autonomous execution holds `AUTONOMY_POLICY_REQUIRED`. Limits are company-wide and include queued/running reservations; per-agent limits cannot multiply the budget. No new default monetary authority.

Company pause prevents new claims, creation by agents, paid dispatch and patch promotion; in-flight external effects remain unknown/reconciling until observed. Current kill policy is checked at each dispatch, tool mutation and promotion. Workers cannot edit Rules, allowlists, validators, auth files, secrets, wallet bindings, price/cost caps, public disclosure, arbitrary filesystem paths, shell commands or dependencies.

## 5. Durable records and minimal ports

Use the current journal and one company namespace; do not add a database or framework. All records carry schemaVersion, companyId, id, version and timestamps. Reuse existing agent profile IDs and JBrain revision references.

| Record | Core fields |
| --- | --- |
| autonomousCompany | mode, brief, objective, managerId, backlogAgentId, policy/reference, state, version; reference existing organisation record rather than replace it. |
| agentWork | actorId, parentWorkId, objectiveId, topic, kind, state, frozen contextRefs/profileRevision, commandId, attempts, lease/fence, reasonCode, resultRef. |
| agentRun | workId, actorId, lease/fence, startedAt/finishedAt, inference operation/reservation refs, status, proof/cost refs. |
| improvement | gap key, source task/event, failure evidence, targetId/revision, backlog/developer IDs, state, proposalRef, evaluationRef, promotion/rollback refs. |
| companyRevision | target kind/id, parentRevision, exact body/schema, hash, source improvement, approved evaluation and status. |
| resourceRequest | requesting agent/work, listing/revision, purpose, kind, free/paid, existing procurement operation/license refs, state. |
| serviceDraft | author agent/work, existing service listing ref, deliverable/inputs, public-context refs, state; no new settlement engine. |
| companyEvent | sequence, at, companyId, actorId/actorKind, type, taskId, causationId, actionId, prior/new revision refs, result/receipt/evidence refs, approved safe summary. |

Proposed factory `createAutonomy({journal,rules,workspace,knowledge,workflow,clock,companyId,reasoner?,evaluation?})`. Methods `view(access,query)`, `configure(input,access)`, `bootstrap(input,access)`, `pause(input,access)`, `advance(access)`, `recordGap(input,access)`, `getImprovement(id,access)`. The production reasoner delegates to a new internal-agent workflow port, using the same official SDK, charge reservations, bill reconciliation, current bounds and proof gates as existing inference. No paid call occurs in bootstrap or GET.

The reasoner returns an untrusted proposal with a bounded list of commands: `delegate`, `request_resource`, `propose_service`, `report_gap`, `propose_patch`, `complete_work`. Unknown keys/tool types and references fail closed. The evaluator executes a fixed server-owned deterministic schema/regression suite; it cannot accept model-written `passed:true`. Exact shared records/exports are frozen in contracts during phase A, not expanded into a generic agent framework.

## 6. Scheduler, effects and recovery

Journal transactions synchronously claim eligible work and write run identity/lease/fence before external preparation. External I/O occurs outside transactions. Every local mutation has an immutable action ID and input fingerprint; replay returns the committed result, changed payload conflicts. Only one active step per company initially, while multiple profiles/tasks are visible; show this capacity honestly. A small bounded worker tick runs from the existing server lifecycle and can be advanced explicitly in integration tests.

Each step re-reads current company/agent/task/policy state and emits the exact typed command through M01. A completed proposal can create child work and profiles atomically with ledger events. Reasoning success does not mean its commands were accepted. Expired local leases may resume local unsubmitted work under a new fence; submitted/pending/unknown provider operations retain the original identity and require reconciliation, never another model/transfer call. Stale workers cannot publish results or promote patches. Startup recovers unfinished work and records the reason for holds. Shutdown stops claims and preserves intents; no abandoned promise is declared complete.

Per-step inference uses actual + pending company spend, credit scopes, exact request/prepared hashes and the existing v → v+1 → v+2 permit flow. No second cost ledger or synthetic prepaid credit. Autonomy cannot switch network, model provider or security route to get past an unavailable capability.

## 7. Self-improvement and JBrain

Gaps are persisted from explicit task/tool/validation failure facts with a stable company/target/failure fingerprint. Repeated observations append occurrence references to the same open backlog item. The backlog agent receives an admitted triage task; a developer is created only under M01 limits. Their work is visible and attributable.

Developer output is a patch proposal against an exact allowed company revision. First implementation supports instruction text and structured document-template fields only; arbitrary source-code edits are outside the automatic toolset. Non-supported requested fixes remain backlog items with a precise hold. All agent text is untrusted; fixed tests and schema invariants, not another approving model, determine admissibility.

The evaluation records validator version, old/new hashes, frozen failing and regression inputs, observed outputs and results. Promotion requires all mandatory tests, unchanged target base revision, current company/policy state and the allowed patch scope. Apply with CAS and a new immutable revision; bind future work to the new revision. Existing work snapshots do not mutate. Rollback creates a new revision pointing at the prior content and emits an event; it does not delete history.

JBrain remains the company's shared knowledge store. Internal agent scope uses exact document grants/revisions. Revisions and learning summaries may be indexed via an outbox with idempotent writes; journal is authoritative for applied revision and lifecycle facts. A JBrain failure leaves a visible pending projection, never an incorrectly promoted document. Public sale definitions cannot include restricted knowledge. No cross-company default retrieval or learning.

## 8. Marketplace integration

Manager/developer agents can select existing catalog skills and independently authored SOUL profiles by ID and version. M01 checks allowed categories, local licence/entitlement and current actor scope. A free written resource can be attached locally and logged. A persona cannot expand permission or claim a real leader endorsed it.

Paid requests go through existing procurement approval/intent/receipt/entitlement states. Until a real supported vendor route and caps exist, display requested/blocked and the reason. Do not fabricate a checkout or silently use a free substitute. Agent-generated service definitions start as drafts; publication uses current activation/service policy and public-context controls. Existing orders/revenue are linked from recorded facts only. Avoid a new generic paid marketplace or generic code-execution product in this increment.

## 9. Company ledger and privacy

Append lifecycle events in the same transaction as their state changes: `agent.created`, `agent.updated`, `agent.started`, `agent.stopped`, `work.queued`, `work.blocked`, `work.completed`, `resource.requested`, `resource.installed`, purchase operation transitions, `service.proposed`, publication transitions, gap/proposal/evaluation/promotion/rollback and company pause/resume. `agent.started` means a durable run actually claimed executable work; profiles created awaiting inference remain idle/blocked. Stop events distinguish completed, paused, failed, shutdown and unknown external outcomes.

Private operational logs and public accounting projection are separate views over durable facts. All lifecycle logs are owner-accessible in **Company ledger**. They do not automatically enter the public financial ledger, expose prompts/private questions/JBrain excerpts, or imply revenue. M01 controls event/field allowlists for both views. No arbitrary JSON dump. Read pagination uses monotonic sequence cursors and bounded page size; restart does not duplicate rows. Keep ledger money totals in existing M11 projection; do not sum mixed assets or provisional cost into actual expense.

## 10. Delivery phases and ownership

| Phase | Concrete result | Gate before continuing |
| --- | --- | --- |
| A — review and contracts | This plan, independent critique, resolved findings, small records/exports/API guide and UI surface brief. | Review exact revised hash. No runtime edits before it. |
| B — local company foundation | M01 policies, idempotent owner bootstrap, manager/backlog profiles, persistent work/backlog/events and authenticated endpoints. Existing company-for-one unchanged. | Auth, CAS, limits, replay, no provider side effects; ledger privacy tests. |
| C — autonomous execution and improvement | Durable bounded scheduler, trusted internal actor capability, existing real inference port integration, typed commands, deduped backlog and tested revision promotion/rollback. | Restart/fencing/unknown/no-resend and full controlled-loop tests; live missing-proof remains blocked. |
| D — marketplace and operations UI | Free resource install, paid request/blocked states, service draft/existing-order links, autonomous setup and all six operations views. | Honest source-of-truth status, desktop/mobile/accessibility and zero secret leaks. |
| E — integration evidence | Relevant full tests, syntax/native checks, bounded browser QA, README/status/API changes and exact evidence matrix. | Distinguish local implementation, controlled test loop, real free provider proof and unproved paid autonomy. |

Coordinator owns plan/contracts/new `src/autonomy/`, app/workflow/server composition, UI, tests and integration docs. M01 changes require explicit ownership handoff from the existing Rules thread (currently done); use the same thread for review or concrete changes, never new chats. Other workers' modules remain untouched unless a concrete handoff occurs. Critique owns new `docs/COMPANY_FOR_NONE_CRITIQUE.md`. No package/dependency additions anticipated. Preserve `.runtime/product-r2-preview`, owner token, JBrain and historical ledgers; existing preview restarts only after stable integration.

Owner-only endpoints proposed under `/api/workspace/autonomy`: GET view with bounded tab/cursor query; POST configure/bootstrap/pause/advance/gaps; GET improvement detail; POST explicit rollback request. Route names and schemas documented before UI binding. No HTTP endpoint accepts a trusted SDK finding, arbitrary ledger event, arbitrary test verdict, shell code or agent-owner access context.

## 11. Acceptance checks

1. Existing organisation loads in manual mode unchanged. Owner can select Company for none, save a brief and bootstrap exactly one manager and backlog pair even after request replay/restart. Company and actor identity cannot be forged or crossed.
2. No credentials/policy: company setup, roles, backlog and ledger work; objective is blocked with its genuine cause; no transport call, paid reservation or fake agent-running event.
3. Controlled test reasoner: manager delegates a topic, specialist appears, local free skill/persona is selected by actual catalog revision, work transitions are durable and traceable. This test reasoner is never imported by product composition.
4. Gap case: repeated missing-middle-name failures map to one backlog item; developer proposal fails unsupported scope/negative tests or passes the real fixed evaluator; promotion updates future template revision, existing tasks remain frozen, rollback and revision conflict are tested.
5. Pause/kill/cap changes between planning, claiming, permit consumption and promotion block the next unsafe effect. Delegation loops, over-limit creation, forged parents and stale leases are rejected.
6. Crash/restart before/after local commit and before/after external intent does not duplicate agents/events/paid calls/purchases. Unknown inference/payment/purchase remains reconciling with pending spend retained.
7. Private operational ledger contains lifecycle/task/improvement/resource facts with causal links. Anonymous access is denied; public financial ledger does not reveal company brief, task text, private source data or lifecycle detail. Cursor/restart projections stable.
8. Purchases and sales reflect real recorded units/status only: free install != purchase, draft != published, invoice != paid, provider success != proved movement, wire proof != durable plaintext proof. No fabricated economic records.
9. Browser: company mode → brief → boundaries → manager/backlog → blocked work → trace → ledger; controlled isolated browser flow additionally verifies improvement and marketplace states. Desktop1440 and mobile390, keyboard/focus, refresh/persistence, no overflow or console exceptions. Do not seed preview financial state for screenshots.
10. Run `npm test`, `npm run check` and applicable native JBrain checks after implementation. Record exact results and version/time; existing historical 256-test snapshot is not evidence for new code. Check product import graph excludes test fixtures. No live paid test without exact separate authority.

## 12. Completion statement to use

Report what was built, which loop ran under controlled tests, what ran against real JBrain/public attestation, and what remains blocked for paid live autonomy. If actual planning, paid procurement or verified customer delivery cannot run under current provider facts, say so explicitly in UI and handoff. Do not label this full live Company for none merely because the dashboard and persisted profiles work.

## 13. Required review dispositions — binding implementation contracts

This section resolves CFN-01–CFN-09 in the independent critique. Where an earlier description is broader, this section narrows it. These are design decisions, not claims that the runtime gates or evidence are closed.

### CFN-01 — Separate internal work execution

Add `src/workflow/internal.mjs`, factory `createInternalWork({journal,rules,treasury,inference,knowledge,companyId,clock})`, with `prepare({workId,runId,fence})`, `execute({workId,runId,fence})`, `reconcile({workId})`, and `accept({workId,runId,fence})`. HTTP cannot supply request bytes, trusted actor context or result/proof findings to this port. It creates no customer order, offer, payment or delivery capability. It does not call the owner-only component runner.

The admitted work record freezes `companyId,objectiveId,workId,actorId,profileRevision,contextRefs,templateRefs,policyVersion,logicalStep,effectId,request,requestFingerprint`. Effect ID is `internal:<companyId>:<workId>:<logicalStep>` and does not contain a lease/run ID. Request is bounded GenerationRequest plus strict JSON proposal instructions. Effective instruction/catalog/template content is untrusted prompt data. Selected JBrain revisions/grants are checked before capture and again at final dispatch.

Internal execution transitions: `queued → preparing → prepared → dispatching → pending|unknown|generated → accepted|proof_held|failed`; local admission blockers use `blocked`, not success. Preparation uses the actual SDK port and records preflight/prepared-byte evidence. `agent_inference` is a separate M01 effect: explicit action-scoped live authorisation, company/policy/current bounds, fresh scoped credit, actual+pending spend, prepared preflight and current actor/fence are required; customer payment/custody readiness is not a prerequisite for internal inference. It shares M03 reservation/permit mechanics and `purpose:inference` with other inference. No new monetary defaults.

Result record separates `effectId,providerOperationId,providerStatus,costStatus,proofStatus,candidateRef,candidateHash,requestFingerprint,acceptedCommands`. Trusted actual SDK/billing observations are server-persisted. `agent_result` checks exact work/request/prepared/output binding and the same durable response requirements as current `verifyInferenceEvidence('response',...)`, then parses a bounded JSON command list. Current unavailable durable plaintext proof therefore holds acceptance and causes **zero autonomous mutations from that output**. A provider-confirmed completion or wire-only component cannot satisfy this gate. Reconcile keeps original operation/reservation and never regenerates a completion. Malformed JSON and unknown commands are preserved as rejected evidence. Cost bookkeeping uses a dedicated trusted internal-result selection and the existing exact consumption formula, without a fabricated orderPatch.

Tests cover missing authority (zero transport), malformed/oversize proposals, wrong request/work/proof, unaccepted output with valid wire signature, actual+pending accounting and original-operation recovery. Real composition never falls back to test reasoners.

### CFN-02 — Last-gate fencing and stable effects

Lease fields are `{runId,fence,leaseUntil}` on the work record, advanced only by journal CAS against the prior version using the injected trusted server clock. A run stores the admitted work/profile/policy revision. `getAutonomyFacts()` is a private Rules closure over current journal state; request facts cannot replace it.

At claim, after every awaited preparation, after the yielding permit-consumption transaction, and in the synchronous final `rules.dispatch` callback boundary, M01 checks current company state/operating mode, current work/run/fence/lease, current actor profile revision and policy epoch. Local command commits/promotions perform the same checks inside the serialized transaction immediately before state+event writes. A lease timeout invalidates A even if no B has claimed yet. Stop/retire/pause checks are current, not captured grants.

The logical effect identity exists durably before preparation and survives takeover. While preparation is in flight, a replacement may inspect/reconcile but cannot dispatch a new effect. A lost prepared callback is marked `not_submitted` only if the durable adapter intent is absent and the superseded run is fenced from all final gates; otherwise it stays unknown/reconciling. A new run never changes the existing effect action ID or infers absence from lease expiry. A taken-over prepared/submitted/unknown operation is reconciled under its original identity. Intent-before-transport and operation CAS still apply.

Required race tests stall A during preparation and specifically during permit consumption, expire/reassign its fence, then release A. Assert no stale transport callback, no duplicate effect and no stale local event/child/install/promotion. Restart after provider acceptance retains the same operation and held spend. Shutdown stops claims; it does not mark remote work canceled.

### CFN-03 — Actor matrix and policy precedence

| Principal | Allowed proposal/action scope | Explicit exclusions |
| --- | --- | --- |
| Authenticated owner | Configure/restrict brief/intent; bootstrap; start/resume/pause; change operating mode/objective; inspect private trace; request allowed rollback. | No UI-defined spend, crypto findings, test pass or policy enlargement. |
| Manager, derived from current run | Delegate within objective; request allowed catalog resources; draft known-base service; report gap; complete only with satisfied dependencies. | No owner identity, wider grants, wallet/provider calls, evaluator or policy edits. |
| Backlog agent, derived from current run | Correlate/triage company gaps; request bounded developer work for the affected target. | No purchase, publication, promotion or deletion of failure evidence. |
| Specialist | Execute assigned work, request a scoped resource or report a gap, propose completion. | No sibling access, unrestricted delegation or manager creation. |
| Developer | Read scoped failure/target context; submit exact-base instruction/template patch. | No promotion, changing tests, arbitrary source/shell or financial actions. |
| Fixed evaluator + M01 | Run mandatory tests; return evidence; admit exact CAS promotion/rollback. | Evaluator cannot grant itself actor/provider authority. |

Trusted actor scope contains company/work/run/fence, role, allowed commands/targets, allowed knowledge IDs/tool IDs and profile/policy revision. It is resolved from persisted admitted records, never accepted from body/JSON and never passed to the agent as an owner token. Child scopes are the intersection of parent scope, existing company grants and current M01 policy; a new profile inherits no restricted documents automatically. Add explicit internal knowledge access through M01; do not put internal actors into the owner setup allowlist.

Add optional validated `config.autonomy` for owner-file ceilings, separate from company UI intent. Technical fields: maximum agents, open work, depth, objective steps, objective model calls, cumulative creations, aggregate input/result bytes, retries and allowed catalog/patch categories. Strict schema rejects unknown fields; no enabled monetary fallback. UI values are validated by M01 and may only narrow these ceilings. Setup without a commercial policy permits owner metadata/bootstrap/inspection and a paused/blocked objective, not internal paid work. Test forged/stale/cross-company actors, broader child grants and developer attempts to promote/edit Rules.

### CFN-04 — Aggregate admission and termination

Objective counters persist admitted steps, attempted model calls, cumulative agent creations, input bytes, result bytes and retry/no-progress counts, including failures and superseded work. They do not reset on refresh, pause/resume, midnight, retirement or lease takeover. New objectives get new IDs; old obligations, actual costs and pending reservations remain in common M03 accounting. Reject unbounded objective replacement while unresolved work exists. Count and bound proposal bytes before parse/storage; raw provider capture retains existing bounded private-artifact limits.

All inference paths (customer, component and internal) use one shared M01 admission check over the same open `purpose:inference` reservations, excluding only the exact current action during dispatch. Initial paid capacity is one active/unreconciled call per company, persisted rather than a process flag. Preparation alone grants no paid slot. The same spend calculation covers all actual and pending costs across paths; no separate autonomy credit/cost balance. The local scheduler also allows only one active claim, derived from durable leases.

Command batches are **individually admitted** in order, with IDs `<workId>:<logicalStep>:command:<index>` and the original command hash. Record each admitted/rejected outcome; replay does not reapply earlier commands. A later denial cannot erase earlier accepted state. Freeze the entire candidate hash before command admission. Unknown command kinds reject the candidate before any command runs.

Parents enter `waiting` for mandatory child work. Completion requires a recorded deliverable and all mandatory children/effects accepted/reconciled, not a model assertion. Failed/blocked children produce explicit parent waiting/blocked/failure facts; no automatic successful no-op. Reject ancestor target/topic cycles; repeated identical proposal/failure fingerprints consume bounded retries and then hold `NO_PROGRESS`. Exhausted budgets hold with evidence. Cancellation/supersession stops new claims and leaves original unknown effects reserved/reconciling. Test shallow repeated delegation, A→B→A, batch partial denial/replay, customer/component overlap and unresolved cost across UTC rollover.

### CFN-05 — Fixed baseline/candidate evaluation

Automatic promotion initially supports `template.add_optional_field` and `template.require_field` on registered company-owned structured document templates. Patch format names exact target/head and additive field descriptors only; no paths/code, removal of prior required fields, evaluator/test edits or permission changes. Required field names come from a server-registered template contract and confirmed gap scope; the fictional middle-name example is one explicit demo/test contract, never an insurance/business rule applied to everyone.

The evaluator runs both baseline and candidate against the same immutable server-owned mandatory cases and invariants. Evidence binds `targetId,baseRevision,oldHash,newHash,evaluatorVersion,evaluatorHash,testSetHash,inputHashes,observedBaseline,observedCandidate,policyVersion`. M01 selects trusted persisted evaluations through the private closure; HTTP/model `passed:true` is never evidence. Require an observed relevant baseline failure, candidate repair and unchanged mandatory regressions. Recheck exact hashes and current head at promotion.

Instruction text edits can be proposed/diffed but stay `owner_review`/`EVALUATOR_REQUIRED` unless an adequate fixed acceptance suite exists. Syntax or forbidden-word matching does not claim semantic improvement. Real model-dependent regression work needs the same authorised paid/proof path; no free fabricated verdict. Negative tests remove existing fields, alter the test set/candidate, forge findings and reuse stale evaluation. Rejected proposals remain in the ledger.

### CFN-06 — Effective revision resolver and JBrain authority

Add `resolveEffectiveContext` as the single admission-time resolver used by both new internal work and existing workspace task context. It captures profile revision/instructions, catalog skill/persona version+content hash, and each registered shared company template head/hash/body. A shared template is company-wide only because these actual consumers resolve it. Profile instruction targets affect only that named profile. Task records retain immutable context snapshots; a later fix affects only later admissions, unless an explicit replan supersedes a queued task.

Template promotion atomically CAS-updates `companyTargetHeads[targetId]`, stores immutable revision+evaluation and emits the ledger event. Rollback creates a new revision/head through the same resolver. Ordinary source documents remain JBrain-authoritative and grant-checked; applied structured templates are journal-authoritative. Pending JBrain indexing is a projection, never the source for the active template. Avoid implementing ordinary JBrain document mutation as an automatic fix in this increment.

An optional template-summary outbox uses stable target/revision IDs, expected JBrain revision and original operation ID. Unknown writes query the original operation; no overwrite/retry with a new identity. Reordered or conflicting writes remain visibly blocked and cannot move the journal head or grants. If indexing is not needed for current consumers, cut it from the first milestone and display the journal revision directly; do not add an inert outbox. Test later/earlier context, rollback, revoked grants, catalog-content changes and restart without a projection.

### CFN-07 — Operating lifecycle independent of execution mode

Use `operatingMode:'one'|'none'`; preserve runtime `executionMode:'setup'|'fixture'|'live'` and economic identity unchanged. Owner configuration/version CAS selects mode. Autonomous state is `draft|paused|ready|blocked|running|completed`; no model/provider starts during mode selection/bootstrap. Add explicit owner `start`, `pause`, `resume`, `replaceObjective` and `switchMode` operations, each with idempotency/version and Rules decisions. Automatic server ticks only act after an explicit start/resume request and current policy admission. The server may run without a connected browser, using the durable company intent rather than impersonating its owner.

Bootstrap manager/backlog IDs are stable company-derived records. Existing manual profiles are not recruited implicitly. Specialists are reused only when role/scope/revision fit; retirement requires no active/dependent/unknown work and preserves lifetime creation counters/history. Switching to one pauses new autonomous claims; pending effects remain reconciling. Switching back does not reset limits or issue another bootstrap. Resume cannot reopen exhausted/completed objectives. Replacement creates a new objective only after old local work is stopped and unknown effects/dependencies remain traceable/held; it does not create money headroom.

Autonomous four-step readiness is evaluated independently from old manual six-stage setup. Brain is optional at bootstrap; tasks needing unavailable/ungranted documents hold precisely. Test both modes with preexisting profiles, no documents, refresh/restart, pending effects and exhausted limits.

### CFN-08 — Narrow commerce bridge and original events

Service drafts may reference exactly one current static base service (`service.kind==='service'` from existing catalog), freezing base version/hash, proposed title/inputs/deliverable and public context IDs. No custom executable tool/provider is created. Publication requests go to an explicit M01 transition; first product state is `blocked:AUTONOMOUS_PUBLICATION_UNAVAILABLE` until immutable accepted terms can use the current service-order path without substitution. Show draft details and that blocker, not a live Buy button. Existing manually activated services/orders remain factual links under Services & sales.

Free resource requests install the exact admitted catalog revision through a local transaction and event, never through fabricated procurement. Paid requests reference original existing procurement intent/provider operation/entitlement records; lack of a real supported vendor keeps them blocked. No request becomes installed from a mode flag or unsigned claimed licence. A persona changes guidance only.

Company view joins original order, adapter-operation and M03 journal-event IDs with actor/work references. It may project their statuses; it does not create alternate sale/receipt/credit mutations or duplicate monetary totals. Company lifecycle events remain private. Anonymous/public financial projection keeps its existing exact allowlist; internal trace text/refs are not added to it. Test base catalog revision changes, forged entitlement, unknown operation and no-sale drafts.

### CFN-09 — Capacity, milestones and cut lines

One coordinator integrates; existing Rules thread may implement a clearly assigned M01 change after this review, with no new chat and no overlapping ownership. Initial capacity is one durable local work claim and one common unresolved inference slot per company. These are scope/effort estimates, not a deadline promise:

| Milestone | Estimate / owner | Exit and permitted cut |
| --- | --- | --- |
| M1 owner foundation | 1–2 focused implementation sessions, coordinator with M01 ownership handoff | Mode/setup/bootstrap, durable blocked root work, private ledger+trace, auth/CAS/restart. Do these before decorative tabs. No autonomous success claim. |
| M2 controlled loop | 2–3 sessions, coordinator + exact M01 work | Actual claim/fence/typed-command/gap/evaluator/resolver loop with isolated test reasoner; negative races and improvement persistence. Narrow to structured templates; instruction promotion and JBrain summary indexing remain held/cut. |
| M3 real internal reasoning | Integration session plus external gate work, coordinator/M07 under handoff | Real SDK prepared inference and accepted durable proposal proof with exact authority/bounds/credit. Port implementation may complete now; actual accepted reasoning remains blocked while G6/credentials are absent. No substitute route or simulated production result. |
| M4 real commerce autonomy | Separately bounded vendor work after exact approval, integration owners | Actual verified purchases/entitlements, published sale/settlement/refund/payout loop. First UI projects genuine drafts/requests/existing records; full live milestone remains open. |

The reviewed implementation task proceeds through M1/M2 plus the real M3 port and M4 truthful views. Final report names each delivered/blocked milestone; it does not call M3/M4 complete from local test evidence. If a new external blocker prevents actual live work, continue independent local implementation and report that exact gate without another generic permission request.
