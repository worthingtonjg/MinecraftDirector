import {passed,failed} from './encounters.mjs';
import {hunts,event,entitlement} from './journey.mjs';
export function finaleEligible(s){const j=s.journey;return !!j?.concurrent?.every((q,i)=>q.complete&&j.recovered[hunts[i].id])&&['finale','restoring'].includes(j.phase);}
export function validateFinale(p){if(!p||p.x!==-7||p.y!==77||p.z!==-199||p.block!=='minecraft:birch_planks'||!Number.isInteger(p.mapId)||p.mapId<0)throw Error('Unverified outpost finale');return p;}
export function finaleText(p){return `The System binds Ember, Wick and Flame into the Harvest Flame, a blue-flamed soul torch. Your final map reveals the Harvest Lantern on the pillager tower's upper deck. Free all three captive golems: their strength will help you take the outpost. The Harvest Lantern is on the upper deck at X ${p.x}, Y ${p.y}, Z ${p.z}. After every required rescue, carry one Harvest Flame in its own inventory slot, stand within four blocks of the Lantern and type /trigger hh.light. Do not place the quest torch as a block. Activation consumes it and brings dawn.`;}
export function rescueReady(s,p){return Array.isArray(p.rescues)&&p.rescues.length>0&&p.rescues.every(r=>s.journey.outpost?.rescued?.[r.uuid]?.confirmed===true);}
export class OutpostFinale{
 constructor(encounters,save){this.e=encounters;this.save=save;this.p=validateFinale(encounters.finale);}
 async prepare(s,names){if(!finaleEligible(s))return false;const p=this.p,j=s.journey,o=j.outpost??={rescued:{}};
 if(!o.ready){try{await this.e.ticket(p);const at=`${p.x} ${p.y} ${p.z}`;
 if(!o.attempted){const guard=`execute in minecraft:overworld if block ${p.x} ${p.y-1} ${p.z} ${p.block} if block ${p.x+1} ${p.y-1} ${p.z} ${p.block} if block ${at} minecraft:air if block ${p.x} ${p.y+1} ${p.z} minecraft:air if block ${p.x+1} ${p.y} ${p.z} minecraft:air positioned ${at} unless entity @e[distance=..1.5]`;
 if(!passed(await this.e.execute(guard))){o.blocked='Upper deck occupied or changed; placement deferred';this.save(s);return false;}
 o.attempted=true;this.save(s);const out=await this.e.execute(guard+` run setblock ${at} minecraft:carved_pumpkin keep`);if(failed(out))throw Error('Outpost lantern placement rejected');}
 if(!passed(await this.e.execute(`execute in minecraft:overworld if block ${at} minecraft:carved_pumpkin`))){o.blocked='Lantern placement unconfirmed; inspect before retry';this.save(s);return false;}
 o.ready=true;delete o.blocked;this.save(s);
 }finally{await this.e.release();}}
 for(const name of names){entitlement(s,'finalmap:'+name,name,'finalMap');entitlement(s,'flame:'+name,name,'flame');}event(s,'outpost_finale_open',finaleText(p),names);this.save(s);return true;
 }
 async retireOldMarker(){const e=this.e;if(!e.state.lantern||e.state.oldLanternRetired)return;const p={x:2,y:63,z:-29};try{await e.ticket(p);if(!passed(await e.execute('execute in minecraft:overworld if block 2 63 -29 minecraft:carved_pumpkin')))return;await e.execute('execute in minecraft:overworld if block 2 63 -29 minecraft:carved_pumpkin run setblock 2 63 -29 minecraft:pumpkin');if(passed(await e.execute('execute in minecraft:overworld if block 2 63 -29 minecraft:pumpkin'))){e.state.oldLanternRetired=true;e.save();}}finally{await e.release();}}
}
