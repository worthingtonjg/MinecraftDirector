import{SpawnerGate}from'./spawner-gate.mjs';
import {requestFlameActivation} from './harvest-flame.mjs';
import {pollRescues} from './rescue.mjs';
import {OutpostFinale,finaleEligible,rescueReady} from './outpost-finale.mjs';
import {concurrent,updateConcurrent,collectConcurrent} from './concurrent-hunts.mjs';
import {systemChat} from './system-chat.mjs';
import {rememberAcquisition} from './relocation.mjs';
import {hunts,huntObjective,ensureJourney,event,entitlement,finaleRewards,updateHunt,deliveryPlan,owns,recoverFragment,journeyCampaign,lantern} from './journey.mjs';
import {fragmentItem,passed,failed} from './encounters.mjs';
import {slotName} from './books.mjs';
export class JourneyController {
 constructor({execute,observe,save,encounters,safe=true,bountyCheck=async()=>{}}){this.bountyCheck=bountyCheck;this.execute=execute;this.observe=observe;this.save=save;this.encounters=encounters;this.safe=safe;this.initialized=false;this.gate=new SpawnerGate(encounters,save);this.outpost=encounters.finale?new OutpostFinale(encounters,save):null;this.error=null;this.lastCheck=null;}
 async counters(names,index){const objective=huntObjective(index);const output=await this.execute(names.flatMap(p=>[`scoreboard players add ${p} ${objective} 0`,`scoreboard players get ${p} ${objective}`]).join('\n'));const out={};for(const p of names){const matches=output.map(l=>l.match(new RegExp(p+' has (\\d+) \\[?'+objective.replace('.','\\.')+'\\]?$'))).filter(Boolean);if(matches.length!==1)throw Error('Kill score unreadable '+p);out[p]=Number(matches[0][1]);}return out;}
 async init(s){if(this.initialized)return;if(!this.safe)throw Error('Hunt scoreboard conflict; existing objectives preserved');const out=await this.execute(hunts.map((h,i)=>`scoreboard objectives add ${huntObjective(i)} minecraft.killed:minecraft.${h.species}`).join('\n'));if(out.some(l=>/Unknown|Incorrect argument|Invalid/.test(l)))throw Error('Hunt criteria rejected');this.save(s);this.initialized=true;}
 async tick(s,samples,alive){const bountyNames=Object.keys(samples).filter(p=>alive[p]!==false);await this.bountyCheck(s,bountyNames);await this.deliverItems(s,bountyNames,['creeperApple']);await this.deliverBountyMessages(s,bountyNames);await this.gate.tick(s,Object.keys(samples).filter(p=>alive[p]!==false));if(this.encounters.state.gateEdition===1)await this.deliverMessages(s,Object.keys(samples).filter(p=>alive[p]!==false));if(this.encounters.finale?.rescues)await pollRescues(s,this.encounters.finale.rescues,this.execute,this.save);if(s.step<2)return;
 const preparationNames=Object.keys(samples).filter(p=>alive[p]!==false);
 for(const p of preparationNames){entitlement(s,'bed:'+p,p,'bed');if(s.done['furnace:furnace']){entitlement(s,'fishingRod:'+p,p,'fishingRod');entitlement(s,'boat:'+p,p,'boat');}}
 if(s.step<4){if(!preparationNames.length)return;event(s,'bed_reward_unlocked','Stone tools secured! You earned an orange bed. Free one inventory slot, then place and use it to set your respawn point. Follow the current objectives for your next preparations.',preparationNames);this.save(s);await this.deliverItems(s,preparationNames,['bed','fishingRod','boat']);await this.deliverMessages(s,preparationNames);this.lastCheck=new Date().toISOString();return;}
 if(!this.encounters.state.ready)return;await this.init(s);const j=concurrent(s),names=Object.keys(samples).filter(p=>alive[p]!==false);
 if(!names.length){for(const q of j.concurrent)q.present=[];this.save(s);return;}
 for(const p of names){entitlement(s,'bed:'+p,p,'bed');entitlement(s,'shield:'+p,p,'shield');}
 event(s,'shield_reward_unlocked','Food and torches secured! You earned Lantern Keeper\u2019s Guard, a shield for the road ahead. Free one inventory slot to receive it.',names);
 if(['beds','hunts'].includes(j.phase)){
 const scores={};for(let i=0;i<3;i++)if(!j.concurrent[i].complete)scores[i]=await this.counters(names,i);
 updateConcurrent(s,names,scores);
 }
 for(let i=0;i<3;i++)if(j.concurrent[i].complete)for(const p of names)entitlement(s,`map:${i}:${p}`,p,'map',i);
 finaleRewards(s);this.save(s);await this.deliverItems(s,names);
 if(this.encounters.state.gateEdition!==1&&j.phase==='hunts')for(let i=0;i<3;i++)if(j.concurrent[i].complete&&!j.recovered[hunts[i].id])await this.recovery(s,samples,names,i);
 for(const i of collectConcurrent(s,samples,names)){this.save(s);const p=this.encounters.sites[i];if(this.encounters.state.gateEdition!==1)await this.execute(`execute in minecraft:overworld if block ${p.x} ${p.y+2} ${p.z} minecraft:spawner run setblock ${p.x} ${p.y+2} ${p.z} minecraft:air`);}
 if(j.phase==='finale'||j.phase==='restoring'){if(this.outpost){await this.outpost.prepare(s,names);await this.deliverItems(s,names,['finalMap','flame']);}await this.finale(s,names);}
 await this.deliverMessages(s,names);j.lastCheck=this.lastCheck=new Date().toISOString();this.save(s);
 }
 async deliverItems(s,names,kinds=null){const j=ensureJourney(s);
 for(const r of Object.values(j.receipts)){
  if(j.phase==='done'&&['flame','finalMap'].includes(r.kind))continue;
  if(r.kind==='flame'&&j.outpost?.activation)continue;
  if(!names.includes(r.player)||(kinds&&!kinds.includes(r.kind)))continue;
  if(r.status==='confirmed'&&(!['map','finalMap','flame'].includes(r.kind)||j.phase==='done'))continue;
  // Observe immediately before each item; another reward/book may have filled the slot.
  const fresh=await this.observe();if(!fresh?.[r.player])continue;const plan=deliveryPlan(r,fresh[r.player],this.encounters.sites);
  if(plan.kind==='confirmed'){r.status='confirmed';delete r.notice;this.save(s);continue;}
  if(plan.kind==='full'){r.notice='Free one inventory slot for earned '+r.kind;this.save(s);continue;}
  if(plan.kind!=='issue')continue;r.status='attempted';r.slot=plan.slot;this.save(s);
  const output=await this.execute(plan.command);const after=await this.observe();if(after?.[r.player]?.some(i=>owns(i,r.player,r.key))){r.status='confirmed';delete r.notice;}else if(output.some(l=>/Test failed/.test(l))&&!failed(output)){r.status='pending';r.notice='Inventory changed; delivery deferred';}else{r.status='uncertain';r.notice='Delivery unconfirmed; no blind resend';}this.save(s);
 }
 }
 async deliverBountyMessages(s,names){for(const r of Object.values(ensureJourney(s).receipts)){if(r.kind!=='creeperApple'||r.status!=='confirmed'||r.bountyMessage||!names.includes(r.player))continue;r.bountyMessage='attempted';this.save(s);await this.execute(systemChat(r.player,'[System] Creeper bounty paid: one golden apple. All hiss, no encore!'));r.bountyMessage='sent';this.save(s);}}
 async deliverMessages(s,names){const j=ensureJourney(s);
 for(const d of Object.values(j.deliveries)){if(d.status!=='pending'||!names.includes(d.player))continue;d.status='attempted';this.save(s);await this.execute(systemChat(d.player,'[System] '+d.text));d.status='sent';this.save(s);}
 }
 async recovery(s,samples,names,index){const j=s.journey,p=this.encounters.sites[index];
 // A lost/destroyed fragment can be reclaimed only at its defeated encounter. No other items touched.
 for(const name of names){const check=await this.execute(`execute in minecraft:overworld positioned ${p.x} ${p.y} ${p.z} if entity @a[name=${name},distance=..6] unless block ${p.x} ${p.y+2} ${p.z} minecraft:spawner unless entity @e[type=minecraft:item,distance=..32,nbt={Item:{components:{"minecraft:custom_data":{hh_fragment:"${hunts[index].id}"}}}}]`);if(!passed(check))continue;
  const chest=await this.execute(`execute unless block ${p.x} ${p.y} ${p.z} minecraft:chest\nexecute if block ${p.x} ${p.y} ${p.z} minecraft:chest unless data block ${p.x} ${p.y} ${p.z} Items[{components:{"minecraft:custom_data":{hh_fragment:"${hunts[index].id}"}}}]`);if(!passed(chest))continue;
  // The verified defeated site, not an item transfer, is the durable recovery receipt.
  // A full inventory or a second death cannot erase this recovery.
  rememberAcquisition(s,name,hunts[index].id,'defeated encounter with missing fragment');this.save(s);
  this.save(s);break;
 }
 }
 async finale(s,names){const j=s.journey;if(Object.keys(j.recovered).length!==3)return;if(this.outpost&&(!finaleEligible(s)||!j.outpost?.ready))return;const {x,y,z}=this.encounters.finale??lantern;if(j.phase==='finale'){
 if(this.outpost){if(!await requestFlameActivation(s,names,this,this.encounters.finale,rescueReady(s,this.encounters.finale)))return;}else{const ok=await this.execute(`execute in minecraft:overworld if block ${x} ${y} ${z} minecraft:carved_pumpkin if block ${x+1} ${y} ${z} minecraft:torch positioned ${x} ${y} ${z} if entity @a[distance=..8]`);if(!passed(ok))return;}j.phase='restoring';this.save(s);
 }
 const output=await this.execute(`execute in minecraft:overworld if block ${x} ${y} ${z} minecraft:carved_pumpkin run setblock ${x} ${y} ${z} minecraft:jack_o_lantern\ntime set day\ngamerule minecraft:advance_time true\ngamerule minecraft:players_sleeping_percentage 100`);
 if(failed(output)||!output.some(l=>l.includes('advance_time')&&l.includes('true')))throw Error('Final dawn settings unconfirmed');s.curse={active:false,finalLanternRestored:true};j.phase='done';for(const r of Object.values(j.recovered))r.consumed=true;for(const p of Object.keys(s.players))s.players[p].level=3;finaleRewards(s);event(s,'dawn','The Harvest Flame burns. Dawn returns. You have broken the Hollow Harvest. This chapter is complete, but your story is yours to write. Your one-time reward is Dawnbreaker, a diamond sword with Sharpness II and Unbreaking I. Free one slot to receive it; keep building and exploring.',names);this.save(s);await this.deliverItems(s,names,['dawnbreaker']);
 }
}
