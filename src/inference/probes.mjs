import { createProbeRuntime } from '../custody/probe-runtime.mjs';

export const CLOUD_MODEL_PROTOCOL = Object.freeze({ method: 'GET', url: 'https://cloud-api.near.ai/v1/models',
  documentationReviewedAt: '2026-11-13', deployedContractVerified: false,
  documentation: 'https://docs.near.ai/api-reference/chat/list-available-models', schema: 'OpenAI-compatible model list; NEAR Cloud OpenAPI 1.0.0',
  verifiedScope: 'exact selected model catalogue membership only', proofVerified: false, chargeBoundsVerified: false, creditVerified: false });

export function createCloudModelProbe(options = {}) {
  const r = createProbeRuntime({ ...options, provider: 'near-ai-cloud' });
  const capability = 'inference_model';
  return { async probe() {
    const missing = r.prerequisite(capability); if (missing) return missing;
    if (typeof options.model !== 'string' || !options.model) return r.observation(capability, 'unavailable', 'MODEL_SELECTION_REQUIRED');
    try {
      const read = await r.read(CLOUD_MODEL_PROTOCOL.url, { protocol: CLOUD_MODEL_PROTOCOL });
      if (!read.ok) return r.record(capability, [read], 'unavailable', 'PROVIDER_READ_FAILED');
      if (!Array.isArray(read.body?.data) || !read.body.data.every(m => typeof m.id === 'string')) return r.record(capability, [read], 'unavailable', 'MODEL_CATALOG_SCHEMA_UNVERIFIED');
      const found = read.body.data.some(m => m.id === options.model);
      return r.record(capability, [read], found ? 'verified' : 'unavailable', found ? 'MODEL_CATALOG_OBSERVED' : 'MODEL_UNAVAILABLE');
    } catch { return r.observation(capability, 'unavailable', 'PROVIDER_READ_FAILED'); }
  } };
}
