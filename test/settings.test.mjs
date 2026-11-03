import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,validateSettings} from '../settings.mjs';
test('offline settings are synthetic even with local state present',()=>{assert.deepEqual(settings.players,['PlayerOne','PlayerTwo']);assert.equal(settings.lanAddress,'127.0.0.1');});
test('local settings reject unsafe identity, network and unknown values',()=>{for(const x of [{players:['@a']},{players:['Alex','Alex']},{lanAddress:'localhost\nstop'},{campObjective:'bad id'},{spawnMarker:'bad;id'},{secret:'x'}])assert.throws(()=>validateSettings(x));assert.equal(validateSettings({players:['Alex'],lanAddress:'127.0.0.1',campObjective:'mcd.existing'}).campObjective,'mcd.existing');});
