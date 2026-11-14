import {fingerprint, ContractError} from '../contracts.mjs';

/** Admission-time snapshot. Journal heads are authoritative for templates;
 * ordinary source documents remain JBrain-authoritative and grant checked. */
export function resolveEffectiveContext({journal, catalog, companyId, agent, companyKnowledge = null}) {
  if (!agent || agent.companyId !== companyId) throw new ContractError('COMPANY_SCOPE_MISMATCH', 'Agent context belongs to another company.');
  const revisions = [];
  for (const head of journal.list('companyTargetHeads').filter(h => h.companyId === companyId)) {
    const revision = journal.get('companyRevisions', head.revisionId);
    if (!revision || revision.companyId !== companyId || revision.targetId !== head.targetId || fingerprint(revision.body) !== revision.hash) {
      throw new ContractError('REVISION_INTEGRITY_FAILED', 'An applied company revision cannot be resolved.');
    }
    if (revision.scope === 'agent' && revision.agentId !== agent.id) continue;
    revisions.push({targetId: head.targetId, revisionId: revision.id, kind: revision.kind, hash: revision.hash, body: structuredClone(revision.body)});
  }
  revisions.sort((a, b) => a.targetId.localeCompare(b.targetId));
  const skills = (agent.skillIds ?? []).map(id => {
    const item = catalog.find(c => c.id === id && c.kind === 'skill');
    if (!item) throw new ContractError('CATALOG_REVISION_UNAVAILABLE', 'An assigned skill is no longer available.');
    return {id, version: item.version ?? '1', name: item.name, instructions: item.instructions, contentHash: fingerprint(item)};
  });
  const resources = (agent.resourceBindings ?? []).map(binding => {
    const item = catalog.find(c => c.id === binding.id);
    if (!item || (item.version ?? '1') !== binding.version || binding.contentHash && binding.contentHash !== fingerprint(item)) {
      throw new ContractError('CATALOG_REVISION_CHANGED', 'A bound resource changed. Review its new revision before using it.');
    }
    return {id: item.id, kind: item.kind, version: item.version ?? '1', contentHash: fingerprint(item),
      ...(item.kind==='soul'?{instructions:item.instructions,untrusted:true}: {})};
  });
  const instructionRevision = revisions.find(r => r.kind === 'instructions' && r.targetId === `agent:${agent.id}`);
  const snapshot = {companyId, agentId: agent.id, profileRevision: agent.version, instructions: instructionRevision?.body?.text ?? agent.instructions,
    instructionRevision: instructionRevision ? {targetId:instructionRevision.targetId,revisionId:instructionRevision.revisionId,hash:instructionRevision.hash} : null,
    skills, resources, templates: revisions.filter(r => r.kind === 'template'), companyKnowledge, untrusted: true};
  return {...snapshot, contextHash: fingerprint(snapshot)};
}
