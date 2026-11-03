import {existsSync,readFileSync,writeFileSync,renameSync,unlinkSync,readdirSync,statSync,openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const valid=/^[0-9a-f-]{36}\.request\.json$/;
export function acquireHostLock(dir){
 const file=path.join(dir,'host.lock');
 if(existsSync(file)){
  const old=JSON.parse(readFileSync(file,'utf8'));
  if(!Number.isSafeInteger(old.pid)||old.pid<=0)throw Error('Invalid host lock; inspect before recovery');
  try{process.kill(old.pid,0);throw Error('Director host already running');}catch(e){if(e.code!=='ESRCH')throw e;}
  unlinkSync(file);
 }
 const fd=openSync(file,'wx');writeFileSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString()}));closeSync(fd);
 return ()=>{try{if(JSON.parse(readFileSync(file,'utf8')).pid===process.pid)unlinkSync(file);}catch{}};
}
export function serveMailbox(dir,dispatch){
 // Permission is enforced by the launcher: only the current Windows user and SYSTEM.
 let busy=false,stopped=false;
 const tick=async()=>{
  if(busy||stopped)return;busy=true;
  try{for(const name of readdirSync(dir).filter(n=>valid.test(n)).slice(0,32)){
   const file=path.join(dir,name),response=file.replace('.request.json','.response.json');
   let result;
   try{if(statSync(file).size>8192)throw Error('Request too large');const m=JSON.parse(readFileSync(file,'utf8'));unlinkSync(file);result=await dispatch(m);}
   catch(e){result={jsonrpc:'2.0',id:null,error:{code:-32600,message:e.message}};try{unlinkSync(file);}catch{}}
   writeFileSync(response+'.tmp',JSON.stringify(result??null));renameSync(response+'.tmp',response);
  }}finally{busy=false;}
 };
 const timer=setInterval(()=>tick().catch(()=>{}),200);
 return ()=>{stopped=true;clearInterval(timer);};
}
export async function requestMailbox(dir,message,timeoutMs=45000){
 const body=JSON.stringify(message);if(Buffer.byteLength(body)>8192)throw Error('Request too large');
 if(!existsSync(path.join(dir,'host.lock')))throw Error('Director host is not running; launch Start-Director.ps1');
 const id=randomUUID(),file=path.join(dir,id+'.request.json'),response=path.join(dir,id+'.response.json');
 writeFileSync(file+'.tmp',body,{flag:'wx'});renameSync(file+'.tmp',file);
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){if(existsSync(response)){const result=JSON.parse(readFileSync(response,'utf8'));unlinkSync(response);return result;}await new Promise(r=>setTimeout(r,100));}
 // Outcome may be uncertain: callers must not repeat a write automatically.
 throw Error('Host response timeout; outcome uncertain, do not automatically retry writes');
}
