import {deliverSpawnMap} from './spawn-map.mjs';
import {hunts,ensureJourney} from './journey.mjs';
import {rememberAcquisition,rememberInventory,restorationPlan,staleMapPlans} from './relocation.mjs';
import {fragmentItem} from './encounters.mjs';
export class QuestPossessions{
 constructor({execute,observe,save}){this.execute=execute;this.observe=observe;this.save=save;}
 async check(s,samples,alive,sites){const names=Object.keys(samples);for(const [id,r]of Object.entries(s.journey?.recovered??{}))if(r.player&&s.players[r.player])rememberAcquisition(s,r.player,id,'preserved pre-update quest receipt');rememberInventory(s,samples);for(const p of names){const out=await this.execute(hunts.flatMap((h,i)=>[`scoreboard players add ${p} hh.got${i} 0`,`scoreboard players get ${p} hh.got${i}`]).join('\n'));for(const [i,h]of hunts.entries()){const matches=out.map(l=>l.match(new RegExp(p+' has (\\d+) \\[?hh\\.got'+i+'\\]?$'))).filter(Boolean);if(matches.length!==1)throw Error('Native acquisition receipt unreadable; datapack must be active');if(Number(matches[0][1])>0)rememberAcquisition(s,p,h.id,'native inventory_changed advancement');}}
 this.save(s);for(const p of names){if(alive[p]===false)continue;await deliverSpawnMap(s,p,(await this.observe())?.[p]??samples[p],sites.spawnMap,this);for(const plan of staleMapPlans(p,samples[p],sites))await this.execute(plan.command);
 for(const [i,h]of hunts.entries()){const inv=(await this.observe())?.[p];if(!inv)continue;const command=restorationPlan(s,p,h.id,inv,fragmentItem(i));if(!command)continue;const j=ensureJourney(s);j.itemRestorations??={};j.itemRestorations[p+':'+h.id]={status:'attempted',at:new Date().toISOString()};this.save(s);await this.execute(command);const after=(await this.observe())?.[p];if(after)rememberInventory(s,{[p]:after});j.itemRestorations[p+':'+h.id].status=after?.some(v=>v.components?.['minecraft:custom_data']?.hh_fragment===h.id)?'confirmed':'pending';this.save(s);}


 }
 }
}
