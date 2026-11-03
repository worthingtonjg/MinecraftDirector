import {campaignId,pages} from './chapter.mjs';
import {countInventory} from '../inventory.mjs';
const playerName=p=>{if(typeof p!=='string'||!/^[A-Za-z0-9_]{1,16}$/.test(p))throw Error('Invalid player');return p;};
const marker=p=>({hh_campaign:campaignId,hh_owner:playerName(p)});
export function isOwnedBook(item,p){const m=item?.components?.['minecraft:custom_data'];return item.id==='minecraft:written_book'&&m?.hh_campaign===campaignId&&m.hh_owner===p;}
export function slotName(slot){if(!Number.isInteger(slot)||slot<0||slot>35)throw Error('Book slot outside normal inventory');return slot<9?'hotbar.'+slot:'inventory.'+(slot-9);}
export function bookItem(state,p){
 const content={title:'Hollow Harvest Chronicle',author:'The System',generation:2,resolved:true,pages:pages(state,p).map(text=>({raw:{text}}))};
 return `minecraft:written_book[minecraft:written_book_content=${JSON.stringify(content)},minecraft:custom_data=${JSON.stringify({...marker(p),hh_revision:state.revision})}]`;
}
export function planBook(state,p,inventory){
 playerName(p);countInventory(inventory);const owned=inventory.filter(i=>isOwnedBook(i,p)).sort((a,b)=>(b.components['minecraft:custom_data'].hh_revision??0)-(a.components['minecraft:custom_data'].hh_revision??0)||a.Slot-b.Slot);
 if(owned.length){const item=owned[0];if(item.Slot<0||item.Slot>35)return {kind:'wait',reason:'Move Chronicle into a normal inventory slot'};
  if(item.components['minecraft:custom_data'].hh_revision===state.revision)return {kind:'current',slot:item.Slot};
  const nbt=`{Slot:${item.Slot}b,id:"minecraft:written_book",components:{"minecraft:custom_data":${JSON.stringify(marker(p))}}}`;
  return {kind:'update',slot:item.Slot,command:`execute if data entity ${p} Inventory[${nbt}] run item replace entity ${p} ${slotName(item.Slot)} with ${bookItem(state,p)} 1`};
 }
 if(['attempted','uncertain'].includes(state.books[p]?.status))return {kind:'wait',reason:'Previous Chronicle delivery is unconfirmed; inspect before retrying'};
 const used=new Set(inventory.map(i=>i.Slot));let slot=-1;for(let i=0;i<36;i++)if(!used.has(i)){slot=i;break;}
 if(slot<0)return {kind:'wait',reason:'Inventory full; free one slot for the Chronicle'};
 const ownerNbt=`{id:"minecraft:written_book",components:{"minecraft:custom_data":${JSON.stringify(marker(p))}}}`;
 return {kind:'issue',slot,command:`execute unless data entity ${p} Inventory[{Slot:${slot}b}] unless data entity ${p} Inventory[${ownerNbt}] run item replace entity ${p} ${slotName(slot)} with ${bookItem(state,p)} 1`};
}
export function reserveBook(state,p,plan){if(!['issue','update'].includes(plan.kind))return;if(plan.kind==='issue'&&['attempted','uncertain'].includes(state.books[p]?.status))throw Error('Previous book delivery unconfirmed');state.books[p]={...state.books[p],issued:true,status:'attempted',revision:state.revision,slot:plan.slot};}
export function confirmBook(state,p,inventory){countInventory(inventory);const owned=inventory.filter(i=>isOwnedBook(i,p));const current=owned.filter(i=>i.components['minecraft:custom_data'].hh_revision===state.revision).sort((a,b)=>a.Slot-b.Slot)[0];if(current){state.books[p]={issued:true,status:'confirmed',revision:state.revision,slot:current.Slot,...(owned.length>1?{notice:'Using current Chronicle; extra owner-marked copies left untouched'}:{})};return true;}if(state.books[p]?.issued)state.books[p].status='uncertain';return false;}
