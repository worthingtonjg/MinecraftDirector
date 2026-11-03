import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,pages,steps,validateState} from '../chapter.mjs';
import {ensureJourney,hunts} from '../journey.mjs';import {rememberAcquisition} from '../relocation.mjs';
import {planBook,bookItem} from '../books.mjs';import {recordNarrative} from '../narrative.mjs';
function state(){const s=initialState();s.players.Alex={level:1};const j=ensureJourney(s);j.routeSites=hunts.map((_,index)=>({index,x:410+index*30,y:70,z:100+index*20}));return s;}
const text=s=>pages(s,'Alex').join('\n');
test('opening and equipment stages expose only completed/current objectives and essential mechanics',()=>{
 for(let n=0;n<4;n++){const s=state();s.step=n;recordNarrative(s,['Alex']);const t=text(s);
  assert.ok(t.includes(steps[n].name));assert.ok(!t.includes('YOUR WORLD-SPAWN MAP'));assert.ok(!t.includes('LAST FALL'));
  for(let i=n+1;i<4;i++)assert.ok(!t.includes(steps[i].name));
  for(const h of hunts){assert.ok(!t.includes(h.title));assert.ok(!t.includes(h.name));assert.ok(!t.includes(`${h.target} ${h.species}s`));}
  assert.ok(!t.includes('UNLOCKED DESTINATION'));assert.ok(!t.includes('Place torch'));if(n<2)assert.ok(!t.includes('orange bed'));else assert.ok(t.includes('YOUR BED REWARD'));
 }
});
test('beds unlock without hunts, destinations or finale spoilers',()=>{const s=state();s.step=4;const t=text(s);assert.ok(t.includes('orange bed'));for(const h of hunts)assert.ok(!t.includes(h.title));assert.ok(!t.includes('UNLOCKED DESTINATION'));assert.ok(!t.includes('Place torch'));});
test('each hunt reveals its reward but its location only after map unlock',()=>{
 for(let index=0;index<3;index++)for(const phase of ['hunt','search']){const s=state();s.step=4;Object.assign(s.journey,{index,phase});const t=text(s);
  for(let i=0;i<3;i++){assert.equal(t.includes(hunts[i].title),i<=index);assert.equal(t.includes(hunts[i].name),i<=index);const p=s.journey.routeSites[i];assert.equal(t.includes(`X ${p.x}, Y ${p.y}, Z ${p.z}`),i<index||(i===index&&phase==='search'));}
  assert.ok(!t.includes('Place torch'));assert.ok(t.includes(phase==='hunt'?'HUNT RULES':'READING YOUR EARNED MAP'));
 }
});
test('early discoveries preserve experienced story without unlocking future hunts or locations',()=>{const s=state();rememberAcquisition(s,'Alex','flame');const t=text(s);assert.ok(t.includes('flame fragment is safely recorded'));assert.ok(!t.includes(hunts[2].title));assert.ok(!t.includes(hunts[2].name));assert.ok(!t.includes('UNLOCKED DESTINATION'));});
test('finale instructions appear only at the finale; completion retains experienced history',()=>{const s=state();s.step=4;s.journey.index=3;s.journey.phase='finale';assert.ok(text(s).includes('Place torch: 3, 63, -29'));s.journey.events.push({id:'finale_open',text:'Place the torch east of the Harvest Lantern.'});s.journey.phase='done';s.curse.finalLanternRestored=true;const t=text(s);assert.ok(t.includes('Chapter complete!'));assert.ok(t.includes('Place the torch east'));});
test('existing spoiler book migrates once and updates in place without changing progress or receipts',()=>{const s=state();s.bookLayout=5;s.revision=12;s.rewards.test={status:'confirmed'};s.books.Alex={issued:true,status:'confirmed',revision:12};const before=structuredClone(s);validateState(s);assert.equal(s.revision,13);validateState(s);assert.equal(s.revision,13);assert.deepEqual(s.rewards,before.rewards);assert.deepEqual(s.journey,before.journey);const inv=[{Slot:4,id:'minecraft:written_book',components:{'minecraft:custom_data':{hh_campaign:s.campaign,hh_owner:'Alex',hh_revision:12}}}];const p=planBook(s,'Alex',inv);assert.equal(p.kind,'update');assert.equal(p.slot,4);assert.ok(!p.command.includes(hunts[1].title));assert.equal(planBook(s,'Alex',[]).kind,'issue');assert.ok(!bookItem(s,'Alex').includes(hunts[2].title));});
test('rejoin and death recovery preserve current clues, last death and completed narrative',()=>{const s=state();s.step=4;Object.assign(s.journey,{index:1,phase:'search'});s.deaths={Alex:'d'};s.deathReceipts={d:{dimension:'minecraft:overworld',pos:[17,64,-20],status:'coordinates_only'}};s.journey.events=[{id:'first',text:'First remembered event.'},{id:'second',text:'Second remembered event.'}];const copy=JSON.parse(JSON.stringify(s));assert.equal(text(copy),text(s));const t=bookItem(copy,'Alex');assert.ok(!t.includes('X 17, Y 64, Z -20'));assert.deepEqual(copy.deathReceipts,s.deathReceipts);assert.ok(t.includes(hunts[1].title));assert.ok(!t.includes(hunts[2].title));assert.ok(t.indexOf('First remembered event')<t.indexOf('Second remembered event'));});
test('concise opening retains exact requested instructions and removes redundant pages',()=>{
 const s=state();recordNarrative(s,['Alex']);const list=pages(s,'Alex');
 assert.equal(list.length,3);
 assert.equal(list[0],'THE HOLLOW HARVEST\nA Camp Lantern Chronicle\n\nItem collection quests are checked from your inventory.\nRefer back to this Chronicle for updates.\nTo list and pin your latest death, use /trigger hh.deathlist. Choose an older pin: /trigger hh.deathpin set 2 (1-5). Hide: /trigger hh.deathpin set 0.');
 assert.ok(list[1].startsWith('Goal:\n'));
 assert.ok(list[2].startsWith('THE STORY SO FAR'));
 assert.doesNotMatch(list.join('\n'),/PARTY OATH|JOURNAL|YOUR WORLD-SPAWN MAP|LAST FALL|Team: hold/);
 const before=JSON.stringify(s);pages(s,'Alex');assert.equal(JSON.stringify(s),before);
 s.deaths={Alex:'d'};s.deathReceipts={d:{dimension:'minecraft:the_nether',pos:[10,42,20],status:'coordinates_only'}};
 assert.doesNotMatch(pages(s,'Alex').join('\n'),/LAST FALL|X 10, Y 42, Z 20/);
});
