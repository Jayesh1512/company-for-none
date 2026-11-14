# S1 handoff — setup, readiness and centralized Rules

14 November 2026. WORKER_DONE for the owned implementation scope. Resumed the original thread with GPT-6.1-Sol/high after the Sonnet usage limit. No new chats/agents, commits, staging, resets, dependency/config/environment edits, paid calls or user preview-store mutations.

## Current behavior

- Activation derives its setup basis inside M01 from the private `getAutonomyFacts` callback. A current unified local review replaces the legacy six-step requirement; optional private documents are not required. A stale unified review cannot fall back to completed legacy reviews. The historical six-step APIs remain available for companies without unified setup.
- Unified review fingerprints include the brief/intent/execution mode, actual agent profiles, exact bound skill listings, and accepted agent instruction revision heads. Activation also binds the selected service listing hash/version and agent revision. Relevant edits invalidate review or new service-order admission.
- Setup-only mode still cannot activate or spend. Live activation still requires current commercial policy, identity-bound execution prerequisites and the configured confidential settlement route. The kill switch remains an activation blocker. Provider/credit/bounds/proof requirements are unchanged.
- Owner setup/operation infrastructure is the current M01 capability projection, one record per capability. Historical observations remain in the journal but are not displayed as current verified connections. Public readiness remains redacted. Owner records include observation ID, check time and expiry.
- Explicit `runtime.probe('jbrain', owner)` reads the actual health client. M01 sets a five-second deadline and five-minute observation lifetime. A failed/stuck client records unavailable, and an expired/newer invalid/wrong-identity observation never revives an older verified one. Refresh grants no spending authority and performs no paid probe.

## Integration ports

`workspace.operation(owner).activationStatus` is:

```js
{ kind: 'activation_status', ready, basis, unifiedReviewed,
  blockers: [{ reasonCode, requirement, capabilities? }],
  grantsSpendingAuthority: false }
```

`basis` is `unified`, `legacy-six-step`, or null. `workspace.setup(owner).activation` exposes the same status. `public/operation.js` consumes `activationStatus`, lists blockers and retains explicit connection refresh controls. Existing activation/action APIs are retained.

### Common lifetime USD ceiling

Two safety inputs are available, neither is spending authority:

```js
createRules({ /* existing private composition */, totalCeilingNanoUsd: '5000000000' })
// Or an explicit commercial policy: spending.totalCeilingNanoUsd = '5000000000'
```

The runtime-only option works with `setupOnly:true`: config remains null, mode remains setup, and paid actions remain held. `snapshot().safety.totalCeilingNanoUsd` projects the policy/runtime minimum. Coordinator owns wiring the option through app composition and the isolated demo; no private account, price or credit is invented.

M01 takes the smallest configured/runtime ceiling and private exact grant `maxTotalNanoUsd`. It sums lifetime actual plus outstanding bounds from the persisted reservation ledger, independently of day, run, operation grant or worker identity. Unknown/pending exposure retains its full bound; reconciled actual costs remain counted across restart. Released reservations with recorded actual cost still count that actual. Missing/malformed/duplicate original-action ledger facts hold. Funding then consumption is conservatively counted twice. No external asset principal is converted to USD; exact asset authorization/protected-funds checks remain separate, and unavailable live funding/procurement routes remain unavailable.

Final post-consumption dispatch rechecks current ceiling and current complete authorization fingerprint. Reduced/removed grant caps, changed policy and newly recorded cost prevent the callback. Existing permits remain once-only and cannot survive a Rules restart.

### S7 owner-reviewed changes

Developer command:

```js
{ type: 'propose_change', improvementId, targetId,
  kind: 'instructions' | 'host_code', rationale, proposedText }
```

All fields required, no extras; rationale <=4000, proposedText <=12000 nonempty characters. Existing company improvement must be open and in the developer's admitted target scope. Instruction target is a current, nonretired company `agent:<id>`; host target is an inert `host:<path>` label. Open owner-review queue is bounded to20. Admission records `state:'owner_review'`, `reasonCode:'OWNER_REVIEW_REQUIRED'` and hashed proposal/admission provenance. It is an admitted command, with no rejection/retry burn. Auto evaluation/promotion cannot consume it.

Owner action `autonomy_review_change`, called by S7's thin `autonomy.reviewChange(input, owner, key)`:

```js
{ improvementId, version, decision: 'accept' | 'reject', reviewNote? }
```

Review note <=1000 nonempty characters, no extra fields. Accept instructions requires current autonomy policy, kill off, company paused/not started, no live lease, valid proposal hashes and current target. Its exact local plan creates immutable `companyRevisions` with `kind:'instructions'`, `scope:'agent'`, `agentId`, `body:{text}`, `hash`, `status:'accepted'`, `parentRevision`, plus a CAS update of `companyTargetHeads`; improvement becomes `owner_accepted`. It changes no agent profile version, grant, scope or policy. S7 resolves this revision as untrusted company context. The new revision invalidates local setup review.

Accept host code only records `owner_acknowledged_manual`. It creates no revision/head, executes no code and modifies no source. Reject records `rejected`, including while killed. Owner-only view includes proposal and reviewer metadata; event field `decision` is permitted. Events are `improvement.owner_review_requested`, `improvement.owner_reviewed`, and `improvement.owner_accepted` for accepted instructions. Background `autonomy_auto_*` events identify `actorId:'M01'`; manual owner actions remain owner. Causation IDs are retained.

### S7 durable blockers and recovery

- `agent_observe` for an exact current trusted `source:'local-sdk'` not-submitted result releases the local lease and persists a semantic `admissionConditionHash` only when private operation/Treasury/result facts establish no existing effect intent. Any operation/reservation/approved plan/consumed permit/confirmed-pending-unknown result prevents no-intent recovery. Late old-run observations cannot release a newer lease.
- `agent_preparation_blocked` exact action `{id,type,workId,runId,fence,observationId}` reads only private `getAutonomyFacts().preparationFailures` (journal namespace `internalPreparationFailures`). Record fields are `{id,source,companyId,workId,runId,fence,stage,reasonCode,observedAt}`. Accepted source/stage pairs are `internal-knowledge-capture`/`knowledge_capture` with fixed knowledge reasons, and `internal-context-resolution`/`context_resolution` with fixed catalog/integrity/company-scope reasons. Caller-supplied records do not establish facts. Current lease/fence/time and known-no-intent gates apply.
- Unchanged conditions hold across elapsed lease/restart without new claims/calls/steps. Explicit owner resume changes the existing admission epoch. Relevant catalog/revision repair changes the semantic hash; process-local policy epoch is excluded from that hash while policy/fence enforcement remains intact.
- Waiting work can recover an unfinished accepted command batch only when the latest accepted run has a contiguous admitted prefix shorter than its original canonical command list. Existing proof/effect/candidate/recovery-chain checks remain mandatory. Finished/rejected batches are not admitted by this exception. Superseded recovered runs receive a single lifecycle stop before the new start, `remoteCancelled:false`.

### Specialized Cloud diagnostics

M01 `cloud_product_plan`/held execute now include `plan.costBound`: unavailable status, exact request fingerprint, `providerEnforced:false`, `maxCostNanoUsd:null`, catalog freshness/completeness, valid observed unit prices, missing price dimensions and unresolved technical limits. A current complete catalog expires after five minutes for these diagnostics. No arbitrary tokenizer/template overhead or numeric aggregate is invented. Rerank still needs per-pair template/output limits; search result count cannot bound paid search-call/round count. Every specialized paid route remains held, including `SEARCH_TOTAL_BOUND_REQUIRED` for web search. S3 copies this plan verbatim into its adapter's planned-bound field.

The existing chat monetary calculation already treats the output-token cap as including reasoning and requires the corresponding provider-bound fact; changing the shared encoder to `max_completion_tokens` does not establish provider enforcement, credit or proof. Frozen prepared-byte hashes must still match exactly. Strict unavailable plaintext/replay/provider proof gates remain closed.

## Owned files

Source: `src/rules/{activation,autonomy,autonomy-inference,business,ceiling,cloud-cost,cloud-products,command-format,config,index,runtime}.mjs`, `src/workspace/index.mjs`, `src/runtime/readiness.mjs`, `public/operation.js`.

Checks: new `test/near-e2e-setup/{activation,readiness}.test.mjs`; new `test/rules/{ceiling,cloud-cost,owner-changes,preparation-blockers}.test.mjs`; updated `test/rules/autonomy-fixtures.mjs`, `test/rules/runtime.test.mjs`, `test/workspace/setup.test.mjs`. No sibling/shared source edits.

## Validation and evidence limits

Executed using Node26.12.1:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node --test test/rules/*.test.mjs test/near-e2e-setup/*.test.mjs test/workspace/setup.test.mjs
```

Final result: **113 passed,0 failed,0 skipped**. Log: `/tmp/near-s1-final-tests.log`. Syntax checks: **42 owned JavaScript files passed**. Tests use isolated temporary journals, local/synthetic controlled clients and provider findings; none is live funded execution evidence. S1 performed no public-provider reads this resumed turn. S7 separately reported real local JBrain plus13 controlled pipeline scenarios, including two successive partial-batch crash/restarts, unchanged missing-access restart, instruction review and context corruption/repair; those are S7's evidence, not a claim of paid Cloud execution.

Coordinator owns final integration/browser/demo and runtime-only cap wiring. Missing credentials/account/network/exact transfer scope, attributable prepaid credit, request-specific enforceable bounds and strict supported response/plaintext proof remain live gates. No paid request, wallet provisioning, transfer, purchase, public sale or provider/security downgrade was authorized or performed here.
