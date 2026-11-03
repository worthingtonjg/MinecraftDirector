import test from 'node:test';import assert from 'node:assert/strict';
import {systemChat} from '../system-chat.mjs';import {initialState} from '../chapter.mjs';import {rows,panelRows} from '../sidebar.mjs';import {recordNarrative,deliverNarrative} from '../narrative.mjs';
test('System chat has exactly one trailing empty line, preserving internal lines and JSON escapes',()=>{
 for(const suffix of ['', '\n','\n\n','\r\n']){const command=systemChat('Alex','[System] A "quote".\nSecond line.'+suffix,'aqua');assert.ok(!command.includes('\n'));const json=JSON.parse(command.slice('tellraw Alex '.length));assert.equal(json.text,'[System] A "quote".\nSecond line.\n');assert.equal(json.color,'aqua');}
 assert.throws(()=>systemChat('@a','x'));
});
test('formatting sends no separate blank chat and preserves once-only narrative receipts',async()=>{
 const s=initialState();recordNarrative(s,['Alex']);const sent=[];const io={execute:async c=>sent.push(c),save:()=>{}};
 await deliverNarrative(s,['Alex'],{},io);await deliverNarrative(s,['Alex'],{},io);assert.equal(sent.length,1);assert.equal(JSON.parse(sent[0].slice('tellraw Alex '.length)).text.endsWith('\n'),true);
});
test('bed reward is below both equipment objectives, ahead of System message, within row budget',()=>{
 const s=initialState();s.step=1;recordNarrative(s,['Alex']);assert.deepEqual(rows(s),['Hands Against the Dark','[ ] Each starter: stone+ pick','[ ] Each starter: stone+ sword','Reward: Bed']);
 const p=panelRows(s);assert.equal(p[3],'Reward: Bed');assert.equal(p[5],'System message');assert.ok(p.length<=13);
});
test('actual scoreboard commands place blue reward below objectives in descending-score order',async()=>{
 const {displayCommands}=await import('../sidebar.mjs');const s=initialState();s.step=1;
 const commands=displayCommands(s),scores={},labels={};
 for(const c of commands){const m=c.match(/^scoreboard players set (hh_row_\d+) hh.opening (\d+)$/);if(m)scores[m[1]]=Number(m[2]);const d=c.match(/^scoreboard players display name (hh_row_\d+) hh.opening (.*)$/);if(d)labels[d[1]]=JSON.parse(d[2]);}
 const rendered=Object.keys(scores).sort((a,b)=>scores[b]-scores[a]).map(k=>labels[k]);
 assert.deepEqual(rendered.map(x=>x.text),rows(s));assert.equal(rendered[3].text,'Reward: Bed');assert.equal(rendered[3].color,'aqua');assert.ok(scores.hh_row_1>scores.hh_row_2&&scores.hh_row_2>scores.hh_row_3);
});
