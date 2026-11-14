# Recovery execution evidence

The recovery loop evaluates both the broken baseline and proposed repair through
`createRecoveryEvaluator`. It uses the existing OutLayer request builder and
adapter, pins the project version, caps compute, and submits each job once.
Pending jobs are polled by their original call ID. A lost submission response
never triggers another paid submission.

Configure the `SHOP_OUTLAYER_*` project/payer variables and private
`OUTLAYER_PAYMENT_KEY` shown in `.env.example`. Pass a local module with
`--outlayer-verifier /absolute/path/to/verifier.mjs` to
`node scripts/recovery-demo.mjs --start`. The module must export
`verifyExecution(input)`, independently verify the provider attestation and its
WASM/input/output binding, and return the proof shape enforced by
`src/integrations/outlayer.mjs`. The input includes the captured attestation and
its private evidence reference. Merely returning hashes or accepting a provider
success response does not implement attestation verification.

Verified output must also match the frozen local evaluator before promotion.
Missing configuration, unavailable execution, invalid proof, or divergent output
uses the local fallback. `recoveryEvaluations` records which path actually ran,
the failure reason, call ID, proof, and attestation/response artifact references.
These records are available in the private recovery API's `evaluations` array.
Raw response and attestation bytes stay in private journal artifacts.

Two scenario definitions share this loop:

```sh
node scripts/recovery-demo.mjs --scenario contact-preference --port 4187 --start
node scripts/recovery-demo.mjs --scenario missing-address --port 4188 --start
```

Each scenario uses a separate default runtime directory, preserving earlier
evidence. Reusing a directory for another scenario is rejected. The source,
customer question, gap, required evidence, and allowed additive repair operations
live in `src/demo/recovery-scenarios.mjs`. The backlog model chooses a nonempty
subset and order from the allowed repair roles; the executor follows that list.
Missing repairs hold the run before promotion and retry. Model-written schemas,
citations, and intake values still have to satisfy the selected frozen contract.
Both scenarios retain the same six-call/$0.60 owner-funded inference ceiling.

The real `missing-address` run on 14 November 2026 completed all six NEAR AI
Cloud calls, revised the native JBrain runbook, promoted the additive address
field after the fixed tests passed, and retried the same customer question.
Provider bills totalled **$0.00776905**, with no pending reservations. The saved
[live run](../artifacts/recovery-missing-address/live-run.json) contains the role
plan, provider request IDs, SDK verification references, revision changes, and
costs. Both evaluations explicitly record `local-fallback` because OutLayer was
unconfigured. This artifact proves the live model/repair path; it does not claim
verified remote WASM execution or durable offline plaintext replay.

`npm run evaluator:build` builds native and WASI binaries and records the WASM
hash in `artifacts/mentor-implementation/evaluator-manifest.json`. Building the
binary does not deploy it or prove remote execution. No live OutLayer call is
claimed without configured project/payment credentials and an independent
execution verifier. The committed transport/proof tests are controlled tests.

The Agent API ledger writer also exposes `finalize({action})`. This reads the
original provider correlation, checks the transaction through the pinned NEAR
RPC client at FINAL, matches the original signer/receiver/function call, and
persists the successful receipt as private evidence. It never submits another
transaction or treats provider SUCCESS alone as chain finality. Fee accounting
remains a separate receipt reconciliation step.
