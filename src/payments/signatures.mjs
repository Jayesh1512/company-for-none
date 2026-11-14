import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { bytesHash } from '../inference/capture.mjs';
import { fingerprint } from '../contracts.mjs';

export const ONE_CLICK_SIGNATURE_SDK = Object.freeze({ name: '@defuse-protocol/one-click-sdk-typescript', version: '0.1.26', trustRoot: 'sdk-default-manager-public-key' });
// `trustRoot` is for isolated tests only; the product never passes it, so the SDK's pinned production root is used.
// Every proof records which root verified it.
export function createPaymentSignatureVerifier({ journal, clock = () => new Date(), trustRoot } = {}) {
  const rootLabel = trustRoot ? 'caller-supplied-test-root' : ONE_CLICK_SIGNATURE_SDK.trustRoot;
  async function verify({ evidenceRef } = {}, nested) {
    const observedAt = new Date(clock()).toISOString();
    const base = { source: 'local-sdk', sdk: ONE_CLICK_SIGNATURE_SDK, trustRoot: rootLabel, evidenceRef, observedAt,
      scope: nested ? 'nested-quoteResponse-only' : 'quote-envelope-only', settlementVerified: false, mutableStatusVerified: false };
    try {
      if (!journal || !/^private:[a-f0-9]{64}$/.test(evidenceRef ?? '')) throw Object.assign(Error(), { code: 'PRIVATE_ENVELOPE_REQUIRED' });
      const id = evidenceRef.slice(8);
      const exchange = JSON.parse(journal.getArtifact({ id, hash: id }).content);
      const bytes = Buffer.from(exchange.response.bodyBase64, 'base64');
      if (bytesHash(bytes) !== exchange.response.bodyHash) throw Object.assign(Error(), { code: 'ENVELOPE_BYTES_MISMATCH' });
      const body = JSON.parse(bytes.toString('utf8'));
      const envelope = nested ? body.quoteResponse : body;
      const require = createRequire(import.meta.url); const entry = require.resolve(ONE_CLICK_SIGNATURE_SDK.name);
      const pkg = JSON.parse(await readFile(resolve(dirname(entry), '../package.json'), 'utf8'));
      if (pkg.version !== ONE_CLICK_SIGNATURE_SDK.version) throw Object.assign(Error(), { code: 'SDK_VERSION_UNSUPPORTED' });
      const { verifyQuoteSignature, quoteHash } = await import('@defuse-protocol/one-click-sdk-typescript');
      // Never select a caller-provided signer key. Use the official pinned SDK root.
      const valid = verifyQuoteSignature(envelope, trustRoot);
      return { ...base, id: `payment-signature:${fingerprint({ evidenceRef, nested, valid })}`,
        status: valid ? 'verified' : 'failed', reasonCode: valid ? 'SIGNED_QUOTE_FIELDS_VERIFIED' : 'QUOTE_SIGNATURE_INVALID',
        ...(valid ? { signedPayloadHash: quoteHash(envelope), timestamp: envelope.timestamp } : {}) };
    } catch (error) {
      return { ...base, id: `payment-signature:${fingerprint({ evidenceRef: evidenceRef ?? null, nested, observedAt })}`,
        status: 'unavailable', reasonCode: typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'QUOTE_SIGNATURE_UNAVAILABLE' };
    }
  }
  return { trustRoot: rootLabel, verifyQuote: command => verify(command, false), verifyStatus: command => verify(command, true) };
}
