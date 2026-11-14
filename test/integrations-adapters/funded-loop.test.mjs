import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createFundedLoop, saleFromSettlement} from '../../src/payments/funded-loop.mjs';

const settlement = {providerStatus: 'SUCCESS', depositTxFinal: true, depositAddress: 'd', customer: 'c', at: 't', nearTxs: [{hash: 'tx1'}], ledger: {txHash: 'L1'},
  offer: {price: {amount: '100000', decimals: 6, asset: 'usdc'}}};
async function make(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'funded-')); t.after(() => rm(dir, {recursive: true, force: true}));
  const appended = [], committer = {append: async e => { appended.push(...e); return {txHash: 'L2', correlationId: 'op_2'}; }};
  return {appended, fl: createFundedLoop({file: path.join(dir, 's.json'), committer})};
}
const run = {id: 'r1', providerRequestId: 'p', inferenceId: 'i', cost: {status: 'confirmed', actualCostNanoUsd: '632050'}};

test('unconfirmed settlements never become a sale', () => {
  for (const bad of [{...settlement, providerStatus: 'PENDING'}, {...settlement, depositTxFinal: false}, {...settlement, ledger: null}, {}])
    assert.throws(() => saleFromSettlement(bad), {code: 'SALE_NOT_CONFIRMED'});
  assert.equal(saleFromSettlement(settlement).revenueNanoUsd, '100000000'); // $0.10
});
test('one sale pays for one run: revenue, cost, surplus and ledger event', async t => {
  const {fl, appended} = await make(t), {sale} = await fl.register(settlement);
  await fl.claim(sale.id, 'k1');
  const e = await fl.settle({saleId: sale.id, runKey: 'k1', run});
  assert.equal(e.settled.surplusNanoUsd, String(100000000n - 632050n));
  assert.equal(e.settled.ledgerTx, 'L2'); assert.equal(appended[0].type, 'inference.consumed');
  assert.match(e.settled.funding, /owner-prepaid/);
  await fl.settle({saleId: sale.id, runKey: 'k1', run}); assert.equal(appended.length, 1); // idempotent, no second commit
});
test('second run on the same sale is refused; unknown sale is refused; same key replays', async t => {
  const {fl} = await make(t), {sale} = await fl.register(settlement);
  await fl.claim(sale.id, 'k1'); await fl.claim(sale.id, 'k1');
  await assert.rejects(fl.claim(sale.id, 'k2'), {code: 'SALE_ALREADY_USED'});
  await assert.rejects(fl.claim('sale:none', 'k1'), {code: 'SALE_UNKNOWN'});
});
test('pending cost records nothing on the ledger; cost above revenue is refused', async t => {
  const {fl, appended} = await make(t), {sale} = await fl.register(settlement);
  await fl.claim(sale.id, 'k1');
  assert.equal((await fl.settle({saleId: sale.id, runKey: 'k1', run: {id: 'r', cost: {status: 'pending'}}})).settled.status, 'cost_pending');
  assert.equal(appended.length, 0);
  await assert.rejects(fl.settle({saleId: sale.id, runKey: 'k1', run: {id: 'r', cost: {status: 'confirmed', actualCostNanoUsd: '999999999999'}}}), {code: 'COST_EXCEEDS_REVENUE'});
});
test('a run that sent no completion releases the sale for another attempt', async t => {
  const {fl} = await make(t), {sale} = await fl.register(settlement);
  await fl.claim(sale.id, 'k1');
  await fl.settle({saleId: sale.id, runKey: 'k1', run: {id: 'r', status: 'not_submitted', cost: {status: 'not_incurred'}}});
  await fl.claim(sale.id, 'k2'); // would throw SALE_ALREADY_USED if still claimed
});
