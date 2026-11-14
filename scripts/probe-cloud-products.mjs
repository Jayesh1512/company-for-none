import {createCloudReadClient} from '../src/cloud/read-only.mjs';

// Public GETs only. No key resolution, inference, account management or money.
const catalog=await createCloudReadClient().catalog();
const result={observedAt:catalog.observedAt,mode:'actual-public-catalog-read',
 endpoints:['https://cloud-api.near.ai/v1/models','https://cloud-api.near.ai/v1/model/list?limit=1000&offset=0'],
 modelCount:catalog.models.length,modelsWithPricing:catalog.models.filter(m=>m.pricing?.inputPerToken||m.pricing?.perImage).length,
 complete:catalog.complete,issues:catalog.issues,completionSent:false,credentialsUsed:false,grantsSpendingAuthority:false,
 selectedModelChanged:false,attestationVerified:false,chargeBoundsVerified:false};
console.log(JSON.stringify(result,null,2));
if(!catalog.models.length||catalog.issues.length)process.exitCode=1;
