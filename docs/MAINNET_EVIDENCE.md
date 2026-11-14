# Mainnet verification evidence

Dated **14 November 2026**. This page records every verification item completed on
NEAR mainnet, with transactions, contracts, provider artifacts and a read-only
checklist. Chain transactions can be inspected on a public block explorer;
provider completion, delivery and billing records require separate verification.
Nothing here is a judge score or a spending authority.

> **Trust labels:** **LIVE_PUBLIC** = a real public chain transaction or provider
> observation; **HELD/VERIFIED** = real execution whose output is held by policy,
> not promoted to accepted business truth; **CONTROLLED** = injected test facts.

The provider sections describe retained original-run records. The checklist's
**LOCAL_ARTIFACT** label explicitly distinguishes inspecting those records from
fresh independent verification of their claims.

```text
Account roles
  ledger contract / owner : 755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b
  scoped-key writer (retired): c65dfd852ac424c967951a7f3e2d6ee3153374822c30a4a484345ee5bbf456fc
  Agent API agent account : b2c5b8f31edf4dfb2560eb14397c8d61656c9f34c4f644077ed08a991fd9fc75
  dedicated marketplace payer : e17d480f28ef0c3f39c7b3a12bdf80acfa2e2282a5e7a2eae3f019510ce6e8d4
```

## Recheck chain state and inspect retained provider artifacts

```sh
node scripts/verify-mainnet-evidence.mjs
```

It is **read-only**: public RPC `query`/`tx`, contract `get_head`/`get_records`
views and local artifact reads only. It signs nothing and spends nothing. Each
PASS/FAIL is labeled **LIVE_PUBLIC** or **LOCAL_ARTIFACT**, and a failed check exits
non-zero. The recorded checklist has **14 live public-chain checks** and **6 local
provider-artifact checks**. The latter inspect stored fields; they do not independently
reverify marketplace completion/payment, Cloud signatures or provider billing.
**The claimed 1Click swap settlement is not checked by this command.** A passing
20/20 checklist does not establish all business claims or the complete autonomous flow.

## 1. Ledger contract deployed on mainnet (risk #1)

| Step | Label | Transaction |
| --- | --- | --- |
| Atomic deploy `deploy_contract(wasm)` + `new(company_hash, null)` | LIVE_PUBLIC | [`DP64fpGTGLyDwUouW9ecas6wgZwuzS7hyDeKH3WtUswR`](https://nearblocks.io/txns/DP64fpGTGLyDwUouW9ecas6wgZwuzS7hyDeKH3WtUswR) |
| `set_writer(owner)` + append sequence 2 | LIVE_PUBLIC | [`Cmh2zL2SWhm5mJ4JY23nHFFyJtLiavEV4Vfp4Bsvzb1n`](https://nearblocks.io/txns/Cmh2zL2SWhm5mJ4JY23nHFFyJtLiavEV4Vfp4Bsvzb1n) / [`5Xg6uasjZW4nnwWCFjP3stAaaiDtnCixc3zGvuCarhUb`](https://nearblocks.io/txns/5Xg6uasjZW4nnwWCFjP3stAaaiDtnCixc3zGvuCarhUb) |

- Contract account: `755a0a4b…`, `code_hash` `GnfHJq4kXk5eLNNSvez2ue7BCHDEaGyZSTXrGzqaZ27g` (matches `artifacts/onchain-ledger/contract-manifest.json`).
- Rust `near-sdk` 5.30.2; safe ordered hash projection; no raw customer/policy data on chain.

Evidence: `artifacts/onchain-ledger/mainnet-deployment.json`, `mainnet-ledger-write.json`.
Scripts: `scripts/deploy-ledger-mainnet.mjs`, `scripts/write-ledger-record.mjs`.

## 2. Scoped writer key + key hygiene (mentor items 1 & 4)

| Step | Label | Transaction |
| --- | --- | --- |
| `Add_Key` function-call key scoped to `append` | LIVE_PUBLIC | [`DUPtojtZt7jUkEUozUeQGBbs812nWHDiXhKjv3v2jxe`](https://nearblocks.io/txns/DUPtojtZt7jUkEUozUeQGBbs812nWHDiXhKjv3v2jxe) |
| `Delete_Key` remove full access | LIVE_PUBLIC | [`FPVgbFSQ6CqLFMtBYi4QKcAAz1WaMYwZGZ6ruXiAWyt`](https://nearblocks.io/txns/FPVgbFSQ6CqLFMtBYi4QKcAAz1WaMYwZGZ6ruXiAWyt) |
| `append` signed by the scoped key | LIVE_PUBLIC | [`GsQhBsCknFXwGTHjdMtSqWPHuyVBZgK31AqufopeUK7d`](https://nearblocks.io/txns/GsQhBsCknFXwGTHjdMtSqWPHuyVBZgK31AqufopeUK7d) |

- Scope proof: a `Transfer` from that key was **rejected** with `Access key requires full access` (`scopeCheck` in the artifact).
- Final key listing: only `FunctionCall(append)` remains.

Evidence: `artifacts/onchain-ledger/mainnet-scoped-writer.json`. Script: `scripts/setup-scoped-writer.mjs`.

## 3. Dedicated marketplace payer (mentor item 3)

- New payer `e17d480f…` funded with 1.0 USDC on NEAR; payment signed by that account, not the deploy key.
- Finding: the marketplace x402 endpoint **rejects function-call keys** (`invalid_exact_near_function_call_key_not_allowed`), so payer isolation is by **account**, not key scope. This is documented provider behaviour, not an oversight.

Scripts: `scripts/setup-scoped-payer.mjs`, `scripts/pay-marketplace.mjs`.

## 4. Real paid marketplace call (x402 / NEP-366)

| Task | Label | Payer | Amount |
| --- | --- | --- | --- |
| `c41a599b-87a3-42cd-a70b-d35ad0d9babd` | LIVE_PUBLIC | `755a0a4b…` | 0.5 USDC |
| `0de69385-54a4-4e1f-bd34-c4155f532242` | LIVE_PUBLIC | `e17d480f…` | 0.5 USDC |

- Challenge: `near:mainnet` / USDC `17208628…` / payTo `ea667f5f…` (checked against `https://market.near.ai//.well-known/x402`).
- Payment = one NEP-366 signed delegate action (`ft_transfer`), payer pays no gas; both tasks `TASK_STATE_COMPLETED` with delivered, cited results.

Evidence: `artifacts/marketplace/payment-*.json`.

## 5. NEAR Intents 1Click swap (NEAR → USDC)

- Reported: `wrap.near` `near_deposit` then `ft_transfer` to a 1Click deposit address (after `storage_deposit` registration), status `SUCCESS`, ~2.33 USDC on NEAR delivered.
- **Label: run-note only.** No artifact, deposit address or transaction hash from this swap was retained in the repository, and no script checks it. Treat it as unverified here. The retained, checkable swaps are the two Agent API confidential swaps in section 8.
- Fixed a real gotcha: 1Click deposit addresses must be registered on wNEAR before the NEP-141 transfer.

Script: `scripts/swap-near-to-usdc.mjs`.

## 6. Agent API native-call route — the expected tool (mentor item 2)

| Step | Label | Reference |
| --- | --- | --- |
| `agent_create` (owner signature 1) | LIVE_PUBLIC | agent `0385e033…`, account `b2c5b8f3…`, policy `APPLIED` |
| `grant_issue` (owner signature 2) | LIVE_PUBLIC | live grant `45645e46…` |
| Fund agent NEAR account | LIVE_PUBLIC | [`6J4mwqzNaNSxvSmXDVRYcQZvxYE3zURm2suGiktu6eXD`](https://nearblocks.io/txns/6J4mwqzNaNSxvSmXDVRYcQZvxYE3zURm2suGiktu6eXD) |
| Native `get_head` via Agent API | LIVE_PUBLIC | [`36e1KinTTejrjGB8ZbeL69qiSYWDX3C6bbShpUd7Pepp`](https://nearblocks.io/txns/36e1KinTTejrjGB8ZbeL69qiSYWDX3C6bbShpUd7Pepp) |
| Native `append` via Agent API | LIVE_PUBLIC | [`B5uKmgFDs8MrVrMZUuYDj9yQxYDP8bWnpQDdgduJwF1m`](https://nearblocks.io/txns/B5uKmgFDs8MrVrMZUuYDj9yQxYDP8bWnpQDdgduJwF1m) |

- The ledger writer is now the **agent's own NEAR account**, signing under the owner-signed policy + grant — not a raw key. This satisfies the "Agent API is the expected tool" requirement.
- Ledger head advanced sequence 4 → 6 with the agent's append.

Evidence: `artifacts/onchain-ledger/mainnet-agent-api-append.json`.
Scripts: `scripts/agent-api-create.mjs`, `scripts/agent-api-whoami.mjs`, `scripts/fund-agent-account.mjs`, `scripts/agent-api-append.mjs`.

## 7. Live NEAR AI Cloud inference under route (b) — Privacy track (mentor item 5)

- Owner-selected policy: **`live-verified-hold-on-loss`** (route b). Encrypted E2EE reply, fresh-nonce TEE handling, verified in the original call; **offline plaintext recovery unavailable** by design.
- One real call: model `Qwen/Qwen3.8-27B`, answer accepted with an exact citation, provider completion `89ea7023…`, inference `41239757…`.
- Cost **632,050 nanoUSD ($0.000632)**, under the $0.10 per-call bound and reconciled. Three recorded demo calls total **3,853,210 nanoUSD ($0.00385321)**, all reconciled, within the $5 lifetime ceiling.

| Claim | Value |
| --- | --- |
| status | `answered` |
| wire signature verified | `true` |
| plaintext verified in original call | `true` |
| offline plaintext recovery | `false` (route b) |
| cost status | `confirmed` / `APPROVED` |

Evidence: `artifacts/mainnet-proof/cloud-inference-item5.json`, `cloud-run-summary.json`.

## 8. Loop-driven spend through the Agent API

| Step | Label | Reference |
| --- | --- | --- |
| Decision: real NEAR AI Cloud completion (`Qwen/Qwen3.8-27B`, E2EE, signature verified) chose one `spend` command | LOCAL_ARTIFACT | provider request `6d4770b3…`, [`loop-receipt.json`](../artifacts/mainnet-proof/loop-receipt.json) |
| Autonomy loop executes it via Agent API under the owner grant: 25000 raw USDC (**0.025 USDC**) | LOCAL_ARTIFACT, re-readable with `NEAR_INTENTS_AGENT_API_KEY` (LIVE_AUTHED) | correlation `op_CeDN5uzQ…`, status `SUCCESS` |
| Loop auto-commits `spend.requested` (seq 21) and `spend.completed` (seq 20) plus agent lifecycle events | LIVE_PUBLIC | [`VsMbQdnVXAk2…`](https://nearblocks.io/txns/VsMbQdnVXAk2aJrVne2fZhnyTaPmS9fXhYi4Up6f3NT) |
| Earlier proof: allowed 0.1 USDC swap `SUCCESS`; over-limit request **refused** by policy | LOCAL_ARTIFACT | [`agent-spend-proof.json`](../artifacts/mainnet-proof/agent-spend-proof.json) |

```sh
node scripts/verify-loop-receipt.mjs   # read-only; 18/18 at last run (14 LIVE_PUBLIC)
```

The verifier recomputes each committed event's payload hash with the product's own function and finds it in the contract's hash-chained records, then checks the ledger transaction is FINAL, successful and an `append()` signed by the agent. Reproduce the run itself with `node scripts/loop-spend-e2e.mjs` (needs owner credentials and spends real funds; `--controlled` supplies the decision instead of a model, `--reason-only` spends nothing).

## 9. Customer-funded service loop

One real customer sale, one paid answer, the cost attributed to it, and the surplus. Labels are exact.

| Step | Label | Reference |
| --- | --- | --- |
| **Revenue in:** customer pays 0.10 USDC (in wNEAR, settled to USDC by 1Click) into the treasury | LIVE_PUBLIC (settlement leg), provider `SUCCESS` | settlement tx [`3k7d2NbkpVhh…`](https://nearblocks.io/txns/3k7d2NbkpVhhL4KP3eQDVWHNsAzzZykDz1vKLbWaEVPn), artifact [`live-checkout-settlement.json`](../artifacts/mainnet-proof/live-checkout-settlement.json) |
| `sale.confirmed` committed to the ledger | LIVE_PUBLIC | [`68Wy7NvsrKQp…`](https://nearblocks.io/txns/68Wy7NvsrKQpnAGPu1ySZ7GYY1STm4CD5ou5FmauV8fb) |
| **Paid answer:** the sale is claimed (one answer per sale), then a real E2EE NEAR AI call over the Harbor Mutual documents (`Qwen/Qwen3.8-27B`, response signature verified) | LOCAL_ARTIFACT | inference `e0cc2328…`, [`funded-loop.json`](../artifacts/mainnet-proof/funded-loop.json) |
| **Expense out:** provider-billed cost **202,710 nanoUSD ($0.000203)** | LOCAL_ARTIFACT (provider `/billing/costs`) | same |
| **Surplus:** 100,000,000 - 202,710 = **99,797,290 nanoUSD ($0.0998)** stays attributed to the treasury | LOCAL_ARTIFACT (arithmetic) | same |
| `inference.consumed` committed to the ledger, referencing the sale | LIVE_PUBLIC | [`9c2JJN2K3uYM…`](https://nearblocks.io/txns/9c2JJN2K3uYMvAyA8dCBEX7UbQbkRtdofJrqjzRdmCpU) |

```sh
node scripts/demo-funded-loop.mjs register | answer "<question>" | report   # needs a settled live-checkout sale; spends ~$0.0002-0.002 of the owner Cloud key
node scripts/verify-funded-loop.mjs                                         # read-only; 10/10 at last run
```

**Limits, stated plainly:**
- **No USDC paid NEAR AI.** There is no documented cash-to-Cloud-credit route (`src/cloud-funding/index.mjs`). The call was billed to the owner-prepaid Cloud key; the sale is *attributed* to that cost in the ledger and the `funding` field says so. Revenue in and cost out are both real, but the second was not paid from the first.
- **Two earlier real calls are unattributed owner expense.** Their billing ids were not captured (the SDK hides response headers), so their costs could not be matched and the claims were released. They are listed under `abandoned` in `.runtime/funded-loop/state.json` (local state, not committed).
- Sale assurance is provider `SUCCESS` plus a FINAL on-chain settlement leg; the independent money-movement port is not wired. The verifier also does not check the customer's own transfer into the deposit address (it is not in the artifact).
- The billed cost is the provider's report, not on-chain.
- The paid-answer gate exists in the server route (`POST /api/workspace/ai-demo/run` with `saleId`, enabled by `SHOP_FUNDED_LOOP_FILE`) and is unit-tested, but the live answer was run through the script: the preview store is bound to a different provider identity (`ECONOMIC_IDENTITY_MISMATCH`), so the full server was not started for this evidence.

## Payment inventory: what moved and how to check it

| Movement | Amount | Counterparty | Publicly checkable? |
| --- | --- | --- | --- |
| Marketplace x402 task `c41a599b…` | 0.5 USDC | market.near.ai | Chain tx not retained in artifact; task completion is a LOCAL_ARTIFACT |
| Marketplace x402 task `0de69385…` | 0.5 USDC | market.near.ai | Same |
| Agent API confidential swap (allowed case) | 0.1 USDC → wNEAR | Intents | No: confidential, no public tx |
| Loop-driven confidential swap | 0.025 USDC → wNEAR | Intents | No; only its ledger commitment is public |
| 1Click NEAR→USDC swap | ~2.33 USDC received | Intents | No artifact retained (section 5) |
| **Customer sale (revenue in)** | **+0.10 USDC** (paid as ~0.0327 wNEAR) | 1Click deposit → treasury | Settlement leg yes (FINAL tx); see section 9 |
| Ledger `append()` calls | gas only | the ledger contract | Yes, FINAL txs |

**One customer payment was received (section 9); every other row is outbound spending by us.** Provider `SUCCESS` and a ledger commitment are not monetary finality.

## What each item does **not** prove

- Ledger records are **commitments**, not proof of business truth; raw data stays off chain.
- The marketplace payment buys one task result; it is **not** a reusable skill/persona licence.
- The Cloud call is real inference over **fictional** company documents; it is not a real insurer decision, and offline plaintext replay is unavailable.
- No capital, credit lot, autonomous Cloud purchase, payout or refund is created or claimed. The one customer sale is section 9, with its limits.
- The loop spend is a confidential swap of cents. Its purpose text ("buy inference credits") is model-written and describes no purchase that occurred.
- Confidential swaps have no public transaction, so a third party cannot confirm funds moved from the chain alone.
- Payer/writer isolation is by **account**; the writer key scope is the only key-level control proven here.

## Full list of `artifacts` for this increment

```text
artifacts/onchain-ledger/mainnet-deployment.json
artifacts/onchain-ledger/mainnet-ledger-write.json
artifacts/onchain-ledger/mainnet-scoped-writer.json
artifacts/onchain-ledger/mainnet-agent-api-append.json
artifacts/marketplace/payment-*.json
artifacts/mainnet-proof/cloud-inference-item5.json
artifacts/mainnet-proof/cloud-run-summary.json
artifacts/mainnet-proof/loop-receipt.json
artifacts/mainnet-proof/loop-spend-e2e.json
artifacts/mainnet-proof/agent-spend-proof.json
```
