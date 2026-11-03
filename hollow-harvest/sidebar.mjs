import {wrapMessage} from './system-message.mjs';
import {beats} from './narrative.mjs';
import {journeyRows,hunts,huntObjective} from './journey.mjs';
import {steps,validateState} from './chapter.mjs';
export const objective='hh.opening';
export function sidebarSafe(nbt){
 const d=nbt?.data;if(!d||typeof d!=='object')return false;
 const slots=d.DisplaySlots??d.display_slots??{};
 if(Object.values(slots).some(v=>v!==objective))return false;
 const objectives=d.Objectives??d.objectives??[];
 return Array.isArray(objectives)&&objectives.every(o=>((o.Name??o.name)===objective&&(o.CriteriaName??o.criteria??'dummy')==='dummy')||((o.Name??o.name)==='hh.rescue'&&(o.CriteriaName??o.criteria??'dummy')==='dummy')||((o.Name??o.name)==='hh.light'&&(o.CriteriaName??o.criteria)==='trigger')||((o.Name??o.name)==='hh.deathpin'&&(o.CriteriaName??o.criteria)==='trigger')||((o.Name??o.name)==='hh.deathlist'&&(o.CriteriaName??o.criteria)==='trigger')||((o.Name??o.name)==='hh.deaths'&&(o.CriteriaName??o.criteria)==='deathCount')||[0,1,2].some(i=>(o.Name??o.name)==='hh.got'+i&&(o.CriteriaName??o.criteria??'dummy')==='dummy')||((o.Name??o.name)==='hh.hunt2'&&(o.CriteriaName??o.criteria)==='minecraft.killed:minecraft.creeper')||hunts.some((h,i)=>(o.Name??o.name)===huntObjective(i)&&(o.CriteriaName??o.criteria)==='minecraft.killed:minecraft.'+h.species));
}
export function rows(state){
 validateState(state);const step=steps[state.step];
 if(!step&&state.journey)return journeyRows(state);
 if(!step)return ['Opening complete','Next chapter coming soon','No fragment hunt yet'];
 const labels={dirt:'Team dirt',furnace:'Team furnace',logs:'Team logs',table:'Team crafting table',stonePicks:'Each starter: stone+ pick',stoneSwords:'Each starter: stone+ sword',cookedFood:'Team cooked food',torches:'Team torches'};
 return [step.name,...step.goals.map(([key,target,,each])=>state.done[step.id+':'+key]?'[Done] '+labels[key]:each?'[ ] '+labels[key]:`${labels[key]}: ${Math.min(state.lastObservation?.totals[key]??0,target)}/${target}`),...(step.id==='tools'?['Reward: Bed']:step.id==='supplies'?['Reward: Shield']:step.id==='furnace'?['Reward: Rod + Boat']:[])];
}
export function panelRows(state){
 // Migration reads only previously unlocked history; it creates no event receipts.
 const messageId=state.systemMessage?.id??(state.journey?.events?.length?null:'opening:'+state.narrative?.history?.at(-1));
 const message=messageId==='opening:kindling_open'?'Daylight holds. Begin with wood and a workbench. Open your Chronicle for the story and your first objectives.':state.systemMessage?.text??state.journey?.events?.at(-1)?.text??beats.find(b=>b.id===state.narrative?.history?.at(-1))?.text;
 const objectives=[...rows(state),...(state.journey?.nearbySites??[]).map(i=>'Nearby: destroy '+hunts[i].id+' spawner')];return message?[...objectives,'','System message',...wrapMessage(message,30,Math.min(7,14-objectives.length-2))]:objectives;
}
export function displayCommands(state,{create=false}={}){
 const commands=create?[`scoreboard objectives add ${objective} dummy {text:"Hollow Harvest",color:"gold"}`]:[];
 // At most 14 lines, below vanilla's 15-line sidebar limit. Only our holders are touched.
 for(let i=0;i<14;i++)commands.push(`scoreboard players reset hh_row_${i} ${objective}`);
 panelRows(state).forEach((text,i)=>commands.push(`scoreboard players set hh_row_${i} ${objective} ${14-i}`,`scoreboard players display name hh_row_${i} ${objective} ${JSON.stringify({text,color:text.startsWith('[Done]')?'green':text.startsWith('Reward:')?'aqua':i===0||text==='System message'?'gold':i>rows(state).length?'aqua':'white'})}`));
 return [...commands,`scoreboard objectives modify ${objective} numberformat blank`,`scoreboard objectives setdisplay sidebar ${objective}`];
}
export class Sidebar {
 constructor({execute,safe,exists=false}){this.execute=execute;this.exists=exists;this.signature=null;this.status={active:false,error:safe?null:'Existing scoreboard conflict or unreadable data; display preserved',updates:0,lastOutput:[]};}
 async update(state){
  if(this.status.error)return;const signature=JSON.stringify(panelRows(state));if(signature===this.signature)return;
  const output=await this.execute(displayCommands(state,{create:!this.exists}).join('\n'));
  this.status.lastOutput=output;
  if(!output.some(line=>/display slot.*sidebar|Set .*hh_row_/i.test(line))||output.some(line=>/Unknown|Incorrect argument|Expected|Invalid|No objective was found/i.test(line))){this.status.error='Sidebar response unconfirmed; inspect output before retry';this.status.active=false;return;}
  this.exists=true;this.signature=signature;this.status.active=true;this.status.updates++;
 }
}


