# S7 autonomous company loop — 14 November 2026

**WORKER_DONE for the owned implementation and controlled verification. Live accepted reasoning remains externally blocked.** Resumed the same chat on GPT-6.1-Sol/high, preserving the prior Sonnet edits. No new chat/agent, commit/staging/reset, dependency/config/secret change, user preview-store mutation, provider completion, paid call, provisioning or funds movement was performed.

## Owned files

- `src/autonomy/index.mjs`: admit accepted commands in the same advance; reconcile unfinished accepted batches even when a delegation already made the work `waiting`; surface partial-batch blockers; use durable M01 admission conditions instead of timed, process-local retry counters; expose `trace` and `reviewChange`.
- `src/autonomy/context.mjs`: retain effective owner-accepted instructions as untrusted company context; expose exact `instructionRevision:{targetId,revisionId,hash}`; previous snapshots remain immutable. Existing persona text, catalog hashes and selected native JBrain revisions remain in the real request.
- `src/autonomy/facts.mjs`: private `preparationFailures` mapping to `internalPreparationFailures`.
- `src/autonomy/blocks.mjs`, `src/autonomy/trace.mjs`: display-only blocker explanation and causal owner-view projection. These never supply authorization or provider proof.
- `src/workflow/internal.mjs`: immutable original observations across replay; original bill consumed once; actual bounded preparation failures recorded through the S1-approved port; current M01 checks before preparation, dispatch, result acceptance and recovery.
- `test/autonomy/pipeline.test.mjs`: actual application/Rules/Treasury/internal workflow/native JBrain composition with explicitly injected controlled SDK output, proof and billing. Thirteen scenarios; optional controlled trace output.
- `test/autonomy/context.test.mjs`: fixed-evaluator negative cases and immutable, profile-scoped instruction revisions.
- `test/autonomy/loop.test.mjs`: existing controlled loop preserved; its test-only request bound now explicitly accommodates the expanded typed command schema and child deliverables.

S1 owns the corresponding command/review policy, preparation-stop decisions, semantic condition hashes, contiguous prefix recovery and lifecycle stop events. S2 owns the actual SDK and durable plaintext-proof feasibility. Coordinator owns all HTTP/UI/composition/demo wiring. No cross-scope source edits were made.

## Stable coordinator interfaces

`autonomy.trace(access)` returns `{improvements,agents,blockers,rejectedCommands,causalOrder}`. It authenticates via `autonomy.view`, paginates that view, and consumes only M01 field/event allowlists. It reads no raw private SDK artifacts. Every page rechecks access. `buildLifecycleTrace(view)` is the pure export from `src/autonomy/trace.mjs`; `explainBlock(reasonCode)` is the pure export from `blocks.mjs`. Trace results are display observations, never a proof/authority input. Anonymous/agent access is denied by M01.

`autonomy.reviewChange(input,access,key)` uses the existing serialized ownerMutation/writer. Exact input:

```json
{"improvementId":"<current improvement id>","version":3,"decision":"accept","reviewNote":"Reviewed company guidance."}
```

`decision` is `accept` or `reject`; `reviewNote` is optional, bounded by S1. Use a stable key and the current improvement version. Replays still require current owner access. M01 rejects forged fields, stale versions and nonpending changes. Instructions acceptance requires paused company/no active leases and emits an immutable company-owned instructions revision/head with CAS; it changes no agent permissions, runtime, policy or financial state. Existing frozen requests remain immutable: use a legitimate new objective/future work to demonstrate the new context. Host-code acceptance only records `owner_acknowledged_manual`; rejection records `rejected`. Neither creates a head nor runs code.

Developer command shape, interpreted exclusively by M01:

```json
{"type":"propose_change","improvementId":"<scoped gap id>","targetId":"agent:<company-owned agent id>","kind":"instructions","rationale":"Requires owner review beyond additive template evaluation.","proposedText":"Proposed company guidance."}
```

Host-code proposals use `kind:"host_code"` and a `host:` target; they remain text. No generated shell, host rewrite, dependency edit, Rules/permission/evaluator edit or automatic prompt promotion exists.

Coordinator routes can call `trace(access)` for GET `/api/workspace/autonomy/trace`, and `reviewChange(input,access,Idempotency-Key)` for POST `/api/workspace/autonomy/change-review`. Routes/UI are outside S7 ownership.

## Trusted preparation failure port

Mechanics persist an actual caught failure only, without raw error messages, document text, stack traces or credentials:

```text
{id,source,companyId,workId,runId,fence,stage,reasonCode,observedAt}
```

- `source:internal-knowledge-capture`, `stage:knowledge_capture`: fixed reasons `CURRENT_KNOWLEDGE_GRANT_REQUIRED`, `JBRAIN_UNAVAILABLE`, `INTERNAL_CONTEXT_REQUIRED`.
- `source:internal-context-resolution`, `stage:context_resolution`: fixed reasons `CATALOG_REVISION_CHANGED`, `CATALOG_REVISION_UNAVAILABLE`, `REVISION_INTEGRITY_FAILED`, `COMPANY_SCOPE_MISMATCH`.

The private facts port exposes these as `preparationFailures`. The exact M01 action is `{id,type:"agent_preparation_blocked",workId,runId,fence,observationId}`. M01 checks the original trusted observation, current work/actor/fence and the absence of original SDK/financial intent before releasing a local claim and recording its semantic blocker. Current SDK `not_submitted` observations use the corresponding S1 gate. Original operations, reservations and confirmed/pending/unknown results prevent this no-intent shortcut.

Unchanged blocked conditions survive lease intervals, elapsed hours and process restarts without extra steps/calls/results. View/Advance does not clear a blocker. A genuine trusted repair or explicit owner `resume` permits one fresh check without resetting cumulative budgets. Original unknown effects remain reserved and reconcile read-only; they are never resent.

## Reproducible controlled demonstration

Run from the repository root with the supported Node and installed native JBrain binary:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node --test test/autonomy/pipeline.test.mjs
NEAR_CONTROLLED_TRACE=1 PATH=/Users/jys/.hermes/node/bin:$PATH node --test --test-name-pattern='^real pipeline:' test/autonomy/pipeline.test.mjs
```

The second command prints one `CONTROLLED_TEST_TRACE` JSON record, explicitly labelled `controlled-sdk-output-proof-and-billing`, followed by the test result. The test uses a fresh temporary store and actual native JBrain, then deletes its isolated state. It imports no test implementation into production. No product sample data is auto-created.

Exact scenario in the first pipeline test:

1. Brief: name `Pipeline schema company`; purpose `Prove the real internal loop with a controlled SDK port.`; customer `Fictional schema owners`; outcome `Repair one template schema gap`; objective `Review the name template and address its gap`.
2. Register template `Fictional names` with required fields `firstName,lastName`, and a fixed contract requiring `firstName,middleName,lastName`; bootstrap and explicitly start.
3. The controlled reasoner receives **only the actual serialized GenerationRequest**. Manager delegates the named template inspection; specialist reports `MISSING_MIDDLE_NAME`; permanent backlog delegates the scoped developer; developer proposes only the missing additive field.
4. The real fixed evaluator observes baseline failure and candidate success, mandatory missing-field rejection cases and preserved fields. M01 promotes the exact candidate. Later manager/backlog/developer request contexts carry the promoted revision; earlier snapshots retain two fields.
5. Expected final local records: completed company/objective, four distinct company roles, one gap/promoted improvement, one fixed evaluation and new active template head, no customer orders, no unresolved synthetic inference reservations. All real local lifecycle starts have stops.

Captured controlled trace (`/tmp/near-s7-controlled-trace.log`): gap event sequence17 → candidate32 → fixed evaluation34 → promotion35. Backlog triage and developer work link through the gap id and parentWorkId. Future context contains the new template revision in manager/backlog/developer work. Four roles have 2/2/1/2 runs respectively, all stopped; zero remaining blockers. These are local fixture-policy observations with synthetic SDK/billing proof, not real Cloud/TEE/credit evidence. Automatic promotion attribution is M01; manual review attribution remains owner.

The other pipeline scenarios cover unavailable durable proof accepting zero commands; unchanged missing Cloud access and JBrain outage; current kill; crash before command commit; successive partial-batch crashes; lost original output remaining unknown/reserved; delayed bill preventing completion; changed bound persona; corrupt active revision; owner-reviewed instructions in future named-profile context; and inert host accept/reject.

Successive recovery evidence: three accepted delegation commands, crash before command1, restart/lease expiry, crash before command2, restart/expiry. Final state has exactly three specialists, one original preparation/send/result, unchanged Treasury snapshot during recovery, unchanged call/result-byte counters, and the latest admitted prefix preserved through both recovery frames.

## Checks and evidence boundary

- Node `v26.12.1` via `/Users/jys/.hermes/node/bin`.
- `node --test test/autonomy/*.test.mjs test/rules/*.test.mjs test/state-money/*.test.mjs`: **164 passed, 0 failed, 0 skipped**, log `/tmp/near-s7-final.log`.
- `node --test test/autonomy/*.test.mjs test/rules/autonomy*.test.mjs`: **47 passed, 0 failed, 0 skipped**, log `/tmp/near-s7-final-focused.log`.
- Syntax checks: **16 owned JavaScript files**, no errors.
- Final metadata-focused rerun: **2 passed**, covering background `actorId:M01`, manual review decision visibility and future instruction context; `/tmp/near-s7-final-metadata.log`. The separately captured controlled trace also passes.
- Fixed evaluator rejects unchanged/weakening/destructive/duplicate/unsafe/additional-required candidates; proof-unavailable pipeline accepts zero commands; revoked native JBrain grant during async SDK preparation sends zero completions.

Actual evidence: real local application/Journal/Treasury/M01/adapter mechanics, actual local native JBrain requests and outage/revocation, HTTP stand-ins only for billing. Controlled evidence: model choices/proposals, trusted SDK findings, cost bounds/credit and bills under isolated test policy. No new external public read, actual Cloud completion/TEE response, actual paid bill, transfer, supplier purchase or live accepted manager/developer reasoning occurred in S7.

Remaining external gates: S2-supported independently verified original plaintext/durable replay, real scoped credentials, attributable credit/technical charge bounds and current exact work authorization. The user's USD5 **total actual plus pending** cap does not supply those facts. M01 remains the sole policy/config/calculation/allow-deny-hold owner. Coordinator owns integrated real local HTTP/browser demonstration and must label its honest missing-policy/proof stop separately from this controlled full loop. Frozen reviewed recovery/setup history and `.runtime/product-r2-preview` were not changed.
