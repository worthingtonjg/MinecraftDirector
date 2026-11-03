import{Terrain}from './journey-terrain.mjs';
const t=new Terrain('server-26.3/hollow-harvest-opening/dimensions/minecraft/overworld/region'),nodes=new Map();
for(let x=-640;x<=640;x+=16)for(let z=-640;z<=640;z+=16){const p=t.top(x,z);if(p)nodes.set(x+','+z,p);}
const dry=p=>p&&p.y>=62&&!['minecraft:water','minecraft:lava','minecraft:seagrass','minecraft:kelp','minecraft:kelp_plant'].includes(p.block);
const seen=new Set(),groups=[];
for(const [k,p]of nodes){if(seen.has(k)||!dry(p))continue;const q=[p],group=[];seen.add(k);for(let i=0;i<q.length;i++){const n=q[i];group.push(n);for(const [dx,dz]of [[16,0],[-16,0],[0,16],[0,-16]]){const key=(n.x+dx)+','+(n.z+dz),v=nodes.get(key);if(!seen.has(key)&&dry(v)&&Math.abs(n.y-v.y)<12){seen.add(key);q.push(v);}}}groups.push(group);}
console.log(JSON.stringify({known:nodes.size,groups:groups.sort((a,b)=>b.length-a.length).slice(0,8).map(g=>({size:g.length,bounds:[Math.min(...g.map(p=>p.x)),Math.max(...g.map(p=>p.x)),Math.min(...g.map(p=>p.z)),Math.max(...g.map(p=>p.z))],candidates:g.filter(p=>{const d=Math.hypot(p.x-15,p.z+16);return d>=400&&d<=600&&['minecraft:grass_block','minecraft:stone'].includes(p.block);}).slice(0,15)}))}));
