import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,advance} from '../chapter.mjs';
import {rows,Sidebar,sidebarSafe,displayCommands,objective} from '../sidebar.mjs';
test('sidebar matches real possession and latched goals across progression',()=>{
 let state=advance(initialState(),{Alex:[{Slot:0,id:'minecraft:oak_log',count:5}]}).state;
 assert.deepEqual(rows(state),['A Light Worth Keeping','Team logs: 5/64','Team dirt: 0/64','Team crafting table: 0/1']);
 state.done['kindling:logs']=true;assert.equal(rows(state)[1],'[Done] Team logs');
 state.step=1;assert.equal(rows(state)[1],'[ ] Each starter: stone+ pick');
 state.step=4;assert.equal(rows(state)[0],'Opening complete');
 assert.ok(displayCommands(state).every(c=>c.includes(objective)));
});
test('sidebar preserves unrelated scoreboard and fails closed on unreadable state',async()=>{
 assert.equal(sidebarSafe({data:{}}),true);
 assert.equal(sidebarSafe({data:{Objectives:[{Name:objective}],DisplaySlots:{sidebar:objective}}}),true);
 assert.equal(sidebarSafe({data:{Objectives:[{Name:objective,CriteriaName:'dummy'}],DisplaySlots:{slot_1:objective}}}),true);
 for(const data of [null,{data:{DisplaySlots:{slot_1:'other'}}},{data:{Objectives:[{Name:'other',CriteriaName:'dummy'}]}}])assert.equal(sidebarSafe(data),false);
 let calls=0;const blocked=new Sidebar({execute:async()=>{calls++;},safe:false});await blocked.update(initialState());assert.equal(calls,0);
});
test('only changed displays write; repeated legitimate updates have no quota',async()=>{
 let calls=0;const sidebar=new Sidebar({safe:true,execute:async()=>{calls++;return ['Set [Hollow Harvest] for hh_row_0 to 3'];}});
 const state=initialState();for(let i=0;i<550;i++){state.lastObservation={totals:{logs:i%16}};await sidebar.update(state);await sidebar.update(state);}
 assert.equal(calls,550);assert.equal(sidebar.status.updates,550);assert.equal(sidebar.status.active,true);
 const failed=new Sidebar({safe:true,execute:async()=>['Unknown or incomplete command']});await failed.update(state);assert.equal(failed.status.active,false);assert.ok(failed.status.error);
});
test('deployed rescue and light objectives survive sidebar restart preflight without allowing mismatched criteria',()=>{const d={data:{Objectives:[{Name:'hh.rescue',CriteriaName:'dummy'},{Name:'hh.light',CriteriaName:'trigger'}],DisplaySlots:{sidebar:objective}}};assert.equal(sidebarSafe(d),true);delete d.data.Objectives[0].CriteriaName;assert.equal(sidebarSafe(d),true);d.data.Objectives[1].CriteriaName='dummy';assert.equal(sidebarSafe(d),false);});
