import {fingerprint} from '../contracts.mjs';

export const TEMPLATE_EVALUATOR_VERSION = 'company-template-additive-v1';
const DRIVER = Object.freeze({version:TEMPLATE_EVALUATOR_VERSION, tests:['required_fields','preserve_fields','unique_fields','safe_identifiers','reject_missing_required','render_all_required']});
export const TEMPLATE_EVALUATOR_HASH = fingerprint(DRIVER);

/** Fixed driver, never an agent-supplied test/pass callback. It observes the
 * same frozen contract against baseline and candidate. No source execution. */
export function evaluateTemplateChange({baseline, candidate, contract}) {
  const required = contract.requiredFields;
  const cases = [Object.fromEntries(required.map(k => [k, `sample:${k}`])), ...required.map(missing => Object.fromEntries(required.filter(k => k !== missing).map(k => [k, `sample:${k}`])))];
  function observe(schema) {
    const fields = Array.isArray(schema?.fields) ? schema.fields : [];
    const names = fields.map(f => f.name);
    const valid = names.length > 0 && new Set(names).size === names.length && names.every(n => typeof n === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(n));
    const requirements = required.every(n => fields.some(f => f.name === n && f.required === true));
    const results = cases.map((input, index) => {
      const accepted = valid && fields.filter(f => f.required).every(f => typeof input[f.name] === 'string' && input[f.name].length > 0);
      const renderedFields = accepted ? fields.filter(f => input[f.name] !== undefined).map(f => f.name) : [];
      return {inputHash: fingerprint(input), accepted, expectedAcceptance: index === 0, renderedFields,
        passed: accepted === (index === 0) && (index !== 0 || required.every(k => renderedFields.includes(k)))};
    });
    return {schemaValid: valid, requirementsMet: requirements, cases: results, passed: valid && requirements && results.every(r => r.passed)};
  }
  const old = observe(baseline), next = observe(candidate);
  const preservesFields = (baseline.fields ?? []).every(oldField => candidate.fields?.some(f => f.name === oldField.name && (!oldField.required || f.required === true)));
  return {evaluatorVersion: TEMPLATE_EVALUATOR_VERSION, evaluatorHash: TEMPLATE_EVALUATOR_HASH,
    testSetHash: fingerprint({driver: DRIVER, contract, cases}), contractHash: fingerprint(contract),
    oldHash: fingerprint(baseline), newHash: fingerprint(candidate), baseline: old, candidate: next,
    preservesFields, repaired: !old.passed && next.passed && preservesFields};
}
