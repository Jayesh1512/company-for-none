# Mentor implementation handoff —14 November2026

Runtime source is frozen. The 264-file source manifest aggregate is `1bc3e202a2f5b4e221f379f7bced724e5cde7e8873accb080dc961bac6befd3b`, using sorted relative path + NUL + exact bytes + NUL. Manifest/evidence: [artifacts/mentor-implementation](../artifacts/mentor-implementation/). Every mentor pointer, remaining implementation and live gate is documented in [MENTOR_IMPLEMENTATION.md](../docs/MENTOR_IMPLEMENTATION.md).

## Delivered code

- M01 optional `nearIntegrations` policy, exact immutable request/one-shot admission, current final gate, private facts only, shared USD5 actual-plus-pending ceiling, resource accounting across the same prepaid key and cost-bound incident stop. Owner JSON cannot assert vendor proof or balances. M01 remains the only policy authority.
- Native ledger: actual Agent API writer composed through M03 native/USD reservations and consumed permits; stable original IDs, private raw response before decode, original status recovery, exact final RPC transaction/receipts/fee-block verification, actual fee accounting and separate checkpoint finality. An older native snapshot still deducts fees not yet reflected at its block. M03 remains sole money writer. Unknown effects retain their full bound. Only a locally proven unsubmitted call may release its own zero-cost reservation.
- Real fixed-origin OutLayer request/balance/billing, PingPay two-phase offers/quote/original-deposit settlement, Agent API exact generate/sign/submit/status clients and owner Settings request/readiness/recovery controls. Credentials resolve before final dispatch; no transport await precedes the actual synchronous request after that gate. Raw exchanges are private and durable.
- Actual locked Rust fixed-template evaluator built natively and as WASI. Native behavior matches the existing fixed JS driver. Remote output is never a local pass. A verified remote observation must still pass current M01/fixed-driver/CAS promotion. WASM142587bytes/SHA256 `8b48f0bfb4b21b48a0d4d05acc67d33c8045ec4fe55052d540a0ab1906a74443`; not deployed or remotely executed.
- Exact owner payload bridges for NEP-413/366/EIP-712/WebAuthn; installed EVM wallet has an explicit-click EIP-1193 consumer. A NEAR/passkey wallet port is external, not falsely connected. No custom relayer/key import. Unsigned named/role account and limited append-key plans preserve the selected Agent API route. Feed preparation accepts only a bound confirmed checkpoint/hash/time; no social write exists.

## Contracts

`getIntegrationFacts` is a private composition port. Runtime supplies immutable plans, durable original operations/incidents, actual attributed OutLayer resource observations and terminal billing. Other cost/proof resource producers remain unavailable by default. Protected owner authorization files convey scope, not proof. New private records: `integrationPlans`, `integrationRuns`, `integrationExchanges`, `integrationIncidents`, `remoteEvaluations`, `nativeExchanges`, `nativeCostEvidence`, `ledgerChainSubmissions`; M03 adds separate `nativeAccounts` and per-reservation native resource/fee watermarks.

Owner endpoints: `/api/workspace/near-integrations` plus `prepare`, `execute`, `reconcile`, `probe-resource`, `cost`, `verify-evaluation`, `accounts`, `checkpoint-feed`. New native owner endpoints: `/api/workspace/ledger-chain/balance` and `fees`; existing publish/reconcile now use the composition above. No new public seller endpoint exists. Inputs are bounded, owner-scoped and mutation-origin protected. Provider/payment/owner success is not a grant, accepted model output, reusable licence or proved independent movement.

## Fresh validation

- `npm test`:544pass,0fail/skip.
- `npm run test:mentor`:44pass,0fail/skip. Includes actual M01/M03/client composition against explicit controlled HTTP responses, restart/no resend, final stop/release, resource/accounting integrity and signature/payload boundaries. Positive signing-envelope/verifier inputs are test-only, not a vendor claim.
- `npm run test:native`:12pass,0fail/skip. `npm run check`:151JS source files.
- `node scripts/check-native-fee-sandbox.mjs`:5checks against actual compiled Rust contract/local nearcore RPC. Actual success and failed call burn gas; changed args rejected. Sandbox test funds and its example USD rate are not live economic evidence. Prior Sandbox artifact/history unchanged.
- Actual isolated setup-only product browser: request preparation, disabled execution, refresh retaining one plan, unsigned account/key plan, cross-site403, actual1440/390 no overflow or page exceptions. No fixture providers, orders, provider operations or financial records. T3 native was attempted first; after explicit automation-host-unavailable error, repository Playwright supplied final captures. Its earlier native CSS measurements1315/356 are recorded as such.
- Three historical reviewed hashes unchanged: REAL_EXECUTION_PLAN `66ece306…56da`; COMPANYOS_BUILD_PLAN `f9d94ac4…0c0f`; COMPANYOS_CRITIQUE `d4173e89…ffab`.

## Strict live limitations

The production **native fee/signing-envelope verifier is unavailable**. The conditional protocol implementation and controlled test port are not closure of that gate. Agent identity/policy/grant, funded native account, pinned deployed contract and exact native/USD authorizations remain absent. Default mainnet publication remains held, with no direct-wallet fallback.

Cloud SDK0.3G6 is unchanged. Newly configured `.env` Cloud key resolves through the intended loader, but has not been printed, transmitted or used; validity/attribution/credit remain unverified. No supported durable original plaintext recovery, paid accepted reasoning, independently proved confidential settlement/refund/movement, autonomous Cloud purchase or supplier entitlement is claimed. OutLayer proof acquisition/verification, public PingPay resource/accounting/delivery binding, current near.social publication and connected NEAR wallet are not claimed implemented by these clients/plans. Protocol drift and absent vendor capabilities remain explicit engineering stop gates, not “just add another key.”

No new public/vendor accounts, grants, paid calls, fund movement, mainnet writes, public seller, publication/submission, allowance increase, route/security fallback, git staging/commit or new chat occurred. Local Sandbox creates only disposable test-chain accounts. Existing preview store/history was excluded from root QA. Coordinator owns normal same-store4173 restart and preservation check after this freeze; root isolated QA server4187 is stopped at handoff.
