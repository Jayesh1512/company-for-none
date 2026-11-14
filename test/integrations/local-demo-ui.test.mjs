import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLocalDemo,renderLocalDemoSettings} from '../../public/local-demo.js';
import {renderWorkspace,icon} from '../../public/workspace.js';
import {renderAutonomy} from '../../public/autonomy.js';
import {parseRoute} from '../../public/app.js';

test('the local guide shows actual component counts and separates live-only scope without false readiness',()=>{
 const state={localDemo:{active:true,returnUrl:'http://127.0.0.1:4173',agentCount:4,documentCount:4,serviceCount:2,replyCount:0,ticketCount:0,eventCount:24,knowledgeStatus:'connected'},supportCatalog:{services:[{id:'policy-service',kind:'policy'}]}};
 const html=renderLocalDemo(state);assert.ok(html.includes('#care/policy-service'));assert.ok(html.includes('0</dd>'));assert.ok(html.includes('Connected to native JBrain'));assert.ok(html.includes('does not simulate or enable'));
 const settings=renderLocalDemoSettings(state);assert.ok(settings.includes('Local demo settings'));assert.ok(!settings.includes('Verification required'));assert.ok(!settings.includes('Company operation needs configuration'));
 const changed=renderLocalDemo({...state,localDemo:{...state.localDemo,knowledgeStatus:'unavailable'}});assert.ok(changed.includes('Check the local JBrain connection'));
});
test('demo metadata changes presentation only; main workspace and paid execution scope remain explicit',()=>{
 const data={agents:[],tasks:[],catalog:[],activity:[],workspace:{name:'Demo'}},localDemo={active:true,returnUrl:'http://127.0.0.1:4173',knowledgeStatus:'connected'};
 assert.equal(parseRoute('#demo').page,'demo');
 const demo=renderWorkspace({data,localDemo,route:parseRoute('#demo')});assert.ok(demo.includes('Exit local demo'));assert.ok(demo.includes('Local demo workspace'));assert.ok(demo.includes('Explore the working company'));assert.ok(!demo.includes('Demo mode · fictional sample text'));
 const main=renderWorkspace({data,route:parseRoute('#demo')});assert.ok(main.includes('Real AI demo'));assert.ok(main.includes('Exit AI demo'));assert.ok(!main.includes('Ready to try'));
 const ledger=renderAutonomy({data,localDemo,autonomy:{company:{brief:{name:'Demo'},state:'paused',started:false},events:[{sequence:1,type:'support.replied',data:{summary:'actual reply'}}],permittedActions:['start']},route:parseRoute('#autonomy/ledger')},icon);assert.ok(ledger.includes('actual reply'));assert.ok(!ledger.includes('Start company'));assert.ok(!ledger.includes('NEAR on-chain ledger'));
});
