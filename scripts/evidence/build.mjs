import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,definitions,publicBytes,hash,checkBytes,scanText,validateManifest,renderClaims} from './model.mjs';
import {SCOPE_BY_KIND} from './catalog.mjs';
const expected=await definitions(),artifacts=[];
for(const entry of expected.artifacts){
 const bytes=await publicBytes(entry.path);
 if(entry.expectedHash)checkBytes(bytes,{bytes:entry.expectedBytes,sha256:entry.expectedHash});
 const findings=scanText(bytes.toString('utf8'));if(findings.length)throw Error(`EVIDENCE_SECRET_PATTERN:${entry.id}:${findings.join(',')}`);
 const {expectedHash,expectedBytes,...spec}=entry;
 artifacts.push({...spec,trustScope:SCOPE_BY_KIND[entry.kind],bytes:bytes.length,sha256:hash(bytes),timestampBasis:entry.observedAt?'recorded-source-observation':'historical-artifact-no-observation-time-asserted'});
}
const manifest={schemaVersion:1,generatedAt:new Date().toISOString(),grantsSpendingAuthority:false,scope:'Evidence index; checksums and labels are not cryptographic proof of every claim.',artifacts,claims:expected.claims};
validateManifest(manifest,expected);
await mkdir(path.join(ROOT,'evidence'),{recursive:true});
await writeFile(path.join(ROOT,'evidence/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(ROOT,'CLAIMS.md'),renderClaims(manifest));
console.log(JSON.stringify({artifacts:artifacts.length,claims:manifest.claims.length,manifest:'evidence/manifest.json',spendingAuthority:false}));
