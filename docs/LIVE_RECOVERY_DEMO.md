# Live NEAR AI recovery scenario

Run `node scripts/recovery-demo.mjs`, then open <http://127.0.0.1:4187/recovery.html>. The page starts one bounded recovery scenario and shows its actual work records and company ledger. The ordinary company stays on port4173, and the earlier model-free local demo remains separate.

**Actual completed run:** 14 November2026,13:24:32UTC. Six distinct NEAR AI inference IDs were accepted after original-process SDK verification. The first support attempt escalated; the backlog delegated both repairs; the native runbook changed revision; the fixed evaluator rejected the baseline and accepted the candidate; the template advanced from revision1 to2; support then answered from the new runbook revision and produced a valid intake. Provider bills totaled **USD0.005128148**, with zero pending reservations. Earlier401 preflight failures remain in the same history and sent no completion. [Real browser proof](../artifacts/live-recovery/browser-proof.json) checks the standard knowledge/ledger pages at1440/390 with no page errors or overflow. [Restart proof](../artifacts/live-recovery/restart-proof.json) confirms the scenario, all work records, financial state and events survived unchanged with no extra provider call. The focused regression passes20/20, including9 recovery tests and11 existing demo/setup/UI checks. The polling focus check is separately labeled as a controlled UI state, not a new provider run.

The fictional company has an incomplete claims-intake runbook and a template missing `contactPreference`. A separate owner-approved source states the required process. The customer asks which preference to record and supplies `portal` for an example intake.

The manager delegates to support. The first support agent cannot answer from the incomplete runbook; the fixed evaluator independently observes the missing template field. That gap wakes the backlog. Its model-produced delegation selects the knowledge curator and template developer. The curator selects an exact excerpt from the approved source; the runtime verifies it before saving a real native JBrain revision. The developer proposes an additive template operation. The fixed evaluator runs the same mandatory baseline/candidate tests, and M01 checks the evidence and current head before promotion. Support then receives the new document and template revisions and retries the original request. The actual old/new schemas are exercised against the resulting intake.

All six model calls use NEAR AI Cloud's `Qwen/Qwen3.8-27B`, the official SDK's encrypted Chat Completions path, fresh UpToDate gateway/model attestation, and explicit provider-TEE response-signature verification in the original process. [Official SDK verification documentation](https://docs.near.ai/cloud/inference-sdk/javascript) explains the provider signature and E2EE route. A missing or invalid response holds the run. Offline plaintext recovery remains unavailable; a restart never resends an original paid completion.

The separately scoped owner-funded authorization permits at most six original calls and USD0.60 actual-plus-pending exposure. Each call reserves USD0.10, which must cover the entire advertised model input/output windows at the current public tariff. This conservative bound includes the advertised reasoning/output window. A nonzero provider billing row must match the original inference ID before it becomes an actual cost; zero/delayed/unavailable bills remain reserved. No fictional balance or agent credit is created. This does not enable procurement, payments, claim approval, commercial sales or blockchain publication.

Records are under `.runtime/near-ai-recovery-v1/`, including a private authorization file and a separate native brain. Failed preflights remain in history. An explicit new attempt is allowed only when the preceding attempt has no dispatch intent, provider result or reservation. A process interruption or potentially submitted operation stays held. Replacing a private credential does not reset counters or financial history.

Verification:

```sh
node --test test/integrations/recovery.test.mjs
node scripts/check-recovery-browser.mjs
```

The integration tests replace only the provider port and SDK findings with explicit test inputs; they are mechanics and failure-path evidence. The browser script is read-only against the real running scenario. It requires six actual accepted responses, changed native knowledge/template revisions, the successful retry and the corresponding standard company ledger history. It writes `artifacts/live-recovery/browser-proof.json` and desktop/mobile screenshots. Do not describe test findings as live provider proof; use the browser proof's timestamp and recorded actual outcome.
