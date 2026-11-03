import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,pages}from'../chapter.mjs';
import {recordNarrative,deliverNarrative,remindAfterBook,storyPages}from'../narrative.mjs';
test('objective and stage beats send once across polls, restart and rejoin',async()=>{
 let s=initialState();s.players.Alex={level:1};const commands=[];const io={execute:async c=>commands.push(c),save:()=>{}};
 recordNarrative(s,['Alex']);await deliverNarrative(s,['Alex'],{},io);
 s.done['kindling:logs']=true;recordNarrative(s,['Alex']);await deliverNarrative(s,['Alex'],{},io);assert.ok(commands.at(-1).includes('lodge a complaint'));
 s=JSON.parse(JSON.stringify(s));recordNarrative(s,['Alex']);await deliverNarrative(s,['Alex'],{},io);assert.equal(commands.length,2);
 s.step=1;s.done['kindling:table']=true;recordNarrative(s,['Alex']);await deliverNarrative(s,['Alex'],{},io);assert.equal(commands.length,5);
 assert.equal(storyPages(s).length,5);assert.ok(pages(s,'Alex').join(' ').includes('while the sun still shines'));
});
test('late joiners receive accumulated book story without replaying earlier chat',async()=>{
 const s=initialState();s.step=4;s.done=Object.fromEntries(['kindling:logs','kindling:table','tools:stonePicks','tools:stoneSwords','furnace:furnace','supplies:cookedFood','supplies:torches'].map(k=>[k,true]));
 recordNarrative(s,['Alex']);const cmds=[];const io={execute:async c=>cmds.push(c),save:()=>{}};await deliverNarrative(s,['Alex'],{},io);assert.equal(cmds.length,1);assert.match(cmds[0],/earned bed before the first hunt/);
 s.players.Steve={level:2};recordNarrative(s,['Alex','Steve']);await deliverNarrative(s,['Steve'],{},io);assert.equal(cmds.length,1);assert.equal(storyPages(s).length,14);assert.match(pages(s,'Steve').join(' '),/Further pages unlock/);
});
test('reminder requires confirmed current book and repeats only for a new story beat',async()=>{
 const s=initialState();recordNarrative(s,['Alex']);let calls=0;const io={execute:async()=>calls++,save:()=>{}};
 await remindAfterBook(s,'Alex',io);s.books.Alex={status:'uncertain',revision:s.revision};await remindAfterBook(s,'Alex',io);assert.equal(calls,0);
 s.books.Alex.status='confirmed';await remindAfterBook(s,'Alex',io);await remindAfterBook(s,'Alex',io);assert.equal(calls,1);
 s.done['kindling:logs']=true;recordNarrative(s,['Alex']);s.books.Alex.revision=s.revision;await remindAfterBook(s,'Alex',io);assert.equal(calls,1);
 s.step=1;recordNarrative(s,['Alex']);await remindAfterBook(s,'Alex',io);assert.equal(calls,1);s.books.Alex.revision=s.revision;await remindAfterBook(s,'Alex',io);assert.equal(calls,2);
});
test('interrupted narrative send persists receipt and does not blindly replay',async()=>{
 let s=initialState();recordNarrative(s,['Alex']);let disk;await assert.rejects(deliverNarrative(s,['Alex'],{},{save:v=>disk=JSON.parse(JSON.stringify(v)),execute:async()=>{throw Error('interrupted');}}));
 s=disk;await deliverNarrative(s,['Alex'],{},{save:()=>{},execute:async()=>{throw Error('must not repeat');}});assert.equal(Object.values(s.narrative.deliveries)[0].status,'attempted');
});

