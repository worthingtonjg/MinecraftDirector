import {syncStoryTime,dayPremise,premise} from './story-time.mjs';
import {journeyPages} from './journey.mjs';
import {summarizeInventories,onlineNames} from '../inventory.mjs';
import {storyPages,beats} from './narrative.mjs';
export const campaignId='hollow_harvest_opening_v1';
export const title='Camp Lantern: The Hollow Harvest';
export const steps=[
 {id:'kindling',name:'A Light Worth Keeping',goals:[['logs',64,'Team: hold 64 logs'],['dirt',64,'Team: hold 64 dirt'],['table',1,'Team: hold 1 crafting table']]},
 {id:'tools',name:'Hands Against the Dark',goals:[['stonePicks',1,'Online starters: stone+ pick',true],['stoneSwords',1,'Online starters: stone+ sword',true]]},
 {id:'furnace',name:'A Warm Welcome',goals:[['furnace',1,'Team: hold 1 furnace']]},
 {id:'supplies',name:'Before the Harvestwood',goals:[['cookedFood',8,'Team: hold 8 cooked food'],['torches',16,'Team: hold 16 torches']]}
];
export const introduction='[System] '+dayPremise;
export function initialState(){return {campaign:campaignId,version:1,openingEdition:2,storyEdition:1,bookLayout:13,timeEdition:1,curse:{active:false,finalLanternRestored:false},step:0,done:{},rosters:{},players:{},rewards:{},events:{},books:{},revision:0,lastObservation:null};}
export function validateState(s){if(s?.campaign!==campaignId||s.version!==1||!Number.isInteger(s.step)||s.step<0||s.step>steps.length)throw Error('Wrong or invalid campaign checkpoint');if(s.openingEdition!==2){if(s.step>=2){s.step++;s.skippedSteps={...s.skippedSteps,furnace:'Added after this run passed the tools stage'};}s.openingEdition=2;s.revision++;}if(s.storyEdition!==1){s.storyEdition=1;s.curse={active:true,finalLanternRestored:false};s.revision++;}if(s.bookLayout!==13){s.bookLayout=13;const beat=beats.find(b=>s.systemMessage?.id==='opening:'+b.id);if(beat)s.systemMessage.text=beat.text;s.revision++;}syncStoryTime(s);return s;}
export function advance(state,samples){
 const next=structuredClone(validateState(state));const names=onlineNames(Object.keys(samples));const observation=summarizeInventories(samples);observation.totals.dirt=0;for(const p of names){const dirt=samples[p].filter(i=>i.id==='minecraft:dirt').reduce((n,i)=>n+(i.count??1),0);observation.byPlayer[p].dirt=dirt;observation.totals.dirt+=dirt;}
 for(const p of names)next.players[p]??={introduced:false,level:1};
 const before=JSON.stringify([next.step,next.done]);const step=steps[next.step];
 if(step){next.rosters[step.id]??=[...names];const present=next.rosters[step.id].filter(p=>names.includes(p));const required=present.length?present:[names[0]];
  for(const [key,target,,each]of step.goals)if(each?required.every(p=>observation.byPlayer[p][key]>=target):observation.totals[key]>=target)next.done[step.id+':'+key]=true;
  if(step.goals.every(([key])=>next.done[step.id+':'+key])){
   for(const p of names)next.rewards[step.id+':'+p]??={player:p,step:step.id,item:'bread',count:1,status:'pending'};
   next.step++;if(steps[next.step])next.rosters[steps[next.step].id]=[...names];
   else{next.events.opening_complete??={id:'opening_complete',status:'ready',next:'harvestwood_fragment_route',fragmentsRecovered:0};for(const p of Object.keys(next.players))next.players[p].level=2;}
  }
 }
 if(next.step===steps.length&&!next.curse.finalLanternRestored)for(const p of names)next.players[p].level=2;
 if(before!==JSON.stringify([next.step,next.done]))next.revision++;
 syncStoryTime(next);next.lastObservation={at:observation.observedAt,online:names,totals:observation.totals};return {state:next,observation};
}
export function claimReward(s,key){const r=s.rewards[key];if(!r||r.status!=='pending')return null;if(!steps.some(x=>x.id===r.step)||r.item!=='bread'||r.count!==1||!s.players[r.player])throw Error('Invalid reward entitlement');r.status='attempted';return structuredClone(r);}
export function pages(state,player){
 if(!state.players[player])throw Error('Unknown participant');const step=steps[state.step];
 const road=journeyPages(state);
 return [
  'THE HOLLOW HARVEST\nA Camp Lantern Chronicle\n\nItem collection quests are checked from your inventory.\nRefer back to this Chronicle for updates.\nTo list and pin your latest death, use /trigger hh.deathlist. Choose an older pin: /trigger hh.deathpin set 2 (1-5). Hide: /trigger hh.deathpin set 0.',
  'Goal:\n\n'+premise(state),
  ...storyPages(state),...road,
  ...(!step&&!state.journey?['OPENING COMPLETE\n\nThe curse remains. Further pages unlock as your adventure continues.']:[])
 ];
}
