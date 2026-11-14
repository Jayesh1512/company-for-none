import test from 'node:test';
import assert from 'node:assert/strict';
import {createRules} from '../../src/rules/index.mjs';
import {hash} from '../../src/rules/config.mjs';
import {SUPPORT_LIMITS} from '../../src/rules/support.mjs';
import {config} from '../rules/fixtures.mjs';

const companyId='support-test',now=Date.parse('2026-11-14T12:00:00Z'),owner={role:'owner',companyId,verified:true};
const body='---\ncompanyId: support-test\nprivateFrontmatter: DO_NOT_QUOTE_METADATA\n---\n# Fictional Harbor Mutual Auto Policy\n\n## Deductible\nThe fictional collision deductible is USD 500 per covered event. This is example data only.\n\n## Reporting a claim\nReport a fictional auto incident within 30 days. Keep photographs and a repair estimate.\n\n## Roadside help\nThe fictional roadside service allows two assistance requests per policy year.\n';
const homeBody='# Fictional Harbor Mutual Home Policy\n\n## Deductible\nThe fictional home deductible is USD 1000.\n';
function fixture({commercial=false}={}){
 const id=`companies/${companyId}/documents/auto`,agent={id:'support-policy-guide',companyId,status:'ready',runtime:'setup',name:'Policy guide',instructions:'Look up published fictional policies.'};
 const source={documentId:id,title:'Fictional Harbor Mutual Auto Policy',revision:'rev:1',markdown:body,hash:hash(body)};
 const data={services:[],conversations:[],messages:[],tickets:[],agents:[agent],documents:[{id,companyId,title:source.title,revision:source.revision,visibility:'company',agentIds:[agent.id]}],sources:[],sourceActionId:null};let n=0;
 const c=commercial?{...config(),mode:'live'}:null;
 const make=()=>createRules({...commercial?{config:c}:{setupOnly:true},companyId,clock:()=>now,getSupportFacts:()=>data});let rules=make();
 const action=(type,conversationId)=>({id:`test:${++n}`,type,...conversationId?{conversationId}:{}});
 const evaluate=(a,input={},access)=>rules.evaluate(a,{input,access});
 function apply(d){assert.equal(d.status,'allow',JSON.stringify(d));for(const p of d.plan.puts){const ns={supportServices:'services',supportConversations:'conversations',supportMessages:'messages',supportTickets:'tickets'}[p.namespace];assert.ok(ns);const i=data[ns].findIndex(x=>x.id===p.id),old=data[ns][i];assert.equal(old?.version??null,p.expectedVersion);if(i<0)data[ns].push(structuredClone(p.value));else data[ns][i]=structuredClone(p.value);}return d;}
 const sources=a=>{data.sources=[source];data.sourceActionId=a.id;};
 function publish(extra={}){const a=action('support_publish');sources(a);return evaluate(a,{serviceId:'policy-guide',version:0,agentId:agent.id,name:'Policy guide',description:'Fictional insurance policy source lookup.',kind:'policy',fictional:true,sources:[{documentId:id,revision:source.revision,hash:source.hash}],...extra},owner);}
 function open(){const a=action('support_open');const d=apply(evaluate(a,{serviceId:'policy-guide',conversationId:`conversation:${n}`,tokenHash:hash(`random-server-token:${n}`)}));return d.plan.conversation;}
 const access=c=>({role:'support_customer',verified:true,companyId,conversationId:c.id,serviceId:c.serviceId});
 function reply(c,text){const a=action('support_reply',c.id);sources(a);return evaluate(a,{text},access(c));}
 return {data,source,agent,rules,action,evaluate,apply,publish,open,access,reply,sources,restart:()=>{rules=make();return rules;}};
}

test('actual fictional policy lookup works in zero-paid setup and returns exact published excerpts with atomic records',()=>{
 const h=fixture();h.apply(h.publish());const catalog=h.evaluate(h.action('support_catalog'));assert.equal(catalog.plan.services.length,1);assert.equal(catalog.plan.services[0].aiEnabled,false);assert.equal(catalog.plan.services[0].replyMode,'policy_lookup');assert.ok(!JSON.stringify(catalog).includes('documents/auto'));
 const c=h.open(),d=h.reply(c,'What is the auto deductible?');h.apply(d);assert.equal(d.plan.reply.reasonCode,'SUPPORT_POLICY_EXCERPTS');assert.ok(d.plan.reply.text.includes('USD 500'));assert.ok(!d.plan.reply.text.includes('DO_NOT_QUOTE_METADATA'));assert.ok(d.plan.reply.text.includes('not an AI-generated answer'));assert.equal(d.permit,undefined);assert.equal(d.plan.providerCalled,false);assert.equal(d.plan.grantsSpendingAuthority,false);assert.equal(d.plan.puts.length,3);
 for(const citation of d.plan.reply.citations){assert.ok(body.includes(citation.excerpt));assert.equal(citation.hash,hash(body));assert.equal(citation.revision,'rev:1');assert.equal(citation.documentId,h.source.documentId);}
 assert.equal(h.data.messages.length,2);assert.equal(h.data.tickets.length,0);assert.ok(!JSON.stringify(d.plan.conversation).includes('tokenHash'));
});

test('unknown questions and personal claim decisions create real owner-visible cases without fabricated approval',()=>{
 const h=fixture();h.apply(h.publish());const c=h.open();
 for(const question of ['Are alien spaceships included in the auto policy?','Please approve my claim.','Is my accident covered?','I need medical advice.','Will you pay for my claim?','Can I get reimbursement for my baggage?']){
  const d=h.reply(c,question);h.apply(d);assert.equal(d.plan.reply.citations.length,0);assert.ok(d.plan.ticket.id);assert.equal(d.plan.ticket.state,'open');assert.equal(d.plan.puts.length,4);assert.ok(d.plan.reply.text.includes(d.plan.ticket.id));
 }
 const inbox=h.evaluate(h.action('support_owner'),{},owner).plan;assert.equal(inbox.tickets.length,6);assert.equal(inbox.messages.length,12);assert.ok(!JSON.stringify(inbox).includes('tokenHash'));
 assert.equal(h.evaluate(h.action('support_owner'),{},h.access(c)).reasonCode,'ACCESS_DENIED');
});

test('publication needs current exact canonical bytes, real ready agent and explicit public grant; caller facts cannot grant anything',()=>{
 for(const mutation of ['owner','grant','private','revision','hash','bytes','agent','scope','caller-source']){
  const h=fixture();if(mutation==='grant')h.data.documents[0].agentIds=[];if(mutation==='private')h.data.documents[0].visibility='restricted';if(mutation==='revision')h.data.documents[0].revision='rev:new';if(mutation==='hash')h.source.hash=hash('different');if(mutation==='bytes')h.source.markdown+='tampered';if(mutation==='agent')h.agent.status='paused';if(mutation==='scope')h.data.documents[0].companyId='foreign';
  const d=h.publish();
  if(mutation==='owner'){const a=h.action('support_publish');h.sources(a);assert.equal(h.rules.evaluate(a,{input:{},access:{...owner,verified:false}}).reasonCode,'ACCESS_DENIED');continue;}
  if(mutation==='caller-source'){h.data.sources=[];const a=h.action('support_publish');const spoof=h.rules.evaluate(a,{input:{serviceId:'s',version:0,agentId:h.agent.id,name:'Name',description:'Description',kind:'policy',fictional:true,sources:[{documentId:h.source.documentId,revision:h.source.revision,hash:h.source.hash}]},access:owner,sources:[h.source],sourceActionId:a.id,documents:h.data.documents});assert.equal(spoof.reasonCode,'SUPPORT_PUBLICATION_STALE');continue;}
  assert.notEqual(d.status,'allow',mutation);
 }
});

test('every reply/view rechecks source revision, current explicit grant and exact action-bound fresh snapshot',()=>{
 for(const mutation of ['grant','visibility','metadata-revision','canonical-revision','canonical-bytes','source-action','missing-sources']){
  const h=fixture();h.apply(h.publish());const c=h.open();h.apply(h.reply(c,'What is the auto deductible?'));
  if(mutation==='grant')h.data.documents[0].agentIds=[];if(mutation==='visibility')h.data.documents[0].visibility='restricted';if(mutation==='metadata-revision')h.data.documents[0].revision='rev:new';if(mutation==='canonical-revision')h.source.revision='rev:new';if(mutation==='canonical-bytes'){h.source.markdown+='New private content';h.source.hash=hash(h.source.markdown);}
  const a=h.action('support_reply',c.id);h.sources(a);if(mutation==='source-action')h.data.sourceActionId='old-action';if(mutation==='missing-sources')h.data.sources=[];
  assert.equal(h.evaluate(a,{text:'What is the deductible?'},h.access(c)).reasonCode,'SUPPORT_PUBLICATION_STALE',mutation);
  const view=h.action('support_view',c.id);if(!['source-action','missing-sources'].includes(mutation))h.sources(view);
  const projected=h.evaluate(view,{},h.access(c)).plan;assert.equal(projected.messages[1].reasonCode,'SUPPORT_PUBLICATION_STALE');assert.deepEqual(projected.messages[1].citations,[]);assert.ok(!projected.messages[1].text.includes('USD 500'));assert.equal(h.data.messages[1].citations.length>0,true,'history retained privately');
 }
});

test('server-verified customers cannot read or reply to another conversation, list owner inbox, publish, or supply a forged role',()=>{
 const h=fixture();h.apply(h.publish());const a=h.open(),b=h.open();
 for(const type of ['support_context','support_view','support_reply','support_escalate']){const action=h.action(type,b.id);h.sources(action);assert.equal(h.evaluate(action,type==='support_reply'?{text:'Deductible?'}:{},h.access(a)).reasonCode,'ACCESS_DENIED');assert.equal(h.evaluate(action,{}, {...h.access(b),verified:false}).reasonCode,'ACCESS_DENIED');assert.equal(h.evaluate(action,{},owner).reasonCode,'ACCESS_DENIED');}
 assert.equal(h.evaluate(h.action('support_publish'),{},h.access(a)).reasonCode,'ACCESS_DENIED');
});

test('old approved source history becomes readable only after exact current publication is restored; restart adds no authority',()=>{
 const h=fixture();h.apply(h.publish());const c=h.open();h.apply(h.reply(c,'What is the deductible?'));h.data.sourceActionId=null;h.data.sources=[];const restarted=h.restart(),view=h.action('support_view',c.id);
 assert.equal(restarted.evaluate(view,{access:h.access(c),input:{}}).plan.messages[1].citations.length,0);
 h.sources(view);assert.equal(restarted.evaluate(view,{access:h.access(c),input:{}}).plan.messages[1].citations.length>0,true);
 const fake={...h.source,markdown:homeBody};assert.notEqual(hash(fake.markdown),h.source.hash);
});

test('bounded inputs, exact plan identity, turn/ticket limits and policy kill remain centralized',()=>{
 const h=fixture({commercial:true});h.apply(h.publish());const c=h.open();assert.equal(h.reply(c,'x'.repeat(SUPPORT_LIMITS.maxQuestionChars+1)).reasonCode,'SUPPORT_INPUT_INVALID');
 const forged=h.action('support_reply',c.id);h.sources(forged);assert.equal(h.evaluate({...forged,verified:true},{text:'Deductible?'},h.access(c)).reasonCode,'SUPPORT_INPUT_INVALID');
 for(let i=0;i<SUPPORT_LIMITS.maxTurns;i++)h.data.messages.push({id:`q:${i}`,companyId,conversationId:c.id,role:'customer',text:'question'});assert.equal(h.reply(c,'Deductible?').reasonCode,'SUPPORT_TURN_LIMIT');h.data.messages=[];
 for(let i=0;i<SUPPORT_LIMITS.maxTickets;i++)h.data.tickets.push({id:`t:${i}`,companyId,conversationId:c.id});assert.equal(h.reply(c,'Unknown unicorn question?').reasonCode,'SUPPORT_TICKET_LIMIT');
 h.rules.updateConfig({...config(),mode:'live',killSwitch:true});assert.equal(h.reply(c,'Deductible?').reasonCode,'KILL_SWITCH');assert.equal(h.evaluate(h.action('support_catalog')).plan.services.length,0);assert.equal(h.evaluate(h.action('support_owner'),{},owner).status,'allow');
});

test('support actions neither unlock old public private-knowledge research nor paid inference/provisioning',()=>{
 const h=fixture();h.apply(h.publish());h.open();for(const type of ['inference','funding','company_activate','service_order'])assert.equal(h.rules.evaluate({id:type,type},{access:owner}).reasonCode,'COMMERCIAL_POLICY_REQUIRED');
 const live=fixture({commercial:true});const denial=live.rules.evaluate({id:'public-old',type:'service_order'},{order:{agentContext:{service:{id:'research'},companyKnowledge:{documents:[{id:live.source.documentId}]}}}});assert.equal(denial.reasonCode,'CUSTOMER_KNOWLEDGE_DISCLOSURE_NOT_APPROVED');
});

test('CRLF sources retain exact quote bytes',()=>{
 const h=fixture();h.source.markdown=body.replaceAll('\n','\r\n');h.source.hash=hash(h.source.markdown);h.apply(h.publish());const c=h.open(),d=h.reply(c,'What is the auto deductible?');assert.equal(d.status,'allow');assert.equal(d.plan.reply.reasonCode,'SUPPORT_POLICY_EXCERPTS');for(const citation of d.plan.reply.citations)assert.ok(h.source.markdown.includes(citation.excerpt));
});


test('source selection narrows by policy category while keeping every quoted passage byte-exact',()=>{
 const h=fixture(),home={documentId:`companies/${companyId}/documents/home`,title:'Fictional Harbor Mutual Home Policy',revision:'home:1',hash:hash(homeBody),markdown:homeBody};
 h.data.documents.push({id:home.documentId,companyId,title:home.title,revision:home.revision,visibility:'company',agentIds:[h.agent.id]});
 const publish=h.action('support_publish');h.data.sources=[home,h.source];h.data.sourceActionId=publish.id;
 h.apply(h.evaluate(publish,{serviceId:'policy-guide',version:0,agentId:h.agent.id,name:'Policy guide',description:'Published auto and home policy excerpts.',kind:'policy',fictional:true,sources:[home,h.source].map(s=>({documentId:s.documentId,revision:s.revision,hash:s.hash}))},owner));
 const c=h.open(),a=h.action('support_reply',c.id);h.data.sources=[home,h.source];h.data.sourceActionId=a.id;const d=h.evaluate(a,{text:'What is the car deductible?'},h.access(c));assert.equal(d.status,'allow');assert.ok(d.plan.reply.citations.length);assert.ok(d.plan.reply.citations.every(c=>c.documentId===h.source.documentId));assert.ok(!d.plan.reply.text.includes('1000'));
});
