# MVP contract/export guide — v1

Frozen integration vocabulary, Node ESM, schemaVersion 1. Small records, not a framework. Only M01 reads config.yaml or makes business decisions. Money `{network,asset,decimals,amount}` and nanoUSD amounts use **nonnegative integer strings**, no float arithmetic. Helpers from src/contracts.mjs: fingerprint/canonicalize, assertMoney/validateMoney, sameAsset, assertIntegerString, assertExternalResult, assertOperation, assertOrderSpec. Technical validation may throw `{code,message}`; policy results are plain RulesDecision. ExternalResult is plain `{status,mode,operation?,evidence,...payload}`; status not_submitted/pending/confirmed/failed/unknown; adapter mode testnet/live/unavailable; test-only adapters use fixture. Product workspace mode also includes setup. A timeout never becomes zero charge or proof of no effect.

## Current NEAR verification additions — 13 November 2026

See [NEAR_VERIFICATION.md](NEAR_VERIFICATION.md) and current SDK worker handoffs for exact record fields. Root dependencies pin official Cloud0.3.0, 1Click0.1.26 and Agent API0.9.0; Node>=24.22.1.

M01 `inferenceVerification` and live GenerationRequest.verificationSpec require nonce/freshness/TCB/gateway/model/provider_tee response checks. Only trusted runtime.verificationResults may supply local SDK findings. Prepared requestBytesHash is part of the exact reservation and immediate final gate; delivery also binds artifact.content hash to a durably verified plaintext result. Current SDK E2EE plaintext/replay is unavailable, so strict delivery holds.

`createCloudVerification({journal,clock,secretRef,resolveSecret,limits})` from src/inference/verification.mjs exposes preflight/prepare/replay. `prepare` returns a single-use send function with preflight/requestFingerprint/requestBytesHash/evidenceRef properties. All asynchronous preparation/storage/credentials occur before the callback starts pinned POST synchronously. Response results retain explicit process verification versus unavailable durable plaintext findings. No SDK private member is accessed.

`createCloudComponents` from src/runtime/components.mjs exposes describe/preflight/replay/inspect/execute. Owner POST `/api/workspace/inference/preflight` accepts only `{}`; GET `/api/workspace/inference/plan` returns the M01 plan. Paid execution is opt-in CLI only, with private exact getComponentAuthorization and trusted componentResults for orderless actual usage. One-shot action component_inference uses the existing Treasury+2 permit flow and cannot publish. Unknown original operations are never resent. Startup and UI preflight send no completion.

Anonymous public_readiness returns exact minimal fresh plan.capabilities; /api/status does not attach raw runtime observations. Private identity, refs and raw reason strings are excluded.

`createPaymentSignatureVerifier({journal,clock})` verifies private captured quote/status envelopes through official pinned SDK trust. Nested quote verification does not authenticate mutable status or finality. `createAgentProofs` capture/replay checks signed audit evidence plus separately pinned TDX/finality ports; it grants neither spending nor delivery. Its overall audit success is not independent account/asset/amount movement proof; the adapter retains unknown money status.

## Current revision 2 additions — 13 November 2026

Product `createApp` starts setup-only when no explicit config/configPath is supplied. No policy, price, bootstrap, profile or fixture output is selected. Its runtime imports cannot reach test helpers. `test/helpers/create-fixture-app.mjs` is the sole explicit fixture app entry; test-only factories are exported from `test/integrations-adapters/fixture-adapters.mjs`. Historical stores are never relabeled.

M01 adds `createRules({setupOnly,companyId,getRuntimeFacts,...})`. Server-derived owner context is `{verified:true,role:'owner',companyId}`. `verifiedLocal` is fixture-only. Metadata methods accept access context; explicit `facts.input.runtime:'live'` may return exact `plan.agentPatch` for a setup profile after a live policy is selected. Persist only that approved patch. No readiness or budget follows from it.

Trusted callback returns `{observations,economicIdentity,economicObservations,economicReceipts}`. HTTP/request facts cannot substitute for this port. `runtime_readiness` returns `plan:{kind:'runtime_readiness',ready,requirements,grantsSpendingAuthority:false}`. Setup additionally requires a commercial policy. Requirements use capability/status/reasonCode/observationId?/expiresAt?. Known scopes: custody_identity, custody_policy, custody_grant, custody_balance, payments_route, refund_route, inference_model, inference_bounds, inference_credit, inference_proof, jbrain, public_retrieval.

`runtime_probe` accepts only id/type/mode?/capability. M01 plan is readOnly, ttlMs60000, grantsSpendingAuthority:false; public_retrieval adds maxBytes65536/timeoutMs5000/maxRedirects2. GET `/api/workspace/readiness` and POST `/api/workspace/probes` with `{capability}` require server owner access. No automatic probes, paid calls or provisioning. Observations persist private exact-byte evidence references and identity/policy/time. Catalog membership alone cannot verify payment routes, credit or proof.

Probe exports: `createCloudModelProbe` from inference/probes.mjs; `createPaymentTokensProbe` from payments/probes.mjs; `createAgentApiProbes` from custody/probes.mjs. Common options `{binding:{companyId,network,treasuryAccount,bucket},policyVersion,clock,ttlMs,persistEvidence,transport}`. Model/token probes expose probe(); Agent exposes probe()/identity()/policy()/grant()/balance(). Missing contracts remain unavailable. See integrations handoff for private raw read evidence and secret-free request schema.

G3 observation is `{id,resource:'cash'|'credit',binding:{provider,companyId,accountId,organizationId,credentialId,network,asset,decimals,bucket},watermark:{stream,position},observedAt,evidenceRef,money?|availableNanoUsd?}`. Integer positions and values are strings. Exact `plan.kind:'balance_snapshot'` carries observation plus M01 reconciliation `{status,expectedAmount,observedAmount,unresolvedOperationIds,reasonCode?}`. It changes no cash, lots or credit. Financial snapshot adds providerObservations/balanceReconciliations/reconciliationHistory/openingRecords/economicMovements.

`cash_opening`/`credit_opening` require trusted receipt, full scope, provider watermark, evidence, provenance and `ownerBindingApproval:{id,companyId,scopeId:fingerprint({resource,binding}),policyVersion}`. They occur once before movements. `cash_receipt`/`credit_receipt` require a discrete later provider reference/watermark. Existing sale/cost/payout/refund records also need scoped receipt metadata in bound stores. No additive capital/credit JSON import is permitted live. Fresh current trusted evidence must match stored reconciliation at evaluation and final dispatch; newer unposted, expired, unavailable or deficit observations hold.

Economic identity binds the persistent store to company/mode/provider/account/network/asset/bucket and explicit cash/credit bindings. Initial empty setup selection is allowed before economic activity; fixture conversion is denied. Public balance.observed omits absolute amounts and full binding. Opening/receipt events are separate from sales.

Public services with private knowledge are denied. Paid checklist licences are test-only until a real supplier and entitlement contract exists. Agent API SUCCESS/hash remains unknown without proof; Cloud proof is explicitly unavailable. Neither result is a Verified TEE claim.

## Factories and injected ports

- M01 `src/rules/index.mjs`: `createRules({config?,configPath?,parseYaml?,clock?})`; engine `evaluate(action,facts)`, `validateDispatch(permit,facts)`, `dispatch(permit,facts,callback)`, `updateConfig(parsed)`, `reload()`, `snapshot()`. YAML dependency installed by coordinator. Action `{type,id,orderId?,mode?,recipient?,money?,maxCostNanoUsd?,...}`; types **offer, settlement, allocate, funding, research, evidence, inference, report, deliver, payout, reconcile, retry, refund, access, disclosure, next, complete**. Facts `{financial,order,offer,obligation,payment,report,operation,access,capabilities,...}`. Decision `{status:'allow'|'deny'|'hold',reasonCode,policyVersion,policyEpoch,financialVersion,actionFingerprint,plan?,permit?}`. M01 determines next action and completion. M01 dispatch serializes final current safety check and callback invocation; callback must begin outbound call immediately without awaited gap.
- M02 `await createJournal({directory})`: sync snapshot/get(namespace,id)/list(namespace)/events({afterSequence})/getOperation/recoverableOperations; async transaction({actionId,fingerprint,expectedVersion?}, tx=>result) => `{replayed,version,result}`. Sync tx get/put(namespace,id,value,{expectedVersion?}), append(type,data), operation(intent), updateOperation(actionId,patch). No external calls in transaction. registerOperation/recordOperationResult convenience methods. One durable store chosen by composition. Financial version independent of journal version. Duplicate action+fingerprint returns existing committed result, payload collision CONFLICT. Private artifact put/get references stay private.
- M03 `createTreasury({journal})`: snapshot(), getObligation(id), async applyDecision({actionId,decision,expectedVersion?}), consumePermit({actionId,permit,decision,expectedVersion?}). Exact M01 plans below. No policy formulas. Only M03 changes financial facts.
- M04 `createCustodyAdapter({journal,dispatchAuthorized,transport?,resolveSecret?,mode,...})`: identity(), transfer(command), reconcile(command).
- M05 `createPaymentsAdapter({journal,transport?,mode,...})`: quote(command), verifySettlement(command). Customer signs. Quote requires frozen offer/source asset/network and exact recipient; settlement supplies verified facts for M01. Fixture confirmation is explicitly local and does not accept customer assertions as live receipts.
- M06 `createCloudFundingAdapter({journal,dispatchAuthorized,transport?,resolveSecret?,mode,...})`: fund(command), reconcile(command).
- M07 `createInferenceAdapter({journal,dispatchAuthorized,transport?,resolveSecret?,mode,...})`: generate(command), reconcile(command). GenerationRequest `{model,messages,maxInputBytes,maxOutputTokens,timeoutMs,chargeBound,orderId,evidenceHash,evidence:{sources:[...]}}`; output at ExternalResult.generation.output. All bounds from Rules. No made-up purchase route.
- M04/M06/M07 command `{action,decision,facts,permit?,...purposeFields}`. `dispatchAuthorized({action,decision,facts},callback)` is injected by composition: consume persisted permit then **re-read fresh financial facts**, call M01 dispatch final gate and immediately invoke callback once. Adapters persist intent+dispatching marker before dispatch; missing final gate fails closed. Use journal own namespaces `adapters:m04` etc. Fingerprint canonicalization uses shared helper; immutable action payload is what M01 fingerprints. Adapter technical errors fail closed; ask coordinator about shape changes.
- M08 `createResearch({retrieve?,clock?})`: collect({order,decision,sourceUrls?}) => EvidencePack; assemble({order,evidencePack,decision}) => GenerationRequest; candidate({order,evidencePack,generationResult,decision}) => `{artifact,reportFacts}`. Deterministic generation helpers exist only under test/helpers/. Research NEVER calls M07 or financial ports. Rules researchSpec below.
- M09 `createPayouts({journal,treasury,custody,rules?})`: fulfill({action,decision,facts,obligation,...}), reconcile(command). Exact obligation from M03 and M01 plan, never split arithmetic. Persistence before custody, unknown no blind retry.
- M10 `createWorkflow({journal,treasury,rules,custody,payments,funding,inference,research,payouts,clock?})`: createOrder(input), getOrder(id), quote(id), checkPayment(id), run(id), recover(), getReport(id,{token}), verifyAccess(id,token), status(). Workflow obtains M01 decision for every business action; journal owns durable order states, never pricing/thresholds/provider JSON.
- M11 `projectLedger(events,disclosurePlan)` pure projection; optional createLedger({journal,rules,treasury}) wrapper. M01 disclosure fields only, never raw private records.
- M12 `createWeb({workflow,ledger,rules,readiness?,ownerToken?})` => `{handle(request)}` using standard Web Request/Response. Top-level server bridges Node HTTP and serves public/. Endpoint contract below. Can export rendering helpers independently. Customer capability verified on server; M01 makes access decision. No browser role selector grants access.

## Rules exact plans

Use `plan.kind` as canonical discriminant; accept `kind ?? type` for compatibility. M01 supplies every exact amount; M03 only adds/subtracts stated amounts and checks units/integrity. Frozen offer uses settlement Money, contributor recipient/share basis points, config version/hash. Existing obligations retain those terms.

- allocation `{kind:'allocation',settlementId,orderId,revenue:Money,treasury:Money,contributorReserve:Money,refundReserve:Money,obligations:[{id,orderId,settlementId,recipient,money:Money,completedAmount:'0',status:'due',...}]}`. Cash buckets MUST be disjoint. Full refund *exposure* is a separate contingent fact; do not double-protect one sale's full refund alongside its contributor share. M01 determines the exact funded reserve and affordability treatment.
- reservation `{kind:'reservation',reservation:{id,actionId,accountingDay,upperBoundNanoUsd,status:'reserved',...}}` with optional exact locked Money.
- funding `{kind:'funding',receiptId,cashSpent:Money,credit:{id,owner,provider,availableNanoUsd,provenance,...}}`.
- consumption `{kind:'consumption',receiptId,reservationId,actualCostNanoUsd,creditId,remainingCreditNanoUsd,accountingDay}`. Unknown actual retains reservation; purchase is cash-to-credit, usage is expense.
- payout `{kind:'payout',obligationId,recipient,money:Money,completedAmount:Money|string,status}` (exact total/progress and transfer amounts must be distinguishable in implementation).
- refund/reconcile: M01 emits exact deltas/remaining reserve amounts, never a request for M03 to calculate policy. Coordinate additions in this guide before wiring.

Research decision `plan.researchSpec={maxSources,maxBytesPerSource,timeoutMs,maxRedirects,maxInputChars,sourceUrls?,reportRequirements,generationBounds:{model,maxInputBytes,maxOutputTokens,timeoutMs,chargeBound}}`. Candidate reportFacts `{generated,wordCount,sourceCount,datedSourceCount,citationCount,unknownSourceReferences,uncitedSourceIds,hasFindings,hasImplications,hasUncertainty,emptySourceIds,sourceErrors,mode}`. M01 alone assesses acceptance and authorizes delivery/payout.

## Public events

Journal `{sequence,type,at,data}`. data public-safe fields `{id,status,mode,money?,costNanoUsd?,expenseCategory?,obligationId?,orderId?,evidenceRef?,accountingDay?}`. Types: sale.confirmed, obligation.due, funding.confirmed (creditNanoUsd/cash_to_credit), inference.consumed (costNanoUsd/inference), fee.recorded, payout.pending/unknown/confirmed, refund.confirmed, accounting.correction. Stable event ids e.g. `${actionId}:${type}:${index}`. M01 disclosure plan `{eventFields,publicFields,financialFields}` is the only disclosure allowlist. Projection totals per asset; funding not inference expense. No question, capability token, source/report text, credential or raw provider payload in public events.

## HTTP/view contract

Company knowledge import preview: `POST /api/knowledge/import` uses the existing local workspace access and mutation-origin checks. For a website send JSON `{kind:'website',url:'https://…'}`. For a file send raw bytes with `X-Import-Kind: pdf|markdown|text` and percent-encoded `X-File-Name`; content types `application/pdf`, `text/markdown` or `text/plain`. M01 `knowledge_import` supplies exact upload, page, character, timeout and redirect bounds. Response `{preview:{title,body,source:{kind,name,url?,sha256?,importedAt,pages?},warnings,characters}}` is ephemeral, editable text with provenance. No upload or preview is journaled; explicit existing `/api/knowledge/documents` save writes the reviewed Markdown to JBrain with chosen agent grants. No OCR, JavaScript rendering, authenticated website access or recursive crawling. Unsupported/encrypted/scanned/empty files fail truthfully. Public-only DNS-pinned HTTP(S) retrieval blocks private destinations including redirects. Transport/parser errors never save a document.

GET /api/status public capability/mode summary; GET /api/ledger public projection; POST /api/orders `{question,geography?,timeHorizon?,format?,sourceAsset?,sourceNetwork?}` => `{order,accessToken}` (capability only returned on creation). GET /api/orders/:id authenticated status; POST /api/orders/:id/quote; POST /api/orders/:id/check-payment; POST /api/orders/:id/run; GET /api/orders/:id/report authenticated artifact. Capability via `Authorization: Bearer <token>`; query tokens are rejected. POST run requires current Rules authorization and real readiness. No synthetic payment route exists in product composition. GET /api/owner/status requires separate server-held owner token; owner edits config.yaml, no browser trusted kill toggle required. Owner token never placed in JS. Customer reports escaped/text rendered. UI represents only server verified receipt states. Request mutations carry Idempotency-Key if applicable. All pages disclose fixture/live mode and outstanding strict gates.

## Examples and ownership

Representative valid/invalid/pending/unknown records are executable exports `examples` in src/contracts.mjs. All worker tests nested under test/ discovered recursively by npm test. Coordinator owns dependencies, package/one lockfile, app/server/workflow/integration tests and this guide. Changes requested through same worker threads; no config reader or business calculation outside M01.

Additional M01 actions: funding_record, consumption, payout_record, refund_record issue exact bookkeeping plans from verified provider facts. RulesDecision canonical status is allow/deny/hold; decision/outcome aliases are not required. Frozen OfferPolicy is {id,orderId,policyVersion,configVersion,minimumPrice:Money,price:Money,settlementAsset:{network,asset,decimals},treasuryAccount,contributors:[{account,bps}],treasuryBps,createdAt,expiresAt,refund,research,mode,paymentAsset}.

## Final integrated additions and recovery protocol

All factories/records above are implemented. M10 methods return `{order}`; creation additionally returns one opaque accessToken. getOrder is a sanitized internal view; M12 verifies capability and obtains M01 access before returning it. createOrder Idempotency-Key collision returns CONFLICT with the original order identity; its raw capability is not recovered from its stored hash. Other commands replay existing immutable operations.

Additional exact plans:

- bootstrap `{kind:'bootstrap',receiptId,money,provenance:'fixture_initial_balance'}` seeds only an empty fixture financial store.
- late_payment `{kind:'late_payment',receiptId,orderId,revenue,refundReserve,refundExposure,orderPatch}` books incoming cash/refund protection with no sale or contributor obligation.
- refund_intent `{kind:'refund_intent',orderId,recipient,money,feeTreatment,reverseAllocationOnlyOnConfirmation:true,clawbackContributor:false}` freezes instruction. Confirmed refund `{kind:'refund',receiptId,orderId,recipient,money,releaseProtected:[{id,money}],obligations:[{id,status,completedAmount,remainingDue}],refundExposure,status:'confirmed'}` applies exact Rules amounts; pending/unknown never reverse allocations.
- reconciliation `{kind:'reconciliation',reservationId,status,...exact retained/released bounds,evidenceRef?}` records Rules-selected uncertainty/resolution. Each new observation has a distinct recording action ID; the external effect action ID stays unchanged.
- evidence `{kind:'evidence',accepted,qualifications?,failures?,orderPatch?,nextAction?}` assesses retrieved source records before generation. Both inference evaluation and final dispatch recheck the bounded pack; an evidenceReady flag alone is insufficient.
- remedy/report rejection/late/overrun decisions supply `plan.orderPatch`; M10 persists those patches and obtains a fresh refund decision before transfer. M10 defines no refund eligibility.

Additional actions: bootstrap, evidence, reservation_update, late_payment, remedy, funding_record, consumption, payout_record, refund_record. M09 already atomically records confirmed payout progress; M10 does not apply payout_record a second time. ReportFacts also include sources, questionOverlapTokens array, excerptCount and explicit unknown-publication/source observations. Unknown publication dates remain unknown; config alone determines acceptance and returned qualifications.

Final dispatch proof: evaluate at financial v -> M03 applyDecision(same actionId) gives approvedPlans v+1 -> M01 validateDispatch(original permit,fresh facts) returns allow at v+1 with exact persisted plan -> M03 consumePermit(fresh decision,original permit) gives v+2 -> re-read current financial/order facts and M01 dispatch(callback). No unrelated financial version or order version may change. No await occurs between final check and starting provider call. Accepted config changes invalidate outstanding permits. Permits are process-local; restart reconciles existing submitted effects and never trusts an old permit. A provider ambiguity without reconciliation remains held.

M10 persists action/decision intents, exact observation-record plans, provider outcomes, report/delivery/completion decisions and private artifact refs. Composition stores private accepted policy snapshots through M02. Crashes after a durable provider result resume that same operation; recorded consumption plans replay without subtracting credit twice. Confirmed output with delayed billing keeps its reservation and cannot complete. Read-only reconciliation continues during a valid kill; new signing/spending/refunds still require current Rules authorization.

Current extra public types are fixture.bootstrap, payment.late, reservation.recorded/updated. Seed and late money are distinct from sales; reservation upper bounds/purpose/day are separate from actual expenses. funding.confirmed and inference.consumed explicitly correlate reservationId. Historical unknown rows remain visible while later evidence resolves current state. Old development events without explicit correlation are conservatively unresolved, never silently repaired or deleted.

Malformed hot reload: M01 alone may allow ledger access/disclosure from the last accepted publicLedger=true policy with reason LAST_ACCEPTED_LEDGER_POLICY and metadata degraded=true/currentSafetyValid=false/readPolicyVersion/businessEffectsAllowed=false. This does not grant storefront/private access or authorize any effect. Missing initial policy and previously denied public access have no fallback. M11 forwards that metadata; M12 loads the ledger independently of unavailable storefront status.

## Agent workspace revision

Latest user direction supersedes the former single-profile navigation: createWorkspace({journal,workflow,rules,clock}) exposes initialize/view/get/create/update/install/createTask. Records agents/agentTasks/workspaceActivity are private local workspace metadata. GET /api/workspace returns actual roster/tasks/catalog. POST /api/agents creates an agent; GET /api/agents/:id reads detail; POST /api/agents/:id/update applies version-checked metadata; POST /api/agents/:id/skills installs a catalog skill; POST /api/agents/:id/tasks creates assigned work. Local fixture workspace access is an M01 access decision; mutation origin checks remain enforced.

M01 actions agent_manage and agent_task govern metadata eligibility and ready/paused/draft/runtime gates. Runtime currently fixture only. Templates/skills are free authored metadata; service prices come from the existing offer. Internal workflow input agentContext freezes the persisted profile/version/skill/service guidance, and taskMetadata links agent/order in the same durable order-creation commit. Public /api/orders input cannot inject these internal fields. M08 includes guidance as untrusted prompt material. No profile/skill grants financial authority or establishes a separate live model connection. Public ledger redaction and private order/report capabilities remain intact.

## Company knowledge (JBrain)

`createCompanyKnowledge({journal,rules,client,companyId,clock})` owns application references/grants and exact write intents; canonical OKF Markdown/revisions live in the actual JBrain service. `createJBrainClient({url,token,timeoutMs,fetch})` implements its documented model-free HTTP endpoints. No database mounts, direct knowledge-file edits, `/ask` calls or model spending are used. The token is server-only and whole-brain; app grants are enforced through M01.

M01 actions `knowledge_manage`, `knowledge_read`, `knowledge_context` choose permissions, selection limits and excerpt bounds. Documents can be shared with the company or restricted to specific persisted agents. Workspace creation binds each agent to the server company ID. Task input adds `knowledgeIds`; selected excerpts/revisions are frozen into `agentContext.companyKnowledge`. Current grants are checked again immediately before inference dispatch. Context is untrusted owner-supplied background and never substitutes for required public evidence. Existing private report capabilities and public-ledger redaction apply.

The local UI exposes Company knowledge, document editing/access, task context selection and explicit report publication. Exact endpoint/request/recovery contracts are in `docs/JBRAIN_INTEGRATION.md`. Local workspace access remains a single-owner demo boundary, not production login or authenticated agent identities.

## Organization setup workflow

GET /api/workspace/setup returns saved organization metadata, M01 progress plan for the six ordered stages (org/agents/profiles/skills/infra/brain), actual adapter capabilities and JBrain connection/document metadata. POST /api/workspace/organization accepts {name,purpose,industry?,version}; POST /api/workspace/setup/review accepts {stepId,version}. Both use local workspace access, same-origin mutation checks, current Rules gates and optimistic metadata versions. No client progress/completion claims are accepted. M01 organization_manage validates the metadata; organization_setup derives readiness and reviewed completion from persisted facts; organization_setup_review emits the exact review fingerprint. Role/profile/skill changes invalidate the corresponding review. Completing setup grants no live execution or spending authority. Existing workspace routes remain accessible independently of onboarding.

## Marketplace requirement views

Workspace catalog entries add `requirement: inference|knowledge|skills|soul|external|wallet|template`; legacy template/skill/service IDs and behavior remain. Additional kinds inference/knowledge/soul/connector/wallet are resource-detail views, not purchasable execution commands. Their actions route to existing workspace settings, knowledge/import and ledger flows; live setup requirements do not create accounts or authorize effects. Resource status uses `/api/status.readiness`, `/api/knowledge` and the selected persisted agent. SOUL.md files are served as Markdown under `/souls/*/SOUL.md`; preview appends guidance for review via ordinary agent settings, with one marker per profile to avoid duplicates. No new financial API or business-rule bypass.

## Historical company operation additions — superseded by revision 2

The paragraph below records the prior fixture-capable contract. Live additive capital/credit observations and paid checklist procurement are disabled. Use the revision2 G3 contracts and current BUSINESS_OPERATION.md instead.

### Earlier vocabulary

See [LIVE_BUSINESS_CONTRACT.md](LIVE_BUSINESS_CONTRACT.md) for the reviewed
owner activation/resource routes and public service order routes. New exact
Rules plan kinds are `company_activation`, `resource_binding`, `service_order`,
`capital`, `credit_observation`, `procurement` and `procurement_record`. New
ledger facts are `capital.recorded`, `credit.observed`, `procurement.confirmed`;
capital/credits are distinct from sales and inference expense. Pending/unknown
provider operations retain their original identities and reservations. The M01
boundary and existing external-result envelope remain unchanged.

## Business SDK preparation — latest focused pass

M07 `prepare({action,request})` performs read-only official-SDK preflight/E2EE preparation and persists the finding to trusted verification records. It returns `completionSent:false`. M10 calls it before the exact inference reservation/permit. M07 `generate` refuses an unprepared request, uses only the prepared callback under final Rules dispatch, and returns existing original operations across restart; there is no legacy HTTP completion fallback. Public component preflight may be anonymous; paid preparation requires a credential. Proof-unavailable output remains blocked from business delivery.


## Current E2E integration additions —14 November2026

Runtime Rules option `totalCeilingNanoUsd` (or private `SHOP_TOTAL_CEILING_NANO_USD`) is an upper bound only;5000000000nanoUSD is the user-approved USD5 total. Exact request/credit/account/action authorization remains separate. M01 alone calculates lifetime exposure and current minima. Shared encrypted chat encoding now emits `max_completion_tokens`, n1, streamfalse; provider documents this cap as reasoning-inclusive. High-level `maxOutputTokens` remains unchanged; captured wire hashes must match the current exact encoding.

Owner-only added HTTP routes: `POST /api/workspace/cloud/services` `{}`; `/knowledge-ranking` exact planned context/revisions+advisory output; `/billing-costs` `{inferenceIds}`; `/credit-attribution` and `/credit-balance` `{}` using privately pinned org/session/key refs. Credit rows are observation-only, unwatermarked and nonadditive; owner reads never create a lot. `POST /api/workspace/inference/recover` `{id}` inspects the original prepared operation, returns outputnull/statusunknown/costpending/wire-only scope with no resend.

Private company trace: `GET /api/workspace/autonomy/trace` (no filters), derived only from M01 allowlisted owner views. `POST /api/workspace/autonomy/change-review` takes exactly `{improvementId,version,decision:'accept'|'reject',reviewNote?}` plus stable Idempotency-Key. M01 owns all eligibility/CAS/current policy decisions. Instructions can affect only future context of the named current company agent; host-code acknowledgement is inert.

Private app composition can inject Agent proof/movement/getOriginalInputs and settlementEvidence ports; no browser proof/trust override is accepted. Independent assurance requirements remain strict. See docs/NEAR_E2E_RESULT.md and current e2e worker handoffs for exact factory types/evidence limits.
