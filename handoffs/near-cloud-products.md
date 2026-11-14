# NEAR Cloud products integration handoff —14 November2026

User requested implementation of the products discussed from the current NEAR Cloud API reference. This is an additive, reversible integration. No new chats, delegated build work, installs, accounts, credentials, grants, funds, inference payments or submission. Existing completed workers confirmed no conflicts; integrations explicitly transferred `src/inference/verification.mjs` to coordinator for the scoped schema mapping. M01 remains the sole policy owner; M03 financial code was not changed.

## Implemented

- `src/cloud-contracts.mjs`: eleven documented request codecs and exact client-function call/output replay, without remote execution or server history. Unknown fields/URLs/tools rejected. Multipart audio and data-image inputs are supported; no URL fetching for vision.
- `src/cloud/{http,index,read-only}.mjs`: fixed official-origin HTTP, explicit credential separation, bounded/redirect-free/no-retry reads, single-use prepared paid transport behind exact M01 plan+permit+final gate, original unknown-operation persistence, private exact response capture, proof unavailable/cost pending/accepted false. Real paid route never bypasses policy.
- `src/runtime/cloud-products.mjs`: owner view/catalog/local plan/held execute/scoped JBrain rerank preparation/read-only reporting. Reporting cursors are organization+credential+time scoped and durable. Exact original provider IDs correlate work; reports never mutate M03 balances, reservations or costs. Legacy reporting requires explicit server opt-in; no replacement host invented.
- `src/rules/cloud-products.mjs` + index: owner-only local/read plans, specialized execute HOLD. Native search result count is not a total-call/charge bound. `knowledge_preview` in M01 permits owner local preparation in setup with the selected agent's real document permissions, without changing inference grants.
- `src/rules/command-format.mjs`, `src/generation-contracts.mjs`, autonomy/component and scoped M07 changes: M01 command JSON Schema is frozen in the GenerationRequest, byte-counted, fingerprint-bound and included in the official E2EE SDK input. Prompt envelope avoids duplicating schema/template bodies. Schema is a formatting aid; strict proof/command/scope/fence gates remain.
- `public/cloud-products.js` and existing Settings composition: flat inventory, explicit actual catalogue refresh and integer pricing, local text-request review, protected reporting view. No enabled paid-action button. Bounded mobile fix keeps old connection-check text from collapsing beside the Check button.
- `scripts/probe-cloud-products.mjs`, `npm run test:cloud`, `npm run probe:cloud-products`; docs `docs/NEAR_CLOUD_PRODUCTS.md`, README, `.env.example`, status/registry updated. Existing reviewed plan/critique files remain byte-identical.

## Actual checks

- `npm test` **316 passed /0 failed /0 skipped**, log `artifacts/near-cloud-products/tests.log`.
- `npm run test:cloud` **29 passed**, log `focused.log`. Actual Node HTTP to local stand-ins exercises all eleven codecs, credentials, multipart serialization, dropped responses/overflow, no resend, raw-unverified output, reporting pagination/scope, rejected caller claims and current knowledge grants. The full existing dispatch/kill/recovery suites remain green.
- `npm run test:native` **12 passed**, actual local JBrain, `native.log`.
- `npm run check` **95 JavaScript files**, `check.log`.
- **Real public Cloud catalogue**: both documented GETs succeeded with **64 models/64 priced**, no keys/completion. `public-catalog.json` proves read reachability only.
- T3 collaborative preview: isolated temporary setup store and non-production test owner token; actual catalogue refresh64; local privacy plan; execute not_submitted; anonymous403; zero page exceptions. No horizontal overflow at actual CSS widths1315/356 (requested1440/390). Native screenshot compositing duplicated narrow captures; `browser-proof.json` records geometry/interaction evidence instead of relying on pixel dimensions. Two bounded visual passes; no extra redesign.
- Postman1.73.0 was present, but status command unsupported and provider discovery lacked authorization. No login/install/publish. Reused this repo's actual Node HTTP protocol-test pattern; no Postman simulation/live paid claim.

Source manifest: `artifacts/near-cloud-products/source-manifest.json`, SHA256 `0e85b1a96e9da01c82e3e647e978e62e3e83313945e343a274fad7f0ff7721ab`. Old CompanyOs source freeze/check counts remain historical, not this integration's hash.

## Honest exit and next gates

Protocol clients, local preparation and read views are implemented. **Specialized paid execution is not enabled.** There is no approved new proof/security route, total charge enforcement, attributable credit or numerical grant. Native search additionally needs aggregate service/inference bounds. Existing official E2EE durable plaintext/replay limitation still holds accepted autonomous commands/customer delivery; HTTP success, an endpoint catalogue or an SDK process boolean does not close it. Agent API movement, 1Click status/finality/refunds and paid entitlement/acquisition gates remain unchanged. Redaction is an owner preview, never blanket disclosure permission.

No reporting-token creation, cash-to-credit purchase, staking transaction, model-provider switch, public service publication or billing estimate was added. Company records/JBrain remain persistent; no zero-retention claim. The same user's preview store/token/JBrain are retained at http://127.0.0.1:4173/#settings.
