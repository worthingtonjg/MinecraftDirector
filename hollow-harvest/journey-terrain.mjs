import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {readNbt} from './terrain-nbt.mjs';
export class Terrain {
 constructor(dir){this.dir=dir;this.regions=new Map();this.chunks=new Map();}
 chunk(cx,cz){const key=cx+','+cz;if(this.chunks.has(key))return this.chunks.get(key);const file=`${this.dir}/r.${Math.floor(cx/32)}.${Math.floor(cz/32)}.mca`;let r=this.regions.get(file);if(!r){try{r=readFileSync(file);}catch{return null;}this.regions.set(file,r);}const off=r.readUIntBE(((cx&31)+(cz&31)*32)*4,3)*4096;if(!off)return null;if(r[off+4]!==2)throw Error('Unsupported region compression');const n=readNbt(inflateSync(r.subarray(off+5,off+4+r.readUInt32BE(off))));if(n.Status!=='minecraft:full'&&n.Status!=='full')return null;this.chunks.set(key,n);return n;}
 block(x,y,z){const n=this.chunk(Math.floor(x/16),Math.floor(z/16));if(!n)return null;const s=n.sections.find(s=>s.Y===Math.floor(y/16));if(!s?.block_states)return 'minecraft:air';const {palette,data}=s.block_states;const name=p=>typeof p==='string'?p.split('[')[0]:(p.Name??p.id??p['']);if(palette.length===1)return name(palette[0]);const bits=Math.max(4,Math.ceil(Math.log2(palette.length))),per=Math.floor(64/bits),i=(y&15)*256+(z&15)*16+(x&15);return name(palette[Number(BigInt.asUintN(64,BigInt(data[Math.floor(i/per)]))>>BigInt(i%per*bits)&((1n<<BigInt(bits))-1n))]);}
 top(x,z){if(!this.chunk(Math.floor(x/16),Math.floor(z/16)))return null;for(let y=220;y>=50;y--){const b=this.block(x,y,z);if(!['minecraft:air','minecraft:cave_air'].includes(b))return {x,y,z,block:b};}return null;}
}
if(process.argv[1]?.endsWith('journey-terrain.mjs')){
 const t=new Terrain('server-26.3/hollow-harvest-opening/dimensions/minecraft/overworld/region');const candidates=[];
 const natural=new Set(['air','cave_air','grass_block','dirt','stone','sand','gravel','short_grass','tall_grass','fern','oak_log','oak_leaves','birch_log','birch_leaves','water','seagrass','dandelion','poppy','granite','diorite','andesite'].map(x=>'minecraft:'+x));
 for(let x=-430;x<=430;x+=8)for(let z=-430;z<=430;z+=8){if(Math.hypot(x-15,z+16)<220||Math.hypot(x-130,z+150)<120)continue;const p=t.top(x,z);if(!p||!['minecraft:grass_block','minecraft:stone','minecraft:sand'].includes(p.block))continue;let safe=true;for(let dx=-3;dx<=3&&safe;dx++)for(let dz=-3;dz<=3&&safe;dz++)for(let dy=0;dy<=4;dy++){const b=t.block(x+dx,p.y+dy,z+dz);if(!natural.has(b)){safe=false;break;}}if(!safe)continue;
 // Chest, spawner, approach and two lamps all require empty headroom and natural support.
 if([[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0]].every(([dx,dz])=>['minecraft:grass_block','minecraft:stone','minecraft:sand','minecraft:dirt'].includes(t.block(x+dx,p.y,z+dz))&&[1,2,3].every(dy=>t.block(x+dx,p.y+dy,z+dz)==='minecraft:air')))candidates.push({...p,y:p.y+1});
 }
 const targets=[[-230,-120],[300,80],[-70,300]];const chosen=[];for(const [tx,tz]of targets){const c=candidates.filter(p=>chosen.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>200)).sort((a,b)=>Math.hypot(a.x-tx,a.z-tz)-Math.hypot(b.x-tx,b.z-tz))[0];if(!c)throw Error('No safe generated site');chosen.push(c);}writeFileSync('journey-sites.local.json',JSON.stringify(chosen,null,2));console.log(JSON.stringify({candidates:candidates.length,chosen,cachedChunks:t.chunks.size}));
}
