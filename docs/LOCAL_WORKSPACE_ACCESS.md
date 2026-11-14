# Automatic local workspace access

Direct local-browser access opens automatically. There is no owner-token entry form and no browser-stored owner credential. Refreshes, new tabs and server restarts require no login. This is a single-owner local application: other users/processes with access to the same computer share this trust boundary.

`server.mjs` derives a private transport context from the actual Node socket using `src/web/local-access.mjs`. It requires a loopback peer, exact local Host/listening port, same-origin browser metadata and no forwarding/proxy headers. HTTP JSON, query parameters and headers cannot assert that context. DNS-rebinding hosts, cross-site/same-site cross-origin requests, embedded-resource reads and forwarded requests do not get automatic access. Existing same-origin mutation checks and M01 authorization run as before.

For a shared computer, remote host, public tunnel or reverse proxy, set `SHOP_LOCAL_OWNER_ACCESS=false` and configure authenticated access at the deployment boundary. A proxy that hides its remote origin can appear local; do not expose a loopback-trusting service through such a proxy without disabling automatic access. The optional protected owner API bearer remains supported; it is not entered or stored in the UI. Customer report access keys and provider secrets remain separate.

Local workspace access does not authorize spending, create paid grants or change Rules. Commercial policy, current kill state, scoped credit, provider bounds, permits and final dispatch checks still apply. There are no changes to M01/M03 calculations or financial records.

Checks:321 regression tests pass;18 focused HTTP/UI checks pass;12 native JBrain tests pass;96 JavaScript syntax checks pass. Direct HTTP tests cover fresh access, metadata changes, restart persistence, cross-site/host/forwarding rejection, remote socket rejection, local opt-out, explicit API bearer compatibility and zero financial effects. A fresh incognito T3 browser opened the existing workspace without entering/storing a token and read safety status automatically. Evidence is in `artifacts/local-workspace-access/`.
