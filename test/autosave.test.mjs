import test from 'node:test';
import assert from 'node:assert/strict';
import {PeriodicSaver} from '../autosave.mjs';
test('saves immediately, schedules two minutes after completion and never overlaps',async()=>{
 let release,calls=0,scheduled,canceled;
 const saver=new PeriodicSaver(()=>{calls++;return new Promise(r=>release=r);},{schedule:(fn,ms)=>{scheduled={fn,ms};return 7;},cancel:id=>canceled=id,now:()=>123});
 saver.start();saver.start();await saver.run();assert.equal(calls,1);assert.equal(scheduled,undefined);
 release();await new Promise(setImmediate);assert.equal(saver.status.lastSuccess,123);assert.equal(scheduled.ms,120000);
 scheduled.fn();assert.equal(calls,2);saver.stop();release();await new Promise(setImmediate);assert.equal(saver.status.active,false);assert.equal(canceled,7);
});
test('failed acknowledgement pauses scheduling rather than retrying concurrent saves',async()=>{
 let scheduled=0;const saver=new PeriodicSaver(async()=>{throw Error('timeout');},{schedule:()=>scheduled++});saver.start();await new Promise(setImmediate);
 assert.equal(saver.status.active,false);assert.equal(saver.status.error,'timeout');assert.equal(saver.status.lastSuccess,null);assert.equal(scheduled,0);
});
