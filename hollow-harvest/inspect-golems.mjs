import{readFileSync,readdirSync,writeFileSync}from'node:fs';import{inflateSync}from'node:zlib';import{readNbt}from'./terrain-nbt.mjs';
const dir='server-26.3/hollow-harvest-opening/dimensions/minecraft/overworld/entities',found=[];
for(const file of readdirSync(dir).filter(f=>f.endsWith('.mca'))){const b=readFileSync(dir+'/'+file);for(let i=0;i<1024;i++){const off=b.readUIntBE(i*4,3)*4096;if(!off||b[off+4]!==2)continue;const n=readNbt(inflateSync(b.subarray(off+5,off+4+b.readUInt32BE(off))));for(const e of n.Entities??[])if(e.id==='minecraft:iron_golem')found.push({file,UUID:e.UUID,Pos:e.Pos,Health:e.Health,DeathTime:e.DeathTime});}}
writeFileSync('golem-inspection.local.json',JSON.stringify(found,null,2));console.log(JSON.stringify(found));
