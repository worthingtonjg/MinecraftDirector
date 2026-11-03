import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../chapter.mjs';
import {recordNarrative} from '../narrative.mjs';
import {event} from '../journey.mjs';
import {panelRows,rows,Sidebar,displayCommands} from '../sidebar.mjs';
import {wrapMessage} from '../system-message.mjs';
test('combined panel preserves objectives and bed reward, with bounded readable message rows',()=>{
 const s=initialState();s.step=1;recordNarrative(s,['Alex']);
 const p=panelRows(s);assert.deepEqual(p.slice(0,4),rows(s));assert.equal(p[3],'Reward: Bed');
 assert.equal(p[5],'System message');assert.ok(p.length<=13);assert.ok(p.slice(6).every(x=>x.length<=30));
 assert.equal(wrapMessage('Long story '.repeat(100)).at(-1),'More in your Chronicle...');
 assert.ok(wrapMessage('x'.repeat(300)).every(x=>x.length<=30));
 assert.ok(displayCommands(s).every(c=>c.includes('hh.opening')));
});
test('latest meaningful event persists through polls, rejoin and serialization without replaying receipts',()=>{
 const s=initialState();recordNarrative(s,['Alex']);s.done['kindling:logs']=true;recordNarrative(s,['Alex']);
 assert.equal(s.systemMessage.id,'opening:logs_done');const before=JSON.stringify(s);
 recordNarrative(s,['Alex','Steve']);assert.equal(JSON.stringify(s),before);
 event(s,'bed_reward_unlocked','You earned a bed.',['Alex']);
 const restored=JSON.parse(JSON.stringify(s));event(restored,'bed_reward_unlocked','Changed duplicate',['Alex']);
 assert.equal(restored.systemMessage.text,'You earned a bed.');assert.deepEqual(panelRows(restored),panelRows(s));
 assert.deepEqual(restored.rewards,s.rewards);
});
test('old checkpoint gets a panel from unlocked history without creating new chat or rewards',()=>{
 const s=initialState();recordNarrative(s,['Alex']);delete s.systemMessage;
 const before=JSON.stringify(s);assert.ok(panelRows(s).length>3);assert.equal(JSON.stringify(s),before);
 assert.doesNotMatch(panelRows(s).join(' '),/skeleton|creeper|fragment.*chest/i);
});
test('persistent panel needs no refresh loop and only writes when display changes',async()=>{
 const s=initialState();recordNarrative(s,['Alex']);let calls=0;
 const sidebar=new Sidebar({safe:true,execute:async()=>{calls++;return ['Set hh_row_0'];}});
 await sidebar.update(s);await sidebar.update(s);assert.equal(calls,1);
 s.done['kindling:logs']=true;recordNarrative(s,['Alex']);await sidebar.update(s);assert.equal(calls,2);
 await sidebar.update(s);assert.equal(calls,2);
});
test('opening panel ends with fully visible book instruction, including old checkpoint migration',()=>{
 const s=initialState();recordNarrative(s,['Alex']);const before=JSON.stringify(s);
 const lines=panelRows(s).slice(6);
 assert.ok(lines.length<=7);assert.ok(lines.every(x=>x.length<=30));
 assert.ok(lines.join(' ').endsWith('Open your Chronicle for the story and your first objectives.'));
 assert.equal(JSON.stringify(s),before);
 delete s.systemMessage;assert.deepEqual(panelRows(s).slice(6),lines);
 s.done['kindling:logs']=true;recordNarrative(s,['Alex']);
 assert.deepEqual(panelRows(s).slice(6),wrapMessage(s.systemMessage.text));
});
