import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {commands,Budget,tools} from '../policy.mjs';
test('all tools have narrow schemas',()=>{assert.equal(tools.length,13);for(const t of tools)assert.equal(t.inputSchema.additionalProperties,false);});
test('reject injection, selectors, unrestricted commands and unknown arguments',()=>{
 for(const [n,a] of [['command',{command:'op @a'}],['reward',{player:'@a',item:'bread',count:1}],['reward',{player:'Alex\nop Alex',item:'bread',count:1}],['message',{text:'hello\nstop'}],['message',{text:'hello',command:'stop'}],['spawn',{mob:'wither',x:0,y:64,z:0,count:1}],['reward',{player:'Alex',item:'command_block',count:1}]])assert.throws(()=>commands(n,a));
});
test('limits and safe construction',()=>{
 assert.throws(()=>commands('spawn',{mob:'cow',x:0,y:64,z:0,count:4}));
 assert.throws(()=>commands('build',{block:'glass',x:61,y:64,z:0}));
 assert.throws(()=>commands('reward',{player:'Alex',item:'bread',count:1.5}));
 assert.equal(commands('build',{block:'glass',x:60,y:64,z:60})[0],'execute in minecraft:overworld run fill 60 64 60 64 64 64 minecraft:glass keep');
 const c=commands('message',{text:'"clickEvent": {"value":"/op"}'})[0];assert.deepEqual(Object.keys(JSON.parse(c.slice('tellraw @a '.length))),['text','color']);
 assert.equal(commands('spawn',{mob:'chicken',x:0,y:64,z:0,count:3}).length,3);
 assert.deepEqual(commands('player_state',{player:'Alex'}),['data get entity Alex Pos','data get entity Alex Health']);
});
test('manual cooldown and per-action limits remain; historical totals do not block play',()=>{
 const b=new Budget();b.actions=2000;b.mobs=900;b.builds=300;
 b.use('spawn',{count:3},10000);assert.throws(()=>b.use('message',{},11000));
 b.use('spawn',{count:3},15000);b.use('build',{},20000);assert.throws(()=>b.use('spawn',{count:4},25000));
});
test('MCP handshake, discovery, dry-run guard, malformed input and clean exit',async()=>{
 const child=spawn(process.execPath,['bridge.mjs'],{cwd:new URL('..',import.meta.url),windowsHide:true});let out='';let err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
 for(const m of [{id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}},{method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'message',arguments:{text:'Hello adventurers!'}}}])child.stdin.write(JSON.stringify({jsonrpc:'2.0',...m})+'\n');
 child.stdin.end('{bad}\n');const code=await new Promise(r=>child.on('exit',r));assert.equal(code,0,err);
 const replies=out.trim().split('\n').map(JSON.parse);assert.equal(replies[0].result.protocolVersion,'2025-03-26');assert.equal(replies[1].result.tools.length,13);assert.equal(replies[2].result.isError,true);assert.match(replies[2].result.content[0].text,/No commands executed/);assert.ok(replies[3].error);
});
test('live launch fails closed without approval',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'director-test-'));
 try{for(const name of ['settings.mjs','bridge.mjs','autosave.mjs','local-ipc.mjs','policy.mjs','sidebar.mjs','inventory.mjs','log-items.json','quests.mjs'])copyFileSync(new URL('../'+name,import.meta.url),path.join(dir,name));
 const child=spawn(process.execPath,['bridge.mjs','--live'],{cwd:dir,windowsHide:true});let err='';child.stderr.on('data',d=>err+=d);const code=await new Promise(r=>child.on('exit',r));assert.notEqual(code,0);assert.match(err,/approval.local.json/);
 }finally{rmSync(dir,{recursive:true});}
});


