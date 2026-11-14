import {readFileSync,statSync} from 'node:fs';
import {ContractError,fingerprint} from '../contracts.mjs';

export function createRuntimeProviders(options={}){
  const protectedDocument=path=>{try{if(!path)return null;const info=statSync(path);if(info.size>262144||process.platform!=='win32'&&(info.mode&0o077))return null;return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}};
  const authorizationPath=options.authorizationPath??process.env.SHOP_AUTHORIZATION_FILE;
  const readAuthorization=()=>{
    if(options.getAuthorization)return options.getAuthorization();
    if(!authorizationPath)return null;
    try{
      const info=statSync(authorizationPath);
      if(process.platform!=='win32'&&(info.mode&0o077))return null;
      return JSON.parse(readFileSync(authorizationPath,'utf8'));
    }catch{return null;}
  };
  const componentPath=options.componentAuthorizationPath??process.env.SHOP_COMPONENT_AUTHORIZATION_FILE;
  const agentAuthorizationPath=options.agentAuthorizationPath??process.env.SHOP_AGENT_AUTHORIZATION_FILE;
  const getAgentAuthorization=()=>{
    if(options.getAgentAuthorization)return options.getAgentAuthorization();
    if(!agentAuthorizationPath)return null;
    try {const info=statSync(agentAuthorizationPath);if(info.size>262144||(process.platform!=='win32'&&(info.mode&0o077)))return null;
      return JSON.parse(readFileSync(agentAuthorizationPath,'utf8'));}catch{return null;}
  };
  const getComponentAuthorization=()=>{
    if(options.getComponentAuthorization)return options.getComponentAuthorization();
    if(!componentPath)return null;
    try{const info=statSync(componentPath);if(info.size>262144||(process.platform!=='win32'&&(info.mode&0o077)))return null;
      return JSON.parse(readFileSync(componentPath,'utf8'));}catch{return null;}
  };
  // Names, never secret values, are persisted or returned through readiness.
  const resolveSecret=options.resolveSecret??(async name=>process.env[name]||null);
  const boundsPath=options.inferenceBoundsPath??process.env.SHOP_INFERENCE_BOUNDS_FILE;
  const getInferenceBounds=()=>{if(options.getInferenceBounds)return options.getInferenceBounds();try{return boundsPath?JSON.parse(readFileSync(boundsPath,'utf8')):null;}catch{return null;}};
  let ownerFileToken;
  const ownerTokenFile=options.ownerTokenFile??process.env.SHOP_OWNER_TOKEN_FILE;
  if(ownerTokenFile){const info=statSync(ownerTokenFile);if(process.platform!=='win32'&&(info.mode&0o077))throw new ContractError('OWNER_TOKEN_PERMISSIONS','Owner token file must be private (0600).');ownerFileToken=readFileSync(ownerTokenFile,'utf8').trim();}
  return {getAuthorization:readAuthorization,getComponentAuthorization,getAgentAuthorization,getInferenceBounds,resolveSecret,
    getAiDemoAuthorization:()=>options.getAiDemoAuthorization?options.getAiDemoAuthorization():protectedDocument(options.aiDemoAuthorizationPath??process.env.SHOP_AI_DEMO_AUTHORIZATION_FILE),
    getIntegrationAuthorization:()=>options.getIntegrationAuthorization?options.getIntegrationAuthorization():protectedDocument(options.integrationAuthorizationPath??process.env.SHOP_INTEGRATION_AUTHORIZATION_FILE),
    getLedgerAuthorization:()=>options.getLedgerAuthorization?options.getLedgerAuthorization():protectedDocument(options.ledgerAuthorizationPath??process.env.SHOP_LEDGER_AUTHORIZATION_FILE),
    agentId:options.agentId??process.env.NEAR_AGENT_ID,accountId:options.accountId??process.env.NEAR_AGENT_ACCOUNT_ID,
    cloudSecretRef:options.cloudSecretRef??'NEAR_AI_API_KEY',agentSecretRef:options.agentSecretRef??'NEAR_INTENTS_AGENT_API_KEY',grantRef:options.grantRef??'NEAR_AGENT_GRANT_TOKEN',
    ownerToken:options.ownerToken??ownerFileToken??process.env.SHOP_OWNER_TOKEN};
}

export async function bindStoreMode(journal,mode,companyId,economicIdentity){
  const old=journal.get('runtime','binding');
  const financial=journal.get('treasury','financial');
  const hasEconomicHistory=journal.list('orders').length>0||(financial?.version??0)>0||journal.recoverableOperations().length>0;
  const setupTransition=old?.mode==='setup'&&mode==='live'&&!hasEconomicHistory;
  const historical=journal.list('orders').some(o=>o.mode!==mode);
  if((old&&(old.companyId!==companyId||(old.mode!==mode&&!setupTransition)))||historical)throw new ContractError('STORE_MODE_MISMATCH','Use a separate data directory for each company and execution mode. Historical stores are not migrated automatically.');
  const binding={mode,companyId};
  const established=journal.get('runtime','economicIdentity');
  if(established&&fingerprint({...established,creditBinding:established.creditBinding??null,cashBinding:established.cashBinding??null})!==fingerprint(economicIdentity)){
    const initialSelection=established.mode==='setup'&&mode==='live'&&!hasEconomicHistory;
    if(!initialSelection)throw new ContractError('ECONOMIC_IDENTITY_MISMATCH','Provider account, bucket, network and settlement asset are bound to this store. Use a separate store or an audited migration.');
  }
  if(!established&&mode==='live'&&hasEconomicHistory)throw new ContractError('ECONOMIC_IDENTITY_REQUIRED','Legacy economic history cannot be assigned to an unverified new account.');
  await journal.transaction({actionId:`runtime:binding:${fingerprint({binding,economicIdentity})}`,fingerprint:fingerprint({binding,economicIdentity})},tx=>{
    tx.put('runtime','binding',binding);tx.put('runtime','economicIdentity',economicIdentity);return null;
  });
}
