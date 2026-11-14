// Explicit test composition. No production module imports this file.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp as createProductApp} from '../../src/app.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {catalog} from '../../src/workspace/catalog.mjs';
import {createResearch} from '../../src/research/index.mjs';
import {fixtureOutput} from './research-fixtures.mjs';
import {fixtureSources,fixtureRetrieve} from './source-fixtures.mjs';
import {createFixtureCustodyAdapter,createFixturePaymentsAdapter,createFixtureCloudFundingAdapter,createFixtureInferenceAdapter} from '../integrations-adapters/fixture-adapters.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function createApp(options={}){
  const rules=options.rules??createRules({configPath:options.configPath??path.join(root,'config.example.yaml'),clock:options.clock});
  if(rules.snapshot().mode!=='fixture')return createProductApp(options);
  const legacyLicence={id:'licensed-research-checklist',purchaseRequired:true,kind:'skill',requirement:'skills',version:'1',name:'Fixture licensed checklist',publisher:'Fixture supplier',instructions:'Check source dates, citations, missing evidence and uncertainty.',summary:'Controlled licence fixture',priceLabel:'Simulated purchase',color:'sage',icon:'shield'};
  const app=await createProductApp({...options,rules,catalog:[...catalog,legacyLicence],
    createAdapters:({journal,clock,dispatchAuthorized})=>{
      const shared={journal,clock,dispatchAuthorized};
      const paymentFixture=createFixturePaymentsAdapter({...shared,fixtureQuotes:{'demo-near':{network:'fixture',asset:'demo-near',decimals:24,amount:'1000000000000000000000000'}},scenarios:options.paymentScenarios});
      const payments={...paymentFixture,verifySettlement:command=>paymentFixture.verifySettlement({...command,observation:command.observation??options.paymentScenarios?.[command.quote.id]?.observation??{status:'confirmed'}})};
      return {custody:options.custody??createFixtureCustodyAdapter({...shared,network:'fixture',accountId:'fixture-treasury',scenarios:options.custodyScenarios}),
        payments:options.payments??payments,
        funding:options.funding??createFixtureCloudFundingAdapter({...shared,scenarios:options.fundingScenarios}),
        inference:options.inference??createFixtureInferenceAdapter({...shared,fixtureOutput,scenarios:options.inferenceScenarios})};
    },
    readiness:({custody,payments,funding,inference})=>[custody,payments,funding,inference].map(a=>a.capabilities()),
    research:options.research??createResearch({retrieve:fixtureRetrieve,clock:()=>new Date(options.clock?.()??Date.now()).toISOString()}),sourceUrls:options.sourceUrls??fixtureSources.map(s=>s.url),
    initialize:async({treasury,rules})=>{const d=rules.evaluate({id:'fixture:bootstrap',type:'bootstrap',mode:'fixture'},{financial:treasury.snapshot()});if(d.status==='allow')await treasury.applyDecision({actionId:d.actionId,decision:d});},
    initializeWorkspace:async({workspace,journal})=>{
      if(journal.list('agents').length)return;
      const agent={schemaVersion:1,companyId:options.companyId??'local-workspace',id:'research-agent',name:'Market researcher',role:'Research analyst',description:'Turn a business question into an evidence-backed research brief.',instructions:'Investigate the business question. Cite sources and explain uncertainty.',skillIds:['competitive-research','evidence-review'],templateId:'market-researcher',color:'sage',icon:'search',status:'ready',runtime:'fixture',resourceBindings:[],version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      await journal.transaction({actionId:'fixture-seed-agent',fingerprint:JSON.stringify(agent)},tx=>{tx.put('agents',agent.id,agent);return null;});
    },
  });
  app.workflow.confirmFixturePayment=app.workflow.checkPayment;
  const handle=app.web.handle.bind(app.web);
  app.web.handle=request=>{
    const url=new URL(request.url);if(url.pathname.endsWith('/fixture-payment')){url.pathname=url.pathname.replace(/fixture-payment$/,'check-payment');return handle(new Request(url,request));}
    return handle(request);
  };
  return app;
}
