import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCommand, COMMANDS} from '../../src/rules/autonomy.mjs';

test('spend is an agent command in the vocabulary', () => {
  assert.ok(COMMANDS.includes('spend'));
});

test('spend command validates its shape and bounds', () => {
  assert.equal(validateCommand({type: 'spend', asset: 'nep141:usdc', amount: '500000', purpose: 'buy research'}), true);
  assert.equal(validateCommand({type: 'spend', asset: 'nep141:usdc', amount: '500000', purpose: 'buy research', supplierRef: 'web-research'}), true);
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '1', purpose: 'p'}), true);
});

test('spend command rejects invalid amounts, missing purpose and extra fields', () => {
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '0', purpose: 'p'}), false);
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '-5', purpose: 'p'}), false);
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '1.5', purpose: 'p'}), false);
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '1'}), false);
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '1', purpose: ''}), false);
  assert.equal(validateCommand({type: 'spend', asset: 'a', amount: '1', purpose: 'p', evil: true}), false);
  assert.equal(validateCommand({type: 'spend', asset: '', amount: '1', purpose: 'p'}), false);
});

test('the spend command schema is exposed to the model', async () => {
  const {commandResponseFormat} = await import('../../src/rules/command-format.mjs');
  const format = commandResponseFormat();
  const itemTypes = format.json_schema.schema.properties.commands.items.anyOf.map(s => s.properties.type.const);
  assert.ok(itemTypes.includes('spend'));
  const spend = format.json_schema.schema.properties.commands.items.anyOf.find(s => s.properties.type.const === 'spend');
  assert.deepEqual([...spend.required].sort(), ['amount', 'asset', 'purpose', 'type'].sort());
});
