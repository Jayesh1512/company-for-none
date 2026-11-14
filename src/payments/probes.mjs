import { createProbeRuntime } from '../custody/probe-runtime.mjs';

export const PAYMENT_TOKENS_PROTOCOL = Object.freeze({ method: 'GET', url: 'https://1click.chaindefuser.com/v0/tokens',
  documentationReviewedAt: '2026-11-13', deployedContractVerified: false,
  documentation: 'https://docs.near-intents.org/api-reference/oneclick/get-supported-tokens',
  schema: '1Click supported token array: assetId, blockchain, decimals',
  verifiedScope: 'public token catalogue only; no quote, route, settlement, refund or signature verification' });

export function createPaymentTokensProbe(options = {}) {
  const r = createProbeRuntime({ ...options, provider: 'near-intents-1click' });
  const capability = 'payments_route';
  return { async probe() {
    const missing = r.prerequisite(capability); if (missing) return missing;
    try {
      // This catalogue read is public; no ambient credential is consulted.
      const read = await r.read(PAYMENT_TOKENS_PROTOCOL.url, { protocol: PAYMENT_TOKENS_PROTOCOL });
      if (!read.ok) return r.record(capability, [read], 'unavailable', 'PROVIDER_READ_FAILED');
      if (!Array.isArray(read.body) || !read.body.length || !read.body.every(t => typeof t.assetId === 'string' && typeof t.blockchain === 'string' && Number.isSafeInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 30)) {
        return r.record(capability, [read], 'unavailable', 'PAYMENT_CATALOG_SCHEMA_UNVERIFIED');
      }
      return r.record(capability, [read], 'configured', 'ROUTE_UNVERIFIED');
    } catch { return r.observation(capability, 'unavailable', 'PROVIDER_READ_FAILED'); }
  } };
}
