# NEAR integration improvement pass

13 November 2026. This supplements the frozen reviewed real-execution plan; it does not change that plan, the market-report service, or the agreed financial/security boundaries.

## Priorities from the Loops House mentor

The user asked which NEAR tools to add. The mentor recommends finishing Agent API spending and 1Click settlement before adding another integration. It suggests PingPay/x402 only for one concrete paid resource, and deferring Agent Market and Chain Signatures until a real need exists. Full response and reviewer qualifications: `artifacts/loops-mentor-near-tools-20261113.json`.

The mentor incorrectly dismissed native search as not a NEAR capability. [NEAR AI Cloud documents built-in search](https://docs.near.ai/cloud/guides/web-search); it is a possible later improvement once model/tool compatibility and aggregate token/service charges are bounded. Search-result count is not a paid-call cap. The suggested PingPay documentation link was not retrievable during this pass; npm metadata confirms merchant middleware exists, not an implemented buyer payment route. Neither tool is installed or enabled by this advice.

## Implementation plan and contracts

| Step | Owner/module | Input → output | Exit and status |
| --- | --- | --- | --- |
| 1. Real public Cloud verification | M01 preflight limits; M07 official verifier | Server-selected model and verification policy → private raw evidence plus actual gateway/model findings | Implemented. Public evidence can be checked without an inference key. M01 allows 30 seconds for read-only verification; paid preparation still requires credentials. Actual SDK check returned verified gateway + one model, both UpToDate, no completion. |
| 2. Wire the official SDK into business inference | M07 adapter; M10 workflow | Frozen action/request → prepared SDK callback and persisted preflight → final M01/Treasury-gated dispatch → original result/proof | Implemented wiring. Legacy HTTP completion is no longer the business dispatch path. Preparation cannot send a completion; repeated calls/restarts preserve the original operation. Actual paid business execution remains gated. |
| 3. Complete durable report verification | M07 + M01 | Exact wire evidence, independently revalidated collateral and durable decryption capability → verified binding to the report plaintext | Blocked on the current SDK's supported durable-key/replay interface or an explicit, reviewed route decision. No fallback to unsigned/unverified output, weakened TCB policy, or synthetic report. Finish before enabling customer delivery. |
| 4. Prove spendable checkout and contributor payout | M04/M05 + M03/M01 | Signed 1Click invoice/status, exact confidential account/bucket/token, synchronized policy/grant, movement evidence → accepted sale and exact automatic payout | Existing real clients/proof helpers need current provider evidence and approved accounts/limits. A provider status or signed nested quote is insufficient by itself. Refund domain, principal and worst-case fees must be backed before a deposit quote. |
| 5. Real procurement, with x402 only if useful | M06 or a separately scoped resource adapter | One actual supplier's challenge/price/delivery contract and an exact allowed payment → verified usable delivery/entitlement | Autonomous Cloud acquisition is still unsupported. x402 is optional for one proven paid data/API resource; it does not buy Cloud credit automatically. No imaginary supplier, hidden top-up, arbitrary connector or payment-only licence. |
| 6. Overall system testing | Coordinator, after the implementation/gates above | Exact approved environment and capability matrix → correlated end-to-end evidence, actual costs and recovery/privacy findings | Deferred as the user requested. Existing isolated fixture tests remain regression tests, never live economic evidence. A full live result requires the real approved route and limits. |

M01 remains the sole policy/config authority. M03 remains the sole money-record owner. Preparation is asynchronous and read-only; the final callback starts the prepared transport synchronously after fresh Rules checks and consumed permits. Unknown paid effects retain their reservations and never become new requests automatically.

## This pass: changes and verification

- `src/inference/verification.mjs`: anonymous public attestation preflight; paid preparation fails without a real key. Optional SDK loading seam is private composition for isolated tests, not an HTTP override.
- `src/rules/components.mjs`: bounded read-only preflight timeout increased from 5 to 30 seconds. The initial actual 5-second run timed out; the 30-second run completed successfully without changing TCB policy.
- `src/inference/index.mjs`: prepare and persist official-SDK findings before business dispatch; remove legacy completion dispatch. Billing remains a separate read-only client. Required plaintext/replay proof still blocks delivery.
- `src/workflow/index.mjs`: live inference prepares its exact request before evaluating/reserving the final effect. No fixture path or fake success is added.
- Focused adapter checks: 16 passed. Workflow/component/Rules regression checks: 32 passed. Syntax: 74 JavaScript files passed. These are focused checks, not a new overall-system or funded acceptance claim.
- Actual read-only evidence: `artifacts/near-public-attestation-20261113.json`. SDK 0.3.0 verified gateway and one model with UpToDate TCB; `completionSent:false`. Raw evidence remains private in the isolated `.runtime/root-public-attestation-20261113` store. Catalog candidate selection is not commercial model approval.

## Decisions and remaining constraints

Keep the existing market-report service; do not implement a proposed API-brief pivot without the user's choice. Do not add x402, Agent Market, Chain Signatures or paid search just to increase integration count. First complete one real report/business loop.

Actual paid calls still need explicit protected credentials, attributable credit, model/charge bounds, numerical request/daily/aggregate limits and approved account/network/recipient/refund terms. Public attestation is now real evidence, but it does not establish those economic facts or durable plaintext recovery. No accounts, grants, tokens, paid inference, public sales, publication or submission were created by this pass. No new chats or agents were spawned.
