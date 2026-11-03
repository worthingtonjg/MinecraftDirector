import {Terrain} from './journey-terrain.mjs';import {writeFileSync}from'node:fs';
const t=new Terrain('server-26.3/hollow-harvest-opening/dimensions/minecraft/overworld/region'),nodes=new Map();const dry=p=>p&&p.y>=62&&!/water|lava|kelp|seagrass/.test(p.block);
for(let x=-624;x<=624;x+=16)for(let z=-624;z<=624;z+=16){const p=t.top(x,z);if(dry(p))nodes.set(x+','+z,p);}
const start=[...nodes.values()].sort((a,b)=>Math.hypot(a.x-15,a.z+16)-Math.hypot(b.x-15,b.z+16))[0],q=[start],parents=new Map([[start.x+','+start.z,null]]);
for(let i=0;i<q.length;i++){const p=q[i];for(const [dx,dz]of [[16,0],[-16,0],[0,16],[0,-16]]){const k=(p.x+dx)+','+(p.z+dz),n=nodes.get(k);if(n&&!parents.has(k)){parents.set(k,p.x+','+p.z);q.push(n);}}}
const natural=new Set(['minecraft:grass_block','minecraft:dirt','minecraft:stone','minecraft:sand','minecraft:gravel']),candidates=[];
for(let x=-608;x<=608;x+=2)for(let z=-608;z<=608;z+=2){const d=Math.hypot(x-15,z+16);if(d<400||d>600||!parents.has(Math.round(x/16)*16+','+Math.round(z/16)*16))continue;const p=t.top(x,z);if(!p||!['minecraft:grass_block','minecraft:stone'].includes(p.block))continue;
if(![[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0]].every(([dx,dz])=>natural.has(t.block(x+dx,p.y,z+dz))&&[1,2,3].every(dy=>t.block(x+dx,p.y+dy,z+dz)==='minecraft:air')))continue;
let safe=true;for(let dx=-32;dx<=32&&safe;dx+=8)for(let dz=-32;dz<=32;dz+=8)if(!dry(t.top(x+dx,z+dz))){safe=false;break;}if(!safe)continue;
candidates.push({...p,y:p.y+1,distance:Math.round(d),drySamples:81,total:81});}
writeFileSync('fresh-candidate-diagnostics.local.json',JSON.stringify({connected:q,candidates},null,2));const selected=[];for(const [tx,tz]of [[0,-496],[246,-408],[488,18]]){const p=candidates.filter(p=>p.y<90&&selected.every(v=>Math.hypot(v.x-p.x,v.z-p.z)>=250)).sort((a,b)=>Math.hypot(a.x-tx,a.z-tz)-Math.hypot(b.x-tx,b.z-tz))[0];if(!p)throw Error('No three mainland candidates: connected='+q.length+' candidates='+candidates.length);const route=[];let key=Math.round(p.x/16)*16+','+Math.round(p.z/16)*16;while(key){route.push(nodes.get(key));key=parents.get(key);}selected.push({...p,route:route.reverse()});}
writeFileSync('fresh-mainland-sites.local.json',JSON.stringify(selected,null,2));console.log(JSON.stringify({connectedDrySamples:q.length,candidates:candidates.length,sites:selected.map(({route,...p})=>({...p,routeSamples:route.length}))}));
