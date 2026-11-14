// Chain Signatures via the Agent API's native sign-intent routes.
// The Agent API's EVM/Solana keys are NEAR MPC-managed; this module only calls
//   POST /v1/agents/{id}/native/{evm|solana}/sign-intent
// through the official SDK under an existing owner-signed grant. It never
// creates agents/grants and never publishes `signed_data` (publishing is a
// separate, separately-authorised step). Policy (`native.<chain>.sign_intent`)
// is enforced by the provider, not here.
const METHODS = Object.freeze({evm: 'nativeEvmSignIntent', solana: 'nativeSolanaSignIntent'});
const fail = code => { throw Object.assign(new Error(code), {code}); };
async function defaultSdk() { return import('@near-intents-agent-api/sdk'); }

export function createChainSignatures({apiKey, baseUrl, agentId, grantToken, sdkLoader = defaultSdk} = {}) {
  const configured = Boolean(apiKey && agentId && grantToken);
  const capabilities = () => ({
    provider: 'near-mpc-chain-signatures', route: 'agent-api-native-sign-intent',
    chains: Object.keys(METHODS), sdk: '@near-intents-agent-api/sdk', configured,
    publishes: false, grantsSpendingAuthority: false,
  });
  async function signIntent({payload, oneClickQuotes = [], chain = 'evm'} = {}) {
    if (!configured) fail('CHAIN_SIGNATURES_NOT_CONFIGURED');
    if (!Object.hasOwn(METHODS, chain)) fail('CHAIN_UNSUPPORTED');
    if (typeof payload !== 'string' || !payload) fail('PAYLOAD_REQUIRED'); // canonical JSON text
    if (!Array.isArray(oneClickQuotes) || oneClickQuotes.length > 2) fail('QUOTES_INVALID'); // provider max is 2
    const {createAgentApi, createIdempotencyKey} = await sdkLoader();
    const grantApi = createAgentApi({apiKey, baseUrl}).forGrant(grantToken);
    const response = await grantApi[METHODS[chain]](agentId,
      {payload, ...(oneClickQuotes.length ? {one_click_quotes: oneClickQuotes} : {})},
      {idempotencyKey: createIdempotencyKey()});
    if (typeof response?.signed_data?.signature !== 'string' || response.signed_data.payload !== payload) fail('SIGNED_DATA_MISMATCH');
    return {chain, correlationId: response.correlation_id, accountId: response.account_id, signedData: response.signed_data};
  }
  return Object.freeze({signIntent, capabilities});
}
