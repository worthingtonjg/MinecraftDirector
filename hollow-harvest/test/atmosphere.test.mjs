import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,advance,validateState,pages,introduction} from '../chapter.mjs';
import {sites,guard,nightCommands,decorate} from '../atmosphere.mjs';
test('opening completion and ordinary lantern possession never lift the curse',()=>{
 const items=['oak_log','crafting_table','stone_pickaxe','stone_sword','cooked_beef','torch','lantern','furnace','dirt'].map((id,Slot)=>({Slot,id:'minecraft:'+id,count:64}));
 let s=initialState();for(let i=0;i<4;i++)s=advance(s,{Alex:items}).state;
 assert.equal(s.step,4);assert.equal(s.curse.active,true);assert.equal(s.curse.finalLanternRestored,false);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).curse,s.curse);
 assert.match(introduction,/daylight still holds/);assert.match(pages(s,'Alex').join(' '),/curse remains/);
 const old=initialState();delete old.storyEdition;delete old.curse;const migrated=validateState(old);const revision=migrated.revision;validateState(migrated);assert.equal(migrated.revision,revision);assert.equal(migrated.curse.active,false);
 assert.ok(!nightCommands.some(c=>/true|sunrise/.test(c)));
});
test('decoration stays inside inspected ring and requires clear natural ground',async()=>{
 assert.equal(sites.length,16);assert.throws(()=>guard({x:999,z:999}));
 assert.match(guard(sites[0]),/minecraft:grass_block/);assert.match(guard(sites[0]),/unless entity/);
 const cmds=[];await decorate(async c=>{cmds.push(c);return ['Changed the block at 3, 63, -28'];},sites.map((s,i)=>({...s,clear:i===0})));
 assert.equal(cmds.length,2);assert.match(cmds[0],/setblock ~ ~ ~ minecraft:pumpkin keep$/);
});

