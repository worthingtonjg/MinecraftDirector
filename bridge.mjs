import {settings} from './settings.mjs';
import {spawn} from 'node:child_process';
import {readFileSync,readdirSync,existsSync,writeFileSync,renameSync,appendFileSync} from 'node:fs';
import {PeriodicSaver} from './autosave.mjs';
import {acquireHostLock,serveMailbox} from './local-ipc.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import {tools,commands,Budget,rateLimits} from './policy.mjs';
import {readNbt,sidebarSafe,sidebarCommands} from './sidebar.mjs';
import {players,parseOnlineInventories,summarizeInventories} from './inventory.mjs';
import {killObjective,skeletonObjective,stages,newQuestState,parseKillScore,progress,questSidebar,rewardKey,ensureRewardEntitlements,claimReward} from './quests.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const standalone=process.argv.includes('--host');
if(standalone&&!process.argv.includes('--live'))throw Error('Standalone host requires approved live mode');
if(standalone){const release=acquireHostLock(path.join(root,'.director-ipc'));process.on('exit',release);}
let child,ready=false,lines=[],seq=0,closing=false;
let membershipEpoch=0;
const lifecycle=(event)=>appendFileSync(path.join(root,'lifecycle.log'),JSON.stringify({time:new Date().toISOString(),pid:process.pid,event})+'\n');
const saver=new PeriodicSaver(()=>{const task=queue.then(saveWorld);queue=task.catch(()=>{});return task;});
async function saveWorld(){
 if(!child||!ready||closing)throw Error('Server unavailable; periodic saves paused');
 const start=seq;const deadline=Date.now()+30000;
 lifecycle('save requested');child.stdin.write('save-all flush\n');
 while(Date.now()<deadline){
  await new Promise(r=>setTimeout(r,250));
  const output=lines.filter(l=>l.seq>start).map(l=>l.line);
  if(output.some(l=>/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?Saved the game$/.test(l))){lifecycle('save confirmed');return;}
  if(!child||!ready||closing)throw Error('Server stopped before save acknowledgement');
 }
 lifecycle('save acknowledgement timeout; periodic saves paused');throw Error('Save acknowledgement timeout; no overlapping retry');
}
const budget=new Budget();
const budgetFile=path.join(root,'budget.local.json');
let safeSidebar=false;
const goalsFile=path.join(root,'goals.local.json');let inventorySnapshot;
let completedGoals={};
const questFile=path.join(root,'quest-session.local.json');
let questState=newQuestState(),questActive=false,questError=null,knownKillObjective=false,knownSkeletonObjective=false,questObservation=null,rewardBlocked=null;
if(process.argv.includes('--live')){
 lifecycle('bridge live start');
 const approved=JSON.parse(readFileSync(path.join(root,'approval.local.json'),'utf8'));
 if(existsSync(questFile))questState=JSON.parse(readFileSync(questFile,'utf8'));
 if(questState.killProgress)questState.killProgress.online=[];
 if(existsSync(goalsFile))completedGoals=JSON.parse(readFileSync(goalsFile,'utf8')).completed??{};
 if(approved.localServer!==true||approved.consoleBridge!==true) throw Error('Explicit local server and bridge approvals required');
 if(existsSync(budgetFile)){
  const saved=JSON.parse(readFileSync(budgetFile,'utf8'));
  for(const k of ['last','actions','mobs','items','builds']){if(!Number.isSafeInteger(saved[k])||saved[k]<0)throw Error('Invalid saved budget');budget[k]=saved[k];}
  for(const k of ['sidebarUpdates','lastSidebar']){const value=saved[k]??0;if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid saved sidebar budget');budget[k]=value;}
  if(saved.sidebarSignature!==undefined&&saved.sidebarSignature!==null&&typeof saved.sidebarSignature!=='string')throw Error('Invalid sidebar signature');
  budget.sidebarSignature=saved.sidebarSignature??null;
  // Seed the last confirmed rendering without refunding any historical gameplay actions.
  if(saved.sidebarSignature===undefined&&questState.displaySignature===JSON.stringify([questState.phase,questState.done]))budget.sidebarSignature=JSON.stringify(questSidebar(questState));
 }
 // Reconcile the owned display after a restart; the world may predate its checkpoint.
 budget.sidebarSignature=null;questState.displaySignature=null;
 const scoreFile=path.join(root,'server-26.3/director-fresh-world/data/minecraft/scoreboard.dat');
 try{const score=existsSync(scoreFile)?readNbt(readFileSync(scoreFile)):{data:{}};safeSidebar=sidebarSafe(score);const objectives=score.data.Objectives??score.data.objectives??[];knownKillObjective=objectives.some(o=>(o.Name??o.name)===killObjective&&(o.CriteriaName??o.criteria)==='minecraft.killed:minecraft.zombie');knownSkeletonObjective=objectives.some(o=>(o.Name??o.name)===skeletonObjective&&(o.CriteriaName??o.criteria)==='minecraft.killed:minecraft.skeleton');}catch{safeSidebar=false;}
 if(!/^eula=true\s*$/m.test(readFileSync(path.join(root,'server-26.3/eula.txt'),'utf8'))) throw Error('EULA acceptance required');
 const props=readFileSync(path.join(root,'server-26.3/server.properties'),'utf8');
 const bind=approved.lanActivated===true&&approved.lanAddress===settings.lanAddress?settings.lanAddress:'127.0.0.1';
 for(const line of [`server-ip=${bind}`,'enable-rcon=false','enable-query=false','online-mode=true','white-list=false','enforce-whitelist=false','level-name=director-fresh-world']) if(!props.split(/\r?\n/).includes(line)) throw Error('Required approved setting missing: '+line);
 const runtime=readdirSync(path.join(root,'runtime25')).find(n=>n.startsWith('jdk-25'));
 if(!runtime) throw Error('Portable Java 25 missing');
 child=spawn(path.join(root,'runtime25',runtime,'bin/java.exe'),['-Xms512M','-Xmx2G','-jar','server.jar','nogui'],{cwd:path.join(root,'server-26.3'),windowsHide:true,stdio:['pipe','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr]) readline.createInterface({input:stream}).on('line',line=>{if(line.includes('Done (')){ready=true;saver.start();}const member=line.match(/^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (?:System chat: )?([A-Za-z0-9_]{1,16}) (?:joined|left) the game$/);if(member){membershipEpoch++;if(questState.killProgress){questState.killProgress.online=questState.killProgress.online.filter(p=>p!==member[1]);atomic(questFile,questState);}}lines.push({seq:++seq,line:line.slice(0,65536)});lines=lines.slice(-100);});
 child.on('error',e=>{ready=false;saver.stop();lifecycle('server process error: '+e.message);lines.push({seq:++seq,line:'Server process error: '+e.message});}); child.on('exit',(code,signal)=>{ready=false;saver.stop();lifecycle('server exited: '+code+' signal: '+signal);lines.push({seq:++seq,line:'Server process exited: '+code});child=null;});
}
async function shutdown(){if(closing)return;closing=true;saver.stop();if(process.argv.includes('--live'))lifecycle('graceful shutdown requested');if(child){child.stdin.write('stop\n');const timer=setTimeout(()=>{child?.kill();},30000);timer.unref();child.once('exit',()=>process.exit(0));}else process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
const result=text=>({content:[{type:'text',text:JSON.stringify(text)}]});
const atomic=(file,value)=>{writeFileSync(file+'.tmp',JSON.stringify(value));renameSync(file+'.tmp',file);};
async function game(cmds){if(!child||!ready)throw Error('Server not ready');const start=seq;for(const c of cmds)child.stdin.write(c+'\n');await new Promise(r=>setTimeout(r,800));return lines.filter(l=>l.seq>start).map(l=>l.line);}
async function readInventories(){
 const epoch=membershipEpoch;const output=await game(commands('inventory_state'));if(epoch!==membershipEpoch)throw Error('Membership changed during observation');const samples=parseOnlineInventories(output);
 const snapshot=summarizeInventories(samples,completedGoals);atomic(goalsFile,snapshot);completedGoals=snapshot.completed;inventorySnapshot=snapshot;return snapshot;
}
async function readKills(roster){const output=await game([killObjective,skeletonObjective].flatMap(obj=>roster.map(p=>`scoreboard players get ${p} ${obj}`)));return Object.fromEntries([['zombies',killObjective],['skeletons',skeletonObjective]].map(([species,obj])=>[species,Object.fromEntries(roster.map(p=>[p,parseKillScore(output,p,obj)]))]));}
async function writeBounded(name,args,cmds){if(name==='objectives_show'){if(!budget.useSidebar(JSON.stringify(cmds)))return [];}else budget.use(name,args);atomic(budgetFile,budget);return game(cmds);}
const questStatus=()=>({active:questActive,error:questError,rewardBlocked,autosave:saver.status,stage:stages[questState.phase]?.name??'Chain complete',state:questState,latestObservation:questObservation,budget,safeguards:rateLimits,scope:'Local checks only. Earned rewards and objective displays have no cumulative or timing quotas.'});
async function payReward(player,phase){
 ensureRewardEntitlements(questState);atomic(questFile,questState);
 const key=claimReward(questState,phase,player);if(!key)return {status:'Already recorded; no repeat payout',receipt:questState.rewards[rewardKey(phase,player)]};
 // Persist the attempt before dispatch; uncertain attempts are never automatically retried.
 atomic(questFile,questState);budget.use('reward',{});atomic(budgetFile,budget);
 const output=await game(commands('reward',{player,quest:phase}));
 questState.rewards[key].status=output.some(l=>l.includes(`Gave 1 [Bread] to ${player}`))?'confirmed':'uncertain';atomic(questFile,questState);
 return {receipt:questState.rewards[key],output};
}
async function questTick(){
 if(!questActive)return;
 try{
  const epoch=membershipEpoch;const inv=await readInventories();const online=Object.keys(inv.byPlayer);const kills=await readKills(online);if(epoch!==membershipEpoch)return;questObservation={...inv,kills};
  const next=progress(questState,inv.totals,kills,inv.byPlayer);questState=next.state;ensureRewardEntitlements(questState);atomic(questFile,questState);
  const signature=JSON.stringify([questState.phase,questState.done]);
  if(signature!==questState.displaySignature){
   const output=await writeBounded('objectives_show',{},questSidebar(questState));
   if(output.some(l=>/Unknown|Incorrect|Expected|Cannot|Can't/.test(l)))throw Error('Sidebar update error; inspect server response');
   questState.displaySignature=signature;atomic(questFile,questState);
  }
  rewardBlocked=null;
  for(const phase of questState.completedStages)for(const player of (questState.rewardRecipients?.[phase]??players)){if(!online.includes(player))continue;const key=rewardKey(phase,player);if(questState.rewards[key]?.status!=='pending')continue;
   await payReward(player,phase);
  }
  if(questState.phase>=stages.length){questActive=false;questError='Progression chain complete';}
 }catch(e){if(e.message==='Membership changed during observation')return;questActive=false;questError=e.message;process.stderr.write('Quest tracker paused: '+questError+'\n');}
}
async function handle(m){
 if(m.id===undefined)return;
 if(m.method==='initialize')return {protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'minecraft-director',version:'0.1.0'}};
 if(m.method==='ping')return {};
 if(m.method==='tools/list')return {tools};
 if(m.method!=='tools/call')throw Error('Unsupported method');
 try{
 const {name,arguments:a={}}=m.params??{};let cmds=commands(name,a);
 if(name==='server_status')return result({ready,pid:process.pid,javaPid:child?.pid??null,standalone,autosave:saver.status,questActive,questError,budget:{actions:budget.actions,items:budget.items,mobs:budget.mobs,builds:budget.builds,sidebarUpdates:budget.sidebarUpdates},safeguards:rateLimits});
 if(name==='server_stop'){setTimeout(shutdown,500);return result({status:'Graceful save and stop requested; inspect lifecycle/server logs for completion'});}
 if(name==='quests_status')return result(questStatus());
 if(name==='quests_pause'){questActive=false;questError='Paused by request';return result(questStatus());}
 if(!child||!ready)return {...result({error:'Server is not running/ready. No commands executed.',diagnostics:name==='state'?lines.slice(-15).map(l=>l.line):[],untrustedGameData:true}),isError:true};
 if(name==='inventory_state')return result(await readInventories());
 if(name==='reward'){const inv=await readInventories();if(!Object.hasOwn(inv.byPlayer,a.player))throw Error('Reward recipient must be online');return result(await payReward(a.player,a.quest));}
 if(name==='quests_start'){
  if(questActive)return result(questStatus());if(!safeSidebar)throw Error('Existing scoreboard conflict; tracker not started');
  await readInventories();
  const create=[];if(!knownKillObjective)create.push(`scoreboard objectives add ${killObjective} minecraft.killed:minecraft.zombie`);if(!knownSkeletonObjective)create.push(`scoreboard objectives add ${skeletonObjective} minecraft.killed:minecraft.skeleton`);
  if(create.length){const output=await writeBounded('quests_start',{},create);if(!knownKillObjective)knownKillObjective=output.some(l=>l.includes('Created new objective')&&l.includes(killObjective));if(!knownSkeletonObjective)knownSkeletonObjective=output.some(l=>l.includes('Created new objective')&&l.includes(skeletonObjective));if(!knownKillObjective||!knownSkeletonObjective)throw Error('Kill criteria not confirmed; tracker not started');}
  questError=null;questActive=true;await questTick();return result(questStatus());
 }
 if(name==='objectives_show'&&!safeSidebar)throw Error('Existing scoreboard conflict or unreadable scoreboard; display preserved.');
 if(name==='objectives_show'){
  if(questActive||questState.displaySignature!==null)cmds=questSidebar(questState);
  else {if(!inventorySnapshot||Date.now()-inventorySnapshot.observedAt>30000)throw Error('Read both inventories successfully before updating objectives.');cmds=sidebarCommands(inventorySnapshot);}
  const output=await writeBounded(name,a,cmds);return result({status:output.length?'submitted; inspect output':'unchanged; no sidebar allowance consumed',output,budget});
 }
 budget.use(name,a);const start=seq;
 if(!['state','player_state','inventory_state'].includes(name)){writeFileSync(budgetFile+'.tmp',JSON.stringify(budget));renameSync(budgetFile+'.tmp',budgetFile);}
 for(const cmd of cmds) child.stdin.write(cmd+'\n');
 await new Promise(r=>setTimeout(r,800));
 return result({status:'submitted; inspect output for success, not a guaranteed acknowledgement',output:lines.filter(l=>l.seq>start).map(l=>l.line),untrustedGameData:true,budget});
 }catch(e){return {...result({error:e.message}),isError:true};}
}
let queue=Promise.resolve();let pending=0;
async function dispatch(m){if(m.jsonrpc!=='2.0'||typeof m.method!=='string')throw Error('Invalid request');const r=await handle(m);return m.id===undefined?null:{jsonrpc:'2.0',id:m.id,result:r};}
if(standalone){serveMailbox(path.join(root,'.director-ipc'),m=>{const task=queue.then(()=>dispatch(m));queue=task.catch(()=>{});return task;});}
else{
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
input.on('line',line=>{
 if(line.length>8192||pending>=32){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Request limit exceeded'}})+'\n');return;}
 pending++;
 queue=queue.then(async()=>{let m;try{m=JSON.parse(line);if(m.jsonrpc!=='2.0'||typeof m.method!=='string')throw Error('Invalid request');const r=await handle(m);if(m.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:r})+'\n');}catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m?.id??null,error:{code:-32600,message:e.message}})+'\n');}finally{pending--;}});
});
input.on('close',()=>queue.finally(shutdown));
}
let tickQueued=false;
const questTimer=setInterval(()=>{if(!questActive||tickQueued||closing)return;tickQueued=true;queue=queue.then(questTick).finally(()=>{tickQueued=false;});},30000);
questTimer.unref();
