import {players,onlineNames} from './inventory.mjs';
import {objective} from './sidebar.mjs';
export const killObjective='mcd.zkills';
export const skeletonObjective='mcd.skills';
export const stages=[
 {name:'Camp supplies',goals:[['logs',16,'Hold 16 logs'],['table',1,'Hold 1 crafting table'],['picks',2,'Hold 2 wood/stone picks']]},
 {name:'Stone or better tools',goals:[['stonePicks',2,'Each: stone+ pick',true],['axes',2,'Each: stone+ axe',true],['stoneSwords',2,'Each: stone+ sword',true]]},
 {name:'Expedition supplies',goals:[['furnace',1,'Hold 1 furnace'],['cookedFood',16,'Hold 16 cooked food'],['torches',32,'Hold 32 torches']]},
 {name:'Iron essentials',goals:[['shields',2,'Each: shield',true],['ironPicks',2,'Each: iron+ pick',true],['waterBucket',1,'Team: 1 water bucket']]},
 {name:'Team patrol',combat:true,goals:[['zombies',3,'Defeat 3 zombies'],['skeletons',2,'Defeat 2 skeletons']]}
];
export function newQuestState(){return {phase:0,done:{},completedStages:[],baseline:null,rewards:{},displaySignature:null};}
export function parseKillScore(output,player,obj=killObjective){
 if(![killObjective,skeletonObjective].includes(obj))throw Error('Unsupported kill species');
 const escaped=player.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const hits=output.map(line=>line.replace(/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?/,''));
 const re=new RegExp('^'+escaped+' has (\\d+) \\[?'+obj.replaceAll('.','\\.')+'\\]?$');
 const values=hits.map(x=>x.match(re)).filter(Boolean);
 if(values.length===1)return Number(values[0][1]);
 if(hits.filter(x=>x===`Can't get value of ${obj} for ${player}; none is set`).length===1)return 0;
 throw Error('Missing or ambiguous kill score for '+player);
}
export function killDelta(current,baseline){
 if(!baseline||players.some(p=>!Number.isSafeInteger(current[p])||!Number.isSafeInteger(baseline[p])||current[p]<baseline[p]))throw Error('Invalid kill baseline/counter');
 return players.reduce((n,p)=>n+current[p]-baseline[p],0);
}
export function progress(state,totals,kills,byPlayer={}){
 const online=onlineNames(Object.keys(byPlayer).length?Object.keys(byPlayer):Object.keys(kills?.zombies??{}));
 const next=structuredClone(state);next.stageRosters??={};next.rewardRecipients??=Object.fromEntries(next.completedStages.map(p=>[p,[...players]]));
 if(next.phase===0&&online.every(p=>(byPlayer[p]?.stonePicks??0)>=1)){next.phase=1;next.skippedStages=[...new Set([...(next.skippedStages??[]),0])];}
 const stage=stages[next.phase];if(!stage)return {state:next,completed:null};
 next.stageRosters[next.phase]??=[...online];
 // Joining never adds equipment requirements. Offline starters do not block solo.
 // If all starters are absent, one online player can stand in for this stage.
 const present=next.stageRosters[next.phase].filter(p=>online.includes(p));const required=present.length?present:[online[0]];
 const counts={...totals};if(stage.combat){
  next.killProgress??={totals:{zombies:0,skeletons:0},last:structuredClone(next.baseline??{}),online:Object.keys(next.baseline?.zombies??{})};
  const previous=next.killProgress;
  for(const species of ['zombies','skeletons']){previous.last[species]??={};for(const p of online){const current=kills?.[species]?.[p];if(!Number.isSafeInteger(current)||current<0)throw Error('Invalid kill counter');const last=previous.last[species][p];if(previous.online.includes(p)&&last!==undefined){if(current<last)throw Error('Kill counter reset');previous.totals[species]+=current-last;}previous.last[species][p]=current;}counts[species]=previous.totals[species];}
  previous.online=[...online];
 }
 for(const [key,target,,each] of stage.goals)if(each?required.every(p=>(byPlayer[p]?.[key]??0)>=1):(counts[key]??0)>=target)next.done[`${next.phase}:${key}`]=true;
 let completed=null;
 if(stage.goals.every(([key])=>next.done[`${next.phase}:${key}`]===true)){
  completed=next.phase;if(!next.completedStages.includes(completed))next.completedStages.push(completed);next.rewardRecipients[completed]=[...online];next.phase++;next.stageRosters[next.phase]=[...online];
  if(stages[next.phase]?.combat){if(!kills)throw Error('Fresh kill baseline required');for(const species of ['zombies','skeletons'])for(const p of online)if(!Number.isSafeInteger(kills[species]?.[p]))throw Error('Fresh kill baseline required');next.baseline=structuredClone(kills);next.killProgress={totals:{zombies:0,skeletons:0},last:structuredClone(kills),online:[...online]};}
 }
 return {state:next,completed};
}
export function questSidebar(state){
 const stage=stages[state.phase];const rows=[['named','[Done] Name Camp Lantern','green'],['stage',stage?stage.name:'Ready for next adventure','gold']];
 for(let i=0;i<3;i++){const goal=stage?.goals[i];const done=goal&&state.done[`${state.phase}:${goal[0]}`]===true;rows.push(['goal'+i,goal?(done?'[Done] ':'[ ] ')+goal[2]:' ',done?'green':'white']);}
 rows.push(['next0','Team: shelter/chest/beds*','gray'],['next1','Plan: tools > food > iron','gray'],['next2','Patrol: 3 zombies, 2 skeletons','gray'],['next3','*Camp building: self-check','gray']);
 // Only replace our own fixed score holders; preserve all unrelated data.
 return ['wood','landmark','animal'].map(id=>`scoreboard players reset mcd_${id} ${objective}`).concat(rows.flatMap(([id,text,color],i)=>[`scoreboard players set mcd_${id} ${objective} ${9-i}`,`scoreboard players display name mcd_${id} ${objective} ${JSON.stringify({text,color})}`]),[`scoreboard objectives modify ${objective} numberformat blank`,`scoreboard objectives setdisplay sidebar ${objective}`]);
}
export function rewardKey(phase,player){if(!Number.isInteger(phase)||phase<0||phase>=stages.length||!/^[A-Za-z0-9_]{1,16}$/.test(player))throw Error('Invalid reward identity');return `${phase}:${player}`;}
export function ensureRewardEntitlements(state){
 state.rewardRecipients??=Object.fromEntries(state.completedStages.map(p=>[p,[...players]]));
 for(const phase of state.completedStages)for(const player of state.rewardRecipients[phase]??[]){const key=rewardKey(phase,player);state.rewards[key]??={status:'pending',item:'bread',count:1};}
}
export function claimReward(state,phase,player){
 const key=rewardKey(phase,player);if(!state.completedStages.includes(phase)||!(state.rewardRecipients?.[phase]??players).includes(player))throw Error('Reward not earned for this player and quest');
 ensureRewardEntitlements(state);const entry=state.rewards[key];if(entry.status!=='pending')return null;
 if(entry.item!=='bread'||entry.count!==1)throw Error('Invalid bounded reward entitlement');entry.status='attempted';return key;
}
