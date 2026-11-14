# Revision 2 contract notice — 13 November 2026

The current contract is in `MVP_CONTRACTS.md` (revision2 section) and `BUSINESS_OPERATION.md`. All nonfixture workspace setup requires server-verified company-bound owner access. Product startup is setup-only without explicit commercial policy. Read-only probes grant no spending authority. Trusted absolute snapshots are nonadditive; openings and later receipts need full identity, watermark and private evidence. Owner JSON is not proof of capital or credit. Public service activation/orders cannot use private company knowledge. Real procurement requires actual supplier entitlement; the paid checklist is test-only. Agent API SUCCESS/hash stays unknown without independent proof. No funded live acceptance or TEE verification is claimed.

The earlier section below is retained as historical implementation context. Its capital/credit-observation and paid-licence descriptions do not authorize current live behavior.

# Business operation integration

M01 remains the only business-rule authority and the only reader of `config.yaml`.
Provider configuration and secret references enter through server composition.
Demo and live journals are bound to their execution mode and company.

Owner routes require a verified owner token in live mode. Existing localhost
access remains limited to fixture mode. Customer delivery capabilities remain
separate from owner authentication.

- `GET /api/workspace/operation`: activation review, resource bindings and service.
- `POST /api/workspace/activate`: `{version,agentId,serviceId,knowledgeIds:[]}`.
  M01 supplies the exact activation record; setup review grants no authority.
- `POST /api/workspace/pause`: `{version}`. Pauses new sales and dispatch.
- `POST /api/agents/:id/resources`: `{listingId,version}`. Binds a known resource,
  including its provider/version/capability; never accepts arbitrary endpoints.
- `GET /api/services`: public projection of the currently published service.
- `POST /api/services/:id/orders`: customer brief plus explicit refund address.
  The server freezes the assigned agent and explicitly published knowledge only.
- `POST /api/orders/:id/check-payment`: observes the original stored invoice.
  Body fields cannot establish payment, credit or wallet authority.

Live authorization is injected from an owner-controlled server file. It binds
the company, current policy hash, expiry, permitted actions/recipients, inference
limits and total cash upper bound. It is an operator authorization, not a claim
that the app verified an owner signature. Agent API enforces the independently
owner-signed wallet policy/grant. No account or grant is created automatically.

Prepaid credit observations and initial capital are separate Rules-approved
records. They cannot create fictional company purchases or sales. Credit
observations need a stable receipt reference and bounded expiry; repeated
observations cannot replenish spent credit. Unknown inference charges retain
reservations. Autonomous Cloud purchasing remains unsupported in live mode.

Procurement buys one configured, versioned workspace skill licence. Payment
uses the existing custody boundary, with an exact Rules plan and durable intent.
The licence is granted only after exact confirmed payment. Catalog instructions
do not grant financial authority. Provider failures/unknown results reconcile
the original operation and never create replacement payments automatically.

Provider protocol tests use local HTTP stand-ins. Passing them establishes local
integration, not funded mainnet operation or attestation verification.
