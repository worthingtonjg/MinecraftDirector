import test from 'node:test';
import assert from 'node:assert/strict';
import {Budget} from '../policy.mjs';
import {newQuestState,ensureRewardEntitlements,claimReward} from '../quests.mjs';
test('normal displays and earned payouts have no lifetime or timing quotas',()=>{
 const b=new Budget();Object.assign(b,{actions:20000,items:32000,sidebarUpdates:500,last:10000});
 for(let i=0;i<1000;i++){assert.equal(b.useSidebar('display-'+i,10000),true);b.use('reward',{},10000);}
 assert.equal(b.actions,21000);assert.equal(b.items,33000);assert.equal(b.sidebarUpdates,1500);assert.equal(b.rewardBlockReason(10000),null);
 assert.equal(b.useSidebar('display-999',10000),false);
});
test('six simultaneous earned rewards persist; no unearned duplicate or uncertain payout',()=>{
 const s=newQuestState();s.completedStages=[0];s.rewardRecipients={0:['A','B','C','D','E','F']};ensureRewardEntitlements(s);
 assert.equal(Object.keys(s.rewards).length,6);assert.throws(()=>claimReward(s,1,'A'),/not earned/);assert.throws(()=>claimReward(s,0,'New'),/not earned/);
 for(const p of s.rewardRecipients[0]){const key=claimReward(s,0,p);assert.ok(key);assert.equal(s.rewards[key].item,'bread');assert.equal(s.rewards[key].count,1);}
 const persisted=JSON.parse(JSON.stringify(s));persisted.rewards['0:A'].status='uncertain';persisted.rewards['0:B'].status='confirmed';ensureRewardEntitlements(persisted);
 for(const p of s.rewardRecipients[0])assert.equal(claimReward(persisted,0,p),null);
});
