# Unified company setup

Organization setup and Company for none now use one active flow at `/#setup`:

1. Define company.
2. Review agents.
3. Company brain (optional).
4. Boundaries & infrastructure.
5. Review & finish.

New companies default to `operatingMode: none`. Saving the brief creates the real manager and backlog profiles, initial objective and paused work records. The initial roles come from M01; this is not a model-generated team. Users can edit names, descriptive roles, instructions and free written skills through the existing profile API. Internal `autonomyRole`, grants, scopes and spending authority are not profile form fields.

Company operations (`/#autonomy`) shows execution and its ledger. Finish records current local configuration review and opens operations. It does not start the company, activate a service, provision infrastructure or authorize paid work. Specialists still require accepted agent commands and current Rules authorization.

## Exact local API

All routes retain current owner identity, mutation-origin, input and idempotency checks.

- `POST /api/workspace/autonomy/onboard`: `{version, organizationVersion, brief, intent}`. Brief has exactly `name, purpose, industry, customer, outcome, objective`. M01 validates current versions, brief and limits. It supplies exact organization/company/core-agent/objective/work mutations. The writer applies them in one journal transaction with CAS. Failed capacity/version checks leave no partial setup. A repeated identical request key returns the committed result; changed contents conflict.
- `POST /api/agents/:id/update`: existing bounded profile update. The setup form sends `{version, name, role, instructions, skillIds}`. Changes persist and produce the existing agent-update ledger event. Internal authority is unchanged.
- `POST /api/workspace/autonomy/configure`: existing operating-preference API. The merged form preserves the current operating mode and saved brief. Preferences do not grant a model-call or money budget.
- `POST /api/workspace/autonomy/setup-review`: `{version}`. M01 requires a paused company and configured profiles. It stores a fingerprint of the current brief, limits, runtime/mode and actual profiles, with scope `local-configuration-only`. Later relevant edits invalidate that review. The owner-only autonomy view projects `{setup:{defaultOperatingMode:'none',reviewed}}` from M01.

Existing agents and explicit manual mode are preserved. The canonical organization metadata and company brief are saved together; existing organization activation/review fields are retained. Existing objectives and counters are not replaced by editing the brief: a changed initial objective requires the explicit objective-control operation. A started company must be paused before changing the merged setup. No migration, deletion, financial reset or automatic execution occurs on page load.

## Compatibility and boundaries

Legacy `/#autonomy/setup?step=N` links resolve to the unified setup. Older `/#setup/profiles`, `/skills`, `/infra` and `/complete` links select the corresponding new step. The previous six-stage backend APIs and renderer remain for compatibility; the active workspace renders only the merged flow. Historical plans, critiques and stores remain intact.

JBrain remains optional for local setup. Document grants and each agent's selected context are separate controls. Marketplace written content is not a verified paid tool binding. Execution still requires the existing current policy, authorization, lease/fence, credit, bounds and proof checks. Current durable E2EE accepted-output and economic/provider gates remain open.

## Verification —14 November2026

- `npm test`:326 passed,0 failed,0 skipped.
- `node --test test/autonomy/company-setup.test.mjs`:5 passed, covering atomic/idempotent setup, restart, real profile edits, CAS/capacity failures, review invalidation, forged fields/access, objective/start controls and active rendering.
- `npm run test:native`:12 actual native JBrain checks passed.
- `npm run check`:98 JavaScript files passed.
- `npm run check:autonomy:browser`: actual isolated HTTP/browser brief→profiles→optional brain→boundaries→finish. Name, role, instructions and skill edits persist across reload; finish leaves the company paused. Existing gap/context routes work, cross-site access returns403, page exceptions0, orders0, provider operations0, financial version0. Desktop1440/mobile390 geometry has no horizontal overflow.

Evidence is in `artifacts/unified-company-setup/`. Native T3 navigation, semantic inspection and form submission worked; screenshot capture timed out and the host then returned `No preview automation host is available ... Do not retry`. Final desktop/mobile screenshots use the repository's documented browser-check workflow. One initial browser run timed out finding the gap link; subsequent complete runs passed, and the script now waits for the destination heading before clicking. These checks establish local configuration, not live autonomous reasoning or commerce.

Preview restarted at `http://127.0.0.1:4173/#setup` with the same `.runtime/product-r2-preview` store, owner-token file and model-free JBrain. Before/after hashes confirm the two saved agents, organization, company record and event count are unchanged. No company was seeded into the user's store.


## Historical sample-only toggle —14 November2026 (superseded)

The persistent top-right button explicitly enables fictional sample input. `public/setup-demo.js` contains inert sample brief/knowledge text and a pure draft merger; it imports no provider fixture or test module and performs no API calls. Company fields and operating preferences fill in the merged setup, preserving entered and saved details. Optional knowledge uses an editable document draft with existing access controls. The manager/backlog still come from the ordinary M01 save, paused.

Only the on/off flag is kept in sessionStorage. Refresh can restore the sample mode; no owner credential or company content is added to browser storage. Turning the mode off keeps edits and saved records. Repeated toggles do not save, create agents, review setup, start work, change policy or grant spending.

Checks:328 full tests/0fail/0skip;15 focused demo/setup/product checks;99 syntax files. `npm run check:autonomy:browser -- --demo` passed actual draft fill/toggle/input preservation/reload,0 automatic writes, explicit save/edit/finish, optional knowledge draft, and existing gap/context routes. Desktop1440/mobile390 no overflow or page exceptions. Provider operations/orders/financial version0 in the isolated test. Actual native T3 preview click filled every brief field with0errors; saved workspace hash stayed unchanged. Evidence: `artifacts/setup-demo/`. No server restart was needed for static assets.


The later [real local demo](LOCAL_REAL_DEMO.md) replaces the top-bar toggle with **Open local demo**, which launches a separate company/native-JBrain workspace. The sample-only behavior described above is now **Fill example fields** in ordinary setup. Its historical328/99 evidence is preserved; current demo evidence is in `artifacts/local-real-demo/`.
