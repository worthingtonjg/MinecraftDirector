import test from 'node:test';import assert from 'node:assert/strict';import {spawnMapItem,deliverSpawnMap} from '../spawn-map.mjs';import {initialState} from '../chapter.mjs';
const map={mapId:5,x:15,z:-16,xCenter:0,zCenter:0,scale:3};
test('spawn map uses separate identity and permanent world-spawn marker',()=>{const item=spawnMapItem('Alex',map);assert.match(item,/minecraft:map_id=5/);assert.match(item,/camp_lantern_spawn/);assert.match(item,/"x":15,"z":-16/);assert.match(item,/spawnmap:Alex/);assert.ok(!item.includes('harvest_fragment'));assert.throws(()=>spawnMapItem('@a',map));});
test('one starter map, full inventory deferred, accepted missing-item recovery works after storage or restart',async()=>{
 let s=initialState(),inv=Array.from({length:36},(_,Slot)=>({Slot,id:'minecraft:stone'})),calls=0;
 const io={save:()=>{},observe:async()=>({Alex:inv}),execute:async()=>{calls++;inv=[{Slot:0,id:'minecraft:filled_map',components:{'minecraft:custom_data':{hh_campaign:s.campaign,hh_owner:'Alex',hh_receipt:'spawnmap:Alex'}}}];}};
 await deliverSpawnMap(s,'Alex',inv,map,io);assert.equal(calls,0);inv=[];await deliverSpawnMap(s,'Alex',inv,map,io);assert.equal(calls,1);assert.equal(s.starterMaps.Alex.status,'confirmed');
 inv=[];s=JSON.parse(JSON.stringify(s));await deliverSpawnMap(s,'Alex',inv,map,io);assert.equal(calls,2);
 await deliverSpawnMap(s,'Alex',inv,map,io);assert.equal(calls,2);
 inv=[];await deliverSpawnMap(s,'Alex',inv,map,io);assert.equal(calls,3);assert.equal(Object.keys(s.rewards).length,0);
});
