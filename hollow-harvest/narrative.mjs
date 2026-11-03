import {systemChat} from './system-chat.mjs';
import {rememberMessage} from './system-message.mjs';
export const beats=[
 {id:'kindling_open',at:0,title:'A Light Worth Keeping',text:'Daylight warms the clearing. Gather 64 logs, 64 dirt and a workbench; there is still time to prepare.'},
 {id:'logs_done',goal:'kindling:logs',title:'Wood You Look at That',text:'Wood supplies secured. The trees would like to lodge a complaint. Objective complete!'},
 {id:'dirt_done',goal:'kindling:dirt',title:'Down to Earth',text:'Dirt secured. Humble beginnings make excellent walls. Objective complete!'},
 {id:'table_done',goal:'kindling:table',title:'Table for Two (or Six)',text:'A crafting table! Finally, somewhere for the ghosts to put their terrible ideas. Objective complete!'},
 {id:'kindling_done',at:1,title:'A Place to Begin',text:'Your first preparations are ready. Make the most of the daylight: useful tools come next.'},
 {id:'tools_open',at:1,title:'Hands Against the Dark',text:'Shape stone into a pick and a sword while the sun still shines. Building shelter before you finish equipping yourselves would be wise. The daylight may not last.'},
 {id:'picks_done',goal:'tools:stonePicks',title:'A Grave Improvement',text:'Pickaxes ready. Excellent: the rocks were becoming suspiciously smug. Objective complete!'},
 {id:'swords_done',goal:'tools:stoneSwords',title:'A Pointed Argument',text:'Swords ready. Please keep the pointy end toward the spooky things. Objective complete!'},
 {id:'tools_done',at:2,title:'Stone and Resolve',text:'Your sword and pick are ready. The sun vanishes. The Harvest Lantern falls silent, and endless night begins. You earned a bed; set a safe return point. The Chronicle will guide you through the curse.'},
 {id:'furnace_open',at:2,stage:'furnace',title:'A Warm Welcome',text:'The dark is cold and supper should not be. Hold one furnace in your inventory to earn a fishing rod and an oak boat. A placed furnace does not count; pick it up for the System to check.'},
 {id:'furnace_done',goal:'furnace:furnace',title:'Something Fishy',text:'Furnace secured! You earned a fishing rod and an oak boat. The fish have requested a lawyer. Free inventory space to receive both rewards.'},
 {id:'supplies_open',at:3,title:'Before the Harvestwood',text:'Even a brave party needs supper and a way home. Gather cooked food and torches before the next page can turn.'},
 {id:'food_done',goal:'supplies:cookedFood',title:'Dinner Before Doom',text:'Supper secured. Adventuring on an empty stomach is how you become the grumpy ghost. Objective complete!'},
 {id:'torches_done',goal:'supplies:torches',title:'A Bright Idea',text:'Torches ready. The darkness has submitted a strongly worded complaint. Objective complete!'},
 {id:'supplies_done',at:4,title:'The Opening Ends',text:'Your preparations are complete. The curse remains, but you are ready for what comes next. Use your earned bed before the first hunt. The maps will lead you to the missing fragments.'}
];
export function recordNarrative(state,names){
 const available=beats.filter(b=>b.goal?state.done[b.goal]:b.at<=state.step&&!(b.stage&&state.skippedSteps?.[b.stage]));const first=!state.narrative;
 state.narrative??={version:1,history:[],deliveries:{}};
 let changed=false;
 for(const beat of available){if(state.narrative.history.includes(beat.id))continue;
  state.narrative.history.push(beat.id);changed=true;rememberMessage(state,'opening:'+beat.id,beat.text);
  // On migration, past beats belong in the book, not a burst of old chat.
  if(!first||beat===available.filter(b=>!b.goal).at(-1))for(const p of names)state.narrative.deliveries[beat.id+':'+p]={beat:beat.id,player:p,status:'pending'};
 }
 if(changed)state.revision++;
}
export async function remindAfterBook(state,player,{execute,save}){
 const latest=state.journey?.events?.at(-1)??[...(state.narrative?.history??[])].reverse().map(id=>beats.find(b=>b.id===id)).find(b=>b&&!b.goal);
 if(!latest||state.books[player]?.status!=='confirmed'||state.books[player].revision!==state.revision)return;
 state.bookReminders??={};const key=latest.id+':'+player;if(state.bookReminders[key])return;
 state.bookReminders[key]='attempted';save(state);
 await execute(systemChat(player,'[System] Your Chronicle has been updated. Open it for details.','aqua'));
 state.bookReminders[key]='sent';save(state);
}
export function storyPages(state){return (state.narrative?.history??[]).map(id=>beats.find(b=>b.id===id)).filter(Boolean).map(b=>`THE STORY SO FAR\n${b.title}\n\n${b.text}`);}
export async function deliverNarrative(state,names,alive,{execute,save}){
 for(const delivery of Object.values(state.narrative?.deliveries??{})){
  if(delivery.status!=='pending'||!names.includes(delivery.player)||alive[delivery.player]===false)continue;
  const beat=beats.find(b=>b.id===delivery.beat);if(!beat)throw Error('Unknown narrative beat');
  delivery.status='attempted';save(state);
  await execute(systemChat(delivery.player,'[System] '+beat.text));
  delivery.status='sent';save(state);
 }
}
