# Current runtime note — 13 November 2026

The product starts with no agents or commercial policy. All company routes require server-verified owner access. Native JBrain is pinned at `35836b0972a6471b22db3155f78b26749c78b6ac`; `npm run setup:jbrain` builds it from this checkout. The current required native suite passes 12/12 with no skips. Model-free storage and health checks are real local operations; no paid inference is invoked. Current browser evidence is `artifacts/real-r2-browser-proof.json`.

Internal tasks retain company/agent grants and revision checks. Live public service activation/orders cannot include private knowledge. No public audience/revision approval workflow is implemented. Saved text, operation records and history persist; this is not a no-retention expense-auditor app.

# Company knowledge via JBrain

Canonical company documents live in JBrain over its existing HTTP API. Near1 never opens its SQLite files or writes the knowledge bundle directly. One isolated local brain serves this workspace; existing JBrain data is untouched. JBrain's bearer token grants whole-brain access, so only the server holds it. Agent identity and grants are resolved from trusted persisted records, never browser claims. This is a single-owner local workspace, not production tenant authentication.

Local endpoints, protected by the existing Rules workspace access gate:
- GET /api/knowledge -> connection status, company ID, registered document metadata.
- GET /api/knowledge/document?id=<conceptId> -> canonical Markdown + current JBrain revision.
- POST /api/knowledge/import -> ephemeral file/page-to-text preview; raw file bytes with X-Import-Kind and X-File-Name, or JSON {kind:website,url}. Existing local/origin checks plus M01 knowledge_import bounds. No persistence until explicit save.
- POST /api/knowledge/documents -> {title,body,visibility:'company'|'restricted',agentIds:[],id?,expectedRevision?,version?}; Idempotency-Key required. Creates/updates OKF Markdown with JBrain revision CAS and app metadata version CAS.
- POST /api/orders/:id/publish-knowledge -> {title,visibility,agentIds:[]}; task capability and local workspace access required. Server reads the accepted report; no client-supplied report content. Explicit sharing only.

Task input may add knowledgeIds: concept ID array. M01 chooses permitted IDs and bounds; context reads only those exact IDs, preserves revisions/truncation and freezes the selected context with the task. Undefined selects the bounded permitted set; [] explicitly opts out. Context is internal untrusted background, not independently verified public research evidence. Grant revocation blocks new inference dispatch containing the revoked document. Historical task snapshots/reports remain capability protected.

Journal metadata tracks company/document identity, visibility and grants. Durable write intents retain the exact JBrain request ID/payload; timeout remains unknown, same identity is reconciled/replayed, changed payload conflicts. No new write is invented for a retry. Canonical content is JBrain's OKF document. Writes use expectedRevision; conflicts require a fresh read/merge and new request ID. JBrain history and app metadata retain past private data; this MVP provides no erasure guarantee.

Only model-free /health, /v1/concept and /v1/operations calls are used. /ask and external inference are never invoked by the integration.

## Local setup

`npm run dev` starts the native binary at `.runtime/dependencies/jbrain/target/release/jbrain` on an available loopback port and then starts the app. It uses `$SHOP_DATA_DIR/company-brain`, sets `JBRAIN_HISTORY=off` (no Git commits or remote sync), generates a private service token file and shuts down its children with the app. It supplies no model credentials. Existing JBrain installations are untouched. `SHOP_JBRAIN_BINARY` and `SHOP_JBRAIN_DATA_DIR` override those paths. Build the pinned dependency with `npm run setup:jbrain`. The setup script refuses edited or mismatched checkouts.

For an existing service, set `SHOP_JBRAIN_URL` and `SHOP_JBRAIN_TOKEN_FILE` (or server-only `SHOP_JBRAIN_TOKEN`). `npm start` starts only the app and uses those external connection settings. `.env.example` documents variables. `npm run dev` loads `.env`; `npm start` uses the current process environment.

The journal is permanently bound to `SHOP_COMPANY_ID` (default `local-workspace`). Reusing it under another company identity fails closed. This guards accidental mixing; it is not a substitute for authenticated tenants. Back up the app journal and its company-brain directory together while stopped. App metadata/grants and JBrain canonical documents are both required for a full restore. Direct JBrain access bypasses app grants, so keep its token private and its service isolated.

After an accepted write loses its response, the app records `unknown` and checks the original JBrain operation on restart and during normal recovery. It imports the original applied receipt without sending another write. A manual retry retains the same request ID and exact payload. Pending document writes block a new competing app edit until resolved. Revision conflicts never silently merge.

## Evidence

`test/knowledge/jbrain.test.mjs` launches the actual Rust service in temporary isolated directories. It covers sharing/restrictions, company scope/binding, revision CAS, preservation of unknown OKF metadata, bounded excerpts, frozen task context, grant revocation before inference with refund, explicit capability-protected report publication, real socket loss after an accepted write and original-receipt recovery, service/app restart, unavailable-service failure and inert UI text. Set `JBRAIN_TEST_BINARY` for a different built binary. Run `npm run test:native` as a required check: it fails if the service binary is absent. Ordinary suite output reports any optional skips explicitly.

Historical browser evidence below uses a separate QA store on port4180, with sample content explicitly labeled QA fixture. The earlier preview used only owner-saved documents. The current preview contains explicitly identified QA notes from browser checks. `artifacts/jbrain-browser-proof.json` records the successful shared/restricted context, task/report/share and390px responsive checks. Those historical financial/inference checks use fixtures; JBrain persistence and HTTP are real local integration evidence. Postman CLI was probed but lacks the `status` command; these checks use actual Node HTTP and the native service, not a claimed Postman simulation.

## Import execution and storage

`src/knowledge/import.mjs` reads bounded request bodies into memory. Markdown/text must be UTF-8. PDF bytes go over stdin to `pdf-worker.mjs`, an isolated PDF.js child with a stripped environment, heap bound and hard timeout. No temp uploads, journal writes or paid inference occur. M01 supplies5MB upload,50page PDF,10second,1MB public-page,3redirect and24,000character limits. Public website reads reuse M08’s DNS-pinned transport, including redirect checks. Scanned/encrypted/unreadable PDFs return actionable errors; no OCR is claimed. The browser previews escaped editable text and provenance, clearly marks excerpts, and saves via the existing Rules-gated grant/revision path. Original media is not an attachment or a retained download.
