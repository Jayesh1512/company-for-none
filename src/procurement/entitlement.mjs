import { fingerprint } from '../contracts.mjs';
import { sha256 } from './http.mjs';

const bad = (code, message) => { throw Object.assign(new Error(message), { code }); };

/**
 * Hash exactly what the supplier delivered. url-only parts are references we did not fetch, so they carry no content
 * hash and cannot support an entitlement. Returns null when nothing hashable was delivered.
 */
export function hashArtifacts(artifacts) {
  const out = []; let hashable = 0;
  for (const a of artifacts) {
    if (!a || typeof a !== 'object' || !Array.isArray(a.parts)) bad('SUPPLIER_SCHEMA_INVALID', 'Unsupported artifact.');
    const parts = a.parts.map(p => {
      if (typeof p?.text === 'string') { const b = Buffer.from(p.text, 'utf8'); if (b.length) hashable++; return { type: 'text', bytes: b.length, sha256: sha256(b) }; }
      if (typeof p?.raw === 'string' && Buffer.from(p.raw, 'base64').toString('base64') === p.raw) { const b = Buffer.from(p.raw, 'base64'); if (b.length) hashable++; return { type: 'raw', bytes: b.length, sha256: sha256(b) }; }
      if (typeof p?.url === 'string') return { type: 'url', url: p.url, sha256: null };
      bad('SUPPLIER_SCHEMA_INVALID', 'Unsupported artifact part.');
    });
    out.push({ artifactId: typeof a.artifactId === 'string' ? a.artifactId : null, name: typeof a.name === 'string' ? a.name : null, parts });
  }
  return hashable ? { artifacts: out, artifactsHash: fingerprint(out) } : null;
}

/**
 * Entitlement is derived ONLY from a completed supplier task with hashable content, bound to the exact paid order.
 * A payment, a signed header, an accepted 402 or a bare task id never reaches this function successfully.
 * This is a receipt of work, not evidence of legal usage rights, quality, safety, or a skill/license fulfillment.
 */
export function deriveEntitlement({ order, task, terms = null }) {
  if (task.state !== 'TASK_STATE_COMPLETED') bad('NOT_DELIVERED', 'The supplier has not completed the task.');
  if (task.id !== order.taskId) bad('ORDER_MISMATCH', 'Delivered task differs from the paid order.');
  if (order.contextId && task.contextId !== order.contextId) bad('ORDER_MISMATCH', 'Delivered hire context differs from the paid order.');
  const delivery = hashArtifacts(task.artifacts);
  if (!delivery) bad('DELIVERY_UNVERIFIABLE', 'No hashable content was delivered (completed-without-artifacts or url-only).');
  const body = { kind: 'supplier_work_product', supplier: structuredClone(order.supplier), supplierVersion: order.supplierVersion ?? null, supplierCardHash: order.supplierCardHash ?? null,
    orderActionId: order.actionId, quoteId: order.quoteId, taskId: task.id, contextId: task.contextId, taskHash: order.taskHash, artifactsHash: delivery.artifactsHash,
    deliveredAt: task.timestamp, terms: terms ? structuredClone(terms) : null,
    licenseGranted: false, useRightsStatus: 'unverified', scope: 'received_work_product', grantsSpendingAuthority: false };
  return { delivery, entitlement: { entitlementId: `entitlement:${fingerprint(body)}`, ...body } };
}

/** Pure check that an entitlement belongs to exactly this order/supplier/quote/task/content. */
export function entitlementMatches(entitlement, expected) {
  const reasons = [];
  if (!entitlement || entitlement.kind !== 'supplier_work_product' || entitlement.licenseGranted !== false || entitlement.useRightsStatus !== 'unverified'
    || entitlement.scope !== 'received_work_product' || entitlement.grantsSpendingAuthority !== false) reasons.push('SHAPE');
  else {
    for (const k of ['orderActionId', 'quoteId', 'taskId', 'contextId', 'taskHash', 'artifactsHash', 'supplierCardHash']) if (expected[k] !== undefined && entitlement[k] !== expected[k]) reasons.push(k.toUpperCase());
    if (expected.handle !== undefined && entitlement.supplier?.handle !== expected.handle) reasons.push('HANDLE');
    if (expected.supplierVersion !== undefined && entitlement.supplierVersion !== expected.supplierVersion) reasons.push('SUPPLIER_VERSION');
    const { entitlementId, ...body } = entitlement;
    if (entitlementId !== `entitlement:${fingerprint(body)}`) reasons.push('ENTITLEMENT_ID');
  }
  return { ok: reasons.length === 0, reasons };
}

/** Internal persistence after the adapter's fresh-delivery gate; this helper grants no authority. */
export async function storeEntitlement(journal, entitlement) {
  const check = entitlementMatches(entitlement, {});
  if (!check.ok) bad('ENTITLEMENT_INVALID', `Entitlement is not self-consistent (${check.reasons.join(',')}).`);
  const id = entitlement.entitlementId;
  return journal.transaction({ actionId: `entitlement-import:${id}`, fingerprint: fingerprint(entitlement) }, tx => {
    for (const other of tx.list('supplierEntitlements')) {
      if (other.entitlementId !== id && (other.taskId === entitlement.taskId || other.orderActionId === entitlement.orderActionId)) bad('ENTITLEMENT_DUPLICATE', 'This supplier task or order already produced an entitlement.');
    }
    tx.put('supplierEntitlements', id, entitlement); tx.append('supplier.entitlement.imported', { entitlementId: id, taskId: entitlement.taskId, orderActionId: entitlement.orderActionId });
    return { entitlementId: id };
  });
}
