import {existsSync,readFileSync} from 'node:fs';
import {isIP} from 'node:net';
export const defaults=Object.freeze({players:['PlayerOne','PlayerTwo'],lanAddress:'127.0.0.1',campObjective:'mcd.camp_lantern',spawnMarker:'camp_lantern_spawn'});
export function validateSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw Error('Unknown local setting');
 const s={...defaults,...value};
 if(!Array.isArray(s.players)||s.players.length<1||s.players.length>6||new Set(s.players).size!==s.players.length||s.players.some(p=>typeof p!=='string'||!/^[A-Za-z0-9_]{1,16}$/.test(p)))throw Error('Invalid local players');
 if(isIP(s.lanAddress)!==4)throw Error('Expected explicit IPv4 bind address');
 if(!/^[a-z0-9_.-]{1,32}$/.test(s.campObjective)||!/^[a-z0-9_]{1,40}$/.test(s.spawnMarker))throw Error('Invalid world identifier');
 return Object.freeze(s);
}
const file=new URL('./settings.local.json',import.meta.url);
// Offline tests and dry mode never consume private session configuration.
export const settings=validateSettings(process.argv.includes('--live')&&existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{});
