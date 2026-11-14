# Loops mentor — remaining work

Requested14November2026 with the builder's question, current verified implementation, USD5 ceiling, missing inputs and known engineering gates. One Loops agent credit was used. No submission or runtime/provider mutation occurred. The mentor received coordinator-supplied source facts; it did not independently inspect the local repository.

## Mentor response (verbatim)

## What's left: the real loop has not run live

The largest gap is **real critical-path execution**: a funded, observed run of the manager/specialist/backlog/developer loop with accepted model output. Documentation is not the bottleneck. Most of what's left is blocked by three things: an unresolved encrypted-replay decision, an unfinished on-chain publication path, and missing funded or approved provider setup. The sections below separate these.

### 1. Implementation work you can do without new approvals

- **Finish the M01 native-fee, common-Treasury and final-signing protocol.** Publication to the ledger contract always holds until this is done. It is the main engineering blocker for the NEAR ledger path, and it is not just a missing secret.
- **Test the Agent API native-call writer against its documented contract using mocks.** Cover the `/v1/agents/{agent_id}/native/near/call` route, idempotency and unknown-outcome recovery. Keep the transfer-budget, timelock and owner-approval assumptions out of it, since those do not apply to native calls.
- **Make the held states visible and tested.** Accepted live commands and reports should stay held, with clear owner-facing reasons, until the encrypted replay question is settled.
- **Keep the Cloud SDK verification isolated.** Do not let it leak into the main business path.
- **Tighten the README claim boundaries.** Every feature should be labelled as intended, controlled-test, locally verified, externally blocked, or remaining. This matters more for judging than extra features.

### 2. Provider limitations (not solvable by coding alone)

- **Encrypted plaintext replay:** The current SDK exposes reply decryption only inside a process closure, with no durable export. Until a reviewed route is chosen, accepted live inference stays held. An API key alone will not change this.
- **Cloud purchase:** Autonomous cash-to-credit purchase is unsupported. Specialized inference has no supported proof or aggregate cost data.
- **1Click settlement proof:** Signed quotes do not authenticate mutable status, finality or settlement time. You do not yet have independent settlement or refund proof.
- **Agent API receipts:** Audit receipts and log proofs are not independent confidential movement proof. Describe them that way.
- **Organization balances:** Observations are unwatermarked and not additive. Don't total them as spend.
- **Supplier materials:** x402/A2A task delivery does not grant reuse rights for skills or personas. Rights stay unverified.

### 3. User-supplied prerequisites

- **Owner decision on the encrypted-replay route.** This is the gate for accepted Cloud inference, which gates the real loop. Any alternative must be an explicit, reviewed choice. No silent fallback.
- **Funded deployment scope.** The USD5 is a lifetime ceiling, and actual spend so far is USD0. Deployment and the mainnet account need a concrete funded scope and approval before anything goes on chain. The account is currently unfunded.
- **Agent API identity, policy and grant.** This needs protected partner access and approval of the provider's terms, policy and grant. The company has no existing Agent API identity.
- **NEAR Builders profile.** Required for backend API credits.
- **Rights clarification** for any supplier-provided skill or persona material.

### 4. Submission work (no submission exists yet)

- **Repository:** The rules require a public repository. The current remote is empty and most of the implementation is untracked. Committing or publishing needs your explicit authorization.
- **Demo post:** A post on X stating you built it at NEAR HACKATHON, with a video or screenshots. The demo should show the Northstar Care flow as it actually works: model-free lookup, sourced citations, escalation tickets, and the sandbox ledger. Do not show live payouts or live AI replies unless they have run.
- **Submission record:** The project is not yet registered (`loops project get` returns exists:false). Create it only when you authorize it.
- **Prize wallet address:** Required in the submission.
- **Track mapping:** Autonomous Business is primary. The NEAR Grand Prize is considered automatically. Privacy & Private AI expects NEAR AI Cloud with verified attestation. You have the free preflight verification, but not accepted encrypted inference, so present that honestly.

### Suggested focus order

1. **Decide the encrypted-replay route** (owner decision). It unblocks inference, the real loop and the Privacy track.
2. **Finish the M01 native-fee and signing protocol** so the ledger can publish once funded and approved.
3. **Rehearse an honest end-to-end demo** of what already works, with every held or unverified item named.
4. **Prepare the submission package** (repository, demo post, wallet address) only after you authorize it.

Avoid adding features or switching tracks. The remaining risk is execution and honest claims, not scope.

## Coordinator clarification

- The mentor's wording about keeping SDK verification isolated must not be read as removing it from business execution. The official SDK is already wired into preparation and verification before business dispatch/admission. Keep it encapsulated and mandatory; do not bypass it.
- An owner choice of security route alone does not unblock inference. A supported implementation, original-output proof, fresh credit/bounds, exact work authority and current cost limits still must be validated. No route change or paid call was approved by this consultation.
- NEAR Builders registration concerns the event's sponsored backend credits. It is not a prerequisite for the existing free public preflight/catalogue reads.
- Supplier rights, Cloud purchase, settlement and native signing have different missing guarantees. Do not recast them as merely missing keys.
- Mainnet funding, provider provisioning, repository publication, X posts and a Loops submission remain separate exact authorized actions. This mentor response performs none of them.
