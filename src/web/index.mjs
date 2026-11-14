import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const hashAccessToken = token => createHash('sha256').update(token).digest('hex');
export function createDeliveryAccess() { const token = randomBytes(32).toString('base64url'); return { token, hash: hashAccessToken(token) }; }
export function verifyAccessToken(token, expectedHash) {
  if (typeof token !== 'string' || !token || typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedHash)) return false;
  return timingSafeEqual(Buffer.from(hashAccessToken(token), 'hex'), Buffer.from(expectedHash, 'hex'));
}
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
const error = (code, message, status = 400) => Object.assign(new Error(message), { code, httpStatus: status });
const bearer = request => /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '')?.[1] || '';
async function supportInput(request){
 const reader=request.body?.getReader(),chunks=[];let bytes=0;
 if(!reader)throw error('INVALID_INPUT','Send a JSON object.');
 while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>16384){await reader.cancel();throw error('REQUEST_TOO_LARGE','The support request is too large.',413);}chunks.push(r.value);}
 let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error('INVALID_INPUT','Send valid JSON.');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');
 return input;
}
const isAllowed = decision => (decision?.status ?? decision?.decision ?? decision?.outcome) === 'allow';
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

export async function parseOrderRequest(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw error('INVALID_INPUT', 'Send the research brief as JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw error('INVALID_INPUT', 'A research brief is required.');
  const chunks = []; let bytes = 0;
  while (true) {
    const result = await reader.read(); if (result.done) break;
    bytes += result.value.byteLength;
    if (bytes > 65536) { await reader.cancel(); throw error('REQUEST_TOO_LARGE', 'Request body exceeds the transport limit.', 413); }
    chunks.push(result.value);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw error('INVALID_INPUT', 'The research brief must be valid JSON.'); }
  const fields = new Set(['question', 'geography', 'timeHorizon', 'format', 'sourceAsset', 'sourceNetwork', 'refundRecipient']);
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !fields.has(k))) throw error('INVALID_INPUT', 'The brief contains unsupported fields.');
  if (typeof data.question !== 'string' || !data.question.trim()) throw error('INVALID_INPUT', 'Enter a research question.');
  for (const field of ['geography', 'timeHorizon', 'format', 'sourceNetwork', 'refundRecipient']) if (data[field] !== undefined && typeof data[field] !== 'string') throw error('INVALID_INPUT', `${field} must be text.`);
  if (data.sourceAsset !== undefined && typeof data.sourceAsset !== 'string' && (typeof data.sourceAsset !== 'object' || data.sourceAsset === null || Array.isArray(data.sourceAsset))) throw error('INVALID_INPUT', 'Choose a supported payment asset.');
  return { ...data, question: data.question.trim() };
}

/** HTTP mechanics and Rules access enforcement. No pricing or lifecycle decisions. */
export function createWeb({ aiDemo,fundedLoop,workflow, ledger, rules, readiness, ownerToken, workspace, knowledge, knowledgeImporter, runtime, components, cloudProducts, creditReadiness, autonomy, customerCare, onchainLedger, nearIntegrations, demoControl, localDemoContext, demoFacts, companyId='local-workspace' }) {
  const decideAccess = async (resource, access = {}, order) => {
    const decision = await rules.evaluate({ type: 'access', id: `access:${resource}:${order?.id || 'public'}`, resource }, { access, order });
    if (!isAllowed(decision)) throw error(decision?.reasonCode || 'ACCESS_DENIED', resource === 'report' ? 'The report is not available to this access context.' : 'This access context is not permitted.', decision?.status === 'hold' ? 409 : 403);
    return decision;
  };
  const workspaceIdentity=(request,transport={})=>{const verified=transport.localOwner===true||!!ownerToken&&verifyAccessToken(bearer(request),hashAccessToken(ownerToken));const local=rules.snapshot().mode==='fixture'&&['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname);return {companyId,verifiedLocal:local,verified,role:verified||local?'owner':'public'};};
  async function customer(request, id, resource = 'order') {
    const token = bearer(request);
    const access = await workflow.verifyAccess(id, token);
    // The context comes from server verification, never body/query claims.
    const order = await workflow.getOrder(id);
    await decideAccess(resource, access, order);
    return { token, access, order };
  }
  return {
    async handle(request,transport={}) {
      try {
        const url = new URL(request.url), path = url.pathname;
        if (request.method === 'POST') {
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) throw error('ORIGIN_MISMATCH', 'Use this application origin for requests.', 403);
        }
        if(path==='/api/workspace/ai-demo'||path==='/api/workspace/ai-demo/run'||path==='/api/workspace/ai-demo/control'){
          const access=workspaceIdentity(request,transport);await decideAccess('workspace',access);
          if(url.search||!aiDemo)throw error('NOT_FOUND','AI demo route not found.',404);
          if(request.method==='GET'&&path==='/api/workspace/ai-demo')return json(await aiDemo.view(access));
          if(request.method==='POST'&&path.endsWith('/control'))return json(await aiDemo.control(access,await supportInput(request)));
          if(request.method==='POST'&&path.endsWith('/run')){
            const input=await supportInput(request),key=request.headers.get('idempotency-key');
            if(!fundedLoop)return json(await aiDemo.run(access,input,key));
            // Customer-funded mode: a confirmed sale must be claimed before any provider call.
            const {saleId,...demoInput}=input;if(typeof saleId!=='string'||!key)throw error('PAYMENT_REQUIRED','A confirmed customer sale (saleId) and an idempotency key are required.',402);
            await fundedLoop.claim(saleId,key);
            const run=await aiDemo.run(access,demoInput,key),entry=await fundedLoop.settle({saleId,runKey:key,run});
            return json({...run,fundedLoop:{saleId,...entry.settled}});
          }
          throw error('NOT_FOUND','AI demo route not found.',404);
        }
        if(path==='/api/support/services'||path.startsWith('/api/support/conversations')){
          if(!customerCare)throw error('NOT_FOUND','Customer care is not configured.',404);
          if(url.search)throw error('INVALID_INPUT','Support access uses the conversation token, without URL parameters.');
          if(request.method==='GET'&&path==='/api/support/services')return json(await customerCare.catalog());
          const match=/^\/api\/support\/conversations(?:\/([^/]+))?(?:\/(messages|escalate))?$/.exec(path);
          if(!match)throw error('NOT_FOUND','Support route not found.',404);
          const id=match[1]?decodeURIComponent(match[1]):null,command=match[2];
          if(request.method==='GET'&&id&&!command)return json(await customerCare.view(id,bearer(request)));
          if(request.method==='POST'){
            const input=await supportInput(request),key=request.headers.get('idempotency-key');
            if(!key||key.length>160)throw error('IDEMPOTENCY_KEY_REQUIRED','Use a stable request identity.');
            if(!id&&!command)return json(await customerCare.open(input,key),201);
            if(id&&command==='messages')return json(await customerCare.message(id,input,bearer(request),key));
            if(id&&command==='escalate')return json(await customerCare.escalate(id,input,bearer(request),key));
          }
          throw error('NOT_FOUND','Support route not found.',404);
        }
        if(path==='/api/knowledge'||path.startsWith('/api/knowledge/')||/^\/api\/orders\/[^/]+\/publish-knowledge$/.test(path)) {
          await decideAccess('workspace',workspaceIdentity(request,transport));
          if(!knowledge)throw error('JBRAIN_UNAVAILABLE','Company knowledge is not configured.',503);
          if(request.method==='GET'&&path==='/api/knowledge')return json(await knowledge.view(url.searchParams.get('agentId')||undefined,workspaceIdentity(request,transport)));
          if(request.method==='GET'&&path==='/api/knowledge/document')return json(await knowledge.read(url.searchParams.get('id'),workspaceIdentity(request,transport)));
          if(request.method==='POST') {
            if(path==='/api/knowledge/import'){if(!knowledgeImporter)throw error('IMPORT_UNAVAILABLE','Knowledge import is unavailable.',503);return json(await knowledgeImporter.preview(request,workspaceIdentity(request,transport)));}
            const raw=await request.text();if(Buffer.byteLength(raw)>65536)throw error('REQUEST_TOO_LARGE','Knowledge request exceeds the transport limit.',413);
            let input;try{input=JSON.parse(raw);}catch{throw error('INVALID_INPUT','Send a valid JSON object.');}
            if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');
            const requestId=request.headers.get('idempotency-key');
            if(path==='/api/knowledge/documents')return json(await knowledge.save(input,{requestId,access:workspaceIdentity(request,transport)}));
            const publish=/^\/api\/orders\/([^/]+)\/publish-knowledge$/.exec(path);
            if(publish){
              if(Object.keys(input).some(k=>!['title','visibility','agentIds'].includes(k)))throw error('INVALID_INPUT','Unsupported publication field.');
              const id=decodeURIComponent(publish[1]),context=await customer(request,id,'report'),artifact=await workflow.getReport(id,context);
              const task=workspace.view().tasks.find(t=>t.orderId===id);
              return json(await knowledge.save({...input,body:artifact.content},{requestId,sourceOrderId:id,sourceAgentId:task?.agentId,access:workspaceIdentity(request,transport)}));
            }
          }
          return json({error:{code:'NOT_FOUND',message:'Route not found.'}},404);
        }
        if (path === '/api/workspace' || path.startsWith('/api/workspace/') || path.startsWith('/api/agents')) {
          await decideAccess('workspace', workspaceIdentity(request,transport));
          if(!workspace)throw error('NOT_FOUND','Workspace is unavailable.',404);
          if(path==='/api/workspace/local-demo'||path==='/api/workspace/local-demo/open'){
            const access=workspaceIdentity(request,transport);
            if(url.search)throw error('INVALID_INPUT','The local demo has a fixed isolated store.');
            if(request.method==='GET'&&path==='/api/workspace/local-demo'){
              const d=rules.evaluate({id:'local-demo:status',type:'local_demo_status'},{access,input:{}});if(!isAllowed(d))throw error(d.reasonCode,'Local demo access is unavailable.',403);
              return json({...d.plan,...(d.plan.active?{...demoFacts?.(),knowledgeStatus:(await knowledge.view(undefined,access)).status}:{})});
            }
            if(request.method==='POST'&&path.endsWith('/open')){
              const input=await supportInput(request),d=rules.evaluate({id:'local-demo:open',type:'local_demo_open'},{access,input});if(!isAllowed(d))throw error(d.reasonCode,'Use the fixed local demo action.',403);
              if(localDemoContext)throw error('LOCAL_DEMO_ALREADY_OPEN','This is already the isolated local demo.',409);
              if(typeof demoControl?.open!=='function')throw error('LOCAL_DEMO_UNAVAILABLE','Start the workspace server to open its local demo.',503);
              return json(await demoControl.open());
            }
            throw error('NOT_FOUND','Local demo route not found.',404);
          }
          if(path==='/api/workspace/near-integrations'||path.startsWith('/api/workspace/near-integrations/')){
            if(!nearIntegrations)throw error('NOT_FOUND','NEAR integrations are unavailable.',404);
            const access=workspaceIdentity(request,transport),op=path.slice('/api/workspace/near-integrations'.length).replace(/^\//,'');
            if(url.search)throw error('INVALID_INPUT','Integration scope is selected by the server.');
            if(request.method==='GET'&&!op)return json(nearIntegrations.view(access));
            if(request.method==='POST'){
              const input=await supportInput(request),key=request.headers.get('idempotency-key');
              if(op==='prepare'){if(Object.keys(input).some(k=>!['kind','input'].includes(k))||!input.input||typeof input.input!=='object'||Array.isArray(input.input))throw error('INVALID_INPUT','Select an operation and its exact inputs.');return json(await nearIntegrations.prepare(input.kind,input.input,access,key));}
              if(['execute','reconcile','verify-evaluation','probe-resource','cost'].includes(op)){if(Object.keys(input).some(k=>k!=='planId')||typeof input.planId!=='string')throw error('INVALID_INPUT','Use an original prepared plan.');return json(await nearIntegrations[op==='verify-evaluation'?'verifyEvaluation':op==='probe-resource'?'probeResource':op](input,access));}
              if(op==='accounts')return json(nearIntegrations.accountPlan(input,access));
              if(op==='checkpoint-feed')return json(nearIntegrations.feedPlan(input,access));
            }
            throw error('NOT_FOUND','Integration route not found.',404);
          }
          if(path==='/api/workspace/ledger-chain'||path.startsWith('/api/workspace/ledger-chain/')){
            if(!onchainLedger)throw error('NOT_FOUND','On-chain ledger is not configured.',404);
            const access=workspaceIdentity(request,transport),operation=path.slice('/api/workspace/ledger-chain'.length).replace(/^\//,'');
            if(url.search)throw error('INVALID_INPUT','On-chain reads use only the server-selected binding.');
            if(request.method==='GET'&&!operation)return json(onchainLedger.view(access));
            if(request.method==='POST'){
              const input=await supportInput(request),key=request.headers.get('idempotency-key');
              if(operation==='inspect'||operation==='export'){if(Object.keys(input).length)throw error('INVALID_INPUT','Use only the configured ledger binding.');return json(operation==='inspect'?await onchainLedger.inspect(access):onchainLedger.export(access));}
              if(operation==='balance'){if(Object.keys(input).length)throw error('INVALID_INPUT','Use only the configured signer.');return json(await onchainLedger.balance(access));}
              if(operation==='fees'){if(Object.keys(input).some(k=>k!=='operationId'))throw error('INVALID_INPUT','Use an original operation.');return json(await onchainLedger.fees(input,access));}
              if(['prepare','publish','reconcile'].includes(operation))return json(await onchainLedger[operation](input,access,key));
            }
            throw error('NOT_FOUND','On-chain ledger route not found.',404);
          }
          if(path==='/api/workspace/support'||path.startsWith('/api/workspace/support/')){
            if(!customerCare)throw error('NOT_FOUND','Customer care is not configured.',404);
            const access=workspaceIdentity(request,transport);
            if(request.method==='GET'&&path==='/api/workspace/support')return json(await customerCare.ownerView(access));
            if(request.method==='POST'){
              const input=await supportInput(request),key=request.headers.get('idempotency-key');
              if(!key||key.length>160)throw error('IDEMPOTENCY_KEY_REQUIRED','Use a stable request identity.');
              if(path.endsWith('/demo')){if(Object.keys(input).length)throw error('INVALID_INPUT','The fictional pack uses only server-authored policy files.');return json(await customerCare.setupDemo(access,key));}
              if(path.endsWith('/publish'))return json(await customerCare.publish(input,access,key));
            }
            throw error('NOT_FOUND','Support owner route not found.',404);
          }
          if(path==='/api/workspace/cloud'||path.startsWith('/api/workspace/cloud/')){
            if(!cloudProducts)throw error('CLOUD_UNAVAILABLE','Cloud products are not configured.',503);
            const access=workspaceIdentity(request,transport),command=path.slice('/api/workspace/cloud'.length).replace(/^\//,'');
            if(request.method==='GET'&&!command){if(url.search)throw error('INVALID_INPUT','Cloud view has no request filters.');return json(cloudProducts.view(access));}
            if(request.method==='POST'){
              // Read incrementally: do not allocate an unbounded JSON upload first.
              const reader=request.body?.getReader(),chunks=[];let bytes=0;
              if(!reader)throw error('INVALID_INPUT','Send a JSON object.');
              while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>262144){await reader.cancel();throw error('REQUEST_TOO_LARGE','Cloud request exceeds the transport limit.',413);}chunks.push(r.value);}
              let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error('INVALID_INPUT','Send valid JSON.');}
              if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');
              if(['catalog','services'].includes(command)){if(Object.keys(input).length)throw error('INVALID_INPUT','Catalog and services use only public fixed endpoints.');return json(await cloudProducts[command](access));}
              if(['credit-attribution','credit-balance'].includes(command)){if(Object.keys(input).length)throw error('INVALID_INPUT','Credit reads use only protected server scope.');if(!creditReadiness)throw error('CLOUD_UNAVAILABLE','Credit observation is not configured.',503);return json(await creditReadiness[command==='credit-attribution'?'attribution':'balance'](access));}
              if(command==='plan')return json(cloudProducts.plan(input,access));
              if(command==='execute')return json(await cloudProducts.execute(input,access,request.headers.get('idempotency-key')));
              if(command==='knowledge-plan')return json(await cloudProducts.rankKnowledge(input,access));
              if(command==='knowledge-ranking')return json(await cloudProducts.bindRanking(input,access));
              if(command==='billing-costs'){if(Object.keys(input).some(k=>k!=='inferenceIds'))throw error('INVALID_INPUT','Choose only original inference IDs.');return json(await cloudProducts.billingCosts(input,access));}
              if(['usage','summary'].includes(command))return json(await cloudProducts[command](input,access));
            }
            throw error('NOT_FOUND','Cloud route not found.',404);
          }
          if(path==='/api/workspace/autonomy'||path.startsWith('/api/workspace/autonomy/')){
            if(!autonomy)throw error('AUTONOMY_UNAVAILABLE','Company operations are not configured.',503);
            const access=workspaceIdentity(request,transport),operation=path.slice('/api/workspace/autonomy'.length).replace(/^\//,'');
            if(request.method==='GET'&&!operation){if([...url.searchParams.keys()].some(k=>!['cursor','limit'].includes(k)))throw error('INVALID_INPUT','Unknown company view filter.');const query={...(url.searchParams.has('cursor')?{cursor:Number(url.searchParams.get('cursor'))}:{}),...(url.searchParams.has('limit')?{limit:Number(url.searchParams.get('limit'))}:{})};return json(await autonomy.view(access,query));}
            if(request.method==='GET'&&operation==='trace'){if(url.search)throw error('INVALID_INPUT','The company trace uses only the current owner view.');return json(await autonomy.trace(access));}
            if(request.method==='POST'){
              const raw=await request.text();if(Buffer.byteLength(raw)>65536)throw error('REQUEST_TOO_LARGE','Company command exceeds the transport limit.',413);
              let input;try{input=JSON.parse(raw);}catch{throw error('INVALID_INPUT','Send a valid JSON object.');}
              if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');
              const key=request.headers.get('idempotency-key');
              if(!key||key.length>160)throw error('IDEMPOTENCY_KEY_REQUIRED','Use a stable request identity.');
              const methods={onboard:'onboard','setup-review':'reviewSetup',configure:'configure',bootstrap:'bootstrap',control:'control',gaps:'recordGap',templates:'registerTemplate',evaluations:'evaluate',rollback:'rollback','knowledge-selection':'selectKnowledge','change-review':'reviewChange'};
              if(operation==='advance'){if(Object.keys(input).length)throw error('INVALID_INPUT','Advance uses only current server work.');return json(await autonomy.advance(access));}
              if(methods[operation])return json(await autonomy[methods[operation]](input,access,key));
            }
            throw error('NOT_FOUND','Company route not found.',404);
          }
          if(path==='/api/workspace/inference/preflight'&&request.method==='POST'){
            const input=await request.json();if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw error('INVALID_INPUT','This check uses only the server-selected model.',400);
            if(!components)throw error('VERIFICATION_UNAVAILABLE','Cloud verification is not configured.',503);
            return json(await components.preflight(workspaceIdentity(request,transport)));
          }
          if(path==='/api/workspace/inference/recover'&&request.method==='POST'){
            const input=await request.json();if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='id')||typeof input.id!=='string'||input.id.length>512)throw error('INVALID_INPUT','Select one original operation.');
            if(!components)throw error('VERIFICATION_UNAVAILABLE','Cloud recovery is not configured.',503);
            return json(await components.recover(workspaceIdentity(request,transport),input));
          }
          if(request.method==='GET'&&path==='/api/workspace/inference/plan')return json(components.describe(workspaceIdentity(request,transport)));
          if(request.method==='GET'&&path==='/api/workspace/readiness')return json(runtime.readiness(workspaceIdentity(request,transport)));
          if(request.method==='POST'&&path==='/api/workspace/probes'){const input=await request.json();if(!input||Object.keys(input).some(k=>k!=='capability'))throw error('INVALID_INPUT','Select one read-only capability.');return json(await runtime.probe(input.capability,workspaceIdentity(request,transport)));}
          if(request.method==='GET'&&path==='/api/workspace')return json(workspace.view());
          if(request.method==='GET'&&path==='/api/workspace/operation')return json(await workspace.operation(workspaceIdentity(request,transport)));
          if(request.method==='POST'&&['/api/workspace/activate','/api/workspace/pause'].includes(path)){const input=await request.json();if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');return json(await workspace[path.endsWith('/pause')?'pause':'activate'](input,workspaceIdentity(request,transport)));}
          if(request.method==='GET'&&path==='/api/workspace/setup')return json(await workspace.setup(workspaceIdentity(request,transport)));
          if(request.method==='POST'&&['/api/workspace/organization','/api/workspace/setup/review'].includes(path)){const raw=await request.text();if(Buffer.byteLength(raw)>65536)throw error('REQUEST_TOO_LARGE','Setup input exceeds the transport limit.',413);let input;try{input=JSON.parse(raw);}catch{throw error('INVALID_INPUT','Send a valid JSON object.');}if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');return json(path.endsWith('/review')?await workspace.reviewSetup(input,workspaceIdentity(request,transport)):await workspace.saveOrganization(input,workspaceIdentity(request,transport)));}
          const agentMatch=/^\/api\/agents(?:\/([^/]+))?(?:\/(update|skills|tasks|resources))?$/.exec(path);
          if(!agentMatch)return json({error:{code:'NOT_FOUND',message:'Route not found.'}},404);
          const id=agentMatch[1]?decodeURIComponent(agentMatch[1]):null, command=agentMatch[2];
          if(request.method==='GET'&&id&&!command)return json(workspace.get(id));
          if(request.method==='POST') {
            const raw=await request.text();if(Buffer.byteLength(raw)>65536)throw error('REQUEST_TOO_LARGE','Request exceeds the transport limit.',413);
            let input;try{input=JSON.parse(raw);}catch{throw error('INVALID_INPUT','Send a valid JSON request.');}
            if(!input||typeof input!=='object'||Array.isArray(input))throw error('INVALID_INPUT','Send a JSON object.');
            if(!id)return json(await workspace.create({...input,actionId:request.headers.get('idempotency-key')||undefined},workspaceIdentity(request,transport)),201);
            if(command==='update')return json(await workspace.update(id,input,workspaceIdentity(request,transport)));
            if(command==='resources')return json(await workspace.bindResource(id,input,workspaceIdentity(request,transport)));
            if(command==='skills')return json(await workspace.install(id,input.listingId,workspaceIdentity(request,transport)));
            if(command==='tasks')return json(await workspace.createTask(id,{...input,actionId:request.headers.get('idempotency-key')||undefined},workspaceIdentity(request,transport)),201);
          }
          return json({error:{code:'NOT_FOUND',message:'Route not found.'}},404);
        }
        if(request.method==='GET'&&path==='/api/services'){await decideAccess('storefront');return json({services:workspace?.services()??[]});}
        const service=/^\/api\/services\/([^/]+)\/orders$/.exec(path);
        if(request.method==='POST'&&service){await decideAccess('storefront');const input=await parseOrderRequest(request);return json(await workspace.createServiceOrder(decodeURIComponent(service[1]),{...input,actionId:request.headers.get('idempotency-key')||undefined}),201);}
        if (request.method === 'GET' && path === '/api/status') {
          await decideAccess('storefront');
          const status = await workflow.status();
          const decision=await rules.evaluate({id:'public:readiness',type:'public_readiness'},{});
          if(!isAllowed(decision))throw error(decision.reasonCode,'Public readiness is unavailable.',403);
          return json({...status,readiness:decision.plan.capabilities,ready:decision.plan.ready,...(decision.plan.experience?{experience:decision.plan.experience}:{})});
        }
        if (request.method === 'GET' && path === '/api/ledger') {
          await decideAccess('ledger');
          return json(typeof ledger === 'function' ? await ledger() : await ledger.view());
        }
        if (request.method === 'GET' && path === '/api/owner/status') {
          await decideAccess('owner', workspaceIdentity(request,transport));
          const snapshot = await rules.snapshot();
          return json({ safety: { ...(snapshot.safety || snapshot), policyVersion: snapshot.policyVersion, policyEpoch: snapshot.policyEpoch, mode: snapshot.mode }, explanation: 'The owner edits config.yaml. Rules applies current safety settings to new actions; submitted effects remain recorded and may require reconciliation.' });
        }
        if (request.method === 'POST' && path === '/api/orders') {
          await decideAccess('storefront');
          const input = await parseOrderRequest(request);
          const command={...input,actionId:request.headers.get('idempotency-key')||undefined};
          if(rules.snapshot().mode==='live'){const service=workspace?.services()[0];if(!service)throw error('COMPANY_NOT_ACTIVE','Activate a company service before accepting orders.',409);return json(await workspace.createServiceOrder(service.id,command),201);}
          return json(await workflow.createOrder(command),201);
        }
        const match = /^\/api\/orders\/([^/]+)(?:\/(quote|check-payment|run|report))?$/.exec(path);
        if (match) {
          const id = decodeURIComponent(match[1]), action = match[2];
          if (request.method === 'GET' && !action) return json({ order: (await customer(request, id)).order });
          if (request.method === 'GET' && action === 'report') {
            const context = await customer(request, id, 'report');
            return json({ artifact: await workflow.getReport(id, context) });
          }
          if (request.method === 'POST' && ['quote', 'check-payment', 'run'].includes(action)) {
            await customer(request, id);
            const options = { actionId: request.headers.get('idempotency-key') || undefined };
            const method = { quote: 'quote', 'check-payment':'checkPayment', run: 'run' }[action];
            return json(await workflow[method](id, options));
          }
        }
        return json({ error: { code: 'NOT_FOUND', message: 'This route does not exist.' } }, 404);
      } catch (cause) {
        const status = cause.httpStatus || ({ ACCESS_DENIED: 403, NOT_FOUND: 404, CONFLICT: 409, POLICY_BLOCK: 409, INVALID_INPUT: 400 }[cause.code]) || 500;
        return json({ error: { code: cause.code || 'INTERNAL_ERROR', message: status === 500 ? 'The request could not be completed. Check the local server and retry after its status is known.' : cause.message } }, status);
      }
    },
  };
}
