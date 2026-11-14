import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAutonomy,AUTONOMY_INTENT} from '../../public/autonomy.js';
import {icon} from '../../public/workspace.js';

test('manager panel identifies its own proposal, scope copy is precise and improvement diffs stay inert',()=>{
 const company={id:'c',managerId:'manager',brief:{name:'Company',objective:'A real objective'},intent:AUTONOMY_INTENT,state:'blocked',started:false};
 const base={company,companies:[company],permittedActions:[],agents:[],objectives:[],work:[],events:[],heads:[],runs:[{id:'r1',actorId:'manager',acceptedCommands:[{type:'delegate'}]},{id:'r2',actorId:'specialist',acceptedCommands:[{type:'request_resource'}]}]};
 const render=(data,sub,params='')=>renderAutonomy({autonomy:data,route:{sub,params:new URLSearchParams(params)}},icon);
 const overview=render(base,'overview');const panel=overview.split('Manager’s latest proposal')[1].split('Execution state')[0];
 assert.match(panel,/delegate/);assert.doesNotMatch(panel,/request resource/);
 const boundaries=render(base,'setup','step=2');assert.match(boundaries,/Prompt, source-code and security-policy changes are unsupported/);
 const change={...base,improvements:[{id:'gap',summary:'<script>alert(1)</script>',state:'promoted',baseRevision:'old',candidateRevisionId:'new',promotedRevisionId:'applied',evaluationId:'eval'}],revisions:[{id:'old',body:{fields:[]}},{id:'new',body:{fields:[{name:'middleName',required:true}]}}],evaluations:[{id:'eval',observation:{repaired:true}}]};
 const diff=render(change,'improvements');assert.match(diff,/applied/);assert.match(diff,/middleName/);assert.match(diff,/Before/);assert.doesNotMatch(diff,/<script>/);
});
