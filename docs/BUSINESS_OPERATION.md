# Company operation — real-execution revision 2

The product starts in setup mode without a commercial policy, seeded balances, automatic agents or simulated provider success. Owner-authenticated organization, profile, skill and knowledge setup does not require a funded authorization. It does not authorize sales or effects.

The reviewed implementation sequence is in `REAL_EXECUTION_PLAN.md`; the independent review is in `REAL_EXECUTION_CRITIQUE.md`. Those documents are preserved unchanged. This file records the current runtime, not completion of their live gates.

## Setup and access

Follow the root README. Use a private `SHOP_OWNER_TOKEN_FILE` with mode0600, or a server-held `SHOP_OWNER_TOKEN`. Owner identity is resolved by the server and includes companyId. No browser role field or localhost origin establishes owner authority. Customer report capabilities remain separate.

The six setup stages save organization metadata and exact review fingerprints. Setup profiles retain runtime `setup`. After an owner selects a live commercial policy, an explicit profile update can apply the exact M01 setup-to-live metadata patch. It does not connect a provider, approve spending or relabel historical fixture profiles.

Use Settings to run a read-only capability check. The server accepts only a known capability name, not a caller URL, body or money. M01 sets TTL 60000ms and public retrieval bounds of 65536 bytes, 5000 ms and 2 redirects. Probes cannot provision accounts, change grants, buy credit or call inference. There are no startup provider probes. JBrain uses the actual isolated local service. Public retrieval reads only a server-configured source URL.

Readiness derives from trusted, identity-bound current observations. Model membership proves only catalog membership. Payment token catalogs do not verify a spendable route or refund path. Missing policy/grant/credit/proof contracts remain unavailable. Setup always requires a commercial policy before business operation.

## Selecting a commercial runtime

An owner must select actual assets, destinations, model, provider account and confidential balance domain in a separate policy file. Set `SHOP_CONFIG_PATH` explicitly. Invalid explicit configuration fails closed. Demonstration YAML is not approved live configuration.

Use a separate economic store. The journal binds company, execution mode, provider/account, network, asset and bucket. An empty setup store can select its initial commercial identity before economic activity; historical fixture stores cannot be converted. Existing policy changes still need a fresh policy-bound private authorization with numerical limits and expiry. Example authorization and inference-bounds files are templates, not evidence or permission.

Credentials refer to existing owner-authorized accounts/grants. The app creates none. `SHOP_AGENT_BALANCE_SOURCE=confidential` is explicit, with no public fallback. Payment authentication scheme and secret reference must match a frozen current provider contract; no scheme is silently substituted. Current protocol compatibility still needs independent evidence before funds.

## Economic evidence

Owner capital and prepaid-credit assertions in JSON are no longer imported. A balance snapshot is an absolute observation, not a deposit. M01 computes its exact reconciliation; Treasury records the result without changing cash or credit.

A separate trusted cash/credit opening is once per fully bound scope and before movements. Later receipts carry the same identity, ordered provider watermark and unique provider reference. Fresh snapshot IDs cannot replenish spent credit or double-book a sale. No local timestamp stands in for a provider watermark. Fresh trusted observations must match stored reconciliation before spending; deficit, surplus, pending, expired or newer unposted observations hold execution.

Funding converts cash into credit. Inference consumption records expense separately. Actual billing uses the provider inference ID. Delayed cost remains pending with its reservation. Unknown transfer results keep the original intent and are reconciled without a new transfer. Agent API SUCCESS plus an intent hash remains `unknown/EXECUTION_PROOF_UNVERIFIED` until the required execution proof exists.

## Publication and procurement

Live service activation and service-bound orders cannot include private company knowledge. Internal agent tasks keep exact revision/current-grant rules. Public context sharing needs a separate audience and exact-revision approval design; saving a company document does not publish it.

The fabricated paid checklist and generic disconnected API listing are removed from the product. Free authored templates, skills and SOUL.md remain content. The old procurement scenario survives only in isolated regression tests. No supplier licence is created merely because a transfer appears successful. Real paid procurement requires a chosen supplier, frozen deliverable/version and actual entitlement evidence.

## Evidence and open gates

Current local evidence: 217 passing tests, 65 syntax files and 12 required actual-native JBrain checks. Provider client tests use controlled HTTP stand-ins. Product browser evidence is separate from older fixture videos/stores. See `MVP_STATUS.md` and `INTEGRATION_EVIDENCE.md`.

Before a funded component: verify the current spendable route/bucket, quote authenticity, exact receipt attribution, pre-deposit refund principal plus fees/domain, and necessary policy/grant/proof. Cloud inference additionally needs hard charge bounds, credit attribution, raw verification evidence and explicit verification policy. No official verification SDK or cryptographic TEE success is implemented in this revision. Autonomous Cloud purchase remains unsupported. No paid or funded provider call was performed.

Historical business integration logs and journals remain intact. Their successful fixture checkout, paid-checklist licence and provider stand-in receipts are historical regression evidence, not current product capabilities or live acceptance.
