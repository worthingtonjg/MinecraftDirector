import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {Terrain} from './journey-terrain.mjs';
import {readNbt} from './terrain-nbt.mjs';
import {encode,byte,int,str,bytes,list,compound} from './nbt-write.mjs';
const world='server-26.3/hollow-harvest-opening';const sites=JSON.parse(readFileSync('journey-sites.local.json'));
const terrain=new Terrain(world+'/dimensions/minecraft/overworld/region');const level=readNbt(readFileSync(world+'/level.dat'));
const mapDir=world+'/data/minecraft/maps',indexFile=mapDir+'/last_id.dat';let last=existsSync(indexFile)?readNbt(readFileSync(indexFile)).data.map:-1;
if(!Number.isInteger(last)||last< -1)throw Error('Invalid map index');
mkdirSync('staged-maps',{recursive:true});const plan=[];
const color=b=>b==='minecraft:water'?50:b?.includes('sand')?10:b?.includes('leaves')?30:b?.includes('log')?54:b==='minecraft:grass_block'?6:b?.includes('snow')?34:b?.includes('dirt')?42:b?46:0;
for(let i=0;i<3;i++){const p=sites[i],xCenter=Math.round((p.x+15)/2/4)*4,zCenter=Math.round((p.z-16)/2/4)*4,id=++last,colors=[];let known=0;
 for(let z=0;z<128;z++)for(let x=0;x<128;x++){const top=terrain.top(xCenter+(x-64)*4+2,zCenter+(z-64)*4+2);colors.push(color(top?.block));if(top)known++;}
 const data={scale:byte(2),dimension:str('minecraft:overworld'),trackingPosition:byte(1),unlimitedTracking:byte(1),locked:byte(0),xCenter:int(xCenter),zCenter:int(zCenter),colors:bytes(colors),banners:list(10,[]),frames:list(10,[])};
 writeFileSync(`staged-maps/${id}.dat`,encode({data:compound(data),DataVersion:int(level.Data.DataVersion)}));plan.push({index:i,mapId:id,xCenter,zCenter,scale:2,knownPixels:known,...p});
}
writeFileSync('staged-maps/last_id.dat',encode({data:compound({map:int(last)}),DataVersion:int(level.Data.DataVersion)}));writeFileSync('journeys.local.json',JSON.stringify({version:1,previousMapId:last-3,dataVersion:level.Data.DataVersion,sites:plan},null,2));console.log(JSON.stringify({dataVersion:level.Data.DataVersion,sites:plan}));
