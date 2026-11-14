# Northstar Care — fictional insurance customer-care company

For the company operating model, healing, upgrades, resource buying and current status, start with [How CompanyOs works](COMPANYOS_GUIDE.md). This page details the working local customer-care path.

Open the [customer portal](http://127.0.0.1:4173/#care), [owner inbox](http://127.0.0.1:4173/#support), or [local marketplace](http://127.0.0.1:4173/#marketplace).

This company provides customer care for **Harbor Mutual Insurance**, a fictional demonstration client. Two actual saved profiles, Policy Guide and Claims Guide, appear in the local marketplace. Four actual native JBrain documents cover fictional auto, home, travel and claims handling. The existing company history and profiles are retained; the previous objective is superseded explicitly and automatic commercial execution remains paused.

## What works now

- Select an agent, start a private conversation, and ask a policy question.
- M01 selects exact passages from current approved JBrain revisions. Replies include source title, section, revision and literal excerpt.
- Ask “What is the auto collision deductible?”, “What does the home water damage policy say?”, “What is the travel delay threshold?” or “How do I report a claim?”
- Ask “Please approve my claim” or a question outside those documents. The app creates a real persistent local ticket, visible in the owner inbox. It does not approve a claim, contact an insurer, send email or promise a response time.
- Refresh or restart the app. The same browser capability restores the saved conversation. Repeating a message request does not duplicate the turn or case.

Replies are **model-free policy lookup**, not model-generated conversation, TEE-verified output or a simulated provider response. JBrain retrieval, persistence, publication validation and escalation recording are real. The policy text, insurer, amounts and support scenario are fictional. No paid provider, wallet, purchase, claim API or external marketplace publication is used. The USD5 ceiling stays unchanged, with USD0 spent by this feature.

## Explicit setup and commands

Ordinary startup does not seed data. From the running local owner connection, use Customer care → Add fictional policy pack, or explicitly configure the company and load the pack with:

```sh
node scripts/setup-customer-care.mjs http://127.0.0.1:4173
```

The command pauses automatic work, saves the customer-care brief, explicitly replaces a different active objective, and calls the owner-only pack setup. It preserves existing histories, profiles and policy edits. Repeating it creates no duplicate agents, documents or services. Edited or revoked sources are not silently republished. Interrupted first publication with changed sources returns `publicationRequired` for owner review.

## Privacy and source publication

Only an authenticated owner can publish an exact set of document IDs, canonical markdown hashes and JBrain revisions for a ready agent with explicit grants. Public customers receive only the selected published passages. Private documents and general owner knowledge APIs stay unavailable to customers. Every reply rechecks current publication and source bytes immediately before its local commit. Edited or revoked sources hide earlier customer excerpts until explicitly approved again.

Every conversation has a random private capability. Only its hash is stored on the server. The browser keeps its token in session storage; no owner token entry is required on the trusted local owner connection. A different customer token cannot read the conversation. An idempotency-key replay never returns a lost token: if the first response was lost, start a new conversation. Closing the browser session may remove its token. The owner inbox remains separately protected. Transcripts and tickets are persistent company records; do not enter real personal, medical or financial data in this fictional demo.

## HTTP ports

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/support/services` | Public | Rules-approved local support listings |
| `POST /api/support/conversations` | Public | `{serviceId}`, stable Idempotency-Key, first-response capability |
| `GET /api/support/conversations/:id` | Customer Bearer token | Own current, safely projected transcript |
| `POST /api/support/conversations/:id/messages` | Customer token + stable key | `{text}`, exact excerpts or real local case |
| `POST /api/support/conversations/:id/escalate` | Customer token + stable key | `{summary?}`, recorded local review request |
| `GET /api/workspace/support` | Owner | Services, conversations and escalation inbox |
| `POST /api/workspace/support/demo` | Owner + stable key | Explicit fictional profiles/documents/publication |
| `POST /api/workspace/support/publish` | Owner + stable key | Exact approved revision/hash publication |

All publication and reply decisions are in M01 `src/rules/support.mjs`. `src/support` performs token verification, real JBrain I/O and exact journal writes only. `createRules({getSupportFacts: action => readSupportFacts({journal,companyId,action})})` receives action-bound private canonical source snapshots; HTTP-provided sources or actor claims have no authority.

## What the owner must supply for real service

1. The actual client identity, jurisdiction and approved policy documents, with effective dates and permitted disclosures.
2. Allowed support actions, identity-verification rules, escalation contacts/process and the expected response time. No real claim decisions are enabled by this demo.
3. For model-written answers, a privately configured Cloud credential and a supported accepted-output verification route, plus scoped bounds/credit authorization. A key alone does not resolve the current durable E2EE plaintext-proof limitation.
4. For paid external marketplace sales, approved listing/price, the exact existing network/account, settlement evidence and an executable refund route. Local listings do not publish to NEAR Agents Marketplace.

## Verification

```sh
node --test test/customer-care-rules/*.test.mjs test/customer-care-domain/*.test.mjs test/customer-care-app/*.test.mjs
node scripts/check-customer-care-browser.mjs
npm test
npm run check
```

Use supported Node>=24.22.1 and the existing native JBrain binary. The browser check follows the repository’s Playwright workflow and starts isolated actual native JBrain/HTTP services. It verifies marketplace → customer chat → citations → escalation → owner inbox, responsive layout, customer isolation and disk-reopen replay. Proof and screenshots are in `artifacts/customer-care/`. No test substitutes an LLM response for this lookup service.
