import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJournal } from './journal/index.mjs';
import { createTreasury } from './treasury/index.mjs';
import { createRules } from './rules/index.mjs';
import {createAgentApiCustody} from './custody/agent-api.mjs';
import {createReadinessRuntime} from './runtime/readiness.mjs';
import {createCreditReadiness} from './runtime/credit-readiness.mjs';
import {createCloudComponents} from './runtime/components.mjs';
import {createNearCloudProducts} from './runtime/cloud-products.mjs';
import {createRuntimeProviders,bindStoreMode} from './runtime/providers.mjs';
import { createCustodyAdapter } from './custody/index.mjs';
import { createPaymentsAdapter } from './payments/index.mjs';
import { createCloudFundingAdapter } from './cloud-funding/index.mjs';
import { createInferenceAdapter } from './inference/index.mjs';
import { createResearch } from './research/index.mjs';
import { createPayouts } from './payouts/index.mjs';
import { createLedger } from './ledger/index.mjs';
import { createWorkspace } from './workspace/index.mjs';
import { createWeb } from './web/index.mjs';
import { readFileSync } from 'node:fs';
import { createJBrainClient } from './knowledge/client.mjs';
import { createCompanyKnowledge } from './knowledge/index.mjs';
import {createCustomerCare,readSupportFacts} from './support/index.mjs';
import {createOnchainLedger,readLedgerFacts} from './onchain/index.mjs';
import {wasmCodeHash} from './onchain/rpc.mjs';
import {createHash} from 'node:crypto';
import {createAgentLedgerWriter} from './onchain/agent-writer.mjs';
import {createAgentSpendPort} from './custody/agent-spend.mjs';
import {createSpendExecutor} from './workflow/spend.mjs';
import {createLedgerCommitter} from './onchain/ledger-commit.mjs';
import {createLedgerAutoCommit} from './onchain/ledger-autocommit.mjs';
import { createKnowledgeImporter } from './knowledge/import.mjs';
import { createWorkflow } from './workflow/index.mjs';
import {createInternalWork} from './workflow/internal.mjs';
import {createAutonomy} from './autonomy/index.mjs';
import {readAutonomyFacts} from './autonomy/facts.mjs';
import {catalog as defaultCatalog} from './workspace/catalog.mjs';
import { fingerprint,ContractError } from './contracts.mjs';
import {createNearIntegrations,readIntegrationFacts} from './integrations/index.mjs';
import {createAiDemo,readAiDemoFacts} from './demo/ai.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function createApp(options={}) {
  const clock=options.clock??(()=>new Date());
  const companyId=options.companyId??process.env.SHOP_COMPANY_ID??'local-workspace';
  const demoControl=options.demoControl??{},localDemoContext=options.localDemoContext??null;
  if(localDemoContext){let url;try{url=new URL(localDemoContext.returnUrl);}catch{}if(companyId!=='real-local-demo'||localDemoContext.kind!=='real-local-demo'||!url||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new ContractError('LOCAL_DEMO_CONTEXT_INVALID','Use a trusted isolated local demo context.');}
  const providers=createRuntimeProviders(options);
  const ownerConfigPath=Object.hasOwn(options,'configPath')?options.configPath:process.env.SHOP_CONFIG_PATH;
  let journal=null,economicIdentity=null,onchainLedger=null,nearIntegrations=null;
  const catalog=(options.catalog??defaultCatalog).map(item=>({...item,version:item.version??'1'}));
  const getAutonomyFacts=()=>readAutonomyFacts({journal,catalog,companyId});
  const getSupportFacts=action=>readSupportFacts({journal,companyId,action});
  const ledgerBinding=Object.hasOwn(options,'ledgerBinding')?options.ledgerBinding:(process.env.SHOP_LEDGER_NETWORK&&process.env.SHOP_LEDGER_CONTRACT_ID&&process.env.SHOP_LEDGER_SIGNER_ID?{networkId:process.env.SHOP_LEDGER_NETWORK,contractId:process.env.SHOP_LEDGER_CONTRACT_ID,signerId:process.env.SHOP_LEDGER_SIGNER_ID}:null);
  let deploymentWallet=null,deployment=null;
  const walletPublicFile=options.ledgerWalletPublicFile??process.env.SHOP_LEDGER_WALLET_PUBLIC_FILE;
  if(walletPublicFile){const value=JSON.parse(readFileSync(walletPublicFile,'utf8'));if(value.companyId!==companyId)throw new ContractError('LEDGER_WALLET_COMPANY_MISMATCH','This deployment wallet belongs to another company.');deploymentWallet={companyId,networkId:value.networkId,accountId:value.accountId,publicKey:value.publicKey,accountExists:null,balanceYocto:null,observedAt:null};}
  try{const wasm=readFileSync(options.ledgerWasmPath??path.join(root,'artifacts/onchain-ledger/company-ledger.wasm'));deployment={wasmHash:createHash('sha256').update(wasm).digest('hex'),wasmBytes:wasm.length,codeHash:wasmCodeHash(wasm)};}catch(error){if(error.code!=='ENOENT')throw error;}
  const getLedgerFacts=()=>readLedgerFacts({journal,companyId,binding:ledgerBinding,deploymentWallet:onchainLedger?.walletObservation()??deploymentWallet,deployment,authorization:providers.getLedgerAuthorization(),feeBound:options.getLedgerFeeBound?.(),signingEnvelope:options.getLedgerSigningEnvelope?.(),nativeAccount:onchainLedger?.nativeObservation(),costEvidence:onchainLedger?.costEvidence()});
  const getIntegrationFacts=()=>{const f=nearIntegrations?.facts()??{};return readIntegrationFacts({journal,companyId,authorization:providers.getIntegrationAuthorization(),bounds:[...(f.bounds??[]),...(options.getIntegrationBounds?.()??[])],resources:[...(f.resources??[]),...(options.getIntegrationResources?.()??[])],costs:[...(f.costs??[]),...(options.getIntegrationCosts?.()??[])]});};
  const rules=options.rules??createRules({getAiDemoFacts:()=>readAiDemoFacts({journal,companyId,providers}),localDemoContext,totalCeilingNanoUsd:options.totalCeilingNanoUsd??process.env.SHOP_TOTAL_CEILING_NANO_USD,setupOnly:!ownerConfigPath,configPath:ownerConfigPath,clock,companyId,getAutonomyFacts,getSupportFacts,getLedgerFacts,getIntegrationFacts,getAgentAuthorization:providers.getAgentAuthorization,getRuntimeFacts:()=>options.getRuntimeFacts?.()??({observations:journal?.list('runtimeFacts')??[],economicIdentity,economicObservations:journal?.list('economicObservations')??[],economicReceipts:journal?.list('economicReceipts')??[],verificationResults:journal?.list('verificationResults')??[],componentResults:journal?.list('componentResults')??[],internalResults:journal?.list('internalResults')??[],componentModel:options.componentModel??process.env.SHOP_COMPONENT_MODEL??null}),getComponentAuthorization:providers.getComponentAuthorization,getAuthorization:providers.getAuthorization,getInferenceBounds:providers.getInferenceBounds,getOperationState:()=>journal.get('organization',companyId)?.activation});
  journal=await createJournal({directory:options.directory??process.env.SHOP_DATA_DIR??path.join(root,'.runtime/company-workspace'),clock});
  try {
  const treasury=createTreasury({journal,clock,getPolicyState:()=>rules.snapshot()});
  const mode=rules.snapshot().mode;
  if(typeof companyId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(companyId))throw new ContractError('INVALID_INPUT','Invalid server company identifier.');
  if(mode==='live'&&providers.accountId&&providers.accountId!==rules.snapshot().config?.treasuryAccount)throw new ContractError('ACCOUNT_MISMATCH','The configured Agent API account must match the Rules treasury account.');
  const companyBinding=journal.get('workspaceSettings','company');
  if((companyBinding&&companyBinding.id!==companyId)||journal.list('agents').some(a=>a.companyId&&a.companyId!==companyId)) {await journal.close();throw new ContractError('STORE_COMPANY_MISMATCH','This data directory belongs to a different company. Choose its original company ID or a separate directory.');}
  const commercial=rules.snapshot().config;
  economicIdentity={companyId,mode,provider:commercial?'near-agent-api':null,network:commercial?.settlementAsset.network??null,treasuryAccount:commercial?.treasuryAccount??null,accountId:providers.accountId??commercial?.treasuryAccount??null,bucket:options.agentBalanceSource??process.env.SHOP_AGENT_BALANCE_SOURCE??null,settlementAsset:commercial?.settlementAsset??null,asset:commercial?.settlementAsset.asset??null,decimals:commercial?.settlementAsset.decimals??null,creditBinding:options.creditBinding??null,cashBinding:options.cashBinding??null};
  await bindStoreMode(journal,mode,companyId,economicIdentity);
  await journal.transaction({actionId:`workspace-company:${companyId}`,fingerprint:fingerprint({companyId})},tx=>{tx.put('workspaceSettings','company',{id:companyId});return null;});
  const knowledgeClient=options.jbrainClient??createJBrainClient({url:options.jbrainUrl??process.env.SHOP_JBRAIN_URL,token:options.jbrainToken??process.env.SHOP_JBRAIN_TOKEN??(process.env.SHOP_JBRAIN_TOKEN_FILE?readFileSync(process.env.SHOP_JBRAIN_TOKEN_FILE,'utf8').trim():'')});
  const knowledge=createCompanyKnowledge({journal,rules,companyId,clock,client:knowledgeClient});
  async function recordPolicy() {
    const state=rules.snapshot();
    const id=fingerprint({policyVersion:state.policyVersion,policyEpoch:state.policyEpoch,error:state.error,safety:state.safety});
    await journal.transaction({actionId:`policy:${id}`,fingerprint:id},tx=>{tx.put('policySnapshots',id,state);return null;});
  }
  await recordPolicy();
  async function initialize(){if(options.initialize)await options.initialize({journal,treasury,rules});}
  const dispatchAuthorized=async({action,decision,facts},callback)=>{
    await recordPolicy();
    const currentOrder=action.orderId?journal.get('orders',action.orderId):facts.order;
    const currentAgent=currentOrder?.agentContext?.id?journal.get('agents',currentOrder.agentContext.id):null;
    const before=rules.validateDispatch(decision.permit,{...facts,action,currentAgent,order:currentOrder,financial:treasury.snapshot()});
    if(before.status!=='allow')return before;
    await treasury.consumePermit({actionId:action.id,permit:decision.permit,decision:before});
    // Permit consumption yields. Read order and agent again at the immediate final gate.
    const finalOrder=action.orderId?journal.get('orders',action.orderId):facts.order;
    if(action.type==='inference')try{knowledge.assertSnapshot(finalOrder?.agentContext?.companyKnowledge);}catch(error){if(error.decision)return error.decision;throw error;}
    if(action.type==='agent_inference')try{const work=journal.get('agentWork',action.workId);knowledge.assertSnapshot(work?.context?.companyKnowledge,{role:'agent',companyId,workId:action.workId,runId:action.runId,fence:action.fence});}catch(error){if(error.decision)return error.decision;throw error;}
    return rules.dispatch(decision.permit,{...facts,action,currentAgent:finalOrder?.agentContext?.id?journal.get('agents',finalOrder.agentContext.id):null,order:finalOrder,financial:treasury.snapshot()},callback);
  };
  const adapterOptions={journal,clock,mode:mode==='live'?'live':'unavailable',dispatchAuthorized};
  if(mode==='fixture'&&!options.createAdapters)throw new ContractError('TEST_COMPOSITION_REQUIRED','Fixture providers require an explicit isolated test composition.');
  const injected=options.createAdapters?await options.createAdapters({journal,clock,dispatchAuthorized,rules}):{};
  const custody=injected.custody??options.custody??(mode==='live'?createAgentApiCustody({...adapterOptions,agentId:providers.agentId,accountId:providers.accountId,balanceSource:options.agentBalanceSource??process.env.SHOP_AGENT_BALANCE_SOURCE,network:rules.snapshot().config?.settlementAsset.network,resolveSecret:providers.resolveSecret,secretRef:providers.agentSecretRef,grantRef:providers.grantRef,transport:options.agentTransport,proofs:options.agentProofs,getProofInputs:options.getAgentProofInputs,movement:options.agentMovement,getMovementInputs:options.getAgentMovementInputs}):createCustodyAdapter({...adapterOptions}));
  const payments=injected.payments??options.payments??createPaymentsAdapter({...adapterOptions,settlementEvidence:options.settlementEvidence,transport:options.paymentTransport,resolveSecret:providers.resolveSecret,secretRef:options.paymentSecretRef??process.env.SHOP_PAYMENTS_SECRET_REF,authScheme:options.paymentAuthScheme??process.env.SHOP_PAYMENTS_AUTH_SCHEME??null,slippageTolerance:options.slippageTolerance??Number(process.env.SHOP_SLIPPAGE_BPS??50)});
  const funding=injected.funding??options.funding??createCloudFundingAdapter({...adapterOptions,resolveSecret:providers.resolveSecret});
  const authorizePreparation=({action,request})=>{
    const decision=rules.evaluate({id:`${action.id}:preparation-authority:${action.runId}:${action.fence}`,type:'agent_prepare',workId:action.workId,runId:action.runId,fence:action.fence},{financial:treasury.snapshot()});
    return decision.status==='allow'&&fingerprint(decision.plan.action)===fingerprint(action)&&fingerprint(decision.plan.request)===fingerprint(request)?decision:{status:'hold',reasonCode:decision.reasonCode??'PREPARATION_SCOPE_CHANGED'};
  };
  const inference=injected.inference??options.inference??createInferenceAdapter({...adapterOptions,authorizePreparation,resolveSecret:providers.resolveSecret,secretRef:providers.cloudSecretRef,transport:options.inferenceTransport});
  const sourceUrls=options.sourceUrls??(process.env.SHOP_SOURCE_URLS??'').split(',').filter(Boolean);
  const research=options.research??createResearch({clock:()=>new Date(clock()).toISOString()});
  const payouts=createPayouts({journal,treasury,custody,rules});
  const workflow=createWorkflow({journal,treasury,rules,custody,payments,funding,inference,research,payouts,clock,sourceUrls,initialize,catalog:options.catalog,getOperationState:()=>journal.get('organization',companyId)?.activation});
  const ledger=createLedger({journal,rules,treasury});
  const readiness=()=>options.readiness?.({custody,payments,funding,inference})??journal.list('runtimeFacts');
  const workspace=createWorkspace({journal,workflow,rules,clock,knowledge,companyId,readiness,catalog:options.catalog});
  const ledgerWriter=createAgentLedgerWriter({journal,binding:ledgerBinding,agentId:providers.agentId,secretRef:providers.agentSecretRef,grantRef:providers.grantRef,resolveSecret:providers.resolveSecret,dispatchAuthorized,transport:options.agentTransport,clock});
  onchainLedger=createOnchainLedger({journal,rules,treasury,writer:ledgerWriter,companyId,binding:ledgerBinding,deploymentWallet,deployment,clock,transport:options.ledgerTransport,rpcUrl:options.ledgerRpcUrl,getUsdBound:options.getNativeUsdBound});
  const customerCare=createCustomerCare({journal,rules,workspace,knowledge,jbrainClient:knowledgeClient,companyId,clock});
  const aiDemo=createAiDemo({journal,rules,treasury,knowledge,providers,companyId,clock,...(options.loadCloudVerification?{loadVerification:options.loadCloudVerification}:{}),...(options.aiDemoReadProvider?{readProvider:options.aiDemoReadProvider}:{})});
  const internalWork=createInternalWork({journal,rules,treasury,inference,knowledge,catalog,companyId,clock,getAgentAuthorization:providers.getAgentAuthorization});
  // Real agent spend + on-chain ledger auto-commit, wired only when the Agent API
  // and ledger contract are configured. Both are injected so an unconfigured
  // deployment behaves exactly as before (no port, no spend, no chain writes).
  // Secrets are resolved lazily so an unconfigured or test deployment never calls
  // resolveSecret at construction. Configured only when the Agent API id, a grant
  // ref and a ledger contract are present; anything missing keeps the graph inert.
  const agentApiBaseUrl=options.agentApiBaseUrl??process.env.NEAR_INTENTS_AGENT_API_URL;
  const agentConfigured=Boolean(providers.agentId&&providers.grantRef&&providers.resolveSecret&&ledgerBinding?.contractId&&options.enableAgentSpend!==false);
  let spendExecutor=null,ledgerAutoCommit=null;
  if(agentConfigured){
    let sdkApi=null;
    const resolve=async()=>{
      const apiKey=await providers.resolveSecret(providers.agentSecretRef),grantToken=await providers.resolveSecret(providers.grantRef);
      if(!apiKey||!grantToken)throw Object.assign(new Error('AGENT_CREDENTIALS_UNAVAILABLE'),{code:'AGENT_CREDENTIALS_UNAVAILABLE'});
      if(!sdkApi){const {createAgentApi}=await import('@near-intents-agent-api/sdk');sdkApi=createAgentApi({apiKey,baseUrl:agentApiBaseUrl});}
      return {apiKey,grantToken,api:sdkApi};
    };
    // The port takes resolved values; wrap it so the first real spend resolves lazily.
    const agentSpend={
      capability:()=>({provider:'near-agent-api',configured:true,kinds:['swap','transfer'],grantsSpendingAuthority:false,evidenceLevel:'provider-http'}),
      async spend(request){const {apiKey,grantToken}=await resolve();return createAgentSpendPort({apiKey,baseUrl:agentApiBaseUrl,agentId:providers.agentId,grantToken}).spend(request);},
    };
    const committer={async append(events){const {api,grantToken}=await resolve();return createLedgerCommitter({api,agentId:providers.agentId,grantToken,contractId:ledgerBinding.contractId,companyId}).append(events);},async head(){const {api,grantToken}=await resolve();return createLedgerCommitter({api,agentId:providers.agentId,grantToken,contractId:ledgerBinding.contractId,companyId}).head();}};
    spendExecutor=createSpendExecutor({journal,agentSpend,companyId,ledger:committer});
    ledgerAutoCommit=createLedgerAutoCommit({journal,committer,companyId});
  }
  const autonomy=createAutonomy({journal,rules,internalWork,companyId,clock,spendExecutor,ledgerAutoCommit});
  await workspace.initialize();
  if(options.initializeWorkspace)await options.initializeWorkspace({workspace,journal,rules});
  await knowledge.recover();
  const knowledgeImporter=createKnowledgeImporter({rules,companyId,clock,...(options.knowledgeRetrieve?{retrieve:options.knowledgeRetrieve}:{})});
  const runtime=createReadinessRuntime({journal,rules,identity:()=>economicIdentity,providers,knowledgeClient,sourceUrls,clock,transports:{inference:options.inferenceTransport,payments:options.paymentTransport,custody:options.agentTransport}});
  const components=createCloudComponents({journal,rules,treasury,providers,clock,...(options.loadCloudVerification?{loadVerification:options.loadCloudVerification}:{})});
  const cloudProducts=createNearCloudProducts({journal,rules,knowledge,providers,companyId,clock,dispatchAuthorized,transport:options.cloudProductTransport,
    reportingOrganizationId:options.reportingOrganizationId??process.env.SHOP_CLOUD_REPORTING_ORGANIZATION_ID,
    reportingSecretRef:options.reportingSecretRef??process.env.SHOP_CLOUD_REPORTING_SECRET_REF,
    allowDeprecatedReporting:options.allowDeprecatedReporting??process.env.SHOP_CLOUD_LEGACY_REPORTING==='true'});
  const creditOrganizationId=options.creditOrganizationId??process.env.SHOP_CLOUD_CREDIT_ORGANIZATION_ID;
  const creditSessionSecretRef=options.creditSessionSecretRef??process.env.SHOP_CLOUD_SESSION_SECRET_REF;
  // Explicit existing Cloud bindings select a production READ port only. This
  // does not change the company runtime or enable purchases/inference.
  const creditReadAdapter=options.creditReadAdapter??createCloudFundingAdapter({mode:creditOrganizationId&&creditSessionSecretRef?'live':'unavailable',clock,resolveSecret:providers.resolveSecret,transport:options.cloudCreditTransport});
  const creditReadiness=createCreditReadiness({journal,rules,adapter:creditReadAdapter,organizationId:creditOrganizationId,sessionSecretRef:creditSessionSecretRef,keySecretRef:providers.cloudSecretRef});
  const outlayerBinding=Object.hasOwn(options,'outlayerBinding')?options.outlayerBinding:(process.env.SHOP_OUTLAYER_PROJECT_OWNER?{projectOwner:process.env.SHOP_OUTLAYER_PROJECT_OWNER,projectName:process.env.SHOP_OUTLAYER_PROJECT_NAME,versionHash:process.env.SHOP_OUTLAYER_VERSION_HASH,computeMicroUsd:process.env.SHOP_OUTLAYER_COMPUTE_MICRO_USD??'1000',networkId:process.env.SHOP_OUTLAYER_NETWORK??'mainnet',paymentKeyOwner:process.env.SHOP_OUTLAYER_PAYMENT_KEY_OWNER,paymentKeyNonce:Number(process.env.SHOP_OUTLAYER_PAYMENT_KEY_NONCE)}:null);
  nearIntegrations=createNearIntegrations({journal,rules,treasury,providers,dispatchAuthorized,companyId,autonomy,clock,technical:{outlayer:outlayerBinding,ledgerBinding},transport:options.integrationTransport,verifyOutlayer:options.verifyOutlayerExecution,verifyPingSettlement:options.verifyPingSettlement});
  const web=createWeb({aiDemo,companyId,demoControl,localDemoContext,demoFacts:()=>({agentCount:journal.list('agents').length,documentCount:journal.list('companyKnowledgeDocuments').length,serviceCount:journal.list('supportServices').length,conversationCount:journal.list('supportConversations').length,ticketCount:journal.list('supportTickets').length,replyCount:journal.list('supportMessages').filter(m=>m.role==='assistant').length,eventCount:journal.events().length,providerOperations:Object.keys(journal.snapshot().operations).length,financialVersion:treasury.snapshot().version}),nearIntegrations,onchainLedger,customerCare,creditReadiness,runtime,components,cloudProducts,autonomy,workflow,ledger,rules,readiness,workspace,knowledge,knowledgeImporter,ownerToken:providers.ownerToken});
  await initialize();
  return {aiDemo,demoControl,localDemoContext,nearIntegrations,onchainLedger,customerCare,rules,journal,treasury,custody,payments,funding,inference,research,payouts,workflow,ledger,web,readiness,workspace,knowledge,providers,runtime,components,cloudProducts,creditReadiness,autonomy,internalWork,close:async()=>{await autonomy.close();await journal.close();}};
  } catch(error) {await journal.close();throw error;}
}
