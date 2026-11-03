import readline from 'node:readline';
import {requestMailbox} from './local-ipc.mjs';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('./.director-ipc/',import.meta.url));
let queue=Promise.resolve(),pending=0;
readline.createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{
 if(line.length>8192||pending>=32){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Request limit exceeded'}})+'\n');return;}
 pending++;queue=queue.then(async()=>{let m;try{m=JSON.parse(line);if(m.id===undefined)return;const r=await requestMailbox(dir,m);process.stdout.write(JSON.stringify(r)+'\n');}catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m?.id??null,error:{code:-32603,message:e.message}})+'\n');}finally{pending--;}});
});
