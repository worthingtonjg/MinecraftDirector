import {syncStoryTime} from './story-time.mjs';
import {concurrentRows} from './concurrent-hunts.mjs';
import {rememberMessage} from './system-message.mjs';
import {rememberInventory} from './relocation.mjs';
import {onlineNames} from '../inventory.mjs';
import {slotName} from './books.mjs';
export const journeyCampaign='hollow_harvest_opening_v1';
export const hunts=[
 {id:'ember',species:'zombie',target:10,title:'The Ashen Watch',gear:'iron_sword',name:'Lanternkeeper’s Edge',enchantments:{'minecraft:sharpness':1},reward:'iron sword — Sharpness I'},
 {id:'wick',species:'skeleton',target:10,title:'The Rattling Choir',gear:'iron_chestplate',name:'Harvestwarden’s Coat',enchantments:{'minecraft:protection':1},reward:'iron chestplate — Protection I'},
 {id:'flame',species:'spider',target:10,title:'The Hissing Hollow',gear:'iron_boots',name:'Softfall Slippers',enchantments:{'minecraft:feather_falling':2},reward:'iron boots — Feather Falling II'}
];
export const lantern={x:2,y:63,z:-29,torch:{x:3,y:63,z:-29}};
export function ensureJourney(s){syncStoryTime(s);const j=s.journey??={version:1,index:0,phase:'beds',kills:0,last:{},present:[],participants:[],receipts:{},recovered:{},events:[],deliveries:{},lastCheck:null};
 if(j.phase==='hunt'){
 const id='hunt_open_'+j.index,fix=text=>text.replace(/(defeat )\d+( (?:zombies|skeletons|spiders))/i,'$110$2');let changed=false;
 for(const e of j.events??[])if(e.id===id){const t=fix(e.text);if(t!==e.text){e.text=t;changed=true;}}
 for(const [key,d]of Object.entries(j.deliveries??{}))if(key.startsWith(id+':')&&d.status==='pending')d.text=fix(d.text);
 if(s.systemMessage?.id==='journey:'+id)s.systemMessage.text=fix(s.systemMessage.text);
 if(changed)s.revision++;
 }return j;}

export function event(s,id,text,names){const j=ensureJourney(s);if(j.events.some(e=>e.id===id))return;j.events.push({id,text});rememberMessage(s,'journey:'+id,text);for(const p of names)j.deliveries[id+':'+p]={player:p,text,status:'pending'};s.revision++;}
export function entitlement(s,key,p,kind,index=-1){const j=ensureJourney(s);j.receipts[key]??={key,player:p,kind,index,status:'pending'};}
export function updateHunt(s,names,scores){onlineNames(names);const j=ensureJourney(s);if(j.phase!=='hunt')return;const h=hunts[j.index];for(const p of names){const score=scores[p];if(!Number.isInteger(score)||score<0)throw Error('Missing kill score');if(j.present.includes(p)&&Object.hasOwn(j.last,p)){if(score<j.last[p])throw Error('Kill score decreased');j.kills+=score-j.last[p];}j.last[p]=score;if(!j.participants.includes(p))j.participants.push(p);}j.present=[...names];if(j.kills>=h.target){j.phase='search';j.kills=h.target;for(const p of j.participants){entitlement(s,`map:${j.index}:${p}`,p,'map',j.index);entitlement(s,`gear:${j.index}:${p}`,p,'gear',j.index);}event(s,`hunt_${j.index}`,`${h.title}: hunt complete! The monsters have cancelled their victory party. You earned a marked map and ${h.name} (${h.reward}). Follow the red X, break the spawner, then take the fragment from the chest below.`,names);}j.lastCheck=new Date().toISOString();}
export const custom=i=>i?.components?.['minecraft:custom_data'];
export function owns(i,p,key){const c=custom(i);return c?.hh_campaign===journeyCampaign&&c.hh_owner===p&&c.hh_receipt===key;}
export function itemFor(r,sites){const h=hunts[r.index],marker={'minecraft:custom_data':{hh_campaign:journeyCampaign,hh_owner:r.player,hh_receipt:r.key}};let id;
 if(r.kind==='bed'){id='orange_bed';marker['minecraft:custom_name']={text:'A Home Against the Dark',italic:false,color:'gold'};}
 else if(r.kind==='creeperApple'){id='golden_apple';}
 else if(r.kind==='fishingRod'){id='fishing_rod';}
 else if(r.kind==='boat'){id='oak_boat';}
 else if(r.kind==='shield'){id='shield';marker['minecraft:custom_name']={text:'Lantern Keeper\u2019s Guard',italic:false,color:'aqua'};}
 else if(r.kind==='gear'&&h){id=h.gear;marker['minecraft:custom_name']={text:h.name,italic:false,color:'light_purple'};marker['minecraft:enchantments']=h.enchantments;}
 else if(r.kind==='dawnbreaker'){id='diamond_sword';marker['minecraft:custom_name']={text:'Dawnbreaker',italic:false,color:'gold'};marker['minecraft:enchantments']={'minecraft:sharpness':2,'minecraft:unbreaking':1};}
 else if(r.kind==='flame'){id='soul_torch';marker['minecraft:custom_name']={text:'Harvest Flame',italic:false,color:'gold'};}
 else if(r.kind==='finalMap'){const p=sites.finale;if(!p||!Number.isInteger(p.mapId))throw Error('Final map not prepared');id='filled_map';marker['minecraft:map_id']=p.mapId;marker['minecraft:map_decorations']={harvest_lantern:{type:'minecraft:red_x',x:p.x,z:p.z,rotation:0}};marker['minecraft:custom_name']={text:'The Harvest Lantern - Outpost Map',italic:false,color:'gold'};}
 else if(r.kind==='map'&&h){const p=sites[r.index];if(!p||!Number.isInteger(p.mapId))throw Error('Map not prepared');id='filled_map';marker['minecraft:map_id']=p.mapId;marker['minecraft:map_decorations']={harvest_fragment:{type:'minecraft:red_x',x:p.x,z:p.z,rotation:0}};marker['minecraft:custom_name']={text:h.title+' — Fragment Map',italic:false,color:'gold'};}
 else throw Error('Invalid fixed journey reward');return 'minecraft:'+id+'['+Object.entries(marker).map(([k,v])=>k+'='+JSON.stringify(v)).join(',')+']';
}
export function deliveryPlan(r,inventory,sites){if(inventory.some(i=>owns(i,r.player,r.key)))return {kind:'confirmed'};if(!['map','finalMap','flame'].includes(r.kind)&&['attempted','uncertain'].includes(r.status))return {kind:'uncertain'};if(r.status==='confirmed'&&!['map','finalMap','flame'].includes(r.kind))return {kind:'done'};const used=new Set(inventory.map(i=>i.Slot));const slot=Array.from({length:36},(_,i)=>i).find(i=>!used.has(i));if(slot===undefined)return {kind:'full'};
 const match=JSON.stringify({hh_campaign:journeyCampaign,hh_owner:r.player,hh_receipt:r.key});return {kind:'issue',slot,command:`execute unless data entity ${r.player} Inventory[{Slot:${slot}b}] unless data entity ${r.player} Inventory[{components:{"minecraft:custom_data":${match}}}] run item replace entity ${r.player} ${slotName(slot)} with ${itemFor(r,sites)} 1`};}
export function recoverFragment(s,samples){rememberInventory(s,samples);const j=ensureJourney(s);if(j.phase!=='search')return false;const h=hunts[j.index];const holder=Object.entries(samples).find(([,inv])=>inv.some(i=>custom(i)?.hh_campaign===journeyCampaign&&custom(i).hh_fragment===h.id));if(!holder&&!j.recovered[h.id])return false;j.recovered[h.id]??={player:holder[0],at:new Date().toISOString()};event(s,`fragment_${j.index}`,`The ${h.id} fragment is safe in the System’s memory. Even losing the item cannot undo this recovery. One less piece of the puzzle; one more reason for the darkness to sulk.`,Object.keys(samples));j.index++;j.kills=0;j.last={};j.present=[];j.participants=[];j.phase=j.index===3?'finale':'hunt';s.events.opening_complete.fragmentsRecovered=Object.keys(j.recovered).length;
 if(j.phase==='hunt')event(s,`hunt_open_${j.index}`,`${hunts[j.index].title}: defeat ${hunts[j.index].target} ${hunts[j.index].species}s together from now on to earn the next map and enchanted reward. Only this species counts.`,Object.keys(samples));else event(s,'finale_open',`All three fragments are remembered. Return to the Harvest Lantern at X 2, Y 63, Z -29. Place a torch immediately east of it at X 3, Y 63, Z -29 to rekindle it. Only this final act will bring dawn.`,Object.keys(samples));return true;}
export function journeyRows(s){const j=s.journey;if(!j)return null;const h=hunts[j.index];if(j.concurrent&&j.phase==='hunts')return concurrentRows(s);if(j.phase==='beds')return ['A Home Against the Dark','Bed reward: free 1 slot','Place/use bed to set spawn'];if(j.phase==='hunt')return [h.title,`Team ${h.species}s: ${j.kills}/${h.target}`,'Earn map + enchanted gear'];if(j.phase==='search')return [h.title,'Follow map red X','Take fragment below spawner'];if(j.phase==='finale'&&j.finalDestination){const p=j.finalDestination,n=(p.rescues??[]).length,done=(p.rescues??[]).filter(r=>j.outpost?.rescued?.[r.uuid]?.confirmed).length;return ['The Guarded Lantern','Follow the final outpost map',`Rescue golems: ${done}/${n||'pending'}`,'Upper deck: '+p.x+', '+p.y+', '+p.z,done===n&&n?'Carry Flame: /trigger hh.light':'Lantern locked: rescue golems'];}if(j.phase==='finale')return ['Rekindle the Harvest Lantern','Lantern: 2, 63, -29','Place torch: 3, 63, -29'];return ['The Harvest Dawn','Chapter complete!','Reward: Dawnbreaker','Build, explore, keep playing'];}
export const spawnMapGuidance='YOUR WORLD-SPAWN MAP\n\nThe separate Camp Lantern map covers 1024 by 1024 blocks centered on X 0, Z 0. Its red X marks world spawn at X 15, Z -16, not your bed. Use it in the Overworld. Unexplored areas fill as you travel. Missing quest books, maps and collected fragments are replaced when space is available; storing them can therefore produce extra copies. Normal lost items are not restored.';
export function journeyPages(s){
 const j=s.journey;if(!j)return [];
 const history=j.events.map(e=>'THE STORY CONTINUES\n\n'+e.text);
 // Early discoveries are experienced history, never permission to reveal other routes.
 if(s.step<4)return [...(s.step>=2?['YOUR BED REWARD\n\nYou earned an orange bed for completing the pickaxe and sword objectives. Free a slot to receive it. Place and use it in the Overworld to set your respawn point; check the game confirmation. The curse prevents skipping the night. Food and torches are still required before the next chapter.']:[]),...history];
 const begun=j.phase!=='beds',finished=['finale','restoring','done'].includes(j.phase);
 const unlockedHunts=hunts.filter((_,i)=>finished||(begun&&(j.concurrent||i<=j.index)));
 const mapUnlocked=i=>finished||(j.concurrent?j.concurrent[i].complete:i<j.index||(i===j.index&&j.phase==='search'));
 return [
 `THE FRAGMENT ROAD\n\n${journeyRows(s).join(j.concurrent?'\n':'\n\n')}\n\nRecovered: ${Object.keys(j.recovered).length}/3. There is no time limit.`,
 'A HOME AGAINST THE DARK\n\nYour orange bed is a one-time reward. Place and use it in the Overworld to set your respawn point; check the game confirmation. Holding it is not enough. The curse prevents sleeping through the night. Beds still set respawn.',
 ...(begun?['HUNT RULES\n\nAll three hunts run together after preparation. Each counts only its own species from activation onward. Only ordinary spiders count for the third hunt, not cave spiders. Equipment rewards are paid once.']:[]),
 ...unlockedHunts.map(x=>`${x.title}\n\nHunt: ${x.target} ${x.species}s. Reward: marked map plus ${x.name}, ${x.reward}.`),
 ...(hunts.some((_,i)=>mapUnlocked(i))?['READING YOUR EARNED MAP\n\nHold the matching treasure map and follow its red X. Blank areas fill as you explore. At the destination, destroy the spawner to make its reward chest appear below. Open it for the fragment. Take the marked fragment. Recovery is shared and permanent.']:[]),
 ...(j.routeSites??[]).filter((_,i)=>mapUnlocked(i)).map(p=>`UNLOCKED DESTINATION: ${hunts[p.index].title}\n\nX ${p.x}, Y ${p.y}, Z ${p.z}\n${Math.round(Math.hypot(p.x-15,p.z+16))} blocks from spawn.\n\nIf a blast destroys the reliquary, destroy the spawner and return within eight blocks: the System can recover its fragment into a free inventory slot.`),
 ...(j.phase==='done'?['EPILOGUE\n\nThe Harvest Flame burns. Dawn returns. You have broken the Hollow Harvest. This chapter is complete, but your story is yours to write.\n\nEach participant earns Dawnbreaker, a diamond sword with Sharpness II and Unbreaking I. Free an inventory slot to receive it. Normal day and night have returned; keep building and exploring.']:[]),
 ...history
 ];
}

export function finaleRewards(s){const j=ensureJourney(s);if(j.phase!=='done')return;j.finalParticipants??=Object.keys(s.players);for(const p of j.finalParticipants)entitlement(s,'dawnbreaker:'+p,p,'dawnbreaker');}

export const huntObjective=i=>i===2?'hh.spider2':'hh.hunt'+i;
