# NEAR end-to-end fixes —14 November2026

Current model update: user switched all seven EXISTING chats to **codex/gpt-6.1-sol, high reasoning**. Selections independently verified; unfinished work resumed in the same threads without changing ownership or histories. Original Sonnet launch below is historical.

User requested new Claude Sonnet chats for every reported issue and an end-to-end demonstration. This supersedes the earlier prohibition on starting new chats for this bounded implementation round. Coordinator owns integration, shared contracts, dependencies, main composition/server/workflow/UI, full checks, preview and final demo.

Baseline:328 full tests/0fail/0skip,99 syntax files; current local setup works. Real Cloud preflight previously verified gateway/model UpToDate with no completion. Actual paid inference, accepted durable E2EE plaintext, proven settlement/movement/refunds, autonomous Cloud credit purchase and paid supplier entitlement are not complete. Current server setup-only; no private NEAR credentials/account/grant/auth paths are configured. JBrain is connected but its readiness observation expires; merged setup review is disconnected from legacy six-stage activation.

## Authorization and shared invariants

User authorized **USD5 total maximum live-demo spend**,14 November2026. Aggregate actual + outstanding reservations must remain <=USD5 across all paid work. No allowance per worker and no resets by retry/restart. Existing network, treasury/recipient identities, protected credentials and exact transfer/purchase scope are not supplied. Do not provision wallets/accounts/grants, move money, sell publicly, publish data or call paid providers until the required exact scope and real provider facts are established. Request-specific authorized inference may proceed only after the coordinator assembles concrete bounded input/credit/proof/billing evidence within this total. Owner workspace access and a demo-mode flag are never spending authority.

M01 remains the ONLY policy/config reader and allow/deny/hold/plan owner. Other workers provide verified facts and execute exact plans. Preserve current kill, lease/fence/actor/scope/knowledge/public-disclosure gates, integer money/nanoUSD, protected funds, actual+pending reservations, once-only operation IDs and no blind retries. Do not downgrade unavailable proof to verified, accept JSON success booleans as evidence, relabel fixtures as live, switch networks/providers/security routes silently, or add a hidden canned manager.

No commits/staging/destructive Git, no dependency installs/lock/package/config/secret edits by workers, no new agents/chats by workers. All work shares the root checkout because user files are largely untracked; exact scopes below are exclusive. Read sibling paths freely, request cross-scope changes through coordinator. Do not change frozen reviewed plans/critique/historical stores. Do not mutate or seed `.runtime/product-r2-preview`. Use isolated stores and local transports for tests. Primary vendor-doc/source inspection and free public reads are permitted and must be recorded honestly.

## Ownership

| ID | Topic | Exclusive owned scope |
|---|---|---|
| S1 | M01 + setup/readiness + JBrain health | src/rules/**, test/rules/**, src/workspace/index.mjs, src/runtime/readiness.mjs, public/operation.js, test/workspace/setup.test.mjs; new dedicated tests/handoff |
| S2 | Official Cloud inference + TEE proof/recovery | src/inference/**, src/runtime/components.mjs, test/integrations-adapters/*cloud-verification*, *business-sdk*; new dedicated tests/handoff |
| S3 | Specialized Cloud tools/reporting/rerank | src/cloud/**, src/runtime/cloud-products.mjs, test/cloud/**; new dedicated tests/handoff |
| S4 | 1Click quote/settlement/refund facts | src/payments/**; new test/near-e2e-payments/** and handoff |
| S5 | Agent custody/account/grant/movement proof | src/custody/**; new test/near-e2e-custody/** and handoff |
| S6 | Cloud credit acquisition + supplier entitlement | src/cloud-funding/**, NEW src/procurement/**; new test/near-e2e-funding/** and handoff |
| S7 | Real internal company/autonomy/improvement loop | src/autonomy/**, src/workflow/internal.mjs, test/autonomy/**; new dedicated tests/handoff |

Coordinator exclusively owns all shared/top-level files, src/app.mjs, src/runtime/providers.mjs, src/workflow/index.mjs, src/knowledge/**, src/treasury/**, src/payouts/**, src/web/**, public files except operation.js, package/lock/config/env and scripts/demo/browser/integration checks. No worker changes another worker's files. S1 handles all policy requests from other workers; route agreements via coordinator so exact contracts remain documented.

## Exit criteria

Fix concrete app defects; deliver supported real provider clients with direct evidence and truthful unsupported paths. S2 must first determine whether current SDK can satisfy durable verified plaintext without a security downgrade. Missing vendor capability cannot be fixed by flipping a flag. S4/S5 must separate signed quote/audit facts from independently proven account/asset/amount settlement and refunds. S6 must distinguish prepaid usage from autonomous purchase and paid transfer from actual supplier delivery. S7 must consume actual serialized context and verified model output, preserve agent lifecycle ledger and safe evaluated improvements.

Each worker sends an early exact export/contract proposal, then concrete implementation/test evidence. Final message WORKER_DONE or WORKER_BLOCKED with files, exact checks, fixture-vs-public-read-vs-live evidence and remaining needs to coordinator `mcp:6ba88ce4-e20a-47be-8ca3-7c71af821fdd` using a stable request ID. Use the SAME assigned chat for follow-ups. The coordinator independently runs integration/full tests and actual browser/demo checks; keeps preview alive; requests only missing concrete credentials/account/scope information when required. Full completion is not claimed while required provider/authorization gates remain unproven.


## Integrated result

All owned code/handoffs are frozen and integrated. Current model GPT-6.1-Sol/high for every existing chat. Independent full tests468/468, native12, controlled pipeline13, shared composition3, syntax120, actual browser/free attestation pass. Outcome is local-integrated/strict-live-blocked, not full business completion. USD0 of approvedUSD5 spent; current/private persisted ceiling5000000000nanoUSD grants no actions. Reproducible commands, previews, concrete remaining provider/security/access blockers and evidence are in docs/NEAR_E2E_RESULT.md and artifacts/near-e2e-fixes/.
