import{Terrain}from './journey-terrain.mjs';import{writeFileSync}from'node:fs';
const t=new Terrain('server-26.3/hollow-harvest-opening/dimensions/minecraft/overworld/region'),out=[];
for(let x=-150;x<=370;x+=2)for(let z=-400;z<=100;z+=2){const d=Math.hypot(x-15,z+16);if(d<400||d>560)continue;const p=t.top(x,z);if(!p||p.block!=='minecraft:grass_block')continue;
if(![[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0]].every(([dx,dz])=>['minecraft:grass_block','minecraft:dirt','minecraft:stone'].includes(t.block(x+dx,p.y,z+dz))&&[1,2,3].every(dy=>t.block(x+dx,p.y+dy,z+dz)==='minecraft:air')))continue;
let dry=0,total=0,unknown=0;for(let dx=-32;dx<=32;dx+=8)for(let dz=-32;dz<=32;dz+=8){total++;const n=t.top(x+dx,z+dz);if(!n){unknown++;continue;}if(n.y>=62&&!/water|lava|kelp|seagrass/.test(n.block))dry++;}
if(dry/total<.9||unknown)continue;out.push({...p,y:p.y+1,distance:Math.round(d),drySamples:dry,total});}
out.sort((a,b)=>Math.abs(a.distance-500)-Math.abs(b.distance-500));writeFileSync('mainland-candidates.local.json',JSON.stringify(out.slice(0,20),null,2));console.log(JSON.stringify({count:out.length,candidates:out.slice(0,5)}));
