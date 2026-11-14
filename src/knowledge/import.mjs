import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {retrievePublicSource} from '../research/retrieve.mjs';
import {ContractError} from '../contracts.mjs';
import {fileURLToPath} from 'node:url';
const fail=(code,message,httpStatus=400)=>{throw Object.assign(new ContractError(code,message),{httpStatus});};
const pdfErrors={PDF_PASSWORD_REQUIRED:'This PDF is password-protected. Upload an unlocked copy.',PDF_PAGE_LIMIT:'This PDF exceeds the approved page limit. Upload a smaller document.',PDF_INVALID:'This PDF could not be read. Upload a valid, unlocked PDF.'};

export async function extractPdf(bytes,plan){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--max-old-space-size=192',fileURLToPath(new URL('./pdf-worker.mjs',import.meta.url))],{env:{PATH:process.env.PATH},stdio:['pipe','pipe','ignore']});
  let raw='',settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);child.kill('SIGKILL');if(error){error.httpStatus??=400;reject(error);}else resolve(value);};
  const timer=setTimeout(()=>finish(Object.assign(Error('PDF extraction timed out. Try a smaller PDF.'),{code:'PDF_TIMEOUT',httpStatus:408})),plan.timeoutMs);
  child.on('error',()=>finish(Object.assign(Error('PDF extraction could not start.'),{code:'PDF_UNAVAILABLE'})));
  child.stdout.on('data',chunk=>{raw+=chunk.toString();if(raw.length>plan.maxDocumentChars*8+4096)finish(Object.assign(Error('PDF parser returned too much text.'),{code:'PDF_OUTPUT_LIMIT'}));});
  child.on('close',()=>{
   if(settled)return;
   try{const value=JSON.parse(raw);if(value.error)return finish(Object.assign(Error(pdfErrors[value.error]??'PDF extraction failed.'),{code:value.error}));if(typeof value.text!=='string')throw Error();finish(null,value);}
   catch{finish(Object.assign(Error('PDF extraction failed. Try a smaller, valid PDF.'),{code:'PDF_INVALID'}));}
  });
  child.stdin.on('error',()=>{});
  child.stdin.end(JSON.stringify({bytes:bytes.toString('base64'),maxPages:plan.maxPdfPages,maxChars:plan.maxDocumentChars}));
 });
}

export async function readBoundedBody(request,maxBytes){
 const declared=Number(request.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>maxBytes)fail('IMPORT_TOO_LARGE','This upload exceeds the allowed size.',413);
 const reader=request.body?.getReader();if(!reader)fail('IMPORT_EMPTY','Choose a nonempty file or enter a website URL.');
 const chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();fail('IMPORT_TOO_LARGE','This upload exceeds the allowed size.',413);}chunks.push(value);}
 if(!size)fail('IMPORT_EMPTY','The selected file is empty.');
 return Buffer.concat(chunks);
}

/** Preview only: untrusted uploads remain in memory and never enter the journal. */
export function createKnowledgeImporter({rules,companyId,clock=()=>new Date(),retrieve=retrievePublicSource,pdf=extractPdf}){
 return {async preview(request,access){
  const json=request.headers.get('content-type')?.split(';')[0]==='application/json';
  const kind=json?'website':request.headers.get('x-import-kind');
  const d=rules.evaluate({id:`knowledge-import:${randomUUID()}`,type:'knowledge_import'},{company:{id:companyId},documents:[],access:access??(rules.snapshot().mode==='fixture'?{role:'owner',verifiedLocal:true,companyId}:{role:'public',verified:false,companyId}),source:{kind}});
  if(d.status!=='allow')fail(d.reasonCode,d.reasonCode,403);
  const plan=d.plan,importedAt=new Date(clock()).toISOString(),warnings=[];
  let text,title,source;
  if(kind==='website'){
   let input;try{input=JSON.parse((await readBoundedBody(request,8192)).toString('utf8'));}catch(error){if(error.code==='IMPORT_TOO_LARGE')throw error;fail('INVALID_INPUT','Enter a valid website URL.');}
   if(!input||input.kind!=='website'||typeof input.url!=='string'||Object.keys(input).some(k=>!['kind','url'].includes(k)))fail('INVALID_INPUT','Send a website URL.');
   let result;
   try{result=await retrieve({url:input.url,maxBytes:plan.maxWebsiteBytes,timeoutMs:plan.timeoutMs,maxRedirects:plan.maxRedirects});}
   catch(error){fail(error.code??'WEBSITE_UNAVAILABLE',error.code==='UNSAFE_SOURCE'?'Use a public HTTP(S) website. Local and private addresses are blocked.':error.code==='SOURCE_TIMEOUT'?'The website timed out. Try another page.':error.code==='SOURCE_TOO_LARGE'?'The page exceeds the import size limit. Try a smaller page.':'This page could not be imported. Use a public text page without a login.');}
   text=result.text;const url=new URL(result.url);title=url.hostname+(url.pathname==='/'?'':url.pathname);
   source={kind,name:url.hostname,url:url.href,importedAt};
   warnings.push('One public page imported. Linked pages, images and JavaScript-rendered content are not included.');
  }else{
   let name;try{name=decodeURIComponent(request.headers.get('x-file-name')??'');}catch{fail('INVALID_INPUT','The file name is invalid.');}
   if(!name||name.length>255||/[\x00-\x1f\x7f/\\]/.test(name))fail('INVALID_INPUT','Choose a file with a valid name.');
   const ext=name.split('.').at(-1).toLowerCase();
   if(!({pdf:['pdf'],markdown:['md','markdown','txt'],text:['txt','md','markdown']})[kind]?.includes(ext))fail('IMPORT_TYPE_INVALID','Choose a PDF, Markdown (.md) or plain text (.txt) file.',415);
   const bytes=await readBoundedBody(request,plan.maxUploadBytes);
   source={kind,name,sha256:createHash('sha256').update(bytes).digest('hex'),importedAt};title=name.replace(/\.(pdf|md|markdown|txt)$/i,'');
   if(kind==='pdf'){
    if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))fail('PDF_INVALID','This file does not contain a valid PDF header.');
    const value=await pdf(bytes,plan);text=value.text;source.pages=value.pages;if(value.truncated)warnings.push('PDF text exceeds the document limit. This preview contains only the beginning.');
   }else{
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{fail('IMPORT_ENCODING','Save this text file as UTF-8 and try again.');}
    if(text.includes('\0')||text.startsWith('%PDF-'))fail('IMPORT_TYPE_INVALID','Choose a UTF-8 Markdown or plain text file.',415);
   }
  }
  if(!text?.trim())fail('IMPORT_NO_TEXT',kind==='pdf'?'No selectable text was found. Scanned PDFs need OCR before upload.':'No readable text was found. Paste the content or choose another source.');
  // Provenance is part of the editable preview, not hidden trusted evidence.
  const footer=`\n\n---\nImported from: ${source.url??source.name}\nImported at: ${importedAt}\n${source.sha256?'File SHA-256: '+source.sha256+'\n':''}Owner-supplied company background; not independently verified.`;
  const available=plan.maxDocumentChars-footer.length;
  if(text.trim().length>available)warnings.push(`Content was shortened to fit the ${plan.maxDocumentChars.toLocaleString('en-US')}-character document limit. Review the excerpt before saving.`);
  const body=text.trim().slice(0,available)+footer;
  return {preview:{title:title.slice(0,160),body,source,warnings,characters:body.length}};
 }};
}
