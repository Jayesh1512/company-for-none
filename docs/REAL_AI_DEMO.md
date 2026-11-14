# Real encrypted AI demo

14 November 2026. Entry: `http://127.0.0.1:4173/#demo` or **Open AI demo**. This replaces the model-free lookup as the main demo entry. The earlier isolated local lookup remains available through its explicit local-demo API/CLI and is not AI execution.

## What actually works

The owner selects a saved company agent and existing granted company documents, then asks a question. The app reads their current revisions from the actual native JBrain service. M01 freezes the agent instructions, question and selected context; it admits a text-only request to the pinned official NEAR AI SDK0.3.0. The SDK verifies fresh gateway/model evidence with UpToDate policy and uses end-to-end encryption. No other model/provider or unverified HTTP fallback is selected.

After the completion, the SDK explicitly verifies the provider TEE response signature. Authenticated decryption and that signature must both succeed during the original call. M01 checks the exact output hash, original prepared request bytes, current agent/document grants and exact source quotations. The app saves a generated answer or creates a persistent owner-review ticket. A citation match is not a guarantee of factual interpretation; individual claims are not approved or paid.

The owner explicitly selected `live-verified-hold-on-loss` in this chat. This is a deliberate, separate acceptance policy: offline E2EE plaintext recovery remains unavailable. A crash before acceptance leaves the original request held; replay/refresh/restart never sends another completion. A previously committed answer can be read from the trusted local journal after restart; that is not independent offline decryption or attestation verification. The existing strict commercial policy remains the default and its live gates are not closed by this demo.

## Authority and money

This is an **owner-funded AI trial**, using the owner's Cloud inference key. It does not fabricate an agent credit lot, capital opening, purchase receipt, autonomous Cloud funding, customer sale, payout or refund. It does not grant public customers paid execution. HTTP execution/view/control remain owner-only with existing same-origin and direct-loopback protections.

All policy is in M01: `src/rules/ai-demo.mjs`; M03 is the sole financial recorder. Protected execution scope is loaded from `SHOP_AI_DEMO_AUTHORIZATION_FILE` (0600), bound to company, credential hash, explicit acceptance policy, expiry and existing lifetime $5 ceiling. It does not contain the key. The current grant expires after24hours. No call occurs at startup, on GET, refresh or replay.

The fixed model is `Qwen/Qwen3.8-27B`, text-only, no tools/search/images, n1, streamfalse, `max_completion_tokens:4096` including reasoning, maximum input12000bytes. A fresh actual catalog observation must show zero request charges and tariffs that fit a **$0.10 reservation**. The calculation conservatively prices the full advertised262144-token context and65536-token model output windows, rather than guessing template overhead or treating bytes as tokens. The actual request is much smaller. These are provider-advertised model/tariff limits, not a provider-enforced USD account cap or protection against a provider violating its contract.

All actual and pending exposure shares the main M03 ledger and $5 ceiling; at most20 calls can be admitted by this demo. A fresh matching positive `/billing/costs` record can reconcile the original reservation. Missing, zero, delayed or unmatched bills retain the full maximum. A charge above the reservation blocks further demo dispatch. No unwatermarked balance snapshot becomes spendable credit.

**Pause AI demo** fences new dispatch and result acceptance immediately and persists across restart. Resume changes the control version; an older asynchronous request cannot cross that change. Stop cannot cancel work already accepted by NEAR AI; its actual bill must still be recorded. Disabling/expiring the private grant or the existing configured kill switch also blocks execution.

## Observed evidence

The first credential reached gateway200 and model metadata200, but model attestation401. No completion or financial reservation was created. The user then replaced the key privately in `.env`, retaining0600. The server restarted without an inherited stale key; no credential was printed or copied into artifacts.

The first accepted actual call answered the collision-deductible question with two exact quotations from the current native JBrain auto-policy revision. Official SDK live response verification passed, provider completion id `84d7b779ef4e4f308a5707f37f2f174c`, elapsed65189ms, actual provider bill1621380nanoUSD (**$0.00162138**). The source describes a fictional insurer; this is actual generated inference over example company data, not a real insurer endorsement or coverage decision.

After a real same-store server/JBrain restart, the same request identity returned the saved answer. Provider-operation count stayed1, financial version stayed4, reservations stayed1. No second completion or cost was created.

A second actual request was submitted using the native T3 browser form to the Claims Guide. NEAR AI generated a refusal to approve/pay the claim and requested human review; the live SDK and exact citations passed, and the app created a persistent owner-inbox ticket. Its positive provider bill is1599780nanoUSD. The two calls total **3221160nanoUSD ($0.00322116)**, both reconciled; there are no unknown or pending reservations. These two observed calls are not the three-loop strict autonomous-business milestone.

Evidence: [actual call](../artifacts/real-ai-demo/actual-call-r2.json), [actual escalation](../artifacts/real-ai-demo/actual-escalation.json), [redacted SDK verification summary](../artifacts/real-ai-demo/actual-verification-summary.json), [restart replay](../artifacts/real-ai-demo/actual-restart.json), [initial provider statuses](../artifacts/real-ai-demo/provider-read-status.json). Additional final results are in [validation](../artifacts/real-ai-demo/validation.json). These records are separate from the earlier frozen evidence catalog; they do not silently relabel its local/controlled claims.

## Verification and limitations

`node --test test/integrations/ai-demo.test.mjs` exercises actual native JBrain/M01/M03 with an explicitly controlled provider: answer, escalation, exact citation failure, owner access, credential binding, aggregate cap, tariff rejection, pause before/during execution, current grant revocation, unknown and restart without retry. Controlled findings are test-only, never production substitutes. `npm test` and `npm run check` provide the final broad results recorded in validation. No test count substitutes for the actual provider evidence above.

This increment does not claim autonomous manager/backlog/developer execution, paid marketplace acquisition, Cloud credit purchase, customer payments, confidential settlement/refunds or a mainnet ledger write. Those existing independent gates remain open. Historical review plans and critiques are preserved.
