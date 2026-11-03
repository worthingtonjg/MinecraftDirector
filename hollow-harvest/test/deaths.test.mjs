import test from 'node:test';import assert from 'node:assert/strict';
import {observation,remember,mark,candidates,DeathTracker}from'../deaths.mjs';
import {initialState,advance,pages}from'../chapter.mjs';
import {planBook}from'../books.mjs';
const loc={dimension:'minecraft:overworld',pos:[83,102,-110]};
const lines=(count=1,health=20,where=loc)=>[`Alex has ${count} [hh.deaths]`,where?`Alex has the following entity data: {pos: [I; ${where.pos.join(', ')}], dimension: "${where.dimension}"}`:'Found no elements matching LastDeathLocation',`Alex has the following entity data: ${health}.0f`,`Alex has ${count} [hh.deaths]`];
const fresh=()=>advance(initialState(),{Alex:[]}).state;
test('uses actual dimension/LastDeathLocation with stable counter, never current or respawn position',()=>{
 assert.deepEqual(observation(lines(),'Alex'),{counter:1,health:20,location:loc});assert.equal(observation(lines(0,20,null),'Alex').location,null);
 const raced=lines();raced[3]='Alex has 2 [hh.deaths]';assert.throws(()=>observation(raced,'Alex'));assert.throws(()=>observation(['Alex has the following entity data: [0d, 64d, 0d]'],'Alex'));
 assert.equal(observation(lines(2,0),'Alex').health,0);
});
test('per-death receipts persist, successive deaths at identical coordinates remain distinct',async()=>{
 let s=fresh();let r=remember(s,'Alex',observation(lines(),'Alex'));let calls=0;
 const execute=async()=>{calls++;return ['Test passed'];};await mark(s,r,{execute,save:()=>{}});assert.equal(r.placed.length,4);const after=calls;
 s=JSON.parse(JSON.stringify(s));r=remember(s,'Alex',observation(lines(),'Alex'));await mark(s,r,{execute,save:()=>{}});assert.equal(calls,after);
 const next=remember(s,'Alex',observation(lines(2),'Alex'));assert.notEqual(next.id,r.id);await mark(s,next,{execute,save:()=>{}});assert.equal(Object.keys(s.deathReceipts).length,2);
 assert.throws(()=>remember(s,'Alex',observation(lines(0),'Alex')));assert.doesNotMatch(pages(s,'Alex').join(''),/LAST FALL/);
});
test('void, liquids, unloaded chunks and unsafe supports fall back without repeated placement',async()=>{
 for(const where of [{...loc,pos:[83,-100,-110]},{dimension:'custom:unknown',pos:[0,64,0]},loc]){
  const s=fresh(),r=remember(s,'Alex',{counter:1,health:20,location:where});const commands=[];
  const execute=async c=>{commands.push(c);return ['That position is not loaded'];};await mark(s,r,{execute,save:()=>{}});assert.equal(r.status,'coordinates_only');assert.ok(commands.every(c=>!c.includes('setblock')));const n=commands.length;await mark(s,r,{execute,save:()=>{}});assert.equal(commands.length,n);
 }
 const s=fresh(),r=remember(s,'Alex',{counter:1,health:20,location:loc});let calls=0;const cmds=[];
 await mark(s,r,{save:()=>{},execute:async c=>{cmds.push(c);return ++calls===1?['Test passed']:[];}});assert.equal(r.placed.length,0);assert.ok(cmds.every(c=>!c.includes('setblock')));assert.ok(cmds.slice(1).every(c=>c.includes('type=minecraft:item')&&c.includes('minecraft:air')));
 assert.equal(candidates({...loc,pos:[0,320,0]}).length,0);
});
test('attempt is saved before world write; interrupted marker is never replayed',async()=>{
 const s=fresh(),r=remember(s,'Alex',{counter:1,health:20,location:loc});let disk;
 await mark(s,r,{save:v=>{disk=JSON.parse(JSON.stringify(v));},execute:async()=>{assert.equal(disk.deathReceipts[r.id].status,'attempted');throw Error('connection interrupted');}});
 assert.equal(r.status,'uncertain');await mark(s,r,{save:()=>{},execute:async()=>{throw Error('must not retry');}});
});
test('dead players wait for respawn; recovered Chronicle includes death location without changing receipts',async()=>{
 const s=fresh();s.books.Alex={issued:true,status:'confirmed',revision:0};s.rewards={};let health=0;
 const tracker=new DeathTracker({exists:true,execute:async c=>c.startsWith('scoreboard players add')?lines(1,health):[],save:()=>{}});
 assert.equal((await tracker.check(s,['Alex'])).Alex,false);assert.equal(s.deathReceipts[s.deaths.Alex].status,'pending');health=20;await tracker.check(s,['Alex']);assert.equal(s.deathReceipts[s.deaths.Alex].status,'coordinates_only');
 const plan=planBook(s,'Alex',[]);assert.equal(plan.kind,'issue');assert.match(plan.command,/trigger hh.deathlist/);assert.deepEqual(s.rewards,{});
});
