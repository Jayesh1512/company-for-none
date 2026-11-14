// Wallet APIs are supplied by the user's connected wallet. No secret, signing key,
// fallback signer or browser owner-token storage is accepted here.
export async function signOwnerIntent(intent,wallet){
 if(!wallet||!intent?.intent||Date.parse(intent.expires_at)<=Date.now())throw Error('A connected owner wallet and unexpired intent are required.');
 const {standard,payload}=intent.intent;
 if(standard==='nep413'){
  if(typeof wallet.signMessage!=='function')throw Error('This wallet does not support NEP-413 message signing.');
  const result=await wallet.signMessage({message:payload.message,recipient:payload.recipient,nonce:Uint8Array.from(atob(payload.nonce),c=>c.charCodeAt(0))});
  if(!result)throw Error('Wallet signing was canceled.');
  return {standard,payload,public_key:result.publicKey,signature:result.signature};
 }
 if(standard==='nep366'){
  if(typeof wallet.signDelegateActions!=='function')throw Error('This wallet does not support NEP-366 delegated signing.');
  const result=await wallet.signDelegateActions(payload);if(typeof result!=='string')throw Error('The wallet must return the original encoded signed delegate.');
  return {standard,payload,signed_delegate:result};
 }
 if(standard==='eip712'){
  if(typeof wallet.signTypedData!=='function')throw Error('This wallet does not support the provider-selected typed-data signing.');
  return {standard,payload,signature:await wallet.signTypedData(payload)};
 }
 if(standard==='webauthn'){
  if(typeof wallet.getPasskeyAssertion!=='function')throw Error('Connect the owner passkey provider for the exact relying-party challenge.');
  return {standard,payload,credential:await wallet.getPasskeyAssertion(payload)};
 }
 throw Error('Connect a wallet supporting the exact provider-selected '+standard+' flow; no alternate signing route is selected.');
}

/** Explicit owner-click bridge for an installed EIP-1193 wallet. The provider
 * chooses EIP-712; no chain switch, signing-key import or alternate payload. */
export async function signWithEvmWallet(intent,provider){
 if(intent?.intent?.standard!=='eip712'||intent.signer?.type!=='evm'||typeof provider?.request!=='function')throw Error('This exact intent requires its supported owner wallet.');
 const accounts=await provider.request({method:'eth_requestAccounts'}),chain=await provider.request({method:'eth_chainId'});
 const address=intent.signer.address;
 if(!accounts.some(a=>a.toLowerCase()===address)||BigInt(chain)!==BigInt(intent.signer.chain_id))throw Error('Select the exact owner address and chain shown in the intent.');
 const payload=intent.intent.payload;
 if(payload.domain?.chainId!==undefined&&BigInt(payload.domain.chainId)!==BigInt(intent.signer.chain_id))throw Error('Provider payload and owner chain disagree.');
 return signOwnerIntent(intent,{signTypedData:exact=>provider.request({method:'eth_signTypedData_v4',params:[address,JSON.stringify(exact)]})});
}
