import {settings} from './settings.mjs';
import {readFileSync} from 'node:fs';
export const players=settings.players;
export function onlineNames(names){if(!Array.isArray(names)||names.length<1||names.length>6||new Set(names).size!==names.length||names.some(p=>typeof p!=='string'||!/^[A-Za-z0-9_]{1,16}$/.test(p)))throw Error('One to six distinct online players required');return names;}
export function parseOnlineInventories(output){
 const samples={};
 for(const line of output){const match=line.match(/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?([A-Za-z0-9_]{1,16}) has the following entity data: (.*)$/);if(!match)continue;if(Object.hasOwn(samples,match[1]))throw Error('Duplicate player inventory response');samples[match[1]]=parseSnbt(match[2]);}
 const rosters=output.map(line=>line.match(/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?There are (\d+) of a max of \d+ players online: ?(.*)$/)).filter(Boolean);
 if(rosters.length!==1)throw Error('Missing or ambiguous online roster');const roster=onlineNames(rosters[0][2].split(', ').filter(Boolean));
 if(Number(rosters[0][1])!==roster.length||roster.length!==Object.keys(samples).length||!roster.every(p=>Object.hasOwn(samples,p)))throw Error('Incomplete online inventory snapshot');
 return samples;
}
const logs=new Set(JSON.parse(readFileSync(new URL('./log-items.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')));
export function parseSnbt(s){
 if(s.length>60000)throw Error('Inventory response too large');let p=0;
 const ws=()=>{while(/\s/.test(s[p]??'')&&p<s.length)p++;};
 function quoted(){const q=s[p++];let out='';while(p<s.length){let c=s[p++];if(c===q)return out;if(c==='\\'){if(p>=s.length)break;c=s[p++];}out+=c;}throw Error('Unclosed string');}
 function token(key=false){ws();if(s[p]==='"'||s[p]==="'")return quoted();const start=p;while(p<s.length&&!/[\s,\[\]{}]/.test(s[p])&&!(key&&s[p]===':'))p++;if(start===p)throw Error('Invalid token');return s.slice(start,p);}
 function value(depth=0){if(depth>32)throw Error('SNBT depth limit');ws();const c=s[p];
 if(c==='{'){p++;const o=Object.create(null);ws();while(s[p]!=='}'){const k=token(true);ws();if(s[p++]!==':')throw Error('Missing colon');if(Object.hasOwn(o,k))throw Error('Duplicate key');o[k]=value(depth+1);ws();if(s[p]!==',')break;p++;}if(s[p++]!=='}')throw Error('Unclosed compound');return o;}
 if(c==='['){p++;ws();if(/^[BIL];/.test(s.slice(p)))p+=2;const a=[];ws();while(s[p]!==']'){a.push(value(depth+1));if(a.length>5000)throw Error('SNBT list limit');ws();if(s[p]!==',')break;p++;}if(s[p++]!==']')throw Error('Unclosed list');return a;}
 if(c==='"'||c==="'")return quoted();const t=token();return /^[-+]?\d+(?:\.\d+)?[bBsSlLfFdD]?$/.test(t)?Number(t.replace(/[bBsSlLfFdD]$/,'')):t;}
 const v=value();ws();if(p!==s.length)throw Error('Trailing data');return v;
}
export function countInventory(inv){
 if(!Array.isArray(inv)||inv.length>41)throw Error('Invalid inventory');const out={logs:0,table:0,picks:0,stone:0,stoneSwords:0,stonePicks:0,iron:0,ironPicks:0,axes:0,furnace:0,cookedFood:0,torches:0,shields:0,waterBucket:0};const slots=new Set();
 for(const item of inv){if(!item||typeof item.id!=='string'||!Number.isInteger(item.Slot)||slots.has(item.Slot))throw Error('Invalid or duplicate inventory slot');slots.add(item.Slot);
 const n=item.count??1;if(!Number.isInteger(n)||n<1||n>99)throw Error('Invalid item count');
 if(logs.has(item.id))out.logs+=n;if(item.id==='minecraft:crafting_table')out.table+=n;if(['minecraft:wooden_pickaxe','minecraft:stone_pickaxe'].includes(item.id))out.picks+=n;
 const extra={'minecraft:cobblestone':'stone','minecraft:cobbled_deepslate':'stone','minecraft:iron_ingot':'iron','minecraft:furnace':'furnace','minecraft:torch':'torches','minecraft:shield':'shields','minecraft:water_bucket':'waterBucket'};if(extra[item.id])out[extra[item.id]]+=n;
 if(/^minecraft:(stone|iron|diamond|netherite)_pickaxe$/.test(item.id))out.stonePicks+=n;
 if(/^minecraft:(iron|diamond|netherite)_pickaxe$/.test(item.id))out.ironPicks+=n;
 if(/^minecraft:(stone|iron|diamond|netherite)_sword$/.test(item.id))out.stoneSwords+=n;
 if(/^minecraft:(stone|iron|diamond|netherite)_axe$/.test(item.id))out.axes+=n;
 if(/^minecraft:(cooked_beef|cooked_porkchop|cooked_chicken|cooked_mutton|cooked_rabbit|cooked_cod|cooked_salmon|baked_potato)$/.test(item.id))out.cookedFood+=n;
 }return out;
}
export function summarizeInventories(samples,previous={}){
 const roster=onlineNames(Object.keys(samples));
 const byPlayer=Object.fromEntries(roster.map(p=>[p,countInventory(samples[p])]));const totals=countInventory([]);for(const counts of Object.values(byPlayer))for(const k of Object.keys(totals))totals[k]+=counts[k];
 const completed={};for(const [k,target]of Object.entries({logs:16,table:1,picks:2}))completed[k]=previous[k]===true||totals[k]>=target;
 return {byPlayer,totals,completed,observedAt:Date.now(),meaning:'One command snapshots only currently online inventories (1–6); no accumulation across observations. Top-level inventory only; containers and placed blocks excluded.'};
}
