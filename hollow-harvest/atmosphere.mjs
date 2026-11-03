// Fixed ring around the saved Halloween spawn (15, 63, -16), never Camp Lantern.
export const sites=[];
for(const dx of [-12,-6,0,6,12])for(const dz of [-12,12])sites.push({x:15+dx,z:-16+dz});
for(const dx of [-12,12])for(const dz of [-6,0,6])sites.push({x:15+dx,z:-16+dz});
export function guard(site){
 if(!sites.some(s=>s.x===site.x&&s.z===site.z))throw Error('Outside approved spawn ring');
 let c=`execute in minecraft:overworld positioned ${site.x} 0 ${site.z} positioned over motion_blocking_no_leaves`;
 c+=' if block ~ ~-1 ~ minecraft:grass_block';
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)for(let y=0;y<=2;y++)c+=` if block ~${x} ~${y} ~${z} minecraft:air`;
 return c+' unless entity @e[distance=..3]';
}
export const nightCommands=['gamerule minecraft:players_sleeping_percentage 101','gamerule minecraft:advance_time false','time set midnight','gamerule minecraft:advance_time'];
export async function inspect(execute){const result=[];for(const site of sites){const output=await execute(guard(site));result.push({...site,clear:output.some(l=>/Test passed/.test(l)),output});}return result;}
export async function decorate(execute,survey){
 if(!Array.isArray(survey)||survey.length!==sites.length)throw Error('Inspect fixed sites first');
 const result=[];for(const [i,site] of survey.entries())if(site.clear){const block=i%3===0?'pumpkin':'jack_o_lantern';const output=await execute(guard(site)+` run setblock ~ ~ ~ minecraft:${block} keep`);const verify=await execute(`execute in minecraft:overworld positioned ${site.x} 0 ${site.z} positioned over motion_blocking_no_leaves if block ~ ~-1 ~ minecraft:${block}`);result.push({x:site.x,z:site.z,block,confirmed:output.some(l=>/Changed the block at/.test(l)),verified:verify.some(l=>/Test passed/.test(l)),output,verify});}return result;
}

