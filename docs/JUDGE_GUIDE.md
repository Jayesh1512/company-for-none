# Judge's guide: verify first, execute only with approval

This is a short route through the submitted prototype. It separates public-chain verification, retained provider records and paid execution. No credential is needed for the public-only checks below.

## 1. See the differentiated behavior

Read [the contact-preference recovery](LIVE_RECOVERY_DEMO.md) and its [retained run](../artifacts/live-recovery/browser-proof.json):

- Support escalates an unanswered question rather than inventing a requirement.
- The bounded workflow delegates a knowledge curator and template developer.
- Approved source text becomes a new native JBrain revision.
- The fixed mandatory-field evaluator fails the baseline and passes the candidate.
- The subsequent support request reads the new revision and returns the completed intake.

The original-process SDK verification, inference IDs, matched bills and revision history are retained records. Reading them does not independently rerun attestation or the provider's billing system. The [restart record](../artifacts/live-recovery/restart-proof.json) records no extra provider calls.

The [missing-address scenario](RECOVERY_EXECUTION.md) supplies a second recorded use of the shared recovery engine. Its remote evaluation status was explicitly `local-fallback` because OutLayer was unconfigured. No screenshot or successful local test proves remote WASM execution.

## 2. Public verification from a clean checkout

Prerequisites: Git, network access and Node 24.22.1 or later. These current verifier paths ran without installing npm dependencies. Do not copy a private `.env` into the checkout for this route.

```sh
git clone https://github.com/Jayesh1512/company-for-none.git CompanyOs
cd CompanyOs
node scripts/verify-mainnet-evidence.mjs
node scripts/verify-loop-receipt.mjs
```

For the sale-to-answer check, supply only these **public account identifiers**, not keys:

```sh
export SHOP_LEDGER_CONTRACT_ID=755a0a4bb40161793c0a178c89b0ed1a876d8c0d0bbea8febecfe2a7d0d9662b
export SHOP_LEDGER_SIGNER_ID=b2c5b8f31edf4dfb2560eb14397c8d61656c9f34c4f644077ed08a991fd9fc75
node scripts/verify-funded-loop.mjs
```

The loop script has an optional authenticated Agent API read if a key and base URL already exist in the environment. Keep `NEAR_INTENTS_AGENT_API_KEY` unset for public-only verification. The script prints SKIP for that check. It does not require a key to pass the public/artifact checks. Verifiers can read `.env` if present; use the clean checkout above to avoid unintended credential use.

### Observed results

Rerun on 14 November 2026 around 18:03 UTC:

| Command | Passed | What establishes the result |
|---|---:|---|
| `verify-mainnet-evidence.mjs` | 20/20 | 14 `LIVE_PUBLIC`; 6 `LOCAL_ARTIFACT` |
| `verify-loop-receipt.mjs` | 17/17 | 14 `LIVE_PUBLIC`; 3 `LOCAL_ARTIFACT`; `LIVE_AUTHED` skipped |
| `verify-funded-loop.mjs` | 10/10 | 7 `LIVE_PUBLIC`; 3 `LOCAL_ARTIFACT` |

The mainnet checklist reads links in the first 20 records; the loop verifier paginates and recomputes every current record hash. The head reported 24 records during this check. These counts are observations, not guarantees that an updated ledger or changed network will return identical output.

All three commands are read-only: no signing, inference, new payment or chain write. RPC availability can affect results; report a failed check rather than replacing it with a stored PASS.

## 3. Understand the service-payment demonstration

The [retained receipt](../artifacts/mainnet-proof/funded-loop.json) describes an operator-run 0.10 USDC service-payment demonstration via 1Click, followed by one answer and a matched provider bill. It is not evidence of unrelated paying customers or market traction.

The verifier checks:

- A FINAL, successful settlement leg forwarding the recorded wNEAR amount from the deposit account to `intents.near`.
- FINAL ledger appends containing `sale.confirmed` and `inference.consumed`.
- Recomputed inference-event payload binding to the retained sale/cost record.
- Internal arithmetic and retained response-verification fields.

It **does not** independently verify the customer's transfer into the deposit account, full end-to-end monetary movement, actual provider output/attestation, or billing. See [the full limits](MAINNET_EVIDENCE.md#9-customer-funded-service-loop).

The 202,710 nanoUSD bill is **$0.00020271**, paid from the owner-prepaid Cloud key. The sale did not purchase Cloud credits. The **$0.09979729** difference excludes gas, other provider attempts and other operating costs; it is an accounting remainder, not demonstrated profit or a payout.

## 4. What to reproduce locally

For the workspace, install dependencies and native JBrain using the README setup steps. Ordinary startup grants no spending authority and seeds no customer company. The main preview and the recovery scenario are separate runtimes.

Use [RECOVERY_EXECUTION.md](RECOVERY_EXECUTION.md) for scenario setup. Its `--start` commands can initiate real paid model work and must only be used with explicit owner approval, credentials and a bounded budget. Do not run `demo-funded-loop.mjs`, `loop-spend-e2e.mjs`, payment or deployment scripts merely to verify the submitted evidence.

The product's current boundaries matter: bounded scenarios rather than arbitrary self-programming; local evaluator fallback rather than demonstrated OutLayer execution; signing-route SDK tests rather than live Chain Signatures evidence; sale/cost attribution rather than autonomous cash-to-Cloud-credit funding.
