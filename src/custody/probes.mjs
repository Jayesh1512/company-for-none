import { createProbeRuntime } from './probe-runtime.mjs';

const GRANT_DOMAIN = 'near-intents-agent-api.agent-grant.v6';
const integer = value => typeof value === 'string' && value.length <= 78 && /^(0|[1-9][0-9]*)$/.test(value);

const BASE = 'https://api.agentsonintents.com';
export const AGENT_READ_PROTOCOL = Object.freeze({ provider: 'near-agent-api', network: 'near:mainnet',
  documentationReviewedAt: '2026-11-13', deployedContractVerified: false,
  documentation: ['https://docs.agentsonintents.com/integration/agent-api/sdk',
    'https://docs.agentsonintents.com/integration/agent-api/policies-and-limits',
    'https://docs.agentsonintents.com/integration/agent-api/grants',
    'https://docs.agentsonintents.com/integration/agent-api/funding'],
  reads: ['GET /v1/agents/{agent_id}', 'GET /v1/agents/{agent_id}/policy', 'GET /v1/agents/{agent_id}/grants', 'GET /v1/agents/{agent_id}/balances?source=confidential'],
  auth: 'X-API-Key only for these reads; grant token never sent',
  limits: 'Provider-reported reads only. No local owner-signature/grant-token/proof verifier. Absolute balance has no established reconciliation watermark.' });

export function createAgentApiProbes(options = {}) {
  const { agentId, secretRef, resolveSecret, providerPolicyVersion, grantId, grantRef, balanceSource } = options;
  const r = createProbeRuntime({ ...options, provider: 'near-agent-api' });
  const path = `/v1/agents/${encodeURIComponent(agentId ?? '')}`;
  function missing(capability) {
    const invalid = r.prerequisite(capability); if (invalid) return invalid;
    if (r.identity.network !== 'near:mainnet' || r.identity.bucket !== 'confidential' || balanceSource !== 'confidential') return r.observation(capability, 'unavailable', 'CONFIDENTIAL_MAINNET_BINDING_REQUIRED');
    if (!agentId || !secretRef || typeof resolveSecret !== 'function') return r.observation(capability, 'unavailable', 'AGENT_ACCESS_REQUIRED');
    return null;
  }
  async function reader() {
    const key = await resolveSecret(secretRef);
    if (typeof key !== 'string' || !key) throw new Error('CREDENTIAL_UNAVAILABLE');
    return suffix => r.read(BASE + path + suffix, { headers: { 'X-API-Key': key }, protocol: AGENT_READ_PROTOCOL });
  }
  const matches = read => read.ok && read.body?.status === 'ACTIVE' && read.body?.wallet?.near_account_id === r.identity.treasuryAccount &&
    (!read.body.agent_id || read.body.agent_id === agentId) && (!read.body.id || read.body.id === agentId);
  async function observe(capability, suffix, classify) {
    const invalid = missing(capability); if (invalid) return invalid;
    try {
      const read = await reader(); const identity = await read('');
      if (!matches(identity)) return r.record(capability, [identity], 'unavailable', 'AGENT_IDENTITY_UNVERIFIED');
      if (!suffix) return r.record(capability, [identity], 'verified', 'AGENT_IDENTITY_OBSERVED');
      const target = await read(suffix);
      if (!target.ok) return r.record(capability, [identity, target], 'unavailable', 'PROVIDER_READ_FAILED');
      return r.record(capability, [identity, target], 'unavailable', classify(target.body));
    } catch { return r.observation(capability, 'unavailable', 'AGENT_ACCESS_UNVERIFIED'); }
  }
  const api = {
    identity: () => observe('custody_identity', '', () => null),
    policy: () => observe('custody_policy', '/policy', raw => {
      if (raw?.status !== 'APPLIED' || raw.provider_policy_synced !== true) return 'PROVIDER_POLICY_NOT_APPLIED';
      if (providerPolicyVersion === undefined || String(raw.revision) !== String(providerPolicyVersion)) return 'PROVIDER_POLICY_REVISION_UNVERIFIED';
      return 'POLICY_SIGNATURE_UNVERIFIED';
    }),
    grant: () => observe('custody_grant', '/grants', raw => {
      const grants = Array.isArray(raw) ? raw : raw?.grants;
      if (!Array.isArray(grants) || !grantId) return 'GRANT_READ_SCHEMA_UNVERIFIED';
      const match = grants.find(g => g.grant_id === grantId);
      if (!match || match.revoked_at || !Number.isFinite(Date.parse(match.expires_at)) || Date.parse(match.expires_at) <= new Date((options.clock ?? (() => new Date()))()).getTime()) return 'GRANT_INACTIVE';
      return 'GRANT_TOKEN_BINDING_UNVERIFIED';
    }),
    balance: () => observe('custody_balance', '/balances?source=confidential', raw =>
      Array.isArray(raw?.balances) ? 'BALANCE_WATERMARK_UNVERIFIED' : 'BALANCE_SCHEMA_UNVERIFIED'),
  };
  // Scoped provider-reported facts. Status is 'observed' (never 'verified'): the provider's JSON
  // is cross-checked locally where the schema allows, but no owner signature, absolute-balance
  // watermark or enforcement boundary is available to verify. Facts carry no allow/deny verdict.
  async function facts(capability, suffix, project) {
    const invalid = missing(capability); if (invalid) return invalid;
    try {
      const read = await reader(); const identity = await read('');
      if (!matches(identity)) return r.record(capability, [identity], 'unavailable', 'AGENT_IDENTITY_UNVERIFIED');
      const target = await read(suffix);
      if (!target.ok) return r.record(capability, [identity, target], 'unavailable', 'PROVIDER_READ_FAILED');
      const projected = await project(target.body, identity.body);
      if (projected.reasonCode && projected.status === 'unavailable') return r.record(capability, [identity, target], 'unavailable', projected.reasonCode);
      const observed = await r.record(capability, [identity, target], 'observed', projected.reasonCode);
      return observed.status === 'observed' ? { ...observed, facts: projected.facts } : observed;
    } catch { return r.observation(capability, 'unavailable', 'AGENT_ACCESS_UNVERIFIED'); }
  }
  const now = () => new Date((options.clock ?? (() => new Date()))()).getTime();
  Object.assign(api, {
    // Absolute balance for ONE asset. The provider documents no as-of/watermark field
    // (price_updated_at prices the asset; it is not a balance watermark), so `watermark` is null
    // and `localReadAt` is only our clock. Never an opening/additive cash fact.
    balanceFacts: ({ asset } = {}) => typeof asset !== 'string' || !asset ? r.observation('custody_balance_facts', 'unavailable', 'ASSET_SCOPE_REQUIRED')
      : facts('custody_balance_facts', `/balances?source=confidential&asset=${encodeURIComponent(asset)}`, body => {
        if (body?.source !== 'confidential' || body.near_account_id !== r.identity.treasuryAccount || !Array.isArray(body.balances)) return { status: 'unavailable', reasonCode: 'BALANCE_SCOPE_MISMATCH' };
        const rows = body.balances.filter(row => row?.asset_id === asset);
        if (rows.length !== 1 || !integer(rows[0].balance_raw) || !integer(rows[0].available_raw)) return { status: 'unavailable', reasonCode: 'BALANCE_ASSET_UNOBSERVED' };
        if (rows[0].decimals != null && (!Number.isInteger(rows[0].decimals) || rows[0].decimals < 0 || rows[0].decimals > 36)) return { status: 'unavailable', reasonCode: 'BALANCE_ASSET_UNOBSERVED' };
        if (BigInt(rows[0].available_raw) > BigInt(rows[0].balance_raw)) return { status: 'unavailable', reasonCode: 'BALANCE_INCONSISTENT' };
        return { reasonCode: 'NO_PROVIDER_WATERMARK_LOCAL_READ_TIME_ONLY', facts: { accountId: body.near_account_id, source: 'confidential', assetId: asset,
          balanceRaw: rows[0].balance_raw, availableRaw: rows[0].available_raw, decimals: Number.isInteger(rows[0].decimals) ? rows[0].decimals : null, watermark: null, localReadAt: new Date(now()).toISOString() } };
      }),
    // Applied policy as reported by the provider. Hash/revision are provider-reported; no
    // policy signature is available, and this module never computes allow/deny from it.
    policyFacts: () => facts('custody_policy_facts', '/policy', body => {
      if (body?.status !== 'APPLIED' || body.provider_policy_synced !== true || !body.policy) return { status: 'unavailable', reasonCode: 'PROVIDER_POLICY_NOT_APPLIED' };
      if (providerPolicyVersion === undefined || String(body.revision) !== String(providerPolicyVersion)) return { status: 'unavailable', reasonCode: 'PROVIDER_POLICY_REVISION_UNVERIFIED' };
      const p = body.policy;
      return { reasonCode: 'POLICY_PROVIDER_REPORTED_SIGNATURE_UNVERIFIED', facts: { revision: body.revision, policyHash: body.policy_hash ?? null, appliedAt: body.applied_at ?? null,
        transactionHash: body.transaction_hash ?? null, frozen: typeof p.frozen === 'boolean' ? p.frozen : null, actions: p.actions, confidential: p.confidential, ownerApproval: p.owner_approval, assets: p.assets,
        destinations: p.destinations, limits: p.limits, maxActionsPerHour: p.max_actions_per_hour, budget: p.budget, timelockMs: p.timelock_ms, usage: body.usage ?? null,
        cooldowns: body.cooldowns ?? null } };
    }),
    // Grant facts: the local grant token's commitment (never transmitted) must equal the credential
    // in the provider's grant record, and /containment must call that record current. The owner's
    // signature is not exposed, so the record itself stays provider-reported.
    async grantBinding() {
      const capability = 'custody_grant_binding';
      const invalid = missing(capability); if (invalid) return invalid;
      if (!grantId || !grantRef || typeof resolveSecret !== 'function') return r.observation(capability, 'unavailable', 'GRANT_ACCESS_REQUIRED');
      try {
        const token = await resolveSecret(grantRef);
        if (typeof token !== 'string' || !/^ngt_[A-Za-z0-9_-]{43}$/.test(token)) return r.observation(capability, 'unavailable', 'GRANT_TOKEN_UNAVAILABLE');
        const { grantCommitment } = await (options.sdk ?? import('@near-intents-agent-api/sdk'));
        const commitment = grantCommitment(token);
        const read = await reader(); const identity = await read('');
        if (!matches(identity)) return r.record(capability, [identity], 'unavailable', 'AGENT_IDENTITY_UNVERIFIED');
        const [grants, containment] = [await read('/grants'), await read('/containment')];
        const reads = [identity, grants, containment];
        if (!grants.ok || !containment.ok || !Array.isArray(grants.body)) return r.record(capability, reads, 'unavailable', 'PROVIDER_READ_FAILED');
        const records = grants.body.filter(g => g?.grant_id === grantId);
        const record = records[0];
        if (records.length !== 1 || !record) return r.record(capability, reads, 'unavailable', 'GRANT_NOT_FOUND');
        const message = record.owner_message;
        if (message?.domain !== GRANT_DOMAIN || message.network !== 'mainnet' || message.agent_id !== agentId || record.agent_id !== agentId ||
          !Number.isSafeInteger(record.owner_epoch) || record.owner_epoch <= 0 || message.owner_epoch !== record.owner_epoch ||
          !record.wallet_id || message.wallet_id !== record.wallet_id || identity.body.wallet?.wallet_id !== record.wallet_id ||
          message.credential !== commitment) return r.record(capability, reads, 'unavailable', 'GRANT_COMMITMENT_MISMATCH');
        const expiresAt = Date.parse(record.expires_at);
        const issuedAt = Date.parse(record.issued_at);
        if (record.revoked_at || !Number.isFinite(expiresAt) || expiresAt <= now() || message.expires_at_ms !== expiresAt ||
          !Number.isFinite(issuedAt) || message.issued_at_ms !== issuedAt || issuedAt > now() || issuedAt >= expiresAt) return r.record(capability, reads, 'unavailable', 'GRANT_INACTIVE');
        const currentRecords = containment.body?.grants?.data?.filter?.(g => g.grant_id === grantId) ?? [];
        const current = currentRecords[0];
        if (containment.body?.grants?.has_more === true && !current) return r.record(capability, reads, 'unavailable', 'GRANT_CONTAINMENT_PAGE_INCOMPLETE');
        if (currentRecords.length !== 1 || current.grant_record_current !== true || current.revoked_at || !Array.isArray(current.findings) || current.findings.length > 0 || current.owner_epoch !== record.owner_epoch ||
          Date.parse(current.expires_at) !== expiresAt || Date.parse(current.issued_at) !== issuedAt ||
          containment.body.wallet?.wallet_id !== record.wallet_id || containment.body.wallet?.near_account_id !== r.identity.treasuryAccount) return r.record(capability, reads, 'unavailable', 'GRANT_RECORD_NOT_CURRENT');
        const observed = await r.record(capability, reads, 'observed', 'GRANT_PROVIDER_REPORTED_OWNER_SIGNATURE_UNVERIFIED');
        if (observed.status !== 'observed') return observed;
        const pending = containment.body.pending_operations;
        return { ...observed, facts: { grantId, ownerEpoch: record.owner_epoch, expiresAt: record.expires_at, commitmentMatchesLocalToken: true,
          providerBoundary: { enforcement: containment.body.provider_boundary?.enforcement ?? 'unverified', directProviderKeyBypass: containment.body.provider_boundary?.direct_provider_key_bypass ?? 'unverified' },
          pendingOperations: { count: pending?.data?.length ?? null, complete: pending?.has_more === false, items: (pending?.data ?? []).map(o => ({ operationId: o.operation_id, kind: o.kind, status: o.status })) } } };
      } catch { return r.observation(capability, 'unavailable', 'AGENT_ACCESS_UNVERIFIED'); }
    },
  });
  // No reads occur at construction/startup. The owner-authorized caller selects
  // a focused method, or explicitly requests this complete read-only batch.
  return { ...api, probe: async () => {
    const settled = await Promise.allSettled([api.identity(), api.policy(), api.grant(), api.balance()]);
    return settled.map((v, i) => v.status === 'fulfilled' ? v.value : r.observation(['custody_identity', 'custody_policy', 'custody_grant', 'custody_balance'][i], 'unavailable', 'PROVIDER_READ_FAILED'));
  } };
}
