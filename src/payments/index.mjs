import { capability, digest, moneyValid, atomic, realMode, result, unsupported } from '../custody/adapter-runtime.mjs';
import { createIntentsClient } from './http.mjs';
import { createPaymentSignatureVerifier } from './signatures.mjs';
import { normalizeProviderStatus, providerReferences } from './status.mjs';
import { bindSettlement } from './settlement.mjs';
import { freezeServiceRefundRoute } from './refund-route.mjs';
import { randomUUID } from 'node:crypto';
export { createPaymentSignatureVerifier } from './signatures.mjs';

export { createIntentsClient } from './http.mjs';
const eqAsset = (a, b) => a?.network === b?.network && a?.asset === b?.asset && a?.decimals === b?.decimals;
const finiteDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function createPaymentsAdapter(options = {}) {
  const mode = realMode(options.mode);
  const { journal, clock = () => new Date(), slippageTolerance, settlementEvidence } = options;
  const meta = capability('M05', mode, 'near-intents-1click', {
    networks: ['mainnet'],
    exactOutput: true, testnetSupported: false,
    verified: false, routeVerified: false, refundRouteVerified: false, signatureVerificationSupported: true,
    statusAuthenticated: false, signatureTrustRoot: (options.signatures ?? { trustRoot: 'sdk-default-manager-public-key' }).trustRoot, independentSettlementEvidencePort: typeof settlementEvidence?.verify === 'function',
    // Technical definition only: verified settlement needs onchain-final + final + exact bindings. Weaker evidence is exposed as facts for M01.
    settlementVerificationRequires: 'onchain-final', serviceRefundExecutableProof: 'unavailable',
    evidenceLevel: 'documented-only',
  });
  const client = mode === 'live' ? createIntentsClient({ ...options, persistExchange: async exchange => {
    const ref = await journal.putArtifact({ actionId: `payment-envelope:${randomUUID()}`, content: JSON.stringify(exchange), mediaType: 'application/json' });
    return `private:${ref.id}`;
  } }) : null;
  const signatures = options.signatures ?? createPaymentSignatureVerifier({ journal, clock });
  const ns = 'adapters:m05';
  const stamp = () => new Date(clock()).toISOString();
  const read = id => journal?.get(ns, id);
  async function store(id, fingerprint, value) {
    return (await journal.transaction({ actionId: `${ns}:quote:${id}`, fingerprint }, tx => {
      tx.put(ns, id, { fingerprint, quote: value }); return value;
    })).result;
  }
  async function quote(command = {}) {
    const { action, offer, sourceAsset, recipient, refundTo, expiresAt = offer?.expiresAt, decision } = command;
    if (mode === 'unavailable' || mode === 'testnet') return unsupported(meta, action, 'Official Intents has no testnet deployment');
    const invoiceId = offer?.id;
    if (!action?.id || !invoiceId || !moneyValid(offer?.price) || !finiteDate(expiresAt) ||
      recipient !== offer.treasuryAccount || !refundTo || Date.parse(expiresAt) > Date.parse(offer.expiresAt) ||
      decision?.status !== 'allow') return result(meta, 'not_submitted', action, { code: 'INVALID_INPUT' });
    const payloadHash = digest({ action, offer, sourceAsset, recipient, refundTo, expiresAt });
    const existing = read(invoiceId);
    if (existing) {
      if (existing.fingerprint !== payloadHash) return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
      return Date.parse(existing.quote.expiresAt) <= new Date(clock()).getTime()
        ? result(meta, 'not_submitted', action, { code: 'QUOTE_EXPIRED' })
        : result(meta, 'confirmed', action, { quote: existing.quote });
    }
    if (Date.parse(expiresAt) <= new Date(clock()).getTime()) return result(meta, 'not_submitted', action, { code: 'QUOTE_EXPIRED' });
    if (!journal) return result(meta, 'not_submitted', action, { code: 'STORAGE_UNAVAILABLE' });
    let requiredInput;
    let raw;
    let providerReference;
    let depositAddress;
    let depositMemo;
    let costs;
    let signatureProof;
    let serviceRefundRoute;
    try {
        if (!sourceAsset?.network?.endsWith(':mainnet') || !offer.price.network.endsWith(':mainnet')) return unsupported(meta, action, 'Mainnet only');
        const tokens = await client.tokens();
        const catalog = (Array.isArray(tokens) ? tokens : []).map(t => ({ asset: t.assetId, decimals: t.decimals, network: `${t.blockchain}:mainnet` }));
        if (!catalog.some(t => eqAsset(t, sourceAsset)) || !catalog.some(t => eqAsset(t, offer.price))) {
          return result(meta, 'not_submitted', action, { code: 'UNSUPPORTED_ASSET' });
        }
        // Slippage and refund route must be explicit approved quote inputs.
        if (!Number.isSafeInteger(slippageTolerance) || slippageTolerance < 0) return result(meta, 'not_submitted', action, { code: 'INVALID_INPUT' });
        const expectedQuote = { dry: false, swapType: 'EXACT_OUTPUT', slippageTolerance,
          originAsset: sourceAsset.asset, destinationAsset: offer.price.asset,
          amount: offer.price.amount, depositType: 'ORIGIN_CHAIN', recipientType: offer.recipientType??'DESTINATION_CHAIN',
          refundType: 'ORIGIN_CHAIN', refundTo, recipient, deadline: expiresAt };
        const received = await client.quoteWithEvidence(expectedQuote);
        signatureProof = await signatures.verifyQuote({ evidenceRef: received.evidenceRef });
        if (signatureProof.status !== 'verified') return result(meta, 'not_submitted', action, { code: signatureProof.reasonCode, proof: signatureProof });
        raw = received.body;
        for (const field of ['dry', 'slippageTolerance', 'swapType', 'originAsset', 'destinationAsset', 'amount', 'recipient', 'recipientType', 'refundTo', 'refundType', 'depositType', 'deadline']) {
          if (raw.quoteRequest?.[field] !== expectedQuote[field]) throw new Error('INVALID_PROVIDER_QUOTE');
        }
        // The provider (1Click) sets its own quote deadline; it is routinely longer than
        // the invoice TTL, which the offer enforces separately. Only require the quote to
        // still be valid now, never that its deadline fit inside the invoice window.
        if (!atomic(raw.quote?.amountIn) || raw.quote.amountOut !== offer.price.amount ||
          !raw.quote.depositAddress || !finiteDate(raw.quote.deadline) ||
          Date.parse(raw.quote.deadline) <= new Date(clock()).getTime()) throw new Error('INVALID_PROVIDER_QUOTE');
        requiredInput = { ...sourceAsset, amount: raw.quote.amountIn };
        // Frozen BEFORE deposit instructions are returned: a missing remedy route blocks the quote.
        const frozen = await freezeServiceRefundRoute({ client, signatures, offer, sourceAsset, treasury: recipient, refundTo, paidAmount: raw.quote.amountIn,
          slippageTolerance, expiresAt: raw.quote.deadline, now: new Date(clock()).getTime() });
        if (!frozen.ok) return result(meta, 'not_submitted', action, { code: frozen.code, ...(frozen.proof ? { proof: frozen.proof } : {}) });
        if (!frozen.route.feesComplete) return result(meta, 'not_submitted', action, { code: 'REFUND_ROUTE_UNPRICED' });
        serviceRefundRoute = frozen.route;
        providerReference = raw.correlationId;
        depositAddress = raw.quote.depositAddress;
        depositMemo = raw.quote.depositMemo;
        costs = [{ kind: 'withdraw', status: raw.quote.withdrawFee ? 'known' : 'pending',
          ...(raw.quote.withdrawFee ? { money: { ...offer.price, amount: raw.quote.withdrawFee } } : {}) }];
      const q = { schemaVersion: 1, id: invoiceId, invoiceId, requiredInput, destination: offer.price,
        recipient, refundTo, ...(mode==='live'?{recipientType:offer.recipientType??'DESTINATION_CHAIN'}:{}), expiresAt: raw?.quote?.deadline ?? expiresAt,
        depositAddress, ...(depositMemo ? { depositMemo } : {}), providerReference,
        mode, simulated: false, costs, issuedAt: stamp(), signedQuoteRef: signatureProof.evidenceRef, signatureProof, serviceRefundRoute,
        signedQuote: { timestamp: raw.timestamp, minAmountIn: raw.quote.minAmountIn ?? null, refundFee: raw.quote.refundFee ?? null, withdrawFee: raw.quote.withdrawFee ?? null,
          timeEstimate: raw.quote.timeEstimate ?? null, depositType: raw.quoteRequest.depositType, refundType: raw.quoteRequest.refundType, swapType: raw.quoteRequest.swapType },
        refundType: raw.quoteRequest.refundType,
      };
      const stored = await store(invoiceId, payloadHash, q);
      return result(meta, 'confirmed', action, { quote: stored });
    } catch (error) {
      return result(meta, 'not_submitted', action, { code: error.code === 'CONFLICT' ? 'CONFLICT' : 'PROVIDER_UNAVAILABLE' });
    }
  }
  // Assess one captured status observation. Pure over (stored quote, raw status bytes, finding): replayable after restart.
  async function assess({ action, q, evidenceRef, body, finding, findingRef }) {
    const signedQuote = await signatures.verifyStatus({ evidenceRef });
    if (signedQuote.status !== 'verified') return result(meta, 'unknown', action, { code: signedQuote.reasonCode, proof: signedQuote });
    // The nested signed quote is the ONLY authenticated part of a status payload: it must be the exact quote we froze.
    if (signedQuote.signedPayloadHash !== q.signatureProof?.signedPayloadHash) return result(meta, 'unknown', action, { code: 'STATUS_QUOTE_IDENTITY_MISMATCH', proof: signedQuote });
    const nested = body.quoteResponse?.quote;
    if (nested?.depositAddress !== q.depositAddress || (nested?.depositMemo ?? null) !== (q.depositMemo ?? null)) return result(meta, 'unknown', action, { code: 'STATUS_IDENTITY_MISMATCH', proof: signedQuote });
    const facts = normalizeProviderStatus(body, q);
    const refund = { provider: facts.providerRefund, service: { route: q.serviceRefundRoute ?? null, candidate: { state: 'not_indicated', reasons: [] } } };
    const evidence = [{ provider: meta.provider, reference: facts.correlationId ?? q.providerReference, observedAt: stamp(), mode, simulated: false, statusEvidenceRef: evidenceRef, ...(findingRef ? { independentEvidenceRef: findingRef } : {}) }];
    const base = { providerFacts: facts, refund, evidence, observation: { statusEvidenceRef: evidenceRef, findingRef: findingRef ?? null } };
    if (facts.classification !== 'success') {
      const status = facts.classification;
      return result(meta, status, action, { ...base, ...(status === 'unknown' ? { code: 'PROVIDER_STATUS_UNKNOWN' } : {}) });
    }
    const bound = bindSettlement({ quote: q, facts, finding, now: new Date(clock()).getTime() });
    const reasons = [];
    if (bound.withinInvoiceWindow === false) reasons.push('late_after_quote_deadline');
    if (bound.state === 'mismatch') for (const m of ['asset', 'amount', 'confidential']) if (bound.mismatches.includes(m)) reasons.push(`${m}_mismatch`);
    refund.service.candidate = reasons.length ? { state: 'candidate', reasons, decidedBy: 'M01-required' } : { state: bound.state === 'verified' ? 'not_indicated' : 'unknown', reasons: [] };
    // Evidence is authentic but is not bound to THIS invoice => unknown, never a payment verdict.
    const unbound = bound.state === 'mismatch' && bound.mismatches.some(m => !['asset', 'amount', 'confidential'].includes(m));
    const verified = bound.state === 'verified';
    const status = verified ? 'confirmed' : bound.state === 'mismatch' && !unbound ? 'confirmed' : 'unknown';
    const code = verified ? undefined : unbound ? 'SETTLEMENT_EVIDENCE_UNBOUND' : bound.code;
    const settlement = { schemaVersion: 1, id: facts.correlationId ?? q.providerReference, invoiceId: q.invoiceId, verified, mismatches: bound.mismatches ?? [],
      money: bound.money ?? null, recipient: bound.recipient ?? null, settledAt: bound.settledAt ?? null, withinInvoiceWindow: bound.withinInvoiceWindow ?? null,
      finality: bound.finality ?? 'unknown', mode, simulated: false, assurance: bound.assurance ?? 'provider-status-only',
      verificationLevel: verified ? 'independent-onchain-final-bound-to-signed-quote' : bound.state === 'bound_not_final' ? 'independent-evidence-bound-not-onchain-final' : 'signed-quote-only-mutable-settlement-unverified',
      signedEnvelopeVerified: true, signedQuoteBound: true, bindings: bound.checks, independentEvidence: finding ? { kind: bound.kind, evidenceRef: bound.evidenceRef, provenance: bound.provenance, matchedReferences: bound.matchedReferences ?? [] } : null,
      onchainMovementProven: verified, statusUpdatedAt: facts.statusUpdatedAt, signatureProof: signedQuote, reference: facts.correlationId ?? null,
      transactionIds: [...facts.hashes.destination, ...facts.hashes.near], providerFacts: facts, refund,
      settledAtSource: bound.settledAt ? `independent-evidence:${bound.kind}` : 'unavailable-status-update-is-not-settlement-time' };
    return result(meta, status, action, { ...base, settlement, receipt: settlement, ...(code ? { code } : {}) });
  }
  async function persist(q, outcome) {
    await journal.transaction({ actionId: `${ns}:observation:${q.id}:${digest(outcome)}`, fingerprint: digest(outcome) }, tx => { tx.put(ns + ':settlements', q.id, outcome); return outcome; });
    return outcome;
  }
  async function verifySettlement({ action, quote: q } = {}) {
    if (mode === 'unavailable' || mode === 'testnet') return unsupported(meta, action);
    const known = read(q?.id);
    if (!action?.id || !known || digest(known.quote) !== digest(q)) return result(meta, 'not_submitted', action, { code: 'CONFLICT' });
    const prior = journal.get(ns + ':settlements', q.id);
    if (prior?.status === 'confirmed' && prior.settlement?.verified) return prior;
    let outcome;
    try {
      const received = await client.statusWithEvidence(q);
      let finding = null, findingRef = null;
      if (received.body?.status === 'SUCCESS' && settlementEvidence?.verify) {
        const facts = normalizeProviderStatus(received.body, q);
        // Expected terms come from the frozen quote, never from mutable status fields.
        try { finding = await settlementEvidence.verify({ quote: q, providerStatus: { correlationId: facts.correlationId, status: received.body.status, swapDetails: received.body.swapDetails },
          expected: { account: q.recipient, asset: q.destination.asset, amount: q.destination.amount, recipientType: q.recipientType ?? null, references: providerReferences(q, facts) } }); }
        catch { finding = { status: 'unavailable' }; }
        if (finding && typeof finding === 'object') findingRef = `private:${(await journal.putArtifact({ actionId: `payment-independent-evidence:${digest(finding)}`, content: JSON.stringify(finding), mediaType: 'application/json' })).id}`;
      }
      outcome = await assess({ action, q, evidenceRef: received.evidenceRef, body: received.body, finding, findingRef });
    } catch { return result(meta, 'unknown', action, { code: 'PROVIDER_UNAVAILABLE' }); }
    return persist(q, outcome);
  }
  // Offline re-evaluation of the stored raw status bytes and stored independent evidence. No provider call.
  async function replay({ action, quote: q } = {}) {
    const known = read(q?.id), prior = journal?.get(ns + ':settlements', q?.id);
    if (!action?.id || !known || digest(known.quote) !== digest(q) || !prior?.observation?.statusEvidenceRef) return result(meta, 'not_submitted', action, { code: 'REPLAY_EVIDENCE_UNAVAILABLE' });
    try {
      const id = prior.observation.statusEvidenceRef.slice(8);
      const body = JSON.parse(Buffer.from(JSON.parse(journal.getArtifact({ id, hash: id }).content).response.bodyBase64, 'base64').toString('utf8'));
      const ref = prior.observation.findingRef; let finding = null;
      if (ref) { const fid = ref.slice(8); finding = JSON.parse(journal.getArtifact({ id: fid, hash: fid }).content); }
      return await assess({ action, q, evidenceRef: prior.observation.statusEvidenceRef, body, finding, findingRef: ref });
    } catch { return result(meta, 'unknown', action, { code: 'REPLAY_EVIDENCE_UNAVAILABLE' }); }
  }
  return { capabilities: () => structuredClone(meta), quote, verifySettlement,
    reconcile: verifySettlement, replay };
}
