# Actual public NEAR evidence

Collected **14 November 2026, 10:50:52.539–10:51:06.842 UTC**. Run ID: `2026-11-14T10-50-52-539Z`. This page records actual provider observations, separately from controlled tests and the local company demonstration.

## What was observed

1. **A real 1Click dry quote passed official signature verification.** `POST https://1click.chaindefuser.com/v0/quote` with `dry:true` returned **HTTP 201**. Official SDK **0.1.26**, using its **default production manager public key**, returned `verified` / `SIGNED_QUOTE_FIELDS_VERIFIED`. The signed timestamp is `2026-11-14T10:51:06.130Z`; the signed payload hash is `B3dqisZ9kPWttVcQzfGe8YS7DqUQX3NVfFf1Zn7FUBdy`.
2. **A real Cloud SDK preflight verified gateway and model attestation.** Official inference SDK **0.3.0** verified `Qwen/Qwen3.8-27B` at `2026-11-14T10:51:05.875Z`. Both TCB results were **UpToDate**, with distinct verified fresh nonces. The gateway TLS binding was attested. No completion was sent.
3. **Public discovery and schema reads succeeded.** Cloud models, model pricing, services, 1Click tokens, Agent API schema and current public TEE information each returned **HTTP 200**. The saved responses contain **64 models** and **231 tokens**. These are observations from this run, not guaranteed future counts.
4. **Mainnet RPC returned a final block and an absent account.** The final block was **224503657**, hash `HkUDEbEfZmPv8kb45WmNrNeT1CzCksB5Jgrq9a967QzA`. The deployment wallet query returned `UNKNOWN_ACCOUNT` at that same block. The account remains unprovisioned/unfunded; this is not a deployed ledger.

The [manifest](../artifacts/live-evidence/2026-11-14-readonly-r1/manifest.json) records **USD0**, no credentials used, no paid inference, no swap/transfer submission, no mainnet transaction and no account creation. The existing lifetime USD5 ceiling is unchanged. No official score increase or completion of the paid business path is claimed.

> **Scope note:** this page describes only the earlier read-only run. Later Agent API confidential swaps (0.1 and 0.025 USDC) did reach `SUCCESS`; see [MAINNET_EVIDENCE.md](MAINNET_EVIDENCE.md#8-loop-driven-spend-through-the-agent-api). They are confidential, so no public settlement transaction exists, and the dry quote here is unrelated to them.

## Evidence files and exact scope

All public files are under [artifacts/live-evidence/2026-11-14-readonly-r1](../artifacts/live-evidence/2026-11-14-readonly-r1/). The manifest binds nine public HTTP responses to exact byte lengths and SHA-256 hashes, with method, URL, request body, status and observation time. RPC uses read-only POST methods; the quote POST is explicitly dry. Neither submits a transaction.

### 1Click dry quote

Read the [summary](../artifacts/live-evidence/2026-11-14-readonly-r1/intents-dry-quote-summary.json) and [exact request/response exchange](../artifacts/live-evidence/2026-11-14-readonly-r1/intents-dry-quote-exchange.json).

The illustrative input is **1 USDC**, encoded as `1000000` atomic units with six decimals. Its asset ID came from the run’s actual NEAR token catalog:

```text
originAsset:      nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1
destinationAsset: nep141:wrap.near
swapType:         EXACT_INPUT
dry:              true
```

The request used the public deployment account as its recipient/refund address. It did not assert a spendable balance. The response echoed `dry:true`. Its quoted output was `299584203871025390624999` atomic wrap.near units. This is a historical quote, not a current offer or a recommended trade.

Verification covers the **signed quote envelope only**. It does not verify mutable provider status, settlement, finality, a refund or movement of funds. No customer, order, invoice or deposit instructions were accepted. No swap was submitted. The signature was supplied by the provider; the collector did not sign a payment.

The exchange stores exact request and response bytes as Base64, with these decoded-byte SHA-256 values:

```text
request:  d55ecefd802806ea99397b5506d36fa7d670339f2934811dda5a906fa9bd7dad
response: 48d55576bc74410b6ad864984f6c12a23e7ebdf89cc9ab9e2a2d3abecd12bb47
```

The SDK’s `signedPayloadHash` above identifies its signed payload. It is distinct from these SHA-256 hashes of the full HTTP bodies.

### Offline disk-reopen verification and negative control

The saved [offline verification](../artifacts/live-evidence/2026-11-14-readonly-r1/offline-verification.json), most recently regenerated through the npm alias at `2026-11-14T11:00:07.537Z`, records another cryptographic check of the actual provider quote. The verifier imported the exact public exchange into a temporary journal, closed and reopened it, then returned `verified` / `SIGNED_QUOTE_FIELDS_VERIFIED` with the unchanged SDK default production root and the same signed payload hash. The original provider bytes, manifest and summary hashes stayed unchanged.

The **explicitly synthetic negative control** changed `quote.amountIn` by **+1**, kept the provider signature and recomputed the altered response’s wire checksum. The SDK rejected it with `failed` / `QUOTE_SIGNATURE_INVALID`. This demonstrates signature rejection beyond a simple byte-checksum mismatch. It is not a second provider response or a live attack observation.

This offline command made **no network request**. It verified nine saved public response lengths/hashes and two summary checksums. **TEE attestation was not reverified offline**; the Cloud result remains the actual live preflight observation, with only its summary checksum checked here. Settlement stayed unverified.

### Cloud attestation

The [attestation summary](../artifacts/live-evidence/2026-11-14-readonly-r1/cloud-attestation-summary.json) records the SDK/version, model, policy fingerprint, verification time, nonce results, signer identities, runtime measurements and attested gateway TLS binding.

Both gateway and model **`deploymentProvenance` are `not_checked`**. Runtime measurements were observed; no allowlisted build provenance was established. This run claims no GPU attestation, generated output, accepted private reasoning, plaintext binding or durable plaintext replay. `completionSent` and `acceptedModelOutput` are false. Both plaintext and durable replay status remain unavailable.

The manifest references a private raw SDK evidence store. It is not published by this page. Public summary hashes support file integrity; they do not replace the SDK’s original attestation verification or solve the plaintext-recovery limitation.

### Public catalogs, current TEE information and RPC

The manifest records exact URLs and hashes for:

- Cloud `/v1/models`, `/v1/model/list?limit=1000&offset=0` and `/v1/services`.
- 1Click `/v0/tokens`.
- Agent API `/openapi.json` and `/tee/info`.
- Mainnet RPC `status`, `query` with `view_account`/final finality, and `block` with final finality.

The current Agent API `/tee/info` body is a **provider report**, not independently verified historical birth, TDX execution, a grant or an agent’s operational identity. Catalog prices and active-service flags establish neither enforceable aggregate charge bounds nor funded authority.

The absent account is:

```text
755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b
```

Only its public address was queried. The RPC used HTTP 200 for a JSON-RPC **error**: `UNKNOWN_ACCOUNT` is not successful account provisioning. [Ledger status](NEAR_ONCHAIN_LEDGER.md) retains the no-deployment/no-fee boundary and remaining native-fee/shared-Treasury/final-signing implementation.

## Reproduce collection and offline verification

Use the installed dependencies and supported Node **24.22.1+**. The recorded commands used Node **26.12.1** at the path below. These commands are documented here; they were not rerun by the documentation worker.

The exact **historical collection invocation** was:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node scripts/collect-live-evidence.mjs \
  --network mainnet \
  --account 755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b \
  --model Qwen/Qwen3.8-27B \
  --out artifacts/live-evidence/2026-11-14-readonly-r1
```

**Preserve that directory.** The collector now refuses an existing output directory before any fetch. The coordinator’s overwrite check exited **1 / `EEXIST`** before provider I/O. For a fresh collection, omit `--out` to use a new timestamp directory:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node scripts/collect-live-evidence.mjs \
  --network mainnet \
  --account 755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b \
  --model Qwen/Qwen3.8-27B
```

The only accepted flags are `--network`, `--account`, `--model` and optional `--out`. The collector makes actual public requests and SDK preflight, creates a separate local private SDK journal and saves public outputs. It does not load `.env`, use credentials, send a completion, sign a payment or broadcast a transaction. A rerun observes new provider state; it cannot reproduce the old nonces, prices or hashes.

The exact **historical offline invocation** was:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node scripts/verify-live-evidence.mjs \
  artifacts/live-evidence/2026-11-14-readonly-r1
```

The verifier writes `offline-verification.json` in its input directory. To preserve the recorded result, reproduce it on a **copy**:

```sh
evidence_replay_dir="$(mktemp -d "${TMPDIR:-/tmp}/near-evidence-replay.XXXXXX")"
cp -R artifacts/live-evidence/2026-11-14-readonly-r1/. "$evidence_replay_dir/"
PATH=/Users/jys/.hermes/node/bin:$PATH node scripts/verify-live-evidence.mjs "$evidence_replay_dir"
```

The verifier uses an ephemeral journal and deletes that journal afterward. It makes no network request. `npm run evidence:live -- ...` and `npm run evidence:verify -- ...` are the corresponding script aliases. The checksum-only command below needs no installed SDK or journal and writes nothing.

## Verify the saved public bytes

From the repository root, this command reads public artifacts only. It makes no network request and runs no product test:

```sh
python3 - <<'PY'
import base64
import hashlib
import json
from pathlib import Path

evidence_dir = Path('artifacts/live-evidence/2026-11-14-readonly-r1')
manifest = json.loads((evidence_dir / 'manifest.json').read_text())
for item in manifest['requests']:
    raw = (evidence_dir / item['responseFile']).read_bytes()
    assert len(raw) == item['bytes'], item['name']
    assert hashlib.sha256(raw).hexdigest() == item['sha256'], item['name']
    print('OK response:', item['name'])
for name in ['cloud-attestation-summary.json', 'intents-dry-quote-summary.json']:
    sidecar = (evidence_dir / (name + '.sha256')).read_text().split()
    assert sidecar[1] == name
    assert hashlib.sha256((evidence_dir / name).read_bytes()).hexdigest() == sidecar[0]
    print('OK summary:', name)
exchange = json.loads((evidence_dir / 'intents-dry-quote-exchange.json').read_text())
for part in ['request', 'response']:
    raw = base64.b64decode(exchange[part]['bodyBase64'], validate=True)
    assert hashlib.sha256(raw).hexdigest() == exchange[part]['bodyHash'], part
    print('OK quote bytes:', part)
PY
```

Independent summary/file SHA-256 values recorded for this run:

```text
8b2d6fa275935adff08e954aba30b95fa7ae1b67bf1d3bc89e137d9c01c9b657  cloud-attestation-summary.json
ff08907e025865645bf2e8616a74a27cb20ff798fe235a1a107f5efc04380a57  intents-dry-quote-summary.json
b17224a81e77fdaf6883ccd310d5c62562bad953d6ba9ec9c8c1504346fc2c04  intents-dry-quote-exchange.json
```

Hash equality confirms saved byte integrity against the recorded values. It does not itself prove provider identity, recency or business truth. Official SDK signature/attestation findings have the narrower scopes above. A later collection will have different timestamps, nonces, prices, block heights and hashes.

For this increment, the coordinator reports **138 JavaScript syntax files passed** (`npm run check`, Node26; `/tmp/near-live-evidence-syntax.log`). The existing **512-test** result is earlier evidence and was not rerun. The overwrite-check log is `/tmp/near-evidence-overwrite-check.log`. The documentation checks verify saved public hashes, links and unchanged reviewed plan hashes; they add no paid or live-business test result.

## What remains open

This evidence strengthens actual public-provider integration. It does not close the paid critical path: accepted durable original plaintext proof, exact credentials/work authority, scoped attributable credit, enforceable numerical charge bounds, independent settlement/movement/refund evidence and supported resource acquisition remain separate. Ledger publication still requires the missing fee/Treasury/final-signing protocol. These are not all solvable by a user key.

The [company guide’s status table](COMPANY_FOR_NONE_GUIDE.md#current-capability-and-status) is the current product boundary. The [customer-care service](CUSTOMER_CARE.md) remains local model-free cited lookup; none of these public reads changes its behavior. Historical plans, reports and handoffs retain their original evidence and limits.
