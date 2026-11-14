# Mainnet verification evidence

Dated **14 November 2026**. This page records every verification item completed on
NEAR mainnet, with the exact transactions, contracts, artifacts and a single
reproducible command. Each claim is independently checkable on a public block
explorer; nothing here is a judge score or a spending authority.

> **Trust labels:** **LIVE_PUBLIC** = a real public chain transaction or provider
> observation; **HELD/VERIFIED** = real execution whose output is held by policy,
> not promoted to accepted business truth; **CONTROLLED** = injected test facts.

```text
Account roles
  ledger contract / owner : 755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b
  scoped-key writer (retired): c65dfd852ac424c967951a7f3e2d6ee3153374822c30a4a484345ee5bbf456fc
  Agent API agent account : b2c5b8f31edf4dfb2560eb14397c8d61656c9f34c4f644077ed08a991fd9fc75
  dedicated marketplace payer : e17d480f28ef0c3f39c7b3a12bdf80acfa2e2282a5e7a2eae3f019510ce6e8d4
```

## Reproduce everything (one command)

```sh
node scripts/verify-mainnet-evidence.mjs
```

It is **read-only**: public RPC `query`/`tx` and contract `get_head`/`get_records`
views only. It sends nothing, signs nothing, spends nothing. It prints PASS/FAIL
for every item below and exits non-zero if any claim fails. Last run: **20/20 passed**.

## 1. Ledger contract deployed on mainnet (risk #1)

| Step | Label | Transaction |
| --- | --- | --- |
| Atomic deploy `deploy_contract(wasm)` + `new(company_hash, null)` | LIVE_PUBLIC | [`DP64fpGTGLyDwUouW9ecas6wgZwozS7hyDeKH3WtUswR`](https://nearblocks.io/txns/DP64fpGTGLyDwUouW9ecas6wgZwozS7hyDeKH3WtUswR) |
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

- Scope proof: a `Transfer` from that key was **rejected** way `Access key requires full access` (`scopeCheck` in the artifact).
- Final key listing: only `FunctionCall(append)` remains.

Evidence: `artifacts/onchain-ledger/mainnet-scoped-writer.json`. Script: `scripts/setup-scoped-writer.mjs`.

## 3. Dedicted marketplace payer (mentor item 3)

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

- Real `wrap.near` `near_deposit` then `ft_transfer` to a 1Click deposit address (after `storage_deposit` registration), status `SUCCESS`, ~2.33 USDC on NEAR delivered.
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
- Cost **632,050 nanoUSD ($0.000632)**, secured under the $0.10 bound and reconciled; the store totals within the $5 lifetime ceiling.

| Claim | Value |
| --- | --- |
| status | `answered` |
| wire signature verified | `true` |
| plaintext verified in original call | `true` |
| offline plaintext recovery | `false` (route b) |
| cost status | `confirmed` / `APPROVED` |

Evidence: `artifacts/mainnet-proof/cloud-inference-item5.json`, `cloud-run-summary.json`.

## What each item does **not** prove

- Ledger records are **commitments**, not proof of business truth; raw data stays off chain.
- The marketplace payment buys one task result; it is **not** a reusable skill/persona licence.
- The Cloud call is real inference over **fictional** company documents; it is not a real insurer decision, and offline plaintext replay is unavailable.
- No capital, credit lot, autonomous Cloud purchase, customer sale, payout or refund is created or claimed.
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
```
