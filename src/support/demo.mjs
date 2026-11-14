/** Explicit owner-requested fictional content. Importing this module performs no writes. */
export const DEMO_VERSION='harbor-mutual-fictional-v1';
export const profiles=[
 {key:'policy-guide',name:'Harbor Mutual Policy Guide',role:'Fictional insurance policy guide',description:'Northstar Care · exact published fictional auto, home and travel policy passages.',instructions:'Use only explicitly published fictional Harbor Mutual policy sources. Quote sources and state uncertainty. Never determine actual coverage, approve a claim, request payment or claim to use an AI model. Escalate unsupported questions to the owner inbox.',skillIds:[],status:'ready'},
 {key:'claims-guide',name:'Harbor Mutual Claims Guide',role:'Fictional claims information guide',description:'Northstar Care · fictional claims reporting steps and owner escalations.',instructions:'Explain only the published fictional claims reporting process. Never accept a real claim, approve coverage or promise payment. Use policy_lookup with citations; escalate claim decisions and unknown questions to the owner inbox.',skillIds:[],status:'ready'},
];
const notice='FICTIONAL DEMONSTRATION ONLY. Harbor Mutual Insurance and Northstar Care are invented. All amounts, limits and time periods below are examples, not real insurance coverage, advice or claim approval. Do not send personal, financial or medical records.';
export const documents=[
 {key:'auto',title:'Harbor Mutual — Fictional Auto Policy HM-AUTO-DEMO',body:`# Harbor Mutual fictional auto policy

${notice}

## Auto collision deductible
For this fictional auto example, collision damage has an illustrative deductible of 500 demo dollars per incident. A policy excerpt cannot decide whether an actual incident is covered. Only a human owner review can address an individual scenario.

## Auto roadside assistance
The fictional roadside assistance example describes one tow up to 25 demo miles after a breakdown. Keep the vehicle in a safe place and ask the owner for help with a scenario outside this excerpt. No towing service is booked by this chat.

## Auto exclusions
This fictional example excludes intentional damage and racing. These sample exclusions are not a real contract or a decision about any customer claim.
`},
 {key:'home',title:'Harbor Mutual — Fictional Home Policy HM-HOME-DEMO',body:`# Harbor Mutual fictional home policy

${notice}

## Home water damage and deductible
The fictional home example describes sudden escape of water from an internal pipe, with an illustrative deductible of 1,000 demo dollars. Gradual seepage is outside this sample description. This passage never confirms actual coverage.

## Home temporary accommodation
The fictional temporary accommodation example lists a maximum of 10 demo nights when the home cannot be occupied after an event described by the sample policy. Owner review is required for every individual eligibility or payment question.

## Home policy records
For a fictional home-policy question, identify the policy section and describe the general issue without sharing an address, personal documents or other sensitive information in this demo chat.
`},
 {key:'travel',title:'Harbor Mutual — Fictional Travel Policy HM-TRAVEL-DEMO',body:`# Harbor Mutual fictional travel policy

${notice}

## Travel delay threshold
The fictional travel delay example starts after a delay of at least 6 demo hours and lists an illustrative limit of 150 demo dollars. These invented numbers do not create any real benefit or coverage decision.

## Travel baggage documentation
The fictional baggage process asks for a carrier reference number and a general list of missing items in an owner-reviewed example. Do not upload identity documents or receipts to this demo. No carrier or insurer is contacted.

## Travel cancellation questions
Trip cancellation depends on the specific sample section and an owner-reviewed scenario. This chat cannot decide whether a cancellation is eligible or promise reimbursement.
`},
 {key:'claims',title:'Harbor Mutual — Fictional Claims Handling HM-CLAIMS-DEMO',body:`# Harbor Mutual fictional claims handling

${notice}

## Claims reporting steps
The fictional claims reporting process is: note the policy reference, record a general incident description without sensitive details, and request owner review. The example reporting window is 7 demo days. This chat opens a local support case only; it does not file an insurance claim.

## Claims review and approval
Only an authorized human in a real insurer could decide an actual claim. In this fictional demo, every request for claim approval, eligibility, payout or reimbursement is escalated to the Northstar Care owner inbox. A case ID acknowledges a local support ticket, not an approved claim.

## Claims status and contact
No insurer claim-status API, email, telephone call or external claim submission is connected. Ask for an owner escalation to create a persistent local case. Response timing is not promised.
`},
];
