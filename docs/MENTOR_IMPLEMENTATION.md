# Mentor recommendations: implementation and remaining gates

The reversible component increment is implemented and tested; several recommended live outcomes remain blocked or deferred as specified below. **The funded autonomous business and mainnet ledger are still incomplete.** This page gives every mentor pointer a disposition; it does not call a preparation artifact a deployed integration. The existing USD5 lifetime actual-plus-pending ceiling remains. No new public/vendor account, grant, paid call, transfer, deployment, public seller, feed post or submission was created. Local Sandbox test accounts use test-only balances.

The exact eight-item mentor answer is retained in [the source response](../artifacts/mentor-implementation/mentor-response.json). Additional OutLayer, PingPay and owner-signing components discussed in the conversation are listed separately below. Historical reviewed plans and critiques are unchanged.

## The eight numbered recommendations

| Pointer | What works in code now | What still blocks the live result |
| --- | --- | --- |
| 1. Native ledger publishing | The app wires the real Agent API native-call client through M01 admission, M03 native/USD reservation, consumed permit and immediate final dispatch. Exact response bytes are retained before decoding. Stable original IDs survive restart; an unknown call is never resent. Final RPC verifies the actual signer, receiver, arguments, gas, deposit and each burned-fee receipt. | The production composition has **no verified native fee/signing-envelope producer**. Its private verifier port is deliberately unavailable, rather than populated from an owner assertion. Agent identity/policy/grant, funded accounts, exact native/USD bounds and reviewed batch authority are also absent. Keys or funds alone cannot remove this gate. |
| 2. 1Click lifecycle | Existing signed-quote/status normalization already distinguishes SUCCESS, REFUNDED, FAILED, INCOMPLETE_DEPOSIT and pending/unknown states, with partial/excess/swap-refund classes. Existing Agent API payouts reconcile their original correlation. Regression tests retain these behaviors. | A mutable 1Click status or Agent API receipt is not independent movement/refund proof. The selected contributor payout route remains Agent API; no unnecessary second 1Click payout route was added. A funded transfer and verified settlement/refund evidence remain outstanding. |
| 3. Checkpoint reconciliation | Owner ledger UI shows the unconfirmed default, code-pinned final-RPC head, unsigned batches, exact reconciliation and separate native-fee status. Publishing is disabled unless current M01 admission passes. | No deployed mainnet contract or confirmed public checkpoint exists. The existing account observation remains unfunded; this increment did not repeat a mainnet account read. |
| 4. Scoped function-call writer key | Settings prepares an unsigned plan limited to the exact ledger contract, `append` method and gas allowance, with a separate owner administration key and rotation requirements. | No key was generated or installed. The operational route remains Agent API. Installing an alternative scoped-key route requires an explicit account/route decision and a funded owner transaction; it is not a credential fallback. A function-call key cannot attach NEAR and its allowance is not a general USD budget. |
| 5. Named ledger account | Settings creates an exact unsigned company sub-account plan from public inputs. Parent funding includes the child allocations; it is not counted as new revenue. | No account was created/deployed. A funded parent, selected name, fee/storage allowance and wallet signing are required after the ledger route is ready. |
| 6. Role sub-accounts | The same plan can allocate named manager/developer/specialist accounts for identity/logging. It issues no agent spending grant and does not migrate existing profiles. | Funding and account creation are not performed. Local profile activity is not represented as already on chain. The mentor explicitly placed this after the core ledger proof. |
| 7. Public checkpoint feed | Settings prepares a hash-only feed payload from a previously confirmed checkpoint, including its reconciliation time, company commitment, network and contract. A changed binding is rejected. | Actual near.social publication is **not implemented or enabled** until its current write/readback protocol and exact authority are verified. The mentor's assertion that a failed transaction can count as a successful post was not adopted. No unconfirmed hash or private business payload is published. |
| 8. Meta-transaction owner approval | Exact Agent API generate-intent → original wallet signature → submit-intent → original-status recovery is implemented. The NEP-366 bridge preserves the original encoded signed delegate; it does not construct a new transaction or relayer. | Agent API must select a supported sponsored NEP-366 flow. A compatible external NEAR wallet and exact owner signature are required; the app has no connected NEAR-wallet selector. No separate relayer was started or funded. |

These are conditional implementations and safe preparation paths. The live parts named in the right column remain open, rather than being certified by local tests.

## Additional connection components

**OutLayer healing.** A real Rust evaluator ports the fixed additive-template driver to WASI. Its locked build produces a 142,587-byte binary, SHA-256 `8b48f0bfb4b21b48a0d4d05acc67d33c8045ec4fe55052d540a0ab1906a74443`. Native Rust observations match the existing JavaScript evaluator over repaired, regressed and invalid candidates. Compilation is established; remote WASM execution and cross-machine byte reproducibility are not.

The HTTPS client uses a fixed mainnet/testnet origin, exact project/version and payer owner/nonce, a unique frozen job input, explicit compute cap, zero author deposit and bounded local response reads. The real `/payment-keys/balance` codec attributes money to the presented key, rejects trial-call counts as cash, and shares the same prepaid resource across project reservations. It never creates Treasury cash or Cloud credits. Original-call polling and terminal billing are separate from execution proof. Failed runs may still have a real cost.

An attestation URL, provider output or reported hash cannot approve a repair. The execution verifier must supply independently verified raw stdin/stdout byte hashes and their semantic fingerprints for this exact job and WASM. The current product has **no production OutLayer execution-proof acquisition/verifier**; it holds without one. After a valid remote observation, the actual local fixed driver still runs and ordinary M01 current-revision/CAS promotion applies. No repair was remotely executed, promoted or paid for during this increment.

**PingPay.** Fixed-origin clients implement the documented two-phase x402 v2 flow: offers → quote with the customer's origin-chain `refundTo` → deposit settlement with the original operation token, deposit address and transaction. A quote cannot be moved to a different resource. Pending, incomplete, terminal/refund and unknown states stay distinct. Provider success is held without independent settlement evidence. An unknown settlement is not silently re-POSTed by recovery; a reviewed retry must preserve the original deposit proof.

This is a protocol component and owner request workflow. **It is not a launched public paid-service store or a completed delivery/accounting integration.** Merchant setup, actual settlement/refund proof acquisition, public resource publication rights, service acceptance, accounting/allocation and private customer delivery still need the reviewed live service binding. This increment adds no public merchant endpoint or synthetic revenue.

**Wallet approval.** All requests retain the provider-selected standard and exact original payload hash/correlation/expiry. An installed EIP-1193 owner wallet can sign EIP-712 after an explicit click and exact owner/chain checks. NEP-413, NEP-366 and WebAuthn adapters accept a compatible external wallet port; no private key is imported into the browser. Returning a wallet signature only prepares a submission. It neither submits it nor proves a grant or balance. Provider SUCCESS is still a provider observation.

**Cloud, supplier rights and submission.** Official SDK verification remains mandatory in the existing business critical path. SDK0.3.0 does not provide the required supported durable plaintext recovery, so G6 remains held; no custom PRNG/decryption route was reintroduced. The configured `.env` Cloud key was checked locally for availability through the intended loader only. Its validity, attribution and credit are unverified; no credentialed request was made. Actual supplier entitlement/autonomous Cloud acquisition remain unsupported. Public repo, X and submission publication remain separate reviewed actions. Chain Signatures, licence-token minting and a second hiring marketplace were explicitly discouraged by the mentor and were not added.

## Owner flow

1. Open **Settings → NEAR execution connections**. Read the connection blockers.
2. Select an action and prepare its exact public inputs. This saves a private immutable request and calls no provider. It returns the request hash needed for a bounded owner authorization.
3. The request shows its current M01 blocking reason. **Run approved request** stays disabled until its policy, exact one-shot approval, total cost bound and required resources pass. Preparing a plan or having a key is insufficient.
4. Check the original operation after interruption. Unknown outcomes retain their reservation. A locally proven call that never started may release only its own zero-cost reservation; accepted or unknown work cannot be cancelled by flipping the local stop.
5. For OutLayer, read the attributed payer balance and reconcile the original terminal bill separately from validating an evaluation. For owner intents, inspect the exact provider preview and sign with the required wallet, then prepare the unchanged signed submission for separate authorization.
6. In **Company ledger**, distinguish the confirmed checkpoint from the native fee. A final contract head does not alone reconcile gas costs. No raw customer context enters account plans or feed content.

The advanced JSON input forms are review tools. Do not enter API keys, wallet private keys or private customer material into them. Credential references and owner manifests are private server inputs; incoming JSON cannot supply provider proof, cost facts or grants.

## Contracts and safeguards

| Module | Input | Output |
| --- | --- | --- |
| `src/rules/integrations.mjs` | Private prepared plans, exact owner scope, current policy, trusted resource/cost facts, common financial state | Hold/deny or one exact reservation/permit, cost record or proven-no-dispatch release |
| `src/integrations/index.mjs` | Owner action plus plan ID/stable request identity | Durable private request, original operation, raw exchange, scoped observation and ledger event |
| OutLayer codec | Pinned evaluator spec/job/project/payer and protected credential reference | Bounded real provider request, attributed balance, original result/bill; proof remains separate |
| PingPay codec | Versioned resource ID and exact requirements/refund/original deposit proof | Offers/quote/provider settlement observation, plus independent-proof gate |
| Owner intent codec | Exact generated intent and original wallet-signed payload | Provider request/correlation observation; never spending authority or money |
| Account/feed preparation | Public account/key/funding inputs or an exact confirmed checkpoint | Hashable unsigned review artifact; no account/key/transaction/post effect |
| M03 Treasury/native RPC | Exact current M01 plans and actual final native receipts | Absolute account snapshots, disjoint native fee reservations, actual-cost record and receipt watermark |

M01 owns policy. M03 alone mutates financial records. Native balances, confidential Intents assets and provider prepaid resources remain separate. Snapshots never add deposits or credit. A settled native fee remains deducted against an older snapshot until a newer block covers it. Every purpose counts toward the common actual-plus-pending USD ceiling. A recorded provider cost-bound breach stops new spending; unresolved or over-bound costs are not silently reconciled.

`nearIntegrations` is optional owner policy with only `operations` and `maxRequestNanoUsd`. No existing config was changed or enabled. The protected integration/ledger authorization file references in [.env.example](../.env.example) convey exact owner scope, not vendor proof. PingPay and owner-intent total-cost producers are not installed by these references; those requests hold without a trusted bound. Native publishing additionally requires the missing independently verified signing/fee-envelope producer.

## Evidence and reproduction

```sh
npm run evaluator:build          # Rust + wasm32-wasip2; builds locally, no deployment
npm run test:mentor              # real modules; HTTP provider responses are controlled test stand-ins
node scripts/check-native-fee-sandbox.mjs  # actual local nearcore/contract/RPC fees; no public funds
node scripts/check-mentor-browser.mjs      # isolated setup-only actual product; no provider fixtures
npm test
npm run test:native
npm run check
```

The build script records compiler, source/lock hashes and binary hash. A clean test checkout needs Rust/Cargo; the native evaluator test builds its locked executable if absent. Install `wasm32-wasip2` with rustup before the explicit WASI build. This does not deploy to OutLayer.

Artifacts are in [mentor-implementation](../artifacts/mentor-implementation/): full/focused/native/syntax logs, evaluator manifest/binary, actual Sandbox fee evidence, desktop/mobile browser captures, browser proof and source manifest. Positive injected verifier/envelope tests are explicitly test-only; they are not vendor evidence or production fallback implementations. Browser fallback followed the explicit T3 error “No preview automation host is available for snapshot.” Native desktop/mobile semantic reads measured CSS widths1315/356; repository Playwright confirmed actual1440/390 without overflow or page exceptions. The original preview store was not used for these QA actions.

Primary references: [Agent API deployed schema](https://api.agentsonintents.com/openapi.json), [PingPay two-phase x402](https://pingpay.gitbook.io/docs/pingpay-api/agent-pay-facilitator/x402-integration), [OutLayer HTTPS](https://app.outlayer.ai/docs/https-api), [OutLayer current OpenAPI](https://api.outlayer.ai/openapi.json), [OutLayer attestation documentation](https://app.outlayer.ai/docs/tee-attestation), [pinned worker V1 task binding](https://github.com/out-layer/outlayer/blob/2d50bfab14389857e6e50e84e76d5652b944e1cc/worker/src/tdx_attestation.rs), [NEAR access keys](https://docs.near.org/protocol/accounts-contracts/access-keys).

Contract freeze remains necessary: OutLayer's public OpenAPI omits the documented compute/resource-limit fields, and its pinned worker V1 binding includes caller/project/secrets/timestamp/payment fields beyond the simpler documentation example. No speculative proof normalizer or “verified” checkbox was added to bridge those differences. near.social write semantics and the native fee/signing envelope likewise remain explicit stop gates.
