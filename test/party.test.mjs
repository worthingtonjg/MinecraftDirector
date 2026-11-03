import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeInventories,parseOnlineInventories} from '../inventory.mjs';
import {newQuestState,progress,rewardKey} from '../quests.mjs';
const kills=(names,n=0)=>Object.fromEntries(['zombies','skeletons'].map(s=>[s,Object.fromEntries(names.map(p=>[p,n]))]));
const inventories=names=>Object.fromEntries(names.map(p=>[p,{}]));
test('solo succeeds; stage roster stays fixed on joins and absent players do not block',()=>{
 let s=newQuestState();s.phase=3;
 s=progress(s,{},kills(['Alex']),{Alex:{}}).state;assert.deepEqual(s.stageRosters[3],['Alex']);
 s=progress(s,{waterBucket:1},kills(['Alex','Steve']),{Alex:{shields:1,ironPicks:1},Steve:{}}).state;
 assert.equal(s.phase,4);assert.deepEqual(s.stageRosters[3],['Alex']);
 let t=newQuestState();t.phase=3;t.stageRosters={3:['Alex','Steve']};
 t=progress(t,{waterBucket:1},kills(['Alex']),{Alex:{shields:1,ironPicks:1}}).state;assert.equal(t.phase,4);
 let u=newQuestState();u.phase=3;u.stageRosters={3:['Absent']};
 u=progress(u,{waterBucket:1},kills(['New']),{New:{shields:1,ironPicks:1}}).state;assert.equal(u.phase,4);
});
test('fresh snapshots never count offline inventories or transferred items twice; six player limit',()=>{
 const item=[{Slot:0,id:'minecraft:oak_log',count:16}];
 const a=summarizeInventories({Alex:item,Steve:[]});const b=summarizeInventories({Steve:item},a.completed);
 assert.equal(a.totals.logs,16);assert.equal(b.totals.logs,16);assert.equal(b.byPlayer.Alex,undefined);
 assert.equal(Object.keys(summarizeInventories(Object.fromEntries(['A','B','C','D','E','F'].map(n=>[n,[]]))).byPlayer).length,6);
 assert.throws(()=>summarizeInventories(Object.fromEntries(['A','B','C','D','E','F','G'].map(n=>[n,[]]))));assert.throws(()=>summarizeInventories({}));
 const line='[20:00:00] [Server thread/INFO]: System chat: Alex has the following entity data: []';assert.throws(()=>parseOnlineInventories([line,line]));
 const roster='[20:00:00] [Server thread/INFO]: System chat: There are 1 of a max of 6 players online: Alex';assert.deepEqual(Object.keys(parseOnlineInventories([roster,line])),['Alex']);assert.throws(()=>parseOnlineInventories([roster]));assert.throws(()=>parseOnlineInventories([line]));
});
test('join, leave and rejoin baseline historical species kills; persisted totals survive',()=>{
 let s=newQuestState();s.phase=4;s.baseline=kills(['Alex'],10);
 s=progress(s,{},kills(['Alex'],11),inventories(['Alex'])).state;assert.equal(s.killProgress.totals.zombies,1);
 s=progress(s,{}, {zombies:{Alex:11,Steve:100},skeletons:{Alex:11,Steve:100}},inventories(['Alex','Steve'])).state;assert.equal(s.killProgress.totals.zombies,1);
 s=progress(s,{},kills(['Alex'],11),inventories(['Alex'])).state;
 s=JSON.parse(JSON.stringify(s));
 s=progress(s,{}, {zombies:{Alex:11,Steve:150},skeletons:{Alex:11,Steve:150}},inventories(['Alex','Steve'])).state;assert.equal(s.killProgress.totals.zombies,1);
 s=progress(s,{}, {zombies:{Alex:11,Steve:151},skeletons:{Alex:11,Steve:150}},inventories(['Alex','Steve'])).state;assert.equal(s.killProgress.totals.zombies,2);assert.equal(s.killProgress.totals.skeletons,1);assert.equal(s.phase,4);
});
test('completion recipients freeze; returning players retain idempotent reward receipts',()=>{
 let s=progress(newQuestState(),{logs:16,table:1,picks:2},kills(['Alex']),{Alex:{}}).state;
 assert.deepEqual(s.rewardRecipients[0],['Alex']);s.rewards[rewardKey(0,'Alex')]={status:'confirmed'};
 s=progress(JSON.parse(JSON.stringify(s)),{},kills(['Alex','New']),inventories(['Alex','New'])).state;
 assert.deepEqual(s.rewardRecipients[0],['Alex']);assert.equal(s.rewards[rewardKey(0,'Alex')].status,'confirmed');
});
