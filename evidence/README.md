# Reproducible evidence

Start with [the claim index](../CLAIMS.md). Each claim has a status, linked artifacts and a narrow limitation. The [machine-readable manifest](manifest.json) binds published artifact bytes and scope labels. Missing proof stays HELD, BLOCKED or NOT_IMPLEMENTED.

Use supported Node24.22.1+ and the installed project dependencies. These commands do not load `.env`, resolve a provider credential or use the running preview.

```sh
# Offline: scopes, artifact hashes, public-text secret patterns, real original
# quote signature after journal reopen, and synthetic altered-signature rejection.
node scripts/evidence/verify.mjs

# Optional isolated local work: actual native JBrain/customer-care domain;
# controlled SDK healing; controlled native writer/fee protocol tests.
# Requires the existing native JBrain binary (npm run setup:jbrain).
node scripts/evidence/run-local.mjs

# Rebuild the index after intentionally adding a new local run or reviewed artifact.
node scripts/evidence/build.mjs
node scripts/evidence/verify.mjs

# Negative regression checks for this evidence layer.
node --test scripts/evidence/checks.test.mjs
```

The offline command makes no provider request. It copies only the public quote evidence to an ephemeral directory, invokes the existing SDK verifier there and deletes the temporary journal. Historical public artifacts and their observation times are not rewritten. It verifies signed quote fields, not settlement. Cloud summary integrity is checked; TEE collateral and original plaintext are not independently replayed offline.

The optional local runner creates timestamped `evidence/runs/` outputs and updates `latest-local.json`. It uses isolated temporary test stores, fictional policy documents and loopback native JBrain. It does not call the4173 preview, seed the real company or inherit provider credentials. Each suite retains its own trust scope. Healing uses controlled model output, proof, credit and billing; it is never labelled actual paid reasoning. Test-file hashes and command/exit counts are retained, not a claim of a whole-checkout source freeze. A failed or changed-source test run must be investigated rather than relabelled successful.

Each local run also saves `care-scenario.json`: the actual fictional question and cited reply, exact current native-source revision/fingerprint, independent SHA256 of source and excerpt, real local escalation ticket, journal-reopen/idempotence and denied wrong-token check. Random customer/native access tokens are never written into that artifact. The domain tests independently cover revocation and cross-customer isolation. The controlled healing log contains the causal trace with its explicit injected-SDK label.

The local-demo browser artifact is indexed separately from these isolated verification runs and from the older mentor integration validation. Evidence reports remain time-scoped; they do not certify later source changes or automatically gain authority when a new runtime route is added.

Fresh public collection is a separate explicit action:

```sh
node scripts/collect-live-evidence.mjs --network mainnet \
  --account <approved-public-account> --model <selected-model>
```

It creates a NEW timestamp directory. Never overwrite an old run. Review the new exact outputs and update the curated catalog deliberately; the verifier does not silently replace historical evidence with whatever a provider returns today. This read-only collector is not the paid execution runner.

## Completed approved paid AI calls

The separate [owner-funded AI demo](../docs/REAL_AI_DEMO.md) has two completed actual E2EE calls: a generated cited answer and an escalation ticket, with recorded bills totalling3221160nanoUSD ($0.00322116). `LIVE_PAID` identifies sanitized records from those approved calls, not public raw cryptographic frames or another authority to spend.

The owner explicitly selected **live-process E2EE verification, hold on loss**. Official SDK verification/authenticated decryption happened in the original calls. A crash before acceptance holds with no automatic paid retry. Committed answers survive journal restart; they are not independently decrypted or TEE-verified offline. The strict default commercial durable-replay guarantee remains separate and open.

The offline verifier cross-checks run/provider identities, SDK/scope fields, output/citation metadata, bill totals and restart counters across the published records. It does **not** independently verify their private signature, original raw plaintext, TDX collateral, current source bytes or provider billing response. It never promotes claims by discovering a `paid-run.json` with a saved `MATCHED` boolean. Curated records and known limits remain reviewable.

An unreviewed `run-paid.mjs` delta was found after the earlier source freeze; its author could not be established. The exact source was preserved privately, with hashes and findings in [the review record](reviews/paid-runner-review.json). Its CLI ceiling was not enforced at dispatch, its new store could detach lifetime accounting, and result/status inference did not match the current component contract. That entry point is now **disabled for every flag**, before any environment/credential read, app construction or provider call. Do not use it to repeat the paid demo. Evidence verification introduces no new paid authority or route; use only the separately reviewed owner demo and common existing financial ledger.

## What the checks establish


- Byte hashes detect changes relative to the recorded index. The original public response hashes are also checked against their collection manifest.
- Production-root SDK signature replay verifies selected fields in the captured quote. A synthetic amount change is rejected even when its transport checksum is recomputed.
- Scope and claim checks reject accidental CONTROLLED→LIVE relabelling, missing artifacts and promotion of held outcomes in the generated index.
- Native-JBrain tests check real citations against current source revision/hash, idempotence/restart, actual local tickets, cross-customer access and current source revocation.
- Controlled pipeline/native-protocol tests exercise exact authority, original-effect recovery, no blind retries, current stop, withheld proof and fee bookkeeping.
- The secret scan reads only public evidence/index files. It catches selected high-confidence key/token patterns without printing a matching value. It is heuristic; it cannot prove there are no secrets, detect arbitrary mnemonic/passphrase formats or certify raw private SDK frames. It is not a whole-repository or Git-history scan.

Hashes, timestamps, a green log, curated scope labels and a successful process exit are not by themselves provider identity or business truth. A malicious author could alter both index and data. Independent cryptography and rerunning actual verification are stronger checks. Keep original sensitive SDK frames and credentials in protected ignored storage; do not publish raw customer information, wallet secrets or access tokens.

## Open production outcomes

The claim index records the two approved owner-funded live-call results, while strict durable private-output acceptance, funded independently verified commerce and mainnet ledger deployment remain open. Production native signing/fee-envelope proof, live Agent API identity/grant, scoped credit/bounds, durable original plaintext acceptance, movement/refund and resource entitlement have separate requirements. Neither the manifest nor this runner enables those actions, changes the USD5 ceiling, changes the selected route or grants spending authority.
