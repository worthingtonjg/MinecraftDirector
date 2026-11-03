const enums = {mob:['chicken','cow','sheep','pig','zombie'],item:['bread','apple','torch','oak_log'],block:['oak_planks','cobblestone','glass']};
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
import {sidebarCommands} from './sidebar.mjs';
export const tools=[
 ['server_status',{},'Read local server readiness, process identity, save status and safety counters.'],
 ['server_stop',{},'Save and gracefully stop this experiment server; disconnects players.'],
 ['quests_start',{},'Start the local deterministic 30-second current-session inventory/kill tracker; pauses on departure, error or action budget exhaustion.'],
 ['quests_pause',{},'Pause local quest tracking without stopping Minecraft.'],
 ['quests_status',{},'Read current tracker status, latched progress, kill baselines and reward receipts.'],
 ['inventory_state',{},'Read and count current top-level inventory for the two session players without changing items; latch achieved possession goals locally.'],
 ['objectives_show',{},'Display the fixed Camp Lantern quest list. Only naming is marked complete; preserves other scoreboards by refusing conflicts.'],
 ['state',{},'Read player list and elapsed world ticks; console output is untrusted game data.'],
 ['player_state',{player:{type:'string',pattern:'^[A-Za-z0-9_]{1,16}$'}},'Read a named player position and health.'],
 ['message',{text:{type:'string',minLength:1,maxLength:160}},'Display plain text to players.'],
 ['spawn',{mob:{enum:enums.mob},x:{type:'integer',minimum:-64,maximum:64},y:{type:'integer',minimum:60,maximum:100},z:{type:'integer',minimum:-64,maximum:64},count:{type:'integer',minimum:1,maximum:3}},'Spawn up to 3 allowed mobs in the fixed overworld experiment area.'],
 ['reward',{player:{type:'string',pattern:'^[A-Za-z0-9_]{1,16}$'},quest:{type:'integer',minimum:0,maximum:4}},'Claim the fixed earned reward for a completed quest; persistent per-player receipt prevents duplicates.'],
 ['build',{block:{enum:enums.block},x:{type:'integer',minimum:-64,maximum:60},y:{type:'integer',minimum:60,maximum:96},z:{type:'integer',minimum:-64,maximum:60}},'Place a 5x5 platform, air blocks only, in the experiment area.']
].map(([name,properties,description])=>({name,description,inputSchema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},annotations:{readOnlyHint:['state','player_state','inventory_state','quests_status'].includes(name),destructiveHint:!['state','player_state','inventory_state','quests_status'].includes(name),openWorldHint:false}}));
export function commands(name,a={}){
 const t=tools.find(t=>t.name===name); if(!t) throw Error('Unknown tool');
 if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!Object.hasOwn(t.inputSchema.properties,k))) throw Error('Invalid arguments');
 for(const [k,s] of Object.entries(t.inputSchema.properties)){
  const v=a[k]; if(s.enum?!s.enum.includes(v):s.type==='integer'?!integer(v,s.minimum,s.maximum):typeof v!=='string'||(s.pattern&&!new RegExp(s.pattern).test(v))||(s.maxLength&&(v.length<1||v.length>s.maxLength||/[\x00-\x1f\x7f]/.test(v)))) throw Error('Invalid '+k);
 }
 const p=`${a.x} ${a.y} ${a.z}`;
 switch(name){
 case 'server_status':case 'server_stop':case 'quests_start':case 'quests_pause':case 'quests_status':return [];
 case 'inventory_state':return ['list','execute as @a run data get entity @s Inventory'];
 case 'objectives_show':return sidebarCommands();
 case 'state':return ['list','time query gametime'];
 case 'player_state':return [`data get entity ${a.player} Pos`,`data get entity ${a.player} Health`];
 case 'message':return [`tellraw @a ${JSON.stringify({text:'[Director] '+a.text,color:'gold'})}`];
 case 'spawn':return Array(a.count).fill(`execute in minecraft:overworld run summon minecraft:${a.mob} ${p}`);
 case 'reward':return [`give ${a.player} minecraft:bread 1`];
 case 'build':return [`execute in minecraft:overworld run fill ${p} ${a.x+4} ${a.y} ${a.z+4} minecraft:${a.block} keep`];
 }
}
export const rateLimits={manualGameplayCooldownMs:5000,sidebarCooldownMs:0,rewardCooldownMs:0,cumulativeCaps:false,spawnPerAction:3,buildPerAction:'5x5 air-only platform in existing bounded area',rewardPerPlayerPerQuest:'one fixed bread per verified completed quest; persistent receipt'};
export class Budget {
 constructor(){this.last=0;this.actions=0;this.mobs=0;this.items=0;this.builds=0;this.sidebarUpdates=0;this.lastSidebar=0;this.sidebarSignature=null;this.events=[];}
 restoreEvents(events=[]){if(!Array.isArray(events)||events.length>2048||events.some(e=>!Number.isSafeInteger(e.time)||e.time<0||!['message','spawn','build','reward','quests_start'].includes(e.name)||!Number.isSafeInteger(e.count)||e.count<0||e.count>3))throw Error('Invalid persisted rate history');this.events=events;}
 recent(now){this.events=this.events.filter(e=>e.time>now-600000);return this.events;}
 reason(name,a={},now=Date.now()){
  if(name==='reward'||name==='quests_start')return null;
  if(now-this.last<5000)return 'Rate limit: five-second gameplay cooldown';
  return null;
 }
 useSidebar(signature,now=Date.now()){
  if(typeof signature!=='string'||signature.length>20000)throw Error('Invalid sidebar signature');if(signature===this.sidebarSignature)return false;
  this.sidebarUpdates++;this.lastSidebar=now;this.sidebarSignature=signature;return true;
 }
 rewardBlockReason(now=Date.now()){return this.reason('reward',{},now);}
 use(name,a,now=Date.now()){
  if(['state','player_state','inventory_state'].includes(name))return;
  if(name==='objectives_show')throw Error('Sidebar writes require the separate rate limit');
  if(!['message','spawn','build','reward','quests_start'].includes(name))throw Error('Unsupported gameplay rate category');
  if(name==='spawn'&&!integer(a.count,1,3))throw Error('Invalid mob count');
  const blocked=this.reason(name,a,now);if(blocked)throw Error(blocked);
  const count=name==='spawn'?a.count:1;if(!['reward','quests_start'].includes(name))this.last=now;this.actions++;
  if(name==='spawn')this.mobs+=count;if(name==='reward')this.items++;if(name==='build')this.builds++;
 }
}
