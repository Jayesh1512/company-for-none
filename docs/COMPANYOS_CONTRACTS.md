# CompanyOs — integration contracts

> Naming update: project labels and document paths use CompanyOs. Recorded review hashes refer to the original revisions in Git history.

Reviewed plan: revision2, SHA256 `f9d94ac4486a9d7f4a358476b3e90a5385fd0e8e1848c24ddb5324460af30c0f`. Critique: `COMPANYOS_CRITIQUE.md`. This guide records runtime vocabulary, not a second policy source.

M01 owns decisions and exact state transitions. Coordinator owns mechanics. All stores use the existing journal; provider accounting remains M03.

## Rules port

`createRules({getAutonomyFacts})` reads private current facts: `{company,objectives,agents,work,runs,improvements,heads,revisions,contracts,evaluations,resourceRequests,serviceDrafts,catalog}`. These facts cannot come from HTTP input.

Owner action types: `autonomy_configure`, `autonomy_bootstrap`, `autonomy_control`, `autonomy_view`, `autonomy_gap`, `autonomy_template`, `autonomy_evaluate`, `autonomy_rollback`. Owner parameters are `facts.input`; `facts.access` is server verified. Internal actions use work/run/fence IDs and derive authority from current trusted records: `autonomy_claim`, `autonomy_command`, `autonomy_promote`, `agent_inference`, `agent_result`, `agent_consumption`.

Mutation decision plans: `{kind:'autonomy_<operation>',puts:[{namespace,id,value,expectedVersion:null|number}],events:[{type,data}],scope?,replay?,grantsSpendingAuthority:false}`. Coordinator re-evaluates at the local transaction boundary, applies only exact admitted puts/events, maps null expectedVersion to absent/version0, and uses immutable action fingerprints for replay. No Rules financial plan is applied through this local writer.

Owner view: `plan.fields` gives allowed fields per collection and `eventFields` gives ledger fields. Cursor is the journal sequence, maximum page size100. No public ledger allowlist expansion.

## Durable namespaces

`autonomousCompanies`, `companyObjectives`, existing `agents`, `agentWork`, `agentRuns`, `improvements`, `companyTargetHeads`, `companyRevisions`, `companyTemplateContracts`, `improvementEvaluations`, `resourceRequests`, `serviceDrafts`.

Company: `{id,companyId,operatingMode:'one'|'none',executionMode,brief:{name,purpose,industry,customer,outcome,objective},intent:{maxAgents,maxOpenWork,maxDepth,maxSteps,maxCalls,maxCreations,maxInputBytes,maxResultBytes,maxRetries,allowedResourceKinds,allowedPatchKinds},state,managerId,backlogAgentId,objectiveId,version,started}`.

Objective counters: `{steps,calls,creations,inputBytes,resultBytes,retries}`. Work: `{id,companyId,objectiveId,actorId,parentWorkId,kind,topic,depth,state,logicalStep,effectId,lease:{runId,fence,leaseUntil}|null,version,context}`. Stable manager/backlog IDs are company-derived. Effect identity is independent of the lease/run.

Agent scope: `{commands,targetIds,knowledgeIds,toolIds,resourceKinds,patchKinds}`; child scope is a current permitted subset, never a new owner grant.

## Untrusted proposal format

`{commands:[...]}`. Reject unknown top-level/command keys and unknown command kinds before executing a batch. M01 selects commands only from the trusted accepted run record, not a request-body command.

- `delegate`: `{type,kind:'developer'|'specialist',role,topic,instructions,skillIds?,knowledgeIds?,toolIds?,targetIds?,targetId?,improvementId?}`.
- `request_resource`: `{type,listingId,version}`.
- `propose_service`: `{type,baseListingId,title,inputs,deliverable}`.
- `report_gap`: `{type,targetId,failureCode,summary}`.
- `propose_patch`: `{type,improvementId,targetId,baseRevision,operations:[{type:'add_field'|'require_field',name,required?}]}`.
- `complete_work`: `{type,summary,deliverable}`.

Commands are individually admitted by stable index IDs; denial is visible and replay cannot duplicate prior admitted commands. No arbitrary tool URL, filesystem path, shell, credential or wallet action is accepted.

## Effective context and fixed evaluation

`resolveEffectiveContext({journal,catalog,companyId,agent,companyKnowledge})` snapshots exact profile, skills/personas/catalog hashes and active company template heads. Both workspace orders and internal work use it. Existing work snapshots never change after promotion.

Head: `{companyId,targetId,revisionId,version}`. Revision: `{id,companyId,targetId,kind:'template'|'instructions',scope:'company'|'agent',agentId?,body,hash,version}`. Template body: `{fields:[{name,required:boolean}]}`. Registered contract: `{id,targetId,companyId,requiredFields:[identifier]}`. No auto-seeded sample template in product.

`evaluateTemplateChange({baseline,candidate,contract})` executes the fixed driver in `src/autonomy/evaluation.mjs`. Observations include exact baseline/candidate/contract/test-set/evaluator hashes, actual case results, preserve-fields and repaired findings. It does not authorise promotion.

Evaluation record: `{id,companyId,improvementId,targetId,baseRevision,policyVersion,observation,version}`. M01 reads only private persisted findings, checks current base/candidate/test identities and admits promotion. Instruction patches remain review-required without an adequate fixed evaluator.

## Internal inference

`createInternalWork({journal,rules,treasury,inference,knowledge,companyId,clock})`: prepare/execute/accept take `{workId,runId,fence}`; reconcile takes `{workId}`. It uses a real SDK GenerationRequest and `agent_inference`; no customer order or owner-component authority. Current G6 durable accepted-output limitation blocks command acceptance. Existing operation, permit, cost and credit identities survive restart and unknown effects.

## HTTP and UI

All `/api/workspace/autonomy` routes require server-verified owner access. GET view supports cursor/limit; POST configure/bootstrap/control/advance/gaps/templates/evaluations/rollback accept bounded JSON and stable idempotency keys. No endpoint accepts trusted actor, provider-proof or evaluation booleans. Operational logs are private. Existing `/api/ledger` remains public only under its existing Rules disclosure policy.

## Finish-integration refinements

- `autonomy_knowledge` owner input `{agentId,version,knowledgeIds}` selects currently granted documents while paused. It updates only eligible unfrozen queued work; child selections remain parent subsets. HTTP route: POST `knowledge-selection`. Granting access in a document alone is not a selection. Both current selection and JBrain grant are checked at preparation/final dispatch.
- `autonomy_control` supports explicit `bind_runtime` from setup to the current server-selected live policy, without economic rebinding or spending permission; `retire_agent` applies only to eligible specialists/developers. The permanent manager/backlog identities remain.
- The fixed worker uses private `autonomy_auto_evaluate` / `autonomy_auto_promote`. These derive authority from the admitted proposal and exact trusted evaluator findings, not an owner impersonation or developer `passed:true`.
- The real request serializes company brief/objective, scoped assignment/dependencies, gap/base/contract, exact catalog metadata and fixed command schemas within existing byte limits. The controlled test reasoner receives **only that request**, not ambient journal access.
- `autonomy_recover_result` obtains a fresh recovery-only frame for an original verified result. It cannot prepare or dispatch inference. Original effect/proof identity and the contiguous admitted command prefix persist across recoveries; canonical command IDs do not change with the lease. Current scope/caps/kill/proof checks still apply.
- Equal provider result observations reuse their first immutable observedAt. Changed observations get distinct content identities. Reconciliation does not invent costs or retry the completion.
- Expired preparation can be fenced/reclaimed only with affirmative absence of any original provider/financial intent or result. M03-approved/consumed effects remain held for reconciliation. Internal effect manifests can update their admission frame through CAS only on that no-intent path, retaining effect/request identity.
- M07 has an optional private synchronous `authorizePreparation` decision port. Production binds it to fresh M01 `agent_prepare` with exact request/action. It gates replacement of an old read-only callback and its post-await cache write. An existing operation cannot be replaced, and an old worker cannot overwrite the current callback/preflight. This does not grant paid dispatch.
- Free SOUL resource snapshots contain their exact inert guidance as well as catalog version/full hash. A catalog content change fails closed. Written persona guidance grants no authority.
- Private view fields include applied revision IDs, blocker reasons and safe original financial markers. The latest-manager panel filters the manager actor. The shipped automatic patch surface is template-only; prompt/source-code changes remain unsupported backlog work.

HTTP GET accepts only numeric cursor/limit, capped by M01; tabs are client navigation over the same approved owner projection. Earlier tab-query wording is descriptive, not an additional server override.
