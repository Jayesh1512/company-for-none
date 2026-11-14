# Company ledger on NEAR

For the company operating model and consolidated capability status, see [How CompanyOs works](COMPANYOS_GUIDE.md). This page specifies the ledger implementation, mainnet evidence and remaining routine-publishing work.

The contract is **deployed on NEAR mainnet**, with six linked records in the recorded evidence and the Agent API agent account as operational writer. Deployment, scoped-key writes and the Agent API append were performed through separately invoked scripts. Routine app publishing remains gated on a verified native fee/signing envelope and exact current authority. See [transactions, read-only verification and limits](MAINNET_EVIDENCE.md).

## Deployment wallet

Funding account:

```text
755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b
```

This ed25519 implicit mainnet account is now funded and hosts the deployed ledger contract. Its credential is in `.runtime/company-ledger-wallet/mainnet/credential.json`, mode0600, under an ignored directory. No secret is in the public metadata, journal, UI, logs or artifacts. Preserve this private file; it is the deployment owner's key. `public.json` contains only the public account/key/network/company binding; its creation-time provisioning flags are historical, so query current chain state. Repeating wallet generation preserves the key, and can recover missing public metadata after an interrupted first write. Wallet generation itself never provisions or transfers funds.

The earlier [14 November public-only evidence run](LIVE_EVIDENCE.md) saved `UNKNOWN_ACCOUNT` at final mainnet block **224503657**, hash `HkUDEbEfZmPv8kb45WmNrNeT1CzCksB5Jgrq9a967QzA`, before funding and deployment. Exact RPC bytes and hashes are retained as historical evidence. The same run's signed 1Click dry quote supplies no native-call signing authority or settlement proof. Later deployment and Agent API writes are recorded separately in [mainnet evidence](MAINNET_EVIDENCE.md).

## What is stored on-chain

An actual ordered record is stored in contract state for each approved source-journal event:

```json
{"sequence":1,"type":"agent.created","at":"2026-11-14T09:00:00.000Z","actorHash":"…","payloadHash":"…","previousHash":"…","hash":"…"}
```

Each record commits to its private original event through a company-domain-separated payload hash. Unknown event names become `private.event`. Actor identities become hashes; raw conversation text, customer identifiers, policy documents, access tokens and credentials are not contract arguments. The record hash binds the company, sequence, type, timestamp, actor/payload hashes and previous hash. Genesis uses64zeroes. Exact algorithms are in M01 `src/rules/onchain-ledger.mjs`; Rust recomputes every record hash.

These hashes are commitments, not encryption or proof that the original business action was truthful. Types/times/counts are public. Retain the private journal to verify original data against the commitments. The deployment owner retains a full-access key and can upgrade its contract; this is an owner-administered audit contract, not an immutable ownerless system. RPC inspection pins the expected compiled code hash and refuses changed code.

## Contract

`contracts/company-ledger/src/lib.rs` uses pinned near-sdk5.30.2:

- `new(company_hash, writer_id)` must be called by the contract account itself. Real deployment must atomically deploy+initialize. The prepared deployment draft has writer null until the company agent exists.
- `set_writer(writer_id)` is deployment-owner-only and does not delete history.
- `append(company_hash, expected_sequence, expected_hash, records)` is operational-writer-only, nonpayable, contiguous and hash-checked, with at most50records.
- Exact duplicate batches are no-ops. Partial overlaps, changed replay content, wrong company, wrong writer or broken chains fail atomically.
- `get_head()` and `get_records(from_sequence, limit)` are public views. There is no delete, transfer or arbitrary-call method.

The built WASM is `artifacts/onchain-ledger/company-ledger.wasm`; its size/hash/codeHash are in the adjacent manifest. Build uses the SDK's required `--cfg near`, MVP-compatible lowering and pinned Binaryen132. Rust Cargo.lock and the root npm lockfile are retained.

## Owner UI and read/prepare path

Open [Company ledger](http://127.0.0.1:4173/#autonomy/ledger). The panel shows local vs confirmed chain checkpoints, the deployment address, operational binding and actual build hash. Read chain status performs bounded public reads only. Export downloads M01's safe record projection. Prepare creates an unsigned durable batch only after a fresh final RPC head matches the local checkpoint. None of these actions signs or spends.

Owner-only routes:

```text
GET  /api/workspace/ledger-chain
POST /api/workspace/ledger-chain/inspect     {}
POST /api/workspace/ledger-chain/export      {}
POST /api/workspace/ledger-chain/prepare     {"limit":50}
POST /api/workspace/ledger-chain/reconcile   {"batchId":"…"}
POST /api/workspace/ledger-chain/publish     {"batchId":"…"}  # held without verified envelope + exact authority
POST /api/workspace/ledger-chain/balance     {}
POST /api/workspace/ledger-chain/fees        {"operationId":"…"}
```

The private `getLedgerFacts` callback supplies real events/checkpoints/batches and actual RPC evidence. Caller bodies cannot set binding, fees, authorization, a successful transaction or a verified head. Reads pin network, contract code, actual writer, block and record suffix. Reconcile advances a checkpoint only from actual final contract state that proves the exact batch; a provider status or transaction hash alone is insufficient. It makes no claim that gas costs are accounted merely because state is confirmed.

## Agent API signing and outstanding live work

The selected operational route is **NEAR Intents Agent API native call**, not the1Click swap quote API:

```text
POST /v1/agents/{agent_id}/native/near/call
X-API-Key: protected partner key
X-Grant-Token: protected live grant
Idempotency-Key: stable original logical operation
body: {receiver_id:<ledger>,method_name:"append",args:<exact batch>,gas:<approved>,deposit:"0"}
```

The provider requires `receiver_id` in policy `native.near.call`. Its ordinary `budget`, `timelock_ms`, `schedule` and `owner_approval` do **not** apply to native calls. That makes our own exact call binding, native fee limit, lifetime USD5 actual+pending reservation and immediate final gate essential. `src/onchain/agent-writer.mjs` implements the durable native HTTP port and refuses secrets/I/O without a real M01 effect permit. It never promotes a provider response to confirmed ledger state. The app now wires this port through exact M01/M03 admission, native/USD reservation, consumed permit and the immediate final transport gate. It is executable only if a private verified native fee/signing envelope and exact scope exist; the default production composition has no such producer.

**Routine app publishing remains held without verified per-operation inputs**, even if a structural authorization object is present. Shared native/USD reservation, permit consumption, final dispatch, original-operation recovery and final-RPC actual-fee accounting are implemented and locally tested. Mainnet deployment and a script-driven Agent API append are now established; they do not supply the app's missing independent native fee/signing-envelope producer or verify its current exact authority and funding. This is not solved by supplying funds or a key alone. No generic dispatch permit, direct-wallet operational fallback or new USD5 allowance is created.

An Agent API identity, owner-signed policy and live grant were provisioned for the recorded mainnet run. Routine app setup must bind and verify that existing scope rather than infer permissions from the deployment:

1. A protected partner API key from partners.near-intents.org. The official public schema exposes owner actions through generate-intent → owner signs unchanged payload → submit-intent. Do not invent a POST registration endpoint.
2. Evidence of review/acceptance of the provider's required terms and the exact owner-signed policy/grant. Retain protected references to the existing identity and grant; a successful past append is not current spending authority.
3. The resulting agent's actual NEAR account as operational writer, and a native-call allowlist for this contract only. Contract permissions prevent that writer rotating itself or moving deployment funds.
4. Fresh operational-account balance and concrete fee/storage/USD bounds within the existing total ceiling, followed by the verified per-operation signing protocol. No NEAR/USD conversion or funding amount is guessed.

The completed contract deployment used the deployment owner's key, separately from subsequent agent calls. The older prepared deployment draft remains an unsigned historical artifact. Redeployment or further calls require their own exact authority; the evidence scripts do not enable routine app dispatch.

## Reproduction and evidence

```sh
# Supported Node>=24.22.1, Rust + wasm32-unknown-unknown target
npm run contract:build
npm run contract:test
node --test test/onchain-ledger/*.test.mjs test/onchain-ledger-rules/*.test.mjs
node scripts/check-ledger-browser.mjs http://127.0.0.1:4173
npm run ledger:deployment-plan -- mainnet
node scripts/verify-mainnet-evidence.mjs  # live ledger checks + labeled local provider artifact checks
npm test
npm run check
```

Actual local NEAR Sandbox execution passes append/read/replay and negative writer/hash/overlap/company/revocation checks. Both bundled nearcore2.6.2 and separately downloaded official2.14.1 were exercised; neither is a mainnet transaction. Protocol tests use injected local responses explicitly; browser proof uses the running actual app and free mainnet account read. See `artifacts/onchain-ledger/` for logs, manifest, safe export, screenshots and the unsigned deployment draft. Private credentials are excluded.

Primary sources checked14November2026: [NEAR API libraries](https://docs.near.org/tools/near-api), [contract quickstart](https://docs.near.org/smart-contracts/quickstart), [production builds](https://docs.near.org/smart-contracts/anatomy/reduce-size), [deployed Agent API schema](https://api.agentsonintents.com/openapi.json). Official near-api-js7.5.3, near-sdk5.30.2 and near-workspaces5.0.0 are pinned. The sandbox downloader's vulnerable tar dependency is overridden to patched tar7.5.23; remaining dependency audit findings are low severity. No existing dependency was blindly force-upgraded.


## Mentor follow-up,14 November2026

See [all dispositions and safeguards](MENTOR_IMPLEMENTATION.md). New native fee receipts verify the exact final transaction and receipt-block watermark, including gas burned by failed calls. Known unsubmitted calls can release only their own zero-cost reservation; unknown calls retain it and cannot be retried blindly. Absolute native balance snapshots never become Intents cash or Cloud credit. Costs and checkpoint finality remain separate owner-visible facts. Actual local Sandbox fee checks use the real compiled contract and nearcore RPC; their USD conversion is explicitly test-only. That earlier increment made no mainnet account, signing, deployment or fee; [later mainnet evidence](MAINNET_EVIDENCE.md) records the subsequent transactions.

The earlier UI's scoped function-call key and named/role account output remains an unsigned review plan. A separately invoked script later installed and exercised a scoped writer key, then the contract writer was rotated to the Agent API account. The selected routine Agent API route is unchanged. The near.social feed is a bound, confirmed-hash-only preparation artifact; current publication semantics and authority remain unverified and no post is made.
