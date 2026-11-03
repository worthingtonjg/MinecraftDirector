import test from 'node:test';import assert from 'node:assert/strict';
import {initialState} from '../chapter.mjs';import {ensureJourney,itemFor,deliveryPlan} from '../journey.mjs';import {JourneyController} from '../journey-controller.mjs';import {rows} from '../sidebar.mjs';
function fixture(names){let s=initialState();s.step=4;for(const p of names)s.players[p]={level:2};const j=ensureJourney(s);j.phase='hunt';const inv=Object.fromEntries(names.map(p=>[p,[]])),issued=[];for(const p of names)j.receipts['bed:'+p]={player:p,key:'bed:'+p,kind:'bed',status:'confirmed'};
 const io={save:()=>{},observe:async()=>structuredClone(inv),encounters:{state:{ready:true},sites:[]},execute:async c=>{if(c.includes('item replace entity')){const p=c.match(/hh_owner":"(\w+)"/)[1],key=c.match(/hh_receipt":"([^"]+)"/)[1],slot=Number(c.match(/Slot:(\d+)b/)[1]);issued.push(key);inv[p].push({Slot:slot,id:'minecraft:shield',components:{'minecraft:custom_data':{hh_campaign:s.campaign,hh_owner:p,hh_receipt:key}}});}return [];}};
 const create=()=>{const c=new JourneyController(io);c.initialized=true;c.counters=async names=>Object.fromEntries(names.map(p=>[p,0]));return c;};return {s,inv,issued,create};}
test('shield completion migration pays once for solo through six, and remains ordinary equipment',async()=>{
 for(let n=1;n<=6;n++){const names=Array.from({length:n},(_,i)=>'Player'+i),f=fixture(names);await f.create().tick(f.s,f.inv,{});assert.equal(f.issued.length,n);for(const p of names){assert.equal(f.s.journey.receipts['shield:'+p].status,'confirmed');f.inv[p]=[];}f.s=JSON.parse(JSON.stringify(f.s));await f.create().tick(f.s,f.inv,{});assert.equal(f.issued.length,n);assert.equal(f.s.journey.phase,'hunts');}
 const item=itemFor({kind:'shield',player:'Alex',key:'shield:Alex'},[]);assert.match(item,/minecraft:shield/);assert.match(item,/Lantern Keeper’s Guard/);assert.ok(!item.includes('enchantments'));
});
test('shield waits for space, supports late join and never retries uncertain delivery',async()=>{
 const f=fixture(['Alex']);f.inv.Alex=Array.from({length:36},(_,Slot)=>({Slot,id:'minecraft:stone'}));await f.create().tick(f.s,f.inv,{});assert.equal(f.issued.length,0);assert.equal(f.s.journey.receipts['shield:Alex'].status,'pending');f.inv.Alex.pop();await f.create().tick(f.s,f.inv,{});assert.equal(f.issued.length,1);
 f.s.players.Steve={level:2};f.inv.Steve=[];f.s.journey.receipts['bed:Steve']={player:'Steve',key:'bed:Steve',kind:'bed',status:'confirmed'};await f.create().tick(f.s,f.inv,{});assert.equal(f.issued.filter(x=>x==='shield:Steve').length,1);
 assert.equal(deliveryPlan({player:'Steve',key:'shield:Steve',kind:'shield',status:'uncertain'},[],[]).kind,'uncertain');
});
test('supplies advertise shield below both objectives; shield cannot unlock during unfinished preparation',async()=>{
 const f=fixture(['Alex']);f.s.step=3;assert.equal(rows(f.s)[3],'Reward: Shield');await f.create().tick(f.s,f.inv,{});assert.ok(!f.s.journey.receipts['shield:Alex']);
});
