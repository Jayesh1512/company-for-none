import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudCostBound} from '../../src/rules/cloud-cost.mjs';
import {createRules} from '../../src/rules/index.mjs';
import {NOW} from './fixtures.mjs';
const request={product:'rerank',input:{model:'controlled/reranker',query:'Bounded query',documents:['Document A','Document B']},timeoutMs:30000,maxInputBytes:65536,maxResponseBytes:2097152};
const pricing={catalogComplete:true,observedAt:new Date(NOW).toISOString(),models:[{id:'controlled/reranker',pricing:{inputPerToken:{amount:'10',scale:9,currency:'USD'},outputPerToken:{amount:'10',scale:9,currency:'USD'}}}],services:[{serviceName:'web_search',unit:'request',costPerUnit:'5000000',isActive:true}]};

test('M01 diagnoses observed price dimensions without inventing a rerank overhead, enforced bound or authority',()=>{
 const b=cloudCostBound(request,pricing,NOW);assert.equal(b.catalogStatus,'current');assert.equal(b.unitPrices.length,2);assert.equal(b.maxCostNanoUsd,null);assert.equal(b.status,'unavailable');assert.equal(b.providerEnforced,false);assert.ok(b.unresolved.includes('PER_PAIR_TEMPLATE_AND_OUTPUT_TOKEN_LIMIT_REQUIRED'));
 for(const p of [undefined,{...pricing,observedAt:new Date(NOW-300001).toISOString()},{...pricing,observedAt:new Date(NOW+1).toISOString()},{...pricing,catalogComplete:false}]){const result=cloudCostBound(request,p,NOW);assert.notEqual(result.catalogStatus,'current');assert.deepEqual(result.unitPrices,[]);assert.equal(result.maxCostNanoUsd,null);}
 const r=createRules({setupOnly:true,companyId:'diagnostic',clock:()=>NOW}),facts={request,pricing,access:{role:'owner',verified:true,companyId:'diagnostic'}};
 const d=r.evaluate({id:'prepare',type:'cloud_product_plan'},facts);assert.equal(d.status,'allow');assert.equal(d.plan.executionAllowed,false);assert.equal(d.plan.costBound.providerEnforced,false);assert.equal(r.evaluate({id:'execute',type:'cloud_product_execute'},facts).reasonCode,'CLOUD_PRODUCT_VERIFICATION_REQUIRED');
});

test('search result count and caller verified-bound flags never establish aggregate paid search rounds',()=>{
 const search={...request,product:'web_search',input:{model:'controlled/reranker',input:'Search query',count:20,maxOutputTokens:100}},b=cloudCostBound(search,{...pricing,providerEnforced:true,maxCostNanoUsd:'1',verified:true},NOW);
 assert.equal(b.reasonCode,'SEARCH_TOTAL_BOUND_REQUIRED');assert.equal(b.maxCostNanoUsd,null);assert.equal(b.providerEnforced,false);assert.ok(b.unresolved.includes('SEARCH_COUNT_IS_RESULTS_PER_SEARCH_NOT_SEARCH_CALLS'));assert.ok(b.unitPrices.some(p=>p.dimension==='service:web_search/request'&&p.amount==='5000000'));
});
