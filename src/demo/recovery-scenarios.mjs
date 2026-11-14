const profiles={manager:['Company manager','Organize the fictional intake review; delegate support work.'],support:['Claims support specialist','Answer only from the selected runbook. Escalate missing facts.'],backlog:['Company backlog','Triage an observed failure and delegate scoped repairs.'],knowledge_curator:['Knowledge curator','Extract exact supported process guidance from the owner-approved source.'],template_developer:['Template developer','Propose only an additive repair to the company intake template.']};
const instructions={
 manager:'Inspect the company objective. Delegate the customer question to support. Return {"summary":"your reasoning","delegate":["support"]}.',
 support_before:'You are the customer-facing claims specialist. Use ONLY the runbook in documents; do not infer or invent missing process requirements. If the question cannot be answered from that runbook, escalate. Return {"summary":"what happened","answer":"your response","escalate":true,"citations":[]}. Cite only exact document substrings if present: {"documentId":"...","quote":"..."}.',
 backlog:'An actual support escalation and template validation failure are recorded. Inspect both and choose the scoped roles needed for repair from availableRoles in the task data. Choose only the roles needed, in the order you want them to run. Return {"summary":"root cause and plan","delegate":["chosen role", "another chosen role if needed"]}.',
 knowledge_curator:'Update the incomplete runbook from the owner-approved source. Choose a SINGLE contiguous EXACT excerpt explaining all required intake fields and constraints. Do not invent policy. Return {"summary":"why this repairs the gap","excerpt":"exact source substring"}.',
 template_developer:'Inspect the baseline fields, approved source, and frozen requiredFields contract. Infer the missing field and propose only additive operations preserving all existing fields and requirements. Return {"summary":"explain the defect and repair","operations":[{"type":"add_field","name":"missing field inferred from the contract","required":true}]}. You cannot change tests, contracts, grants, code, or business policy.',
 support_after:'Answer the same customer question using ONLY the current updated runbook. Prepare the exact customer-supplied intake without approving any claim. Return {"summary":"what now succeeds","answer":"your answer","escalate":false,"citations":[{"documentId":"exact runbook id","quote":"short exact substring supporting the missing requirement"}],"intake":{"field from customer question":"exact customer value"}}.',
};
const base={profiles,instructions,baselineFields:[{name:'policyReference',required:true},{name:'incidentSummary',required:true}],intake:{policyReference:'HM-AUTO-DEMO',incidentSummary:'Parked vehicle damage'}};
const define=(id,details)=>({...base,id,...details,requiredFields:['policyReference','incidentSummary',details.gap.field],repairOperations:[{type:'add_field',name:details.gap.field,required:true}],repairs:{knowledge_curator:'knowledge',template_developer:'template'}});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const DEFAULT_RECOVERY_SCENARIO='contact-preference';
export const RECOVERY_SCENARIOS=freeze({
 'contact-preference':define('contact-preference',{
  source:'Every fictional claim intake must include policyReference, incidentSummary, and contactPreference. The contactPreference must be portal or email. If contactPreference is missing, the intake is incomplete. A complete intake creates a local review ticket only; it never approves a claim.',
  question:'What contact preference must be recorded before this fictional intake is complete? Prepare a local review intake with policyReference HM-AUTO-DEMO, incidentSummary Parked vehicle damage, and my chosen contact preference portal.',
  gap:{field:'contactPreference',failureCode:'MISSING_CONTACT_PREFERENCE',summary:'The support runbook cannot answer contact preference requirements and the intake template omits the frozen mandatory field.',placeholder:'The process for contact preferences has not been documented.'},
  evidenceTerms:['policyReference','incidentSummary','contactPreference','portal','email'],
  intake:{...base.intake,contactPreference:'portal'},
 }),
 'missing-address':define('missing-address',{
  source:'Every fictional claim intake must include policyReference, incidentSummary, and address. The address must be the customer-supplied mailing address. If address is missing, the intake is incomplete. A complete intake creates a local review ticket only; it never approves a claim.',
  question:'What address must be recorded before this fictional intake is complete? Prepare a local review intake with policyReference HM-AUTO-DEMO, incidentSummary Parked vehicle damage, and my mailing address 42 Example Street, Demo City.',
  gap:{field:'address',failureCode:'MISSING_ADDRESS',summary:'The support runbook cannot answer mailing address requirements and the intake template omits the frozen mandatory field.',placeholder:'The process for mailing addresses has not been documented.'},
  evidenceTerms:['policyReference','incidentSummary','address','customer-supplied mailing address'],
  intake:{...base.intake,address:'42 Example Street, Demo City'},
 }),
});
export function recoveryScenario(id=DEFAULT_RECOVERY_SCENARIO){
 if(!Object.hasOwn(RECOVERY_SCENARIOS,id))throw Object.assign(Error('RECOVERY_SCENARIO_UNKNOWN'),{code:'RECOVERY_SCENARIO_UNKNOWN'});
 return RECOVERY_SCENARIOS[id];
}
