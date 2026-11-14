// End-to-end loop-driven spend (option b): controlled reasoning, LIVE execution.
//
// A controlled command batch emits {type:'spend'} through the REAL autonomy loop.
// Everything downstream of the decision is live: the loop executes the spend via
// the Agent API under the owner-signed grant, and auto-commits agent lifecycle,
// delegation and spend events to the ON-CHAIN ledger. Only the decision tokens are
// supplied; label this CONTROLLED reasoning + LIVE execution everywhere.
//
// Decision source:
//   default        a real NEAR AI Cloud completion (E2EE, TEE-attested, signature-verified
//                  with the official SDK) chooses the spend command -> reasoning.mode 'cloud'
//   --controlled   a fixed command is supplied               -> reasoning.mode 'controlled'
//   --reason-only  run only the decision step; nothing is spent or written on chain
// The Cloud call is paid from the owner's NEAR_AI_API_KEY directly (cents-fraction, recorded
// from provider usage); it is outside the product treasury reservations, and the receipt says so.
//
// Writes artifacts/mainnet-proof/loop-receipt.json, checked by scripts/verify-loop-receipt.mjs.
//
// Usage: node scripts/loop-spend-e2e.mjs [--controlled | --reason-only]
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {loadEnvFile} from 'node:process';
import {createJournal} from '../src/journal/index.mjs';
import {createRules} from '../src/rules/index.mjs';
import {createAutonomyWriter} from '../src/autonomy/plans.mjs';
import {readAutonomyFacts} from '../src/autonomy/facts.mjs';
import {createAutonomy} from '../src/autonomy/index.mjs';
import {resolveEffectiveContext} from '../src/autonomy/context.mjs';
import {createAgentApi} from '@near-intents-agent-api/sdk';
import {createAgentSpendPort, SPEND_ASSETS} from '../src/custody/agent-spend.mjs';
import {createSpendExecutor} from '../src/workflow/spend.mjs';
import {createLedgerCommitter} from '../src/onchain/ledger-commit.mjs';
import {createLedgerAutoCommit} from '../src/onchain/ledger-autocommit.mjs';
import {catalog as baseCatalog} from '../src/workspace/catalog.mjs';
import {intent} from '../test/helpers/autonomy-fixtures.mjs';
import {config, financial as financialFixture} from '../test/rules/fixtures.mjs';
import {fingerprint} from '../src/contracts.mjs';
import {COMMITTABLE_TYPES} from '../src/onchain/ledger-autocommit.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const apiKey = process.env.NEAR_INTENTS_AGENT_API_KEY;
const baseUrl = process.env.NEAR_INTENTS_AGENT_API_URL;
const agentId = process.env.NEAR_AGENT_ID;
const grantToken = process.env.NEAR_AGENT_GRANT_TOKEN;
const contractId = process.env.SHOP_LEDGER_CONTRACT_ID;
if (!apiKey || !agentId || !grantToken || !contractId) throw new Error('Agent API + ledger env missing');

const directory = await mkdtemp(path.join(os.tmpdir(), 'cfn-loop-e2e-'));
const companyId = 'local-workspace';
const clock = () => new Date();
const journal = await createJournal({directory, clock});
const catalog = baseCatalog.map(x => ({...x, version: x.version ?? '1'}));
const policy = config();
policy.autonomy = intent;
const rules = createRules({config: policy, companyId, clock, getAutonomyFacts: () => readAutonomyFacts({journal, catalog, companyId})});
const apply = createAutonomyWriter({journal, rules, companyId});
const owner = {verifiedLocal: true, role: 'owner', companyId};

const api = createAgentApi({apiKey, baseUrl});
const port = createAgentSpendPort({apiKey, baseUrl, agentId, grantToken});
const committer = createLedgerCommitter({api, agentId, grantToken, contractId, companyId});

const flags = new Set(process.argv.slice(2));

// Pre-flight: never spend if the payment could not be recorded. The ledger CONTRACT pays
// storage staking for every record; at zero headroom each append reverts (LackBalanceForState)
// while the spend itself still succeeds, leaving an unrecorded payment.
if (!flags.has('--reason-only')) {
  const rpcUrl = process.env.NEAR_RPC_URL ?? 'https://free.rpc.fastnear.com';
  const {result: acct, error} = await fetch(rpcUrl, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'query', params: {request_type: 'view_account', finality: 'final', account_id: contractId}})}).then(r => r.json());
  if (error || !acct) throw new Error(`Cannot read ledger contract account: ${JSON.stringify(error)}`);
  const headroom = BigInt(acct.amount) - BigInt(acct.storage_usage) * 10n ** 19n; // 1 byte = 1e19 yoctoNEAR of required stake
  const MIN_HEADROOM = 10n ** 22n; // 0.01 NEAR ~ 100 KB, far more than the handful of records one run writes
  if (headroom < MIN_HEADROOM) throw new Error(`Ledger contract ${contractId.slice(0, 8)}… has ${Number(headroom) / 1e24} NEAR of storage headroom (<0.01): appends would revert. Fund it, then rerun. Nothing was spent.`);
}

const MODEL = process.env.LOOP_REASONING_MODEL ?? 'Qwen/Qwen3.8-27B';
const sha = value => createHash('sha256').update(value).digest('hex');

const balances = await api.forGrant(grantToken).getBalances(agentId, {source: 'confidential'});
const usdc = (balances.balances ?? []).find(b => b.asset_id === SPEND_ASSETS.USDC_NEAR);
const enough = usdc && BigInt(usdc.available_raw ?? '0') >= 50000n;
if (!enough && !flags.has('--reason-only')) throw new Error(`Agent needs >=0.05 USDC; has ${usdc?.balance ?? '0'}`);
const available = enough ? BigInt(usdc.available_raw) : 100000n; // --reason-only without funds: assume 0.1 USDC, spends nothing
const ceiling = (available / 2n).toString(); // half, so both limit and balance pass

/** One real, verified Cloud completion that must answer with a single spend command. */
async function decideWithCloud() {
  const apiKey = process.env.NEAR_AI_API_KEY;
  if (!apiKey) throw new Error('NEAR_AI_API_KEY missing (use --controlled to supply the decision instead)');
  const {InferenceClient} = await import('@nearai/inference-sdk/node');
  const client = new InferenceClient({apiKey, e2ee: true});
  const system = 'You are the purchasing agent of a small autonomous company. Reply with ONE JSON object and nothing else: {"type":"spend","asset":"<asset id>","amount":"<integer string in raw units>","purpose":"<one short sentence>"}. Spend only the allowed asset, at most the stated ceiling, and make it a sensible small operating purchase.';
  const user = JSON.stringify({allowedAsset: SPEND_ASSETS.USDC_NEAR, assetDecimals: 6, availableRaw: available.toString(), maxAmountRaw: ceiling, companyPurpose: 'Customer-care service that buys inference and marketplace work to serve insurer clients.'});
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const completion = await client.chat.completions.create({model: MODEL, temperature: 0, messages: [{role: 'system', content: system}, {role: 'user', content: user}]});
    const verified = await client.verifyResponse(completion.id);
    const text = completion.choices[0]?.message?.content ?? '';
    let command = null;
    try { command = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { /* retry */ }
    const valid = command?.type === 'spend' && command.asset === SPEND_ASSETS.USDC_NEAR && /^[1-9][0-9]{0,30}$/.test(String(command.amount)) &&
      BigInt(command.amount) <= BigInt(ceiling) && typeof command.purpose === 'string' && command.purpose.trim() && command.purpose.length <= 200;
    if (valid) {
      return {
        command: {type: 'spend', asset: command.asset, amount: String(command.amount), purpose: command.purpose.trim()},
        reasoning: {
          mode: 'cloud', model: MODEL, providerRequestId: completion.id, attempt,
          transport: 'near-ai-cloud e2ee', signatureKind: verified.signatureKind, responseSignatureVerified: true,
          usage: completion.usage ?? null, promptSha256: sha(system + '\n' + user), responseSha256: sha(text),
          funding: 'owner NEAR_AI_API_KEY, direct (outside product treasury reservations)',
        },
      };
    }
  }
  throw new Error('Cloud model did not return a valid spend command in 3 attempts');
}

const decision = flags.has('--controlled')
  ? {command: {type: 'spend', asset: SPEND_ASSETS.USDC_NEAR, amount: ceiling, purpose: 'self-directed provider purchase'}, reasoning: {mode: 'controlled', note: 'decision tokens supplied by the script, not model-generated'}}
  : await decideWithCloud();
console.log('decision:', JSON.stringify(decision));
if (flags.has('--reason-only')) process.exit(0);
const spendAmount = decision.command.amount;

const internalWork = {
  async execute(frame) {
    const w = journal.get('agentWork', frame.workId), run = journal.get('agentRuns', frame.runId), agent = journal.get('agents', w.actorId);
    const context = resolveEffectiveContext({journal, catalog, companyId, agent});
    const captured = {id: `${w.id}:${run.id}:${run.fence}`, companyId, workId: w.id, runId: run.id, fence: run.fence, profileRevision: agent.version, context, contextHash: context.contextHash};
    await journal.transaction({actionId: `ctx:${run.id}`, fingerprint: fingerprint(captured)}, tx => tx.put('internalContexts', captured.id, captured));
    const prepared = await apply({id: `req:${run.id}`, type: 'agent_prepare', workId: w.id, runId: run.id, fence: run.fence}, {financial: financialFixture()});
    if (prepared.decision.status !== 'allow') return prepared;
    // The decided command, handed to the loop exactly as an agent would emit it.
    const commands = [decision.command];
    await journal.transaction({actionId: `proposal:${run.id}`, fingerprint: fingerprint(commands)}, tx => {
      const lw = tx.get('agentWork', w.id), lr = tx.get('agentRuns', run.id);
      tx.put('agentRuns', run.id, {...lr, state: 'accepted', acceptedCommands: commands, candidateHash: fingerprint({commands}), version: lr.version + 1});
      tx.put('agentWork', w.id, {...lw, state: 'accepted', context, providerStatus: 'confirmed', costStatus: 'actual', version: lw.version + 1});
    });
    return {controlledTestOnly: true};
  },
  async reconcile() { throw new Error('controlled test port'); },
};

const spendExecutor = createSpendExecutor({journal, agentSpend: port, ledger: committer, companyId, clock});
const ledgerAutoCommit = createLedgerAutoCommit({journal, committer, companyId});
const autonomy = createAutonomy({journal, rules, internalWork, companyId, clock, spendExecutor, ledgerAutoCommit});

const evidence = {label: decision.reasoning.mode === 'cloud' ? 'CLOUD reasoning + LIVE execution' : 'CONTROLLED reasoning + LIVE execution', companyId, at: new Date().toISOString(), spendAmount, steps: {}};
try {
  await autonomy.configure({
    version: 0, operatingMode: 'none',
    brief: {name: 'Loop spend company', purpose: 'Prove an agent spend runs inside the loop.', industry: 'Test', customer: 'Fictional customers', outcome: 'One recorded spend', objective: 'Run one agent-initiated spend'},
    intent,
  }, owner, 'cfg');
  await autonomy.bootstrap({version: 1}, owner, 'bootstrap');
  await autonomy.control({version: 2, operation: 'start'}, owner, 'start');

  // Drive ticks until the spend command is admitted, executed and flushed.
  let spendSeen = null, ledgerTx = null;
  for (let i = 0; i < 20; i += 1) {
    const r = await autonomy.tick();
    const reqs = journal.list('spendRequests').filter(x => x.companyId === companyId);
    if (!spendSeen && reqs.length) spendSeen = reqs[0];
    const done = journal.list('spendRequests').find(x => ['completed', 'failed', 'unknown'].includes(x.state));
    if (done) { spendSeen = done; }
    // Flush any newly recorded autonomy events to the chain explicitly, so the
    // artifact captures the ledger tx even if the tick's own flush raced the write.
    try { await ledgerAutoCommit.tick(); } catch { /* retried next loop */ }
    const cursor = journal.get('ledgerAutoCommit', 'ledgerAutoCommit');
    if (cursor?.lastTxHash) ledgerTx = cursor.lastTxHash;
    // Stop at the FIRST terminal spend. Waiting for a ledger tx here made a ledger failure
    // re-run the work every tick and spend repeatedly; ledger problems must never cause spends.
    if (journal.list('spendRequests').filter(x => x.companyId === companyId).length > 1) throw new Error('SAFETY: more than one spend request; refusing to continue');
    if (spendSeen && ['completed', 'failed', 'unknown'].includes(spendSeen.state)) { evidence.steps.tick = i; break; }
    if (r?.idle || r?.stopped) { evidence.steps.endedAt = i; evidence.steps.lastResult = r?.idle ? 'idle' : r; break; }
  }

  evidence.steps.spendRequest = spendSeen ? {state: spendSeen.state, asset: spendSeen.asset, amount: spendSeen.amount, txHash: spendSeen.txHash ?? null, providerStatus: spendSeen.providerStatus ?? null, reasonCode: spendSeen.reasonCode ?? null} : null;
  evidence.steps.ledgerAutoCommitTx = ledgerTx;
  evidence.steps.delegations = journal.events().filter(e => e.type === 'agent.delegated').map(e => ({parent: e.data.parentAgentId, child: e.data.childAgentId, topic: e.data.topic}));
} finally {
  await autonomy.close();
}

await mkdir('artifacts/mainnet-proof', {recursive: true});
await writeFile('artifacts/mainnet-proof/loop-spend-e2e.json', JSON.stringify(evidence, null, 2) + '\n');

// The receipt is only written for a COMPLETE loop: spend succeeded AND its ledger record
// has a transaction. A half-run (e.g. spend ok, ledger failed) must never look verified.
const final = evidence.steps.spendRequest && journal.list('spendRequests').find(x => x.companyId === companyId);
const cursor = journal.get('ledgerAutoCommit', 'ledgerAutoCommit');
if (final?.state === 'completed' && final.providerStatus === 'SUCCESS' && final.ledgerCommit?.txHash) {
  const committedEvents = journal.events()
    .filter(e => e.sequence <= (cursor?.sequence ?? 0) && e.data?.companyId === companyId && COMMITTABLE_TYPES.includes(e.type))
    .map(e => ({type: e.type, journalSequence: e.sequence, data: e.data}));
  const receipt = {
    schema: 'loop-receipt/v1', label: evidence.label, generatedAt: new Date().toISOString(), companyId,
    reasoning: {...decision.reasoning, command: decision.command},
    spend: {id: final.id, asset: final.asset, amount: final.amount, purpose: final.purpose, state: final.state, providerStatus: final.providerStatus, correlationId: final.correlationId, spentAt: final.spentAt},
    ledger: {
      network: 'mainnet', contractId, signerId: process.env.NEAR_AGENT_ACCOUNT_ID ?? null,
      commits: [...committedEvents, {type: final.ledgerCommit.type, data: final.ledgerCommit.data, txHash: final.ledgerCommit.txHash, correlationId: final.ledgerCommit.correlationId}],
    },
  };
  await writeFile('artifacts/mainnet-proof/loop-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  await writeFile('public/loop-receipt.json', JSON.stringify(receipt, null, 2) + '\n'); // served to the ledger page
  console.log('\nReceipt written: artifacts/mainnet-proof/loop-receipt.json\nVerify with:    node scripts/verify-loop-receipt.mjs');
} else {
  console.error('\nLoop INCOMPLETE: no receipt written.', JSON.stringify({spend: final?.state ?? null, provider: final?.providerStatus ?? null, ledgerTx: final?.ledgerCommit?.txHash ?? null}));
  process.exitCode = 1;
}
console.log(JSON.stringify(evidence, null, 2));
await journal.close();
