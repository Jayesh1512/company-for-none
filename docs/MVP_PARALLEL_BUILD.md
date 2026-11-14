# Autonomous Business MVP — parallel build protocol

The user authorized separate build chats, a coordinator, and implementation toward the final MVP. The approved source is BUILD_PLAN.md plus BUILD_PLAN_MODULE_CRITIQUE.md. M01 owns every business rule. This document governs work ownership, not a replacement product plan.

## Workspace and ownership

All chats share /Users/jys/.t3/projects/near1. This is deliberate complementary editing with disjoint files, not isolated worktrees. Do not run git reset/clean, stash others' files, stage everything, delete legacy work, or rewrite another chat's files. Do not create more chats or subagents. Ask the coordinator through T3 thread messages for cross-boundary changes.

- Coordinator: shared contracts and examples in src/contracts.mjs, docs/MVP_CONTRACTS.md; M10 in src/workflow/; application composition src/app.mjs; server.mjs, package.json and its sole lockfile, .gitignore/.env.example, README.md and current product/design context; integration/demo scripts and integration tests; MVP_STATUS.md and coordination registry after launch handoff. Owns installation, overall run commands, integration and final verification. Workers request dependency/script changes instead of editing shared setup.
- Rules worker: M01 in src/rules/; config.yaml and config.example.yaml; test/rules/; handoffs/rules.md. Sole implementation owner of business-rule definitions/calculations/decisions.
- State & Money worker: M02 in src/journal/; M03 in src/treasury/; M09 in src/payouts/; test/state-money/; handoffs/state-money.md. Treasury records facts and applies Rules plans; no independent policy.
- Integrations worker: M04 in src/custody/; M05 in src/payments/; M06 in src/cloud-funding/; M07 in src/inference/; test/integrations-adapters/; docs/INTEGRATION_EVIDENCE.md; handoffs/integrations.md. Implement explicit modes and truthful capability results; do not claim mocked services are live.
- Research & UI worker: M08 in src/research/; M11 in src/ledger/; M12 view/request handling in src/web/ and public/; test/research-web/; handoffs/research-web.md. Ask coordinator for server composition; do not edit top-level server, scripts or package file.

All workers can create their owned directories. Test paths are nested deliberately; coordinator must set a command that discovers all of them. One worker does not imply another autonomous product agent: the product itself has one research agent.

## Contract handshake

Coordinator's first priority: publish a minimal runnable common contract and docs describing each module's exports, injected dependencies and representative records. Use BUILD_PLAN.md's records: Money, FinancialSnapshot, RulesDecision, OperationRef, ExternalResult, SpendReservation, ExecutionPermit, ReportArtifact, ContributorObligation.

Worker methods accept versioned facts and return explicit results. Rules alone returns allow/deny/hold and exact plans; executors never read config. Fix shared contracts only through the coordinator. Workers can implement isolated internals and tests from the documented records while the coordinator freezes exports, then adapt within their own files. No worker may create a competing shared contract library.

Use the existing Node ESM direction unless the coordinator has a concrete reason to change it; avoid a framework migration or large dependency tree. Coordinator alone manages any dependencies and runtime choices. Persist financial state; do not mistake browser memory or a replay for an MVP.

## Required behavior and allowed development modes

Deliver one shop, supported-token checkout, one real research agent, Cloud use/funding, contributor payouts, one-file rules, public ledger and demo runner. Record provider evidence and mode per component: fixture/local, testnet, live, unavailable. Independent modules must continue despite missing integrations.

No credentials currently established, no funded amount cap supplied. Do not provision custody/accounts, move funds, or call paid inference without the necessary credentials and explicit funded limits. Read official vendor docs; do not invent autonomous credit purchasing or official testnet Intents. The user's earlier architecture requirement remains visible, but an unavailable integration does not block local work. A local full-loop MVP is a legitimate milestone if accurately labeled; strict live/testnet and autonomous funding claims require evidence. Do not silently replace required vendors or claim the under-120-second requirement from a canned replay.

Do not build Council, expert profiles, multiple product agents, organizations/memberships, or Bonfire. Preserve historical planning documents. The old partial Council implementation may be replaced only inside the authorized owned runtime/UI paths; do not run it as if it were this product.

## Worker handoff and coordination

Write a current handoff file in your own path before ending a turn: task and module ids; implemented exports/files; exact passing/failing commands; fixture/live status; unresolved blockers; requested shared-contract/dependency changes; next integration step.

Send that handoff to the coordinator thread with a stable clientRequestId, mode auto (or steer for an active clarifying update). Use existing threads; do not create new ones. Do not wait silently for missing imports: document the request, message the coordinator, and continue independent tests.

Completion message convention:

WORKER_DONE
Task: <rules | state-money | integrations | research-web>
Summary: <one line>
Files: <owned paths>
Checks: <commands and outcomes>
Mode: <fixture | testnet | live | mixed, with evidence>
Needs: <remaining integration work or none>

If blocked, write WORKER_BLOCKED with the exact unavailable capability and continue all independent work. A missing live capability is not a reason to abandon module implementation.

## Coordinator duties and continuation

Keep MVP_STATUS.md current with each task's thread id, state, deliverable, actual checks, and unresolved gates. Read worker handoffs, inspect code, communicate concrete contract changes, and keep work moving. Integrate M10 and app/server composition; run meaningful contract, persistence/restart, rules, payment/cost/payout, privacy and UI checks. Use T3 preview for local browser QA when exposed. Keep the local preview available once it works.

Workers send terminal results to this coordinator, waking it for integration; the coordinator should not end the project just because other chats are still running. It may yield after writing status and ensuring each worker has a specific handoff route. When all workers have delivered, resolve integration failures, re-run affected checks, and provide the user a usable local MVP plus exact live limitations. Do not add another planning or generic approval round for ordinary implementation.
