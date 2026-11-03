import {guardSpecies,validateRelocation} from './relocation.mjs';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {hunts,journeyCampaign,lantern} from './journey.mjs';
export const passed=lines=>lines.some(l=>l.endsWith('Test passed'));
export const failed=lines=>lines.some(l=>/Unknown|Incorrect argument|Expected|Invalid|Failed to parse|Unable to/.test(l));
export const fragmentItem=i=>`minecraft:amethyst_shard[minecraft:custom_name=${JSON.stringify({text:['Ember','Wick','Flame'][i]+' Fragment',italic:false,color:'gold'})},minecraft:custom_data=${JSON.stringify({hh_campaign:journeyCampaign,hh_fragment:hunts[i].id})}]`;
export function validateSites(plan){if(plan?.version===2)return validateRelocation(plan.sites,plan.preserved??[]);if(plan?.version!==1||plan.sites?.length!==3)throw Error('Three verified sites required');for(const [i,p]of plan.sites.entries()){if(p.index!==i||!Number.isInteger(p.mapId)||p.mapId<0||!['x','y','z'].every(k=>Number.isInteger(p[k]))||Math.abs(p.x)>450||Math.abs(p.z)>450||p.y<55||p.y>150||Math.hypot(p.x-15,p.z+16)<200)throw Error('Encounter outside approved bounds');}return plan.sites;}
export class Encounters {
 constructor({execute,plan,file}){this.execute=execute;this.sites=validateSites(plan);this.finale=plan.finale;this.sites.finale=plan.finale;this.file=file;this.state=existsSync(file)?JSON.parse(readFileSync(file)):{version:1,gateEdition:1,sites:{},tickets:[],ready:false};}
 save(){writeFileSync(this.file+'.tmp',JSON.stringify(this.state,null,2));renameSync(this.file+'.tmp',this.file);}
 async ticket(p){const q=await this.execute(`forceload query ${p.x} ${p.z}`);if(q.some(l=>/marked for force loading/.test(l)&&!/not marked/.test(l)))return;if(!q.some(l=>/not marked for force loading/.test(l)))throw Error('Chunk ticket query unconfirmed');if(!this.state.tickets.some(t=>t.x===p.x&&t.z===p.z)){this.state.tickets.push({x:p.x,z:p.z});this.save();}const add=await this.execute(`forceload add ${p.x} ${p.z}`);if(!add.some(l=>/Marked chunk|already marked/.test(l)))throw Error('Chunk load unconfirmed');}
 async release(){for(const p of [...this.state.tickets]){await this.execute(`forceload remove ${p.x} ${p.z}`);const q=await this.execute(`forceload query ${p.x} ${p.z}`);if(!q.some(l=>/not marked/.test(l)))throw Error('Temporary ticket release unconfirmed');this.state.tickets=this.state.tickets.filter(t=>t.x!==p.x||t.z!==p.z);this.save();}}
 async deploy(){try{for(const [i,p]of this.sites.entries()){
  await this.ticket(p);if(this.state.sites[i]?.ready)continue;const {x,y,z}=p;
  const guard=`execute in minecraft:overworld if block ${x} ${y-1} ${z} ${p.block} if block ${x} ${y} ${z} minecraft:air if block ${x} ${y+1} ${z} minecraft:air if block ${x} ${y+2} ${z} minecraft:air unless entity @e[x=${x},y=${y},z=${z},distance=..4]`;
  if(!this.state.sites[i]){if(!passed(await this.execute(guard)))throw Error('Site no longer empty: '+i);this.state.sites[i]={status:'attempted'};this.save();
   const chest=`minecraft:chest{CustomName:${JSON.stringify(JSON.stringify({text:hunts[i].title+' — Fragment Reliquary'}))}}`;
   const spawner=`minecraft:spawner{SpawnData:{entity:{id:"minecraft:${guardSpecies[i]}"},custom_spawn_rules:{block_light_limit:{min_inclusive:0,max_inclusive:15},sky_light_limit:{min_inclusive:0,max_inclusive:15}}},Delay:20s,MinSpawnDelay:300s,MaxSpawnDelay:400s,SpawnCount:1s,MaxNearbyEntities:3s,RequiredPlayerRange:32s,SpawnRange:2s}`;
   const output=await this.execute([guard+` run setblock ${x} ${y+2} ${z} ${spawner} keep`,...[-2,2].map(dx=>`execute if block ${x+dx} ${y-1} ${z} ${p.block} if block ${x+dx} ${y} ${z} minecraft:air run setblock ${x+dx} ${y} ${z} minecraft:jack_o_lantern keep`)].join('\n'));this.state.sites[i].output=output;this.save();if(failed(output))throw Error('Encounter command rejected');
  }
  const out=await this.execute(`data get block ${x} ${y} ${z}\ndata get block ${x} ${y+2} ${z}\nexecute if block ${x} ${y+1} ${z} minecraft:air`);
  if(!out.some(l=>l.includes('SpawnCount: 1s')&&l.includes('MaxNearbyEntities: 3s')&&l.includes(guardSpecies[i]))||!passed(out))throw Error('Encounter verification failed '+i);
  this.state.sites[i]={...this.state.sites[i],ready:true,verified:out};this.save();
 }
 // Reuse only the recorded pumpkin we placed, and preserve the neighboring torch cell.
 if(!this.finale){await this.ticket(lantern);const {x,y,z}=lantern;
 if(!this.state.lantern){const ok=await this.execute(`execute if block ${x} ${y} ${z} minecraft:pumpkin if block ${x+1} ${y} ${z} minecraft:air if block ${x+1} ${y-1} ${z} minecraft:grass_block`);if(!passed(ok))throw Error('Final lantern site changed; inspect before deployment');await this.execute(`execute if block ${x} ${y} ${z} minecraft:pumpkin run setblock ${x} ${y} ${z} minecraft:carved_pumpkin`);this.state.lantern=passed(await this.execute(`execute if block ${x} ${y} ${z} minecraft:carved_pumpkin`));this.save();}
 }
 this.state.ready=Object.values(this.state.sites).filter(x=>x.ready).length===3&&!!(this.finale||this.state.lantern);this.save();return this.state;
 }finally{await this.release();}}
}

