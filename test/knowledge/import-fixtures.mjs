// Minimal fictional PDF generated in memory; no real company/customer content.
export function samplePdf(text='Fictional Company Handbook',pages=1){
 const escaped=text.replace(/([\\()])/g,'\\$1');
 const stream=`BT /F1 12 Tf 50 740 Td (${escaped}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${3+i} 0 R`).join(' ')}] /Count ${pages} >>`];
 const fontId=pages+3,contentId=pages+4;
 for(let i=0;i<pages;i++)objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 let raw='%PDF-1.4\n',offsets=[];
 objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(raw));raw+=`${i+1} 0 obj\n${value}\nendobj\n`;});
 const start=Buffer.byteLength(raw);raw+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return Buffer.from(raw);
}
