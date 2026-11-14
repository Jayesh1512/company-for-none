import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/swap-near-to-usdc.mjs', import.meta.url));
async function runDry(t, args, balance = '0') {
  const directory = await mkdtemp(path.join(tmpdir(), 'swap-dry-run-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const wallet = path.join(directory, '.runtime/company-ledger-wallet/mainnet');
  await mkdir(wallet, {recursive: true});
  // Deliberately no credential.json: a quote must work without the private key.
  await writeFile(path.join(wallet, 'public.json'), JSON.stringify({accountId: 'dry-run.near'}));
  const stub = path.join(directory, 'transport.mjs');
  await writeFile(stub, `
    import {appendFileSync} from 'node:fs';
    import assert from 'node:assert/strict';
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      appendFileSync('requests.jsonl', JSON.stringify({url, body}) + '\\n');
      if (url === 'https://free.rpc.fastnear.com') {
        assert.equal(body.method, 'query', 'dry-run must never broadcast');
        assert.equal(body.params.account_id, body.params.request_type === 'view_account' ? 'dry-run.near' : 'wrap.near');
        if (body.params.request_type === 'view_account') return Response.json({result: {amount: '10000000000000000000000000', storage_usage: 0}});
        assert.equal(body.params.method_name, 'ft_balance_of');
        const args = JSON.parse(Buffer.from(body.params.args_base64, 'base64'));
        assert.equal(args.account_id, 'dry-run.near');
        return Response.json({result: {result: [...Buffer.from(JSON.stringify(${JSON.stringify(balance)}))]}});
      }
      assert.equal(url, 'https://1click.chaindefuser.com/v0/quote');
      assert.equal(body.dry, true);
      assert.equal(body.recipient, 'dry-run.near');
      // A dry quote need not allocate a deposit address.
      return Response.json({quote: {amountOut: '2000000', minAmountOut: '1980000', deadline: body.deadline}}, {status: 201});
    };
  `);
  const result = spawnSync(process.execPath, ['--import', stub, script, ...args, '--dry-run'], {
    cwd: directory, encoding: 'utf8', timeout: 10000, env: {PATH: process.env.PATH},
  });
  assert.equal(result.status, 0, result.stderr);
  const requests = (await readFile(path.join(directory, 'requests.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(requests.length, 3, 'only account, balance and dry quote requests are allowed');
  return {summary: JSON.parse(result.stdout), quote: requests[2].body};
}

test('native NEAR dry-run quotes without a private key, wrapping, registration or deposit', async t => {
  const {summary, quote} = await runDry(t, ['--amount-near', '0.7']);
  assert.equal(quote.amount, '700000000000000000000000');
  assert.equal(summary.quoteAmountEstimated, true);
  assert.equal(summary.wrapTx, undefined);
  assert.equal(summary.storageDepositTx, undefined);
  assert.equal(summary.depositTx, undefined);
});

test('existing wNEAR dry-run quotes only the actual token balance', async t => {
  const {summary, quote} = await runDry(t, ['--use-wnear'], '123456789012345678901234');
  assert.equal(quote.amount, '123456789012345678901234');
  assert.equal(summary.quoteAmountEstimated, false);
});

test('dry-run preserves a 24-decimal wrap amount and existing wNEAR exactly', async t => {
  const {quote} = await runDry(t, ['--amount-near', '0.700000000000000000000001'], '2');
  assert.equal(quote.amount, '700000000000000000000003');
});
