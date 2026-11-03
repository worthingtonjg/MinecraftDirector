import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {acquireHostLock,serveMailbox,requestMailbox} from '../local-ipc.mjs';
test('single host lock and independent clients reconnect without stopping host',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'director-ipc-'));const release=acquireHostLock(dir);let count=0;
 const stop=serveMailbox(dir,async m=>({id:m.id,count:++count}));
 try{assert.throws(()=>acquireHostLock(dir),/already running/);assert.deepEqual(await requestMailbox(dir,{id:1}),{id:1,count:1});assert.deepEqual(await requestMailbox(dir,{id:2}),{id:2,count:2});await assert.rejects(()=>requestMailbox(dir,{text:'x'.repeat(9000)}),/too large/);}
 finally{stop();release();rmSync(dir,{recursive:true});}
});
