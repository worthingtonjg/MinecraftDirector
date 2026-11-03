import test from 'node:test';import assert from 'node:assert/strict';
import {DeathRequests,deathList} from '../death-requests.mjs';import {sidebarSafe} from '../sidebar.mjs';
const state={deathReceipts:Object.fromEntries(Array.from({length:8},(_,i)=>['d'+i,{player:i===7?'Steve':'Alex',counter:i,dimension:i===6?'minecraft:the_nether':'minecraft:overworld',pos:[i,64,-i]}]))};
test('private bounded recorded history is newest first, preserves dimensions and no-death answer',()=>{
 const t=deathList(state,'Alex');assert.equal((t.match(/X /g)??[]).length,5);assert.ok(t.indexOf('X 6')<t.indexOf('X 5'));assert.ok(!t.includes('X 7'));assert.ok(!t.includes('X 1,'));assert.match(t,/minecraft:the_nether/);assert.match(deathList(state,'Newbie'),/No recorded/);assert.throws(()=>deathList(state,'@a'));
 assert.equal(deathList(JSON.parse(JSON.stringify(state)),'Alex'),t);
});
test('nonzero trigger consumed once, private reply, rearmed after request/rejoin/restart',async()=>{
 let score=0;const commands=[];const execute=async c=>{commands.push(c);if(c.includes('objectives add'))return ['Created new objective'];if(c.includes('players get'))return [`Alex has ${score} [hh.deathlist]`];if(c.includes('players set')){score=0;return ['Set score to 0'];}return [];};
 let d=new DeathRequests({execute});await d.check(state,['Alex']);assert.ok(commands[0].endsWith(' trigger'));assert.ok(!commands.some(c=>c.startsWith('tellraw')));
 score=1;await d.check(state,['Alex']);await d.check(state,['Alex']);assert.equal(commands.filter(c=>c.startsWith('tellraw Alex ')).length,1);assert.ok(!commands.some(c=>c.includes('tellraw @')));
 d=new DeathRequests({execute,exists:true});await d.check(state,['Alex']);assert.equal(commands.filter(c=>c.startsWith('tellraw')).length,1);
 score=-2;await d.check(state,['Alex']);assert.equal(commands.filter(c=>c.startsWith('tellraw')).length,2);assert.ok(commands.at(-1).includes('players enable Alex'));assert.equal(d.status.error,null);
});
test('conflicts fail closed and a lost reply is not replayed',async()=>{
 let calls=0;const blocked=new DeathRequests({safe:false,execute:async()=>calls++});await blocked.check(state,['Alex']);assert.equal(calls,0);assert.match(blocked.status.error,/conflict/);
 assert.equal(sidebarSafe({data:{Objectives:[{Name:'hh.deathlist',CriteriaName:'trigger'}]}}),true);
 assert.equal(sidebarSafe({data:{Objectives:[{Name:'hh.deathlist',CriteriaName:'dummy'}]}}),false);
 let score=1,attempts=0;const execute=async c=>{if(c.includes('players get'))return [`Alex has ${score} [hh.deathlist]`];if(c.includes('players set')){score=0;return ['Set to 0'];}if(c.startsWith('tellraw')){attempts++;throw Error('ack lost');}return [];};
 await new DeathRequests({execute,exists:true}).check(state,['Alex']);await new DeathRequests({execute,exists:true}).check(state,['Alex']);assert.equal(attempts,1);
});
test('startup with no players initializes objective without a request or error',async()=>{
 const commands=[];const d=new DeathRequests({execute:async c=>{commands.push(c);return ['Created new objective'];}});await d.check({},[]);assert.equal(d.status.error,null);assert.equal(commands.length,1);assert.ok(commands[0].endsWith(' trigger'));
});
test('book migration removes Last Fall without touching command history or rewards',async()=>{
 const {initialState,validateState,pages}=await import('../chapter.mjs');
 const s=initialState();s.players.Alex={level:1};s.bookLayout=8;s.revision=20;
 s.deaths={Alex:'d'};s.deathReceipts={d:{player:'Alex',counter:1,dimension:'minecraft:overworld',pos:[1,64,3]}};s.rewards.example={status:'confirmed'};
 const history=deathList(s,'Alex'),before=JSON.stringify(s.deathReceipts),rewards=JSON.stringify(s.rewards);
 validateState(s);assert.equal(s.revision,21);validateState(s);assert.equal(s.revision,21);
 assert.equal(deathList(s,'Alex'),history);assert.equal(JSON.stringify(s.deathReceipts),before);assert.equal(JSON.stringify(s.rewards),rewards);
 assert.doesNotMatch(pages(s,'Alex').join('\n'),/LAST FALL|X 1, Y 64, Z 3/);
 assert.match(pages(s,'Alex')[0],/To list and pin your latest death, use \/trigger hh.deathlist\./);
});
