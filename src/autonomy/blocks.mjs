/** Truthful, display-only explanation of an M01 reason code. This never grants, clears or
 * changes anything: it only tells the owner what kind of blocker it is and whether any local
 * action could change it. Unknown codes are returned verbatim as kind 'other'. */
const EXACT={
 AUTONOMY_POLICY_REQUIRED:{kind:'authority',recoverable:true,ownerAction:'Attach an explicit owner autonomy policy; none is assumed.'},
 OWNER_START_REQUIRED:{kind:'owner',recoverable:true,ownerAction:'Press Start once the setup is reviewed.'},
 AUTONOMY_NOT_RUNNING:{kind:'owner',recoverable:true,ownerAction:'Start or resume the company.'},
 OWNER_PAUSED:{kind:'owner',recoverable:true,ownerAction:'Resume when ready; stopped work is never cancelled remotely.'},
 KILL_SWITCH:{kind:'safety',recoverable:false,ownerAction:'Policy kill switch is on. Nothing runs until the policy owner changes it.'},
 RECONCILE_REQUIRED:{kind:'reconcile',recoverable:true,ownerAction:'An original provider effect must be reconciled; it is never resent.'},
 CHILD_WORK_PENDING:{kind:'dependency',recoverable:true,ownerAction:'Waiting for delegated work to complete.'},
 WORK_DEPENDENCIES_UNRESOLVED:{kind:'dependency',recoverable:true,ownerAction:'Waiting for dependencies or an actual provider bill.'},
 COMPANY_CLAIM_BUSY:{kind:'dependency',recoverable:true,ownerAction:'Another worker holds the single company claim.'},
 OBJECTIVE_BUDGET_EXHAUSTED:{kind:'budget',recoverable:false,ownerAction:'Step budget is spent. Counters never reset; replace the objective to continue.'},
 OBJECTIVE_CALL_LIMIT:{kind:'budget',recoverable:false,ownerAction:'Call or input-byte budget is spent. Replace the objective to continue.'},
 OBJECTIVE_INPUT_LIMIT:{kind:'budget',recoverable:false,ownerAction:'The bounded request does not fit the remaining input budget.'},
 OBJECTIVE_RESULT_LIMIT:{kind:'budget',recoverable:false,ownerAction:'Result-byte budget is spent.'},
 NO_PROGRESS:{kind:'budget',recoverable:false,ownerAction:'Repeated rejected proposals; replan with a new objective.'},
 AGENT_AUTHORIZATION_REQUIRED:{kind:'authority',recoverable:true,ownerAction:'A request-specific protected inference authorization is required.'},
 AGENT_SCOPED_CREDIT_REQUIRED:{kind:'authority',recoverable:true,ownerAction:'Independently verified, attributable Cloud credit is required.'},
 BOUNDS_UNESTABLISHED:{kind:'authority',recoverable:true,ownerAction:'Provider charge bounds are not established.'},
 INFERENCE_NOT_SUBMITTED:{kind:'external',recoverable:true,ownerAction:'Preparation failed before any completion was sent. Restore Cloud access, then explicitly resume the company.'},
 KNOWLEDGE_UNAVAILABLE:{kind:'external',recoverable:true,ownerAction:'JBrain could not provide the selected documents. Restore access, then explicitly resume the company.'},
 JBRAIN_UNAVAILABLE:{kind:'external',recoverable:true,ownerAction:'JBrain could not provide the selected documents. Restore the connection, then explicitly resume the company.'},
 CURRENT_KNOWLEDGE_GRANT_REQUIRED:{kind:'authority',recoverable:true,ownerAction:'A selected document grant was revoked or changed.'},
 CATALOG_REVISION_CHANGED:{kind:'scope',recoverable:true,ownerAction:'A bound skill or persona changed; review its new revision.'},
 EVALUATOR_REQUIRED:{kind:'unsupported',recoverable:false,ownerAction:'Only additive structured template fields are auto-evaluated. Other changes need owner review.'},
 OWNER_REVIEW_REQUIRED:{kind:'owner',recoverable:true,ownerAction:'Proposed change awaits an explicit owner decision. It is never executed automatically.'},
 LIVE_PROCUREMENT_UNAVAILABLE:{kind:'unsupported',recoverable:false,ownerAction:'Paid resources need a real entitlement; none exists.'},
 AUTONOMOUS_PUBLICATION_UNAVAILABLE:{kind:'unsupported',recoverable:false,ownerAction:'Service drafts are inert; autonomous publication is unavailable.'},
 STALE_WORK_FENCE:{kind:'scope',recoverable:true,ownerAction:'A stale worker lost its lease. A current claim is required.'},
 INTERNAL_WORK_PORT_UNAVAILABLE:{kind:'external',recoverable:false,ownerAction:'No internal work executor is composed.'},
};
const PATTERNS=[
 [/^(DURABLE_PLAINTEXT|VERIFIED_OUTPUT|VERIFICATION_|MODEL_RESPONSE_SIGNATURE|GATEWAY_AND_MODEL|FRESH_NONCE|ATTESTED_SIGNER|TCB_STATUS|PREPARED_REQUEST|LOCAL_SDK|REQUEST_FINGERPRINT|INFERENCE_ATTESTATION|INFERENCE_PROOF)/,{kind:'proof',recoverable:false,ownerAction:'The original response lacks strict verified plaintext proof, so zero commands were accepted. This is not a failure to retry.'}],
 [/^(ECONOMIC_|BALANCE_|FINANCIAL_FACTS|CURRENT_ECONOMIC|PROVIDER_TRANSACTION)/,{kind:'authority',recoverable:true,ownerAction:'A current economic observation is required.'}],
 [/^MAX_/,{kind:'budget',recoverable:false,ownerAction:'A configured company limit was reached.'}],
 [/^(KNOWLEDGE|INTERNAL_KNOWLEDGE|CHILD_SCOPE|INTERNAL_SCOPE|STALE_)/,{kind:'scope',recoverable:true,ownerAction:'Current scope no longer admits this work.'}],
];
export function explainBlock(reasonCode){
 if(!reasonCode)return null;
 const hit=EXACT[reasonCode]??PATTERNS.find(([re])=>re.test(reasonCode))?.[1]??{kind:'other',recoverable:null,ownerAction:'See the reason code and the lifecycle ledger.'};
 return {reasonCode,...hit};
}
