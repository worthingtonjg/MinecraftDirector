import test from 'node:test';import assert from 'node:assert/strict';
import {validatePlan,inspectPlan,applyPlan}from'../planned-decor.mjs';
test('planned decorations enforce bounds, air, support, fresh inspection and verification',async()=>{
 const site={x:2,y:63,z:-29,ground:'minecraft:grass_block'};
 assert.throws(()=>validatePlan([{...site,x:30}]));assert.throws(()=>validatePlan([site,site]));assert.throws(()=>validatePlan([{...site,ground:'minecraft:chest'}]));
 const calls=[];const execute=async c=>{calls.push(c);return [c.includes('setblock')?'Changed the block at 2, 63, -29':'Test passed'];};
 const survey=await inspectPlan(execute,[site]);const result=await applyPlan(execute,survey);assert.equal(result[0].verified,true);assert.match(calls[1],/if block 2 63 -29 minecraft:air run setblock 2 63 -29 minecraft:pumpkin keep$/);
 const skipped=await applyPlan(execute,[{...site,clear:false}]);assert.equal(skipped.length,0);
});
