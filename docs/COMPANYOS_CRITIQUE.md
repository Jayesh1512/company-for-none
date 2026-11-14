# CompanyOs — independent critique

> Naming update: project labels and document paths use CompanyOs. Recorded review hashes refer to the original revisions in Git history.

14 November 2026. Review of the complete 152-line revision 1 of `docs/COMPANYOS_BUILD_PLAN.md`.

Reviewed SHA-256: `fd9821cc2bfd52f4dc82a78e97f8472fecb2aead7449678b5b932c7c2106ccf1`.

## Verdict

**READY WITH CONDITIONS for reversible local implementation after the required dispositions and exact-hash recheck. Strict live autonomous company: BLOCKED by the existing execution/economic proof gates.**

The plan is a defensible extension of the current workspace. It preserves the manager/backlog/developer loop the user asked for, limits automatic fixes to company-owned data and instructions, keeps business policy in M01 and money in M03, and distinguishes controlled tests from actual production reasoning. A missing paid capability should block the affected work; it need not prevent building the local mode, durable queue, private ledger and fixed evaluator.

The remaining material weaknesses are connections between the proposed pieces: the internal execution contract, authority at the last dispatch, termination and budgets, how tests establish a safe improvement, and how an applied revision actually changes later work. Generic promises of leases, validation and existing integration reuse are not sufficient contracts for those connections.

No implementation is approved by this review request itself. Incorporate the required changes, record their dispositions, and recheck the revised hash before runtime edits, as the user specified. No new chats, workers, runtime files or provider calls were used for this review. Only this new critique file was written.

## Current-code basis

I inspected `src/app.mjs`, `src/workspace/index.mjs`, `src/workflow/index.mjs`, `src/research/index.mjs`, the Rules/config/runtime/component paths, journal transactions, company knowledge grants/revisions, public ledger and server recovery. The public Cloud preflight and prepared SDK business integration are present; they are not assessed as missing. The production graph has already removed fixture providers. I did not rerun tests or use historical test counts as acceptance evidence for this new mode.

Important existing constraints:

- Workspace tasks currently become research **orders**, with customer capabilities and offer/payment/research requirements (`src/workspace/index.mjs:24`, `src/workflow/index.mjs:11`). They are not a general internal task runner.
- The research prompt requests report text, not typed manager/developer proposals (`src/research/index.mjs:33`). The owner-only Cloud component is a one-shot, wire-only proof and cannot become accepted agent output (`src/rules/components.mjs:10`, `src/runtime/components.mjs:71`).
- Current final dispatch refreshes customer order/agent state; it does not know an autonomous work lease/fence (`src/app.mjs:55`). Journal CAS and operation identities provide a useful foundation, not a scheduler automatically (`src/journal/index.mjs:102`).
- Workspace and knowledge mutation paths expect verified owner access. Config validation rejects unknown policy keys (`src/rules/index.mjs:111`, `src/rules/config.mjs:46`, `src/rules/knowledge.mjs:8`). A trusted internal actor must be added deliberately rather than impersonating the owner.
- Existing profiles/skills and context are captured directly from workspace/catalog/JBrain records (`src/workspace/index.mjs:28`). A new revision record alone will not change that behavior.

## Required findings and dispositions

### CFN-01 — High: define an internal work execution port, distinct from orders and component proofs

**Plan reference:** §§2, 5–6, especially lines 89–99; phase C. **Code reference:** `src/workspace/index.mjs:24`, `src/workflow/index.mjs:14`, `src/research/index.mjs:33`, `src/rules/components.mjs:10`.

**Unsupported assumption:** Reusing the existing SDK/charge gates supplies an internal manager workflow. The current business path expects a paid order and report output; the component path requires owner access and explicitly grants no accepted business output. Neither can simply be renamed to a manager run.

**Failure / impact:** Bootstrap creates profiles that cannot execute their first objective without a fake sale, fabricated owner context or bypass of G6. Alternatively the implementation parses report text as commands and promotes unverified output into delegation or changes.

**Required disposition:** Freeze a small internal port in phase A. Its input must bind company/objective/work/run, actor and profile/context revisions, policy version, exact bounded request and effect identity. Its output must separately identify provider generation status, original operation, cost/proof status, candidate proposal bytes/hash and accepted typed commands. Define preparation, dispatch, reconciliation and accepted-result transitions. Reuse the real SDK and M03 reservation mechanics; create neither an order nor synthetic credit. Internal paid work can require the relevant inference/credit/security gates without requiring a customer sale or payment route. It must still require accepted durable output before a proposal causes autonomous mutations; the wire-only component does not qualify.

**Verification / exit:** With no inference authority/proof, bootstrap produces an idle/blocked objective and zero provider effects. Under isolated test ports, a manager proposal is accepted only after the required result/binding checks; malformed JSON, unknown commands and mismatched work/proof are rejected. No paid-order/customer capability is invented. Product composition uses the real port and a truthful blocked result until G6 is solved.

### CFN-02 — Critical: fence external dispatch and preserve effect identity across lease takeover

**Plan reference:** §6 lines 95–99; acceptance checks 5–6. **Code reference:** `src/app.mjs:55`, `src/custody/adapter-runtime.mjs:41`, `src/journal/index.mjs:102`, `server.mjs:40`.

**Unsupported assumption:** Rejecting a stale worker's eventual result prevents its external effect. A lease may expire while an old worker awaits SDK preparation or permit consumption. A replacement may then issue new work under a different run/fence while the first worker still reaches the provider.

**Failure / impact:** Two paid calls or purchases execute for one task. Refusing the first worker's later commit does not recover its money, and may hide the original operation from the new run.

**Required disposition:** Define the fence check at claim, after asynchronous preparation, after permit consumption, and immediately before the provider transport or local mutation. M01 must receive trusted current work/run/fence/lease/company/agent facts at that last gate. Use one durable external effect identity per admitted logical work step, independent of worker lease ownership. Lease renewal/takeover needs CAS and a trusted server clock. A new fence cannot replace an existing prepared/submitted/pending/unknown effect: reconcile that original first. If preparation is lost before submission, define an evidence-backed not-submitted transition rather than assuming it is safe from lease expiry alone. Keep shutdown reconciliation and accepted-effect observations available while new claims stop.

**Verification / exit:** Stall worker A before dispatch, expire/take over its lease with B, then release A. Repeat specifically across the yielding permit-consumption boundary. Exactly one admitted original effect can reach the transport. Crash after provider acceptance but before result/transition; restart must retain that identity and reservation. Stale fences cannot commit events, child tasks, installs or promotions. Local pause/kill does not claim that already accepted remote work was canceled.

### CFN-03 — High: make the internal actor and policy-source boundary explicit

**Plan reference:** §3 operating boundaries; §4 lines 66–72; factory/API in §5 and line 135. **Code reference:** `src/rules/index.mjs:19`, `src/rules/index.mjs:118`, `src/rules/knowledge.mjs:8`, `src/workspace/index.mjs:12`, `src/rules/config.mjs:48`.

**Unsupported assumption:** A durable run plus a role string is a sufficient authority record, and UI operating-boundary configuration can be interpreted independently of existing policy. Current mutation APIs are owner-oriented; widening their read-only/owner sets is an easy but unsafe shortcut.

**Failure / impact:** A specialist delegates an unrestricted manager, grants itself documents or installs an unauthorized capability. An HTTP body constructs a plausible internal actor, or the configure screen becomes a second policy source that enlarges file-defined authority.

**Required disposition:** Add a compact capability matrix: owner configures/bootstraps/controls mode; manager delegates and requests resources/services; backlog records/triages gaps; developer proposes changes; only the fixed evaluator and M01 authorize promotion. Derive actor capabilities from the current admitted run in trusted composition, binding company, work/fence, role, allowed command/target scope and effective policy/profile version. Keep this authority out of prompts and request bodies. Document owner-file ceilings versus owner UI intent: UI choices can restrict or select allowed operations, never enlarge monetary, grant or patch authority. Update the strict M01 config schema deliberately if an autonomy block is added. All new defaults are local setup-only. Child knowledge/tool grants are a permitted subset of parent and company grants; newly created profiles get no implicit whole-company access.

**Verification / exit:** Forge owner/actor fields, use a stale run/profile/policy, cross companies, reassign a child, and request broader document/tool grants. Deny each outside its exact scope. Test that a developer cannot promote, edit validators or call wallet ports. Owner setup without a funded permit remains usable; an agent cannot obtain the same authority by copying owner-context fields.

### CFN-04 — High: define aggregate admission, dependencies and stopping conditions

**Plan reference:** §4 line 70; §5 proposal batch; §6; §7 gap deduplication; acceptance 3–6. **Code reference:** `src/rules/policies.mjs:74`, `src/rules/components.mjs:35`, `src/workflow/index.mjs:12`.

**Unsupported assumption:** Maximum depth/open tasks plus one local runner bound an autonomous company's cost and progress. A shallow manager can repeatedly create new tasks after old ones finish, repeatedly retry an identical failed proposal, or saturate all slots with blocked children. The existing research runner and component runner also have work and pending spend.

**Failure / impact:** Delegation consumes the company's allowance without useful progress; the manager declares success while children/costs remain unresolved; or separate schedulers each believe they own the single available slot.

**Required disposition:** Specify cumulative admitted steps/calls/creations and aggregate input/result bytes per objective, including failed attempts and retries, alongside current active/open counts. Apply spend caps to actual plus pending work across all customer/internal/component paths, using the existing M03 records and common inference credit reservation category. State how a single-company execution slot is shared with existing workflows; process-local flags alone are insufficient. Define parent waiting, child success/failure/blocked aggregation, canceled/superseded work, exhausted limits and no-progress/cycle detection. Parent success must follow its declared deliverable and dependencies, not a model's `complete_work` alone. Persist useful disagreement/failed validation as evidence; bounded manager retries cannot erase it. Freeze whether command batches are all-or-nothing or individually admitted with deterministic per-command IDs and visible rejection outcomes.

**Verification / exit:** A→B→A loops, repeated identical proposals, many shallow children, one unknown billed call, a concurrent customer/component job, midnight rollover and task-slot exhaustion cannot increase headroom or create unlimited work. Test partial batch denial and replay. The parent remains waiting/blocked/failed when mandatory children or effects are unresolved, with a clear operator next action.

### CFN-05 — High: bind evaluation to trusted tests, exact candidate and baseline

**Plan reference:** §3 example; §5 line 91; §7 lines 105–107. **Code reference:** no current improvement evaluator/revision subsystem; existing report checks in `src/rules/policies.mjs:175` are not that evaluator.

**Unsupported assumption:** A fixed evaluator version plus a stored pass result demonstrates a safe company-wide improvement. If a developer chooses all tests or the evaluation accepts client-supplied inputs/results, it can overfit a single example. Deterministic string/schema tests also cannot establish that arbitrary instruction edits improve judgment.

**Failure / impact:** A patch adds the sample field but removes a different required field, weakens a workflow, or passes by altering the test inputs. The company labels itself improved although later tasks regress.

**Required disposition:** Freeze the supported patch operations/targets and mandatory server-owned regression cases outside the patchable data. Run baseline and candidate against the same frozen validator/test-set versions and inputs. Bind the observed results to exact old/new hashes, target/base revision, evaluator and policy; promotion verifies those bindings and current head. Start automatic promotion with the narrow structured-template change whose invariants can actually be tested. Instruction changes need an explicitly adequate fixed acceptance set; otherwise keep them proposed/held for owner review. No claim that a field test proves general instruction quality. Keep the middle-name case an explicit fictional schema requirement, not a universal rule for real people or a real insurance authority.

**Verification / exit:** A real deterministic evaluator observes baseline failure and candidate repair while mandatory regressions still pass. Reject forged `passed:true`, substituted candidate/test data, changed validator/base revision, removal of existing required fields and unsupported operations. Include a negative candidate that superficially fixes the named example while breaking another case. Preserve rejected evidence and never promote a stale evaluation.

### CFN-06 — High: connect revision promotion to actual future context and define outbox authority

**Plan reference:** §§1, 5 and 7, especially lines 107–109. **Code reference:** `src/workspace/index.mjs:28`, `src/workspace/index.mjs:43`, `src/knowledge/index.mjs:49`, `src/knowledge/index.mjs:66`.

**Unsupported assumption:** Writing a `companyRevision` and indexing it in JBrain causes company-wide adoption. Current work captures profile instructions, catalog guidance and canonical JBrain documents directly. These consumers do not resolve a new applied revision head.

**Failure / impact:** The ledger says a fix was promoted, while later tasks still read old content. Or an outbox writes an older revision over a newer owner edit and unversioned context silently changes queued work.

**Required disposition:** Define one effective-revision resolver for each supported target. Promotion atomically changes the active target head with CAS, records the evaluation and event, and makes later admissions capture that exact head/hash. Specify whether target scope is a shared company template or one profile; company-wide behavior must name the actual shared consumer. Freeze catalog/persona/skill revisions and content hashes too. Keep existing tasks immutable unless explicitly superseded/replanned with new authority. If the journal is authoritative for company templates, tasks must not read a stale JBrain projection as the active template; JBrain remains authoritative for ordinary company documents. Outbox writes need target/revision identity, CAS and unknown-result reconciliation. A projection conflict is visible and cannot silently change grants or repair itself by overwriting current content.

**Verification / exit:** After promotion, newly admitted work uses the new revision; earlier work uses its original snapshot. Restart with a pending projection, reorder two outbox deliveries, edit the JBrain document concurrently, revoke a grant, then roll back. No stale overwrite, implicit broadened access or duplicate promotion occurs. Rollback creates a new head and affects future work through the same resolver.

### CFN-07 — High: distinguish company operating mode from provider mode and specify lifecycle controls

**Plan reference:** §§3–5, phase B; acceptance 1 and 9. **Code reference:** `src/runtime/providers.mjs:39`, `src/rules/setup.mjs:3`, `src/workspace/index.mjs:34`, `src/workspace/index.mjs:43`.

**Unsupported assumption:** A new `mode` field and pause method are enough to coexist with manual setup and the current setup/live/fixture binding. The four autonomous steps also differ from the existing six-step manual requirements. The proposed method/API lists do not clearly provide resume, objective completion/replacement, or agent retirement behavior.

**Failure / impact:** Choosing CompanyOs attempts to change the economic store mode, duplicates the bootstrap pair, overwrites existing agents or continues background work after switching back. Resume may require a fake second bootstrap or reopen an already exhausted objective.

**Required disposition:** Name the independent operating mode explicitly (`one`/`none` or equivalent) and retain execution mode/economic identity unchanged. Define owner start/resume/pause and manual↔autonomous transitions, with versions and policy gates, including unknown effects. Existing manually created profiles are not automatically assigned internal authority. Keep manager/backlog identities stable on bootstrap replay; decide which specialists are reused/retired and ensure they consume limits honestly. Autonomous onboarding derives its own actual readiness from four steps; optional company documents do not become mandatory through the old six-step reviewer. Objective replacement cannot erase costs, counters, outstanding dependencies or prior evidence.

**Verification / exit:** Switch modes and pause/resume across refresh/restart, with existing manual agents, a pending effect and an exhausted objective. No agent/event duplication, ledger reset, economic rebinding or unauthorized worker claim. Both setup flows remain usable. Empty-brain setup is supported as specified; any task needing documents receives a concrete hold.

### CFN-08 — High: define the actual marketplace/service bridge instead of assuming new drafts execute

**Plan reference:** §§5, 8–9; phase D and acceptance 8. **Code reference:** `src/workspace/index.mjs:16`, `src/workspace/index.mjs:43`, `src/workspace/catalog.mjs`, `src/rules/business.mjs:31`, `src/rules/index.mjs:139`.

**Unsupported assumption:** An agent-authored service draft or purchase request can reuse current catalog activation/procurement without a contract change. Listings are currently static, and live procurement is deliberately denied. The proposed company ledger also needs to observe real provider transitions that happen outside the autonomy module.

**Failure / impact:** A draft looks purchasable but published terms do not match it; a resource is marked installed without actual entitlement; or existing purchases/sales and pending costs are missing from the company view. Relabeling a free instruction install as procurement would manufacture activity.

**Required disposition:** Initially permit service drafts against one known catalog base listing and record exact proposed inputs/deliverable/revision. Publication must be an explicit M01 transition with immutable active terms and public-context checks; where the existing static path cannot support the draft, show publication blocked rather than displaying a working storefront. Only enable paid resource execution when the actual vendor/delivery contract and caps are established. Reference existing M03/provider events and orders by stable IDs in the company view; do not create a parallel purchase/sale state that invents confirmations or duplicates money totals. Make all lifecycle/work/resource/financial facts owner-visible even when requests stay blocked. Public accounting keeps its existing narrow disclosure policy.

**Verification / exit:** Free install, blocked paid request, draft, publication denial, invoice, observed payment, failed/unknown operation and final receipt remain distinct after restart. Test an actual catalog revision change and a claimed entitlement with no receipt. Ledger rows link the original actor/work/effect and cannot turn a request or mode flag into revenue. Anonymous/public projections reveal no company brief, source excerpt, private operational summary or raw evidence.

### CFN-09 — Medium: stage the delivery by available capacity and measurable truthful outcomes

**Plan reference:** phases A–E and §12. **Code reference:** the new autonomy/evaluator/scheduler subsystems do not yet exist; current `server.mjs:40` runs only workflow and knowledge recovery.

**Unsupported assumption:** One coordinator can deliver a scheduler, internal inference port, evaluation/revisions, commerce bridge and six UI tabs as one undifferentiated increment. The plan lists owners and phases but no effort assumptions, capacity or cut lines.

**Failure / impact:** Screens and metadata are completed first and presented as an autonomous company, while the manager never reasons or improvements never affect later tasks. The true provider blockers become difficult for the owner to distinguish from unfinished implementation.

**Required disposition:** Add estimates and explicit milestone labels: (1) owner setup/private operational foundation; (2) controlled-test delegation/evaluation/promotion loop; (3) actual verified internal reasoning; (4) verified procurement/sales/payout autonomy. One initial runner is appropriate. Integrate the phase-B private ledger and narrow work trace before expanding every tab. Treat the missing real inference output as a real step blocker, not a successful no-op. Preserve paid/support gates without making unrelated local setup depend on them. Developer automatic fixes remain scoped company data/template changes; the UI must state when requested runtime/source-code fixes are unsupported.

**Verification / exit:** Each milestone has a named available owner, realistic range, dependency and stop/change decision. Local browser checks prove setup→blocked objective→trace/ledger. Controlled tests prove the whole gap/fix loop with actual fixed evaluation, not a seeded pass result. Real provider evidence is separately labeled; full live completion remains blocked until it actually exists. No new deadline or score promise is inferred from this review.

## Requirements already handled well

- Dedicated mode and manager/backlog bootstrap match the latest direction; keeping manual setup is a strength.
- No automatic host-code edits, arbitrary shell, dependency changes, policy editing or cross-company learning are needed for this first increment.
- Marketplace text remains untrusted guidance, not permission. Free content is real content; it need not masquerade as an external tool or paid expert supply.
- The private company ledger versus public financial ledger separation is correct. Keep exact per-asset financial facts in the existing projection and lifecycle events in an authenticated view.
- Existing journal CAS/atomic commits, M01/M03 dispatch and accounting, native JBrain and SDK evidence capture are useful building blocks. They do not by themselves close the new scheduler/actor/evaluator contracts.
- Current G6, spendable settlement/refund, independent movement, Cloud acquisition and supplier-entitlement gates are correctly acknowledged. No additional vendor research or provider call is necessary to finish this planning review.

## Required disposition before exact-hash recheck

Record CFN-01–CFN-09 in the plan with the exact contract/phase/test that addresses each. At minimum freeze the internal-work state/output contract; actor/action matrix and policy precedence; last-gate fence/effect identity; cumulative company budgets and dependency/termination rules; trusted evaluator/promotion bindings; effective revision resolver; mode/lifecycle transitions; and narrow commerce/event bridge. These are small explicit decisions within the proposed modules, not a request for a generic agent framework.

A disposition saying “existing code handles this” needs the actual relevant path and remaining adaptation; the current customer-order and owner-component paths cannot stand in for the new internal runtime. A plan correction is not implementation/evidence closure. After recheck, reversible local implementation may start under the stated gates; real paid autonomy remains a separate milestone.

## Residual risks and user-facing decisions

The user need not give another general architecture approval to implement the reviewed local scope. Preserve the explicit limit that developer agents initially propose company instruction/template/workflow-data changes; broader host-code repair would require a different scope and trust model. Any later paid execution needs exact approved credentials/account/network/limits. A change of Cloud security route or commercial service offer must remain explicit.

Even a fixed evaluator can overfit its examples; versioned guidance is not model training or proof of general intelligence. Growing append-only histories need practical size limits, and independent providers can keep work unknown. These risks should remain visible rather than being hidden by a running-agent badge or a local test-loop success.

## Revision 2 exact-hash recheck

Rechecked the revised plan at SHA-256 `f9d94ac4486a9d7f4a358476b3e90a5385fd0e8e1848c24ddb5324460af30c0f` on 14 November 2026. Section 13 explicitly narrows earlier descriptions and addresses all CFN-01–CFN-09 findings. I checked the internal work/result contract, stable effect identities and last-gate fences, trusted actor matrix/policy precedence, cumulative limits/shared inference admission, fixed baseline/candidate evaluation, both effective-context consumers, operating-mode lifecycle, blocked publication/original commerce joins, and the four milestone/capacity decisions.

**Verdict: READY WITH CONDITIONS to begin the authorized reversible implementation. No unresolved planning blocker or new generic permission round.** Implement M1/M2, the real M3 port and truthful M4 views under these binding contracts. The conditions are the specified runtime checks, negative tests and evidence gates; the findings are resolved at planning level, not closed in implementation.

In particular, instruction edits remain proposed/owner-review until an adequate evaluator exists; lease takeover cannot change a logical effect identity or bypass the final fence; internal actors cannot impersonate owners; and company revisions must reach actual future context consumers. Preserve these restrictions when integrating, rather than substituting an easier test-only shortcut.

**Strict live M3/M4 completion remains BLOCKED** by accepted durable inference/proposal proof, credentials/bounds/credit authority and the existing commerce/entitlement/movement/refund gates. Public attestation or a controlled autonomous loop cannot satisfy those milestones. The user has already authorized implementation following resolved review, so the coordinator can proceed now within the reviewed scope. No runtime files or provider calls were changed/made by this recheck; only this critique was updated.

## Bounded implementation finish review — 14 November 2026

**Verdict: READY WITH CONDITIONS for continuing reversible integration; NOT READY to declare the reviewed M2/M3 port finished until the remaining high findings below pass their exits.** The owner setup/private operations milestone is substantially implemented. This review found functional recovery and input gaps, not an observed bypass of the paid/output-proof boundary. Strict live M3/M4 remains blocked independently of these local corrections. Implementation remains authorized; this is not another permission round.

The plan still matches SHA-256 `f9d94ac4486a9d7f4a358476b3e90a5385fd0e8e1848c24ddb5324460af30c0f`. Runtime was actively changing during this review; findings identify the inspected functions and original line anchors rather than treating this as a frozen release certification. Only this critique was edited by the reviewer.

Evidence independently checked: current coordinator/M01 source and contracts; **17/17 focused tests, zero skips**, using `node --test test/autonomy/*.test.mjs test/rules/autonomy*.test.mjs`; two isolated recovery probes; an installed-persona context probe; and the supplied desktop/mobile screenshots plus `artifacts/companyos/browser-proof.json`. Tests/probes use temporary isolated stores, with no provider calls. The focused result predates the subsequent corrective handoffs and is not the coordinator's final broad-suite result.

The controlled loop is useful evidence: actual journal transitions, dependency handling, fixed baseline/candidate tests, promotion and restart run in real modules. However, `test/helpers/autonomy-fixtures.mjs` supplies an explicitly synthetic accepted-proposal port, bypassing internal inference/preparation, and its proposal callback can read the full journal/catalog. It cannot establish that the real agent receives usable inputs, that paid reservations reconcile, or that an original provider result resumes after a crash. Keep that distinction in the handoff.

### CFN-F01 — High: repeated original observations conflicted instead of reconciling

**Plan:** §13 CFN-01/02/04, original-operation recovery. **Inspected code:** `src/workflow/internal.mjs`, `observe` (original lines 14–18).

**Unsupported assumption / failure:** A deterministic result ID could include a fresh timestamp in its immutable transaction fingerprint. The same unknown result returned one second later reused the action identity with changed `observedAt`. An isolated probe reproduced `CONFLICT: Action identity reused with different contents`. Normal repeated polling or restart would therefore stop reconciliation even when the provider had done nothing new; held work and money could remain stuck.

**Small correction:** Preserve the first exact observation for the same effect/result identity. Do not change its timestamp or overwrite its original request/run provenance. A changed result gets a new observation; repeated bookkeeping still rechecks current accounting.

**Status:** Coordinator changed `observe` to reuse the persisted record. Reviewer reran the original same-result/later-time probe successfully: one record, original timestamp retained, no conflict. **The specific in-process defect is verified fixed.** The promised time/restart regression and final integrated evidence still belong in the coordinator handoff.

**Exit:** Poll an identical pending/unknown result repeatedly, close/reopen the store and poll it again; then observe a changed final/cost result. Assert no conflict, one immutable record per distinct result, original effect identity, no repeated provider submission and no duplicate cost settlement. Do not replace this with a test that changes the result on every poll.

### CFN-F02 — High: safe fences exist, but expired work lacked a usable recovery transition

**Plan:** §13 CFN-01/02/07, stable effects, no-submission recovery and current scope after restart. **Inspected code:** `src/rules/autonomy.mjs`, `claim` (original lines 201–221); `src/autonomy/index.mjs`, `advance`; `src/workflow/internal.mjs`, `prepare/execute/reconcile`.

**Unsupported assumption / failure:** Refusing a stale dispatch is enough to recover its work. In an isolated probe, claim a work item, advance the trusted clock 30,001 ms with **zero adapter operations**, and claim again: work stays `preparing` with `RECONCILE_REQUIRED`. No original operation exists to reconcile. A crash after claim or during preparation can permanently block an objective. Separately, the original reconcile path only observed status/cost and did not re-enter strict result acceptance. `proof_held` and accepted-but-expired work also need explicit treatment; they are not ordinary new inference.

**Small correction:** Add the narrow M01 recovery transitions already promised in the plan. Distinguish (a) no durable provider intent, with the previous run definitively fenced, from (b) an original submitted/pending/unknown operation and (c) a durably known result awaiting current acceptance/remaining commands. Preserve logical effect and frozen request identities. A fresh recovery frame may accept/finish an existing verified result after current company/profile/policy/grant checks; it must not acquire permission to generate again. Immutable observation provenance must remain separate from the authority of the new recovery frame. Handle pause/resume and an expired accepted batch without reapplying its completed commands. Bound/renew preparation leases explicitly if needed; never infer non-submission from timeout alone.

**Status:** Open at this finish snapshot. Coordinator added strict acceptance under a still-current lease and an explicit `CURRENT_RECOVERY_SCOPE_REQUIRED` hold otherwise; M01 recovery transitions are being implemented. That is a truthful hold, not recovery completion.

**Exit:** Exercise actual internal-work mechanics with isolated transport/proof ports: restart after claim; expire during preparation before intent; stall across permit consumption; restart after accepted provider result before local acceptance; expire after the first admitted command. Assert stale callbacks cannot send/commit, absent-intent recovery progresses without changing logical effect, submitted/unknown work never resubmits, original verified output can finish under fresh authority, earlier commands/costs do not duplicate, and pause/kill/revoked grants still deny mutations. Preserve G6 rejection in the production composition.

### CFN-F03 — High: the real request omitted inputs supplied secretly by the controlled helper

**Plan:** §13 CFN-01/04/05/06, real internal work, useful handoffs and bounded improvement. **Inspected code:** `src/rules/autonomy-inference.mjs`, `internalRequest` (original lines 21–38); `test/autonomy/loop.test.mjs`; `test/helpers/autonomy-fixtures.mjs`.

**Unsupported assumption / failure:** A topic, role, prior command outcomes and general context are sufficient for the real manager/backlog/developer. The inspected request did not contain the company brief/customer/outcome, actual dependency deliverables, the work's improvement ID and gap, the registered required-field contract, a usable eligible catalog, or typed command input schemas. A manager cannot combine a child's unseen answer; a developer cannot reliably name the improvement or know which missing field its fixed contract requires. The controlled callback reads these facts directly from the journal, so its successful loop hides this gap. Real inference could spend money guessing identifiers or repeat invalid proposals until capped.

**Small correction:** Build a bounded, frozen work envelope through M01: relevant company brief/objective, parent assignment and accepted dependency outputs, scoped gap/target/base/contract, eligible exact catalog IDs/revisions, supported command shapes and allowed scope. Keep it untrusted content, intersect grants/targets, and count the entire envelope against cumulative input limits. Supply only the affected records, not the full journal. Keep tests/evaluator authority outside the model.

**Status:** Open at this finish snapshot; accepted by coordinator and assigned to the existing M01 owner.

**Exit:** Inspect the actual `GenerationRequest.messages` constructed by real internal preparation for manager, backlog and developer work. Assert the customer/outcome, original child deliverable, exact improvement ID/base/required fields and legal resource/command parameters are present where needed; denied/sibling/private context is absent. Use those serialized inputs as the controlled proposal test's only business facts, rather than giving its callback arbitrary journal access. Oversize inputs must hold before paid dispatch. No funded call is needed to verify this contract.

### CFN-F04 — High: granted knowledge and installed personas did not reach autonomous consumers

**Plan:** §13 CFN-03/06 and marketplace guidance; owner four-step brain flow. **Inspected code:** `src/rules/autonomy.mjs`, bootstrap scopes and `request_resource`; `src/workflow/internal.mjs`, `prepare`; `src/autonomy/context.mjs`, `resolveEffectiveContext`; `src/knowledge/index.mjs`, `save/capture`; `public/autonomy.js`, brain-step guidance.

**Unsupported assumption / failure:** Existing document grants and a resource binding automatically make their contents available to autonomous work. Manager/backlog initially had `knowledgeIds:[]`; document editing changes document grants but did not update admitted agent/work scope. Internal preparation explicitly captures that empty selection. An owner following “grant its agents access in each document” still supplied no company knowledge. Separately, automatic SOUL installation wrote a binding, but the resolver returned only ID/kind/version/hash for resources. An isolated resolver probe confirmed the installed persona's actual instructions were absent. These are inert product connections, even though the local records are real.

**Small correction:** Add an explicit owner-selected, M01-approved knowledge assignment after document grants, reflected in agent scope and eligible unfrozen queued work. Child scope remains a parent subset; current grant revocation still wins at preparation/transport. Do not automatically import all private documents or rewrite frozen/submitted contexts. Freeze exact persona guidance as inert untrusted context alongside its catalog version/full content hash; ensure both actual consumers receive it. Guidance grants no tools, spending or authority.

**Status:** Coordinator reports persona text/hash correction and a new negative test; knowledge selection is being implemented by M01 and wired by coordinator. **Not independently closed in this finish snapshot.**

**Exit:** Owner grants then explicitly selects one document; actual internal request contains its exact permitted JBrain revision. An unselected/restricted document is absent; revoke the grant during a yield and assert zero dispatch. After a free persona install, actual next-run request contains its guidance and frozen hash; catalog text changes reject the bound revision, earlier contexts stay immutable, and persona instructions cannot enlarge actor commands. Show selected versus merely granted context clearly in the UI.

### CFN-F05 — Medium: a few UI claims exceed the implemented command/projection contract

**Plan:** §13 CFN-05/08/09, truthful milestone/status views. **Inspected code:** `public/autonomy.js`, boundaries copy, manager decision and improvement detail; `src/rules/autonomy.mjs`, `validateCommand` and owner-view field projection.

**Failure / impact:** Boundaries copy says agents can propose company prompt changes, while the inspected command schema accepts structured field operations only and non-template targets hold. “Manager's latest decision” selects the latest accepted run without filtering its actor, so a specialist's command may be attributed to the manager. The improvement UI requests `promotedRevisionId`/`reasonCode` that the inspected projection omits. These do not justify expanding the implementation; they weaken the owner's ability to distinguish proposed scope, actor and applied revision.

**Small correction / exit:** State the shipped template-only proposal scope, or explicitly show instruction proposals as unsupported; filter the manager panel by manager actor and label its decision state; include the permitted applied revision/block reason in the private projection and show them in detail. A mixed manager/specialist fixture, promoted improvement and unsupported instruction request must render the correct actor/revision/state. This is a bounded clarity correction, not a redesign or a live-launch blocker.

### What this pass supports

- Internal inference is separate from customer orders and owner-only wire components. Product composition uses the real M07 port, with no import of the explicit test-only accepted-proposal helper found in the inspected path. Current G6 continues to deny unverified autonomous commands.
- M01 owns actor decisions, exact transition plans, ceilings, shared inference admission and current dispatch checks; M03 remains the money owner. Focused tests demonstrate final fence/pause/kill denial after yielding permit consumption. Those are meaningful strengths, not funded-provider evidence.
- Fixed evaluation actually tests baseline and candidate, mandatory missing-field cases, preservation and exact hashes. Promotion checks the current head and uses the serialized local writer/CAS; owner/model `passed:true` is not used as evidence. The remaining tests should preserve these controls while fixing recovery/input wiring.
- The effective resolver is wired into both internal preparation and workspace task admission. The research request serializes the full captured agent context. Promotion therefore has an actual future consumer, while already captured work remains immutable. This establishes context propagation, not proof that arbitrary guidance improves business outcomes.
- Draft publication and paid procurement remain visibly blocked; original orders/events are projected rather than manufactured. Anonymous autonomy access is denied in the checked tests/browser artifact. No public financial allowlist expansion was found in the reviewed wiring.

### Bounded visual review and readiness exits

⚠️ DEGRADED: single-context visual assessment (the user explicitly prohibited new threads/agents). This is the requested bounded screenshot review, not a fresh interactive accessibility certification. Applied the Impeccable guidance using `.impeccable/surfaces/autonomy.md` and the existing Paperclip-style workspace as authority; no runtime/UI edits. The focused detector command `impeccable detect --json public/autonomy.js` returned `[]`.

Reviewed supplied `operations-desktop.png`, `operations-mobile.png`, `setup-mobile.png` and `ledger-mobile.png`. Hierarchy, labeled setup steps, mobile stacking and the explicit blocked/no-accepted-decision state are clear and consistent with the incumbent interface. The supplied browser proof records widths390/1440, no overflow or exceptions, anonymous403 and zero financial/provider effects. It does not prove keyboard completion or actual inference. No decorative redesign or further polish loop is warranted. CFN-F04/05 address the material context/wording mismatches; raw reason codes in the ledger are a minor clarity improvement.

Finish checklist:

- [x] Preserve reviewed plan hash and no fake production reasoning/payment fallback.
- [x] Independently rerun the focused autonomy tests and reproduce the concrete recovery failures.
- [x] Verify the narrow CFN-F01 replay correction with the original probe.
- [ ] Verify CFN-F01 time/restart regression in the actual internal-work integration.
- [ ] Close CFN-F02 no-intent/original-result/partial-command recovery exits without blind retries or stale commits.
- [ ] Close CFN-F03 actual serialized work-envelope tests without out-of-band journal help.
- [ ] Close CFN-F04 selected knowledge/persona consumer and revocation tests; confirm the UI instructions match the real route.
- [ ] Correct CFN-F05 actor/scope/applied-revision wording and projection.
- [ ] Record the coordinator's final broad tests/syntax result after the complete M01 handoff; earlier counts cannot certify later code.
- [ ] Continue to label real accepted reasoning, autonomous Cloud acquisition and verified commerce as externally gated until actual bounded evidence exists.

No new generic user decision is needed for these corrections. They implement the reviewed scope. No accounts, funds, credentials, provider calls, publication or runtime edits were performed by this review. Questions skipped: this is a finish review with concrete authorized corrections, and the coordinator is already handling their disposition.

## Narrow closure recheck — 14 November 2026, before final M01 freeze

Plan hash remains `f9d94ac4486a9d7f4a358476b3e90a5385fd0e8e1848c24ddb5324460af30c0f`. Independently ran the current focused coordinator/M01 autonomy suites: **26 passed, 0 failed, 0 skipped**. Read the coordinator's broad `artifacts/companyos/tests.log`: **285 passed, 0 failed, 0 skipped**. The broad log precedes the final M01 changes and is not certification of later source. No new visual sweep, provider calls or runtime edits were performed.

- **CFN-F01: closed for the recorded defect.** The actual internal-work/native-JBrain integration test repeats the same original pending-cost result after a time change and after reopening the store, preserving observation identities and one generation. SDK findings, completion and billing are explicitly controlled ports; native JBrain, Rules, Treasury, inference adapter and internal workflow are actual modules.
- **CFN-F03: closed for the missing-input contract.** `internalRequest` now serializes company brief/customer/outcome, objective, scoped dependency deliverables, gap/improvement, baseline/required-field contract, eligible catalog identities and command schema. Input bytes are counted. The controlled proposer now receives only `{request}` from actual `agent_prepare`; it no longer reads the journal. Its loop verifies the envelope and actual fixed-driver promotion/future context/root completion/restart. This establishes usable inputs and mechanics, not real model judgment.
- **CFN-F04: closed for the recorded consumer defects.** The owner `autonomy_knowledge` selection requires paused, unfrozen work and existing document grants, updates bounded scopes, and restricts children to parent selection. The UI distinguishes granting access from selecting context. Actual internal-work/native-JBrain tests verify selected exact revision, exclusion of an unselected source, persona guidance/full content hash and zero transport after grant revocation during asynchronous preparation. Resolver tests reject changed catalog content. No automatic restricted grant or new tool authority was introduced.
- **CFN-F05: closed for the recorded copy/projection defects.** Template-only scope copy, manager-actor filtering and private applied-revision/block-reason fields are present. The focused UI test verifies mixed actors, inert diffs and applied revision. This is source/render-test closure, not fresh browser accessibility certification.
- **CFN-F02: improved but still open at this pre-freeze snapshot.** No-intent recovery preserves effect/request identity and fences old workers; existing SDK/financial intent prevents replacement. Recovery-only frames cannot prepare/send a new inference. Targeted tests exercise original strict proof, partial-batch replay, final fences and asynchronous callback replacement. However, an independent second-recovery probe still fails as described below. Coordinator acknowledged it and assigned the correction to the existing M01 owner.

**Remaining CFN-F02 reproduction:** Accept a three-command batch `[draft0, draft1, complete]`; admit command0; expire the lease and recover/accept the original result; admit command1; expire and recover/accept the same original result again; replay command1. `recoverResult` copies the original source run's prefix again, losing progress admitted by the first recovery. The probe produced `COMMAND_REPLAY_CONFLICT`, with two real draft records but only one copied command outcome. This remains the same partial-command/original-result recovery exit, not an additional feature request.

**Required closure:** Preserve the immutable original result/proof source while selecting the latest trusted contiguous admitted prefix for that same work/effect/candidate across its recovery chain. Repeated recovery must neither forget admitted commands nor accept a conflicting/foreign prefix. Verify two successive expiries/recoveries, canonical replay of both earlier commands, completion of the final command, unchanged original effect/request/proof identities, and no duplicate writes or cumulative call/result-byte accounting. The coordinator is also completing its unchanged-missing-authority admission regression so background waits do not consume repeated objective steps. Record the final M01 handoff and post-handoff broad counts before changing the finish verdict.

**Interim verdict remains READY WITH CONDITIONS for authorized reversible integration; CFN-F02 prevents claiming local finish closure.** Strict live M3/M4 is independently blocked by the existing external proof/economic gates. No additional user approval is requested.

## Final narrow closure after M01 source freeze — 14 November 2026

**Verdict: READY for the reviewed local M1/M2 scope, the gated M3 internal-work port and truthful M4 views. CFN-F01–CFN-F05 are closed for the concrete local defects recorded above.** This section supersedes the pre-freeze open statuses/checklist, including the interim CFN-F02 blocker. It does not certify real accepted model judgment, funded execution or full commerce autonomy.

Verified the final M01 handoff at the top of `handoffs/rules.md`. Independently recomputed its aggregate SHA-256 over the **27** sorted `src/rules/*.mjs` and `test/rules/*.mjs` paths, using path + NUL + exact bytes + NUL: `c61728e61114112ef3094789e7857961e1d013dd797b66e6060730d5e2d1347b`, matching the declared freeze. The reviewed plan remains unchanged at `f9d94ac4486a9d7f4a358476b3e90a5385fd0e8e1848c24ddb5324460af30c0f`.

Post-freeze verification:

- **Independently executed:** `node --test test/autonomy/*.test.mjs test/rules/autonomy*.test.mjs` — **28 passed, 0 failed, 0 skipped**. This includes actual native-JBrain/internal-work consumer tests, strict proof holds, final dispatch fences, selected/revoked knowledge, bounded request-only controlled improvement, asynchronous preparation races, and the final recovery regressions.
- **Read completed coordinator post-freeze logs:** `artifacts/companyos/tests.log` — **287 passed, 0 failed, 0 skipped**; `native.log` — **12 passed, 0 failed, 0 skipped**; `check.log` — **85 JavaScript files syntax checked**. These replace the earlier 285-test figure. The reviewer did not independently rerun those three broad commands.
- **Independently repeated the original second-recovery reproduction after correction:** command replay returned allow/replayed, final command completed the company, and exactly two original draft records remained. The committed regression additionally verifies unchanged cumulative model-call/result-byte counts.

**CFN-F02 closure:** `recoverResult` now carries the latest trusted contiguous admitted command prefix through the original result's recovery chain, checks work/effect/candidate/source and command hashes, and preserves immutable original proof provenance. A recovery-only frame still denies preparation/inference. The final regression exercises two successive expiries and recoveries, replay and completion without duplicate drafts/accounting. No-intent recovery still requires authoritative absence of adapter and financial intent and fences the prior worker; existing intent remains reconciliation-only. The final preparation race tests preserve the latest callback and reject delayed stale preparation.

The initially failing in-flight admission test is also resolved in the frozen source: unchanged missing authority is held over five later intervals without additional runs/steps/calls; a genuine bounded grant change admits one recheck of the same frozen request, then the missing-readiness condition remains stable over subsequent intervals. The final focused rerun passes this test. This prevents a waiting company from exhausting its objective merely because a background timer ticks.

F01's immutable observation/time/restart evidence, F03's actual serialized work-envelope/request-only proposer evidence, F04's native document/persona consumer and revocation evidence, and F05's actor/scope/applied-revision render/projection evidence remain as recorded in the preceding closure section. No new design pass or feature sweep was performed.

**Residual limits:** The controlled proposer and cryptographic/provider fixtures remain tests only. They prove local contracts and mechanics; they do not establish real model quality, actual supplier delivery, signed economic receipts or live spend. Current G6 still blocks unverified production commands. Real accepted internal reasoning and the full purchase/sale/refund/payout business remain subject to the existing exact credentials, funded limits, durable output verification, balance/movement/refund and supplier/acquisition gates. Fixed schema repair demonstrates its registered narrow contract, not general company self-improvement. Earlier screenshot evidence does not become a new interactive accessibility certification from these backend tests.

No unresolved must-fix remains from this bounded local finish review. Proceed with the already-authorized local handoff and keep each external milestone explicitly gated. Only this critique was edited by the reviewer; no runtime files, new threads, provider calls, funds, accounts, publication or deployment were changed/performed. No additional generic permission round or user decision is required by this closure.
