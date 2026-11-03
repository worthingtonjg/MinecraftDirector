import {settings} from '../settings.mjs';
import {owns,journeyCampaign} from './journey.mjs';
export function spawnMapItem(player,map){
 if(!/^[A-Za-z0-9_]{1,16}$/.test(player)||!map||!Number.isInteger(map.mapId)||map.x!==15||map.z!==-16)throw Error('Verified spawn map required');
 return `minecraft:filled_map[minecraft:map_id=${map.mapId},minecraft:map_decorations=${JSON.stringify({[settings.spawnMarker]:{type:'minecraft:red_x',x:map.x,z:map.z,rotation:0}})},minecraft:custom_name=${JSON.stringify({text:'Camp Lantern — World Spawn',italic:false,color:'gold'})},minecraft:custom_data=${JSON.stringify({hh_campaign:journeyCampaign,hh_owner:player,hh_receipt:'spawnmap:'+player})}]`;
}
export async function deliverSpawnMap(s,p,inventory,map,{execute,observe,save}){
 if(!map)return;s.starterMaps??={};const r=s.starterMaps[p]??={kind:'spawnmap',player:p,key:'spawnmap:'+p,status:'pending'};
 // Reuse the same persisted delivery states and capacity guards as earned maps.
 const present=inventory.some(i=>owns(i,p,r.key));if(present){r.status='confirmed';save(s);return;}
 // User explicitly accepts missing-item recovery even after deliberate storage.

 const used=new Set(inventory.map(i=>i.Slot)),slot=Array.from({length:36},(_,i)=>i).find(v=>!used.has(v));if(slot===undefined){save(s);return;}
 const position=slot<9?'hotbar.'+slot:'inventory.'+(slot-9),marker={hh_campaign:journeyCampaign,hh_owner:p,hh_receipt:r.key};
 r.status='attempted';save(s);
 await execute(`execute if entity @a[name=${p},nbt=!{Health:0.0f}] unless data entity ${p} Inventory[{Slot:${slot}b}] unless data entity ${p} Inventory[{components:{"minecraft:custom_data":${JSON.stringify(marker)}}}] run item replace entity ${p} ${position} with ${spawnMapItem(p,map)} 1`);
 const after=(await observe())?.[p];r.status=after?.some(i=>owns(i,p,r.key))?'confirmed':'uncertain';save(s);
}
