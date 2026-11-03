// Diagnostic only: bounded to ten minutes, no network or world access.
import {appendFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const file=new URL('./lifetime-probe.log',import.meta.url);
const log=event=>appendFileSync(file,JSON.stringify({time:new Date().toISOString(),pid:process.pid,ppid:process.ppid,event})+'\n');
if(process.argv.includes('--child')){
 log('child start');const timer=setInterval(()=>log('child alive'),5000);
 setTimeout(()=>{clearInterval(timer);log('child normal expiry');},600000);
}else{
 log('parent start');const child=spawn(process.execPath,[new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'--child'],{windowsHide:true,stdio:'ignore'});
 const timer=setInterval(()=>log('parent alive'),5000);
 child.on('exit',(code,signal)=>log('child exit '+code+' '+signal));
 const stop=reason=>{log(reason);clearInterval(timer);child.kill();process.exit(0);};
 process.on('SIGINT',()=>stop('SIGINT'));process.on('SIGTERM',()=>stop('SIGTERM'));
 process.stdin.resume();process.stdin.on('end',()=>stop('stdin EOF'));
 setTimeout(()=>stop('parent normal expiry'),600000);
}
process.on('exit',code=>log('process exit '+code));
