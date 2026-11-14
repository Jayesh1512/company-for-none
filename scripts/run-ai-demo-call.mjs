// Item 5: one real owner-funded NEAR AI Cloud call under route (b)
// (live-verified-hold-on-loss), driven in-process against the existing demo store.
//
// No agent credit lot, purchase or sale is fabricated. Uses NEAR_AI_API_KEY and
// the private SHOP_AI_DEMO_AUTHORIZATION_FILE grant.
import {loadEnvFile} from 'node:process';
import {readdirSync} from 'node:fs';
import {createApp} from '../src/app.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const store = process.argv[2] ?? '.runtime/product-r2-preview';
process.env.SHOP_AI_DEMO_AUTHORIZATION_FILE ??= `${store}/ai-demo-authority.json`;

const app = await createApp({directory: store, companyId: 'local-workspace'});
const access = {verified: true, role: 'owner', companyId: 'local-workspace'};
try {
  const view = await app.aiDemo.view(access);
  console.log(JSON.stringify({authorized: view.authorized, paused: view.paused, agents: view.agents.length, documents: view.documents.length, runs: view.runs.length}, null, 2));
  const agent = view.agents[0];
  if (!agent) throw new Error('No ready agent in this store.');
  const documentIds = agent.documentIds.slice(0, 2);
  console.log('using agent', agent.name, '| docs', documentIds.length);

  const run = await app.aiDemo.run(access, {agentId: agent.id, documentIds, question: 'In one sentence, what does the auto policy say about the collision deductible?'}, `item5-${Date.now()}`);
  const {request, credentialHash, context, ...safe} = run;
  console.log(JSON.stringify(safe, null, 2).slice(0, 2000));
} finally {
  await app.close();
}
