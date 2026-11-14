# CompanyOs

**Create an organization, not just an agent.** CompanyOs is a platform for autonomous organizations designed to earn from useful work, maintain a treasury, and pay for the infrastructure and services that keep them running.

An owner defines the purpose, approved knowledge, operating policy and initial budget. A master agent coordinates the team around that purpose. Customers pay for services; the treasury tracks revenue and expenses; the organization acquires the resources it needs and maintains its ability to serve the next customer.

**Earn → Spend → Improve → Sustain.** Self-repair is one part of that operating cycle—not the product's entire purpose.

Northstar Care, our fictional insurance customer-service organization, is the hackathon example. **CompanyOs is the platform; insurance is one instance.** Research services, document services and other customer-facing agent businesses are intended applications of the same operating model, not separate products already demonstrated.

[Judge's guide](docs/JUDGE_GUIDE.md) · [Payment evidence](docs/MAINNET_EVIDENCE.md) · [Organization guide](docs/COMPANYOS_GUIDE.md) · [Recovery evidence](docs/RECOVERY_EXECUTION.md)

## How a living organization works

A conventional agent completes a task. An organization also has to pay its bills, coordinate work, maintain knowledge and keep serving customers. CompanyOs brings those responsibilities into one operating model.

```text
             Owner defines purpose, knowledge, policy and budget
                                      |
                                      v
                      Master agent + specialist agents
                                      |
              Customers request useful work and pay for services
                                      |
                                      v
                         Treasury receives revenue
                                      |
                         Pays for permitted resources
                         |- Inference and compute
                         |- External services and task providers
                         `- Maintenance and improvements
                                      |
                                      v
                      Agents deliver the customer's work
                                      |
                                      v
                     Record revenue, costs and obligations
                                      |
                                      v
                   Retain working funds for the next request
                                      |
                              Keep serving customers

       When a gap is observed: backlog -> specialist work -> evaluated update
       The updated knowledge or template supports subsequent permitted work.
```

This is the **business design**, not a claim that every step is already autonomous in production. The demonstrated sale used 1Click; x402 is the intended programmatic charging path. The current Cloud call used owner-prepaid credits, so automatic treasury-to-Cloud funding remains open.

### Earn: provide something worth paying for

An organization offers a useful service: answer a support question, produce a document, or complete a research task. Customers pay for that output. The platform's revenue model includes x402 payments; the recorded service-payment demonstration currently uses NEAR Intents / 1Click.

### Spend: buy what the organization needs

A treasury is more than a wallet balance. The organization needs to account for incoming payments, committed costs, pending work and available operating funds. Inference, compute and external task services are operating expenses—not features the owner should have to purchase manually for every request in the intended autonomous model.

Rules control permitted actions and limits; Treasury records reservations and costs. Actual resource acquisition still depends on supported provider routes, credentials and verifiable receipts. A model cannot grant itself spending permission.

### Improve: maintain the business, not just the current answer

Missing knowledge or a workflow defect becomes backlog work. The master agent can coordinate specialist roles, including a knowledge curator and developer, within the allowed scope. Approved updates become new revisions for subsequent work. The demonstrated automatic changes are source-backed knowledge and additive templates; arbitrary host-code changes and paid external hiring are not established by those demonstrations.

### Sustain: keep the organization able to operate

The goal is to use service revenue to cover operating costs and fund continued delivery and maintenance. That means tracking both sides of the business—not merely showing an agent with a wallet. Recording a sale and its associated cost is demonstrated; continuously replenishing provider credits from treasury revenue, paying contributors and running a fully self-funded business are not yet demonstrated.

## The hackathon instance: Northstar Care

Northstar Care serves fictional Harbor Mutual insurance documents. The domain makes the platform tangible; it does not define the platform or represent a real insurer.

### A service payment linked to a delivered answer

The recorded demonstration links a **0.10 USDC sale via 1Click** to one encrypted, signature-verified NEAR AI answer. `sale.confirmed` and `inference.consumed` commitments are on the NEAR mainnet ledger.

| Business item | Recorded value |
|---|---:|
| Service payment | 0.10 USDC |
| Matched inference bill | $0.00020271 |
| Payment less that one bill | $0.09979729 |

The payment and answer are real recorded execution, not a forecast. This is an operator-run demonstration, not evidence of independent customer demand. The remainder is **accounting only, not profit**: gas, other calls and operating costs are excluded. The inference was billed to the owner-prepaid Cloud key; the sale did not purchase those credits. The verifier checks a FINAL settlement leg and ledger records, not the customer's original deposit transfer or full independent monetary settlement. [Receipts, transactions and exact limits](docs/MAINNET_EVIDENCE.md#9-customer-funded-service-loop).

Separately, retained evidence includes marketplace x402 task purchases and a **0.025 USDC confidential swap** initiated by a model-produced command through the Agent API. These demonstrate outbound expense/spend paths, not x402 customer revenue or a purchase of Cloud credits. [Payment inventory](docs/MAINNET_EVIDENCE.md#payment-inventory-what-moved-and-how-to-check-it).

### Maintaining the organization between requests

In the recorded contact-preference scenario, support cannot answer a question from its incomplete runbook. The backlog delegates a knowledge curator and template developer. The curator selects an exact approved-source passage for a new native JBrain revision. The developer proposes the missing template field; a fixed evaluator checks it before promotion. Support then retries the same request using the new revisions and completes the intake.

A second scenario repairs a missing mailing-address requirement using the shared scenario engine. Each recorded run has six accepted NEAR AI Cloud responses; matched bills are **$0.005128148** and **$0.00776905**, respectively. These are bounded recovery scenarios with retained original-process verification, not unrestricted autonomous development. Their cited evaluations used local fallback, not verified remote OutLayer execution. [Contact-preference run](docs/LIVE_RECOVERY_DEMO.md) · [Address run and execution modes](docs/RECOVERY_EXECUTION.md).

This is what maintenance contributes to the larger vision: the organization improves what it uses to deliver future work, rather than treating each request as an isolated conversation.

## Evidence a judge can inspect

Public verification was rerun on **14 November 2026 around 18:03 UTC**. Counts are recorded snapshots, not guaranteed output from future code or chain state.

| Evidence path | Recorded result | What it establishes |
|---|---|---|
| Mainnet checklist | 20/20 | 14 public-chain checks and 6 retained-artifact checks |
| Loop receipt | 17/17; 24 ledger records at that check | 14 public-chain checks and 3 artifact checks; authenticated provider check skipped |
| Sale-to-answer receipt | 10/10 | 7 public-chain checks and 3 artifact checks; payment/funding limits stated above |
| Two recovery scenarios | Linked run records and revision history | Retained model verification, billing and reuse of revised knowledge/templates |

The Rust mainnet ledger contains safe event/hash commitments, not raw customer documents. A public commitment proves the record was committed; it does not independently prove every business assertion inside it. Recovery's private company journal and public mainnet evidence remain separate histories.

## Why NEAR fits this organization model

| Component | Responsibility | Evidence boundary |
|---|---|---|
| Agent API | Owner-signed policy/grant, native ledger calls, bounded spend routes | Mainnet transactions and separate provider receipts |
| NEAR AI Cloud | Encrypted inference with original-process attestation/signature checks | Recorded live responses; offline plaintext recovery unavailable |
| NEAR Intents / 1Click | Cross-asset quotes and service checkout | Signed quote and recorded sale settlement-leg evidence |
| Rust ledger / NEAR RPC | Ordered event commitments and FINAL transaction reads | Public mainnet verification |
| Native JBrain | Approved organizational knowledge and revisions | Actual local storage and demonstrated revision reuse |
| PingPay x402 adapter | Programmatic offers, quote and settlement path | Adapter exists; marketplace purchases are not proof of live PingPay merchant collection |
| OutLayer evaluator integration | Remote evaluation path | See current execution documentation; the cited recovery runs used local fallback |
| Agent API native sign-intent adapter | EVM/Solana signing-route integration | Mocked SDK tests; no live Chain Signatures/MPC execution evidence claimed here |
| Agent-purchased NEAR AI credit | `src/cloud-funding/purchase.mjs`: pay USDC via Intents, seller org transfers credit to the agent's org | **Unit-tested only; not run live.** NEAR AI Cloud has no purchase API, so this uses its org-to-org credit transfer with an owner-operated seller. Needs one-time console setup: `node scripts/demo-funded-loop.mjs preflight` |
| Agent repurchases inference credit from a marketplace provider (NanoGPT) | `scripts/demo-nanogpt-loop.mjs`, checked by `scripts/verify-nanogpt-loop.mjs` | **Unit-tested (5 mocked tests); manual test maintainer-reported, no retained transaction references; no scripted live run recorded.** Design: customer pays NEAR into the company wallet, the agent pays a NanoGPT deposit invoice in NEAR, then runs inference on that credit; sale, purchase and cost go on the ledger. Triggered by the script under owner authorization, not by an LLM decision. Needs `NANOGPT_API_KEY` and approval of about 0.73 NEAR. See [evidence section 10](docs/MAINNET_EVIDENCE.md#10-agent-bought-inference-credit-nanogpt-built-not-yet-run-live) |
| Marketplace listings for inference providers | NEAR AI Cloud and "NanoGPT (agent-bought credit)" in `src/workspace/resources.mjs` | Display listings with honest limits ("Setup required"); they grant no spending authority and the purchase does not run through them |
| Customer payment into the agent's own wallet | `src/payments/incoming.mjs`: Agent API deposit address, verified by provider status + balance rise | **Unit-tested only; not run live** |

Exact versions and call sites are in [package.json](package.json) and the linked execution documents. SDK presence alone is not execution evidence.

## Verify without spending

```sh
git clone https://github.com/Jayesh1512/company-for-none.git CompanyOs
cd CompanyOs
node scripts/verify-mainnet-evidence.mjs
node scripts/verify-loop-receipt.mjs
```

For the sale-to-answer verifier, use the public account identifiers in the [judge's guide](docs/JUDGE_GUIDE.md). Use a clean checkout without `.env` for public-only checks. These verifiers sign nothing and submit no paid work; the optional authenticated provider read is skipped without credentials.

## Run an organization locally

Requires Node **24.22.1+**, npm, Git and Rust/Cargo:

```sh
npm ci
npm run setup:jbrain
npm run dev
```

Open the application in your browser and use the company setup wizard to define the company and review its agents, knowledge and boundaries. Ordinary startup seeds no sample organization or spending authority. A new domain needs its own approved documents, service configuration and permitted resource connections; the platform does not supply those automatically.

The latest **Open demo** flow opens a fresh, prefilled company setup wizard for review, then the agency marketplace; it is a model-free local demonstration, not a paid autonomous run. The separate actual-AI and recovery paths require explicit credentials and budget authorization. Follow the [organization guide](docs/COMPANYOS_GUIDE.md), [local-access documentation](docs/LOCAL_WORKSPACE_ACCESS.md) and [recovery setup](docs/RECOVERY_EXECUTION.md).

## Engineering checks and current limits

Run `npm test`, `npm run check` and `npm run test:native` after installing dependencies and building native JBrain. **563 passing tests is a historical baseline**, not current CI status after recent execution changes. This documentation update did not rerun the full application suite.

The platform's direction is autonomous operation, not unlimited authority. Owners still define policies, authorize budgets and resolve exceptions. Unknown effects reconcile their original operation rather than being blindly retried. Template evaluation is scoped and is not general semantic validation. End-to-end automatic treasury funding of providers, contributor payouts and refunds remain open. See [mainnet evidence](docs/MAINNET_EVIDENCE.md) and [verification contracts](docs/NEAR_VERIFICATION.md) for the full boundaries.
