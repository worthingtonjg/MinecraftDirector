import test from 'node:test';
import assert from 'node:assert/strict';
import {readNbt,sidebarSafe,sidebarCommands,objective} from '../sidebar.mjs';
import {commands} from '../policy.mjs';
test('scoreboard parsing and conflicts fail closed',()=>{
 assert.equal(sidebarSafe(readNbt(Buffer.from([10,0,0,10,0,4,100,97,116,97,0,0]))),true);
 assert.throws(()=>readNbt(Buffer.from([10,0])));
 assert.equal(sidebarSafe({}),false);
 assert.equal(sidebarSafe({data:{DisplaySlots:{slot_1:'someone_else'}}}),false);
 assert.equal(sidebarSafe({data:{Objectives:[{Name:'other'}]}}),false);
 assert.equal(sidebarSafe({data:{DisplaySlots:{slot_1:objective},Objectives:[{Name:objective}]}}),true);
});
test('fixed objective display has no arbitrary command or completion input',()=>{
 assert.throws(()=>commands('objectives_show',{text:'op @a'}));
 const c=sidebarCommands();assert.equal(c.length,11);assert.ok(c.every(s=>s.startsWith('scoreboard ')&&s.includes(objective)&&!s.includes('\n')));
 assert.equal(c.filter(s=>s.includes('[Done]')).length,1);assert.equal(c.at(-1),`scoreboard objectives setdisplay sidebar ${objective}`);
});
