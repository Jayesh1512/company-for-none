Title: Create chat completion - NEAR AI

URL Source: https://docs.near.ai/api-reference/chat/create-chat-completion

Markdown Content:
> ## Documentation Index
> 
> 
> Fetch the complete documentation index at:[/llms.txt](https://docs.near.ai/llms.txt)
> 
> 
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.near.ai/api-reference/chat/create-chat-completion#content-area)

[NEAR AI home page![Image 1: dark logo](https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max&auto=format&n=pPLdEuT1c099u7Oo&q=85&s=8a963be37f612240f91743d7a063d5b8)![Image 2: dark logo](https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max&auto=format&n=pPLdEuT1c099u7Oo&q=85&s=8a963be37f612240f91743d7a063d5b8)](https://docs.near.ai/)

Search...

⌘K

*   [Developer Dashboard](https://cloud.near.ai/)

Search...

Navigation

Chat

Create chat completion

[Documentation](https://docs.near.ai/)[API Reference](https://docs.near.ai/api-reference/introduction)

### Getting Started

*   [Overview](https://docs.near.ai/api-reference/introduction)

### Chat

*   [POST Create chat completion](https://docs.near.ai/api-reference/chat/create-chat-completion)
*   [POST Create text completion](https://docs.near.ai/api-reference/chat/create-text-completion)
*   [GET List available models](https://docs.near.ai/api-reference/chat/list-available-models)

### Responses

*   [POST Create response](https://docs.near.ai/api-reference/responses/create-response)

### Models

*   [GET List models with pricing](https://docs.near.ai/api-reference/models/list-models-with-pricing)
*   [GET Get model details](https://docs.near.ai/api-reference/models/get-model-details)

### Images

*   [POST Edit images from a text prompt and image](https://docs.near.ai/api-reference/images/edit-images-from-a-text-prompt-and-image)
*   [POST Generate images from text prompt](https://docs.near.ai/api-reference/images/generate-images-from-text-prompt)

### Audio

*   [POST Audio transcription endpoint](https://docs.near.ai/api-reference/audio/audio-transcription-endpoint)

### Rerank

*   [POST Document reranking endpoint](https://docs.near.ai/api-reference/rerank/document-reranking-endpoint)

### Score

*   [POST Text similarity scoring endpoint](https://docs.near.ai/api-reference/score/text-similarity-scoring-endpoint)

### Privacy

*   [POST Post v1privacyclassify](https://docs.near.ai/api-reference/privacy/post-v1privacyclassify)
*   [POST Post v1privacyredact](https://docs.near.ai/api-reference/privacy/post-v1privacyredact)

### Attestation

*   [GET Get Intel Trust Authority attestation token](https://docs.near.ai/api-reference/attestation/get-intel-trust-authority-attestation-token)
*   [GET Which attested backup-provider trust inputs are live](https://docs.near.ai/api-reference/attestation/which-attested-backup-provider-trust-inputs-are-live)
*   [GET Get attestation report](https://docs.near.ai/api-reference/attestation/get-attestation-report)
*   [GET Get completion or Responses API signature](https://docs.near.ai/api-reference/attestation/get-completion-or-responses-api-signature)

### Users

*   [POST Confirm a contact email (public endpoint)deprecated](https://docs.near.ai/api-reference/users/confirm-a-contact-email-public-endpoint)
*   [GET Get current user deprecated](https://docs.near.ai/api-reference/users/get-current-user)
*   [POST Create a new access token deprecated](https://docs.near.ai/api-reference/users/create-a-new-access-token)
*   [POST Add a contact email deprecated](https://docs.near.ai/api-reference/users/add-a-contact-email)
*   [DEL Remove the contact email deprecated](https://docs.near.ai/api-reference/users/remove-the-contact-email)
*   [GET List pending invitations for the current user deprecated](https://docs.near.ai/api-reference/users/list-pending-invitations-for-the-current-user)
*   [POST Accept an organization invitation deprecated](https://docs.near.ai/api-reference/users/accept-an-organization-invitation)
*   [POST Decline an organization invitation deprecated](https://docs.near.ai/api-reference/users/decline-an-organization-invitation)
*   [PUT Update current user's profile deprecated](https://docs.near.ai/api-reference/users/update-current-users-profile)
*   [GET Get user's refresh tokens deprecated](https://docs.near.ai/api-reference/users/get-users-refresh-tokens)
*   [DEL Revoke a user refresh token deprecated](https://docs.near.ai/api-reference/users/revoke-a-user-refresh-token)
*   [GET Get current user's account eligibility status deprecated](https://docs.near.ai/api-reference/users/get-current-users-account-eligibility-status)
*   [DEL Revoke all tokens for a user deprecated](https://docs.near.ai/api-reference/users/revoke-all-tokens-for-a-user)

### Organizations

*   [GET List organizations deprecated](https://docs.near.ai/api-reference/organizations/list-organizations)
*   [POST Create a new organization deprecated](https://docs.near.ai/api-reference/organizations/create-a-new-organization)
*   [GET Get organization by ID deprecated](https://docs.near.ai/api-reference/organizations/get-organization-by-id)
*   [PUT Update organization deprecated](https://docs.near.ai/api-reference/organizations/update-organization)
*   [DEL Delete organization (owner only)deprecated](https://docs.near.ai/api-reference/organizations/delete-organization-owner-only)
*   [GET Get organization settings deprecated](https://docs.near.ai/api-reference/organizations/get-organization-settings)
*   [PATCH Patch organization settings deprecated](https://docs.near.ai/api-reference/organizations/patch-organization-settings)

### Organization Members

*   [DEL Cancel an organization invitation (short path)deprecated](https://docs.near.ai/api-reference/organization-members/cancel-an-organization-invitation-short-path)
*   [GET List organization members with limited user information deprecated](https://docs.near.ai/api-reference/organization-members/list-organization-members-with-limited-user-information)
*   [POST Add a member to an organization deprecated](https://docs.near.ai/api-reference/organization-members/add-a-member-to-an-organization)
*   [GET List organization invitations deprecated](https://docs.near.ai/api-reference/organization-members/list-organization-invitations)
*   [DEL Cancel an organization invitation deprecated](https://docs.near.ai/api-reference/organization-members/cancel-an-organization-invitation)
*   [POST Invite users to an organization by email deprecated](https://docs.near.ai/api-reference/organization-members/invite-users-to-an-organization-by-email)
*   [PUT Update an organization member's role deprecated](https://docs.near.ai/api-reference/organization-members/update-an-organization-members-role)
*   [DEL Remove a member from an organization deprecated](https://docs.near.ai/api-reference/organization-members/remove-a-member-from-an-organization)

### Invitations

*   [GET Get invitation details by token (public endpoint)deprecated](https://docs.near.ai/api-reference/invitations/get-invitation-details-by-token-public-endpoint)
*   [POST Accept invitation by token (requires authentication)deprecated](https://docs.near.ai/api-reference/invitations/accept-invitation-by-token-requires-authentication)

### Workspaces

*   [GET List workspaces in an organization deprecated](https://docs.near.ai/api-reference/workspaces/list-workspaces-in-an-organization)
*   [POST Create a new workspace in an organization deprecated](https://docs.near.ai/api-reference/workspaces/create-a-new-workspace-in-an-organization)
*   [GET Get workspace by ID deprecated](https://docs.near.ai/api-reference/workspaces/get-workspace-by-id)
*   [PUT Update workspace deprecated](https://docs.near.ai/api-reference/workspaces/update-workspace)
*   [DEL Delete workspace deprecated](https://docs.near.ai/api-reference/workspaces/delete-workspace)
*   [GET List API keys for workspace deprecated](https://docs.near.ai/api-reference/workspaces/list-api-keys-for-workspace)
*   [POST Create API key for workspace deprecated](https://docs.near.ai/api-reference/workspaces/create-api-key-for-workspace)
*   [DEL Revoke an API key deprecated](https://docs.near.ai/api-reference/workspaces/revoke-an-api-key)
*   [PATCH Update API key deprecated](https://docs.near.ai/api-reference/workspaces/update-api-key)
*   [PATCH Update API key spend limit deprecated](https://docs.near.ai/api-reference/workspaces/update-api-key-spend-limit)

### Usage

*   [GET Get service usage history for an organization deprecated](https://docs.near.ai/api-reference/usage/get-service-usage-history-for-an-organization)
*   [GET Get organization balance deprecated](https://docs.near.ai/api-reference/usage/get-organization-balance)
*   [GET Get organization usage broken down by model.deprecated](https://docs.near.ai/api-reference/usage/get-organization-usage-broken-down-by-model)
*   [GET Get organization usage history deprecated](https://docs.near.ai/api-reference/usage/get-organization-usage-history)
*   [GET Organization usage metrics.deprecated](https://docs.near.ai/api-reference/usage/organization-usage-metrics)
*   [GET Organization usage timeseries.deprecated](https://docs.near.ai/api-reference/usage/organization-usage-timeseries)
*   [GET Get API key usage history deprecated](https://docs.near.ai/api-reference/usage/get-api-key-usage-history)

### Reporting

*   [GET List active reporting tokens for an organization.deprecated](https://docs.near.ai/api-reference/reporting/list-active-reporting-tokens-for-an-organization)
*   [POST Create a read-only reporting token.deprecated](https://docs.near.ai/api-reference/reporting/create-a-read-only-reporting-token)
*   [DEL Revoke a reporting token.deprecated](https://docs.near.ai/api-reference/reporting/revoke-a-reporting-token)
*   [GET Export organization usage and cost rows.deprecated](https://docs.near.ai/api-reference/reporting/export-organization-usage-and-cost-rows)
*   [GET Summarize organization usage and costs.deprecated](https://docs.near.ai/api-reference/reporting/summarize-organization-usage-and-costs)

### Billing

*   [POST Get costs by request IDs deprecated](https://docs.near.ai/api-reference/billing/get-costs-by-request-ids)

### Staking Farm

*   [GET Get organization staking farm state deprecated](https://docs.near.ai/api-reference/staking-farm/get-organization-staking-farm-state)
*   [POST Post v1organizations stakingfarmbind deprecated](https://docs.near.ai/api-reference/staking-farm/post-v1organizations-stakingfarmbind)
*   [POST Sync organization staking farm credits deprecated](https://docs.near.ai/api-reference/staking-farm/sync-organization-staking-farm-credits)
*   [GET Get staking farm configuration deprecated](https://docs.near.ai/api-reference/staking-farm/get-staking-farm-configuration)

### Services

*   [GET List platform services (public, no auth)deprecated](https://docs.near.ai/api-reference/services/list-platform-services-public-no-auth)
*   [GET Get platform service by name (public, no auth)deprecated](https://docs.near.ai/api-reference/services/get-platform-service-by-name-public-no-auth)

### Gateway

*   [POST Check API key validity deprecated](https://docs.near.ai/api-reference/gateway/check-api-key-validity)

### Health

*   [GET Health check](https://docs.near.ai/api-reference/health/health-check)

### Feature Requests

*   [GET List aggregated feature requests for admins.deprecated](https://docs.near.ai/api-reference/feature-requests/list-aggregated-feature-requests-for-admins)
*   [POST Submit or update the current user's interest in a feature request target.deprecated](https://docs.near.ai/api-reference/feature-requests/submit-or-update-the-current-users-interest-in-a-feature-request-target)

### Admin

*   [GET List admin access tokens (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-admin-access-tokens-admin-only)
*   [POST Create admin access token (Admin only)deprecated](https://docs.near.ai/api-reference/admin/create-admin-access-token-admin-only)
*   [DEL Delete admin access token (Admin only)deprecated](https://docs.near.ai/api-reference/admin/delete-admin-access-token-admin-only)
*   [GET List AML allowlist entries (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-aml-allowlist-entries-admin-only)
*   [POST Add or update an AML allowlist entry (Admin only)deprecated](https://docs.near.ai/api-reference/admin/add-or-update-an-aml-allowlist-entry-admin-only)
*   [DEL Remove an AML allowlist entry (Admin only)deprecated](https://docs.near.ai/api-reference/admin/remove-an-aml-allowlist-entry-admin-only)
*   [GET List AML reports (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-aml-reports-admin-only)
*   [PATCH Update AML report active status (Admin only)deprecated](https://docs.near.ai/api-reference/admin/update-aml-report-active-status-admin-only)
*   [GET List API keys across all organizations (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-api-keys-across-all-organizations-admin-only)
*   [GET List organization invitation email deliveries (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-organization-invitation-email-deliveries-admin-only)
*   [POST Resend a single organization invitation email (Admin only)deprecated](https://docs.near.ai/api-reference/admin/resend-a-single-organization-invitation-email-admin-only)
*   [GET List all models (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-all-models-admin-only)
*   [PATCH Batch upsert models metadata (Admin only)deprecated](https://docs.near.ai/api-reference/admin/batch-upsert-models-metadata-admin-only)
*   [POST Deprecate a model in favor of another (Admin only)deprecated](https://docs.near.ai/api-reference/admin/deprecate-a-model-in-favor-of-another-admin-only)
*   [GET List scheduled pricing changes (Admin only).deprecated](https://docs.near.ai/api-reference/admin/list-scheduled-pricing-changes-admin-only)
*   [POST Confirm a batch of scheduled pricing changes and notify affected admins (Admin only).deprecated](https://docs.near.ai/api-reference/admin/confirm-a-batch-of-scheduled-pricing-changes-and-notify-affected-admins-admin-only)
*   [POST Preview a batch of scheduled pricing changes without mutating state (Admin only).deprecated](https://docs.near.ai/api-reference/admin/preview-a-batch-of-scheduled-pricing-changes-without-mutating-state-admin-only)
*   [DEL Cancel a pending scheduled pricing change (Admin only).deprecated](https://docs.near.ai/api-reference/admin/cancel-a-pending-scheduled-pricing-change-admin-only)
*   [DEL Delete a model (Admin only)deprecated](https://docs.near.ai/api-reference/admin/delete-a-model-admin-only)
*   [GET List the organizations that may use a model (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-the-organizations-that-may-use-a-model-admin-only)
*   [PUT Grant an organization access to a model (Admin only)deprecated](https://docs.near.ai/api-reference/admin/grant-an-organization-access-to-a-model-admin-only)
*   [DEL Revoke an organization's access to a model (Admin only)deprecated](https://docs.near.ai/api-reference/admin/revoke-an-organizations-access-to-a-model-admin-only)
*   [POST Confirm a planned model deprecation, update the catalog, and notify affected admins.deprecated](https://docs.near.ai/api-reference/admin/confirm-a-planned-model-deprecation-update-the-catalog-and-notify-affected-admins)
*   [POST Preview affected admins for a planned model deprecation (Admin only).deprecated](https://docs.near.ai/api-reference/admin/preview-affected-admins-for-a-planned-model-deprecation-admin-only)
*   [GET Get complete history for a model (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-complete-history-for-a-model-admin-only)
*   [GET List all organizations with pagination (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-all-organizations-with-pagination-admin-only)
*   [GET Get a single organization by id (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-a-single-organization-by-id-admin-only)
*   [GET Get organization concurrent request limit (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-organization-concurrent-request-limit-admin-only)
*   [PATCH Update organization concurrent request limit (Admin only)deprecated](https://docs.near.ai/api-reference/admin/update-organization-concurrent-request-limit-admin-only)
*   [POST Reclassify reviewed legacy consumption. Does not rewrite usage logs, settle invoices, alter limits, or change allocation policy. Dry runs are point-in-time previews; commits revalidate under the organization accounting lock.deprecated](https://docs.near.ai/api-reference/admin/reclassify-reviewed-legacy-consumption-does-not-rewrite-usage-logs-settleinvoices-alter-limits-or-change-allocation-policy-dry-runs-are-point-in-timepreviews;-commits-revalidate-under-the-organization-accounting-lock)
*   [GET Get an organization's effective fallback policy (Admin only).deprecated](https://docs.near.ai/api-reference/admin/get-an-organizations-effective-fallback-policy-admin-only)
*   [PATCH Update an organization's fallback policy (Admin only).deprecated](https://docs.near.ai/api-reference/admin/update-an-organizations-fallback-policy-admin-only)
*   [PATCH Update organization limits (Admin only)deprecated](https://docs.near.ai/api-reference/admin/update-organization-limits-admin-only)
*   [GET Get limits history for an organization (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-limits-history-for-an-organization-admin-only)
*   [GET List members of a specific organization (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-members-of-a-specific-organization-admin-only)
*   [PUT Update an organization member role as a system administrator.deprecated](https://docs.near.ai/api-reference/admin/update-an-organization-member-role-as-a-system-administrator)
*   [GET Get organization metrics (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-organization-metrics-admin-only)
*   [GET Get time series metrics for an organization (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-time-series-metrics-for-an-organization-admin-only)
*   [GET List the models an organization holds grants for (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-the-models-an-organization-holds-grants-for-admin-only)
*   [GET Get an organization's scheduler priority (platform admins only).deprecated](https://docs.near.ai/api-reference/admin/get-an-organizations-scheduler-priority-platform-admins-only)
*   [PATCH Set an organization's scheduler priority (platform admins with write access only).deprecated](https://docs.near.ai/api-reference/admin/set-an-organizations-scheduler-priority-platform-admins-with-write-access-only)
*   [GET Get admin organization staking farm state deprecated](https://docs.near.ai/api-reference/admin/get-admin-organization-staking-farm-state)
*   [POST Sync admin organization staking farm credits deprecated](https://docs.near.ai/api-reference/admin/sync-admin-organization-staking-farm-credits)
*   [GET Get v1adminorganizations usage discount deprecated](https://docs.near.ai/api-reference/admin/get-v1adminorganizations-usage-discount)
*   [PUT Save one immutable discount. Repeating identical terms is idempotent. A different second rule is rejected. Historical corrections run in bounded background batches; consumers should refresh historical snapshots only after status becomes `active`.deprecated](https://docs.near.ai/api-reference/admin/save-one-immutable-discount-repeating-identical-terms-is-idempotent-a-differentsecond-rule-is-rejected-historical-corrections-run-in-bounded-background-batches;consumers-should-refresh-historical-snapshots-only-after-status-becomes-%60active%60)
*   [GET Get organization balance (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-organization-balance-admin-only)
*   [GET Get the platform billing summary (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-the-platform-billing-summary-admin-only)
*   [GET Get the platform infrastructure / fleet burn summary (Admin only)](https://docs.near.ai/api-reference/admin/get-the-platform-infrastructure-fleet-burn-summary-admin-only)
*   [GET Get platform-wide metrics for admin dashboards (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-platform-wide-metrics-for-admin-dashboards-admin-only)
*   [GET Get platform-wide time series for admin dashboards (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-platform-wide-time-series-for-admin-dashboards-admin-only)
*   [GET Get per-model consumption timeseries (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-per-model-consumption-timeseries-admin-only)
*   [GET Get the per-model consumption ranking (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-the-per-model-consumption-ranking-admin-only)
*   [GET Get the per-organization consumption ranking (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-the-per-organization-consumption-ranking-admin-only)
*   [GET Get platform-wide performance timeseries (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-platform-wide-performance-timeseries-admin-only)
*   [GET Get revenue density percentiles (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-revenue-density-percentiles-admin-only)
*   [POST Create platform service (Admin only)deprecated](https://docs.near.ai/api-reference/admin/create-platform-service-admin-only)
*   [PATCH Update platform service (Admin only; display_name, description, cost_per_unit, is_active)deprecated](https://docs.near.ai/api-reference/admin/update-platform-service-admin-only;-display_name-description-cost_per_unit-is_active)
*   [GET List admin settings (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-admin-settings-admin-only)
*   [GET Get one admin setting (Admin only)deprecated](https://docs.near.ai/api-reference/admin/get-one-admin-setting-admin-only)
*   [PATCH Update one admin setting (Admin only)deprecated](https://docs.near.ai/api-reference/admin/update-one-admin-setting-admin-only)
*   [POST Recompute usage_hourly for a UTC window (Admin only)deprecated](https://docs.near.ai/api-reference/admin/recompute-usage_hourly-for-a-utc-window-admin-only)
*   [POST Find erasure records by the erased person's email or user id (Admin session only). The email travels in the body, never the URL. No match is a 200 with an empty list.deprecated](https://docs.near.ai/api-reference/admin/find-erasure-records-by-the-erased-persons-email-or-user-id-admin-session-onlythe-email-travels-in-the-body-never-the-url-no-match-is-a-200-with-an-empty-list)
*   [GET List all registered users with pagination (Admin only)deprecated](https://docs.near.ai/api-reference/admin/list-all-registered-users-with-pagination-admin-only)
*   [POST Erase a user (GDPR Art. 17). Irreversible. Run the preview first. Admin session only.deprecated](https://docs.near.ai/api-reference/admin/erase-a-user-gdpr-art-17-irreversible-run-the-preview-first-admin-session-only)
*   [POST Preview a user erasure: blockers and what would be erased (Admin only, read).deprecated](https://docs.near.ai/api-reference/admin/preview-a-user-erasure:-blockers-and-what-would-be-erased-admin-only-read)

### Credits

*   [GET Get v1adminorganizations credittransferreconciliation deprecated](https://docs.near.ai/api-reference/credits/get-v1adminorganizations-credittransferreconciliation)
*   [GET Get v1adminorganizations policy deprecated](https://docs.near.ai/api-reference/credits/get-v1adminorganizations-policy)
*   [PUT Put v1adminorganizations policy deprecated](https://docs.near.ai/api-reference/credits/put-v1adminorganizations-policy)
*   [POST Post v1organizations credentials deprecated](https://docs.near.ai/api-reference/credits/post-v1organizations-credentials)
*   [DEL Delete v1organizations credentials deprecated](https://docs.near.ai/api-reference/credits/delete-v1organizations-credentials)
*   [POST Post v1organizations credittransfer deprecated](https://docs.near.ai/api-reference/credits/post-v1organizations-credittransfer)
*   [GET Get v1organizations credittransfercapacity deprecated](https://docs.near.ai/api-reference/credits/get-v1organizations-credittransfercapacity)
*   [GET Get v1organizations credittransfers deprecated](https://docs.near.ai/api-reference/credits/get-v1organizations-credittransfers)
*   [GET Get v1organizations credittransfers deprecated](https://docs.near.ai/api-reference/credits/get-v1organizations-credittransfers)

### Decisions

*   [POST Post v1systemone](https://docs.near.ai/api-reference/decisions/post-v1systemone)

### Organization credentials

*   [GET Get v1organizations credentials deprecated](https://docs.near.ai/api-reference/organization-credentials/get-v1organizations-credentials)
*   [PUT Put v1organizations credentials deprecated](https://docs.near.ai/api-reference/organization-credentials/put-v1organizations-credentials)
*   [POST Post v1organizations credentials rotate deprecated](https://docs.near.ai/api-reference/organization-credentials/post-v1organizations-credentials-rotate)

Create chat completion

cURL

```
curl --request POST \
  --url https://cloud-api.near.ai/v1/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '
{
  "messages": [
    {
      "role": "<string>",
      "content": "<string>",
      "name": "<string>",
      "reasoning": "<string>",
      "reasoning_content": "<string>",
      "tool_call_id": "<string>",
      "tool_calls": [
        {
          "function": {
            "arguments": "<string>",
            "name": "<string>"
          },
          "id": "<string>",
          "type": "<string>",
          "extra_content": {
            "google": {
              "thought_signature": "<string>"
            }
          },
          "thought_signature": "<string>"
        }
      ]
    }
  ],
  "model": "<string>",
  "frequency_penalty": 123,
  "max_completion_tokens": 123,
  "max_tokens": 123,
  "n": 123,
  "presence_penalty": 123,
  "service_tier": "<string>",
  "stop": "<string>",
  "stream": true,
  "temperature": 123,
  "top_p": 123
}
'
```

```
import requests

url = "https://cloud-api.near.ai/v1/chat/completions"

payload = {
    "messages": [
        {
            "role": "<string>",
            "content": "<string>",
            "name": "<string>",
            "reasoning": "<string>",
            "reasoning_content": "<string>",
            "tool_call_id": "<string>",
            "tool_calls": [
                {
                    "function": {
                        "arguments": "<string>",
                        "name": "<string>"
                    },
                    "id": "<string>",
                    "type": "<string>",
                    "extra_content": { "google": { "thought_signature": "<string>" } },
                    "thought_signature": "<string>"
                }
            ]
        }
    ],
    "model": "<string>",
    "frequency_penalty": 123,
    "max_completion_tokens": 123,
    "max_tokens": 123,
    "n": 123,
    "presence_penalty": 123,
    "service_tier": "<string>",
    "stop": "<string>",
    "stream": True,
    "temperature": 123,
    "top_p": 123
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.text)
```

```
const options = {
  method: 'POST',
  headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
  body: JSON.stringify({
    messages: [
      {
        role: '<string>',
        content: '<string>',
        name: '<string>',
        reasoning: '<string>',
        reasoning_content: '<string>',
        tool_call_id: '<string>',
        tool_calls: [
          {
            function: {arguments: '<string>', name: '<string>'},
            id: '<string>',
            type: '<string>',
            extra_content: {google: {thought_signature: '<string>'}},
            thought_signature: '<string>'
          }
        ]
      }
    ],
    model: '<string>',
    frequency_penalty: 123,
    max_completion_tokens: 123,
    max_tokens: 123,
    n: 123,
    presence_penalty: 123,
    service_tier: '<string>',
    stop: '<string>',
    stream: true,
    temperature: 123,
    top_p: 123
  })
};

fetch('https://cloud-api.near.ai/v1/chat/completions', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

```
<?php

$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "https://cloud-api.near.ai/v1/chat/completions",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "POST",
  CURLOPT_POSTFIELDS => json_encode([
    'messages' => [
        [
                'role' => '<string>',
                'content' => '<string>',
                'name' => '<string>',
                'reasoning' => '<string>',
                'reasoning_content' => '<string>',
                'tool_call_id' => '<string>',
                'tool_calls' => [
                                [
                                                                'function' => [
                                                                                                                                'arguments' => '<string>',
                                                                                                                                'name' => '<string>'
                                                                ],
                                                                'id' => '<string>',
                                                                'type' => '<string>',
                                                                'extra_content' => [
                                                                                                                                'google' => [
                                                                                                                                                                                                                                                                'thought_signature' => '<string>'
                                                                                                                                ]
                                                                ],
                                                                'thought_signature' => '<string>'
                                ]
                ]
        ]
    ],
    'model' => '<string>',
    'frequency_penalty' => 123,
    'max_completion_tokens' => 123,
    'max_tokens' => 123,
    'n' => 123,
    'presence_penalty' => 123,
    'service_tier' => '<string>',
    'stop' => '<string>',
    'stream' => true,
    'temperature' => 123,
    'top_p' => 123
  ]),
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer <token>",
    "Content-Type: application/json"
  ],
]);

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
  echo "cURL Error #:" . $err;
} else {
  echo $response;
}
```

```
package main

import (
	"fmt"
	"strings"
	"net/http"
	"io"
)

func main() {

	url := "https://cloud-api.near.ai/v1/chat/completions"

	payload := strings.NewReader("{\n  \"messages\": [\n    {\n      \"role\": \"<string>\",\n      \"content\": \"<string>\",\n      \"name\": \"<string>\",\n      \"reasoning\": \"<string>\",\n      \"reasoning_content\": \"<string>\",\n      \"tool_call_id\": \"<string>\",\n      \"tool_calls\": [\n        {\n          \"function\": {\n            \"arguments\": \"<string>\",\n            \"name\": \"<string>\"\n          },\n          \"id\": \"<string>\",\n          \"type\": \"<string>\",\n          \"extra_content\": {\n            \"google\": {\n              \"thought_signature\": \"<string>\"\n            }\n          },\n          \"thought_signature\": \"<string>\"\n        }\n      ]\n    }\n  ],\n  \"model\": \"<string>\",\n  \"frequency_penalty\": 123,\n  \"max_completion_tokens\": 123,\n  \"max_tokens\": 123,\n  \"n\": 123,\n  \"presence_penalty\": 123,\n  \"service_tier\": \"<string>\",\n  \"stop\": \"<string>\",\n  \"stream\": true,\n  \"temperature\": 123,\n  \"top_p\": 123\n}")

	req, _ := http.NewRequest("POST", url, payload)

	req.Header.Add("Authorization", "Bearer <token>")
	req.Header.Add("Content-Type", "application/json")

	res, _ := http.DefaultClient.Do(req)

	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	fmt.Println(string(body))

}
```

```
HttpResponse<String> response = Unirest.post("https://cloud-api.near.ai/v1/chat/completions")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"messages\": [\n    {\n      \"role\": \"<string>\",\n      \"content\": \"<string>\",\n      \"name\": \"<string>\",\n      \"reasoning\": \"<string>\",\n      \"reasoning_content\": \"<string>\",\n      \"tool_call_id\": \"<string>\",\n      \"tool_calls\": [\n        {\n          \"function\": {\n            \"arguments\": \"<string>\",\n            \"name\": \"<string>\"\n          },\n          \"id\": \"<string>\",\n          \"type\": \"<string>\",\n          \"extra_content\": {\n            \"google\": {\n              \"thought_signature\": \"<string>\"\n            }\n          },\n          \"thought_signature\": \"<string>\"\n        }\n      ]\n    }\n  ],\n  \"model\": \"<string>\",\n  \"frequency_penalty\": 123,\n  \"max_completion_tokens\": 123,\n  \"max_tokens\": 123,\n  \"n\": 123,\n  \"presence_penalty\": 123,\n  \"service_tier\": \"<string>\",\n  \"stop\": \"<string>\",\n  \"stream\": true,\n  \"temperature\": 123,\n  \"top_p\": 123\n}")
  .asString();
```

```
require 'uri'
require 'net/http'

url = URI("https://cloud-api.near.ai/v1/chat/completions")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"messages\": [\n    {\n      \"role\": \"<string>\",\n      \"content\": \"<string>\",\n      \"name\": \"<string>\",\n      \"reasoning\": \"<string>\",\n      \"reasoning_content\": \"<string>\",\n      \"tool_call_id\": \"<string>\",\n      \"tool_calls\": [\n        {\n          \"function\": {\n            \"arguments\": \"<string>\",\n            \"name\": \"<string>\"\n          },\n          \"id\": \"<string>\",\n          \"type\": \"<string>\",\n          \"extra_content\": {\n            \"google\": {\n              \"thought_signature\": \"<string>\"\n            }\n          },\n          \"thought_signature\": \"<string>\"\n        }\n      ]\n    }\n  ],\n  \"model\": \"<string>\",\n  \"frequency_penalty\": 123,\n  \"max_completion_tokens\": 123,\n  \"max_tokens\": 123,\n  \"n\": 123,\n  \"presence_penalty\": 123,\n  \"service_tier\": \"<string>\",\n  \"stop\": \"<string>\",\n  \"stream\": true,\n  \"temperature\": 123,\n  \"top_p\": 123\n}"

response = http.request(request)
puts response.read_body
```

200

400

401

402

429

500

```
{
  "choices": [
    {
      "index": 123,
      "message": {
        "role": "<string>",
        "content": "<string>",
        "name": "<string>",
        "reasoning": "<string>",
        "reasoning_content": "<string>",
        "tool_call_id": "<string>",
        "tool_calls": [
          {
            "function": {
              "arguments": "<string>",
              "name": "<string>"
            },
            "id": "<string>",
            "type": "<string>",
            "extra_content": {
              "google": {
                "thought_signature": "<string>"
              }
            },
            "thought_signature": "<string>"
          }
        ]
      },
      "finish_reason": "<string>"
    }
  ],
  "created": 123,
  "id": "<string>",
  "model": "<string>",
  "object": "<string>",
  "usage": {
    "completion_tokens": 123,
    "prompt_tokens": 123,
    "total_tokens": 123,
    "completion_tokens_details": {
      "accepted_prediction_tokens": 123,
      "audio_tokens": 123,
      "reasoning_tokens": 123,
      "rejected_prediction_tokens": 123
    },
    "prompt_tokens_details": {
      "cached_tokens": 123
    },
    "reasoning_tokens": 123
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

Chat

# Create chat completion

Copy page Copy page

Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes. OpenAI-compatible endpoint.

Copy page Copy page

POST

/

v1

/

chat

/

completions

Try it

Create chat completion

cURL

```
curl --request POST \
  --url https://cloud-api.near.ai/v1/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '
{
  "messages": [
    {
      "role": "<string>",
      "content": "<string>",
      "name": "<string>",
      "reasoning": "<string>",
      "reasoning_content": "<string>",
      "tool_call_id": "<string>",
      "tool_calls": [
        {
          "function": {
            "arguments": "<string>",
            "name": "<string>"
          },
          "id": "<string>",
          "type": "<string>",
          "extra_content": {
            "google": {
              "thought_signature": "<string>"
            }
          },
          "thought_signature": "<string>"
        }
      ]
    }
  ],
  "model": "<string>",
  "frequency_penalty": 123,
  "max_completion_tokens": 123,
  "max_tokens": 123,
  "n": 123,
  "presence_penalty": 123,
  "service_tier": "<string>",
  "stop": "<string>",
  "stream": true,
  "temperature": 123,
  "top_p": 123
}
'
```

```
import requests

url = "https://cloud-api.near.ai/v1/chat/completions"

payload = {
    "messages": [
        {
            "role": "<string>",
            "content": "<string>",
            "name": "<string>",
            "reasoning": "<string>",
            "reasoning_content": "<string>",
            "tool_call_id": "<string>",
            "tool_calls": [
                {
                    "function": {
                        "arguments": "<string>",
                        "name": "<string>"
                    },
                    "id": "<string>",
                    "type": "<string>",
                    "extra_content": { "google": { "thought_signature": "<string>" } },
                    "thought_signature": "<string>"
                }
            ]
        }
    ],
    "model": "<string>",
    "frequency_penalty": 123,
    "max_completion_tokens": 123,
    "max_tokens": 123,
    "n": 123,
    "presence_penalty": 123,
    "service_tier": "<string>",
    "stop": "<string>",
    "stream": True,
    "temperature": 123,
    "top_p": 123
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.text)
```

```
const options = {
  method: 'POST',
  headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
  body: JSON.stringify({
    messages: [
      {
        role: '<string>',
        content: '<string>',
        name: '<string>',
        reasoning: '<string>',
        reasoning_content: '<string>',
        tool_call_id: '<string>',
        tool_calls: [
          {
            function: {arguments: '<string>', name: '<string>'},
            id: '<string>',
            type: '<string>',
            extra_content: {google: {thought_signature: '<string>'}},
            thought_signature: '<string>'
          }
        ]
      }
    ],
    model: '<string>',
    frequency_penalty: 123,
    max_completion_tokens: 123,
    max_tokens: 123,
    n: 123,
    presence_penalty: 123,
    service_tier: '<string>',
    stop: '<string>',
    stream: true,
    temperature: 123,
    top_p: 123
  })
};

fetch('https://cloud-api.near.ai/v1/chat/completions', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

```
<?php

$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "https://cloud-api.near.ai/v1/chat/completions",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "POST",
  CURLOPT_POSTFIELDS => json_encode([
    'messages' => [
        [
                'role' => '<string>',
                'content' => '<string>',
                'name' => '<string>',
                'reasoning' => '<string>',
                'reasoning_content' => '<string>',
                'tool_call_id' => '<string>',
                'tool_calls' => [
                                [
                                                                'function' => [
                                                                                                                                'arguments' => '<string>',
                                                                                                                                'name' => '<string>'
                                                                ],
                                                                'id' => '<string>',
                                                                'type' => '<string>',
                                                                'extra_content' => [
                                                                                                                                'google' => [
                                                                                                                                                                                                                                                                'thought_signature' => '<string>'
                                                                                                                                ]
                                                                ],
                                                                'thought_signature' => '<string>'
                                ]
                ]
        ]
    ],
    'model' => '<string>',
    'frequency_penalty' => 123,
    'max_completion_tokens' => 123,
    'max_tokens' => 123,
    'n' => 123,
    'presence_penalty' => 123,
    'service_tier' => '<string>',
    'stop' => '<string>',
    'stream' => true,
    'temperature' => 123,
    'top_p' => 123
  ]),
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer <token>",
    "Content-Type: application/json"
  ],
]);

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
  echo "cURL Error #:" . $err;
} else {
  echo $response;
}
```

```
package main

import (
	"fmt"
	"strings"
	"net/http"
	"io"
)

func main() {

	url := "https://cloud-api.near.ai/v1/chat/completions"

	payload := strings.NewReader("{\n  \"messages\": [\n    {\n      \"role\": \"<string>\",\n      \"content\": \"<string>\",\n      \"name\": \"<string>\",\n      \"reasoning\": \"<string>\",\n      \"reasoning_content\": \"<string>\",\n      \"tool_call_id\": \"<string>\",\n      \"tool_calls\": [\n        {\n          \"function\": {\n            \"arguments\": \"<string>\",\n            \"name\": \"<string>\"\n          },\n          \"id\": \"<string>\",\n          \"type\": \"<string>\",\n          \"extra_content\": {\n            \"google\": {\n              \"thought_signature\": \"<string>\"\n            }\n          },\n          \"thought_signature\": \"<string>\"\n        }\n      ]\n    }\n  ],\n  \"model\": \"<string>\",\n  \"frequency_penalty\": 123,\n  \"max_completion_tokens\": 123,\n  \"max_tokens\": 123,\n  \"n\": 123,\n  \"presence_penalty\": 123,\n  \"service_tier\": \"<string>\",\n  \"stop\": \"<string>\",\n  \"stream\": true,\n  \"temperature\": 123,\n  \"top_p\": 123\n}")

	req, _ := http.NewRequest("POST", url, payload)

	req.Header.Add("Authorization", "Bearer <token>")
	req.Header.Add("Content-Type", "application/json")

	res, _ := http.DefaultClient.Do(req)

	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	fmt.Println(string(body))

}
```

```
HttpResponse<String> response = Unirest.post("https://cloud-api.near.ai/v1/chat/completions")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"messages\": [\n    {\n      \"role\": \"<string>\",\n      \"content\": \"<string>\",\n      \"name\": \"<string>\",\n      \"reasoning\": \"<string>\",\n      \"reasoning_content\": \"<string>\",\n      \"tool_call_id\": \"<string>\",\n      \"tool_calls\": [\n        {\n          \"function\": {\n            \"arguments\": \"<string>\",\n            \"name\": \"<string>\"\n          },\n          \"id\": \"<string>\",\n          \"type\": \"<string>\",\n          \"extra_content\": {\n            \"google\": {\n              \"thought_signature\": \"<string>\"\n            }\n          },\n          \"thought_signature\": \"<string>\"\n        }\n      ]\n    }\n  ],\n  \"model\": \"<string>\",\n  \"frequency_penalty\": 123,\n  \"max_completion_tokens\": 123,\n  \"max_tokens\": 123,\n  \"n\": 123,\n  \"presence_penalty\": 123,\n  \"service_tier\": \"<string>\",\n  \"stop\": \"<string>\",\n  \"stream\": true,\n  \"temperature\": 123,\n  \"top_p\": 123\n}")
  .asString();
```

```
require 'uri'
require 'net/http'

url = URI("https://cloud-api.near.ai/v1/chat/completions")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"messages\": [\n    {\n      \"role\": \"<string>\",\n      \"content\": \"<string>\",\n      \"name\": \"<string>\",\n      \"reasoning\": \"<string>\",\n      \"reasoning_content\": \"<string>\",\n      \"tool_call_id\": \"<string>\",\n      \"tool_calls\": [\n        {\n          \"function\": {\n            \"arguments\": \"<string>\",\n            \"name\": \"<string>\"\n          },\n          \"id\": \"<string>\",\n          \"type\": \"<string>\",\n          \"extra_content\": {\n            \"google\": {\n              \"thought_signature\": \"<string>\"\n            }\n          },\n          \"thought_signature\": \"<string>\"\n        }\n      ]\n    }\n  ],\n  \"model\": \"<string>\",\n  \"frequency_penalty\": 123,\n  \"max_completion_tokens\": 123,\n  \"max_tokens\": 123,\n  \"n\": 123,\n  \"presence_penalty\": 123,\n  \"service_tier\": \"<string>\",\n  \"stop\": \"<string>\",\n  \"stream\": true,\n  \"temperature\": 123,\n  \"top_p\": 123\n}"

response = http.request(request)
puts response.read_body
```

200

400

401

402

429

500

```
{
  "choices": [
    {
      "index": 123,
      "message": {
        "role": "<string>",
        "content": "<string>",
        "name": "<string>",
        "reasoning": "<string>",
        "reasoning_content": "<string>",
        "tool_call_id": "<string>",
        "tool_calls": [
          {
            "function": {
              "arguments": "<string>",
              "name": "<string>"
            },
            "id": "<string>",
            "type": "<string>",
            "extra_content": {
              "google": {
                "thought_signature": "<string>"
              }
            },
            "thought_signature": "<string>"
          }
        ]
      },
      "finish_reason": "<string>"
    }
  ],
  "created": 123,
  "id": "<string>",
  "model": "<string>",
  "object": "<string>",
  "usage": {
    "completion_tokens": 123,
    "prompt_tokens": 123,
    "total_tokens": 123,
    "completion_tokens_details": {
      "accepted_prediction_tokens": 123,
      "audio_tokens": 123,
      "reasoning_tokens": 123,
      "rejected_prediction_tokens": 123
    },
    "prompt_tokens_details": {
      "cached_tokens": 123
    },
    "reasoning_tokens": 123
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

```
{
  "error": {
    "message": "<string>",
    "type": "<string>",
    "code": "<string>",
    "param": "<string>"
  }
}
```

#### Authorizations

[](https://docs.near.ai/api-reference/chat/create-chat-completion#authorization-authorization)

Authorization

string

header

required

API key for programmatic access (Authorization: Bearer sk-<api_key>)

#### Body

application/json

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-messages)

messages

object[]

required

Show child attributes

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-model)

model

string

required

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-frequency-penalty-one-of-0)

frequency_penalty

number<float> | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-max-completion-tokens-one-of-0)

max_completion_tokens

integer<int64> | null

Completion token limit, including reasoning tokens. Takes precedence over `max_tokens`.

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-max-tokens-one-of-0)

max_tokens

integer<int64> | null

Legacy completion token limit. Prefer `max_completion_tokens` for new clients.

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-n-one-of-0)

n

integer<int64> | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-presence-penalty-one-of-0)

presence_penalty

number<float> | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-service-tier-one-of-0)

service_tier

string | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-stop-one-of-1)

stop

string string[]

OpenAI `stop` accepts either a single string or an array of strings.

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-stream-one-of-0)

stream

boolean | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-temperature-one-of-0)

temperature

number<float> | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-top-p-one-of-0)

top_p

number<float> | null

[](https://docs.near.ai/api-reference/chat/create-chat-completion#body-additional-properties)

{key}

any

#### Response

200

application/json

Completion generated successfully

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-choices)

choices

object[]

required

Show child attributes

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-created)

created

integer<int64>

required

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-id)

id

string

required

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-model)

model

string

required

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-object)

object

string

required

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-usage)

usage

object

required

Usage for chat/completions endpoints. Serializes as prompt_tokens, prompt_tokens_details, completion_tokens, completion_tokens_details, total_tokens, reasoning_tokens.

Show child attributes

[](https://docs.near.ai/api-reference/chat/create-chat-completion#response-additional-properties)

{key}

any

Unknown top-level fields from the provider (e.g. system_fingerprint, prompt_logprobs). Re-emitted when serializing so we do not drop them.

[Overview](https://docs.near.ai/api-reference/introduction)[Create text completion](https://docs.near.ai/api-reference/chat/create-text-completion)

[NEAR AI home page![Image 3: dark logo](https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max&auto=format&n=pPLdEuT1c099u7Oo&q=85&s=8a963be37f612240f91743d7a063d5b8)![Image 4: dark logo](https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max&auto=format&n=pPLdEuT1c099u7Oo&q=85&s=8a963be37f612240f91743d7a063d5b8)](https://docs.near.ai/)

[telegram](https://t.me/nearaialpha)[x](https://x.com/near_ai)[github](https://github.com/nearai/docs)

Docs

[Quickstart](https://docs.near.ai/cloud/quickstart)[Models](https://docs.near.ai/cloud/models)[Private Inference](https://docs.near.ai/cloud/private-inference)[Verification](https://docs.near.ai/cloud/verification)[API Reference](https://docs.near.ai/api-reference/introduction)

Community

[Telegram](https://t.me/nearaialpha)[X](https://x.com/near_ai)

More

[Developer Dashboard](https://cloud.near.ai/)[GitHub](https://github.com/nearai/docs)

[telegram](https://t.me/nearaialpha)[x](https://x.com/near_ai)[github](https://github.com/nearai/docs)

[Powered by This documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=near-ai-cloud)

{"docsConfig":{"theme":"mint","$schema":"https://mintlify.com/docs.json","name":"NEAR AI","description":"Documentation for NEAR AI Cloud: private, verifiable AI inference in Trusted Execution Environments through an OpenAI-compatible API.","colors":{"primary":"#0B8FF6","light":"#83D2FA","dark":"#0B8FF6"},"logo":{"light":"https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max\u0026auto=format\u0026n=pPLdEuT1c099u7Oo\u0026q=85\u0026s=8a963be37f612240f91743d7a063d5b8","dark":"https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max\u0026auto=format\u0026n=pPLdEuT1c099u7Oo\u0026q=85\u0026s=8a963be37f612240f91743d7a063d5b8","href":"/"},"favicon":"https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/favicon.svg?fit=max\u0026auto=format\u0026n=pPLdEuT1c099u7Oo\u0026q=85\u0026s=21cf1a0245b8fe066c206f1634b65bf4","appearance":{"default":"dark","strict":true},"background":{"color":{"light":"#000000","dark":"#000000"}},"navbar":{"links":[{"href":"https://cloud.near.ai","label":"Developer Dashboard"}]},"footer":{"socials":{"telegram":"https://t.me/nearaialpha","x":"https://x.com/near_ai","github":"https://github.com/nearai/docs"},"links":[{"header":"Docs","items":[{"label":"Quickstart","href":"https://docs.near.ai/cloud/quickstart"},{"label":"Models","href":"https://docs.near.ai/cloud/models"},{"label":"Private Inference","href":"https://docs.near.ai/cloud/private-inference"},{"label":"Verification","href":"https://docs.near.ai/cloud/verification"},{"label":"API Reference","href":"https://docs.near.ai/api-reference/introduction"}]},{"header":"Community","items":[{"label":"Telegram","href":"https://t.me/nearaialpha"},{"label":"X","href":"https://x.com/near_ai"}]},{"header":"More","items":[{"label":"Developer Dashboard","href":"https://cloud.near.ai"},{"label":"GitHub","href":"https://github.com/nearai/docs"}]}]},"seo":{"metatags":{"og:site_name":"NEAR AI Docs","og:image":"https://docs.near.ai/images/icons/social-card.png","twitter:card":"summary_large_image","twitter:image":"https://docs.near.ai/images/icons/social-card.png"}},"icons":{"library":"lucide"},"styling":{"codeblocks":"dark","latex":false},"contextual":{"options":["copy","view","chatgpt","claude"],"display":"header"},"navigation":{"pages":[]}},"deployment":{"deploymentMetadataValue":{"subdomain":"near-ai-cloud","hasAudioNarration":false,"actualSubdomain":"near-ai-cloud","customDomains":["docs.near.ai"],"gitSource":{"type":"github","owner":"nearai","repo":"docs","deployBranch":"main","contentDirectory":"","isPrivate":false,"mountPath":"","label":""},"entitlements":{},"buildId":"6af7904781a3caf093018e95","clientVersion":"0.0.4142","searchFilterCounts":[{"language":"default","tag":"API Reference","count":158},{"language":"default","tag":"Admin","count":65},{"language":"default","tag":"Documentation","count":40},{"language":"default","tag":"Guides","count":18},{"language":"default","tag":"Private Inference","count":17},{"language":"default","tag":"Users","count":13},{"language":"default","tag":"Integrations","count":11},{"language":"default","tag":"Workspaces","count":10},{"language":"default","tag":"Verification","count":9},{"language":"default","tag":"Credits","count":8}]},"assistantConfig":{"enableAskAiButton":false,"enableStarterQuestions":false,"enableContextualStarterQuestions":false,"enableAskAiSearchBar":true},"basePath":"","hasChatPermissions":false,"hasWebMcpPermissions":false,"toggles":[{"name":"kill-isr","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"custom-rbac-roles","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"agent-mintlify-slack","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"agent-integrations-settings","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"rbac-expansion","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"automations-pr-grouping","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"custom-prefix","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"analytics-v7","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"user-flows-analytics","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"no-publish-flow","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"workos-onboarding","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"snapshot-serving-live","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"stripTemperatureMiddleware","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"support-platform-pylon-zendesk","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"snapshot-serving","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"instant-rollback","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"granular-notifications-server","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"granular-notifications","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"automations-fable","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"fixed-ai-action-pricing","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"automation-resolve-merge-conflict","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"scoped-publishing","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"mintql","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"page-level-analytics","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"editor-version-history-v2","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"billing-page-v2","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"full-page-search","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"workspace-projects","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"assistant-v5","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"fork-pr-previews","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"revalidation-jwt","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"workos-sso-scim","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"hobby-abuse-scan","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"dashboard-inbox","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"workos-signup","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"turbopuffer-dual-write","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"workos-enabled","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"approve-review-flow","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"editor-metadata","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"sso-setup-deadline-banner","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"turbopuffer-serve","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"live-agents","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false},{"name":"llms-txt-v2","enabled":true,"variant":{"name":"disabled","enabled":false,"feature_enabled":true},"impressionData":false}],"googleFontsInlined":false},"customCss":[{"filePath":"style.css","content":":root{--near-black: #000000;--near-white: #f4f0e8;--near-blue: #0b8ff6;--near-blue-light: #83d2fa;--accent-border-hover: rgba(11, 143, 246, 0.4);--doc-warning: #ffc400}.home-lead{margin:0 0 1.5rem;font-size:clamp(1.05rem, 2vw, 1.2rem);line-height:1.75;letter-spacing:-0.01em}.doc-lead{display:flex;justify-content:center;margin:0 0 1.75rem}.doc-button{display:inline-flex;align-items:center;gap:0.5rem;min-height:48px;padding:0 1.75rem;border-radius:10px;background:var(--near-blue);color:#ffffff!important;font-size:1rem;font-weight:600;text-decoration:none!important;border:none;box-shadow:0 4px 14px rgba(11, 143, 246, 0.35);transition:transform 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out}.doc-button:hover{background:var(--near-blue-light);color:var(--near-black)!important;transform:translateY(-1px);box-shadow:0 6px 18px rgba(11, 143, 246, 0.45)}.doc-button:active{transform:translateY(0);box-shadow:0 2px 8px rgba(11, 143, 246, 0.35)}.doc-button:focus-visible{outline:2px solid var(--near-blue);outline-offset:2px}.doc-badge{display:inline-block;padding:0.05rem 0.45rem;border-radius:999px;background:rgba(11, 143, 246, 0.18);border:1px solid var(--accent-border-hover);color:var(--near-blue-light);font-size:0.75rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;vertical-align:middle}"}],"page":{"pagePath":"api-reference/chat/create-chat-completion","slug":"/api-reference/chat/create-chat-completion","pageMetadata":{"title":"Create chat completion","description":"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes.\nOpenAI-compatible endpoint.","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/chat/completions","href":"/api-reference/chat/create-chat-completion","autogeneratedByOpenApi":true},"description":{"compiledSource":"\"use strict\";\nconst {jsx: _jsx} = arguments[0];\nconst {useMDXComponents: _provideComponents} = arguments[0];\nfunction _createMdxContent(props) {\n const _components = {\n p: \"p\",\n ..._provideComponents(),\n ...props.components\n };\n return _jsx(_components.p, {\n children: \"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes.\\nOpenAI-compatible endpoint.\"\n });\n}\nfunction MDXContent(props = {}) {\n const {wrapper: MDXLayout} = {\n ..._provideComponents(),\n ...props.components\n };\n return MDXLayout ? _jsx(MDXLayout, {\n ...props,\n children: _jsx(_createMdxContent, {\n ...props\n })\n }) : _createMdxContent(props);\n}\nreturn {\n default: MDXContent\n};\n","frontmatter":{},"scope":{}},"pageType":"default","mdx":{"mdxSource":{"compiledSource":"\"use strict\";const{Fragment:_Fragment,jsx:_jsx}=arguments[0];const{useMDXComponents:_provideComponents}=arguments[0];function _createMdxContent(props){return _jsx(_Fragment,{})}function MDXContent(props={}){const{wrapper:MDXLayout}={..._provideComponents(),...props.components};return MDXLayout?_jsx(MDXLayout,{...props,children:_jsx(_createMdxContent,{...props})}):_createMdxContent(props)}return{default:MDXContent}","frontmatter":{},"scope":{"codeStyling":"dark","config":{},"pageMetadata":{"title":"Create chat completion","description":"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes.\nOpenAI-compatible endpoint.","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/chat/completions","href":"/api-reference/chat/create-chat-completion","autogeneratedByOpenApi":true}}},"mdxSourceWithNoJs":null},"mdxExtracts":{"tableOfContents":[],"codeExamples":{}},"jsLinks":[],"openApiReferenceData":{"operation":{"tags":["Chat"],"summary":"Create chat completion","description":"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes.\nOpenAI-compatible endpoint.","operationId":"chat_completions","requestBody":"2fbec2a0-912e-414a-b117-517bab93c7bd","responses":{"200":"377fa40d-09db-423b-90cb-40c4d8de3832","400":"abeb38e9-02aa-46c2-8a86-d28ea4a06c04","401":"d7499b81-4ac9-465d-85ba-f470f907f1b5","402":"9157fa5b-0400-4005-8df7-50d86cf4dacd","429":"a4d5e9f4-68cd-4e08-90ee-9138bc156091","500":"abd9d6d6-cd7d-4993-a7d2-e4c97237b00a"},"security":["04394f01-3c11-498b-acee-4f7988fc78a8"],"method":"post","type":"path","servers":["b20ea67f-dfa0-4418-b1dd-5ae390a385a5"],"path":"/v1/chat/completions","baseUrlOptions":["https://cloud-api.near.ai"],"title":"Create chat completion","codeSamples":[],"requiredOnlyExamples":false,"requestExampleType":"generated","responseExampleType":"generated"},"dependencies":{"parameters":{},"requestBody":{"content":{"application/json":{"schema":{"type":"object","required":["model","messages"],"properties":{"messages":{"type":"array","items":{"type":"object","required":["role"],"properties":{"role":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].role","typeLabel":"string"},"content":{"oneOf":[{"type":"null","uniqueKey":"messages.items.[INDEX].content.oneOf.0","typeLabel":"null"},{"type":"string","description":"Content can be text or array of content parts","uniqueKey":"messages.items.[INDEX].content.oneOf.1","typeLabel":"string"},{"type":"array","items":{"oneOf":[{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["text","type"],"properties":{"text":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.0.text","typeLabel":"string"},"type":{"type":"string","enum":["text"],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.0.type","typeLabel":"enum\u003cstring>"},"cache_control":{"description":"Anthropic prompt-caching breakpoint (`{\"type\":\"ephemeral\"}`), forwarded\nverbatim (#666). Without this field serde drops the breakpoint at\ndeserialization, so it never survives the re-serialize in\n`From\u003cMessage> for ChatMessage` to reach the Anthropic converter.\nStripped before any non-Anthropic upstream sees it (see\n`inference_providers::strip_cache_control`). Omitted on the wire when\nabsent so the common (uncached) request is byte-identical to before.","uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.0.cache_control","typeLabel":"any"}},"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.0","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["image_url","type"],"properties":{"image_url":{"oneOf":[{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.image_url.oneOf.0","typeLabel":"string"},{"type":"object","required":["url"],"properties":{"url":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.image_url.oneOf.1.url","typeLabel":"string"}},"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.image_url.oneOf.1","typeLabel":"object"}],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.image_url","typeLabel":"string | object"},"type":{"type":"string","enum":["image_url"],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.type","typeLabel":"enum\u003cstring>"},"cache_control":{"description":"Prompt-caching breakpoint on an image content part (#666). Same\nverbatim forwarding and same non-Anthropic stripping as `Text`.","uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.cache_control","typeLabel":"any"},"detail":{"oneOf":[{"type":"string","uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.detail.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.detail.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1.detail","typeLabel":"string | null"}},"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.1","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["input_audio","type"],"properties":{"input_audio":{"type":"object","description":"OpenAI format: input_audio with data + format","required":["data"],"properties":{"data":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2.input_audio.data","typeLabel":"string"},"format":{"oneOf":[{"type":"string","uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2.input_audio.format.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2.input_audio.format.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2.input_audio.format","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2.input_audio","typeLabel":"object"},"type":{"type":"string","enum":["input_audio"],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2.type","typeLabel":"enum\u003cstring>"}},"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.2","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["audio_url","type"],"properties":{"audio_url":{"oneOf":[{"type":"string","description":"vLLM format: audio_url with url field","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.3.audio_url.oneOf.0","typeLabel":"string"},{"type":"object","description":"vLLM format: audio_url with url field","required":["url"],"properties":{"url":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.3.audio_url.oneOf.1.url","typeLabel":"string"}},"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.3.audio_url.oneOf.1","typeLabel":"object"}],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.3.audio_url","typeLabel":"string | object"},"type":{"type":"string","enum":["audio_url"],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.3.type","typeLabel":"enum\u003cstring>"}},"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.3","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["video_url","type"],"properties":{"type":{"type":"string","enum":["video_url"],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.4.type","typeLabel":"enum\u003cstring>"},"video_url":{"oneOf":[{"type":"string","description":"vLLM format: video_url with url field","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.4.video_url.oneOf.0","typeLabel":"string"},{"type":"object","description":"vLLM format: video_url with url field","required":["url"],"properties":{"url":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.4.video_url.oneOf.1.url","typeLabel":"string"}},"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.4.video_url.oneOf.1","typeLabel":"object"}],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.4.video_url","typeLabel":"string | object"}},"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.4","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["file_id","type"],"properties":{"file_id":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.5.file_id","typeLabel":"string"},"type":{"type":"string","enum":["file"],"isRequired":true,"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.5.type","typeLabel":"enum\u003cstring>"}},"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX].oneOf.5","typeLabel":"object"}],"uniqueKey":"messages.items.[INDEX].content.oneOf.2.items.[INDEX]","typeLabel":"object"},"description":"Content can be text or array of content parts","uniqueKey":"messages.items.[INDEX].content.oneOf.2","typeLabel":"object[]"}],"uniqueKey":"messages.items.[INDEX].content","typeLabel":"null | string | object[]"},"name":{"oneOf":[{"type":"string","uniqueKey":"messages.items.[INDEX].name.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"messages.items.[INDEX].name.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].name","typeLabel":"string | null"},"reasoning":{"oneOf":[{"type":"string","description":"OpenRouter-dialect spelling of the same field. Accepted on input and\nfolded into `reasoning_content` at conversion (see\n[`Message::prior_reasoning`]); a sibling field rather than a serde\nalias so a message carrying both spellings — which our own responses\nmay emit — stays valid instead of failing as a duplicate field. Never\nemitted.","uniqueKey":"messages.items.[INDEX].reasoning.oneOf.0","typeLabel":"string"},{"type":"null","description":"OpenRouter-dialect spelling of the same field. Accepted on input and\nfolded into `reasoning_content` at conversion (see\n[`Message::prior_reasoning`]); a sibling field rather than a serde\nalias so a message carrying both spellings — which our own responses\nmay emit — stays valid instead of failing as a duplicate field. Never\nemitted.","uniqueKey":"messages.items.[INDEX].reasoning.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].reasoning","typeLabel":"string | null"},"reasoning_content":{"oneOf":[{"type":"string","description":"Reasoning the model produced on a *previous* assistant turn, echoed\nback by the client. Thinking models continue their own chain of\nthought across tool calls only when this reaches the engine; without\nthe field serde silently dropped it, so the model re-reasoned from\nscratch after every tool result. Forwarded verbatim to self-hosted and\nattested OpenAI-compatible engines; stripped for strict external\nupstreams (see `inference_providers::strip_reasoning_content`).","uniqueKey":"messages.items.[INDEX].reasoning_content.oneOf.0","typeLabel":"string"},{"type":"null","description":"Reasoning the model produced on a *previous* assistant turn, echoed\nback by the client. Thinking models continue their own chain of\nthought across tool calls only when this reaches the engine; without\nthe field serde silently dropped it, so the model re-reasoned from\nscratch after every tool result. Forwarded verbatim to self-hosted and\nattested OpenAI-compatible engines; stripped for strict external\nupstreams (see `inference_providers::strip_reasoning_content`).","uniqueKey":"messages.items.[INDEX].reasoning_content.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].reasoning_content","typeLabel":"string | null"},"tool_call_id":{"oneOf":[{"type":"string","uniqueKey":"messages.items.[INDEX].tool_call_id.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"messages.items.[INDEX].tool_call_id.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].tool_call_id","typeLabel":"string | null"},"tool_calls":{"oneOf":[{"type":"array","items":{"type":"object","required":["id","type","function"],"properties":{"function":{"type":"object","required":["name","arguments"],"properties":{"arguments":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].function.arguments","typeLabel":"string"},"name":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].function.name","typeLabel":"string"}},"isRequired":true,"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].function","typeLabel":"object"},"id":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].id","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].type","typeLabel":"string"},"extra_content":{"type":"object","properties":{"google":{"type":"object","properties":{"thought_signature":{"type":"string","uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].extra_content.google.thought_signature","typeLabel":"string"}},"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].extra_content.google","typeLabel":"object"}},"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].extra_content","typeLabel":"object"},"thought_signature":{"type":"string","uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX].thought_signature","typeLabel":"string"}},"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0.items.[INDEX]","typeLabel":"object"},"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.0","typeLabel":"object[]"},{"type":"null","items":{"type":"object","required":["id","type","function"],"properties":{"extra_content":{"type":"object","properties":{"google":{"type":"object","properties":{"thought_signature":{"type":"string"}}}}},"thought_signature":{"type":"string"},"function":{"type":"object","required":["name","arguments"],"properties":{"arguments":{"type":"string"},"name":{"type":"string"}}},"id":{"type":"string"},"type":{"type":"string"}}},"uniqueKey":"messages.items.[INDEX].tool_calls.oneOf.1","typeLabel":"null"}],"uniqueKey":"messages.items.[INDEX].tool_calls","typeLabel":"object[] | null"}},"uniqueKey":"messages.items.[INDEX]","typeLabel":"object"},"isRequired":true,"uniqueKey":"messages","typeLabel":"object[]"},"model":{"type":"string","isRequired":true,"uniqueKey":"model","typeLabel":"string"},"frequency_penalty":{"oneOf":[{"type":"number","format":"float","uniqueKey":"frequency_penalty.oneOf.0","typeLabel":"number\u003cfloat>"},{"type":"null","format":"float","uniqueKey":"frequency_penalty.oneOf.1","typeLabel":"null"}],"uniqueKey":"frequency_penalty","typeLabel":"number\u003cfloat> | null"},"max_completion_tokens":{"oneOf":[{"type":"integer","format":"int64","description":"Completion token limit, including reasoning tokens. Takes precedence over `max_tokens`.","uniqueKey":"max_completion_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","description":"Completion token limit, including reasoning tokens. Takes precedence over `max_tokens`.","uniqueKey":"max_completion_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"max_completion_tokens","typeLabel":"integer\u003cint64> | null"},"max_tokens":{"oneOf":[{"type":"integer","format":"int64","description":"Legacy completion token limit. Prefer `max_completion_tokens` for new clients.","uniqueKey":"max_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","description":"Legacy completion token limit. Prefer `max_completion_tokens` for new clients.","uniqueKey":"max_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"max_tokens","typeLabel":"integer\u003cint64> | null"},"n":{"oneOf":[{"type":"integer","format":"int64","uniqueKey":"n.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","uniqueKey":"n.oneOf.1","typeLabel":"null"}],"uniqueKey":"n","typeLabel":"integer\u003cint64> | null"},"presence_penalty":{"oneOf":[{"type":"number","format":"float","uniqueKey":"presence_penalty.oneOf.0","typeLabel":"number\u003cfloat>"},{"type":"null","format":"float","uniqueKey":"presence_penalty.oneOf.1","typeLabel":"null"}],"uniqueKey":"presence_penalty","typeLabel":"number\u003cfloat> | null"},"service_tier":{"oneOf":[{"type":"string","uniqueKey":"service_tier.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"service_tier.oneOf.1","typeLabel":"null"}],"uniqueKey":"service_tier","typeLabel":"string | null"},"stop":{"oneOf":[{"type":"null","uniqueKey":"stop.oneOf.0","typeLabel":"null"},{"type":"string","description":"OpenAI `stop` accepts either a single string or an array of strings.","uniqueKey":"stop.oneOf.1","typeLabel":"string"},{"type":"array","items":{"type":"string","uniqueKey":"stop.oneOf.2.items.[INDEX]","typeLabel":"string"},"description":"OpenAI `stop` accepts either a single string or an array of strings.","uniqueKey":"stop.oneOf.2","typeLabel":"string[]"}],"uniqueKey":"stop","typeLabel":"null | string | string[]"},"stream":{"oneOf":[{"type":"boolean","uniqueKey":"stream.oneOf.0","typeLabel":"boolean"},{"type":"null","uniqueKey":"stream.oneOf.1","typeLabel":"null"}],"uniqueKey":"stream","typeLabel":"boolean | null"},"temperature":{"oneOf":[{"type":"number","format":"float","uniqueKey":"temperature.oneOf.0","typeLabel":"number\u003cfloat>"},{"type":"null","format":"float","uniqueKey":"temperature.oneOf.1","typeLabel":"null"}],"uniqueKey":"temperature","typeLabel":"number\u003cfloat> | null"},"top_p":{"oneOf":[{"type":"number","format":"float","uniqueKey":"top_p.oneOf.0","typeLabel":"number\u003cfloat>"},{"type":"null","format":"float","uniqueKey":"top_p.oneOf.1","typeLabel":"null"}],"uniqueKey":"top_p","typeLabel":"number\u003cfloat> | null"}},"additionalProperties":{"oneOf":[{}],"uniqueKey":"additionalProperties","typeLabel":"any"},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"messages":[{"role":"\u003cstring>","content":"\u003cstring>","name":"\u003cstring>","reasoning":"\u003cstring>","reasoning_content":"\u003cstring>","tool_call_id":"\u003cstring>","tool_calls":[{"function":{"arguments":"\u003cstring>","name":"\u003cstring>"},"id":"\u003cstring>","type":"\u003cstring>","extra_content":{"google":{"thought_signature":"\u003cstring>"}},"thought_signature":"\u003cstring>"}]}],"model":"\u003cstring>","frequency_penalty":123,"max_completion_tokens":123,"max_tokens":123,"n":123,"presence_penalty":123,"service_tier":"\u003cstring>","stop":"\u003cstring>","stream":true,"temperature":123,"top_p":123}}},"exampleType":"generated"}},"required":true,"exampleType":"generated"},"responses":{"377fa40d-09db-423b-90cb-40c4d8de3832":{"description":"Completion generated successfully","content":{"application/json":{"schema":{"type":"object","required":["id","object","created","model","choices","usage"],"properties":{"choices":{"type":"array","items":{"type":"object","required":["index","message"],"properties":{"index":{"type":"integer","format":"int64","isRequired":true,"uniqueKey":"choices.items.[INDEX].index","typeLabel":"integer\u003cint64>"},"message":{"type":"object","required":["role"],"properties":{"role":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.role","typeLabel":"string"},"content":{"oneOf":[{"type":"null","uniqueKey":"choices.items.[INDEX].message.content.oneOf.0","typeLabel":"null"},{"type":"string","description":"Content can be text or array of content parts","uniqueKey":"choices.items.[INDEX].message.content.oneOf.1","typeLabel":"string"},{"type":"array","items":{"oneOf":[{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["text","type"],"properties":{"text":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.0.text","typeLabel":"string"},"type":{"type":"string","enum":["text"],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.0.type","typeLabel":"enum\u003cstring>"},"cache_control":{"description":"Anthropic prompt-caching breakpoint (`{\"type\":\"ephemeral\"}`), forwarded\nverbatim (#666). Without this field serde drops the breakpoint at\ndeserialization, so it never survives the re-serialize in\n`From\u003cMessage> for ChatMessage` to reach the Anthropic converter.\nStripped before any non-Anthropic upstream sees it (see\n`inference_providers::strip_cache_control`). Omitted on the wire when\nabsent so the common (uncached) request is byte-identical to before.","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.0.cache_control","typeLabel":"any"}},"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.0","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["image_url","type"],"properties":{"image_url":{"oneOf":[{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.image_url.oneOf.0","typeLabel":"string"},{"type":"object","required":["url"],"properties":{"url":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.image_url.oneOf.1.url","typeLabel":"string"}},"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.image_url.oneOf.1","typeLabel":"object"}],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.image_url","typeLabel":"string | object"},"type":{"type":"string","enum":["image_url"],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.type","typeLabel":"enum\u003cstring>"},"cache_control":{"description":"Prompt-caching breakpoint on an image content part (#666). Same\nverbatim forwarding and same non-Anthropic stripping as `Text`.","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.cache_control","typeLabel":"any"},"detail":{"oneOf":[{"type":"string","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.detail.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.detail.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1.detail","typeLabel":"string | null"}},"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.1","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["input_audio","type"],"properties":{"input_audio":{"type":"object","description":"OpenAI format: input_audio with data + format","required":["data"],"properties":{"data":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2.input_audio.data","typeLabel":"string"},"format":{"oneOf":[{"type":"string","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2.input_audio.format.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2.input_audio.format.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2.input_audio.format","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2.input_audio","typeLabel":"object"},"type":{"type":"string","enum":["input_audio"],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2.type","typeLabel":"enum\u003cstring>"}},"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.2","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["audio_url","type"],"properties":{"audio_url":{"oneOf":[{"type":"string","description":"vLLM format: audio_url with url field","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.3.audio_url.oneOf.0","typeLabel":"string"},{"type":"object","description":"vLLM format: audio_url with url field","required":["url"],"properties":{"url":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.3.audio_url.oneOf.1.url","typeLabel":"string"}},"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.3.audio_url.oneOf.1","typeLabel":"object"}],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.3.audio_url","typeLabel":"string | object"},"type":{"type":"string","enum":["audio_url"],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.3.type","typeLabel":"enum\u003cstring>"}},"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.3","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["video_url","type"],"properties":{"type":{"type":"string","enum":["video_url"],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.4.type","typeLabel":"enum\u003cstring>"},"video_url":{"oneOf":[{"type":"string","description":"vLLM format: video_url with url field","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.4.video_url.oneOf.0","typeLabel":"string"},{"type":"object","description":"vLLM format: video_url with url field","required":["url"],"properties":{"url":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.4.video_url.oneOf.1.url","typeLabel":"string"}},"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.4.video_url.oneOf.1","typeLabel":"object"}],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.4.video_url","typeLabel":"string | object"}},"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.4","typeLabel":"object"},{"type":"object","description":"Content part (text, image, audio, video, file)\nSupports both OpenAI format (input_audio) and vLLM format (audio_url, video_url)","required":["file_id","type"],"properties":{"file_id":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.5.file_id","typeLabel":"string"},"type":{"type":"string","enum":["file"],"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.5.type","typeLabel":"enum\u003cstring>"}},"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX].oneOf.5","typeLabel":"object"}],"uniqueKey":"choices.items.[INDEX].message.content.oneOf.2.items.[INDEX]","typeLabel":"object"},"description":"Content can be text or array of content parts","uniqueKey":"choices.items.[INDEX].message.content.oneOf.2","typeLabel":"object[]"}],"uniqueKey":"choices.items.[INDEX].message.content","typeLabel":"null | string | object[]"},"name":{"oneOf":[{"type":"string","uniqueKey":"choices.items.[INDEX].message.name.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"choices.items.[INDEX].message.name.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.name","typeLabel":"string | null"},"reasoning":{"oneOf":[{"type":"string","description":"OpenRouter-dialect spelling of the same field. Accepted on input and\nfolded into `reasoning_content` at conversion (see\n[`Message::prior_reasoning`]); a sibling field rather than a serde\nalias so a message carrying both spellings — which our own responses\nmay emit — stays valid instead of failing as a duplicate field. Never\nemitted.","uniqueKey":"choices.items.[INDEX].message.reasoning.oneOf.0","typeLabel":"string"},{"type":"null","description":"OpenRouter-dialect spelling of the same field. Accepted on input and\nfolded into `reasoning_content` at conversion (see\n[`Message::prior_reasoning`]); a sibling field rather than a serde\nalias so a message carrying both spellings — which our own responses\nmay emit — stays valid instead of failing as a duplicate field. Never\nemitted.","uniqueKey":"choices.items.[INDEX].message.reasoning.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.reasoning","typeLabel":"string | null"},"reasoning_content":{"oneOf":[{"type":"string","description":"Reasoning the model produced on a *previous* assistant turn, echoed\nback by the client. Thinking models continue their own chain of\nthought across tool calls only when this reaches the engine; without\nthe field serde silently dropped it, so the model re-reasoned from\nscratch after every tool result. Forwarded verbatim to self-hosted and\nattested OpenAI-compatible engines; stripped for strict external\nupstreams (see `inference_providers::strip_reasoning_content`).","uniqueKey":"choices.items.[INDEX].message.reasoning_content.oneOf.0","typeLabel":"string"},{"type":"null","description":"Reasoning the model produced on a *previous* assistant turn, echoed\nback by the client. Thinking models continue their own chain of\nthought across tool calls only when this reaches the engine; without\nthe field serde silently dropped it, so the model re-reasoned from\nscratch after every tool result. Forwarded verbatim to self-hosted and\nattested OpenAI-compatible engines; stripped for strict external\nupstreams (see `inference_providers::strip_reasoning_content`).","uniqueKey":"choices.items.[INDEX].message.reasoning_content.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.reasoning_content","typeLabel":"string | null"},"tool_call_id":{"oneOf":[{"type":"string","uniqueKey":"choices.items.[INDEX].message.tool_call_id.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"choices.items.[INDEX].message.tool_call_id.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.tool_call_id","typeLabel":"string | null"},"tool_calls":{"oneOf":[{"type":"array","items":{"type":"object","required":["id","type","function"],"properties":{"function":{"type":"object","required":["name","arguments"],"properties":{"arguments":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].function.arguments","typeLabel":"string"},"name":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].function.name","typeLabel":"string"}},"isRequired":true,"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].function","typeLabel":"object"},"id":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].id","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].type","typeLabel":"string"},"extra_content":{"type":"object","properties":{"google":{"type":"object","properties":{"thought_signature":{"type":"string","uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].extra_content.google.thought_signature","typeLabel":"string"}},"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].extra_content.google","typeLabel":"object"}},"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].extra_content","typeLabel":"object"},"thought_signature":{"type":"string","uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX].thought_signature","typeLabel":"string"}},"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0.items.[INDEX]","typeLabel":"object"},"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.0","typeLabel":"object[]"},{"type":"null","items":{"type":"object","required":["id","type","function"],"properties":{"extra_content":{"type":"object","properties":{"google":{"type":"object","properties":{"thought_signature":{"type":"string"}}}}},"thought_signature":{"type":"string"},"function":{"type":"object","required":["name","arguments"],"properties":{"arguments":{"type":"string"},"name":{"type":"string"}}},"id":{"type":"string"},"type":{"type":"string"}}},"uniqueKey":"choices.items.[INDEX].message.tool_calls.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].message.tool_calls","typeLabel":"object[] | null"}},"isRequired":true,"uniqueKey":"choices.items.[INDEX].message","typeLabel":"object"},"finish_reason":{"oneOf":[{"type":"string","uniqueKey":"choices.items.[INDEX].finish_reason.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"choices.items.[INDEX].finish_reason.oneOf.1","typeLabel":"null"}],"uniqueKey":"choices.items.[INDEX].finish_reason","typeLabel":"string | null"}},"uniqueKey":"choices.items.[INDEX]","typeLabel":"object"},"isRequired":true,"uniqueKey":"choices","typeLabel":"object[]"},"created":{"type":"integer","format":"int64","isRequired":true,"uniqueKey":"created","typeLabel":"integer\u003cint64>"},"id":{"type":"string","isRequired":true,"uniqueKey":"id","typeLabel":"string"},"model":{"type":"string","isRequired":true,"uniqueKey":"model","typeLabel":"string"},"object":{"type":"string","isRequired":true,"uniqueKey":"object","typeLabel":"string"},"usage":{"type":"object","description":"Usage for chat/completions endpoints.\nSerializes as prompt_tokens, prompt_tokens_details, completion_tokens, completion_tokens_details, total_tokens, reasoning_tokens.","required":["prompt_tokens","completion_tokens","total_tokens"],"properties":{"completion_tokens":{"type":"integer","format":"int32","isRequired":true,"uniqueKey":"usage.completion_tokens","typeLabel":"integer\u003cint32>"},"prompt_tokens":{"type":"integer","format":"int32","isRequired":true,"uniqueKey":"usage.prompt_tokens","typeLabel":"integer\u003cint32>"},"total_tokens":{"type":"integer","format":"int32","isRequired":true,"uniqueKey":"usage.total_tokens","typeLabel":"integer\u003cint32>"},"completion_tokens_details":{"oneOf":[{"type":"null","uniqueKey":"usage.completion_tokens_details.oneOf.0","typeLabel":"null"},{"type":"object","description":"Breakdown of `completion_tokens`. `reasoning_tokens` here is the\nstandard location of the reasoning count, present when the model\nreported one.","properties":{"accepted_prediction_tokens":{"oneOf":[{"type":"integer","format":"int64","uniqueKey":"usage.completion_tokens_details.oneOf.1.accepted_prediction_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","uniqueKey":"usage.completion_tokens_details.oneOf.1.accepted_prediction_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"usage.completion_tokens_details.oneOf.1.accepted_prediction_tokens","typeLabel":"integer\u003cint64> | null"},"audio_tokens":{"oneOf":[{"type":"integer","format":"int64","uniqueKey":"usage.completion_tokens_details.oneOf.1.audio_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","uniqueKey":"usage.completion_tokens_details.oneOf.1.audio_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"usage.completion_tokens_details.oneOf.1.audio_tokens","typeLabel":"integer\u003cint64> | null"},"reasoning_tokens":{"oneOf":[{"type":"integer","format":"int64","description":"Tokens spent on reasoning.","uniqueKey":"usage.completion_tokens_details.oneOf.1.reasoning_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","description":"Tokens spent on reasoning.","uniqueKey":"usage.completion_tokens_details.oneOf.1.reasoning_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"usage.completion_tokens_details.oneOf.1.reasoning_tokens","typeLabel":"integer\u003cint64> | null"},"rejected_prediction_tokens":{"oneOf":[{"type":"integer","format":"int64","uniqueKey":"usage.completion_tokens_details.oneOf.1.rejected_prediction_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","uniqueKey":"usage.completion_tokens_details.oneOf.1.rejected_prediction_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"usage.completion_tokens_details.oneOf.1.rejected_prediction_tokens","typeLabel":"integer\u003cint64> | null"}},"uniqueKey":"usage.completion_tokens_details.oneOf.1","typeLabel":"object"}],"uniqueKey":"usage.completion_tokens_details","typeLabel":"null | object"},"prompt_tokens_details":{"oneOf":[{"type":"null","uniqueKey":"usage.prompt_tokens_details.oneOf.0","typeLabel":"null"},{"type":"object","required":["cached_tokens"],"properties":{"cached_tokens":{"type":"integer","format":"int64","isRequired":true,"uniqueKey":"usage.prompt_tokens_details.oneOf.1.cached_tokens","typeLabel":"integer\u003cint64>"}},"uniqueKey":"usage.prompt_tokens_details.oneOf.1","typeLabel":"object"}],"uniqueKey":"usage.prompt_tokens_details","typeLabel":"null | object"},"reasoning_tokens":{"oneOf":[{"type":"integer","format":"int64","description":"Deprecated: use `completion_tokens_details.reasoning_tokens`. Top-level\nreasoning count as reported by some self-hosted engines; kept for\nexisting readers.","deprecated":true,"uniqueKey":"usage.reasoning_tokens.oneOf.0","typeLabel":"integer\u003cint64>"},{"type":"null","format":"int64","description":"Deprecated: use `completion_tokens_details.reasoning_tokens`. Top-level\nreasoning count as reported by some self-hosted engines; kept for\nexisting readers.","deprecated":true,"uniqueKey":"usage.reasoning_tokens.oneOf.1","typeLabel":"null"}],"uniqueKey":"usage.reasoning_tokens","typeLabel":"integer\u003cint64> | null"}},"isRequired":true,"uniqueKey":"usage","typeLabel":"object"}},"additionalProperties":{"description":"Unknown top-level fields from the provider (e.g. system_fingerprint, prompt_logprobs).\nRe-emitted when serializing so we do not drop them.","uniqueKey":"additionalProperties","typeLabel":"any"},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"choices":[{"index":123,"message":{"role":"\u003cstring>","content":"\u003cstring>","name":"\u003cstring>","reasoning":"\u003cstring>","reasoning_content":"\u003cstring>","tool_call_id":"\u003cstring>","tool_calls":[{"function":{"arguments":"\u003cstring>","name":"\u003cstring>"},"id":"\u003cstring>","type":"\u003cstring>","extra_content":{"google":{"thought_signature":"\u003cstring>"}},"thought_signature":"\u003cstring>"}]},"finish_reason":"\u003cstring>"}],"created":123,"id":"\u003cstring>","model":"\u003cstring>","object":"\u003cstring>","usage":{"completion_tokens":123,"prompt_tokens":123,"total_tokens":123,"completion_tokens_details":{"accepted_prediction_tokens":123,"audio_tokens":123,"reasoning_tokens":123,"rejected_prediction_tokens":123},"prompt_tokens_details":{"cached_tokens":123},"reasoning_tokens":123}}}},"exampleType":"generated"}},"exampleType":"generated"},"abeb38e9-02aa-46c2-8a86-d28ea4a06c04":{"description":"Invalid request parameters","content":{"application/json":{"schema":{"type":"object","required":["error"],"properties":{"error":{"type":"object","required":["message","type"],"properties":{"message":{"type":"string","isRequired":true,"uniqueKey":"error.message","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"error.type","typeLabel":"string"},"code":{"oneOf":[{"type":"string","uniqueKey":"error.code.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.code.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.code","typeLabel":"string | null"},"param":{"oneOf":[{"type":"string","uniqueKey":"error.param.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.param.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.param","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"error","typeLabel":"object"}},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"error":{"message":"\u003cstring>","type":"\u003cstring>","code":"\u003cstring>","param":"\u003cstring>"}}}},"exampleType":"generated"}},"exampleType":"generated"},"d7499b81-4ac9-465d-85ba-f470f907f1b5":{"description":"Invalid or missing API key","content":{"application/json":{"schema":{"type":"object","required":["error"],"properties":{"error":{"type":"object","required":["message","type"],"properties":{"message":{"type":"string","isRequired":true,"uniqueKey":"error.message","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"error.type","typeLabel":"string"},"code":{"oneOf":[{"type":"string","uniqueKey":"error.code.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.code.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.code","typeLabel":"string | null"},"param":{"oneOf":[{"type":"string","uniqueKey":"error.param.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.param.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.param","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"error","typeLabel":"object"}},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"error":{"message":"\u003cstring>","type":"\u003cstring>","code":"\u003cstring>","param":"\u003cstring>"}}}},"exampleType":"generated"}},"exampleType":"generated"},"9157fa5b-0400-4005-8df7-50d86cf4dacd":{"description":"Insufficient credits","content":{"application/json":{"schema":{"type":"object","required":["error"],"properties":{"error":{"type":"object","required":["message","type"],"properties":{"message":{"type":"string","isRequired":true,"uniqueKey":"error.message","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"error.type","typeLabel":"string"},"code":{"oneOf":[{"type":"string","uniqueKey":"error.code.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.code.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.code","typeLabel":"string | null"},"param":{"oneOf":[{"type":"string","uniqueKey":"error.param.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.param.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.param","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"error","typeLabel":"object"}},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"error":{"message":"\u003cstring>","type":"\u003cstring>","code":"\u003cstring>","param":"\u003cstring>"}}}},"exampleType":"generated"}},"exampleType":"generated"},"a4d5e9f4-68cd-4e08-90ee-9138bc156091":{"description":"Rate limited or overloaded — retry with backoff. Check error.type: rate_limit_exceeded or service_overloaded.","content":{"application/json":{"schema":{"type":"object","required":["error"],"properties":{"error":{"type":"object","required":["message","type"],"properties":{"message":{"type":"string","isRequired":true,"uniqueKey":"error.message","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"error.type","typeLabel":"string"},"code":{"oneOf":[{"type":"string","uniqueKey":"error.code.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.code.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.code","typeLabel":"string | null"},"param":{"oneOf":[{"type":"string","uniqueKey":"error.param.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.param.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.param","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"error","typeLabel":"object"}},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"error":{"message":"\u003cstring>","type":"\u003cstring>","code":"\u003cstring>","param":"\u003cstring>"}}}},"exampleType":"generated"}},"exampleType":"generated"},"abd9d6d6-cd7d-4993-a7d2-e4c97237b00a":{"description":"Server error","content":{"application/json":{"schema":{"type":"object","required":["error"],"properties":{"error":{"type":"object","required":["message","type"],"properties":{"message":{"type":"string","isRequired":true,"uniqueKey":"error.message","typeLabel":"string"},"type":{"type":"string","isRequired":true,"uniqueKey":"error.type","typeLabel":"string"},"code":{"oneOf":[{"type":"string","uniqueKey":"error.code.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.code.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.code","typeLabel":"string | null"},"param":{"oneOf":[{"type":"string","uniqueKey":"error.param.oneOf.0","typeLabel":"string"},{"type":"null","uniqueKey":"error.param.oneOf.1","typeLabel":"null"}],"uniqueKey":"error.param","typeLabel":"string | null"}},"isRequired":true,"uniqueKey":"error","typeLabel":"object"}},"uniqueKey":"","typeLabel":"object"},"examples":{"Example":{"title":"Example","value":{"error":{"message":"\u003cstring>","type":"\u003cstring>","code":"\u003cstring>","param":"\u003cstring>"}}}},"exampleType":"generated"}},"exampleType":"generated"}},"security":{"04394f01-3c11-498b-acee-4f7988fc78a8":{"api_key":{"type":"http","scheme":"bearer","bearerFormat":"api_key","description":"API key for programmatic access (Authorization: Bearer sk-\u003capi_key>)","scopes":[],"schemeName":"api_key"}}},"servers":{"b20ea67f-dfa0-4418-b1dd-5ae390a385a5":{"url":"https://cloud-api.near.ai","description":"NEAR AI Cloud"}},"processedSecurityOptions":[{"schemes":[{"scheme":{"type":"http","scheme":"bearer","bearerFormat":"api_key","description":"API key for programmatic access (Authorization: Bearer sk-\u003capi_key>)","scopes":[],"schemeName":"api_key"},"schema":{"title":"Bearer Auth","type":"string","isRequired":true,"description":"API key for programmatic access (Authorization: Bearer sk-\u003capi_key>)","format":"bearer","typeLabel":"string\u003cbearer>","deprecated":false},"schemeName":"api_key","name":"Authorization"}],"title":"api_key"}]},"originalFileLocation":"api-reference/openapi.json"},"subdomain":"near-ai-cloud","siteName":"NEAR AI","title":"Create chat completion - NEAR AI","navMaps":{"firstHrefInVersion":{},"firstHrefInLanguage":{}},"lastModified":"2026-11-12T13:47:17.296Z","originalFileLocation":"api-reference/chat/create-chat-completion.mdx"},"headHtml":"\u003cscript data-mint-head>(function(){var d=document.documentElement,p=\"dark\";if(!p){try{p=localStorage.getItem(\"isDarkMode\")}catch(e){}if(p==='true')p='dark';else if(p==='false')p='light';if(p!=='light'\u0026\u0026p!=='dark'\u0026\u0026p!=='system')p=\"dark\"}var r=p==='system'?(matchMedia(\"(prefers-color-scheme: dark)\").matches?'dark':'light'):p;d.classList.remove(r==='dark'?'light':'dark');d.classList.add(r);d.setAttribute(\"data-theme-preference\",p)})();\u003c/script>\u003cmeta data-mint-head name=\"description\" content=\"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes. OpenAI-compatible endpoint.\">\u003cmeta data-mint-head name=\"application-name\" content=\"NEAR AI\">\u003cmeta data-mint-head name=\"generator\" content=\"Mintlify\">\u003clink data-mint-head rel=\"icon\" type=\"image/png\" sizes=\"192x192\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon/android-chrome-192x192.png\" media=\"(prefers-color-scheme: light)\">\u003clink data-mint-head rel=\"apple-touch-icon\" type=\"image/png\" sizes=\"180x180\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon/apple-touch-icon.png\">\u003clink data-mint-head rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon/favicon-16x16.png\" media=\"(prefers-color-scheme: light)\">\u003clink data-mint-head rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon/favicon-32x32.png\" media=\"(prefers-color-scheme: light)\">\u003clink data-mint-head rel=\"shortcut icon\" type=\"image/x-icon\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon/favicon.ico\" media=\"(prefers-color-scheme: light)\">\u003clink data-mint-head rel=\"icon\" type=\"image/png\" sizes=\"192x192\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon-dark/android-chrome-192x192.png\" media=\"(prefers-color-scheme: dark)\">\u003clink data-mint-head rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon-dark/favicon-16x16.png\" media=\"(prefers-color-scheme: dark)\">\u003clink data-mint-head rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon-dark/favicon-32x32.png\" media=\"(prefers-color-scheme: dark)\">\u003clink data-mint-head rel=\"shortcut icon\" type=\"image/x-icon\" href=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon-dark/favicon.ico\" media=\"(prefers-color-scheme: dark)\">\u003cmeta data-mint-head property=\"og:title\" content=\"Create chat completion - NEAR AI\">\u003cmeta data-mint-head property=\"og:description\" content=\"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes. OpenAI-compatible endpoint.\">\u003cmeta data-mint-head property=\"og:site_name\" content=\"NEAR AI Docs\">\u003cmeta data-mint-head property=\"og:url\" content=\"https://docs.near.ai/api-reference/chat/create-chat-completion\">\u003cmeta data-mint-head property=\"og:type\" content=\"website\">\u003cmeta data-mint-head property=\"og:image\" content=\"https://docs.near.ai/images/icons/social-card.png\">\u003cmeta data-mint-head property=\"og:image:width\" content=\"1200\">\u003cmeta data-mint-head property=\"og:image:height\" content=\"630\">\u003cmeta data-mint-head name=\"twitter:card\" content=\"summary_large_image\">\u003cmeta data-mint-head name=\"twitter:title\" content=\"Create chat completion - NEAR AI\">\u003cmeta data-mint-head name=\"twitter:description\" content=\"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes. OpenAI-compatible endpoint.\">\u003cmeta data-mint-head name=\"twitter:image\" content=\"https://docs.near.ai/images/icons/social-card.png\">\u003cmeta data-mint-head name=\"twitter:image:width\" content=\"1200\">\u003cmeta data-mint-head name=\"twitter:image:height\" content=\"630\">\u003cmeta data-mint-head name=\"msapplication-config\" content=\"/mintlify-assets/_mintlify/favicons/near-ai-cloud/bPg3CNUSTkDdwz7a/_generated/favicon/browserconfig.xml\">\u003cmeta data-mint-head name=\"apple-mobile-web-app-title\" content=\"NEAR AI\">\u003cmeta data-mint-head name=\"msapplication-TileColor\" content=\"#0B8FF6\">\u003clink data-mint-head rel=\"canonical\" href=\"https://docs.near.ai/api-reference/chat/create-chat-completion\">\u003clink data-mint-head rel=\"alternate\" type=\"application/xml\" href=\"/sitemap.xml\">\u003clink data-mint-head rel=\"alternate\" type=\"text/markdown\" href=\"/api-reference/chat/create-chat-completion.md\">\u003cscript data-mint-head type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@graph\":[{\"@type\":\"Organization\",\"@id\":\"https://docs.near.ai/#organization\",\"name\":\"NEAR AI\",\"url\":\"https://docs.near.ai\",\"logo\":{\"@type\":\"ImageObject\",\"url\":\"https://mintcdn.com/near-ai-cloud/pPLdEuT1c099u7Oo/logo/nearAI-logo.svg?fit=max\u0026auto=format\u0026n=pPLdEuT1c099u7Oo\u0026q=85\u0026s=8a963be37f612240f91743d7a063d5b8\"}},{\"@type\":\"WebSite\",\"@id\":\"https://docs.near.ai#website\",\"name\":\"NEAR AI\",\"url\":\"https://docs.near.ai\",\"publisher\":{\"@id\":\"https://docs.near.ai/#organization\"}},{\"@type\":\"WebPage\",\"@id\":\"https://docs.near.ai/api-reference/chat/create-chat-completion#webpage\",\"url\":\"https://docs.near.ai/api-reference/chat/create-chat-completion\",\"name\":\"Create chat completion\",\"description\":\"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes. OpenAI-compatible endpoint.\",\"dateModified\":\"2026-11-12T13:47:17.296Z\",\"isPartOf\":{\"@id\":\"https://docs.near.ai#website\"},\"breadcrumb\":{\"@id\":\"https://docs.near.ai/api-reference/chat/create-chat-completion#breadcrumb\"}},{\"@type\":\"BreadcrumbList\",\"@id\":\"https://docs.near.ai/api-reference/chat/create-chat-completion#breadcrumb\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"NEAR AI\",\"item\":\"https://docs.near.ai\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Create chat completion\",\"item\":\"https://docs.near.ai/api-reference/chat/create-chat-completion\"}]},{\"@type\":[\"TechArticle\",\"APIReference\"],\"@id\":\"https://docs.near.ai/api-reference/chat/create-chat-completion#apireference\",\"headline\":\"Create chat completion\",\"name\":\"Create chat completion\",\"description\":\"Generate AI model responses for chat conversations. Supports both streaming and non-streaming modes. OpenAI-compatible endpoint.\",\"url\":\"https://docs.near.ai/api-reference/chat/create-chat-completion\",\"mainEntityOfPage\":{\"@id\":\"https://docs.near.ai/api-reference/chat/create-chat-completion#webpage\"},\"image\":\"https://docs.near.ai/images/icons/social-card.png\",\"dateModified\":\"2026-11-12T13:47:17.296Z\",\"publisher\":{\"@id\":\"https://docs.near.ai/#organization\"},\"isPartOf\":{\"@id\":\"https://docs.near.ai#website\"}}]}\u003c/script>\u003cscript data-mint-head type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"WebSite\",\"name\":\"NEAR AI\",\"publisher\":{\"@type\":\"Organization\",\"name\":\"NEAR AI\"},\"provider\":{\"@type\":\"Organization\",\"name\":\"Mintlify\",\"url\":\"https://mintlify.com\"}}\u003c/script>","agentPointerHref":"/api-reference/chat/create-chat-completion.md","siteName":"NEAR AI","nav":{"global":null,"tabs":[{"tab":"Documentation","icon":"book-open","pages":[{"title":"Documentation","href":""}]},{"tab":"API Reference","icon":"braces","groups":[{"group":"Getting Started","pages":[{"title":"API Reference","sidebarTitle":"Overview","description":"OpenAI-compatible REST API for private, verifiable AI inference on NEAR AI Cloud","icon":"braces","href":"/api-reference/introduction"}]},{"group":"Chat","pages":[{"title":"Create chat completion","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/chat/completions","href":"/api-reference/chat/create-chat-completion"},{"title":"Create text completion","description":"Generate AI model responses for text prompts. OpenAI-compatible endpoint.","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/completions","href":"/api-reference/chat/create-text-completion"},{"title":"List available models","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/models","href":"/api-reference/chat/list-available-models"}]},{"group":"Responses","pages":[{"title":"Create response","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/responses","href":"/api-reference/responses/create-response"}]},{"group":"Models","pages":[{"title":"List models with pricing","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/model/list","href":"/api-reference/models/list-models-with-pricing"},{"title":"Get model details","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/model/{model_name}","href":"/api-reference/models/get-model-details"}]},{"group":"Images","pages":[{"title":"Edit images from a text prompt and image","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/images/edits","href":"/api-reference/images/edit-images-from-a-text-prompt-and-image"},{"title":"Generate images from text prompt","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/images/generations","href":"/api-reference/images/generate-images-from-text-prompt"}]},{"group":"Audio","pages":[{"title":"Audio transcription endpoint","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/audio/transcriptions","href":"/api-reference/audio/audio-transcription-endpoint"}]},{"group":"Rerank","pages":[{"title":"Document reranking endpoint","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/rerank","href":"/api-reference/rerank/document-reranking-endpoint"}]},{"group":"Score","pages":[{"title":"Text similarity scoring endpoint","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/score","href":"/api-reference/score/text-similarity-scoring-endpoint"}]},{"group":"Privacy","pages":[{"title":"Post v1privacyclassify","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/privacy/classify","href":"/api-reference/privacy/post-v1privacyclassify"},{"title":"Post v1privacyredact","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/privacy/redact","href":"/api-reference/privacy/post-v1privacyredact"}]},{"group":"Attestation","pages":[{"title":"Get Intel Trust Authority attestation token","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/attestation/ita-token","href":"/api-reference/attestation/get-intel-trust-authority-attestation-token"},{"title":"Which attested backup-provider trust inputs are live","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/attestation/pins","href":"/api-reference/attestation/which-attested-backup-provider-trust-inputs-are-live"},{"title":"Get attestation report","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/attestation/report","href":"/api-reference/attestation/get-attestation-report"},{"title":"Get completion or Responses API signature","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/signature/{chat_id}","href":"/api-reference/attestation/get-completion-or-responses-api-signature"}]},{"group":"Users","pages":[{"title":"Confirm a contact email (public endpoint)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/users/contact-email/verify","href":"/api-reference/users/confirm-a-contact-email-public-endpoint"},{"title":"Get current user","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/users/me","href":"/api-reference/users/get-current-user"},{"title":"Create a new access token","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/users/me/access-tokens","href":"/api-reference/users/create-a-new-access-token"},{"title":"Add a contact email","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/users/me/contact-email","href":"/api-reference/users/add-a-contact-email"},{"title":"Remove the contact email","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/users/me/contact-email","href":"/api-reference/users/remove-the-contact-email"},{"title":"List pending invitations for the current user","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/users/me/invitations","href":"/api-reference/users/list-pending-invitations-for-the-current-user"},{"title":"Accept an organization invitation","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/users/me/invitations/{invitation_id}/accept","href":"/api-reference/users/accept-an-organization-invitation"},{"title":"Decline an organization invitation","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/users/me/invitations/{invitation_id}/decline","href":"/api-reference/users/decline-an-organization-invitation"},{"title":"Update current user's profile","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/users/me/profile","href":"/api-reference/users/update-current-users-profile"},{"title":"Get user's refresh tokens","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/users/me/refresh-tokens","href":"/api-reference/users/get-users-refresh-tokens"},{"title":"Revoke a user refresh token","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/users/me/refresh-tokens/{refresh_token_id}","href":"/api-reference/users/revoke-a-user-refresh-token"},{"title":"Get current user's account eligibility status","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/users/me/status","href":"/api-reference/users/get-current-users-account-eligibility-status"},{"title":"Revoke all tokens for a user","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/users/me/tokens","href":"/api-reference/users/revoke-all-tokens-for-a-user"}]},{"group":"Organizations","pages":[{"title":"List organizations","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations","href":"/api-reference/organizations/list-organizations"},{"title":"Create a new organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations","href":"/api-reference/organizations/create-a-new-organization"},{"title":"Get organization by ID","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}","href":"/api-reference/organizations/get-organization-by-id"},{"title":"Update organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/organizations/{org_id}","href":"/api-reference/organizations/update-organization"},{"title":"Delete organization (owner only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/organizations/{org_id}","href":"/api-reference/organizations/delete-organization-owner-only"},{"title":"Get organization settings","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/settings","href":"/api-reference/organizations/get-organization-settings"},{"title":"Patch organization settings","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/organizations/{org_id}/settings","href":"/api-reference/organizations/patch-organization-settings"}]},{"group":"Organization Members","pages":[{"title":"Cancel an organization invitation (short path)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/organizations/{org_id}/invitations/{invitation_id}","href":"/api-reference/organization-members/cancel-an-organization-invitation-short-path"},{"title":"List organization members with limited user information","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/members","href":"/api-reference/organization-members/list-organization-members-with-limited-user-information"},{"title":"Add a member to an organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/members","href":"/api-reference/organization-members/add-a-member-to-an-organization"},{"title":"List organization invitations","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/members/invitations","href":"/api-reference/organization-members/list-organization-invitations"},{"title":"Cancel an organization invitation","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/organizations/{org_id}/members/invitations/{invitation_id}","href":"/api-reference/organization-members/cancel-an-organization-invitation"},{"title":"Invite users to an organization by email","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/members/invite-by-email","href":"/api-reference/organization-members/invite-users-to-an-organization-by-email"},{"title":"Update an organization member's role","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/organizations/{org_id}/members/{user_id}","href":"/api-reference/organization-members/update-an-organization-members-role"},{"title":"Remove a member from an organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/organizations/{org_id}/members/{user_id}","href":"/api-reference/organization-members/remove-a-member-from-an-organization"}]},{"group":"Invitations","pages":[{"title":"Get invitation details by token (public endpoint)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/invitations/{token}","href":"/api-reference/invitations/get-invitation-details-by-token-public-endpoint"},{"title":"Accept invitation by token (requires authentication)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/invitations/{token}/accept","href":"/api-reference/invitations/accept-invitation-by-token-requires-authentication"}]},{"group":"Workspaces","pages":[{"title":"List workspaces in an organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/workspaces","href":"/api-reference/workspaces/list-workspaces-in-an-organization"},{"title":"Create a new workspace in an organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/workspaces","href":"/api-reference/workspaces/create-a-new-workspace-in-an-organization"},{"title":"Get workspace by ID","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/workspaces/{workspace_id}","href":"/api-reference/workspaces/get-workspace-by-id"},{"title":"Update workspace","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/workspaces/{workspace_id}","href":"/api-reference/workspaces/update-workspace"},{"title":"Delete workspace","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/workspaces/{workspace_id}","href":"/api-reference/workspaces/delete-workspace"},{"title":"List API keys for workspace","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/workspaces/{workspace_id}/api-keys","href":"/api-reference/workspaces/list-api-keys-for-workspace"},{"title":"Create API key for workspace","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/workspaces/{workspace_id}/api-keys","href":"/api-reference/workspaces/create-api-key-for-workspace"},{"title":"Revoke an API key","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/workspaces/{workspace_id}/api-keys/{key_id}","href":"/api-reference/workspaces/revoke-an-api-key"},{"title":"Update API key","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/workspaces/{workspace_id}/api-keys/{key_id}","href":"/api-reference/workspaces/update-api-key"},{"title":"Update API key spend limit","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/workspaces/{workspace_id}/api-keys/{key_id}/spend-limit","href":"/api-reference/workspaces/update-api-key-spend-limit"}]},{"group":"Usage","pages":[{"title":"Get service usage history for an organization","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/service-usage/history","href":"/api-reference/usage/get-service-usage-history-for-an-organization"},{"title":"Get organization balance","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/balance","href":"/api-reference/usage/get-organization-balance"},{"title":"Get organization usage broken down by model.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/by-model","href":"/api-reference/usage/get-organization-usage-broken-down-by-model"},{"title":"Get organization usage history","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/history","href":"/api-reference/usage/get-organization-usage-history"},{"title":"Organization usage metrics.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/metrics","href":"/api-reference/usage/organization-usage-metrics"},{"title":"Organization usage timeseries.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/timeseries","href":"/api-reference/usage/organization-usage-timeseries"},{"title":"Get API key usage history","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/workspaces/{workspace_id}/api-keys/{api_key_id}/usage/history","href":"/api-reference/usage/get-api-key-usage-history"}]},{"group":"Reporting","pages":[{"title":"List active reporting tokens for an organization.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/reporting-tokens","href":"/api-reference/reporting/list-active-reporting-tokens-for-an-organization"},{"title":"Create a read-only reporting token.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/reporting-tokens","href":"/api-reference/reporting/create-a-read-only-reporting-token"},{"title":"Revoke a reporting token.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/organizations/{org_id}/reporting-tokens/{token_id}","href":"/api-reference/reporting/revoke-a-reporting-token"},{"title":"Export organization usage and cost rows.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/export","href":"/api-reference/reporting/export-organization-usage-and-cost-rows"},{"title":"Summarize organization usage and costs.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/usage/summary","href":"/api-reference/reporting/summarize-organization-usage-and-costs"}]},{"group":"Billing","pages":[{"title":"Get costs by request IDs","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/billing/costs","href":"/api-reference/billing/get-costs-by-request-ids"}]},{"group":"Staking Farm","pages":[{"title":"Get organization staking farm state","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/staking/farm","href":"/api-reference/staking-farm/get-organization-staking-farm-state"},{"title":"Post v1organizations stakingfarmbind","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/staking/farm/bind","href":"/api-reference/staking-farm/post-v1organizations-stakingfarmbind"},{"title":"Sync organization staking farm credits","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/staking/farm/sync","href":"/api-reference/staking-farm/sync-organization-staking-farm-credits"},{"title":"Get staking farm configuration","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/staking/farm/config","href":"/api-reference/staking-farm/get-staking-farm-configuration"}]},{"group":"Services","pages":[{"title":"List platform services (public, no auth)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/services","href":"/api-reference/services/list-platform-services-public-no-auth"},{"title":"Get platform service by name (public, no auth)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/services/{service_name}","href":"/api-reference/services/get-platform-service-by-name-public-no-auth"}]},{"group":"Gateway","pages":[{"title":"Check API key validity","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/check_api_key","href":"/api-reference/gateway/check-api-key-validity"}]},{"group":"Health","pages":[{"title":"Health check","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/health","href":"/api-reference/health/health-check"}]},{"group":"Feature Requests","pages":[{"title":"List aggregated feature requests for admins.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/feature-requests","href":"/api-reference/feature-requests/list-aggregated-feature-requests-for-admins"},{"title":"Submit or update the current user's interest in a feature request target.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/feature-requests","href":"/api-reference/feature-requests/submit-or-update-the-current-users-interest-in-a-feature-request-target"}]},{"group":"Admin","pages":[{"title":"List admin access tokens (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/access-tokens","href":"/api-reference/admin/list-admin-access-tokens-admin-only"},{"title":"Create admin access token (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/access-tokens","href":"/api-reference/admin/create-admin-access-token-admin-only"},{"title":"Delete admin access token (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/admin/access-tokens/{token_id}","href":"/api-reference/admin/delete-admin-access-token-admin-only"},{"title":"List AML allowlist entries (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/aml/allowlist","href":"/api-reference/admin/list-aml-allowlist-entries-admin-only"},{"title":"Add or update an AML allowlist entry (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/aml/allowlist","href":"/api-reference/admin/add-or-update-an-aml-allowlist-entry-admin-only"},{"title":"Remove an AML allowlist entry (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/admin/aml/allowlist/{account_id}","href":"/api-reference/admin/remove-an-aml-allowlist-entry-admin-only"},{"title":"List AML reports (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/aml/reports","href":"/api-reference/admin/list-aml-reports-admin-only"},{"title":"Update AML report active status (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/aml/reports/{report_id}/status","href":"/api-reference/admin/update-aml-report-active-status-admin-only"},{"title":"List API keys across all organizations (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/api-keys","href":"/api-reference/admin/list-api-keys-across-all-organizations-admin-only"},{"title":"List organization invitation email deliveries (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/invitation-email-deliveries","href":"/api-reference/admin/list-organization-invitation-email-deliveries-admin-only"},{"title":"Resend a single organization invitation email (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/invitation-email-deliveries/{invitation_id}/resend","href":"/api-reference/admin/resend-a-single-organization-invitation-email-admin-only"},{"title":"List all models (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/models","href":"/api-reference/admin/list-all-models-admin-only"},{"title":"Batch upsert models metadata (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/models","href":"/api-reference/admin/batch-upsert-models-metadata-admin-only"},{"title":"Deprecate a model in favor of another (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/models/deprecate","href":"/api-reference/admin/deprecate-a-model-in-favor-of-another-admin-only"},{"title":"List scheduled pricing changes (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/models/pricing-changes","href":"/api-reference/admin/list-scheduled-pricing-changes-admin-only"},{"title":"Confirm a batch of scheduled pricing changes and notify affected admins (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/models/pricing-changes/confirm","href":"/api-reference/admin/confirm-a-batch-of-scheduled-pricing-changes-and-notify-affected-admins-admin-only"},{"title":"Preview a batch of scheduled pricing changes without mutating state (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/models/pricing-changes/preview","href":"/api-reference/admin/preview-a-batch-of-scheduled-pricing-changes-without-mutating-state-admin-only"},{"title":"Cancel a pending scheduled pricing change (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/admin/models/pricing-changes/{id}","href":"/api-reference/admin/cancel-a-pending-scheduled-pricing-change-admin-only"},{"title":"Delete a model (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/admin/models/{model_name}","href":"/api-reference/admin/delete-a-model-admin-only"},{"title":"List the organizations that may use a model (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/models/{model_name}/access","href":"/api-reference/admin/list-the-organizations-that-may-use-a-model-admin-only"},{"title":"Grant an organization access to a model (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/admin/models/{model_name}/access/{org_id}","href":"/api-reference/admin/grant-an-organization-access-to-a-model-admin-only"},{"title":"Revoke an organization's access to a model (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/admin/models/{model_name}/access/{org_id}","href":"/api-reference/admin/revoke-an-organizations-access-to-a-model-admin-only"},{"title":"Confirm a planned model deprecation, update the catalog, and notify affected admins.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/models/{model_name}/deprecation/confirm","href":"/api-reference/admin/confirm-a-planned-model-deprecation-update-the-catalog-and-notify-affected-admins"},{"title":"Preview affected admins for a planned model deprecation (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/models/{model_name}/deprecation/preview","href":"/api-reference/admin/preview-affected-admins-for-a-planned-model-deprecation-admin-only"},{"title":"Get complete history for a model (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/models/{model_name}/history","href":"/api-reference/admin/get-complete-history-for-a-model-admin-only"},{"title":"List all organizations with pagination (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations","href":"/api-reference/admin/list-all-organizations-with-pagination-admin-only"},{"title":"Get a single organization by id (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}","href":"/api-reference/admin/get-a-single-organization-by-id-admin-only"},{"title":"Get organization concurrent request limit (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/concurrent-limit","href":"/api-reference/admin/get-organization-concurrent-request-limit-admin-only"},{"title":"Update organization concurrent request limit (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/organizations/{org_id}/concurrent-limit","href":"/api-reference/admin/update-organization-concurrent-request-limit-admin-only"},{"title":"Reclassify reviewed legacy consumption. Does not rewrite usage logs, settle\ninvoices, alter limits, or change allocation policy. Dry runs are point-in-time\npreviews; commits revalidate under the organization accounting lock.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/organizations/{org_id}/credit/reconciliations","href":"/api-reference/admin/reclassify-reviewed-legacy-consumption-does-not-rewrite-usage-logs-settleinvoices-alter-limits-or-change-allocation-policy-dry-runs-are-point-in-timepreviews;-commits-revalidate-under-the-organization-accounting-lock"},{"title":"Get an organization's effective fallback policy (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/fallback","href":"/api-reference/admin/get-an-organizations-effective-fallback-policy-admin-only"},{"title":"Update an organization's fallback policy (Admin only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/organizations/{org_id}/fallback","href":"/api-reference/admin/update-an-organizations-fallback-policy-admin-only"},{"title":"Update organization limits (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/organizations/{org_id}/limits","href":"/api-reference/admin/update-organization-limits-admin-only"},{"title":"Get limits history for an organization (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/limits/history","href":"/api-reference/admin/get-limits-history-for-an-organization-admin-only"},{"title":"List members of a specific organization (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/members","href":"/api-reference/admin/list-members-of-a-specific-organization-admin-only"},{"title":"Update an organization member role as a system administrator.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/admin/organizations/{org_id}/members/{user_id}","href":"/api-reference/admin/update-an-organization-member-role-as-a-system-administrator"},{"title":"Get organization metrics (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/metrics","href":"/api-reference/admin/get-organization-metrics-admin-only"},{"title":"Get time series metrics for an organization (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/metrics/timeseries","href":"/api-reference/admin/get-time-series-metrics-for-an-organization-admin-only"},{"title":"List the models an organization holds grants for (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/model-access","href":"/api-reference/admin/list-the-models-an-organization-holds-grants-for-admin-only"},{"title":"Get an organization's scheduler priority (platform admins only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/priority","href":"/api-reference/admin/get-an-organizations-scheduler-priority-platform-admins-only"},{"title":"Set an organization's scheduler priority (platform admins with write access only).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/organizations/{org_id}/priority","href":"/api-reference/admin/set-an-organizations-scheduler-priority-platform-admins-with-write-access-only"},{"title":"Get admin organization staking farm state","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/staking/farm","href":"/api-reference/admin/get-admin-organization-staking-farm-state"},{"title":"Sync admin organization staking farm credits","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/organizations/{org_id}/staking/farm/sync","href":"/api-reference/admin/sync-admin-organization-staking-farm-credits"},{"title":"Get v1adminorganizations usage discount","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/usage-discount","href":"/api-reference/admin/get-v1adminorganizations-usage-discount"},{"title":"Save one immutable discount. Repeating identical terms is idempotent. A different\nsecond rule is rejected. Historical corrections run in bounded background batches;\nconsumers should refresh historical snapshots only after status becomes `active`.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/admin/organizations/{org_id}/usage-discount","href":"/api-reference/admin/save-one-immutable-discount-repeating-identical-terms-is-idempotent-a-differentsecond-rule-is-rejected-historical-corrections-run-in-bounded-background-batches;consumers-should-refresh-historical-snapshots-only-after-status-becomes-`active`"},{"title":"Get organization balance (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/usage/balance","href":"/api-reference/admin/get-organization-balance-admin-only"},{"title":"Get the platform billing summary (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/billing-summary","href":"/api-reference/admin/get-the-platform-billing-summary-admin-only"},{"title":"Get the platform infrastructure / fleet burn summary (Admin only)","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/infra-summary","href":"/api-reference/admin/get-the-platform-infrastructure-fleet-burn-summary-admin-only"},{"title":"Get platform-wide metrics for admin dashboards (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/metrics","href":"/api-reference/admin/get-platform-wide-metrics-for-admin-dashboards-admin-only"},{"title":"Get platform-wide time series for admin dashboards (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/metrics/timeseries","href":"/api-reference/admin/get-platform-wide-time-series-for-admin-dashboards-admin-only"},{"title":"Get per-model consumption timeseries (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/model-consumption-timeseries","href":"/api-reference/admin/get-per-model-consumption-timeseries-admin-only"},{"title":"Get the per-model consumption ranking (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/model-revenue","href":"/api-reference/admin/get-the-per-model-consumption-ranking-admin-only"},{"title":"Get the per-organization consumption ranking (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/org-revenue","href":"/api-reference/admin/get-the-per-organization-consumption-ranking-admin-only"},{"title":"Get platform-wide performance timeseries (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/performance-timeseries","href":"/api-reference/admin/get-platform-wide-performance-timeseries-admin-only"},{"title":"Get revenue density percentiles (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/platform/revenue-density","href":"/api-reference/admin/get-revenue-density-percentiles-admin-only"},{"title":"Create platform service (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/services","href":"/api-reference/admin/create-platform-service-admin-only"},{"title":"Update platform service (Admin only; display_name, description, cost_per_unit, is_active)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/services/{id}","href":"/api-reference/admin/update-platform-service-admin-only;-display_name-description-cost_per_unit-is_active"},{"title":"List admin settings (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/settings","href":"/api-reference/admin/list-admin-settings-admin-only"},{"title":"Get one admin setting (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/settings/{key}","href":"/api-reference/admin/get-one-admin-setting-admin-only"},{"title":"Update one admin setting (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json patch /v1/admin/settings/{key}","href":"/api-reference/admin/update-one-admin-setting-admin-only"},{"title":"Recompute usage_hourly for a UTC window (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/usage-hourly/recompute","href":"/api-reference/admin/recompute-usage_hourly-for-a-utc-window-admin-only"},{"title":"Find erasure records by the erased person's email or user id (Admin session only).\nThe email travels in the body, never the URL. No match is a 200 with an empty list.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/user-erasures/lookup","href":"/api-reference/admin/find-erasure-records-by-the-erased-persons-email-or-user-id-admin-session-onlythe-email-travels-in-the-body-never-the-url-no-match-is-a-200-with-an-empty-list"},{"title":"List all registered users with pagination (Admin only)","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/users","href":"/api-reference/admin/list-all-registered-users-with-pagination-admin-only"},{"title":"Erase a user (GDPR Art. 17). Irreversible. Run the preview first. Admin session only.","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/users/{user_id}/erasure","href":"/api-reference/admin/erase-a-user-gdpr-art-17-irreversible-run-the-preview-first-admin-session-only"},{"title":"Preview a user erasure: blockers and what would be erased (Admin only, read).","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/admin/users/{user_id}/erasure/preview","href":"/api-reference/admin/preview-a-user-erasure:-blockers-and-what-would-be-erased-admin-only-read"}]},{"group":"Credits","pages":[{"title":"Get v1adminorganizations credittransferreconciliation","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/credit/transfer/reconciliation","href":"/api-reference/credits/get-v1adminorganizations-credittransferreconciliation"},{"title":"Get v1adminorganizations policy","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/admin/organizations/{org_id}/policy","href":"/api-reference/credits/get-v1adminorganizations-policy"},{"title":"Put v1adminorganizations policy","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/admin/organizations/{org_id}/policy","href":"/api-reference/credits/put-v1adminorganizations-policy"},{"title":"Post v1organizations credentials","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/credentials","href":"/api-reference/credits/post-v1organizations-credentials"},{"title":"Delete v1organizations credentials","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json delete /v1/organizations/{org_id}/credentials/{id}","href":"/api-reference/credits/delete-v1organizations-credentials"},{"title":"Post v1organizations credittransfer","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/credit/transfer","href":"/api-reference/credits/post-v1organizations-credittransfer"},{"title":"Get v1organizations credittransfercapacity","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/credit/transfer/capacity","href":"/api-reference/credits/get-v1organizations-credittransfercapacity"},{"title":"Get v1organizations credittransfers","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/credit/transfers/{id}","href":"/api-reference/credits/get-v1organizations-credittransfers"},{"title":"Get v1organizations credittransfers","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/credit/transfers/{id}","href":"/api-reference/credits/get-v1organizations-credittransfers"}]},{"group":"Decisions","pages":[{"title":"Post v1systemone","deprecated":null,"version":null,"openapi":"/api-reference/openapi.json post /v1/systemone","href":"/api-reference/decisions/post-v1systemone"}]},{"group":"Organization credentials","pages":[{"title":"Get v1organizations credentials","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json get /v1/organizations/{org_id}/credentials","href":"/api-reference/organization-credentials/get-v1organizations-credentials"},{"title":"Put v1organizations credentials","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json put /v1/organizations/{org_id}/credentials/{id}","href":"/api-reference/organization-credentials/put-v1organizations-credentials"},{"title":"Post v1organizations credentials rotate","deprecated":true,"version":null,"openapi":"/api-reference/openapi.json post /v1/organizations/{org_id}/credentials/{id}/rotate","href":"/api-reference/organization-credentials/post-v1organizations-credentials-rotate"}]}]}]},"basePath":"","title":"Create chat completion - NEAR AI","buildId":"dpl_G2Qd45vZZ7MkBiGF9yYx8ZsbbKXX","deploymentId":"dpl_G2Qd45vZZ7MkBiGF9yYx8ZsbbKXX","dynamics":["c2aa737661","2b790eda92","b0f84f53ff","a9bb46feb3"],"chunks":["OpenApiReferenceProvider-NXj-Rqjv.js","utils-m0thOP-_.js","cloneDeep-izs3Hzxb.js","_Uint8Array-BVIqJ90l.js","isObjectLike-C8vmzPEN.js","isArray-Dcu1dQ5t.js","utils-D13EKcfm.js","toString-BX-iyh8G.js","isSymbol-CSH9U2Gm.js","addUniqueKeysToSchema--XTdfsEb.js","snippetPresets-D3s4lmAH.js","style-to-object-BY3JEAdk.js","v4-DIgz8zy6.js","conditional-requirements-CFM0id0Q.js","ApiExamples-ChURybxL.js","isEqual-BfaiBbcl.js","usePlaygroundInputsStore-DL8CiXq2.js","shallow-DI2-YB2E.js","getApiPlaygroundDisplay-DxbW7b_y.js","CodeSnippet-CiNYS0pP.js","CodeSnippets-BT87bThu.js","Page-DSpdRuhM.js","getPastedJson-F_g_IrFQ.js","icon-CCIG5BAs.js","MethodPill-DY3E0jwx.js","DuplicateIcon-BN88xnEg.js","createIcon-VCCc5HO5.js","DynamicMarkdown-CaSwclgK.js","SectionHeading-DXV8nWhc.js","axios-vUo_bRtp.js","Markdown-CV32Re6G.js","clsx-5ydLOnhV.js","lib-DuNMoZ05.js","lib-B8HbPgcC.js","html-void-elements-mCSPHezU.js","dist-pFDdfjRe.js","katex-YMM-FMeD.js","marked.esm-CZWythHk.js","AssistantPageLink-BUGO5bPJ.js"]}
