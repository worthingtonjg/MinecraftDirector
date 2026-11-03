import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSnbt,countInventory,summarizeInventories,players} from '../inventory.mjs';
import {sidebarCommands} from '../sidebar.mjs';
test('modern counts, default one, poplar, nested containers excluded',()=>{
 const inv=parseSnbt('[{Slot:0b,id:"minecraft:poplar_log",count:12},{Slot:1b,id:"minecraft:crafting_table"},{Slot:2b,id:"minecraft:stone_pickaxe",components:{"minecraft:damage":5}},{Slot:3b,id:"minecraft:bundle",components:{"minecraft:bundle_contents":[{id:"minecraft:oak_log",count:64}]}}]');
 const c=countInventory(inv);assert.equal(c.logs,12);assert.equal(c.table,1);assert.equal(c.picks,1);assert.equal(c.stonePicks,1);assert.equal(c.iron,0);
});
test('fresh totals not accumulated; completions latch; both players required',()=>{
 const samples={[players[0]]:[{Slot:0,id:'minecraft:oak_log',count:8},{Slot:1,id:'minecraft:wooden_pickaxe'}],[players[1]]:[{Slot:0,id:'minecraft:stripped_birch_log',count:8},{Slot:1,id:'minecraft:stone_pickaxe'}]};
 const first=summarizeInventories(samples);assert.equal(first.totals.logs,16);assert.equal(first.completed.logs,true);assert.equal(first.completed.picks,true);assert.equal(first.completed.table,false);
 assert.equal(summarizeInventories(samples,first.completed).totals.logs,16);
 const next=summarizeInventories({[players[0]]:[],[players[1]]:[]},first.completed);assert.equal(next.totals.logs,0);assert.equal(next.completed.logs,true);
 assert.equal(summarizeInventories({[players[0]]:[]}).totals.logs,0);assert.throws(()=>summarizeInventories({}));
 assert.equal(sidebarCommands(next).filter(c=>c.includes('[Done]')).length,3);
});
test('malformed, duplicate slots, fake counts and trailing commands rejected',()=>{
 assert.throws(()=>parseSnbt('[{Slot:0b'));assert.throws(()=>parseSnbt('[]\nop @a'));
 assert.throws(()=>countInventory([{Slot:0,id:'minecraft:oak_log',count:1},{Slot:0,id:'minecraft:oak_log',count:1}]));
 assert.throws(()=>countInventory([{Slot:0,id:'minecraft:oak_log',count:-2}]));
});
