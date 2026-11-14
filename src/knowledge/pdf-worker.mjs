// Isolated text-only PDF parser. No journal, file writes, credentials or URL input.
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const chunks=[];
for await(const chunk of process.stdin)chunks.push(chunk);
let loading;
try{
 const {bytes,maxPages,maxChars}=JSON.parse(Buffer.concat(chunks).toString());
 loading=getDocument({data:new Uint8Array(Buffer.from(bytes,'base64')),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,stopAtErrors:true,verbosity:0});
 const pdf=await loading.promise;
 if(pdf.numPages>maxPages)throw Object.assign(Error(),{code:'PDF_PAGE_LIMIT'});
 let text='',truncated=false;
 for(let i=1;i<=pdf.numPages;i++){
  const page=await pdf.getPage(i),content=await page.getTextContent();
  const part=content.items.map(item=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join('');
  text+=(i>1?'\n\n':'')+part;page.cleanup();
  if(text.length>maxChars){text=text.slice(0,maxChars);truncated=true;break;}
 }
 process.stdout.write(JSON.stringify({text:text.trim(),pages:pdf.numPages,truncated}));
}catch(error){
 process.stdout.write(JSON.stringify({error:error.name==='PasswordException'?'PDF_PASSWORD_REQUIRED':error.code==='PDF_PAGE_LIMIT'?error.code:'PDF_INVALID'}));
}finally{await loading?.destroy();}
