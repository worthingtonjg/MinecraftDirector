import {parseSnbt,onlineNames} from '../inventory.mjs';
export const deathObjective='hh.deaths';
const dimensions={'minecraft:overworld':[-64,319],'minecraft:the_nether':[0,255],'minecraft:the_end':[0,255]};
export function location(value){if(!value||typeof value.dimension!=='string'||!Array.isArray(value.pos)||value.pos.length!==3||value.pos.some(n=>!Number.isInteger(n)||Math.abs(n)>30000000))throw Error('Invalid death location');return {dimension:value.dimension,pos:[...value.pos]};}
export function observation(output,player){
 onlineNames([player]);const clean=output.map(l=>l.replace(/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?/,''));
 const scores=clean.map(l=>l.match(new RegExp('^'+player+' has (\\d+) \\[?hh\\.deaths\\]?$'))).filter(Boolean).map(m=>Number(m[1]));
 if(scores.length!==2||scores[0]!==scores[1])throw Error('Death counter changed or was unreadable during observation');
 const data=clean.filter(l=>l.startsWith(player+' has the following entity data: ')).map(l=>parseSnbt(l.slice((player+' has the following entity data: ').length)));
 const health=data.filter(v=>typeof v==='number');const places=data.filter(v=>v&&typeof v==='object');
 if(health.length!==1||places.length>1||(!places.length&&!clean.some(l=>l.includes('Found no elements matching LastDeathLocation'))))throw Error('Death/health observation incomplete');
 return {counter:scores[0],health:health[0],location:places.length?location(places[0]):null};
}
export function remember(state,player,obs){
 state.deathCounters??={};state.deaths??={};state.deathReceipts??={};
 if(obs.counter<(state.deathCounters[player]??0))throw Error('Death counter decreased; marker tracking requires inspection');
 state.deathCounters[player]=obs.counter;if(!obs.location)return null;
 const loc=location(obs.location);const id=[player,obs.counter,loc.dimension,...loc.pos].join(':');
 if(!state.deathReceipts[id]){state.deathReceipts[id]={id,player,counter:obs.counter,...loc,status:'pending',placed:[]};state.deaths[player]=id;state.revision++;}
 return state.deathReceipts[id];
}
export function candidates(record){const bounds=dimensions[record.dimension];const [x,y,z]=record.pos;if(!bounds||y<=bounds[0]||y>=bounds[1]-1||Math.abs(x)>29999980||Math.abs(z)>29999980)return [];return [[2,0],[0,2],[-2,0],[0,-2]].map(([dx,dz])=>({x:x+dx,y,z:z+dz}));}
const support=['grass_block','dirt','stone','sand','netherrack','end_stone'];
function checks(record,p){if(!candidates(record).some(c=>c.x===p.x&&c.y===p.y&&c.z===p.z))throw Error('Outside death marker ring');return support.map(block=>`execute in ${record.dimension} positioned ${p.x} ${p.y} ${p.z} if block ~ ~-1 ~ minecraft:${block} if block ~ ~1 ~ minecraft:air unless entity @e[type=minecraft:item,distance=..1.5] unless entity @e[distance=..1] if block ~ ~ ~ minecraft:air`);}
export async function mark(state,record,{execute,save}){
 if(record.status!=='pending')return;
 record.status='attempted';save(state); // No repeated placement after interrupted/uncertain delivery.
 try{
  const sites=candidates(record);const [x,y,z]=record.pos;
  const center=sites.length?await execute(`execute in ${record.dimension} if block ${x} ${y} ${z} minecraft:air`):[];
  if(!center.some(l=>l.includes('Test passed'))){record.status='coordinates_only';record.reason='Unsafe, unsupported or unloaded death position';save(state);return;}
  for(const p of sites){const guards=checks(record,p);const inspected=await execute(guards.join('\n'));if(!inspected.some(l=>l.includes('Test passed')))continue;
   await execute(guards.map(c=>c+' run setblock ~ ~ ~ minecraft:jack_o_lantern keep').join('\n'));
   const verified=await execute(`execute in ${record.dimension} if block ${p.x} ${p.y} ${p.z} minecraft:jack_o_lantern`);
   if(verified.some(l=>l.includes('Test passed')))record.placed.push(p);save(state);
  }
  record.status=record.placed.length?'marked':'coordinates_only';record.reason=record.placed.length?null:'No safe empty supported positions; nearby items and blocks preserved';save(state);
 }catch(e){record.status='uncertain';record.reason=e.message;save(state);}
 finally{state.revision++;save(state);}
}
export class DeathTracker {
 constructor({execute,save,exists=false,safe=true}){this.execute=execute;this.save=save;this.exists=exists;this.safe=safe;this.status={active:false,error:null};}
 async check(state,names){const alive={};try{
  if(!this.safe)throw Error('Death scoreboard conflict; existing objective preserved');
  if(!this.exists){const output=await this.execute(`scoreboard objectives add ${deathObjective} deathCount`);if(!output.some(l=>l.includes('Created new objective')))throw Error('Death counter creation unconfirmed');this.exists=true;}
  for(const p of onlineNames(names)){
   const get=`scoreboard players get ${p} ${deathObjective}`;
   const output=await this.execute([`scoreboard players add ${p} ${deathObjective} 0`,get,`data get entity ${p} LastDeathLocation`,`data get entity ${p} Health`,get].join('\n'));
   const obs=observation(output,p);alive[p]=obs.health>0;remember(state,p,obs);this.save(state);
  }
  // One pending ring per check keeps control responsive without repeating a death.
  const pending=Object.values(state.deathReceipts??{}).find(r=>r.status==='pending'&&alive[r.player]);if(pending)await mark(state,pending,{execute:this.execute,save:this.save});
  this.status={active:true,error:null};
 }catch(e){this.status={active:false,error:e.message};for(const p of names)alive[p]=false;}return alive;}
}
