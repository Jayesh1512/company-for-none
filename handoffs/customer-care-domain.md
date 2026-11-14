# Customer-care domain handoff — 14 November 2026

**WORKER_DONE.** New support scope only: `src/support/index.mjs`, `src/support/demo.mjs`, `test/customer-care-domain/support.test.mjs`, and this handoff. Prior autonomy files remain frozen. No dependency/config/env change, new chat/agent, commit, paid/model/claim/email/wallet/provider operation or main company reconfiguration was performed.

## Composition and exports

```js
import {createCustomerCare,readSupportFacts} from './support/index.mjs';

// The action argument binds actual native source snapshots to this one decision.
const rules=createRules({
  // existing options
  getSupportFacts:action=>readSupportFacts({journal,companyId,action}),
});
const support=createCustomerCare({
  journal,rules,workspace,knowledge,jbrainClient,companyId,clock,
});
```

Pass the same **actual private JBrain client** used by company knowledge. The customer path never receives owner access, uses no raw company-knowledge HTTP API, and reads the private native client only after M01 `support_context` selects the exact published source IDs. No provider or model port is present. `replyMode:'policy_lookup'`, `aiEnabled:false`, fictional notices and source citations are truthful on this functioning path.

`readSupportFacts` exposes only company-scoped support services/conversations/messages/tickets, agents, and company knowledge metadata. Actual canonical snapshots live in an ephemeral WeakMap keyed by Journal and exact action ID; neither request JSON nor facts supplied by a client can populate it. The snapshot shape is `{documentId,title,revision,hash:fingerprint(markdown),markdown}`. Cache entries are deleted after the decision; no snapshot fallback exists.

S1 owns `src/rules/support.mjs` and the private callback in `createRules`. All support decisions, section matching, limits, publication checks, customer projections, reply text/citations, escalations and exact journal puts come from M01. The domain writer checks the decision again inside the synchronous Journal commit, executes only support namespace puts with CAS, and verifies the customer's current token hash again at that boundary. No prior public report-service/private-document prohibition changed.

## Stable API and envelopes

All mutating public/owner methods require a nonempty stable key, at most160 characters. Methods return data or throw a ContractError with `code`/`httpStatus`; customer authentication failures are403. Source/publication and input failures retain exact M01 reason codes. There is no automatic reply retry.

| Method | Result |
|---|---|
| `setupDemo(access,key)` | `{services,conversations,messages,tickets,agents,documents,publicationRequired,fictional:true,replyMode,aiEnabled}` owner only |
| `catalog()` | `{services,replyMode,aiEnabled}` public M01 projections |
| `open({serviceId},key)` | `{conversation,accessToken,replayed,replyMode,aiEnabled}` |
| `view(id,token)` | `{conversation,messages,tickets,replyMode,aiEnabled}` own customer only |
| `message(id,{text},token,key)` | `{conversation,reply,ticket,service:null,replayed,replyMode,aiEnabled}` |
| `escalate(id,{summary?},token,key)` | `{conversation,ticket,reply:null,service:null,replayed,replyMode,aiEnabled}` |
| `ownerView(access)` | `{services,conversations,messages,tickets,replyMode,aiEnabled}` owner only |
| `publish(input,access,key)` | `{service,conversation:null,reply:null,ticket:null,replayed,replyMode,aiEnabled}` owner only |

`conversation` contains only id/companyId/serviceId/agentId/state/version/timestamps, never tokenHash. Messages have role `customer` or `assistant`, literal `text`, citations and reasonCode. Each citation contains `{documentId,title,revision,hash,section,excerpt}`. An unsupported query or personal claim decision creates a real persisted support ticket; its case ID is included in the reply. It does not file or approve an insurance claim, contact an insurer or send a message outside the app.

Service IDs: `support:<companyId>:policy-guide` and `support:<companyId>:claims-guide`. Catalog service fields are `id,companyId,agentId,name,description,kind,replyMode,aiEnabled,fictional,status,version`. Two current ready actual profiles back these listings. `ownerView` also supplies source bindings and publication-current status for services, without raw tokens or whole source bodies.

Exact publication input:

```js
{
  serviceId,version,agentId,name,description,kind:'policy',fictional:true,
  sources:[{documentId,revision,hash}],
}
```

`kind` is `policy` or `claims`, `version:0` creates; updates require the current service version. Hash the **canonical markdown including native frontmatter**, not its stripped body. Existing `knowledge.read(id,access)` returns both `.document.markdown` and `.document.body`; publication intentionally uses markdown to match private `jbrainClient.read` exactly. Every source needs a current company-visible document, explicit matching agent grant, current metadata/native revision and exact approved hash. Owner access alone is not publication of changed bytes.

## Setup and persistence

`setupDemo` is explicit. Import/construction performs no writes and neither starts nor changes the existing company/objective. It uses existing owner APIs:

- `workspace.create` with stable per-company/per-demo-version action IDs creates two normal persistent profiles: Harbor Mutual Policy Guide and Harbor Mutual Claims Guide.
- `knowledge.save` with stable request IDs writes four actual native JBrain documents: fictional auto, home, travel and claims handling. All prominently state that organizations, amounts and periods are invented, and no real coverage/advice/claim approval exists.
- Policy guide publishes auto/home/travel; claims guide publishes all four. Source references are real native IDs, current revisions and exact canonical hashes.

Rerunning setup, even with another setup key or after restart, preserves profile/document edits and existing service records. It never regrants access, resets a source, changes existing publication, creates duplicate profiles or resets financial state. Original owner-write receipt revisions are retained during setup: if setup was interrupted before initial publication and a source was subsequently edited, its service is **not** published on repeat. The owner-only result lists `publicationRequired:[{serviceId,reasonCode:'SUPPORT_DEMO_SOURCE_CHANGED',documentIds}]`; explicit reviewed publication is needed. The user's intervening edit remains intact.

Suggested customer questions supported by the pack:

- Policy Guide: `What is the auto collision deductible?` → exact section mentioning500 **demo** dollars.
- Policy Guide: `What is the home water damage deductible?` → internal-pipe example and1,000 **demo** dollars.
- Policy Guide: `What is the travel delay threshold?` →6 **demo** hours and illustrative150 demo dollars.
- Claims Guide: `What are the claims reporting steps?` → exact fictional reporting process; no external filing.
- Either: `Quantum banana spaceship warranty` → no match, persistent owner case.
- Claims Guide: `Please approve my claim and pay my reimbursement` → explicit human-decision escalation, persistent owner case.

The home pack describes pipe water damage; it does not invent flood coverage.

## Customer privacy, replay and changed sources

Open returns32 random bytes encoded base64url as the first `accessToken`. Only SHA256 tokenHash is stored. No raw token appears in any journal record, command result, owner projection or transcript. A repeated open key returns the same conversation and `accessToken:null`, including within the same process. An idempotency key is not authentication. The UI must retain the first token; a lost opening response needs a fresh open key/new conversation. Existing tokens remain valid after restart.

Keys for messages/escalations are scoped to the conversation. Two customers can use the same key without collision. Changed input under one existing key conflicts. Replaying a message creates no duplicate customer turn, assistant reply or ticket; the response is projected through a new, currently authorized transcript read. This matters after publication is revoked.

Every exposure reads current exact sources after M01's publication/read grant. An edited document, revoked explicit grant, private document, changed native revision, mismatched agent, absent client or JBrain outage cannot produce another excerpt. A stale reply is held without any partial message write. Reading/replaying the customer's transcript then replaces previously sourced assistant text with a fixed stale-source notice and empty citations. The customer's own text and own tickets remain available; old approved passages are not re-exposed. An explicit customer escalation can still create an owner case when publication is stale.

Knowledge and capability checks repeat at Journal commit, so a grant/capability changed after the asynchronous source reads prevents the reply from committing. Canonical source text stays inert: even explicitly owner-published code/instruction-looking text is quoted as text and never executed. Domain has no model, tool, shell, claim, payment or external contact executor.

## Native verification

Use the supported Node:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node --test test/customer-care-domain/*.test.mjs test/customer-care-rules/*.test.mjs
```

Tests use the installed actual native binary through `startNativeJBrain` and `createJBrainClient`, with fresh private temporary directories and real owner workspace/knowledge APIs. They verify native revisions/hash/citation bytes and restart persistence, then clean their own isolated data. No SDK/model output, JBrain substitute, synthetic money or provider proof is injected into these tests.

Final consolidated result: **21 passed, 0 failed, 0 skipped** (11 domain and10 M01 support scenarios). Eleven domain scenarios cover explicit setup/edit preservation; exact sourced lookup and restart replay; unknown/claim tickets; hash-only random tokens/cross-customer403; grant/revision change plus explicit reapproval; direct native edits without matching metadata; revocation at commit; native outage; interrupted-setup owner edit; capability hash change at commit; and literal inert source text. The knowledge regression also verifies existing native grants/revisions/import/publication behavior.

Logs: `/tmp/near-support-final-focused.log` (domain+Rules), `/tmp/near-support-domain-final.log` (37 domain/Rules/knowledge checks before the final two added boundary tests), `/tmp/near-support-domain-boundary.log` (those two tests). Syntax checks pass for the two owned source modules and domain test module.

Coordinator owns real persistent preview JBrain lifecycle, app injection, HTTP/UI routes, owner setup invocation against that persistent instance, company configuration, desktop/mobile browser evidence and broad regression. The domain API is ready for that actual local demonstration. No commercial inference/TEE/wallet gate needs relaxing to use this explicitly model-free service.
