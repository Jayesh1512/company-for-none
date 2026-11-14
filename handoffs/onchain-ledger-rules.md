# Onchain company-ledger Rules handoff

14 November2026. **WORKER_DONE — M01 source frozen.** This implements the newly authorized NEAR company-ledger policy scope. No contract/domain/RPC/key/deployment source was edited by this worker.

## Files and verification

- NEW `src/rules/onchain-ledger.mjs`: hash-chain export, current head/checkpoint/batch policy, unsigned preparation, truthful reconciliation and held publication diagnostics.
- `src/rules/index.mjs`: private `getLedgerFacts(action)` callback and five explicit `ledger_chain_*` actions. No other existing Rules/config/schema/financial behavior changed.
- NEW `test/onchain-ledger-rules/policy.test.mjs`:12 focused scenarios.

Node26.12.1 command:

```sh
PATH=/Users/jys/.hermes/node/bin:$PATH node --test test/rules/*.test.mjs test/customer-care-rules/*.test.mjs test/onchain-ledger-rules/*.test.mjs
```

Final **120 passed,0 failed,0 skipped**; log `/tmp/near-onchain-rules-tests.log`. All3 changed/new JavaScript files pass syntax checks. The12 new scenarios use synthetic private journal/RPC/fee facts and controlled in-memory plan application. They do not claim actual RPC, sandbox execution, account funding, contract deployment or a paid effect. Coordinator owns those independent checks.

No new chats/agents, commits/staging, dependency/config/environment edits, user-store mutations, provider writes or private-key handling were performed by S1.

## Exact private callback

```js
createRules({
  // Existing setup/safety options remain unchanged.
  getLedgerFacts: action => readLedgerFacts({journal, companyId, action})
})
```

The callback is synchronous private composition. `facts.events/rpc/authorization/feeBound` or caller success/verified/transaction-hash fields never become authority. It returns:

```js
{
  companyId,
  events,       // complete private journal events from sequence1
  binding,      // null or {networkId,contractId,signerId}
  checkpoint,   // null or saved ledgerChainCheckpoints record
  batches,      // saved ledgerChainBatches records
  rpc,          // null or actual normalized final RPC observation below
  authorization,// null or exact protected one-shot scope; not a caller flag
  feeBound,     // null or attributable native/USD upper-bound observation
  financial,    // current shared Treasury snapshot
  deploymentWallet, // optional safe public deployment metadata
  deployment        // optional trusted local build metadata
}
```

RPC shape:

```js
{ source:'near-json-rpc', networkId, contractId,
  signerId, // actual contract get_head.writerId, not inferred from configured binding
  companyHash, sequence, hash, blockHeight, blockHash,
  observedAt, finality:'final', records? }
```

`blockHeight` and record sequence are safe nonnegative JavaScript integers; a real block height is positive. Observation cannot be future-dated or older than30seconds. Actual network/contract/writer/company scope must match the binding. An RPC head is a provider read through the private normalized port, not a client JSON proof boolean. Later-head reconciliation requires a bounded exact actual-record suffix, not merely a success label or transaction ID.

## Frozen hashes and public records

Export helpers: `ledgerCompanyHash`, `ledgerRecordHash`, `ledgerBindingHash`, `ledgerBatchHash`, `projectChainRecords`.

```text
companyHash = SHA256_UTF8('company-ledger:company:v1\0' + companyId)
previousHash at genesis = 64 zeroes
record.hash = SHA256_UTF8([
  'company-ledger:record:v1', companyHash, String(sequence), type, at,
  actorHash, payloadHash, previousHash
].join('\n'))
```

The `\0` notation above is an actual NUL separator in the JavaScript string. `at` is canonical ISO. Public records have exactly `{sequence,type,at,actorHash,payloadHash,previousHash,hash}`. Private journal data/identities are domain-separated canonical fingerprints:

```js
actorHash = hash({domain:'company-ledger:actor:v1',companyHash,
                  actor:event.data?.actorId ?? event.data?.agentId ?? null})
payloadHash = hash({domain:'company-ledger:payload:v1',companyHash,
                    data:event.data ?? null})
bindingHash = hash({domain:'company-ledger:binding:v1',companyHash,binding})
batchHash = hash({domain:'company-ledger:batch:v1',companyHash,bindingHash,
                  expectedHead,records})
```

Known application event names are allowlisted. Unknown names become the fixed `private.event`, so an arbitrary event name cannot expose customer text. Full raw data remains private. Complete local sequence must start at1 without gaps/reordering; foreign company event scope, invalid dates, oversized events or rewritten batch-prefix data hold rather than being silently skipped. Limits:100000 events,1MiB/event,50 records/batch or reconciliation suffix, safe-integer sequences.

## Actions and exact plans

All operations require real server-verified owner access, including export/RPC view. Actions are exactly `{id,type}`; inputs reject unknown fields.

| Action | Input | Behavior |
| --- | --- | --- |
| `ledger_chain_view` | `{}` | Owner-safe local head, immutable binding/checkpoint, normalized chain observation, batch summaries, wallet/build projection and reason code |
| `ledger_chain_export` | `{}` | Redacted complete public record chain/head; works in explicit setup with no network/account/model/commercial policy |
| `ledger_chain_prepare` | `{limit?}` with1–50 | Compare current final RPC head to saved local checkpoint; create one immutable unsigned batch and initial binding checkpoint if needed |
| `ledger_chain_publish` | `{batchId}` | Always held in this implementation; see financial/signing boundary below |
| `ledger_chain_reconcile` | `{batchId}` | Advance only on exact actual final RPC evidence for the batch or a fully verified later suffix; no native/USD cost claim |

Plans use `{kind,puts,events,executionAllowed:false,grantsSpendingAuthority:false,...}`; no Rules financial permit is issued. Plan puts are `{namespace,id,value,expectedVersion:null|number}` with null meaning CAS0. Events are Rules-owned `ledger.chain_prepared` and `ledger.chain_confirmed` with owner actor and original causation ID.

Namespaces: `ledgerChainBatches` (batch ID `${action.id}:batch`) and `ledgerChainCheckpoints` (ID companyHash). Checkpoint fields are `{id,companyId,companyHash,bindingHash,sequence,hash,version,updatedAt}`. First preparation persists a genesis checkpoint from the actual observed empty head; it does not silently adopt an unrelated nonempty chain.

Prepared batch contains `{id,companyId,companyHash,binding,bindingHash,startSequence,endSequence,previousHash,expectedHead,records,batchHash,status:'prepared',version,createdAt,updatedAt,unsignedCall}`. It binds:

```js
unsignedCall: {
  receiverId: binding.contractId,
  methodName: 'append',
  args: {
    company_hash: companyHash,
    expected_sequence: expectedHead.sequence,
    expected_hash: expectedHead.hash,
    records // exact camelCase public records
  }
}
```

No gas, deposit, key or signer fallback is inferred for the unsigned call. Persisted unsigned args are revalidated against the batch; changing them invalidates the batch. One outstanding prepared/unknown/submitted batch blocks new preparation. Network/contract/signer changes against any batch/checkpoint are held/denied. A restart never clears the original outbox scope.

Reconciliation requires the batch's exact end sequence/hash at an actual final head. If the chain is later, actual `rpc.records` must contain every exact contiguous local record from the batch end through that head, at most50 records. Missing/conflicting/duplicated/reordered suffix records hold. Checkpoint never rolls back. Confirmed replay performs no puts. Reconciliation returns `costReconciled:false`; a ledger inclusion cannot reconcile gas/USD charges or release unknown financial reservations.

## Publication is intentionally fail-closed

No provider signing/submission route is enabled. A selected network, generated deployment wallet, pasted transaction hash, owner workspace role or current chain read does not establish operational signing or paid-call authority.

Protected authorization diagnostic shape:

```js
{ id, route:'near-agent-api-native-call',companyId,companyHash,bindingHash,
  batchHash,operationId:batch.id,notBefore,expiresAt,maxCalls:1,
  agentId,grantId,allowedReceiverId:binding.contractId,allowedMethod:'append',
  maxGasUnits,maxDepositYocto,maxFeeYocto,maxCostNanoUsd,maxTotalNanoUsd }
```

All caps are canonical nonnegative integer strings, with positive gas/fee/USD/total scope. `feeBound` is private, request/binding-specific and time-bounded:

```js
{ source:'near-rpc-fee-bound',bindingHash,batchHash,reference,usdReference,
  validUntil,gasUnits,depositYocto,maxFeeYocto,maxCostNanoUsd }
```

This structurally checked diagnostic record alone does not prove provider containment or FX attribution. Append is nonpayable, so nonzero deposit is denied. Gas/native-fee/USD limits are compared as exact integers without inventing native-asset/USD conversion. Shared lifetime actual+pending Treasury exposure is compared to the minimum existing policy/runtime/private authorization ceiling and the current USD5 maximum, independently of worker/day/restart. Unknown reservations remain fully counted. No separate allowance is created for this module.

Reasons include `LEDGER_CHAIN_AUTHORIZATION_REQUIRED`, `LEDGER_CHAIN_FEE_BOUND_REQUIRED`, `LEDGER_CHAIN_FEE_CAP_EXCEEDED`, `LEDGER_CHAIN_DEPOSIT_UNSUPPORTED`, `TOTAL_CEILING_EXCEEDED`. Even structurally complete bounded facts end in **`LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED`**, with no executable allow, permit, native API request or key disclosure.

Before lifting that final hold, coordinator must implement together: actual protected Agent API native-call grant/key containment, independently attributable native-fee/USD bounds, the existing shared Treasury native resource+USD reservation/consumption protocol, one immutable original signed transaction identity, and a fresh synchronous authorization/kill/binding/head/cap gate immediately before submission. Unknown submits retain that original identity and full reservation; no blind retry. Raw 1Click quote authority is never repurposed as signing permission. The known Agent API native route does not inherit budget/timelock/owner-approval guarantees from other endpoints.

An explicit current kill blocks prepare/publish. Read/export and read-only exact reconciliation remain available without a funded-readiness cycle. Setup mode supports the zero-paid portions without commercial model/wallet policy. Invalid explicit config still blocks; all existing research privacy, inference proof, custody and financial gates remain unchanged.

## Owner deployment projections

`deploymentWallet` is supplied privately from matching-company public metadata and an actual read-only account observer:

```js
{companyId,networkId,accountId,publicKey,
 accountExists:null|boolean,balanceYocto:null|integerString,observedAt:null|ISO}
```

View allowlists only those fields. Missing/future/invalid observation does not fabricate an account/balance. Cross-company wallet data is omitted. Credential file paths, private keys and arbitrary extra fields are never copied. Public wallet metadata does not fill `binding.signerId`; binding remains null until the explicit operational writer identity exists.

Optional `deployment:{wasmHash,wasmBytes,codeHash}` becomes `plan.contractArtifact` with only those fields. This means compiled artifact metadata, not deployed/sandbox-verified/paid success. Coordinator separately generated the requested private mainnet deployment wallet and is responsible for its public funding-address UI, actual account reads, contract build/sandbox work and any future separately scoped deployment effects. S1 performed none of those actions.
