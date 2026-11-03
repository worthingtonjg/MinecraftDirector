import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,advance,campaignId,pages} from '../chapter.mjs';
import {planBook,reserveBook,confirmBook,isOwnedBook,bookItem} from '../books.mjs';
import {ChapterController} from '../controller.mjs';
const item=(Slot,id,count=1)=>({Slot,id:'minecraft:'+id,count});
const equipped=()=>[item(0,'oak_log',64),item(1,'crafting_table'),item(2,'stone_pickaxe'),item(3,'stone_sword'),item(4,'cooked_porkchop',8),item(5,'torch',16),item(6,'furnace'),item(7,'dirt',64)];
const clone=x=>JSON.parse(JSON.stringify(x));
const marked=(p,revision,Slot=8)=>({Slot,id:'minecraft:written_book',count:1,components:{'minecraft:custom_data':{hh_campaign:campaignId,hh_owner:p,hh_revision:revision}}});
test('opening progression is persistent and goal-driven for solo through six',()=>{
 for(let size=1;size<=6;size++){
  const samples=Object.fromEntries(Array.from({length:size},(_,i)=>['Player'+i,equipped()]));let s=initialState();
  for(let step=0;step<4;step++){s=advance(clone(s),samples).state;assert.equal(s.step,step+1);}
  assert.equal(s.events.opening_complete.fragmentsRecovered,0);assert.equal(s.events.opening_complete.next,'harvestwood_fragment_route');assert.equal(Object.keys(s.rewards).length,size*4);
  assert.equal(advance(clone(s),samples).state.revision,s.revision);for(const p of Object.keys(samples)){assert.equal(s.players[p].level,2);assert.ok(pages(s,p).join('').includes('Further pages'));}
 }
 assert.throws(()=>advance(initialState(),Object.fromEntries(Array.from({length:7},(_,i)=>['P'+i,[]]))));
});
test('joins/leaves preserve targets and ignore stale inventories; newcomers do not retroactively receive rewards',()=>{
 let s=advance(initialState(),{Alex:equipped()}).state;s=advance(clone(s),{Alex:equipped(),Steve:[]}).state;assert.equal(s.step,2);
 assert.ok(!s.rewards['kindling:Steve']);assert.ok(s.rewards['tools:Steve']);
 const waiting=advance(clone(s),{Steve:[]}).state;assert.equal(waiting.step,2);assert.equal(waiting.lastObservation.totals.cookedFood,0);
 const furnace=advance(waiting,{Steve:equipped()}).state;assert.equal(furnace.step,3);const done=advance(furnace,{Steve:equipped()}).state;assert.equal(done.step,4);assert.equal(done.players.Alex.level,2);
});
test('book issue/update only uses empty or owner-marked slot; uncertain attempts never repeat',()=>{
 const s=advance(initialState(),{Alex:[]}).state;const original=[item(0,'diamond')];const plan=planBook(s,'Alex',original);assert.equal(plan.kind,'issue');assert.equal(plan.slot,1);assert.match(plan.command,/unless data entity Alex/);assert.deepEqual(original,[item(0,'diamond')]);
 reserveBook(s,'Alex',plan);assert.equal(planBook(clone(s),'Alex',original).kind,'wait');assert.equal(confirmBook(s,'Alex',[marked('Alex',0,1)]),true);
 s.revision++;const update=planBook(s,'Alex',[item(0,'diamond'),marked('Alex',0,1)]);assert.equal(update.kind,'update');assert.match(update.command,/if data entity Alex/);assert.match(update.command,/hh_owner/);assert.match(update.command,/hotbar.1/);
 assert.equal(planBook(s,'Alex',[marked('Alex',1),marked('Alex',1,9)]).kind,'current');assert.equal(planBook(s,'Alex',[marked('Steve',0)]).kind,'issue');
 const full=advance(initialState(),{Alex:[]}).state;assert.equal(planBook(full,'Alex',Array.from({length:36},(_,i)=>item(i,'stone'))).kind,'wait');assert.match(bookItem(s,'Alex'),/"generation":2/);assert.throws(()=>bookItem(s,'@a'));
});
function fixture(inventories){let disk=null,commands=[],pause=null;
 const execute=async command=>{
  commands.push(command);if(pause)await pause;
  if(command.startsWith('execute ')){
   const player=command.match(/data entity (\w+)/)[1],slot=Number(command.match(/Slot:(\d+)b/)[1]);const existing=inventories[player].find(i=>i.Slot===slot);
   if(command.includes('unless data')?!!existing:!existing||!isOwnedBook(existing,player))return [];
   const marker=JSON.parse(command.match(/,minecraft:custom_data=(.*)\] 1$/)[1]);inventories[player]=inventories[player].filter(i=>i.Slot!==slot);inventories[player].push({Slot:slot,id:'minecraft:written_book',count:1,components:{'minecraft:custom_data':marker}});return ['Replaced item'];
  }
  if(command.startsWith('give ')){const p=command.split(' ')[1];return [`Gave 1 [Bread] to ${p}`];}return [];
 };
 const create=()=>new ChapterController({load:()=>clone(disk),save:s=>disk=clone(s),observe:async()=>clone(inventories),execute});
 return {create,commands,get disk(){return disk;},setPause:x=>pause=x};
}
test('controller updates one book in place and does not repeat introduction or earned rewards after restart',async()=>{
 const f=fixture({Alex:equipped(),Steve:equipped()});let c=f.create();c.enabled=true;for(let i=0;i<4;i++)await c.tick();assert.equal(c.error,null);assert.equal(c.state.step,4);
 assert.equal(f.commands.filter(x=>x.startsWith('give ')).length,8);assert.equal(f.commands.filter(x=>x.startsWith('tellraw ')&&x.includes('The Harvest Lantern is cold, but daylight still holds')).length,2);assert.equal(f.commands.filter(x=>x.includes('unless data')).length,2);
 c=f.create();c.enabled=true;await c.tick();assert.equal(f.commands.filter(x=>x.startsWith('give ')).length,8);assert.equal(f.commands.filter(x=>x.includes('unless data')).length,2);
});
test('empty party pauses progress; overlapping ticks cannot duplicate writes; uncertain issuance stays blocked',async()=>{
 const empty=fixture({});const c=empty.create();c.enabled=true;await c.tick();assert.equal(c.waiting,true);assert.equal(empty.commands.length,0);
 const f=fixture({Alex:[]});const active=f.create();active.enabled=true;let release;f.setPause(new Promise(r=>release=r));const running=active.tick();await new Promise(setImmediate);await active.tick();release();await running;assert.equal(f.commands.filter(x=>x.includes('unless data')).length,1);
 const s=advance(initialState(),{Alex:[]}).state;reserveBook(s,'Alex',planBook(s,'Alex',[]));assert.equal(confirmBook(s,'Alex',[]),false);assert.equal(planBook(clone(s),'Alex',[]).kind,'wait');
});

test('uncertain reward delivery is persisted and never resent after restart',async()=>{
 let disk=null;const commands=[];const inventory=equipped();
 const create=()=>new ChapterController({load:()=>clone(disk),save:s=>disk=clone(s),observe:async()=>({Alex:clone(inventory)}),execute:async command=>{commands.push(command);return [];}});
 let c=create();c.enabled=true;await c.tick();assert.equal(disk.rewards['kindling:Alex'].status,'uncertain');
 c=create();c.enabled=true;await c.tick();assert.equal(commands.filter(x=>x==='give Alex minecraft:bread 1').length,2);
 assert.equal(disk.rewards['kindling:Alex'].status,'uncertain');assert.equal(disk.rewards['tools:Alex'].status,'uncertain');
});

test('full inventory preserves earned entitlement until space exists',async()=>{
 let disk=null;let inventory=[...equipped(),...Array.from({length:28},(_,i)=>item(i+8,'stone'))];const commands=[];
 const c=new ChapterController({load:()=>disk,save:s=>disk=clone(s),observe:async()=>({Alex:clone(inventory)}),execute:async command=>{commands.push(command);return ['Gave 1 [Bread] to Alex'];}});
 c.enabled=true;await c.tick();assert.equal(disk.rewards['kindling:Alex'].status,'pending');assert.equal(commands.filter(x=>x.startsWith('give ')).length,0);
 inventory=inventory.filter(i=>i.Slot!==35);await c.tick();assert.equal(disk.rewards['kindling:Alex'].status,'confirmed');assert.equal(disk.rewards['tools:Alex'].status,'confirmed');
});

test('missing Chronicle after death is replaced once; restart/rejoin and recovered old copy preserve progress',async()=>{
 const inventories={Alex:equipped()};const f=fixture(inventories);let c=f.create();c.enabled=true;for(let i=0;i<4;i++)await c.tick();
 const oldBook=clone(inventories.Alex.find(i=>isOwnedBook(i,'Alex')));const rewards=clone(c.state.rewards);const phase=c.state.step;
 inventories.Alex=[];await c.tick();assert.equal(inventories.Alex.filter(i=>isOwnedBook(i,'Alex')).length,1);
 const issued=f.commands.filter(x=>x.includes('unless data')).length;assert.equal(issued,2);
 assert.match(f.commands.filter(x=>x.includes('unless data')).at(-1),/unless data entity Alex Inventory\[\{id:"minecraft:written_book"/);
 c=f.create();c.enabled=true;await c.tick();assert.equal(f.commands.filter(x=>x.includes('unless data')).length,issued);
 const returned=clone(inventories.Alex);delete inventories.Alex;await c.tick();inventories.Alex=returned;await c.tick();
 oldBook.Slot=9;oldBook.components['minecraft:custom_data'].hh_revision=0;const unrelated={Slot:10,id:'minecraft:written_book',count:1,components:{'minecraft:custom_data':{personal:true}}};inventories.Alex.push(oldBook,unrelated);
 await c.tick();assert.equal(f.commands.filter(x=>x.includes('unless data')).length,issued);assert.equal(inventories.Alex.filter(i=>isOwnedBook(i,'Alex')).length,2);assert.deepEqual(inventories.Alex.find(i=>i.Slot===10),unrelated);assert.equal(c.state.step,phase);assert.deepEqual(c.state.rewards,rewards);assert.match(c.state.books.Alex.notice,/extra owner-marked copies left untouched/);
});

test('missing-book recovery waits for an empty slot without overwriting full inventory',()=>{
 const s=advance(initialState(),{Alex:[]}).state;s.books.Alex={issued:true,status:'confirmed',revision:0};
 const full=Array.from({length:36},(_,i)=>item(i,'diamond'));const before=clone(full);assert.equal(planBook(s,'Alex',full).kind,'wait');assert.deepEqual(full,before);
 full.pop();const plan=planBook(s,'Alex',full);assert.equal(plan.kind,'issue');assert.equal(plan.slot,35);reserveBook(s,'Alex',plan);assert.equal(planBook(clone(s),'Alex',full).kind,'wait');
});

