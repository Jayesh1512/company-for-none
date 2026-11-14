/** Private composition read port. Never expose this object through HTTP or
 * accept it from a client/model. Rules derives all authority from these facts. */
export function readAutonomyFacts({journal,catalog,companyId}) {
  const namespaces={objectives:'companyObjectives',agents:'agents',work:'agentWork',runs:'agentRuns',improvements:'improvements',heads:'companyTargetHeads',revisions:'companyRevisions',contracts:'companyTemplateContracts',evaluations:'improvementEvaluations',resourceRequests:'resourceRequests',serviceDrafts:'serviceDrafts',contexts:'internalContexts',internalResults:'internalResults',documents:'companyKnowledgeDocuments'};
  namespaces.preparationFailures='internalPreparationFailures';
  return {company:journal?.get('autonomousCompanies',companyId)??null,organization:journal?.get('organization',companyId)??null,...Object.fromEntries(Object.entries(namespaces).map(([key,namespace])=>[key,journal?.list(namespace)??[]])),catalog,
    orders:journal?.list('orders')??[],operations:journal?Object.values(journal.snapshot().operations):[],financial:journal?.get('treasury','financial')??null,financialEvents:journal?.events()??[]};
}
