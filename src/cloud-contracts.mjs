import {ContractError,fingerprint} from './contracts.mjs';

// Wire validation only. No permissions, pricing or acceptance decisions here.
export const CLOUD_PRODUCTS=Object.freeze({
 embeddings:{name:'Embeddings',path:'/embeddings',use:'Represent selected company text as vectors'},
 rerank:{name:'Knowledge reranking',path:'/rerank',use:'Rank permitted JBrain excerpts for a query'},
 score:{name:'Text similarity',path:'/score',use:'Compare two text passages'},
 privacy_classify:{name:'PII detection',path:'/privacy/classify',use:'Find personal data before sharing'},
 privacy_redact:{name:'PII redaction',path:'/privacy/redact',use:'Prepare a redacted preview for owner review'},
 responses:{name:'Stateless tool calls',path:'/responses',use:'Propose client-managed tool calls'},
 web_search:{name:'Native web search',path:'/responses',use:'Retrieve current sources through Cloud'},
 image_generation:{name:'Image generation',path:'/images/generations',use:'Create company visual assets'},
 transcription:{name:'Audio transcription',path:'/audio/transcriptions',use:'Transcribe an explicitly selected recording'},
 vision:{name:'Vision',path:'/chat/completions',use:'Read explicitly selected document images'},
 system_one:{name:'System One',path:'/systemone',use:'Suggest typed backlog assessments'},
});
const invalid=()=>{throw new ContractError('INVALID_INPUT','Unsupported NEAR Cloud request shape.');};
const object=x=>!!x&&Object.getPrototypeOf(x)===Object.prototype;
const text=x=>typeof x==='string'&&!!x.trim();
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const exact=(x,required,optional=[])=>object(x)&&required.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>[...required,...optional].includes(k));
const texts=x=>text(x)||Array.isArray(x)&&x.length>0&&x.length<=128&&x.every(text);
const canonicalBase64=x=>typeof x==='string'&&x.length>0&&x.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(x)&&Buffer.from(x,'base64').toString('base64')===x;
const image=x=>typeof x==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/.test(x)&&canonicalBase64(x.slice(x.indexOf(',')+1));
const content=x=>text(x)||object(x)||Array.isArray(x);
function functionTool(t){return exact(t,['type','name','description','parameters'],['strict'])&&t.type==='function'&&/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(t.name)&&text(t.description)&&object(t.parameters)&&t.parameters.type==='object'&&(t.strict===undefined||typeof t.strict==='boolean');}
function history(input){
 if(text(input))return true;
 if(!Array.isArray(input)||!input.length||input.length>128)return false;
 const ids=new Set(),outputs=new Set();
 for(const item of input){
  if(!object(item))return false;
  if(item.type==='function_call'){
   if(!text(item.call_id)||!text(item.name)||typeof item.arguments!=='string'||ids.has(item.call_id))return false;
   ids.add(item.call_id); // preserve all provider metadata verbatim on replay
  }else if(item.type==='function_call_output'){
   if(!exact(item,['type','call_id','output'])||!ids.has(item.call_id)||outputs.has(item.call_id)||typeof item.output!=='string')return false;
   outputs.add(item.call_id);
  }else if(!exact(item,['role','content'],['type'])||!['user','assistant','system','developer'].includes(item.role)||!(typeof item.content==='string'||Array.isArray(item.content)&&item.content.every(p=>exact(p,['type','text'])&&['input_text','output_text'].includes(p.type)&&typeof p.text==='string')))return false;
 }
 return [...ids].every(id=>outputs.has(id));
}
export function describeCloudRequest(request){
 if(!exact(request,['product','input','timeoutMs','maxInputBytes','maxResponseBytes'])||!CLOUD_PRODUCTS[request.product]||!int(request.timeoutMs,1,120000)||!int(request.maxInputBytes,1,25*1024*1024)||!int(request.maxResponseBytes,1,32*1024*1024))invalid();
 const {product,input:i}=request;if(!object(i)||!text(i.model)||i.model.length>256)invalid();
 let body=structuredClone(i),encoding='json';
 if(product==='embeddings'&&!(exact(i,['model','input'])&&texts(i.input)))invalid();
 if(product==='rerank'&&!(exact(i,['model','query','documents'])&&text(i.query)&&Array.isArray(i.documents)&&i.documents.length>0&&i.documents.length<=128&&i.documents.every(text)))invalid();
 if(product==='score'&&!(exact(i,['model','text_1','text_2'])&&text(i.text_1)&&text(i.text_2)))invalid();
 if(['privacy_classify','privacy_redact'].includes(product)&&!(exact(i,['model','input'],['threshold'])&&texts(i.input)&&(i.threshold===undefined||typeof i.threshold==='number'&&Number.isFinite(i.threshold)&&i.threshold>=0&&i.threshold<=1)))invalid();
 if(product==='responses'){
  if(!exact(i,['model','input','maxOutputTokens'],['tools'])||!history(i.input)||!int(i.maxOutputTokens,1,100000)||i.tools!==undefined&&(!Array.isArray(i.tools)||i.tools.length>32||!i.tools.every(functionTool)||new Set(i.tools.map(t=>t.name)).size!==i.tools.length))invalid();
  body={model:i.model,input:structuredClone(i.input),max_output_tokens:i.maxOutputTokens,store:false,stream:false,...i.tools?{tools:structuredClone(i.tools)}:{}};
 }
 if(product==='web_search'){
  if(!exact(i,['model','input','count','maxOutputTokens'])||!text(i.input)||!int(i.count,0,20)||!int(i.maxOutputTokens,1,100000))invalid();
  body={model:i.model,input:i.input,max_output_tokens:i.maxOutputTokens,store:false,stream:false,tools:[{type:'web_search',count:i.count}]};
 }
 if(product==='image_generation'&&!(exact(i,['model','prompt','n'])&&text(i.prompt)&&int(i.n,1,4)))invalid();
 if(product==='transcription'){
  if(!exact(i,['model','file'],['language'])||!exact(i.file,['name','mediaType','base64'])||!/^upload\.(wav|mp3|webm|flac|ogg|m4a)$/.test(i.file.name)||!['audio/wav','audio/mpeg','audio/webm','audio/flac','audio/ogg','audio/mp4'].includes(i.file.mediaType)||!canonicalBase64(i.file.base64)||i.language!==undefined&&!/^[a-z]{2}$/.test(i.language))invalid();
  encoding='multipart';
 }
 if(product==='vision'){
  if(!exact(i,['model','prompt','images','maxOutputTokens'])||!text(i.prompt)||!Array.isArray(i.images)||!i.images.length||i.images.length>8||!i.images.every(image)||!int(i.maxOutputTokens,1,100000))invalid();
  body={model:i.model,max_completion_tokens:i.maxOutputTokens,n:1,stream:false,messages:[{role:'user',content:[{type:'text',text:i.prompt},...i.images.map(url=>({type:'image_url',image_url:{url}}))]}]};
 }
 if(product==='system_one'){
  if(!exact(i,['model','state','questions'])||!content(i.state)||!object(i.questions)||!Object.keys(i.questions).length||Object.keys(i.questions).length>32)invalid();
  for(const q of Object.values(i.questions)){
   if(!exact(q,['type','instructions'],['criteria'])||!['noul','choice','score','box'].includes(q.type)||!content(q.instructions)||q.type==='choice'&&!object(q.criteria)||q.type==='score'&&(!Array.isArray(q.criteria)||!q.criteria.length)||q.type==='box'&&q.criteria!==undefined)invalid();
  }
 }
 const inputBytes=Buffer.byteLength(JSON.stringify(body));if(inputBytes>request.maxInputBytes)throw new ContractError('REQUEST_TOO_LARGE','Cloud input exceeds the admitted byte limit.');
 return {method:'POST',path:CLOUD_PRODUCTS[product].path,encoding,body,inputBytes,requestFingerprint:fingerprint(request)};
}

/** Caller-managed replay only; this function never executes tools or calls Cloud. */
export function appendFunctionOutputs(historyItems,callItems,outputs){
 if(!Array.isArray(historyItems)||!Array.isArray(callItems)||!Array.isArray(outputs)||callItems.length!==outputs.length)invalid();
 const ids=new Set();for(const call of callItems)if(call?.type!=='function_call'||!text(call.call_id)||ids.has(call.call_id))invalid();else ids.add(call.call_id);
 const seen=new Set();for(const output of outputs)if(!exact(output,['call_id','output'])||!ids.has(output.call_id)||seen.has(output.call_id)||typeof output.output!=='string')invalid();else seen.add(output.call_id);
 const result=[...structuredClone(historyItems),...structuredClone(callItems),...outputs.map(o=>({type:'function_call_output',...o}))];if(!history(result))invalid();return result;
}
