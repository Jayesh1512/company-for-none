import { capability, realMode, result, unsupported } from '../custody/adapter-runtime.mjs';
import { readKeyAttribution, readBalanceObservation } from './credit.mjs';

// Evidence-backed scope (docs.near.ai OpenAPI, read 14 Nov 2026):
//  * Reads: POST /check_api_key (inference key -> org/workspace/key identity) and GET /organizations/{org}/usage/balance
//    (user session JWT only; no sequence/watermark, so observations are 'unwatermarked' comparison facts).
//  * No cash->credit purchase route is documented in the inspected OpenAPI; staking needs a user session plus a
//    wallet-signed bind. Org-to-org credit transfer exists but its response schemas are undocumented, so it is not executed.
// Config and owner-authored balance JSON never establish credit, a purchase or a transfer.
const MISSING = ['Documented agent-funded purchase route', 'Authorized funding limit', 'Agent-linked Cloud credit evidence'];

export function createCloudFundingAdapter(options = {}) {
  // The inspected Cloud documentation supplies no testnet origin. Never label a production read as testnet evidence.
  const mode = realMode(options.mode === 'live' ? 'live' : undefined);
  const { transport = fetch, resolveSecret, clock = () => new Date(), timeoutMs = 10000 } = options;
  const meta = capability('M06', mode, 'near-ai-cloud', {
    autonomousPurchaseSupported: false, configured: false, verified: false, evidenceLevel: 'unavailable', missingAccess: MISSING,
    reads: { keyAttribution: true, balance: { credential: 'user_session_token', watermark: false, additive: false } },
    creditTransfer: { documented: true, responseSchemaDocumented: false, supported: false },
    staking: { supported: false, reason: 'Needs user session, wallet-signed bind and explicit principal/yield authorization' },
  });
  const secret = async ref => { const v = typeof ref === 'string' && ref ? await resolveSecret?.(ref) : undefined; return typeof v === 'string' && v ? v : null; };
  const blocked = code => result(meta, 'not_submitted', null, { code, kind: 'credit_observation', autonomousPurchase: false });
  async function read(fn, empty) {
    if (mode === 'unavailable') return blocked('PROVIDER_MODE_UNAVAILABLE');
    try { return await fn(); } catch (e) {
      const code = typeof e.code === 'string' && /^[A-Z_]+$/.test(e.code) ? e.code : 'PROVIDER_UNAVAILABLE';
      return result(meta, code === 'INVALID_INPUT' ? 'not_submitted' : 'failed', null, { code, kind: 'credit_observation', autonomousPurchase: false, ...empty });
    }
  }
  return {
    capabilities: () => structuredClone(meta),
    // Synchronous caller-supplied balances are refused: not provider-verified credit or an additive receipt.
    observeCredit() {
      return result(meta, 'not_submitted', null, { code: 'CREDIT_EVIDENCE_UNVERIFIED', kind: 'credit_observation', autonomousPurchase: false,
        reason: 'A caller-supplied balance is not provider-verified credit or an additive funding receipt' });
    },
    /** Free read. Returns the exact org/workspace/key a protected inference key belongs to. */
    attributeKey: ({ keySecretRef } = {}) => read(async () => {
      const token = await secret(keySecretRef); if (!token) return blocked('INFERENCE_CREDENTIAL_REQUIRED');
      const attribution = await readKeyAttribution({ transport, token, timeoutMs });
      return result(meta, 'confirmed', null, { kind: 'key_attribution', attribution, autonomousPurchase: false });
    }),
    /** Free read of one absolute prepaid balance. Never additive; never an opening, lot or receipt. */
    observeBalance: ({ organizationId, sessionSecretRef, keySecretRef } = {}) => read(async () => {
      const token = await secret(sessionSecretRef); if (!token) return blocked('SESSION_CREDENTIAL_REQUIRED');
      let attribution = null;
      if (keySecretRef) {
        const keyToken = await secret(keySecretRef); if (!keyToken) return blocked('INFERENCE_CREDENTIAL_REQUIRED');
        attribution = await readKeyAttribution({ transport, token: keyToken, timeoutMs });
      }
      const observation = await readBalanceObservation({ transport, token, organizationId, attribution, mode, clock, timeoutMs });
      return result(meta, 'confirmed', null, { kind: 'credit_observation', code: 'OBSERVED_UNWATERMARKED', observation, autonomousPurchase: false });
    }),
    fund: async ({ action } = {}) => unsupported(meta, action, 'No documented cash-to-credit purchase route; transfer response schemas are undocumented and staking is unauthorized; prepaid inference is separate'),
    reconcile: async ({ action } = {}) => unsupported(meta, action, 'No verified credit-purchase reconciliation route'),
  };
}
export { toEconomicObservation, parseBalance } from './credit.mjs';

/** Composition-only bridge. M01/owner access gates surround these calls; browser input cannot select a tenant or secret. */
export function createCloudCreditReadPort({ adapter, organizationId, sessionSecretRef, keySecretRef } = {}) {
  if (!adapter || typeof adapter.attributeKey !== 'function' || typeof adapter.observeBalance !== 'function'
    || typeof organizationId !== 'string' || !organizationId || typeof sessionSecretRef !== 'string' || !sessionSecretRef
    || typeof keySecretRef !== 'string' || !keySecretRef) throw new TypeError('Pinned organization, protected session/key references and credit adapter are required');
  const noInput = args => { if (args.length) throw new TypeError('The credit read port takes no caller-selected scope'); };
  return Object.freeze({
    attributeKey(...args) { noInput(args); return adapter.attributeKey({ keySecretRef }); },
    observeBalance(...args) { noInput(args); return adapter.observeBalance({ organizationId, sessionSecretRef, keySecretRef }); },
  });
}
