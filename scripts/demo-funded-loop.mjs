// Customer-funded loop, end to end (revenue in -> paid answer -> cost attributed -> surplus).
//   node scripts/demo-funded-loop.mjs register            # import the settled live-checkout sale
//   node scripts/demo-funded-loop.mjs run "<question>"    # POST the paid answer to a server started with SHOP_FUNDED_LOOP_FILE
//   node scripts/demo-funded-loop.mjs answer "<question>"  # no server: claim sale, real E2EE Cloud call over the Harbor Mutual docs, read billed cost, commit to ledger
//   node scripts/demo-funded-loop.mjs report              # write artifacts/mainnet-proof/funded-loop.json
// Server base URL: FUNDED_LOOP_URL (default http://127.0.0.1:4173). The AI call is billed to the
// owner-prepaid Cloud key; the sale is attributed to its cost (see src/payments/funded-loop.mjs).
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {createFundedLoop} from '../src/payments/funded-loop.mjs';
import {documents} from '../src/support/demo.mjs';
try { loadEnvFile('.env'); } catch (e) { if (e.code !== 'ENOENT') throw e; }

const [, , step, ...rest] = process.argv;
const file = process.env.SHOP_FUNDED_LOOP_FILE ?? '.runtime/funded-loop/state.json';
const base = process.env.FUNDED_LOOP_URL ?? 'http://127.0.0.1:4173';
const MODEL = 'Qwen/Qwen3.8-27B';
async function committer() {
  const {createAgentApi} = await import('@near-intents-agent-api/sdk'), {createLedgerCommitter} = await import('../src/onchain/ledger-commit.mjs');
  return createLedgerCommitter({api: createAgentApi({apiKey: process.env.NEAR_INTENTS_AGENT_API_KEY, baseUrl: process.env.NEAR_INTENTS_AGENT_API_URL}), agentId: process.env.NEAR_AGENT_ID,
    grantToken: process.env.NEAR_AGENT_GRANT_TOKEN, contractId: process.env.SHOP_LEDGER_CONTRACT_ID, companyId: 'local-workspace'});
}
const fl = createFundedLoop({file, committer: step === 'answer' ? await committer() : null});

const onlySale = async () => { const s = Object.values((await fl.view()).sales); if (s.length !== 1) throw new Error(`expected exactly one registered sale, found ${s.length}`); return s[0]; };

if (step === 'register') {
  const e = await fl.register(JSON.parse(await readFile('artifacts/mainnet-proof/live-checkout-settlement.json', 'utf8')));
  console.log('registered', e.sale.id, 'revenue nanoUSD', e.sale.revenueNanoUsd);
} else if (step === 'run') {
  const {sale} = await onlySale(), question = rest.join(' ');
  if (!question) throw new Error('question required');
  const view = await (await fetch(`${base}/api/workspace/ai-demo`)).json();
  const agent = view.agents?.[0]; if (!view.authorized || !agent) throw new Error('AI demo not authorized or no agent on that server');
  const res = await fetch(`${base}/api/workspace/ai-demo/run`, {method: 'POST', headers: {'content-type': 'application/json', 'idempotency-key': `funded:${sale.id}:${randomUUID().slice(0, 8)}`, origin: base},
    body: JSON.stringify({saleId: sale.id, agentId: agent.id, documentIds: agent.documentIds, question})});
  const body = await res.json(); console.log(res.status, JSON.stringify({status: body.status, answer: body.answer, cost: body.cost, fundedLoop: body.fundedLoop, error: body.error}, null, 1));
  process.exitCode = res.ok && body.fundedLoop?.status === 'settled' ? 0 : 2;
} else if (step === 'answer') {
  const {sale} = await onlySale(), question = rest.join(' '), runKey = `funded-answer:${sale.id}`;
  if (!question) throw new Error('question required');
  await fl.claim(sale.id, runKey);                       // refuses a second answer on the same sale
  // The SDK hides response headers; read the provider's inference-id from node's http diagnostics channel.
  const dc = await import('node:diagnostics_channel'); let inferenceId = null;
  const onHeaders = ({request, response}) => { if (String(request.path).includes('chat/completions')) inferenceId ??= response.headers['inference-id'] ?? null; };
  dc.subscribe('http.client.response.finish', onHeaders);
  const {InferenceClient} = await import('@nearai/inference-sdk/node'), client = new InferenceClient({apiKey: process.env.NEAR_AI_API_KEY, e2ee: true});
  const context = documents.map(d => `## ${d.title}\n${d.body}`).join('\n\n').slice(0, 11000);
  const completion = await client.chat.completions.create({model: MODEL, temperature: 0, max_tokens: 400, messages: [
    {role: 'system', content: 'You are Harbor Mutual (fictional insurer) support. Answer in at most two sentences using ONLY the documents. If they do not say, reply: "I cannot answer that; please request a review."'},
    {role: 'user', content: `Documents:\n${context}\n\nQuestion: ${question}`}]});
  const verified = await client.verifyResponse(completion.id); dc.unsubscribe('http.client.response.finish', onHeaders);
  if (!inferenceId) { console.error('inference-id not captured; completion id', completion.id, '- call was made and billed; NOT settling'); process.exit(3); }
  const answer = completion.choices[0]?.message?.content ?? '';
  console.log('answer:', answer, '\ninference-id:', inferenceId, 'signature verified:', verified.signatureKind ?? true);
  let billed = null;
  for (let i = 0; i < 24 && !billed; i += 1) {       // billing can lag the completion
    const r = await fetch('https://cloud-api.near.ai/v1/billing/costs', {method: 'POST', headers: {authorization: `Bearer ${process.env.NEAR_AI_API_KEY}`, 'content-type': 'application/json'}, body: JSON.stringify({requestIds: [inferenceId]})}).then(r => r.json());
    const row = r.requests?.find(x => x.requestId === inferenceId), v = row?.costNanoUsd;
    if (!r.warning && v && String(v) !== '0') billed = String(v); else await new Promise(r => setTimeout(r, 5000));
  }
  const entry = await fl.settle({saleId: sale.id, runKey, run: {id: completion.id, providerRequestId: completion.id, inferenceId, cost: billed ? {status: 'confirmed', actualCostNanoUsd: billed} : {status: 'pending'}}});
  entry.settled.answer = answer; entry.settled.model = MODEL; entry.settled.responseSignatureVerified = true; entry.settled.usage = completion.usage ?? null;
  const st = await fl.view(); st.sales[sale.id].settled = entry.settled; await writeFile(file, JSON.stringify(st, null, 2) + '\n');
  console.log(JSON.stringify(entry.settled, null, 1));
  process.exitCode = entry.settled.status === 'settled' ? 0 : 2;
} else if (step === 'report') {
  const {sale, claim, settled} = await onlySale();
  if (settled?.status !== 'settled') throw new Error('sale not settled yet');
  await mkdir('artifacts/mainnet-proof', {recursive: true});
  const out = {kind: 'funded-loop', at: new Date().toISOString(), sale, claim, settled,
    revenueIn: {usdcAtomic: sale.priceAtomic, saleLedgerTx: sale.saleLedgerTx, depositTxs: sale.depositTxs},
    expenseOut: {nanoUsd: settled.inferenceCostNanoUsd, inferenceId: settled.inferenceId, ledgerTx: settled.ledgerTx}, surplusNanoUsd: settled.surplusNanoUsd};
  await writeFile('artifacts/mainnet-proof/funded-loop.json', JSON.stringify(out, null, 2) + '\n'); console.log('wrote artifacts/mainnet-proof/funded-loop.json');
} else { console.error('usage: register | run "<question>" | report'); process.exit(1); }
