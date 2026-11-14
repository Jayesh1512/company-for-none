import { integer, money, sameAsset, validateMoney } from './config.mjs';

export const PUBLIC_FIELDS = Object.freeze(['id', 'type', 'sequence', 'at', 'category', 'costStatus', 'expenseCategory', 'evidenceRef', 'creditNanoUsd', 'orderId', 'actionId', 'status', 'mode', 'occurredAt', 'money', 'revenue', 'treasury', 'recipient', 'shareBps', 'obligationId', 'reservationId', 'upperBoundNanoUsd', 'actualCostNanoUsd', 'costNanoUsd', 'accountingDay', 'provenance', 'reference', 'policyVersion', 'reasonCode', 'observationId', 'scopeId', 'resource', 'watermark']);
const allow = extra => ({ status: 'allow', reasonCode: 'APPROVED', ...extra });
const deny = (reasonCode, extra) => ({ status: 'deny', reasonCode, ...extra });
const hold = (reasonCode, extra) => ({ status: 'hold', reasonCode, ...extra });
export { allow, deny, hold };

export function inferenceAdmission(actionId,financial,config){
  if(!config?.autonomy)return null; // Historical/manual test compositions opt in explicitly.
  return (financial?.reservations??[]).some(r=>r.purpose==='inference'&&r.actionId!==actionId&&!['released','reconciled','failed'].includes(r.status))?hold('COMMON_INFERENCE_BUSY'):null;
}

/** Contributor amounts round DOWN; the indivisible remainder belongs to treasury. */
export function calculateSplit(revenue, offer) {
  validateMoney(revenue);
  if (!sameAsset(revenue, offer.settlementAsset)) throw new TypeError('revenue asset differs from frozen offer');
  if (!Array.isArray(offer.contributors) || !offer.contributors.length || offer.treasuryBps + offer.contributors.reduce((a, x) => a + x.bps, 0) !== 10000 || offer.contributors.some(x => !Number.isInteger(x.bps) || x.bps < 1 || x.bps > 10000)) throw new TypeError('invalid frozen shares');
  const total = integer(revenue.amount);
  const contributors = offer.contributors.map(x => ({ recipient: x.account, shareBps: x.bps, money: money(revenue, total * BigInt(x.bps) / 10000n) }));
  const due = contributors.reduce((sum, x) => sum + integer(x.money.amount), 0n);
  return { revenue: structuredClone(revenue), contributors, treasury: money(revenue, total - due), rounding: 'contributor_floor_treasury_remainder' };
}
export function makeOffer(config, version, now, action) {
  if(config.mode==='live'&&config.settlementRecipientType!=='CONFIDENTIAL_INTENTS')return hold('SETTLEMENT_ROUTE_UNVERIFIED');
  const requested = action.paymentAsset ?? action.sourceAsset ?? config.customerAssets[0];
  if (!config.customerAssets.some(x => sameAsset(x, requested))) return deny('UNSUPPORTED_ASSET');
  const price = action.money ?? money(config.settlementAsset, action.amount ?? config.pricing.minimumAtomic);
  validateMoney(price);
  if (!sameAsset(price, config.settlementAsset)) return deny('UNSUPPORTED_ASSET');
  if (integer(price.amount) < integer(config.pricing.minimumAtomic)) return deny('PRICE_BELOW_FLOOR');
  return allow({ offer: {
    schemaVersion: 1, id: `offer:${action.id}`, orderId: action.orderId,
    policyVersion: version, configVersion: version, minimumPrice: money(config.settlementAsset, config.pricing.minimumAtomic),
    price, ...(config.mode==='live'?{recipientType:config.settlementRecipientType}:{}), settlementAsset: { ...config.settlementAsset }, treasuryAccount: config.treasuryAccount,
    contributors: structuredClone(config.revenue.contributors), treasuryBps: config.revenue.treasuryBps,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + config.pricing.invoiceTtlMs).toISOString(),
    refund: structuredClone(config.refund), research: structuredClone(config.research), mode: config.mode,
    paymentAsset: structuredClone(requested), rounding: 'contributor_floor_treasury_remainder',
  } });
}
export function assessSettlement(action, facts, now) {
  const { offer, payment } = facts;
  if (!offer || !payment) return hold('PAYMENT_FACTS_REQUIRED');
  if (payment.status === 'unknown' || payment.status === 'pending') return hold('PAYMENT_UNRESOLVED');
  if (payment.status !== 'confirmed' || payment.verified !== true) return deny('UNVERIFIED_PAYMENT');
  validateMoney(payment.money);
  if (!sameAsset(payment.money, offer.price) || payment.recipient !== offer.treasuryAccount) return deny('SETTLEMENT_MISMATCH');
  if (integer(payment.money.amount) < integer(offer.price.amount)) return deny('UNDERPAID');
  const received = Date.parse(payment.confirmedAt ?? payment.settledAt ?? payment.observedAt);
  if (!Number.isFinite(received)) return hold('PAYMENT_TIME_REQUIRED');
  if (payment.withinInvoiceWindow === false || received > Date.parse(offer.expiresAt)) return hold('LATE_PAYMENT_REMEDY', { nextAction: 'refund', plan: { nextAction: 'refund', orderPatch: { remedyRequired: true, paymentConfirmed: true, reasonCode: 'LATE_PAYMENT_REMEDY' } } });
  if (facts.order?.allocated === true) return hold('ALREADY_ALLOCATED');
  return allow({ settlement: { accepted: true, money: structuredClone(payment.money), receivedAt: new Date(received).toISOString() } });
}
export function allocation(action, facts, now) {
  const accepted = assessSettlement(action, facts, now);
  if (accepted.status !== 'allow') return accepted;
  const split = calculateSplit(facts.payment.money, facts.offer);
  const settlementId = facts.payment.id ?? facts.payment.reference;
  if (!settlementId) return hold('SETTLEMENT_REFERENCE_REQUIRED');
  if (!facts.financial || !Array.isArray(facts.financial.balances) || !Array.isArray(facts.financial.protectedFunds)) return hold('FINANCIAL_FACTS_REQUIRED');
  const contributorReserve = money(split.revenue, split.contributors.reduce((sum, x) => sum + integer(x.money.amount), 0n));
  const existingBalance = facts.financial.balances.filter(x => sameAsset(x, split.revenue)).reduce((sum, x) => sum + integer(x.amount), 0n);
  const protectedAmount = facts.financial.protectedFunds.filter(x => sameAsset(x, split.revenue)).reduce((sum, x) => sum + integer(x.amount), 0n);
  if (existingBalance + integer(split.revenue.amount) < protectedAmount + integer(split.revenue.amount) + integer(contributorReserve.amount)) return hold('REFUND_RESERVE_UNFUNDED');
  const obligations = split.contributors.map((x, i) => ({ schemaVersion: 1, id: `obligation:${action.orderId}:${i}`, orderId: action.orderId, settlementId, ...x, frozenPolicyVersion: facts.offer.policyVersion, completedAmount: '0', status: 'due' }));
  return allow({ plan: { kind: 'allocation', id: `allocation:${action.orderId}`, settlementId, orderId: action.orderId, revenue: split.revenue, treasury: split.treasury, contributorReserve, obligations, refundExposure: structuredClone(split.revenue), refundReserve: structuredClone(split.revenue), rounding: split.rounding } });
}
export function spend(action, facts, config, now) {
  if(action.type==='inference'){const admitted=inferenceAdmission(action.id,facts.financial,config);if(admitted)return admitted;}
  const financial = facts.financial;
  if (!financial || !Number.isSafeInteger(financial.version) || financial.version < 0) return hold('FINANCIAL_FACTS_REQUIRED');
  const operation = facts.operation;
  if (operation && ['unknown', 'pending'].includes(operation.status)) return hold('EXTERNAL_OUTCOME_UNRESOLVED');
  if (action.maxCostNanoUsd == null) return hold('COST_BOUND_UNKNOWN');
  const cost = integer(action.maxCostNanoUsd, 'maxCostNanoUsd');
  if (cost === 0n) return deny('INVALID_COST_BOUND');
  const limit = action.type === 'funding' ? config.spending.maxFundingNanoUsd : config.spending.maxRequestNanoUsd;
  if (cost > integer(limit)) return deny('REQUEST_CAP_EXCEEDED');
  const reservations = financial.reservations ?? [];
  if (!Array.isArray(reservations)) throw new TypeError('reservations must be an array');
  if (reservations.some(x => x.actionId === action.id && !['released', 'reconciled', 'failed'].includes(x.status))) return hold('ACTION_ALREADY_RESERVED');
  // Unknown charges never become free headroom at UTC midnight.
  if (reservations.some(x => x.status === 'unknown')) return hold('UNRESOLVED_SPEND');
  const accountingDay = new Date(now).toISOString().slice(0, 10);
  if (action.type === 'inference') {
    if(config.mode==='live'&&!(financial.credits?.lots??[]).some(c=>c.id===facts.creditId&&Date.parse(c.expiresAt)>now&&integer(c.availableNanoUsd)>=cost))return hold('PREPAID_CREDIT_REQUIRED');
    if(config.mode==='live' && (!facts.request?.chargeBound?.verified || facts.request.chargeBound.completionTokensIncludeReasoning!==true || !facts.request.chargeBound.reference))return hold('BOUNDS_UNESTABLISHED');
    if (typeof action.requestFingerprint !== 'string' || !action.requestFingerprint) return hold('REQUEST_FINGERPRINT_REQUIRED');
    if (financial.dailyCosts?.[accountingDay] == null) return hold('DAILY_COST_FACTS_REQUIRED');
    const actual = integer(financial.dailyCosts[accountingDay]);
    const held = reservations.filter(x => !['released', 'reconciled', 'failed'].includes(x.status) && x.purpose !== 'funding').reduce((sum, x) => sum + integer(x.upperBoundNanoUsd), 0n);
    if (actual + held + cost > integer(config.spending.dailyInferenceCapNanoUsd)) return deny('DAILY_CAP_EXCEEDED');
    if (financial.credits?.availableNanoUsd == null) return hold('CREDIT_FACTS_REQUIRED');
    const creditHeld = reservations.filter(x => !['released', 'reconciled', 'failed'].includes(x.status) && x.purpose === 'inference').reduce((sum, x) => sum + integer(x.upperBoundNanoUsd), 0n);
    if (integer(financial.credits.availableNanoUsd) < creditHeld + cost) return hold('INSUFFICIENT_CREDIT', { nextAction: 'funding', requiredCreditNanoUsd: (creditHeld + cost - integer(financial.credits.availableNanoUsd)).toString() });
    const bounds = action.bounds;
    if (!bounds || !['inputTokens', 'outputTokens', 'reasoningTokens'].every(k => Number.isSafeInteger(bounds[k]) && bounds[k] >= 0)) return hold('TOKEN_BOUNDS_REQUIRED');
    if (bounds.inputTokens > config.research.maxInputTokens || bounds.outputTokens > config.research.maxOutputTokens || bounds.reasoningTokens > config.research.maxReasoningTokens) return deny('TOKEN_BOUND_EXCEEDED');
  } else {
    if (facts.capabilities?.funding === false) return hold('UNSUPPORTED_CAPABILITY');
    if (!config.spending.fundingRecipients.includes(action.recipient)) return deny('RECIPIENT_NOT_ALLOWED');
    if (!action.money) return hold('FUNDING_RESOURCE_REQUIRED');
    validateMoney(action.money);
    if (!sameAsset(action.money, config.settlementAsset)) return deny('UNSUPPORTED_ASSET');
    if (action.agentId !== config.treasuryAccount || action.requiredCreditNanoUsd == null) return hold('FUNDING_IDENTITY_REQUIRED');
    if (integer(action.requiredCreditNanoUsd) !== cost) return deny('FUNDING_BOUND_MISMATCH');
    const approvedAtomic = (cost * integer(config.spending.fixtureFundingAtomicPerUsd) + 999_999_999n) / 1_000_000_000n;
    if (integer(action.money.amount) !== approvedAtomic) return deny('FUNDING_AMOUNT_MISMATCH');
    const balance = (financial.balances ?? []).find(x => sameAsset(x, action.money));
    if (!balance) return hold('BALANCE_FACTS_REQUIRED');
    // Treasury supplies protected funds as facts; never borrow contributor or refund resources.
    const reserved = (financial.protectedFunds ?? []).filter(x => sameAsset(x, action.money)).reduce((sum, x) => sum + integer(x.amount), 0n);
    const locked = reservations.filter(x => !['released', 'reconciled', 'failed'].includes(x.status) && x.resource && sameAsset(x.resource, action.money)).reduce((sum, x) => sum + integer(x.resource.amount), 0n);
    if (integer(balance.amount) < reserved + locked + integer(action.money.amount)) return deny('INSUFFICIENT_FUNDS');
  }
  return allow({ plan: { kind: 'reservation', reservation: { schemaVersion: 1, id: `reservation:${action.id}`, actionId: action.id, orderId: action.orderId, purpose: action.type, accountingDay, upperBoundNanoUsd: cost.toString(), status: 'reserved', ...(action.money ? { resource: structuredClone(action.money) } : {}) } } });
}
export function retry(action, facts, config) {
  const op = facts.operation;
  if (!op) return hold('OPERATION_FACTS_REQUIRED');
  if (['unknown', 'pending'].includes(op.status)) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  if (op.status === 'confirmed') return deny('ALREADY_CONFIRMED');
  const attempts = Array.isArray(op.attempts) ? op.attempts.length : op.attempts;
  if (!Number.isSafeInteger(attempts) || attempts < 0) return hold('ATTEMPT_FACTS_REQUIRED');
  if (attempts >= config.retry.maxAttempts) return deny('RETRY_EXHAUSTED', { nextAction: 'refund' });
  if (op.status !== 'not_submitted' && !(op.status === 'failed' && op.definitiveNoEffect === true && op.costReconciled === true)) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  const operationId = op.id ?? op.actionId;
  if (typeof operationId !== 'string' || !operationId) return hold('OPERATION_ID_REQUIRED');
  return allow({ retryPlan: { operationId, nextAttempt: attempts + 1, nextActionId: `${operationId}:attempt:${attempts + 1}`, retryOf: operationId, reuseActionId: false, requireFreshAuthorization: true, priorEffectProvenAbsent: true } });
}
function inspectSources(sources, spec, now) {
  const failures = [];
  const qualifications = [];
  let publicationDateMissing = false;
  if (!Array.isArray(sources)) failures.push('source_records_required');
  else if (sources.length < spec.minSources || sources.length > spec.maxSources) failures.push('source_count');
  if (Array.isArray(sources)) for (const source of sources) {
    if (!source || typeof source !== 'object') { failures.push('source_evidence'); continue; }
    const publicationDate = source.publishedAt ?? (source.retrievedAt ? null : source.date);
    const date = Date.parse(publicationDate ?? (spec.allowUnknownPublicationDates ? source.retrievedAt ?? source.date : null));
    if (!publicationDate) { publicationDateMissing = true; qualifications.push(`Publication date unknown for ${source.id ?? source.url}; retrieval date is not a publication date.`); }
    if (source.retrieved === false || typeof source.url !== 'string' || !/^https?:\/\//.test(source.url) || !Number.isFinite(date) || date > now || now - date > spec.maxSourceAgeDays * 86_400_000 || (spec.freeSourcesOnly && source.paid === true)) failures.push('source_evidence');
  }
  if (publicationDateMissing && !spec.allowUnknownPublicationDates) failures.push('publication_date_required');
  if (Array.isArray(sources) && new Set(sources.map(x => x?.url)).size !== sources.length) failures.push('duplicate_sources');
  return { failures, qualifications };
}
/** Check retrieved evidence BEFORE any paid generation; report acceptance remains separate. */
export function assessEvidence(facts, config, now) {
  const pack = facts.evidencePack ?? facts.order?.evidencePack;
  const spec = facts.offer?.research ?? config.research;
  const { failures, qualifications } = inspectSources(pack?.sources, spec, now);
  if (!pack || pack.orderId !== facts.order?.id) failures.push('evidence_order');
  if (!Array.isArray(pack?.errors) || pack.errors.length) failures.push('retrieval');
  let inputChars = 0;
  if (Array.isArray(pack?.sources)) {
    if (pack.sources.length > Math.min(spec.maxSources, spec.maxQueries)) failures.push('source_bound');
    const ids = new Set();
    for (const source of pack.sources) {
      if (!source || typeof source !== 'object') continue;
      if (typeof source.id !== 'string' || !source.id || ids.has(source.id)) failures.push('source_identity');
      ids.add(source.id);
      const retrievedAt = Date.parse(source.retrievedAt);
      if (source.retrieved === false || !Number.isFinite(retrievedAt) || retrievedAt > now) failures.push('retrieval_facts');
      if (typeof source.text !== 'string' || !source.text.trim()) failures.push('empty_source');
      else {
        inputChars += source.text.length;
        const bytes = Buffer.byteLength(source.text, 'utf8');
        if (bytes > spec.maxBytesPerSource || (source.bytes !== undefined && (!Number.isSafeInteger(source.bytes) || source.bytes < bytes || source.bytes > spec.maxBytesPerSource))) failures.push('source_byte_bound');
      }
    }
  }
  if (inputChars > spec.maxInputChars) failures.push('input_bound');
  if (failures.length) {
    const reasonCode = failures.includes('publication_date_required') ? 'EVIDENCE_PUBLICATION_DATE_REQUIRED' : 'EVIDENCE_REQUIREMENTS_NOT_MET';
    return hold(reasonCode, { nextAction: 'refund', plan: { kind: 'evidence', accepted: false, failures: [...new Set(failures)], nextAction: 'refund', orderPatch: { remedyRequired: true, evidenceReady: false, reasonCode } } });
  }
  return allow({ plan: { kind: 'evidence', accepted: true, qualifications } });
}
export function assessReport(facts, config, now) {
  const report = facts.reportFacts ?? facts.report;
  if (!report) return hold('REPORT_FACTS_REQUIRED');
  const spec = facts.offer?.research ?? config.research;
  const sources = report.sources ?? facts.evidencePack?.sources;
  const { failures, qualifications } = inspectSources(sources, spec, now);
  if (!Number.isSafeInteger(report.wordCount) || report.wordCount < spec.minWords || report.wordCount > spec.maxWords) failures.push('word_count');
  const sourceCount = report.sourceCount ?? sources?.length;
  if (!Number.isSafeInteger(sourceCount) || sourceCount < spec.minSources || sourceCount > spec.maxSources) failures.push('source_count');
  if (Array.isArray(sources) && sources.length !== sourceCount) failures.push('source_records_required');
  if (report.generated !== true) failures.push('not_generated');
  if (!Number.isSafeInteger(report.datedSourceCount) || report.datedSourceCount < spec.minSources) failures.push('dated_sources');
  if (!Number.isSafeInteger(report.citationCount) || report.citationCount < spec.minSources) failures.push('citations');
  if (!Array.isArray(report.unknownSourceReferences) || report.unknownSourceReferences.length || !Array.isArray(report.uncitedSourceIds) || report.uncitedSourceIds.length) failures.push('source_references');
  if (!Array.isArray(report.emptySourceIds) || report.emptySourceIds.length || !Array.isArray(report.sourceErrors) || report.sourceErrors.length) failures.push('retrieval');
  const overlapCount = Array.isArray(report.questionOverlapTokens) ? report.questionOverlapTokens.length : report.questionOverlapTokens;
  if (!Number.isSafeInteger(overlapCount) || overlapCount < spec.minQuestionOverlapTokens) failures.push('relevance_overlap');
  if (!Number.isSafeInteger(report.excerptCount) || report.excerptCount < spec.minEvidenceExcerpts) failures.push('evidence_excerpts');
  if (report.hasUncertainty !== true) failures.push('uncertainty');
  if (!spec.requiredSections.every(section => report.sections?.includes(section) || report[`has${section[0].toUpperCase()}${section.slice(1)}`] === true)) failures.push('sections');
  if (report.unsafeContent === true) failures.push('unsafe_content');
  return failures.length ? hold(failures.includes('publication_date_required') ? 'REPORT_PUBLICATION_DATE_REQUIRED' : 'REPORT_REQUIREMENTS_NOT_MET', { reportAcceptance: { accepted: false, failures: [...new Set(failures)] }, plan: { nextAction: 'refund', orderPatch: { remedyRequired: true, reasonCode: failures.includes('publication_date_required') ? 'REPORT_PUBLICATION_DATE_REQUIRED' : 'REPORT_REQUIREMENTS_NOT_MET' } } }) : allow({ reportAcceptance: { accepted: true, requirements: structuredClone(spec), artifactId: report.id ?? facts.artifact?.id, qualifications, limitations: 'Structural grounding and overlap checks do not prove every conclusion true.' } });
}
export function access(action, facts, config) {
  const identity = facts.access ?? {};
  const resource = action.resource;
  if (resource === 'workspace') return ((config.mode === 'fixture' && identity.verifiedLocal === true) || (identity.verified===true&&identity.role==='owner')) ? allow({accessPlan:{audience:'local_workspace',resource,grantsSpendingAuthority:false}}) : deny('ACCESS_DENIED');
  if (resource === 'ledger' || resource === 'storefront') return (resource === 'storefront' || config.access.publicLedger) ? allow({ accessPlan: { audience: 'public', resource, fields: [...PUBLIC_FIELDS] } }) : deny('ACCESS_DENIED');
  if (resource === 'owner') return config.access.ownerControls && identity.verified === true && identity.role === 'owner' ? allow({ accessPlan: { audience: 'owner', resource } }) : deny('ACCESS_DENIED');
  if (resource === 'report' || resource === 'order') {
    if (!config.access.customerReports || identity.verified !== true || !identity.customerId || identity.customerId !== facts.order?.customerId) return deny('ACCESS_DENIED');
    if (resource === 'report' && !(facts.order?.reportAccepted && facts.order?.reportAvailable)) return hold('REPORT_NOT_AVAILABLE');
    return allow({ accessPlan: { audience: 'customer', resource, orderId: facts.order.id, artifactId: facts.order.reportId } });
  }
  return deny('UNKNOWN_RESOURCE');
}
export function nextAction(facts, config, now) {
  const order = facts.order;
  if (!order) return allow({ nextAction: 'offer' });
  if (order.remedyRequired) return allow({ nextAction: 'refund' });
  if ([order.fundingOutcome, order.generationOutcome, order.payoutOutcome, order.refundOutcome, order.procurementOutcome].some(x => x && ['pending', 'unknown'].includes(x.status))) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  if (facts.operation && ['pending', 'unknown'].includes(facts.operation.status)) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  if (!order.offer) return allow({ nextAction: 'offer' });
  if (!order.paymentConfirmed) return allow({ nextAction: 'settlement' });
  if (!order.allocated) return allow({ nextAction: 'allocate' });
  if (!order.creditReady) {
    const eligible=(facts.financial?.credits?.lots??[]).filter(c=>config.mode==='fixture'||Date.parse(c.expiresAt)>now);
    const available = config.mode==='fixture'?integer(facts.financial?.credits?.availableNanoUsd??'0'):eligible.reduce((s,c)=>s+integer(c.availableNanoUsd),0n);
    const target = integer(config.spending.maxRequestNanoUsd);
    const selected=eligible.find(c=>integer(c.availableNanoUsd)>=target);
    if (selected && available>=target) return allow({ nextAction: 'credit_ready', plan: { kind: 'credit_ready', creditId:selected.id, availableNanoUsd: available.toString() } });
    if(config.mode!=='fixture')return hold('PREPAID_CREDIT_REQUIRED');
    const needed = target - available;
    const amount = (needed * integer(config.spending.fixtureFundingAtomicPerUsd) + 999_999_999n) / 1_000_000_000n;
    const command = { id: `${order.id}:funding`, type: 'funding', orderId: order.id, mode: config.mode, agentId: config.treasuryAccount, recipient: config.spending.fundingRecipients[0], money: money(config.settlementAsset, amount), maxCostNanoUsd: needed.toString(), requiredCreditNanoUsd: needed.toString() };
    return allow({ nextAction: 'funding', plan: { kind: 'next', action: command, requiredCreditNanoUsd: needed.toString() } });
  }
  if(config.procurement?.enabled&&!order.procurementReady){
    if(config.mode!=='fixture')return hold('LIVE_PROCUREMENT_UNAVAILABLE');
    const p=config.procurement;
    if(facts.licenses?.some(x=>x.listingId===p.listingId&&x.version===(facts.procurementListing?.version??'1')))return allow({nextAction:'procurement_ready',plan:{kind:'next',listingId:p.listingId}});
    return allow({nextAction:'procurement',plan:{kind:'next',action:{id:`${order.id}:procurement`,type:'procurement',orderId:order.id,mode:config.mode,listingId:p.listingId,recipient:p.recipient,money:structuredClone(p.money),maxCostNanoUsd:p.maxCostNanoUsd}}});
  }
  if (!order.evidenceReady) return allow({ nextAction: 'research' });
  if (!order.generationComplete) {
    const spec = facts.offer?.research ?? config.research;
    return allow({ nextAction: 'inference', plan: { kind: 'next', action: { id: `${order.id}:inference`, type: 'inference', orderId: order.id, mode: config.mode, maxCostNanoUsd: config.spending.maxRequestNanoUsd, bounds: { inputTokens: spec.maxInputTokens, outputTokens: spec.maxOutputTokens, reasoningTokens: spec.maxReasoningTokens } } } });
  }
  if (!order.reportAccepted) return allow({ nextAction: 'report' });
  if (!order.reportAvailable) return allow({ nextAction: 'deliver' });
  if (!order.payoutConfirmed) return allow({ nextAction: 'payout' });
  if (!order.costReconciled) return hold('COST_RECONCILIATION_REQUIRED', { nextAction: 'reconcile' });
  return allow({ nextAction: 'complete' });
}
export function payout(action, facts) {
  const obligation = facts.obligation;
  if (!obligation) return hold('OBLIGATION_FACTS_REQUIRED');
  if (!facts.order?.reportAccepted || !facts.order?.reportAvailable) return hold('REPORT_NOT_AVAILABLE');
  if (['pending', 'unknown'].includes(facts.operation?.status)) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  validateMoney(obligation.money);
  const remaining = integer(obligation.money.amount) - integer(obligation.completedAmount ?? '0');
  if (remaining < 0n) return deny('OBLIGATION_CORRUPT');
  if (remaining === 0n) return deny('ALREADY_PAID');
  const due = money(obligation.money, remaining);
  if ((action.recipient && action.recipient !== obligation.recipient) || (action.money && (!sameAsset(action.money, due) || action.money.amount !== due.amount))) return deny('FROZEN_OBLIGATION_MISMATCH');
  const reserve = facts.financial?.protectedFunds?.find(x => x.obligationId === obligation.id && x.purpose === 'contributor' && sameAsset(x, due));
  if (!reserve || integer(reserve.amount) < remaining) return hold('CONTRIBUTOR_RESERVE_REQUIRED');
  return allow({ plan: { kind: 'payout', obligationId: obligation.id, recipient: obligation.recipient, money: due, completedAmount: obligation.money.amount, status: 'pending' }, recipient: obligation.recipient, money: due });
}
export function refund(action, facts) {
  if (!facts.order?.remedyRequired) return deny('REFUND_NOT_ELIGIBLE');
  if (!facts.payment || facts.payment.status !== 'confirmed' || facts.payment.verified !== true) return hold('PAYMENT_FACTS_REQUIRED');
  if (['pending', 'unknown'].includes(facts.operation?.status)) return hold('RECONCILE_REQUIRED', { nextAction: 'reconcile' });
  if (facts.order.refundConfirmed) return deny('ALREADY_REFUNDED');
  if (!facts.offer?.refund?.fullSettlement || facts.offer.refund.feeTreatment !== 'shop_pays' || !facts.order.refundRecipient) return hold('REFUND_ROUTE_REQUIRED');
  if(facts.order.mode==='live'&&facts.order.sourceAsset?.network!==facts.payment.money?.network)return hold('CROSS_CHAIN_REFUND_ROUTE_REQUIRED');
  validateMoney(facts.payment.money);
  const due = structuredClone(facts.payment.money);
  const balance = facts.financial?.balances?.find(x => sameAsset(x, due));
  if (!balance || integer(balance.amount) < integer(due.amount)) return hold('REFUND_FUNDS_REQUIRED');
  const reserve = facts.financial?.protectedFunds?.find(x => x.orderId === facts.order.id && x.purpose === 'refund' && sameAsset(x, due));
  if (!reserve || integer(reserve.amount) < integer(due.amount)) return hold('REFUND_RESERVE_REQUIRED');
  if ((action.recipient && action.recipient !== facts.order.refundRecipient) || (action.money && (!sameAsset(action.money, due) || action.money.amount !== due.amount))) return deny('REFUND_INSTRUCTION_MISMATCH');
  return allow({ plan: { kind: 'refund_intent', orderId: facts.order.id, recipient: facts.order.refundRecipient, money: due, feeTreatment: 'shop_pays', reverseAllocationOnlyOnConfirmation: true, clawbackContributor: false }, recipient: facts.order.refundRecipient, money: due });
}
export function eligibility(type, facts) {
  const order = facts.order;
  if (!order) return hold('ORDER_FACTS_REQUIRED');
  if (order.remedyRequired && !['refund', 'reconcile'].includes(type)) return hold('REMEDY_REQUIRED', { nextAction: 'refund' });
  const needed = { funding: ['paymentConfirmed', 'allocated'], research: ['paymentConfirmed', 'allocated'], evidence: ['paymentConfirmed', 'allocated'], inference: ['paymentConfirmed', 'allocated', 'evidenceReady'], report: ['generationComplete'], deliver: ['reportAccepted'], payout: ['reportAccepted', 'reportAvailable'], complete: ['paymentConfirmed', 'allocated', 'reportAccepted', 'reportAvailable', 'payoutConfirmed', 'costReconciled'] }[type];
  if (needed?.some(key => order[key] !== true)) return hold('ORDER_NOT_ELIGIBLE', { requiredFacts: needed });
  return allow();
}
