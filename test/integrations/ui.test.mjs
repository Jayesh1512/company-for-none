import test from 'node:test';
import assert from 'node:assert/strict';
import {renderNearIntegrations} from '../../public/near-integrations.js';
import {renderOnchainLedger} from '../../public/onchain-ledger.js';
import {signOwnerIntent,signWithEvmWallet} from '../../public/owner-wallet.js';

test('integration surface escapes untrusted inputs and enables execution only from server readiness',()=>{
 const state={nearIntegrations:{enabled:['owner_generate'],prerequisites:{owner:'PARTNER_CREDENTIAL_AND_EXACT_SIGNED_INTENT_REQUIRED'},plans:[{id:'<img src=x onerror=alert(1)>',hash:'h',kind:'owner_generate',readiness:{executionAllowed:false,reasonCode:'INTEGRATION_AUTHORIZATION_REQUIRED'}}],runs:[]},integrationDraft:'</textarea><script>bad()</script>'};
 const html=renderNearIntegrations(state);assert.ok(!html.includes('<script>bad()'));assert.ok(html.includes('Approve this exact prepared request'));assert.match(html,/data-integration-execute="[^"]+" disabled/);assert.ok(html.includes('No integration execution recorded'));assert.ok(html.includes('compatible external wallet'));
});
test('native publishing is separate from read-only status and shows original cost reconciliation',()=>{
 const html=renderOnchainLedger({ledgerChain:{localHead:{sequence:1},batches:[{id:'b',startSequence:1,endSequence:1,status:'prepared',batchHash:'hash',publishing:{executionAllowed:false,reasonCode:'LEDGER_CHAIN_SIGNING_PROTOCOL_REQUIRED'}}],submissions:[{id:'original-native',status:'unknown',costReconciled:false}]}});
 assert.match(html,/data-chain-publish="b" disabled/);assert.ok(html.includes('Reconcile original fee'));assert.ok(html.includes('Native fee not reconciled'));assert.ok(html.includes('No confirmed batch'));assert.ok(html.includes('data-chain-cost="original-native"'));
});
test('wallet bridge signs only the unchanged provider-selected EIP-712 payload and expected owner/chain',async()=>{
 const payload={domain:{chainId:1},types:{Intent:[{name:'hash',type:'string'}]},primaryType:'Intent',message:{hash:'exact-hash'}},intent={expires_at:'2099-01-01T00:00:00Z',signer:{type:'evm',address:'0x'+'a'.repeat(40),chain_id:1},intent:{standard:'eip712',payload}},calls=[];
 const provider={request:async p=>{calls.push(p);return p.method==='eth_requestAccounts'?[intent.signer.address]:p.method==='eth_chainId'?'0x1':'0x'+'b'.repeat(130);}};
 const signed=await signWithEvmWallet(intent,provider);assert.deepEqual(signed.payload,payload);assert.equal(calls[2].method,'eth_signTypedData_v4');assert.equal(calls[2].params[1],JSON.stringify(payload));assert.equal(calls.length,3);
 let signs=0;await assert.rejects(signWithEvmWallet(intent,{request:async p=>p.method==='eth_requestAccounts'?['0x'+'c'.repeat(40)]:p.method==='eth_chainId'?'0x1':signs++}));assert.equal(signs,0);
 await assert.rejects(signWithEvmWallet({...intent,intent:{standard:'nep366',payload}},provider));
});
test('NEP-366 bridge preserves provider delegate bytes and does not create a relayer or sign alternate payloads',async()=>{
 const payload={receiverId:'agents.near',actions:[{type:'FunctionCall',params:{methodName:'approve',gas:'30',deposit:'0',args:{exact:'commitment'}}}]},intent={expires_at:'2099-01-01T00:00:00Z',intent:{standard:'nep366',payload}};
 const result=await signOwnerIntent(intent,{signDelegateActions:async p=>{assert.equal(p,payload);return 'original-encoded-delegate';}});assert.equal(result.signed_delegate,'original-encoded-delegate');assert.deepEqual(result.payload,payload);
 await assert.rejects(signOwnerIntent(intent,{}),/NEP-366/);
});
