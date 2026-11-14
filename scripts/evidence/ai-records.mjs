// Consistency of sanitized public records ONLY. No provider, private proof,
// credential, signing or financial writer port exists in this module.
const fail=code=>{throw Error(code);};
const amount=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v);
export function verifyAiRecords({calls,verification,outcomes,restart,validation,source}){
 if(!Array.isArray(calls)||calls.length!==2||verification.records?.length!==2)fail('AI_RECORD_COUNT_MISMATCH');
 const ids=new Set(),providers=new Set();let total=0n,escalations=0;
 for(const call of calls){
  const r=call.result,v=verification.records.find(v=>v.runId===r?.id);
  if(!r||!v||ids.has(r.id)||providers.has(r.providerRequestId)||!r.providerRequestId||v.providerRequestId!==r.providerRequestId)fail('AI_RECORD_BINDING_MISMATCH');
  ids.add(r.id);providers.add(r.providerRequestId);
  if(r.acceptance!=='live-process-e2ee'||r.offlinePlaintextRecovery!==false||r.fundingSource!=='owner-cloud-key'||v.acceptanceScope!=='live-process-e2ee'||v.durableReplayStatus!=='unavailable'||r.verification?.offlinePlaintextRecovery!==false)fail('AI_DEMO_SCOPE_CHANGED');
  if(v.sdk?.name!=='@nearai/inference-sdk'||v.sdk.version!=='0.3.0'||v.sdk.nodeEntry!==true||v.signatureKind!=='provider_tee'||v.wireSignatureVerified!==true||v.processVerificationStatus!=='verified'||v.plaintextBindingStatus!=='verified'||v.noncesVerified!==true||v.gatewayTcb!=='UpToDate'||!v.modelTcbs?.length||v.modelTcbs.some(t=>t!=='UpToDate'))fail('AI_RECORDED_FINDING_MISMATCH');
  if(!['answered','escalated'].includes(r.status)||v.status!==r.status||typeof r.answer!=='string'||!r.answer.trim()||!r.citations?.length||!r.sources?.length)fail('AI_RECORDED_OUTPUT_MISSING');
  for(const c of r.citations)if(!c.excerpt||!r.sources.some(s=>s.id===c.documentId&&s.revision===c.revision))fail('AI_CITATION_METADATA_MISMATCH');
  if(r.status==='escalated'){if(typeof r.ticketId!=='string'||!r.ticketId)fail('AI_ESCALATION_TICKET_MISSING');escalations++;}
  if(r.cost?.status!=='confirmed'||v.cost?.status!=='confirmed'||!amount(r.cost.actualCostNanoUsd)||r.cost.actualCostNanoUsd!==v.cost.actualCostNanoUsd||BigInt(r.cost.actualCostNanoUsd)<=0n)fail('AI_BILL_RECORD_MISMATCH');
  total+=BigInt(r.cost.actualCostNanoUsd);
 }
 if(outcomes.actualAcceptedReplies!==2||outcomes.providerOperations!==2||outcomes.unknownReservations!==0||outcomes.actualEscalationTicket!==true||outcomes.orderCount!==0||outcomes.totalActualNanoUsd!==total.toString()||escalations!==1)fail('AI_OUTCOME_RECORD_MISMATCH');
 if(restart.replayed!==true||restart.providerRequestId!==calls[0].result.providerRequestId||JSON.stringify(restart.before)!==JSON.stringify(restart.after))fail('AI_RESTART_RECORD_MISMATCH');
 if(validation.actual?.acceptedReplies!==2||validation.actual.totalBilledNanoUsd!==total.toString()||validation.actual.durablePlaintextRecovery!==false||validation.actual.plaintextAcceptance!=='official SDK in original live call'||validation.remainingCommercialGatesUnchanged!==true||validation.sourceHash!==source.sourceHash)fail('AI_VALIDATION_SCOPE_MISMATCH');
 return {scope:'sanitized-public-record-consistency-only',recordedPaidCalls:2,recordedCostNanoUsd:total.toString(),recordedEscalations:escalations,acceptanceScope:'live-process-e2ee',privateCryptographyReverifiedOffline:false,durablePlaintextRecovery:false,sourceCitationBytesReverifiedOffline:false,newPaidRequests:0};
}
