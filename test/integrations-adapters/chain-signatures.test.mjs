import test from 'node:test';
import assert from 'node:assert/strict';
import {createChainSignatures} from '../../src/integrations/chain-signatures.mjs';

const payload = JSON.stringify({signer_id: 'a.near', intents: [{intent: 'transfer'}]});
function make(overrides = {}) {
  const calls = [];
  const grantApi = Object.fromEntries(['nativeEvmSignIntent', 'nativeSolanaSignIntent'].map(m => [m, async (id, body, opts) => {
    calls.push({m, id, body, opts});
    return overrides.response ?? {correlation_id: 'op_x', chain: 'near', account_id: 'a.near', signature: 's', signed_data: {standard: 'erc191', payload: body.payload, signature: 'sig'}};
  }]));
  const sdkLoader = async () => ({createAgentApi: () => ({forGrant: t => { calls.push({grant: t}); return grantApi; }}), createIdempotencyKey: () => 'idem'});
  return {calls, cs: createChainSignatures({apiKey: 'k', agentId: 'agent1', grantToken: 'g', sdkLoader})};
}

test('routes evm and solana to their own SDK method, under the grant', async () => {
  const {cs, calls} = make();
  const evm = await cs.signIntent({payload});
  await cs.signIntent({payload, chain: 'solana'});
  assert.deepEqual(calls.filter(c => c.m).map(c => c.m), ['nativeEvmSignIntent', 'nativeSolanaSignIntent']);
  assert.equal(calls[0].grant, 'g');
  assert.deepEqual(calls[1].body, {payload});
  assert.equal(calls[1].opts.idempotencyKey, 'idem');
  assert.equal(evm.signedData.signature, 'sig');
});
test('forwards quotes unchanged as one_click_quotes', async () => {
  const {cs, calls} = make(); const q = {quote: {depositAddress: 'd'}, quoteRequest: {}, signature: 'x', timestamp: 't'};
  await cs.signIntent({payload, oneClickQuotes: [q]});
  assert.deepEqual(calls.find(c => c.m).body.one_click_quotes, [q]);
});
test('rejects bad input before any provider call', async () => {
  const {cs, calls} = make();
  for (const [args, code] of [[{payload, chain: 'btc'}, 'CHAIN_UNSUPPORTED'], [{}, 'PAYLOAD_REQUIRED'], [{payload, oneClickQuotes: [1, 2, 3]}, 'QUOTES_INVALID']])
    await assert.rejects(cs.signIntent(args), {code});
  assert.equal(calls.length, 0);
});
test('rejects a response whose signed payload differs from what was sent', async () => {
  const {cs} = make({response: {signed_data: {standard: 'erc191', payload: 'tampered', signature: 's'}}});
  await assert.rejects(cs.signIntent({payload}), {code: 'SIGNED_DATA_MISMATCH'});
});
test('unconfigured instance refuses and says so', async () => {
  const cs = createChainSignatures({});
  assert.equal(cs.capabilities().configured, false);
  await assert.rejects(cs.signIntent({payload}), {code: 'CHAIN_SIGNATURES_NOT_CONFIGURED'});
});
