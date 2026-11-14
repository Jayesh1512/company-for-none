// Injected independent-evidence port for payments (S4). It returns the receipt's exact signed
// terms plus log provenance; the caller re-compares terms to its own frozen quote.
// Receipts exist only for executions run through this Agent API (transfer/deposit/...). A third-party
// 1Click delivery to the confidential account has no receipt and no op_ correlation: unavailable.
export function createAgentSettlementEvidence({ movement, acquire } = {}) {
  const unavailable = (code, extra = {}) => ({ status: 'unavailable', kind: 'agent-receipt-log', assurance: 'log-attested-exact-terms', finality: 'not_established', code, ...extra });
  return {
    async verify({ quote, providerStatus, expected } = {}) {
      const correlation = expected?.agentCorrelationId;
      if (typeof correlation !== 'string' || !/^op_/.test(correlation)) return unavailable('AGENT_EXECUTION_CORRELATION_REQUIRED');
      if (!movement || typeof acquire !== 'function') return unavailable('MOVEMENT_VERIFIER_UNAVAILABLE');
      let bundle;
      // `acquire` is a private composition port: it supplies the ORIGINAL admitted body binding
      // (never the caller's JSON) and either fresh proof material or a retained evidenceRef.
      try { bundle = await acquire({ agentCorrelationId: correlation, quote, providerStatus, expected }); } catch { return unavailable('PROOF_ACQUISITION_UNAVAILABLE'); }
      if (!bundle || bundle.expected?.correlationId !== correlation) return unavailable('AGENT_EXECUTION_BINDING_MISMATCH');
      let result;
      try {
        result = bundle.evidenceRef ? await movement.replay({ evidenceRef: bundle.evidenceRef, expected: bundle.expected })
          : await movement.capture({ expected: bundle.expected, receipt: bundle.receipt, operation: bundle.operation });
      } catch { return unavailable('MOVEMENT_VERIFICATION_UNAVAILABLE'); }
      // Anything short of verified (pending, invalid, unavailable) is "unavailable" here: invalid
      // evidence never proves the settlement FAILED, and never becomes success.
      if (result.status !== 'verified') return unavailable(result.code ?? 'MOVEMENT_UNVERIFIED', { proofStatus: result.status });
      return { status: 'verified', kind: 'agent-receipt-log', assurance: result.assurance, finality: 'not_established', receiptType: result.receiptType,
        terms: structuredClone(result.terms), account: result.account, accountBinding: result.accountBinding, committedEvidence: structuredClone(result.committed),
        references: [...result.references], settledAt: result.settledAt, provenance: structuredClone(result.provenance), evidenceRef: result.evidenceRef };
    },
  };
}
