import {hunts,ensureJourney,event,entitlement} from './journey.mjs';
import {rememberInventory} from './relocation.mjs';
import {onlineNames} from '../inventory.mjs';
export function concurrent(s){
 const j=ensureJourney(s);renameTrials(s);if(j.concurrent){migrateSpider(s);return j;}
 const finished=['finale','restoring','done'].includes(j.phase);
 j.concurrent=hunts.map((h,i)=>{
 const complete=finished||i<j.index||(i===j.index&&j.phase==='search')||j.events.some(e=>e.id==='hunt_'+i)||Object.values(j.receipts).some(r=>r.index===i&&['map','gear'].includes(r.kind));
 const active=!complete&&i===j.index&&j.phase==='hunt';
 return {kills:complete?h.target:active?j.kills:0,complete,last:active?{...j.last}:{},present:active?[...j.present]:[],participants:active?[...j.participants]:[],fragmentRecorded:j.events.some(e=>e.id==='fragment_'+i)};
 });
 if(['hunt','search'].includes(j.phase))j.phase='hunts';
 j.version=2;s.revision++;migrateSpider(s);return j;
}
export function updateConcurrent(s,names,scores){
 onlineNames(names);const j=concurrent(s);if(s.step<4||!['beds','hunts'].includes(j.phase))return;
 for(let i=0;i<3;i++)if(!j.concurrent[i].complete)for(const p of names){const q=j.concurrent[i],n=scores[i]?.[p];if(!Number.isInteger(n)||n<0)throw Error('Missing concurrent kill score');if(q.present.includes(p)&&Object.hasOwn(q.last,p)&&n<q.last[p])throw Error('Kill score decreased');}
 if(j.phase==='beds')j.phase='hunts';
 event(s,'concurrent_hunts_open','The 3 Trials are open. Defeat 10 zombies, 10 skeletons and 10 spiders together, in any order. Each hunt earns its own map and enchanted equipment. Follow each earned map to its matching fragment.',names);
 for(const [i,h]of hunts.entries()){
 const q=j.concurrent[i];if(q.complete)continue;
 // Validate a whole species snapshot before applying any deltas.
 for(const p of names){const n=scores[i]?.[p];if(!Number.isInteger(n)||n<0)throw Error('Missing concurrent kill score');if(q.present.includes(p)&&Object.hasOwn(q.last,p)&&n<q.last[p])throw Error('Kill score decreased');}
 for(const p of names){const n=scores[i][p];if(q.present.includes(p)&&Object.hasOwn(q.last,p))q.kills+=n-q.last[p];q.last[p]=n;if(!q.participants.includes(p))q.participants.push(p);}
 q.present=[...names];q.kills=Math.min(q.kills,h.target);
 if(q.kills===h.target){q.complete=true;for(const p of q.participants){entitlement(s,`map:${i}:${p}`,p,'map',i);entitlement(s,`gear:${i}:${p}`,p,'gear',i);}event(s,`hunt_${i}`,`${h.title}: hunt complete! The monsters have cancelled their victory party. You earned its marked map and ${h.name} (${h.reward}). Follow the red X and destroy its spawner. The reward chest will appear beneath the shattered spawner.`,names);}
 }
 j.lastCheck=new Date().toISOString();
}
export function collectConcurrent(s,samples,names=Object.keys(samples)){
 rememberInventory(s,samples);const j=concurrent(s),newly=[];if(s.step<4||!['hunts','finale'].includes(j.phase))return newly;
 for(const [i,h]of hunts.entries())if(j.concurrent[i].complete&&j.recovered[h.id]&&!j.concurrent[i].fragmentRecorded){j.concurrent[i].fragmentRecorded=true;newly.push(i);event(s,`fragment_${i}`,`The ${h.id} fragment is safe in the System's memory. Even losing the item cannot undo this recovery. The darkness is getting nervous.`,names);}
 s.events.opening_complete??={};s.events.opening_complete.fragmentsRecovered=Object.keys(j.recovered).length;
 if(j.phase==='hunts'&&j.concurrent.every((q,i)=>q.complete&&j.recovered[hunts[i].id])){j.phase='finale';event(s,'finale_open',j.finalDestination?'All three hunts are complete. The System can now forge Ember, Wick and Flame into the Harvest Flame. Its special fire can rekindle the Lantern at the guarded tower; your final map follows when the Lantern is ready. Rescue the captive allies before lighting it.':'All three fragments are remembered. Return to the Harvest Lantern at X 2, Y 63, Z -29. Place a torch immediately east of it at X 3, Y 63, Z -29 to rekindle it. Only this final act will bring dawn.',names);}
 return newly;
}
export function concurrentRows(s){const j=s.journey;
 const incomplete=hunts.flatMap((h,i)=>j.concurrent[i].complete?[]:[`Team ${h.species}s: ${j.concurrent[i].kills}/10`]);
 return ['The 3 Trials',...incomplete,...(j.concurrent.some(q=>q.complete)?[`Fragments recovered: ${hunts.filter(h=>j.recovered[h.id]).length}/3`]:[]),...(incomplete.length?['Each hunt: map + enchanted gear']:[])];
}

export function migrateSpider(s){const j=s.journey;if(!j?.concurrent||j.spiderEdition===1)return;const q=j.concurrent[2];q.last={};q.present=[];j.spiderEdition=1;const fix=t=>typeof t==='string'?t.replace(/creepers/gi,'spiders').replace(/creeper/gi,'spider'):t;for(const e of j.events??[])e.text=fix(e.text);for(const d of Object.values(j.deliveries??{}))d.text=fix(d.text);if(s.systemMessage)s.systemMessage.text=fix(s.systemMessage.text);s.revision++;}

export function renameTrials(s){const fix=t=>typeof t==='string'?t.replaceAll('The Three Trails','The 3 Trials').replaceAll('Three trails are open.','The 3 Trials are open.'):t;let changed=false;for(const entry of [...(s.journey?.events??[]),...Object.values(s.journey?.deliveries??{}),...(s.systemMessage?[s.systemMessage]:[])]){const text=fix(entry.text);if(text!==entry.text){entry.text=text;changed=true;}}if(changed)s.revision++;}
