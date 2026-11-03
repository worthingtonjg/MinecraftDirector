import {settings} from './settings.mjs';
// Read-only Minecraft server-list status probe (no login or gameplay command).
import net from 'node:net';
const host=process.argv[2]??'127.0.0.1',port=25565;
if(!['127.0.0.1',settings.lanAddress].includes(host))throw Error('Unapproved status host');
function vi(n){const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b);}while(n);return Buffer.from(out);}
function str(s){const b=Buffer.from(s);return Buffer.concat([vi(b.length),b]);}
function packet(b){return Buffer.concat([vi(b.length),b]);}
function read(b,start=0){let v=0;for(let i=0;i<5;i++){if(start+i>=b.length)return null;v|=(b[start+i]&127)<<(7*i);if(!(b[start+i]&128))return [v,start+i+1];}throw Error('Invalid VarInt');}
const sock=net.connect(port,host);let data=Buffer.alloc(0);
sock.setTimeout(5000,()=>sock.destroy(Error('Status timeout')));
sock.on('connect',()=>{const p=Buffer.alloc(2);p.writeUInt16BE(port);sock.write(packet(Buffer.concat([vi(0),vi(-1),str(host),p,vi(1)])));sock.write(packet(vi(0)));});
sock.on('data',b=>{data=Buffer.concat([data,b]);if(data.length>1048576)return sock.destroy(Error('Oversized response'));const length=read(data);if(!length||data.length<length[1]+length[0])return;const id=read(data,length[1]);const size=read(data,id[1]);const body=JSON.parse(data.subarray(size[1],size[1]+size[0]).toString());console.log(JSON.stringify({address:host+':'+port,version:body.version,players:body.players,description:body.description},null,2));sock.end();});
sock.on('error',e=>{console.error(e.message);process.exitCode=1;});
