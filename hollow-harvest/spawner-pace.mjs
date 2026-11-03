import {readBlock} from './retire-encounters.mjs';
import {passed} from './encounters.mjs';
import {hunts} from './journey.mjs';
export const pace={MinSpawnDelay:300,MaxSpawnDelay:400,SpawnCount:1,MaxNearbyEntities:3};
export function paceEligible(n,i){return n?.id==='minecraft:mob_spawner'&&n.SpawnData?.entity?.id==='minecraft:'+hunts[i].species&&n.RequiredPlayerRange===32&&n.SpawnRange===2&&((n.SpawnCount===2&&n.MaxNearbyEntities===6&&n.MinSpawnDelay===160&&n.MaxSpawnDelay===240)||Object.entries(pace).every(([k,v])=>n[k]===v));}
export async function retunePace(e,s){const results=[];try{for(const [i,p] of e.sites.entries()){
 if(!e.state.sites[i]?.ready)throw Error('Missing site ownership receipt');
 if(s.journey?.recovered?.[hunts[i].id]||s.journey?.siteGates?.[i]?.destroyed){results.push({site:i,status:'completed; untouched'});continue;}
 await e.ticket(p);const at=`${p.x} ${p.y+2} ${p.z}`;let loaded=false;for(let a=0;a<40;a++){if(passed(await e.execute(`execute if loaded ${at}`))){loaded=true;break;}await new Promise(r=>setTimeout(r,100));}if(!loaded)throw Error('Site unloaded; no change');
 if(passed(await e.execute(`execute if loaded ${at} unless block ${at} minecraft:spawner`))){results.push({site:i,status:'destroyed or replaced; untouched'});continue;}
 const n=readBlock(await e.execute('data get block '+at),p.x,p.y+2,p.z);if(!paceEligible(n,i))throw Error('Changed spawner preserved at site '+i);
 const guard={SpawnData:{entity:{id:n.SpawnData.entity.id}},RequiredPlayerRange:32,SpawnRange:2,...Object.fromEntries(Object.keys(pace).map(k=>[k,n[k]]))};
 const snbt=JSON.stringify(guard).replace(/("(?:RequiredPlayerRange|SpawnRange|MinSpawnDelay|MaxSpawnDelay|SpawnCount|MaxNearbyEntities)":)(\d+)/g,'$1$2s');
 await e.execute(`execute if loaded ${at} if block ${at} minecraft:spawner if data block ${at} ${snbt} run data merge block ${at} ${JSON.stringify(pace)}`);
 const after=readBlock(await e.execute('data get block '+at),p.x,p.y+2,p.z);if(!paceEligible(after,i)||!Object.entries(pace).every(([k,v])=>after[k]===v))throw Error('Spawner pace verification failed');results.push({site:i,status:'verified',pace});
 }return results;}finally{await e.release();}}
