# Autonomous Business — one-agent research shop

Track: **Autonomous Business** · Track id: **business**  
Planning baseline: 11 November 2026 · Status: **architecture proposed; awaiting user OK**

This plan replaces the Council hackathon scope with the user's new research-shop brief. The previous plan is preserved in `BUILD_PLAN_COUNCIL_HACKATHON.md`. `PRD.md`, `BUILD_PLAN_CRITIQUE.md`, and `BUILD_PLAN_REVISED.md` remain historical Council documents, not requirements for this build. The partial Council implementation remains untouched and is not evidence of this shop working. Its implementation owner has stopped; no task-owned server is running.

Only documentation research, architecture, and plan changes are authorized now. Do not resume implementation, create wallets, provision custody, deploy contracts, call paid inference, or move funds before the user approves this architecture. Any funded proof also needs an explicit amount cap before execution.

## 1. The product and nonnegotiable requirements

One autonomous research agent sells short market reports. A customer asks a bounded market question and pays using a token supported by NEAR Intents. The agent receives the sale proceeds, buys its own inference from NEAR AI Cloud within the owner's rules, produces a sourced report, and automatically sends the configured revenue share to the contributors' account. The owner configures the business once and can stop it at any time.

Required:

- One research agent and its own NEAR account; no Council, specialist-agent roster, expert-profile marketplace, or Bonfire requirement in this scope.
- Customer payments through **NEAR Intents**, independent of the customer's preferred supported payment asset. Do not claim literally every token or chain is routable.
- **NEAR AI Cloud** inference purchased/funded autonomously by the agent, not merely charged to an unexplained human-funded API key.
- Owner rules in **one `config.yaml`**: maximum inference spend per day, minimum report price, revenue split percentages, and a kill switch.
- No plaintext full-access NEAR key. Use **OutLayer agent custody**, preferred, or an explicitly restricted function-call-key design.
- Automatic contributor payouts for sales, with no ordinary per-order human approval or manual payout step.
- A public ledger page showing every sale, cost, and payout, including incomplete or failed operations.
- A demo mode completing one sale → paid inference → report → contributor payout loop **on testnet in strictly less than 120 seconds**. Keep this requirement visible even while the route is unresolved.

Proposed scope limits: one report format, one order at a time, one selected settlement asset per network, one contributors' recipient, and the agent treasury as the remainder recipient. Multiple percentages can describe this split; broader multi-recipient distribution is unnecessary for the first loop. The user must set actual percentages, accounts, monetary limits, and approved funding amounts.

## 2. Official documentation read first: findings and constraints

Research established documented behavior, not an operational integration. No authenticated vendor calls, inference purchases, or fund transfers were made.

1. **NEAR Intents has no official testnet deployment.** Its FAQ explicitly recommends separate mainnet development accounts. This conflicts with a literal official-Intents-on-testnet full loop. [NEAR Intents FAQ](https://docs.near-intents.org/resources/faqs).
2. **OutLayer testnet custody is not testnet Intents.** Its custody documentation describes TEE-held keys, policy-controlled signing, daily limits, and freeze controls. Account/transfer/call operations are available on testnet; Intents-dependent endpoints are not. Choose custody provisionally, subject to an actual capability proof. [OutLayer Agent Custody](https://app.outlayer.ai/docs/agent-custody).
3. **NEAR AI Cloud documents credits, API-key inference, and cost reporting.** Its quickstart requires adding credits. Read-only reporting can expose usage and costs. These establish metering, not a verified public route for an autonomous wallet to purchase credits; that funding route is an unresolved requirement. [Cloud quickstart](https://docs.near.ai/cloud/quickstart), [usage reporting](https://docs.near.ai/cloud/guides/usage-reporting).
4. **Inference funding is not solved by inventing an admin call.** The public docs index distinguishes administrative balance/limit management from real billing. Staking-for-inference is documented, but earning credits from stake is not the same as spending each sale's proceeds to buy inference. Neither is silently substituted. [NEAR AI docs index](https://docs.near.ai/llms.txt), [staking for inference](https://docs.near.ai/cloud/staking-for-inference/overview).
5. **An exact-output quote fits a minimum report price.** NEAR Intents can fix the received destination amount while quoting the customer's required input. Supported assets and route availability must be checked at quote time. [Swap types](https://docs.near-intents.org/integration/distribution-channels/1click-api/swap-types), [request flow](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request).
6. **Swap fees are not the business revenue split.** The documented app-fee mechanism has input-asset and fee-schedule constraints. Use an explicit business allocation of settled report revenue instead of assuming app fees implement arbitrary contributor percentages. [Fee configuration](https://docs.near-intents.org/integration/distribution-channels/1click-api/fee-config).
7. **A function-call key is not a general payment key.** It restricts receiver/methods and a gas allowance, and cannot attach NEAR. A fallback would need a prefunded restricted treasury contract that enforces payment rules; handing a function-call key to ordinary transfer operations is not a solution. [NEAR access keys](https://docs.near.org/protocol/accounts-contracts/access-keys).

No official source read establishes that arbitrary source-chain settlement, credit funding, inference, and payout can always finish within two minutes. The demo must select a supported fast route and measure the whole loop.

## 3. Proposed architecture in text

These are responsibilities, not additional AI agents:

    Owner's config.yaml
        → validated rules and version
        → deterministic policy checks and emergency stop
                         |
    Customer → storefront/order → NEAR Intents checkout
                                      |
                            confirmed sale in agent treasury
                                      |
                            durable order and money journal
                                      |
                       ONE autonomous research agent
                         /            |             \
              bounded source     inference purchase    report delivery
                retrieval         and NEAR AI Cloud      with citations
                                      |
                         contributor-share obligation
                                      |
                         OutLayer custody signs payout
                                      |
                         contributors' NEAR account

    Every transition, cost, and payout → public ledger page
    Owner kill switch → blocks new orders, inference, and new payout signing

**Storefront and order record.** Show the report scope, price, expected delivery, supported token choice, payment quote, and eventual report link. A durable unique order identifies its quote, payment reference, config version, inference request(s), source set, report, and payout obligation. Money and work states are separate.

**Agent identity and treasury.** Prefer one OutLayer custody wallet with its own NEAR identity. Record the actual account, network, balances, and controller. Keep custody and Cloud authentication secrets outside the browser, repository, `config.yaml`, logs, prompts, and public ledger. Custody holds the blockchain signing key; the application only gets the least-privileged credential needed. The owner, not the model, controls policy changes and freeze. Fund startup gas/storage separately and record it; revenue cannot pay for an operation that must happen before the first sale exists.

**Deterministic policy boundary.** Ordinary code validates rules, price, capacity, spend reservations, payment evidence, allowed destinations, payouts, and stop state. The model researches and writes; it cannot edit config, change recipient accounts, authorize its own overspend, or turn text from a source into a payment instruction. Align custody limits and destination permissions with config where supported; do not assume custody's token limits enforce a USD inference budget.

**Inference purchasing boundary.** A narrow adapter must convert the agent's authorized funds into usable Cloud service funding through a documented supported path, then obtain real inference and reconcile usage. Its funding API/payment recipient, account attribution, conversion costs, credential scope, and retry behavior are not yet verified. If only owner-prepaid Cloud credits work, label the result a prototype, not fulfillment of the autonomous-purchase requirement. Keep funding an explicit build gate rather than promising a nonexistent endpoint.

**Research and report.** One agent performs bounded evidence gathering and drafting. Proposed first report: 400–700 words on one market question, geography, and time horizon, with a concise answer, 3–5 source links and dates, key observations, implications, and uncertainty. No invented market-size figure or citation. Source access/tool costs are logged. Prefer bounded retrieval controlled outside the model's spending authority. Any provider search service must have a provable call/cost bound or stay disabled.

**Payout worker.** This is deterministic fulfillment work, not a second agent. At settlement, reserve the configured contributor share. After report delivery, automatically submit the owed payout with a unique obligation reference, then reconcile its confirmed result. A failure remains owed and is retried safely without another inference call or duplicate transfer. Every settled sale creates a visible allocation; a failed delivery cannot silently erase it. The refund rule below must be published before sales.

**Public ledger.** A read-only page derives from a durable append-only event journal and reconciles with chain transactions and provider usage evidence. Display order id, network, config version, timestamps, original payment asset/amount, received settlement amount, fees, inference funding, consumed inference/search cost, contributor amount due/paid, remaining revenue, state, and transaction/provider references. Mark estimates and unreconciled costs explicitly. Show a funding top-up as cash/credit movement and consumption as expense; do not count both as two inference costs. Link public transactions; anchor private receipt/report hashes when useful. Do not claim every off-chain cost is proved by a blockchain transaction, and never expose credentials, private customer questions, or full reports by default.

## 4. What config.yaml controls

This is a proposed schema description, not a created config file or approved budget:

- `kill_switch`: owner-writable boolean. `true` stops operation; `false` permits only otherwise valid work.
- `max_inference_spend_per_day`: amount in an explicit accounting unit, proposed USD; define the day as UTC. Covers all inference charges, including billed reasoning/retries and provider search costs when enabled.
- `minimum_price_per_report`: integer atomic amount in the selected settlement asset. Never compare unlike tokens or floats as if they were one currency.
- `revenue_split_percentages`: contributor and treasury percentages totaling exactly 100%, with no negatives. Use integer basis points internally; rounding remainder stays in treasury and is visible.
- Recipient account, network, settlement-asset identifier/decimals, selected Cloud model, per-report token/request ceilings, quote expiry, allowed payment routes, and bounded timeouts. These support enforcement of the four required rules rather than adding another configuration source.
- Secret references only. Actual custody/Cloud secrets remain in a protected secret store, not this file.

Validate config before running and whenever the owner changes it. Reject missing, malformed, inconsistent, or out-of-range rules; stop new work on invalid config. Hash/version every accepted config. Bind financial terms to that version when the buyer pays. A later split change applies to new orders; it cannot rewrite money owed on old ones. A lower daily cap or kill switch constrains future actions immediately, including old orders. Apply custody policy updates before enabling a change that needs them; if policy synchronization fails, fail closed. Neither the model nor an unauthenticated customer can write config.

**Daily spend enforcement:** reserve a conservative upper bound for every chargeable request before sending it. Use provider price metadata, bounded input/output/reasoning and request counts, and any enabled tool fees. Actual daily spend plus unresolved reservations plus the next request's bound must remain within the cap. Do not release an uncertain request merely because of timeout; reconcile it first. Persist spend and reservations across restarts and day boundaries, assigning late costs to the original request/day. Check provider key-level caps as an additional guard, not a substitute for the configured daily rule. If a safe cost bound cannot be established, reject that request.

**Price floor:** quote enough supported input tokens to receive at least the configured settlement-asset price, with customer-paid conversion costs/slippage made clear. Verify the actual matching settlement, not a submitted transaction or callback alone. Reject/requote stale or underpaid orders. In addition to the floor, check the treasury remainder can cover bounded production cost and operational reserves; a minimum price alone does not make a sale affordable.

**Revenue basis:** proposed rule is a fixed share of the report revenue received in the settlement asset, before inference is deducted. Provider checkout costs paid outside that revenue are shown separately. Do not quietly change gross-revenue sharing into profit sharing. Keep the contributor share unavailable for inference spending. The treasury remainder pays inference and retained earnings. Proposed remedy: failed undelivered work is refundable under a disclosed rule; reverse its sale allocation only after a confirmed full refund. Previously paid contributor amounts cannot be assumed recoverable, so the treasury must cover that exposure. Publish this rule before accepting real sales.

**Kill behavior:** watch the file and recheck it immediately before new checkout, inference/funding, and payout signing. Target detection within one second; measure it. Freeze custody as a separate emergency backstop where supported. Stop issuing quotes and chargeable requests; cancel unsent work; keep read-only reconciliation and the ledger available. Already broadcast transactions and incurred inference cannot be undone. Record late receipts and unpaid obligations without starting new work. Refund/payout obligations pause visibly until an authorized safe recovery/resume; the kill switch does not forgive them. Resume only when config, policy, budget, and recorded obligations reconcile.

## 5. Money and fulfillment loop

1. **Validate and reserve capacity.** Load owner rules; check kill switch, price, one-order capacity, treasury affordability, Cloud funding readiness, and daily inference headroom. Refuse an order that cannot be fulfilled within rules. Do not run paid research to decide whether to quote.
2. **Quote the customer's asset through NEAR Intents.** Use an exact-output quote for the invoice amount in the settlement asset. Bind order, destination, expiry, refund destination, and config version. Show supported routes and total required input; do not accept unknown tokens sent to arbitrary addresses.
3. **Confirm settlement once.** Match quote/order, network, destination, asset, actual amount and final status. Record the sale, pending cost reservation, and contributor obligation. Deduplicate callbacks, status polling, and customer refreshes. Uncertain payment stays pending; never ask the customer to blindly pay twice.
4. **Fund/buy inference autonomously.** Through the validated funding route, the agent pays from its permitted treasury resources, obtains Cloud inference, and records the funding evidence and billed use. A funding top-up and its later usage are distinct ledger entries. Do not call provider admin limit changes a purchase.
5. **Produce and deliver the report.** Use bounded sources and requests. Store the report and content hash; expose it to the paying customer. If unsupported or incomplete, show the failure and remedy state. Do not mark a draft or canned response fulfilled.
6. **Pay contributors automatically.** Compute the frozen percentage using integer amounts; custody authorizes only the allowed recipient and amount. Keep it pending until actual receipt is confirmed. If a payout response is lost, reconcile the same operation before resubmitting. Report completed only when delivery and required payout are confirmed.
7. **Publish and reconcile.** Show every transition and cost, plus agent/recipient balance changes and remaining daily allowance. Restarting the worker or refreshing the page cannot produce another sale, paid generation, or payout.

If payment confirms after expiry/kill, preserve the funds record and use the predefined remedy; do not start a stale job. If delivery fails after a paid inference request, keep the cost and refund obligation visible. If payout fails after delivery, retry payout only. No silent manual step may be counted as an autonomous successful run.

## 6. The testnet and two-minute requirement

**Current status: blocked by documented infrastructure mismatch, not waived.** Official NEAR Intents is mainnet-only; OutLayer's available testnet transfer/call operations do not change that. A real NEAR AI Cloud call is an off-chain paid service, not automatically a service payable in testnet tokens.

Resolve this before claiming the complete requirement:

- **Strict path:** obtain a verified, acceptable testnet Intents/solver deployment and a Cloud funding arrangement that supports the intended demonstration. A separately operated sandbox may be investigated after approval, but it must execute actual testnet settlement and payouts and be labeled accurately. A mocked quote or plain transfer does not establish testnet Intents. No such route was established by this research.
- **Proposed exception, requiring explicit user approval:** demonstrate real sale/accounting/payout on NEAR testnet with the payment-quote leg clearly marked as a substitute; separately prove real NEAR Intents on a small funded mainnet route and real Cloud funding/inference. This demonstrates components but is **not** the requested single full Intents loop on testnet. Mainnet funding would need an agreed cap before execution.
- **Do not silently switch:** a mainnet demo is not testnet, a simulation is not an Intents settlement, an owner's prepayment is not autonomous inference funding, and a replay is not a timed live loop.

Once the route is approved and working, start the timer when the funded demo customer initiates checkout/payment, not after settlement. Stop only after the new report is available, the contributor payout is confirmed, and the public ledger reflects the sale, all known charges, and payout. Disclose pre-created/funded accounts and credentials as setup; do not prepay the demo invoice, pre-generate its report, or hide a manual credit purchase inside setup and claim that purchase occurred in the loop.

Proposed latency allocation, not a vendor promise: checkout/settlement up to 35 seconds; automated funding plus bounded inference/research up to 55; report delivery plus payout/ledger up to 20; 10 seconds of headroom. The measured total must be strictly below 120 seconds. An unknown actual cost awaiting reconciliation is labeled provisional and cannot establish a fully accounted loop; settle it within the timed run for the strict acceptance demonstration.

Use one supported fast input route and a short public-source question for the timed run. Test another supported payment asset separately to show token choice; do not promise every chain settles within the target. Repeat three fresh successful loops under the limit. Show at least one spend-cap rejection, under-price rejection, kill-switch stop, and duplicate-payment/payout recovery in separate checks; failure paths need not fit inside the successful two-minute run.

## 7. Phases after architecture approval

One implementation owner performs this work. Percentages allocate hackathon effort, not an invented deadline. Name a backup/controller for the custody account without creating another AI agent. No further delegation is assumed. All phases include verification within their allocation.

### Phase 0 — Prove the economic loop before building the storefront · 20%

Owner: implementation lead, with owner authorization for identity/funds. Dependencies: user architecture OK, accepted testnet interpretation, access to custody/Cloud, explicit demo funding cap.

Tasks: establish the agent account and least-privilege custody; prove a small supported Intents payment route; establish a documented agent-controlled Cloud funding/purchase and actual cost receipt; establish contributor receipt; decide the testnet path. Record network, account, amounts, fees, request/transaction references, and observed latency. Do not create a raw full-access-key file as a shortcut.

Acceptance: a real economic path and safe signer are demonstrated, or exact blocked requirements are documented. Go only on the approved interpretation. If the strict route or autonomous Cloud purchase cannot be established, stop and bring that concrete gap to the user; do not spend the rest of the event polishing a claim that cannot work.

### Phase 1 — Enforce the one-file rules and durable accounting · 20%

Owner: implementation lead. Dependency: Phase 0 route accepted.

Tasks: validate/reload/version `config.yaml`; enforce the price floor and spend reservations; align custody restrictions; implement kill and recovery behavior; persist order and obligation state; record every monetary transition.

Acceptance: invalid config fails closed; cap cannot be bypassed by retry/restart or day rollover; a reduced cap prevents new excess requests; splits total 100%; contributor funds cannot be used as inference budget; kill is observed before any next charge/signature; the agent cannot rewrite policy.

### Phase 2 — Complete one autonomous market report sale · 30%

Owner: implementation lead. Dependencies: Phases 0–1.

Tasks: minimal storefront and quote/payment flow; one agent with bounded research and real Cloud usage; sourced report delivery; automatic frozen-percentage contributor payout; retry/reconciliation without repeated generation or transfers.

Acceptance: a customer receives a fresh useful report; evidence matches the question; every settled sale has its allocation; the agent funds its permitted inference; contributors actually receive their share without human approval per order. Pending money is not marked confirmed. A worker restart resumes the same obligations.

### Phase 3 — Publish the ledger and prove the demo · protected 30%

Owner: implementation lead; owner observes one run. Dependencies: Phase 2, approved public disclosure.

Tasks: public read-only ledger page; reconciliation against chain and Cloud evidence; three measured fresh loops; separate rule/kill/retry checks; a short presentation showing customer payment, inference expense, delivered report, contributor receipt, and treasury remainder. Prepare a clearly labeled recording only as backup.

Acceptance: all required sale/cost/payout entries are public without secrets; balances and evidence reconcile; approved testnet interpretation is satisfied; each successful live run is under 120 seconds; the owner can stop the business and resume without double-paying. A recording preserves the presentation, not the live acceptance result. Keep public mainnet sales disabled until the money/quality failure paths are acceptable.

## 8. Readiness checklist and approval boundary

- [ ] User approves this architecture; previous Council work remains stopped.
- [ ] Strict testnet route is established, or the user explicitly approves a described exception.
- [ ] Agent has its own NEAR account; custody or restricted treasury design works with no plaintext full-access key.
- [ ] Customer can pay through real NEAR Intents with supported token choice and an enforced minimum received price.
- [ ] Agent demonstrably buys/funds its own Cloud inference; human-prepaid access alone is not counted.
- [ ] Daily inference cap, fixed contributor share, and kill switch are enforced from the single config file.
- [ ] Sale, funding, consumption, payout, refund/failure, and config references appear correctly in the public ledger.
- [ ] All money movements are confirmed, deduplicated, and recoverable after timeout/restart; no mandatory ordinary human step remains.
- [ ] A new report, paid computation, and contributor receipt complete on the approved network path in under two minutes.

Two decisions are required before implementation: **approve/change the architecture**, and **retain strict testnet Intents or explicitly accept a narrower demo arrangement while separately proving mainnet Intents**. Actual budget, price, percentages, account names, and credential provisioning follow within that approved design; none is invented or funded by this plan.

Residual risks: the literal official-Intents testnet path is presently unavailable in the docs; autonomous Cloud funding is unverified; cross-chain settlement and provider billing latency can break the two-minute target; a hard stop cannot reverse already submitted effects; the treasury needs bootstrap/refund capacity; and a functioning autonomous loop does not prove report quality, paid demand, or sustainable margins. These are bounded proof tasks, not a reason to restore Council scope.
