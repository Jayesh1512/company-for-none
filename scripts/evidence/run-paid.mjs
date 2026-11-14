#!/usr/bin/env node
// Disabled after review. No application, environment loader, file/credential
// reader or transport is imported. Every flag fails closed before any effect.
console.error(JSON.stringify({schemaVersion:1,status:'BLOCKED',reasonCode:'UNREVIEWED_PAID_EVIDENCE_RUNNER_DISABLED',providerCalls:0,paidCalls:0,credentialsRead:false,grantsSpendingAuthority:false,note:'The unreviewed runner is preserved for provenance. Use the separately approved owner-funded AI demo and existing shared financial ledger; evidence verification never authorizes a call.',review:'evidence/reviews/paid-runner-review.json'}));
process.exitCode=2;
