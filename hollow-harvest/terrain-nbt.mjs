import {settings} from '../settings.mjs';
import {gunzipSync} from 'node:zlib';
export const objective=settings.campObjective;
export function readNbt(input){
 const b=input[0]===31?gunzipSync(input,{maxOutputLength:1048576}):input;let p=0;
 function take(n){if(n<0||p+n>b.length)throw Error('Invalid scoreboard data');const s=b.subarray(p,p+n);p+=n;return s;}
 const byte=()=>take(1).readUInt8();const int=()=>take(4).readInt32BE();const str=()=>take(take(2).readUInt16BE()).toString('utf8');
 function value(t,depth=0){if(depth>32)throw Error('NBT depth limit');switch(t){
 case 1:return take(1).readInt8();case 2:return take(2).readInt16BE();case 3:return int();case 4:return take(8).readBigInt64BE().toString();case 5:return take(4).readFloatBE();case 6:return take(8).readDoubleBE();case 8:return str();
 case 7:case 11:case 12:{const n=int();if(n<0||n>1048576)throw Error('NBT size limit');return Array.from({length:n},()=>t===7?take(1).readInt8():t===11?int():take(8).readBigInt64BE().toString());}
 case 9:{const sub=byte(),n=int();if(n<0||n>10000)throw Error('NBT list limit');return Array.from({length:n},()=>value(sub,depth+1));}
 case 10:{const o=Object.create(null);for(let t=byte();t!==0;t=byte())o[str()]=value(t,depth+1);return o;}
 default:throw Error('Unknown NBT tag');}}
 const type=byte();str();return value(type);
}

