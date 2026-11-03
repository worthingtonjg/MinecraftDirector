import {settings} from '../settings.mjs';
import {StoryTime} from './story-time.mjs';
import {checkBounties} from './creeper-bounty.mjs';
import {retunePace} from './spawner-pace.mjs';
import{migrateSpiderSpawner}from'./spider-spawner.mjs';
import {DeathPin,pinObjective} from './death-pin.mjs';
import {concurrent} from './concurrent-hunts.mjs';
import {DeathRequests,deathListObjective} from './death-requests.mjs';
import {spawnMapItem} from './spawn-map.mjs';
import {retireOld} from './retire-encounters.mjs';
import {QuestPossessions} from './quest-possessions.mjs';
import {applyEvidence,guardSpecies} from './relocation.mjs';
import {FarSurvey} from './far-survey.mjs';
import {Encounters,fragmentItem} from './encounters.mjs';
import {JourneyController} from './journey-controller.mjs';
import {hunts,huntObjective,itemFor,ensureJourney} from './journey.mjs';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,existsSync,readdirSync,appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import {acquireHostLock,serveMailbox} from '../local-ipc.mjs';
import {PeriodicSaver} from '../autosave.mjs';
import {parseOnlineInventories,summarizeInventories} from '../inventory.mjs';
import {ChapterController} from './controller.mjs';
import {campaignId,initialState,advance} from './chapter.mjs';
import {planBook} from './books.mjs';
import {readNbt} from '../sidebar.mjs';
import {Sidebar,sidebarSafe,objective} from './sidebar.mjs';
import {nightCommands,inspect,decorate} from './atmosphere.mjs';
import {SpawnTickets} from './chunks.mjs';
import {validatePlan,inspectPlan,applyPlan} from './planned-decor.mjs';
import {DeathTracker,deathObjective} from './deaths.mjs';
const root=fileURLToPath(new URL('.',import.meta.url)),parent=path.dirname(root.slice(0,-1));
if(!process.argv.includes('--live'))throw Error('Prototype is offline. Activation requires approval and --live.');
const approval=JSON.parse(readFileSync(path.join(root,'activation.local.json'),'utf8'));
if(approval.approved!==true||approval.campaign!==campaignId||approval.world!=='hollow-harvest-opening'||approval.gameAddress!==settings.lanAddress+':25565')throw Error('Exact prototype activation approval required');
const server=path.join(root,'server-26.3'),props=readFileSync(path.join(server,'server.properties'),'utf8').split(/\r?\n/);
for(const setting of ['level-name=hollow-harvest-opening','server-ip='+settings.lanAddress,'server-port=25565','online-mode=true','max-players=6','enable-rcon=false','enable-query=false','management-server-enabled=false'])if(!props.includes(setting))throw Error('Required prototype setting missing: '+setting);
if(!/^eula=true\s*$/m.test(readFileSync(path.join(server,'eula.txt'),'utf8')))throw Error('EULA acceptance must be confirmed before activation');
// Never attach to or stop the live Camp Lantern host.
const campLock=path.join(parent,'.director-ipc/host.lock');if(existsSync(campLock)){const pid=JSON.parse(readFileSync(campLock,'utf8')).pid;try{process.kill(pid,0);throw Error('Camp Lantern host is running; approved switch required');}catch(e){if(e.code!=='ESRCH')throw e;}}
const release=acquireHostLock(path.join(root,'.director-ipc'));process.on('exit',release);
let sidebarAllowed=false,sidebarExists=false,deathExists=false,deathSafe=false,huntSafe=false,requestSafe=false,requestExists=false,pinSafe=false,pinExists=false;
try{const file=path.join(server,'hollow-harvest-opening/data/minecraft/scoreboard.dat');const nbt=existsSync(file)?readNbt(readFileSync(file)):{data:{}};sidebarAllowed=sidebarSafe(nbt);const objectives=nbt.data.Objectives??nbt.data.objectives??[];sidebarExists=objectives.some(o=>(o.Name??o.name)===objective);const d=objectives.find(o=>(o.Name??o.name)===deathObjective);const requestObjective=objectives.find(o=>(o.Name??o.name)===deathListObjective);const po=objectives.find(o=>(o.Name??o.name)===pinObjective);pinExists=!!po;pinSafe=!po||(po.CriteriaName??po.criteria)==='trigger';requestExists=!!requestObjective;requestSafe=!requestObjective||(requestObjective.CriteriaName??requestObjective.criteria)==='trigger';deathExists=!!d;deathSafe=!d||(d.CriteriaName??d.criteria)==='deathCount';huntSafe=hunts.every((h,i)=>{const o=objectives.find(o=>(o.Name??o.name)===huntObjective(i));return !o||(o.CriteriaName??o.criteria)==='minecraft.killed:minecraft.'+h.species;});}catch{}
// Refuse conflicting native objectives before starting the replacement server.
const pendingPlan=JSON.parse(readFileSync(path.join(root,'journeys.local.json'),'utf8'));
if(pendingPlan.finale){const file=path.join(server,'hollow-harvest-opening/data/minecraft/scoreboard.dat');const n=existsSync(file)?readNbt(readFileSync(file)):{data:{}};const objs=n.data.Objectives??n.data.objectives??[];for(const [name,criteria]of [['hh.rescue','dummy'],['hh.light','trigger']]){const o=objs.find(o=>(o.Name??o.name)===name);if(o&&(o.CriteriaName??o.criteria??'dummy')!==criteria)throw Error('Existing scoreboard conflict: '+name);}}
const log=event=>appendFileSync(path.join(root,'lifecycle.log'),JSON.stringify({time:new Date().toISOString(),pid:process.pid,event})+'\n');
const checkpoint=path.join(root,'campaign.local.json');const save=s=>{writeFileSync(checkpoint+'.tmp',JSON.stringify(s));renameSync(checkpoint+'.tmp',checkpoint);};
let ready=false,closing=false,seq=0,lines=[],membership=0,queue=Promise.resolve();
const runtime=readdirSync(path.join(parent,'runtime25')).find(n=>n.startsWith('jdk-25'));
const child=spawn(path.join(parent,'runtime25',runtime,'bin/java.exe'),['-Xms512M','-Xmx2G','-jar',path.join(parent,'server-26.3/server.jar'),'nogui'],{cwd:server,windowsHide:true,stdio:['pipe','pipe','pipe']});
let acknowledgement=0;
async function execute(command){if(!ready||closing)throw Error('Prototype server not ready');const start=seq,id=++acknowledgement;child.stdin.write(command+'\ndata modify storage hh:bridge ack set value '+id+'\ndata get storage hh:bridge ack\n');for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,50));const output=lines.filter(l=>l.seq>start).map(l=>l.line);if(output.some(l=>l.includes('Storage hh:bridge has the following contents: '+id)&&l.endsWith(': '+id)))return output.filter(l=>!l.includes('hh:bridge'));if(!ready||closing)throw Error('Server stopped during command');}throw Error('Command acknowledgement timeout; inspect outcome before retry');}
async function observe(){const epoch=membership;const output=await execute('list\nexecute as @a run data get entity @s Inventory');if(epoch!==membership)throw Error('Party changed during snapshot; restart tracking after reconnect');if(output.some(l=>/There are 0 of a max of 6 players online:/.test(l)))return null;return parseOnlineInventories(output);}
const sidebar=new Sidebar({execute,safe:sidebarAllowed,exists:sidebarExists});
const deathRequests=new DeathRequests({execute,save,safe:requestSafe,exists:requestExists});
const deathPin=new DeathPin({execute,save,safe:pinSafe,exists:pinExists});
const deaths=new DeathTracker({execute,save,exists:deathExists,safe:deathSafe});
const encounters=new Encounters({execute,plan:JSON.parse(readFileSync(path.join(root,'journeys.local.json'),'utf8')),file:path.join(root,'encounters.local.json')});
const journey=new JourneyController({execute,observe,save,encounters,safe:huntSafe,bountyCheck:(s,names)=>checkBounties(s,names,execute,save)});
encounters.sites.spawnMap=JSON.parse(readFileSync(path.join(root,'journeys.local.json'),'utf8')).spawnMap;
const possessions=new QuestPossessions({execute,observe,save});
const survey=new FarSurvey(execute,path.join(root,'far-survey-tickets.local.json'));
const storyTime=new StoryTime(execute,save);
const controller=new ChapterController({timeCheck:s=>storyTime.apply(s),load:()=>existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):null,save,observe,execute,display:state=>sidebar.update(state),deathCheck:async(state,names)=>{const alive=await deaths.check(state,names);await deathRequests.check(state,names);await deathPin.check(state,names);return alive;},journeyCheck:(state,samples,alive)=>journey.tick(state,samples,alive),possessionCheck:(state,samples,alive)=>possessions.check(state,samples,alive,encounters.sites)});
if(existsSync(path.join(root,'relocation-evidence.local.json'))){applyEvidence(controller.state,JSON.parse(readFileSync(path.join(root,'relocation-evidence.local.json'),'utf8')));save(controller.state);}
concurrent(controller.state);if(encounters.finale){controller.state.journey.finalDestination=encounters.finale;}save(controller.state);
if(JSON.stringify(controller.state.journey.routeSites)!==JSON.stringify(encounters.sites)){controller.state.journey.routeSites=encounters.sites;controller.state.revision++;save(controller.state);}
const saver=new PeriodicSaver(()=>{const task=queue.then(async()=>{if(!ready||closing)throw Error('Server unavailable');const start=seq;log('save requested');child.stdin.write('save-all flush\n');for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,250));if(lines.some(l=>l.seq>start&&/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?Saved the game$/.test(l.line))){log('save confirmed');return;}if(!ready||closing)throw Error('Server stopped during save');}throw Error('Save acknowledgement timeout');});queue=task.catch(()=>{});return task;});
for(const stream of [child.stdout,child.stderr])readline.createInterface({input:stream}).on('line',line=>{lines.push({seq:++seq,line:line.slice(0,65536)});lines=lines.slice(-150);if(line.includes('Done (')){ready=true;saver.start();const task=queue.then(()=>storyTime.apply(controller.state));queue=task.catch(e=>{controller.error=e.message;controller.enabled=false;log('story time error '+e.message);});}if(/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?[A-Za-z0-9_]{1,16} (?:joined|left) the game$/.test(line))membership++;});
child.on('error',e=>{ready=false;saver.stop();log('server error '+e.message);});child.on('exit',(code,signal)=>{ready=false;saver.stop();log('server exit '+code+' '+signal);if(closing)process.exit(code??1);});
async function stop(){if(closing)return;closing=true;controller.enabled=false;saver.stop();log('graceful stop requested');child.stdin.write('stop\n');setTimeout(()=>child.kill(),30000).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const ticketsFile=path.join(root,'tickets.local.json');
const tickets=new SpawnTickets({execute,load:()=>existsSync(ticketsFile)?JSON.parse(readFileSync(ticketsFile,'utf8')):[],save:s=>{writeFileSync(ticketsFile+'.tmp',JSON.stringify(s));renameSync(ticketsFile+'.tmp',ticketsFile);}});
let terrainSurvey=null,plannedSurvey=null;
const toolNames=['server_status','server_stop','story_start','story_pause','story_status','inventory_state','book_syntax_check','night_apply','spawn_inspect','spawn_decorate','spawn_load','spawn_unload','plan_inspect','plan_apply','server_save','journey_deploy','journey_validate','journey_status','outpost_validate','spider_migrate','encounter_gate_migrate','spawner_pace','map_probe','journey_inspect','encounter_light_fix','near_north_load','near_northeast_load','near_east_load','near_northwest_load','near_south_load','far_east_load','far_west_load','far_release','relocation_retire'];
const result=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
async function dispatch(m){
 if(m.jsonrpc!=='2.0')throw Error('Invalid RPC');let value;
 if(m.method==='initialize')value={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:campaignId,version:'0.1'}};
 else if(m.method==='tools/list')value={tools:toolNames.map(name=>({name,inputSchema:{type:'object',properties:{},additionalProperties:false}}))};
 else if(m.method==='tools/call'){
  const {name,arguments:a={}}=m.params??{};if(!toolNames.includes(name)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length)throw Error('Only bounded no-argument prototype tools are allowed');
  if(name==='server_save'){const start=seq;child.stdin.write('save-all flush\n');let ok=false;for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,250));if(lines.some(l=>l.seq>start&&l.line.endsWith('Saved the game'))){ok=true;break;}}if(!ok)throw Error('Manual save acknowledgement timeout');log('manual save confirmed');save(controller.state);value=result({saved:true});}
  if(name==='server_status')value=result({ready,hostPid:process.pid,javaPid:child.pid,campaign:campaignId,autosave:saver.status,story:controller.status(),encountersReady:encounters.state.ready});
  if(name==='server_stop'){setTimeout(stop,500);value=result({status:'Graceful stop requested'});}
  if(name==='story_status')value=result({...controller.status(),sidebar:sidebar.status,deaths:deaths.status,deathRequests:deathRequests.status});
  if(name==='encounter_light_fix'){
    const output=[];try{for(const [i,p]of encounters.sites.entries()){await encounters.ticket(p);const spawn={entity:{id:'minecraft:'+guardSpecies[i]},custom_spawn_rules:{block_light_limit:{min_inclusive:0,max_inclusive:15},sky_light_limit:{min_inclusive:0,max_inclusive:15}}};output.push(...await execute('execute if block '+p.x+' '+(p.y+2)+' '+p.z+' minecraft:spawner if data block '+p.x+' '+(p.y+2)+' '+p.z+' SpawnData.entity{id:"minecraft:'+hunts[i].species+'"} run data merge block '+p.x+' '+(p.y+2)+' '+p.z+' '+JSON.stringify({SpawnData:spawn,SpawnPotentials:[{data:spawn,weight:1}]})));output.push(...await execute('data get block '+p.x+' '+(p.y+2)+' '+p.z));}}finally{await encounters.release();}value=result({output});
  }
  if(name==='journey_inspect'){
    const output=[];for(const p of encounters.sites){await encounters.ticket(p);output.push(...await execute(['execute if block '+p.x+' '+(p.y-1)+' '+p.z+' '+p.block,'execute if block '+p.x+' '+p.y+' '+p.z+' minecraft:air','execute if block '+p.x+' '+(p.y+1)+' '+p.z+' minecraft:air','execute if block '+p.x+' '+(p.y+2)+' '+p.z+' minecraft:air','execute positioned '+p.x+' '+p.y+' '+p.z+' as @e[distance=..4] run data get entity @s id'].join('\n')));}await encounters.release();value=result({output});
  }
  if(name==='map_probe'){
    const output=[];
    for(const p of [...encounters.sites,...(encounters.sites.spawnMap?[encounters.sites.spawnMap]:[])]){output.push(...await execute('summon minecraft:item_frame 15 66 -16 {Tags:["hh_map_probe"],Fixed:1b,Invisible:1b,ItemDropChance:0f,Item:{id:"minecraft:filled_map",count:1,components:{"minecraft:map_id":'+p.mapId+'}}}'));}
    output.push(...await execute('execute as @e[type=minecraft:item_frame,tag=hh_map_probe] run data get entity @s Item'));
    output.push(...await execute('execute as @e[type=minecraft:item_frame,tag=hh_map_probe] run data remove entity @s Item'));
    output.push(...await execute('kill @e[type=minecraft:item_frame,tag=hh_map_probe]'));
    value=result({output});
  }
  if(name==='relocation_retire'){const plan=JSON.parse(readFileSync(path.join(root,'journeys.local.json'),'utf8'));if(plan.version!==2)throw Error('Relocated plan must be active');const old=JSON.parse(readFileSync(path.join(root,'relocation-original.local.json'),'utf8'));const outcome=await retireOld(encounters,old,Object.keys(controller.state.journey.recovered),execute);writeFileSync(path.join(root,'relocation-retirement.local.json'),JSON.stringify(outcome,null,2));value=result(outcome);}
  for(const [tool,key]of Object.entries({near_north_load:'north',near_northeast_load:'northeast',near_east_load:'eastnear',near_northwest_load:'northwest',near_south_load:'south'}))if(name===tool)value=result(await survey.load(key));
  if(name==='far_east_load')value=result(await survey.load('east'));
  if(name==='far_west_load')value=result(await survey.load('west'));
  if(name==='far_release')value=result(await survey.release());
  if(name==='journey_status')value=result({encounters:encounters.state,journey:controller.state.journey,lastCheck:journey.lastCheck});
  if(name==='outpost_validate'){const p=encounters.finale;if(!p)throw Error('No outpost configuration');value=result({scope:'Read-only native datapack, scoreboard and loaded entity queries',output:await execute('datapack list enabled\nscoreboard objectives list\n'+p.rescues.map((r,i)=>'scoreboard players get g'+i+' hh.rescue\ndata get entity '+r.uuid+' Health\ndata get entity '+r.uuid+' Pos').join('\n'))});}
  if(name==='spawner_pace')value=result(await retunePace(encounters,controller.state));
  if(name==='encounter_gate_migrate')value=result(await journey.gate.migrate(controller.state));
  if(name==='spider_migrate')value=result(await migrateSpiderSpawner(encounters,controller.state));
  if(name==='journey_deploy'){value=result(await encounters.deploy());if(journey.outpost)await journey.outpost.retireOldMarker();}
  if(name==='journey_validate'){await journey.init(controller.state);const commands=[...hunts.flatMap((h,i)=>['map','gear'].map(kind=>'execute if entity @s run give @s '+itemFor({kind,index:i,player:'HH_Probe',key:'probe'},encounters.sites)+' 1')), ...hunts.map((h,i)=>'execute if entity @s run give @s '+fragmentItem(i)+' 1'),'execute if entity @s run give @s '+itemFor({kind:'shield',player:'HH_Probe',key:'probe'},encounters.sites)+' 1',...['fishingRod','boat'].map(kind=>'execute if entity @s run give @s '+itemFor({kind,player:'HH_Probe',key:'probe'},encounters.sites)+' 1')];if(encounters.finale)for(const kind of ['finalMap','flame','dawnbreaker'])commands.push('execute if entity @s run give @s '+itemFor({kind,player:'HH_Probe',key:'probe'},encounters.sites)+' 1');if(encounters.sites.spawnMap)commands.push('execute if entity @s run give @s '+spawnMapItem('HH_Probe',encounters.sites.spawnMap)+' 1');value=result({scope:'Parser validation without giving any items',output:await execute(commands.join('\n'))});}
  if(name==='night_apply'){await storyTime.apply(controller.state);value=result({phase:storyTime.applied});}
  if(name==='spawn_load')value=result(await tickets.load());
  if(name==='plan_inspect'){const plan=validatePlan(JSON.parse(readFileSync(path.join(root,'decoration-plan.local.json'),'utf8')));plannedSurvey=await inspectPlan(execute,plan);value=result(plannedSurvey);}
  if(name==='plan_apply'){if(!plannedSurvey)throw Error('Inspect planned sites first');const survey=plannedSurvey;plannedSurvey=null;const outcome=await applyPlan(execute,survey);writeFileSync(path.join(root,'decoration-results.local.json'),JSON.stringify(outcome,null,2));value=result(outcome);}
  if(name==='spawn_unload')value=result(await tickets.release());
  if(name==='spawn_inspect'){terrainSurvey=await inspect(execute);value=result(terrainSurvey);}
  if(name==='spawn_decorate'){if(!terrainSurvey)throw Error('Read-only spawn inspection required first');const survey=terrainSurvey;terrainSurvey=null;value=result(await decorate(execute,survey));}
  if(name==='book_syntax_check'){
   const probe=advance(initialState(),{HH_SyntaxProbe:[]}).state;
   const command=planBook(probe,'HH_SyntaxProbe',[]).command;
   // Console has no @s: parse the complete nested command without issuing any item.
   value=result({scope:'Parser-only; no player or inventory modified',output:await execute('execute if entity @s run '+command)});
  }
  if(name==='story_pause'){controller.enabled=false;value=result(controller.status());}
  if(name==='story_start'){await storyTime.apply(controller.state);if(!sidebarAllowed)throw Error('Bounty scoreboard conflict');await execute('scoreboard objectives add hh.hunt2 minecraft.killed:minecraft.creeper');await checkBounties(controller.state,Object.keys(controller.state.players),execute,save);await deathRequests.check(controller.state,[]);await deathPin.check(controller.state,[]);await sidebar.update(controller.state);controller.enabled=true;await controller.tick();value=result({...controller.status(),sidebar:sidebar.status});}
  if(name==='inventory_state'){const snapshot=await observe();value=result(snapshot?summarizeInventories(snapshot):{online:0});}
 }else throw Error('Unsupported method');return {jsonrpc:'2.0',id:m.id,result:value};
}
serveMailbox(path.join(root,'.director-ipc'),m=>{const task=queue.then(()=>dispatch(m));queue=task.catch(()=>{});return task;});
let queued=false;setInterval(()=>{if(!controller.enabled||queued||closing||!ready)return;queued=true;queue=queue.then(()=>controller.tick()).finally(()=>queued=false);},30000);
log('prototype host started');



let pinQueued=false;setInterval(()=>{if(pinQueued||closing||!ready||!controller.enabled||controller.waiting)return;pinQueued=true;queue=queue.then(()=>deathPin.refresh(controller.state)).catch(e=>{deathPin.error=e.message;}).finally(()=>pinQueued=false);},1000);
