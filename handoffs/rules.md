# M01 Rules handoff

## Current CompanyOs handoff — 14 November 2026 — source frozen

**WORKER_DONE.** Implemented the assigned M01 scope after reading the full reviewed revision2 plan (`f9d94ac4486a9d7f4a358476b3e90a5385fd0e8e1848c24ddb5324460af30c0f`) and critique recheck. Edited only `src/rules/`, `test/rules/` and this handoff. No config demonstration changes, other-owner edits, new chats/agents, external vendor/paid calls, funds, accounts or deployment. Older sections below are historical and retain their earlier counts.

**Frozen code/test SHA-256:** `c61728e61114112ef3094789e7857961e1d013dd797b66e6060730d5e2d1347b`. Aggregate algorithm: sort the 27 relative paths matching `src/rules/*.mjs` and `test/rules/*.mjs`; hash each UTF-8 relative path + NUL + exact file bytes + NUL. This handoff is excluded to avoid a self-referential hash. No further source changes are planned; integration follow-ups remain in this same worker thread.

### Files, authority and local plans

- Added `src/rules/autonomy-policy.mjs`, `autonomy.mjs`, `autonomy-inference.mjs`; integrated through existing `index.mjs`, `config.mjs`, `policies.mjs` and `components.mjs`. `createRules({getAutonomyFacts,getAgentAuthorization,...})` uses private current facts; engine methods and canonical `status`/`plan.kind` remain unchanged. `autonomyDecision` is exported. No provider client or second balance/config authority was added.
- Optional strict `config.autonomy` has the exact technical ceiling keys in `docs/COMPANYOS_CONTRACTS.md`: agents, open work, depth, steps/calls/creations/input/result/retry budgets, resource and patch kinds. Company UI intent can only narrow it. No policy means `AUTONOMY_POLICY_REQUIRED` for internal admission; owner setup/bootstrap/inspection remain usable without money or SDK access. All financial permission still requires the existing explicit live policy/authorization, actual bounds, scoped credit and strict proof.
- Trusted facts now include the agreed company/objective/profile/work/run/improvement/head/revision/contract/evaluation/catalog/resource/service records plus `contexts`, `internalResults`, current `documents`, actual SDK `operations`, and current private `financial`. Request facts cannot replace these records or claim an actor, evaluation pass, receipt or owner role.
- Local mutation plans are exact `{kind,puts:[{namespace,id,value,expectedVersion}],events:[{type,data}],grantsSpendingAuthority:false}`. The coordinator writer applies only these with CAS and re-evaluates at the commit boundary. Holds carry exact blocker/evidence transitions where appropriate; unchanged external blockers return a read-only hold. All new profiles/work/objectives/runs/revisions have injected-clock ISO timestamps. Existing manual profiles and economic identity are preserved.

Owner actions: `autonomy_configure`, `autonomy_bootstrap`, `autonomy_control`, `autonomy_view`, `autonomy_gap`, `autonomy_template`, `autonomy_evaluate`, `autonomy_rollback`, `autonomy_knowledge`. Configure/bootstrap/control inputs match the shared guide. Controls additionally support `bind_runtime` (version + operation only) and owner `retire_agent` (agentId). Setup→live binding is explicit, server-selected, pauses execution and changes only owned autonomy setup profiles; active/frozen/submitted/unknown work or historical fixture identity prevents conversion. Ordinary brief saves never relabel execution mode. Retirement preserves counters/history and requires no active/unresolved work; manager/backlog are permanent.

Internal local actions: `autonomy_claim`, `autonomy_command`, `autonomy_promote`, `autonomy_auto_evaluate`, `autonomy_auto_promote`, `autonomy_recover_result`. Manager/backlog IDs are company-derived. Logical effect identity stays `internal:<companyId>:<workId>:<logicalStep>` and never incorporates a lease ID. Current company mode/start state, policy/epoch, actor runtime/profile, scope intersections and nonexpired lease/run/fence govern every internal command and paid final gate. Pause/switch-mode invalidate current leases/runs, so a quick resume cannot revive an old worker.

### Commands, counters, dependencies and revisions

The six typed commands and exact allowed keys are frozen in the shared guide and exported `COMMAND_SCHEMA`: delegate, request_resource, propose_service, report_gap, propose_patch, complete_work. Unknown kinds/keys reject a candidate before any command executes. Commands are selected only from the trusted accepted run. Each has `<workId>:<logicalStep>:command:<index>` plus original hash. Admissions and deferred/rejected outcomes are durable; cross-frame replay requires a fresh current scope and returns exact `commandId`/`commandHash` without repeating writes.

Role restrictions, target/knowledge/tool intersections, catalog version/hash, creation/depth/open-work/cumulative budgets, cycle/no-progress checks and exact compatible profile reuse are centralized in Rules. Free skill/persona installation records genuine written guidance only; paid requests stay blocked without a real entitlement. Service drafts freeze a known static base and remain `AUTONOMOUS_PUBLICATION_UNAVAILABLE`; they create no order, receipt, revenue or new provider capability.

Delegation waits for children. A deferred parent releases its claim and records the reason; child completion wakes eligible parents through exact versioned puts. Only the actual objective root, with all mandatory objective work satisfied and an admitted deliverable, can complete the objective. New legitimate logical steps clear old request/context/action only after original costs are actual/reconciled. Counters never reset on lease changes, pauses, retirement, refresh or UTC rollover. Original reservations remain in M03 across objective changes.

Gap dedupe retains occurrence references against company/target/base/failure. Automatic changes are additive registered-template fields and require-field operations only. Fixed evaluation is pinned to `company-template-additive-v1`, hash `7f01049b4065cf038b381ce87ee3dbaefc6a59d93498d5281b17b0589c8f6680`, exact contract/test inputs, baseline failure, candidate repair, preserved mandatory fields and current head/policy. Client/model pass flags are ignored. Promotion CAS-writes an immutable revision/head; rollback adds another revision without deleting history. Automatic evaluator service actions require a historically admitted proposal and current company/profile/target/patch permission; they never impersonate an owner or rely on a developer lease. Instruction/source-code fixes remain outside automatic promotion.

### Internal inference, knowledge and recovery

`agent_prepare` assembles the exact bounded GenerationRequest from private captured context. Its JSON prompt includes the admitted company brief/objective/outcome, current work/improvement, scoped immutable template baseline/required-fields contract, eligible dependency outcomes/deliverables, catalog IDs/versions/content hashes and fixed command schemas. Source/JBrain/persona text is untrusted; child/private context cannot broaden grants. The whole payload is byte-bounded and fingerprinted; no test-only proposer journal access is needed by the real request.

`agent_inference` is a distinct port with exact work/run/fence/request/effect identity and protected `getAgentAuthorization`. It creates no customer order/payment and never reuses a wire-only component grant. It uses existing M03 `purpose:'inference'`, exact request/prepared-byte proof, current bounds and scoped credit, actual+pending spend, and the normal v→v+1→v+2 permit protocol. With autonomy policy enabled, customer/component/internal requests share one unresolved inference slot. The final synchronous gate re-reads trusted scope after permit consumption; expired/reassigned frames, pause/profile/kill/cap/proof changes prevent the callback. Preparation also rechecks authority after awaits and refuses re-preparation after any original approved/consumed financial intent.

`agent_result` reads the original private SDK result and requires the same strict durable plaintext response proof before bounded JSON parsing. Wire signature/provider confirmation alone accepts **zero commands**. Missing/failed/oversize/malformed results preserve precise held/failed evidence; observed result bytes count once per hash even on failure. `agent_observe` and `agent_consumption` reconcile original observations/actual bills while paused without granting actor commands or a new paid effect. Consumption reuses exact existing lot/day/cost arithmetic and scoped provider receipt metadata, with no fake orderPatch.

Safe preparation recovery requires an expired or explicitly fenced local preparation plus authoritative absence of **all** matching SDK intents, known accepted/pending/unknown results, and original financial approvals/consumption. It supersedes the old run, retains the original effect/logical step/plain request hash, and changes only admission run/fence before any intent. Existing intent means reconcile, never resend. Private SDK prepared-cache replacement must use the coordinator/M07 fresh `agent_prepare` callback and exact current payload; old delayed preparation cannot overwrite a newer frame.

`autonomy_recover_result {workId,resultId}` creates a fresh **recovery-only** frame only for a strictly verified original result, current actor/grants/company/policy and available local claim capacity. It authorizes no preparation/inference. The latest contiguous admitted command prefix is carried through the verified recovery chain, tied to the same effect/candidate/source; conflicting/noncontiguous or rejected prefixes hold. This works over repeated recoveries, does not duplicate old commands, and does not count the same output/call twice. Rejected/deferred batches require legitimate replanning instead of revival.

Unchanged missing authority/readiness no longer burns background steps: `admissionConditionHash` binds semantic current policy/auth/bounds/runtime/profile/document/financial facts. A blocked preparation fences/releases its local claim; identical conditions produce no new run/step/write even after many lease intervals. A genuine trusted change or explicit owner resume permits one fresh recheck without resetting budgets. A stable unfunded request preview is frozen for exact approval; calls/input bytes are admitted only once when actual preparation is allowed.

`autonomy_knowledge {agentId,version,knowledgeIds}` is paused owner-only, ≤4 current company documents, and requires actual document grants (restricted docs must name the agent). Child selection also stays within current parent scope. It updates only the profile and queued/unclaimed/unfrozen work; existing frozen work requires a new objective. Internal reads use `{role:'agent',companyId,workId,runId,fence}`, resolve the real current actor, intersect scope and current JBrain grants, and recheck revocation at the paid gate. No owner token or implicit whole-company document grant is created.

### Private views, evidence and remaining gates

`autonomy_view` returns exact owner-only collection/event/data/financial-event allowlists, bounded cursor/limit and Rules-owned permittedActions. It joins original financial facts without another balance ledger. `agent.created`, `agent.started`, `agent.stopped` and `agent.updated` cover actual profile/claim/resource/knowledge/runtime/retirement transitions. Stops distinguish local completion, proof hold, child waiting, pause and remote reconciliation; they never claim remote cancellation. Public disclosure fields were not widened.

Final focused validation: `node --test test/rules/*.test.mjs test/autonomy/*.test.mjs test/state-money/*.test.mjs` — **138 passed, 0 failed, 0 skipped**; `/tmp/near1-rules-none-final.log`. Syntax checks of all **27** owned JavaScript files pass. This includes actual Journal/Treasury +2 and final-fence tests, actual native JBrain request/revocation integration, the request-driven controlled manager→specialist→gap→backlog→developer→fixed-evaluator loop, shared inference capacity, strict proof holds, repeated result recovery and stable unavailable-authority counters. SDK positive findings and model reasoning are explicitly controlled test fixtures; no paid live reasoning was proved.

Coordinator owns broad post-freeze tests/native checks, SDK composition/cache callback, real context/evaluation consumers, app/server/UI and final product status. The current official SDK durable plaintext replay limitation, exact live credentials/bounds/credit authorization, custody/finality/refund/procurement gates remain real M3/M4 blockers. Local M01 implementation and controlled M2 evidence do not close them. Same thread remains available for concrete follow-ups.

---

## Current NEAR SDK / bounded component implementation — 13 November 2026

**WORKER_DONE for the approved reversible Rules scope.** Implemented the coordinator-approved handshake in M01 paths only. No SDK/provider/paid calls, provisioning, money movement, common dependency edits or plan/critique edits. The default product remains setup-only; no commercial defaults or example budgets were added. Earlier sections below preserve previous revisions and their historical counts.

New `src/rules/verification.mjs` owns strict Cloud verification policy/binding/acceptance and the shared exact provider-price ceiling arithmetic. New `src/rules/components.mjs` owns bounded component authorization/preflight/spend/usage decisions. `config.mjs`, `index.mjs` and `runtime.mjs` integrate them. There is no local cryptographic signature/attestation implementation: SDK findings come from trusted composition, while SHA-256 is used only to bind exact bytes/content.

### Strict verification contract

Optional config `inferenceVerification:{allowedTcbStatuses,maxAttestationAgeMs}` validates a nonempty unique SDK TCB list and a 1..3600000 ms age. Absence selects **UpToDate only, 300000 ms** as technical verification requirements, never spending authority. Revoked/Unknown are inadmissible. OutOfDate and other supported advisory statuses require explicit config and change the policy fingerprint. Gateway/model attestation and response signature cannot be disabled.

Live research `plan.researchSpec.generationBounds.verificationSpec` and component preflight return the same exact spec:

```js
{schemaVersion:1, route:'near-tee-e2ee-chat', signingAlgo:'ed25519',
 sdk:{name:'@nearai/inference-sdk',version:'0.3.0',nodeEntry:true},
 requireGatewayAttestation:true, requireModelAttestation:true,
 requireResponseSignature:true, allowedTcbStatuses:['UpToDate'],
 maxAttestationAgeMs:300000, attestationCacheTimeToLiveMs:0,
 signatureKind:'provider_tee', policyFingerprint}
```

Explicit valid config may change the two policy values. The whole spec is part of `GenerationRequest` and its shared fingerprint. Stripped/changed spec, wrong SDK/source/model/policy, absent gateway or model report, unapproved TCB, missing verified nonce/signer, expired local verification, failed/unavailable verification and conflicting latest results hold. Freshness is **nonce plus local verification time with cache TTL zero**; no signed quote timestamp is invented. Owner/provider JSON proof booleans in request facts supply no authority.

Only private `getRuntimeFacts().verificationResults[]` supplies local verifier records:

```js
{id,stage:'preflight'|'response',status:'verified'|'failed'|'unavailable',
 source:'local-sdk',sdkVersion:'0.3.0',
 sdk:{name:'@nearai/inference-sdk',version:'0.3.0',nodeEntry:true},
 requestFingerprint,model,policyFingerprint,verificationPolicyFingerprint?,
 verifiedAt:<ISO>,evidenceRef,
 gateway:{tcbStatus,nonce,nonceVerified:true,verifiedAt:<ISO>,
          signer:{signingAlgo:'ed25519',signingAddress}},
 models:[/* same verified attestation facts */],
 requestBytesHash?,responseBytesHash?,responsePlaintextHash?,
 signatureKind?,wireSignatureVerified?,plaintextBindingStatus?,durableReplayStatus?}
```

The optional policy alias must equal `policyFingerprint`, never a separate authority. A read-only deployment preflight may omit completion bytes. Actual paid dispatch requires its prepared completion `requestBytesHash`; it is frozen into the approved reservation and rechecked at the final gate. Attestation HTTP bodies are not completion bodies. Composition must retain a single current finding per ID when attaching prepared hashes; contradictory findings at the same verification time hold. New failed/unavailable findings supersede old success.

Live `report` and `deliver` independently require a trusted verified **provider_tee** response, exact ciphertext response hash, same prepared request hash, `wireSignatureVerified:true`, **both** `plaintextBindingStatus:'verified'` and `durableReplayStatus:'verified'`, and the exact artifact content UTF-8 SHA-256 equal to `responsePlaintextHash`. Full response-JSON/ciphertext hashes cannot stand in for that report text binding. Artifact edits after acceptance fail the delivery check. A persisted wire-only component request denies `COMPONENT_OUTPUT_NOT_FOR_DELIVERY`, including when a separate business authorization exists.

**Current official SDK limitation remains a hard gate:** public APIs can replay ciphertext signature verification but cannot export/import the ephemeral E2EE decryption key/closure for independently replayable plaintext binding after crash. Current adapter records therefore keep plaintext/replay unavailable and response status unavailable; business acceptance/delivery **hold**. Saved SDK booleans or plaintext JSON do not close G6. There is no non-E2EE downgrade, private-member access or custom crypto fallback.

### Bounded component contract (separate from sales)

`component_preflight` is owner-authenticated and read-only, allowed in setup and during a valid kill. Exact action keys: `{id,type:'component_preflight',model?,requestFingerprint?}`. Model is server-selected by `createRules({componentModel})`, trusted `runtime.componentModel`, or attached config model. Request-selected different models deny. Bare owner preflight returns:

```js
plan = {kind:'component_preflight',model,verificationSpec,
 request:{model,verificationSpec},requestFingerprint:fingerprint(request),
 readOnly:true,timeoutMs:5000,grantsSpendingAuthority:false}
```

It grants no `inference_proof` readiness or paid permit. For a full paid-preparation preflight, facts supply `{access,request}` and action supplies its exact fingerprint; Rules matches the **private** `getComponentAuthorization().request`. Plan additionally returns the exact paid action below, `creditId` and `proofScope:'wire-only'`. No arbitrary JSON request becomes approved by preflight.

Paid `component_inference` requires an attached valid explicit **live commercial config**, current kill/epoch, server-verified owner, and a separate one-shot private `getComponentAuthorization` record. No setup-mode paid path or fake commercial config. All grant fields are required:

```js
{id,companyId,provider:'near-ai-cloud',model,policyVersion,
 verificationPolicyFingerprint,requestFingerprint,
 request:{model,messages,maxInputBytes,maxOutputTokens,timeoutMs,
          chargeBound,verificationSpec},creditId,creditScopeId,
 notBefore,expiresAt,maxCalls:1,maxCostNanoUsd,dailyCapNanoUsd,
 maxInputBytes,maxInputTokens,maxOutputTokens,maxReasoningTokens,
 timeoutMs,proofScope:'wire-only'}
```

Exact action returned in preflight plan:

```js
{id:`component:${grant.id}`,type:'component_inference',mode:'live',model,
 requestFingerprint,maxCostNanoUsd,
 bounds:{inputTokens:grant.maxInputTokens,outputTokens:grant.maxOutputTokens,
         reasoningTokens:grant.maxReasoningTokens}}
```

Call evaluate with `{access,request:plan.request,creditId:plan.creditId,financial:treasury.snapshot()}`. This bypasses **only** company activation/sales/all-wallet/previous-inference-proof readiness. It still requires current verified inference model/bounds/credit observations, fresh matched scoped G3 credit, an explicit opened credit lot with exact grant binding, current provider price/bound evidence, strict prepared preflight, request/daily/global caps, held/unknown costs and all normal permit persistence/version checks. Exact price ceiling uses integer nanoUSD per million token rates and ceiling division. `getInferenceBounds` requires verified status/model/reference/current validUntil/reasoning-inclusive completion bound and input/output nanoUSD-per-million rates. Owner JSON/catalogue prices alone do not justify a verified `inference_bounds` observation; actual input/output/reasoning enforcement must be established. A zero reasoning limit does not itself turn off model reasoning. Missing technical bounds stay configured/unavailable and block paid dispatch.

Approved plan remains `kind:'reservation'`, `reservation.purpose:'inference'`, no order/payment, plus `creditId`, `proofScope`, request fingerprint and prepared byte hash. Decision and permit `authorizationId` both equal the component grant ID; permit also binds the complete current authorization fingerprint. Existing Treasury protocol is unchanged: evaluate v → apply exact plan v+1 → validate → consume v+2 → re-read → immediate final callback. Re-evaluation after any approved use rejects `COMPONENT_AUTHORIZATION_USED`; restart cannot renew the one-shot authorization. Revocation/expiry, lowered caps, policy/credit/proof changes, unknown costs and regenerated ciphertext block the next callback. No automatic provider retry is authorized.

Orderless actual usage: action `{id,type:'component_consumption',resultId}`, facts `{access,financial}` selects one trusted `runtime.componentResults[]` item `{id,source:'local-sdk',authorizationId,actionId,requestFingerprint,evidenceRef,result}`. The result must have actual attributed cost and a receipt `{id?,binding,watermark,providerReference}`. Rules matches the original component plan/credit lot and reuses existing consumption arithmetic; output remains `kind:'consumption'` with exact scoped metadata, no invented order/remedy patch. Unknown/missing actual bill holds and leaves the reservation. Real provider billing/watermark attribution is not implemented by this Rules port; unavailable facts remain unavailable.

### Safe public readiness

Anonymous `evaluate({id,type:'public_readiness'})` returns only `plan:{kind:'public_readiness',ready,setupRequired,capabilities:[{capability,status,reasonCode,expiresAt}]}`. It is freshly derived from trusted observations on every call, so expired success becomes unavailable. Reasons are a Rules-owned allowlist; arbitrary provider reasons become `CAPABILITY_NOT_VERIFIED`. No IDs, providers, identities, bindings, accounts, grants, prompts, private evidence refs or raw journal records enter this plan. Coordinator replaces direct public `journal.list(runtimeFacts)` exposure with this exact projection. Malformed commercial policy retains only the existing narrow accepted-ledger exception; public readiness does not add a permissive fallback.

### Checks and integration handoff

- `node --test test/rules/*.test.mjs test/state-money/*.test.mjs` — **100 passed, 0 failed, 0 skipped** (66 Rules, 34 state/money). Log `/tmp/near1-rules-sdk-focused.log`.
- Syntax checks for all **20** owned JS modules/test fixtures — pass.
- New focused files: `test/rules/{verification,components}.test.mjs`; explicit synthetic helpers `verification-fixtures.mjs`, `component-fixtures.mjs`. Existing live policy fixtures now supply explicit controlled SDK records; no fixture is a real verification claim.
- State worker independently exercised the actual Journal/Treasury component +2 protocol, exact authorization IDs, final callback once and durable reuse rejection; reported no M03 incompatibility and made no Treasury policy change.

Coordinator owns SDK pin/Node floor, protected-hook byte capture/replay, runtime/CLI/auth composition, actual provider facts, safe web projection and broader integration tests. M01 does not claim any live component or funded product proof. G6 plaintext replay, actual provider charge/token guarantees, attributable credit/billing and all previous custody/refund/funding gates remain open. Same worker thread is available for concrete integration follow-ups.

---

## Current revision 2 implementation — 13 November 2026

**WORKER_DONE: approved reversible M01 G2/G3/G8 changes implemented.** Changes are confined to `src/rules/`, `test/rules/` and this handoff. The reviewed plan and critique were read and were not edited. Demonstration `config*.yaml` are unchanged and remain explicit fixture inputs; product startup must use the coordinator's setup-only composition, never those files implicitly. No provider calls, paid calls, accounts, grants, funds, publication, new chats or common setup changes were made. The sections below this current entry preserve earlier work/history and their old test counts.

### Current files and exact API

- `src/rules/index.mjs`: integrates the trusted runtime port, setup-only policy, company-scoped owner setup/action matrix, readiness and economic gates at evaluation **and final dispatch**. Engine methods remain `evaluate`, `validateDispatch`, `dispatch`, `snapshot`, `updateConfig`, `reload`; canonical decision `status`, plan `kind` and shared fingerprints are unchanged.
- `src/rules/runtime.mjs`: pure owner access, observation readiness and read-only probe policy. `src/rules/economic.mjs`: pure exact snapshot comparisons, dedicated opening/receipt decisions and current economic safety. Both stay inside the single M01 authority; neither reads providers or owns balances.
- Updated `business.mjs`, `setup.mjs`, `knowledge.mjs`, `policies.mjs`: observed readiness replaces live-mode labels; nonfixture paid-checklist entitlement/procurement is unavailable; free authored guidance remains metadata/content; public services reject private knowledge; agent-scoped owner reads retain agent grants.
- Added `test/rules/runtime.test.mjs` and `test/rules/economic.test.mjs`. Existing tests, configs and bookkeeping/calculation behavior remain covered.

`createRules({setupOnly:true,companyId,clock,getRuntimeFacts,...})`, with **no explicit `config` or `configPath`**, starts with `snapshot.mode:'setup'`, `config:null`, `policyVersion:null`, `setupRequired:true`, no price/wallet/model and no inferred commercial cap. Owner-authenticated metadata/import/setup and scoped probes work. Every offer/publication/activation/task/effect holds `COMMERCIAL_POLICY_REQUIRED`. Public `access` resources `status`/`storefront` return only a setup-required access plan with no permitted actions; authenticated `workspace`/`owner` reads are supported. Ledger/private-report disclosure has no startup fallback. Explicit missing/malformed policy remains `INVALID_CONFIG`, even when setupOnly was supplied. Direct `updateConfig`/reload remains a trusted composition method, never model/request authority.

In nonfixture modes, zero-budget owner actions require actual `facts.access:{verified:true,role:'owner',companyId:<exact engine company>}`. Fixture `verifiedLocal` is accepted only in explicit fixture composition. No authorization/env credential implies money authority. Zero-budget actions: `agent_manage`, `organization_manage`, `organization_setup`, `organization_setup_review`, `knowledge_import`, `knowledge_manage`, owner `knowledge_read`, `resource_bind`, `runtime_readiness`, `runtime_probe`; configured owner `company_pause` also needs no funded authorization. Pause/read-only probes work during a valid kill, while new effects remain blocked. Invalid current commercial config retains only the previously implemented narrow last-accepted public ledger read exception.

For an explicit metadata runtime change, pass `facts.input.runtime`. A setup-created profile may select `'live'` only after commercial config is live: `agent_manage` returns `plan.agentPatch:{runtime:'live'}` and `grantsSpendingAuthority:false`. Coordinator persists this exact patch on an authenticated explicit update. No input runtime means no patch; fixture-to-live/history relabeling and other mode changes deny `RUNTIME_METADATA_CHANGE_DENIED`. This does not make a provider ready or authorize a task.

### Readiness and probes

Trusted composition callback only:

```js
getRuntimeFacts: () => ({ observations: [], economicIdentity,
  economicObservations: [], economicReceipts: [] })
```

Request `facts.observations`, `facts.runtimeFacts`, mode, infrastructure badges and pricing JSON cannot supply runtime authority. Observation shape is exactly the agreed `{id,capability,provider,status:'verified'|'configured'|'unavailable',observedAt,expiresAt,identity:{companyId,network,treasuryAccount,bucket},policyVersion?,evidenceRef?,reasonCode?}`.

`evaluate({id,type:'runtime_readiness'}, {access})` allows a factual `plan:{kind:'runtime_readiness',ready,requirements:[{capability,status,reasonCode,observationId?,expiresAt?}],grantsSpendingAuthority:false}`. Capabilities: `custody_identity`, `custody_policy`, `custody_grant`, `custody_balance`, `payments_route`, `refund_route`, `inference_model`, `inference_bounds`, `inference_credit`, `inference_proof`, `jbrain`, `public_retrieval`. Verified observations require evidence, current identity, valid/fresh times and no conflicting latest record. Policy-bound custody policy/grant, payment/refund routes, inference bounds/proof require the current policy fingerprint. New unavailable/configured observations supersede older verified observations. The current live route requires the selected confidential bucket. Missing facts remain unavailable; no mode-derived readiness.

JBrain/public retrieval can verify isolated company health with explicit null network/account/bucket in setup. Overall setup readiness always remains false with `commercialPolicyRequired:true`. Financial capabilities cannot verify from null identity. All critical readiness plus a separate current owner-funded authorization are required before activation/publication/new commercial work or paid effects; effect execution also requires active current-policy company state and current economic reconciliation.

`evaluate({id,type:'runtime_probe',capability}, {access})` allows exactly `{kind:'runtime_probe',capability,readOnly:true,ttlMs:60000,grantsSpendingAuthority:false}`. `public_retrieval` also returns `{maxBytes:65536,timeoutMs:5000,maxRedirects:2}`. Caller URL/method/body/money/limit overrides are denied. These authorize only the named observation adapter, never policy/grant/account writes, signatures, inference, quote/deposit creation or funding. Composition passes the exact technical bounds to probes. Metadata actions never require all financial capabilities to be ready.

### G3 economic records

`economicIdentity` selects actual provider/account/network/bucket/asset identity. Cash may use a full `cashBinding` or root provider/accountId (or treasuryAccount), network/bucket and asset/decimals (or settlementAsset). Credit requires its explicit `creditBinding`, because a Cloud account is a separate balance domain. Binding is the frozen `{provider,companyId,accountId,organizationId:null|string,credentialId:null|string,network,asset,decimals,bucket}`. No missing commercial value is manufactured.

- Action `balance_snapshot` with `observationId` selects **one trusted** `economicObservations[]` record `{...agreed observation,status:'verified'}`. Optional trusted `unresolvedOperationIds` supplements local unknown/pending reservations. Plan `{kind:'balance_snapshot',observation,reconciliation:{status,expectedAmount,observedAmount,unresolvedOperationIds,reasonCode?}}` computes exact current comparison. No opening/attribution means unreconciled, in-flight outcomes mean pending, otherwise deficit/surplus/matched. Snapshots never create cash, credits, lots or inferred receipts. Stale/changed-stream provider positions cannot advance reconciliation. Snapshot `money`/credit amounts and bindings stay private; safe `balance.observed` markers expose only id/observationId/scopeId/resource/status/mode/watermark/evidenceRef. The corresponding safe marker names were added to the public field allowlist; no raw provider binding/credential or comparison amounts were added.
- Actions `cash_opening`, `credit_opening`, `cash_receipt`, `credit_receipt` select `receiptId` from trusted `economicReceipts[]`, requiring `status:'verified'`, matching `kind`, exact binding/watermark/evidence/provenance and Money or credit. Opening additionally requires trusted `ownerBindingApproval:{id,companyId,scopeId:fingerprint({resource,binding}),policyVersion}`; it is allowed only once and before any same-resource balances/lots/history, including a spent zero legacy resource. A snapshot transition never establishes this approval. Subsequent receipt requires a verified unique `providerReference` strictly after the opening boundary and in the same stream. Snapshot IDs cannot stand in for transaction IDs. Nonfixture legacy `capital_record`/`credit_record` deny `LEGACY_ECONOMIC_IMPORT_DISABLED`.
- Effects/final dispatch require actual stored `providerObservations[]` + latest `balanceReconciliations[]` with matched units/expected amount/scope. Any deficit/surplus/pending/unreconciled/missing/stale comparison holds. Crucially the stored match must also equal the current trusted economic observation: a new unposted provider deficit/unavailable record cannot be ignored. Maximum current observation age is **less than 60000 ms**, optional expiry is honored, and a newer position/identity/evidence/amount must be reconciled before spending. `economicSafety(financial,runtime,config,companyId,resources,nowMs)` is pure and requires explicit time. Malformed safety facts return a structured final-gate denial; callbacks never start.

State worker implemented and tested the exact G3 shapes, immutable histories and post-opening receipt metadata checks. Subsequent sale/usage/funding/payout/refund postings must carry real binding/watermark/providerReference from provider evidence. No local clock or guessed receipt supplies ordering; missing facts stay pending/unposted. Current provider contract/proof/billing/route gaps remain funded stop gates, not solved by this bookkeeping API.

### G8 knowledge and acceptance

Nonfixture public service activation/service-order and service-bound execution deny `CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED` for nonempty private knowledge selections/context. There is no implicit company-read-to-customer-publication grant. Exact revision/audience approval is future work, not an enabled bypass. Internal `knowledge_context` still checks the actual agent's current grant and permits already frozen historical revisions without silently recapturing a new private revision. `knowledge_read` returns all documents to an authenticated owner only with **no `facts.agent`**; a supplied agent always gets its scoped grant projection.

Checks run on this shared checkout:

- `node --test test/rules/*.test.mjs test/state-money/*.test.mjs` — **88 passed, 0 failed, 0 skipped** (54 Rules + 34 state/money); includes actual Rules/Treasury opening/snapshot/deficit and existing real journal/permit roundtrips. Log `/tmp/near1-rules-r2-checks-20261113.log`.
- Syntax checks for all `src/rules/*.mjs` and `test/rules/*.mjs` — pass (14 modules/fixtures).

Evidence is controlled local tests and trusted synthetic observation fixtures, **not live vendor validation**. No funded product readiness claim. Coordinator owns HTTP-auth propagation, default setup-only composition without demo seed/imports, exact probe execution/economic evidence persistence, explicit agent runtime metadata patch persistence, common contracts and broad integration tests. Old live stand-in tests must supply explicit trusted observations/openings/reconciliation and authenticated owner context; mode labels are intentionally insufficient. Provider proof verification, spendable checkout/refund domain, fees, actual balance attribution, supported autonomous Cloud acquisition and a real supplier remain hard stop gates. Available for follow-ups in this same worker thread; no need to weaken policies to preserve old assumptions.

---

Status: implemented; focused acceptance passes, including the final pre-inference evidence audit. Owned paths only were edited. No agents/chats, wallets/accounts, funds, paid inference, staging, deployment or publication were created.

## Files and exports

- `src/rules/index.mjs`: `createRules`, `validateConfig`, `ConfigError`, `calculateSplit`, `parseConfigYaml`. Engine methods: synchronous `evaluate(action,facts)`, `validateDispatch(permit,facts)`, `dispatch(permit,facts,callback)`, `updateConfig(parsed)`, `reload()`, `snapshot()`.
- `src/rules/config.mjs`: strict parsed-object validation, exact integer/unit helpers, immutable accepted config. Canonical fingerprints use the coordinator's `src/contracts.mjs`; no competing contracts or config loader elsewhere.
- `src/rules/policies.mjs`: small pure pricing, exact split, settlement/allocation, spend, eligibility/next action, report, access/disclosure, retry, payout/refund decisions.
- `src/rules/records.mjs`: exact bootstrap, funding, consumption, payout/refund reconciliation, unknown-reservation, remedy and late-payment bookkeeping plans.
- `config.yaml`, `config.example.yaml`: identical demonstration values, `mode: fixture`, `liveAuthorized: false`. No secrets. Live/testnet effects fail closed even if mode is changed. Fixture bootstrap and nanoUSD-to-demo-token conversion are explicitly fixture facts/policy, never a live exchange-rate assertion.
- `test/rules/{fixtures,rules.test,dispatch-roundtrip.test}.mjs`: focused deterministic fixtures plus actual journal/Treasury roundtrips.

## Frozen boundary

Canonical decision discriminator is `status: allow|deny|hold`. Exact plan discriminator is `plan.kind`. Amounts are nonnegative integer strings, token atomic units and USD nano-units separate. All decisions include action fingerprint, policy version/epoch and supplied financial/order versions.

Actions: `offer`, `settlement`, `allocate`, `funding`, `research`, `evidence`, `inference`, `report`, `deliver`, `payout`, `refund`, `retry`, `access`, `disclosure`, `next`, `complete`; observation/bookkeeping actions `bootstrap`, `funding_record`, `consumption`, `payout_record`, `refund_record`, `reservation_update`, `late_payment`, `remedy`, `reconcile`.

Facts use the exact coordinator/state-worker FinancialSnapshot. Additional data: `order`, `offer`, `payment`, `obligation`, `report` or `reportFacts`, `evidencePack`, `access`, `capabilities`, `operation`, adapter `result`/optional `receipt`, `reservationId`, `creditId`.

Frozen offer includes `id`, `orderId`, `policyVersion`, `configVersion`, `minimumPrice:Money`, `price:Money`, `settlementAsset`, `treasuryAccount`, `contributors:[{account,bps}]`, `treasuryBps`, creation/expiry, refund/report requirements, mode and source payment asset. Old amounts/recipients remain frozen; current kill, cap, mode and request limits govern the next effect. Contributors round down in atomic units; treasury receives the exact indivisible remainder. Shares must total 10,000 bps.

`next` returns canonical `decision.action` (also `plan.action`), `nextAction`, `plan.nextAction`, and Rules-owned `permittedActions` (also in plan). Funding action contains exact recipient, agent identity, Money, maximum/required credit; inference action contains current maximum charge and bounded token counts. `credit_ready` is a permitted local state update when observed existing credit suffices. Workflow adds technical request fingerprints before evaluating inference. It must not calculate commercial amounts or recreate action eligibility.

Research decisions return `plan.researchSpec` in the agreed M08 shape. Before assembly/readiness, action `evidence` takes `facts.evidencePack` (fallback `order.evidencePack`) and checks matching order, enough distinct bounded nonempty source records, explicit retrieval dates, configured publication/age/free-source requirements, input bounds, and zero retrieval errors. It returns allow `plan:{kind:'evidence',accepted:true,qualifications}` or hold with `accepted:false`, exact failure codes, `plan.orderPatch:{remedyRequired:true,evidenceReady:false,reasonCode}`, and next action refund. Inference evaluation and final dispatch independently run this gate too; an `evidenceReady:true` boolean alone cannot authorize a paid call. Date/source inspection is shared with full report acceptance. Report decisions consume actual M08 counts/citation lists/overlap/excerpt/source records, not invented truth/relevance booleans. Missing source records cannot bypass acceptance. Unknown publication dates are accepted only when configured and return explicit qualifications distinguishing retrieval from publication. Grounding/structural checks do not prove every conclusion true. Report rejection and verified late payment supply `plan.orderPatch` for remedy; definitive failed service requires reconciled actual cost before an approved remedy patch. Overrun consumption records the actual cost and supplies a remedy patch.

Allocation protects a contributor bucket and a *separately funded*, disjoint full refund bucket; `refundExposure` remains separate. Existing free fixture bootstrap cash backs this reserve. Without sufficient backing Rules holds. Refund approval requires its own recorded refund reserve; payout requires its own contributor reserve. Refund confirmation alone releases exact protected funds and reverses unpaid allocations. Paid contributions are never assumed clawed back.

## Final dispatch protocol

1. Evaluate effect at financial version v; persist its exact plan via Treasury using the same action id.
2. At v+1 call `validateDispatch(originalPermit,{action,order:currentOrder,financial:freshSnapshot,...facts})`. It requires the exact persisted `approvedPlans` entry and returns a fresh decision with financialVersion v+1.
3. Pass that fresh pre-consumption decision plus the original permit to `treasury.consumePermit`; it records the original permit and advances to v+2.
4. Re-read the financial snapshot; call `rules.dispatch` with explicit current action/order/financial facts and a callback that begins the provider call synchronously. Dispatch verifies the exact plan, consumed permit proof, versions, signature, expiry, current config/kill/cap and held costs before invoking once. Do not await inside the callback before starting the effect.

Any unrelated financial mutation conflicts. Accepted config changes invalidate outstanding permits. Permits are process-local HMAC capabilities; restart invalidates them and requires reevaluation/reconciliation. A consumed or ambiguous permit is never reusable. Config is re-read synchronously at every evaluation/final gate; the measured kill detection is at the next gate, not cancellation of an already sent effect. Invalid reload fails closed. Read-only observation/reconciliation remains available during a valid configured kill.

## Exact verification

- `node --test test/rules/*.test.mjs` — **32 passed, 0 failed**.
- `node --check src/rules/index.mjs` — pass.
- `node --check src/rules/config.mjs` — pass.
- `node --check src/rules/policies.mjs` — pass.
- `node --check src/rules/records.mjs` — pass.

Coverage: four user rules; malformed/missing/duplicate/alias YAML and malformed parsed config; change-only-config pricing/split/cap/report/access; huge/odd integer rounding; confirmed/underpaid/wrong/late/unknown settlements; exact funded allocation; actual+held daily cap boundaries, prior-day unknown holds; credit/resource affordability; bounded request/recipient validation; shared fingerprint/signature/epoch/version/expiry/replay checks; concurrent stale plan CAS; file kill rewrite detected below one second (last focused test ~5 ms including rewrite/check); frozen old recipient and partial due; report factual acceptance and date limitations; customer/public/owner access; retry/refund allow/deny/hold; exact funding and usage records; rejected-report and late-payment refunds through the actual journal/Treasury; restart preserves reservation and consumption proof.

## Mode, blockers and next step

M01 is contract-tested and fixture-integrated. No live vendor behavior is claimed. Credentials, explicit funded live access/caps, official Intents testnet and autonomous Cloud purchasing remain unestablished. These do not block the local Rules implementation.

Coordinator installed `yaml` and owns package/lockfile; no additional dependency or script change is requested. State worker has implemented the requested exact refund_intent/refund and late_payment plans. Coordinator owns final workflow remedies, recovery, UI and broad integration checks; rerun those after the last Rules changes. Trusted composition should record returned policy snapshots/decisions in M02 where required; Rules does not own persistence. Owner-only config update methods must remain outside model/browser authority. This handoff permits coordinator integration; send follow-ups in the existing Rules thread for changes within these paths.

Final degraded-read audit: malformed reload may authorize only `access resource:'ledger'` and public `disclosure` (resource omitted or ledger), using the retained last **accepted** config with publicLedger:true. Allowed decisions/plans carry `degraded:true`, `currentSafetyValid:false`, `readPolicyVersion` of the accepted config, `businessEffectsAllowed:false`, and decision reason `LAST_ACCEPTED_LEDGER_POLICY`; access permittedActions is empty. New business effects and private report/owner/storefront access remain denied while config is invalid. Startup without an accepted config has no fallback, and malformed changes cannot grant access when the accepted policy disabled the public ledger. Parsed-invalid and malformed YAML hot-reload regressions both pass. Coordinator should verify the HTTP ledger read remains 200 with recorded safe events while new order creation is rejected; no ledger/web cache or alternate policy was added.

## 13 November — real-execution planning and independent review handoff

The user requested a plan to remove dummy product runtime implementations, connect real tools throughout, and have the existing project critique review it with current project context. New planning artifacts: `docs/REAL_EXECUTION_PLAN.md` revision 2 and independently authored `docs/REAL_EXECUTION_CRITIQUE.md`. Final plan SHA-256: `66ece30643ef99f9ed64148f8142f695b6e16a1cc40334dc06d4fcd658cf56da`. Existing critique thread `mcp:be9af1f4-d61f-43be-829e-349caf627657` verified this exact hash and appended its revision-2 recheck. No new agents/chats were created. Planning/review threads did not edit runtime or move money.

Verdict: **ready with conditions to implement the revised sequence; strict funded/live product not ready**. All 11 review findings have planning dispositions, not runtime closure. Concrete gates cover actual spendable settlement/custody domains, authenticated zero-budget setup, absolute snapshot reconciliation, signed quotes/finality/times, predeposit refund domain/action/fees, durable exact Cloud bytes/preflight/proof/billing, original-key recovery and submitted-effect stop semantics, customer publication approval by exact knowledge revision, full economic store binding and clean JBrain packaging. Capacity/timeboxes separate real bounded research, real prepaid service fulfilment and full autonomous funding/procurement. The proposed narrower API-capability brief is explicitly a user decision; no market-service pivot is authorized.

Fresh checks before final coordinator additions: `npm test` 163/163 passed (~12.47s), `npm run check` 57 files passed; log `/tmp/near1-real-plan-tests-20261113.log`. Coordinator subsequently reports 164/164, seven focused business tests,57 syntax checks and fixture browser desktop/mobile proof. These are local/stand-in evidence. Cloud SDK/search/verification were researched, not installed or executed here. Provider contract drift and purchasing remain hard gates. Current user caps/accounts/provider signatures are not supplied by this handoff.

Coordinator has both docs and the reversible R0/R1 priorities under existing ownership: zero-budget owner setup/factual readiness; absolute financial-observation reconciliation; customer-disclosure boundary; production fixture isolation; economic identity and clean-start checks. Keep existing regression fixtures test-only and historical stores truthful. Prepare each bounded component and its local failure tests before requesting its specific authorized live proof; do not wait for unrelated UI or supplier work. No blanket funded authorization, publication or silent provider/network substitution is granted.
