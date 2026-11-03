import test from 'node:test';
import assert from 'node:assert/strict';
import {SpawnTickets} from '../chunks.mjs';
test('temporary loading preserves preexisting tickets and recovers owned tickets after restart',async()=>{
 const held=new Set(['0 -32']);let disk=[];const commands=[];
 const execute=async c=>{commands.push(c);const [action,x,z]=c.split(' ').slice(-3);const key=x+' '+z;
  if(action==='query')return [held.has(key)?'Chunk is marked for force loading':'Chunk is not marked for force loading'];
  if(action==='add')held.add(key);else if(action==='remove')held.delete(key);return ['Done'];};
 const make=()=>new SpawnTickets({execute,load:()=>structuredClone(disk),save:s=>disk=structuredClone(s)});
 await make().load();assert.equal(disk.length,3);await make().release();assert.deepEqual([...held],['0 -32']);assert.deepEqual(disk,[]);assert.ok(!commands.some(c=>c.endsWith('remove 0 -32')));
});
