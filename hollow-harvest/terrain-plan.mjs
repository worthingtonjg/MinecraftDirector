import {readFileSync,writeFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {readNbt} from './terrain-nbt.mjs';
const region=readFileSync('server-26.3/hollow-harvest-opening/dimensions/minecraft/overworld/region/r.0.-1.mca');
const cache=new Map();const name=p=>typeof p==='string'?p.split('[')[0]:(p.Name??p.id??p['']);
function chunk(cx,cz){const key=cx+','+cz;if(cache.has(key))return cache.get(key);const index=(cx&31)+(cz&31)*32;const offset=region.readUIntBE(index*4,3)*4096;if(!offset)throw Error('Chunk missing');const size=region.readUInt32BE(offset);if(region[offset+4]!==2)throw Error('Unexpected compression');const n=readNbt(inflateSync(region.subarray(offset+5,offset+4+size)));cache.set(key,n);return n;}
function block(x,y,z){const n=chunk(Math.floor(x/16),Math.floor(z/16));const section=n.sections.find(s=>s.Y===Math.floor(y/16));if(!section?.block_states)return 'minecraft:air';const {palette,data}=section.block_states;if(palette.length===1)return name(palette[0]);const bits=Math.max(4,Math.ceil(Math.log2(palette.length))),per=Math.floor(64/bits),index=(y&15)*256+(z&15)*16+(x&15);const value=BigInt.asUintN(64,BigInt(data[Math.floor(index/per)]));return name(palette[Number(value>>BigInt((index%per)*bits)&((1n<<BigInt(bits))-1n))]);}
const natural=new Set(['minecraft:air','minecraft:cave_air','minecraft:grass_block','minecraft:dirt','minecraft:stone','minecraft:sand','minecraft:gravel','minecraft:short_grass','minecraft:tall_grass','minecraft:fern','minecraft:oak_log','minecraft:oak_leaves','minecraft:birch_log','minecraft:birch_leaves','minecraft:water','minecraft:seagrass','minecraft:dandelion','minecraft:poppy']);
const candidates=[],tops={};
for(let x=2;x<=29;x++)for(let z=-30;z<=-3;z++){
 let y=100;while(y>50&&['minecraft:air','minecraft:cave_air'].includes(block(x,y,z)))y--;
 const top=block(x,y,z);tops[top]=(tops[top]??0)+1;
 if(top!=='minecraft:grass_block'&&top!=='minecraft:sand')continue;
 if(block(x,y+1,z)!=='minecraft:air'||block(x,y+2,z)!=='minecraft:air')continue;
 let safe=true;for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-1;dy<=3;dy++)if(!natural.has(block(x+dx,y+dy,z+dz)))safe=false;
 if(safe&&!candidates.some(c=>(c.x-x)**2+(c.z-z)**2<16))candidates.push({x,y:y+1,z,ground:top});
}
const selected=candidates.slice(0,24);writeFileSync('decoration-plan.local.json',JSON.stringify(selected,null,2));console.log(JSON.stringify({topBlocks:tops,selected}));




