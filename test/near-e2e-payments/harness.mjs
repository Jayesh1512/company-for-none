// Local HTTP stand-in for the 1Click REST API (SYNTHETIC, signed with a TEST key; not provider evidence).
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { base58 } from '@scure/base';
import { quoteHash } from '@defuse-protocol/one-click-sdk-typescript';
import { createJournal } from '../../src/journal/index.mjs';
import { createPaymentsAdapter, createPaymentSignatureVerifier } from '../../src/payments/index.mjs';
import { fingerprint } from '../../src/contracts.mjs';

export const clock = () => new Date('2026-11-10T20:00:00.000Z');
export const EXPIRES = '2026-11-10T20:15:00.000Z';
export const SOURCE = { network: 'eth:mainnet', asset: 'nep141:eth-usdc.omft.near', decimals: 6 };
export const PRICE = { network: 'near:mainnet', asset: 'nep141:usdc.near', decimals: 6, amount: '5000000' };
const pair = generateKeyPairSync('ed25519');
export const TEST_ROOT = `ed25519:${base58.encode(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32))}`;
export const signEnvelope = envelope => { envelope.signature = `ed25519:${base58.encode(sign(null, Buffer.from(quoteHash(envelope)), pair.privateKey))}`; return envelope; };

export async function openJournal(t, directory) {
  const dir = directory ?? await mkdtemp(join(tmpdir(), 'near1-s4-'));
  const journal = await createJournal({ directory: dir, clock });
  if (!directory) t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  return { journal, dir };
}
export const decision = action => ({ status: 'allow', actionFingerprint: fingerprint(action), permit: { id: `permit:${action.id}`, actionFingerprint: fingerprint(action), actionId: action.id } });

export async function provider(t, overrides = {}) {
  const requests = []; const quotes = new Map(); let counter = 0;
  const state = { statusBody: null, dryFail: false, dryNoFee: false, dryBadSignature: false, ...overrides };
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8'); const body = text ? JSON.parse(text) : null;
    requests.push({ path: req.url, method: req.method, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v0/tokens') return res.end(JSON.stringify([{ assetId: PRICE.asset, blockchain: 'near', decimals: 6 }, { assetId: SOURCE.asset, blockchain: 'eth', decimals: 6 }]));
    if (req.url === '/v0/quote') {
      if (body.dry && state.dryFail) { res.statusCode = 500; return res.end('{}'); }
      const out = BigInt(body.amount);
      const quote = body.dry ? { amountIn: String(out + 50000n), amountOut: body.amount, minAmountIn: String(out), minAmountOut: body.amount, ...(state.dryNoFee ? {} : { withdrawFee: '1000' }) }
        : { amountIn: String(out + 100000n), minAmountIn: String(out + 20000n), amountOut: body.amount, minAmountOut: body.amount, depositAddress: `deposit-${++counter}`, deadline: EXPIRES, timeEstimate: 60, refundFee: '2000', withdrawFee: '1000' };
      const envelope = signEnvelope({ correlationId: `corr-${counter}${body.dry ? '-dry' : ''}`, timestamp: clock().toISOString(), quoteRequest: body, quote });
      if (body.dry && state.dryBadSignature) envelope.quote.amountIn = '1';
      if (!body.dry) quotes.set(quote.depositAddress, envelope);
      return res.end(JSON.stringify(envelope));
    }
    if (req.url.startsWith('/v0/status')) {
      const address = new URL(req.url, 'http://x').searchParams.get('depositAddress');
      const envelope = quotes.get(address);
      if (!envelope) { res.statusCode = 404; return res.end('{}'); }
      return res.end(JSON.stringify(state.statusBody ? state.statusBody(envelope) : { correlationId: envelope.correlationId, quoteResponse: envelope, status: 'PENDING_DEPOSIT', updatedAt: '2026-11-10T20:00:00.000Z', swapDetails: { intentHashes: [], nearTxHashes: [], originChainTxHashes: [], destinationChainTxHashes: [] } }));
    }
    res.statusCode = 501; res.end('{}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { requests, state, quotes, transport: (url, init) => { const u = new URL(url); return fetch(base + u.pathname + u.search, init); } };
}
export function adapter({ journal, http, settlementEvidence, transport, clock: c = clock }) {
  return createPaymentsAdapter({ mode: 'live', journal, clock: c, transport: transport ?? http.transport, slippageTolerance: 100, settlementEvidence,
    signatures: createPaymentSignatureVerifier({ journal, clock: c, trustRoot: TEST_ROOT }) });
}
export const quoteCommand = (id = 'one') => { const action = { id: `quote:${id}`, type: 'offer' };
  return { action, decision: decision(action), offer: { id: `invoice-${id}`, price: PRICE, treasuryAccount: 'treasury.near', recipientType: 'CONFIDENTIAL_INTENTS', expiresAt: EXPIRES },
    sourceAsset: SOURCE, recipient: 'treasury.near', refundTo: '0xCustomerRefund', expiresAt: EXPIRES }; };
export const settlementCommand = (quote, id = 'one') => ({ action: { id: `settlement:${id}`, type: 'settlement' }, quote });
export const successStatus = (extra = {}, swap = {}) => envelope => ({ correlationId: envelope.correlationId, quoteResponse: envelope, status: 'SUCCESS', updatedAt: '2026-11-10T20:03:00.000Z',
  swapDetails: { intentHashes: ['intent-hash-1'], nearTxHashes: [], originChainTxHashes: [{ hash: 'origin-tx' }], destinationChainTxHashes: [], amountOut: PRICE.amount, depositedAmount: '5100000', ...swap }, ...extra });
// Synthetic independent finding with the exact port contract proposed to S5.
export const finding = (over = {}) => ({ status: 'verified', kind: 'agent-receipt-log', assurance: 'onchain-final', finality: 'final', receiptType: 'deposit',
  account: 'treasury.near', terms: { origin_asset: SOURCE.asset, destination_asset: PRICE.asset, amount_out: PRICE.amount, confidential: true, intent_hash: 'intent-hash-1' },
  references: ['intent-hash-1'], settledAt: '2026-11-10T20:02:00.000Z', provenance: { leafIndex: 7, checkpoint: { origin: 'test', size: 8, root: 'r' } }, evidenceRef: 'agent-proof:test', ...over });
