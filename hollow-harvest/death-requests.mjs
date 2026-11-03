import {selectPin} from './death-pin.mjs';
import {systemChat} from './system-chat.mjs';
import {onlineNames} from '../inventory.mjs';
export const deathListObjective='hh.deathlist';
export function deathList(state,player){
 onlineNames([player]);
 const history=Object.values(state.deathReceipts??{}).filter(r=>r.player===player).sort((a,b)=>b.counter-a.counter).slice(0,5);
 if(!history.length)return '[System] No recorded death locations yet.';
 return '[System] Your latest recorded deaths (newest first):\n'+history.map((r,i)=>`${i+1}. ${r.dimension}: X ${r.pos[0]}, Y ${r.pos[1]}, Z ${r.pos[2]}`).join('\n')+'\nRecorded locations only; dropped items may have despawned.';
}
export class DeathRequests{
 constructor({execute,save=()=>{},safe=true,exists=false}){this.execute=execute;this.save=save;this.safe=safe;this.exists=exists;this.status={error:null};}
 async check(state,names){
 try{
 if(!this.safe)throw Error('Death-list scoreboard conflict; existing objective preserved');
 if(!this.exists){const out=await this.execute(`scoreboard objectives add ${deathListObjective} trigger`);if(!out.some(l=>l.includes('Created new objective')))throw Error('Death-list objective creation unconfirmed');this.exists=true;}
 for(const p of names.length?onlineNames(names):[]){
 const out=await this.execute(`scoreboard players add ${p} ${deathListObjective} 0\nscoreboard players get ${p} ${deathListObjective}`);
 const matches=out.map(l=>l.match(new RegExp(p+' has (-?\\d+) \\[?hh\\.deathlist\\]?$'))).filter(Boolean);
 if(matches.length!==1)throw Error('Death-list request unreadable');
 if(Number(matches[0][1])!==0){
 // Consume before replying: a lost acknowledgement must not replay chat after restart.
 const reset=await this.execute(`scoreboard players set ${p} ${deathListObjective} 0`);
 if(!reset.some(l=>l.includes(' to 0')))throw Error('Death-list request consumption unconfirmed');
 selectPin(state,p,1);this.save(state);await this.execute(systemChat(p,deathList(state,p)+'\nPin: /trigger hh.deathpin set 1..5; off: /trigger hh.deathpin set 0','aqua'));
 }
 await this.execute(`scoreboard players enable ${p} ${deathListObjective}`);
 }
 this.status.error=null;
 }catch(e){this.status.error=e.message;}
 }
}
