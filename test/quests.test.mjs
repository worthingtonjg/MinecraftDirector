import test from 'node:test';
import assert from 'node:assert/strict';
import {newQuestState,progress,killDelta,parseKillScore,rewardKey} from '../quests.mjs';
import {players} from '../inventory.mjs';
const scores=(a,b)=>({[players[0]]:a,[players[1]]:b});
const kills=(a,b)=>({zombies:scores(a,b),skeletons:scores(a,b)});
const each=c=>Object.fromEntries(players.map(p=>[p,c]));
test('quest stages latch supplies and baseline only when combat begins',()=>{
 let s=newQuestState();s=progress(s,{logs:16},kills(7,3)).state;assert.equal(s.phase,0);
 s=progress(s,{table:1,picks:2},kills(7,3)).state;assert.equal(s.phase,1);assert.equal(s.done['0:logs'],true);
 s=progress(s,{axes:2,stoneSwords:2,stonePicks:2},kills(9,4),each({axes:1,stoneSwords:1,stonePicks:1})).state;assert.equal(s.phase,2);
 s=progress(s,{furnace:1,cookedFood:16,torches:32},kills(9,4)).state;assert.equal(s.phase,3);
 s=progress(s,{shields:2,ironPicks:2,waterBucket:1},kills(9,4),each({shields:1,ironPicks:1})).state;assert.equal(s.phase,4);assert.deepEqual(s.baseline,kills(9,4));
 assert.equal(progress(s,{},kills(9,4)).state.phase,4);assert.equal(progress(s,{},kills(11,5)).state.phase,5);
});
test('past kills, resets, ambiguous/missing scores do not count',()=>{
 assert.equal(killDelta(scores(10,5),scores(10,5)),0);assert.throws(()=>killDelta(scores(0,5),scores(10,5)));
 assert.equal(parseKillScore(['PlayerOne has 3 [mcd.zkills]'],'PlayerOne'),3);
 assert.equal(parseKillScore(["Can't get value of mcd.zkills for PlayerOne; none is set"],'PlayerOne'),0);
 assert.throws(()=>parseKillScore(['PlayerOne has 3 [other]'],'PlayerOne'));
 assert.throws(()=>parseKillScore([],'PlayerOne'));
});
test('completion and reward identities are stable, not reissued each observation',()=>{
 const s=progress(newQuestState(),{logs:16,table:1,picks:2},kills(0,0)).state;
 const next=progress(s,{},kills(0,0)).state;assert.deepEqual(next.completedStages,[0]);
 const key=rewardKey(0,players[0]);next.rewards[key]={status:'attempted'};assert.ok(next.rewards[rewardKey(0,players[0])]);assert.throws(()=>rewardKey(0,'@a'));
});
test('equipment requires each player; advanced tools skip obsolete gathering without reward',()=>{
 const s=newQuestState();s.phase=1;
 const n=progress(s,{stonePicks:2,axes:2,stoneSwords:2},kills(0,0),{[players[0]]:{stonePicks:2,axes:2,stoneSwords:2},[players[1]]:{}}).state;assert.equal(n.phase,1);assert.deepEqual(n.done,{});
 const skipped=progress(newQuestState(),{},kills(0,0),each({stonePicks:1})).state;assert.equal(skipped.phase,1);assert.deepEqual(skipped.skippedStages,[0]);assert.deepEqual(skipped.completedStages,[]);
});
