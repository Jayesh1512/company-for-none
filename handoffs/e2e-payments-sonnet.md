# S4 handoff: 1Click quote / settlement facts / refund path (14 Nov 2026)

Scope: `src/payments/**`, `test/near-e2e-payments/**`. No provider call, quote, deposit, write or credential was used. Only free public reads (below). Everything marked *synthetic* is a local HTTP stand-in signed with a TEST key, not provider evidence.

## Public reads (record, not approvals)
- `https://1click.chaindefuser.com/docs/v0/openapi.yaml` (HTTP 200, 1,900,990 bytes, sha256 `9a2e676682aa6dec…ccac0a3`)
- docs.near-intents.org `llms.txt`, `verify-quote-signature.md`, `quickstart/making-a-request.md`, `quickstart/confidential-swaps.md`
- Installed SDK `@defuse-protocol/one-click-sdk-typescript@0.1.26` source (`quoteHash`, `verifyQuoteSignature`, types)

## Provider facts established
1. `GET /v0/status` (GetExecutionStatusResponse) has **no top-level signature**. Only nested `quoteResponse` is signed. Signed set: amountIn/Out, minAmountIn/Out, depositAddress/Memo, deadline, timeEstimate, refundFee, withdrawFee, and request fields originAsset, destinationAsset, amount, recipient(+Type), refundTo(+Type), depositType, deadline, slippageTolerance, swapType. **Not signed:** depositMode, appFees, confidentiality, status, swapDetails, updatedAt.
2. `updatedAt`/`swapDetails` are mutable, unauthenticated; no public endpoint yields independently verifiable settlement time or finality.
3. `refundTo`/`refundType`/`refundFee` are in the signed quote, so the **provider refund route** is signed-frozen. Provider refunds: INCOMPLETE_DEPOSIT (refund by deadline), excess after swap (to `refundTo`), REFUNDED/FAILED.
4. Per S5 (Agent API receipts): an inbound third-party 1Click delivery to a CONFIDENTIAL_INTENTS account has **no receipt**. Receipts exist only for executions through the Agent API (including `/deposit`). Leaf terms name no account or 1Click reference; linking is via shared hashes or committed deposit_address. So with our own 1Click quote + customer-paid deposit address, inbound settlement remains **unknown** unless the quote/deposit path is the agent's own.

## Implemented
- `status.mjs` `normalizeProviderStatus`: classification, mutable facts, hashes, partial/excess/short amounts, provider refund class (`partial_deposit`, `swap_not_completed`, `swap_failed`, `excess_deposit`, `unexplained_partial_refund`) with destination taken from the SIGNED quote, `authenticated:false`.
- `settlement.mjs` `bindSettlement`: re-compares injected independent finding to the frozen quote: account, asset, exact amount, confidential flag, reference intersection (correlationId | depositAddress | intent/near/origin/destination hashes), settledAt present / >= signed quote timestamp / not in future, finality, assurance. No assurance whitelist. `verified:true` only for `assurance:'onchain-final'` + `finality:'final'` + all bindings. `withinInvoiceWindow` is a fact.
- `refund-route.mjs` `freezeServiceRefundRoute`: signed dry reverse quote (EXACT_OUTPUT, settlement asset -> origin asset, CONFIDENTIAL_INTENTS deposit, recipient = customer refundTo). Frozen into the quote as `serviceRefundRoute` with principal, deliver amount, domain, shop-pays fee facts, `inputMinusPrincipal`. Status `provider_estimate_only`, `custodyExecutionVerified:false`, `executableProof:'unavailable'`. Missing/invalid/unpriced route blocks the quote (`REFUND_ROUTE_UNAVAILABLE` / `REFUND_ROUTE_UNPRICED`); no deposit address leaves the adapter. Same-asset routes are unpriced (blocked, truthful).
- `index.mjs`: quote echo now also checks dry/slippage/deadline; stored quote adds `signedQuote{timestamp,minAmountIn,refundFee,withdrawFee,...}`, `refundType`, `serviceRefundRoute`. `verifySettlement` binds status identity by nested signed payload hash == stored `signatureProof.signedPayloadHash`; calls `settlementEvidence.verify` only for provider SUCCESS; persists raw status exchange + finding privately; `replay()` re-evaluates offline from stored bytes (restart-safe, no network). Verified settlement is sticky (no re-poll). `signatures` option injects a verifier (tests only); proofs record `trustRoot`.
- Outcome mapping: no/unavailable/rejected/unbound evidence -> `unknown`; authentic evidence bound to account+reference but wrong asset/amount/confidential -> `confirmed`, `verified:false`, `SETTLEMENT_MISMATCH` (+ service-refund candidate facts); bound but not onchain-final -> `unknown`, `SETTLEMENT_ASSURANCE_NOT_ONCHAIN_FINAL` with all bindings exposed; fully final+bound -> `confirmed`, `verified:true`.
- Result extras: `settlement.assurance|bindings|independentEvidence|onchainMovementProven|settledAtSource`, top-level `providerFacts`, `refund.provider`, `refund.service.{route,candidate}`, `observation{statusEvidenceRef,findingRef}`.

## Port contract (S5 supplies, coordinator wires)
`createPaymentsAdapter({ settlementEvidence: { verify } })`, `verify({quote, providerStatus, expected:{account,asset,amount,recipientType,references[]}})` returns `{status:'verified'|'failed'|'unavailable', kind, assurance, finality, receiptType, account, terms:{raw signed terms}, references[], settledAt, provenance, evidenceRef}`. Terms read: `destination_asset|asset`, `amount_out|amount`, `confidential`. The finding's pass flag is not authority.

## Checks
`node --test test/near-e2e-payments/*.test.mjs`: 25 pass, 0 fail (synthetic local HTTP, TEST signing root, restart/replay with reopened journal). `node --test test/integrations-adapters/*.test.mjs` payments/http/fixture tests pass; 2 unrelated failures in S2's `cloud-verification.test.mjs` (`SDK_NODE_VERSION_UNSUPPORTED`, this shell runs Node 22.23.4, package requires >=24.22.1).

## Still unproven / needs
- No real 1Click quote, deposit, status, signature (pinned production root) or refund executed. Real signed quote bytes need one tiny authenticated quote under approved scope.
- Real settlement proof needs an `onchain-final`-assurance source. S5's log-attested receipts yield `finality:'not_established'` so they stay `unknown` until S1/M01 defines an explicit acceptable-assurance plan.
- Route decision for coordinator/S5/S1: settlement of third-party 1Click deliveries has no receipt; the customer deposit address would have to come from the agent's own `/deposit` path.
- Funded custody execution of the service refund (signing the confidential intent) is unproven (S5).
- Total live cost for a minimal proof is bounded by the USD5 total; exact amount depends on 1Click minimum swap size (docs `resources/swap-limits`) and fees, not yet read.

## Final freeze — GPT-6.1-Sol / supported Node (14 Nov 2026)

- Resumed in the same existing S4 chat with unchanged ownership and route scope. Read the current parallel-fixes contract, verification/cloud docs, owned source/tests and this handoff.
- Supported binary: `/Users/jys/.hermes/node/bin/node` v26.12.1. Command: `PATH=/Users/jys/.hermes/node/bin:$PATH node --test --test-reporter=spec test/near-e2e-payments/*.test.mjs` — **25 passed, 0 failed, 0 skipped**. No owned regression surfaced; no source or test changes were needed.
- This final pass ran only the owned focused suite. The earlier shared-suite Node22 observations above are historical; coordinator owns the supported-Node integration rerun.
- Evidence remains synthetic local HTTP + installed official SDK signature helpers with a test signing root. The default pinned production root rejection check passes. This pass made no external provider request, quote, deposit, paid call, provisioning or funds movement; spend was USD0.
- S4 is frozen for coordinator integration. Real inbound settlement still requires independently bound final movement evidence, and the reverse service-refund quote remains an estimate with no funded custody execution proof. No proof, policy or financial gate was relaxed. No network/account/credential/transfer scope was inferred from the USD5 aggregate demo cap.
