import { readFileSync } from 'node:fs';
import { parseConfigYaml } from '../../src/rules/index.mjs';
export const NOW = Date.parse('2026-11-11T12:00:00Z');
export const config = () => parseConfigYaml(readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
export const cash = amount => ({ network: 'fixture', asset: 'demo-usdc', decimals: 6, amount });
export function financial() {
  return { schemaVersion: 1, version: 1, balances: [cash('100000000')], protectedFunds: [], dailyCosts: { '2026-11-11': '0' }, reservations: [], credits: { availableNanoUsd: '1000000000', lots: [{ id: 'credit1', owner: 'fixture-treasury', provider: 'fixture', availableNanoUsd: '1000000000', provenance: 'agent_funded' }] }, obligations: [], allocations: [], consumedPermits: [], approvedPlans: [], receipts: [] };
}
export function evidencePack() {
  return { orderId: 'o1', mode: 'fixture', errors: [], sources: [1, 2, 3].map(x => ({ id: `S${x}`, url: `https://evidence.example/${x}`, text: 'Dated market research evidence.', publishedAt: '2026-10-01', retrievedAt: '2026-11-11T11:00:00Z', retrieved: true, paid: false })) };
}
export const order = () => ({ id: 'o1', version: 1, customerId: 'c1', offer: true, paymentConfirmed: true, allocated: true, creditReady: true, evidenceReady: true, evidencePack: evidencePack(), generationComplete: true, reportAccepted: true, reportAvailable: true, payoutConfirmed: true, costReconciled: true, reportId: 'r1', refundRecipient: 'customer', mode: 'fixture' });
export const inference = () => ({ id: 'o1:inference', type: 'inference', orderId: 'o1', mode: 'fixture', maxCostNanoUsd: '100000000', requestFingerprint: 'fixture-request-hash', bounds: { inputTokens: 10000, outputTokens: 1400, reasoningTokens: 1000 } });
export function reportFacts() {
  return { id: 'r1', generated: true, wordCount: 500, sourceCount: 3, datedSourceCount: 3, citationCount: 3, unknownSourceReferences: [], uncitedSourceIds: [], hasFindings: true, hasImplications: true, hasUncertainty: true, emptySourceIds: [], sourceErrors: [], mode: 'fixture', questionOverlapTokens: ['market'], excerptCount: 3, directEvidenceQuoted: true,
    sources: [1, 2, 3].map(x => ({ url: `https://evidence.example/${x}`, date: '2026-10-01', retrieved: true, paid: false, cited: true, excerptPresent: true })) };
}
/** Model persisted proof facts, not another authorization implementation. */
export function persisted(decision, before, consumed = true) {
  const state = structuredClone(before);
  state.approvedPlans.push({ actionId: decision.actionId, fingerprint: decision.actionFingerprint, policyEpoch: decision.policyEpoch, authorizationId:decision.authorizationId??null, inputVersion: before.version, appliedVersion: before.version + 1, plan: structuredClone(decision.plan) });
  if (decision.plan?.reservation) state.reservations.push(structuredClone(decision.plan.reservation));
  state.version++;
  if (consumed) { state.version++; state.consumedPermits.push({ ...decision.permit, consumedAt: new Date(NOW).toISOString(), financialVersion: state.version }); }
  return state;
}
