import test from 'node:test';import assert from 'node:assert/strict';
import{initialState,pages}from'../chapter.mjs';import{ensureJourney,hunts,deliveryPlan}from'../journey.mjs';import{concurrent,updateConcurrent,collectConcurrent}from'../concurrent-hunts.mjs';import{panelRows,displayCommands}from'../sidebar.mjs';
const make=()=>{const s=initialState();s.step=4;s.players={Alex:{level:2},Steve:{level:2}};ensureJourney(s);concurrent(s);return s;};
const scores=(a=100,b=200,c=300)=>({0:{Alex:a},1:{Alex:b},2:{Alex:c}});
test('all completion orders retain independent map/gear associations and require all hunts plus fragments for finale',()=>{
 for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
 const s=make(),n=[100,200,300];updateConcurrent(s,['Alex'],scores(...n));
 for(const i of order){n[i]+=10;updateConcurrent(s,['Alex'],scores(...n));assert.equal(s.journey.concurrent[i].complete,true);assert.equal(s.journey.receipts[`map:${i}:Alex`].index,i);assert.equal(s.journey.receipts[`gear:${i}:Alex`].index,i);s.journey.recovered[hunts[i].id]={player:'Alex'};assert.deepEqual(collectConcurrent(s,{},['Alex']),[i]);}
 assert.equal(s.journey.phase,'finale');const before=JSON.stringify(s.journey.receipts);updateConcurrent(s,['Alex'],scores(999,999,999));assert.equal(JSON.stringify(s.journey.receipts),before);assert.deepEqual(collectConcurrent(s,{},['Alex']),[]);
 }
 const s=make();for(const h of hunts)s.journey.recovered[h.id]={player:'Alex'};updateConcurrent(s,['Alex'],scores());collectConcurrent(s,{},['Alex']);assert.equal(s.journey.phase,'hunts');
});
test('simultaneous hunts count shared party totals, carry partial progress and establish each joining player baseline',()=>{
 const s=make();updateConcurrent(s,['Alex'],scores());updateConcurrent(s,['Alex'],scores(103,204,305));assert.deepEqual(s.journey.concurrent.map(q=>q.kills),[3,4,5]);
 const copy=JSON.parse(JSON.stringify(s));const both={0:{Alex:104,Steve:999},1:{Alex:205,Steve:999},2:{Alex:306,Steve:999}};updateConcurrent(copy,['Alex','Steve'],both);assert.deepEqual(copy.journey.concurrent.map(q=>q.kills),[4,5,6]);
 updateConcurrent(copy,['Alex','Steve'],{0:{Alex:110,Steve:999},1:{Alex:210,Steve:999},2:{Alex:310,Steve:999}});assert.ok(copy.journey.concurrent.every(q=>q.complete));assert.equal(Object.keys(copy.journey.receipts).length,12);
 for(const i of [0,1,2])assert.equal(deliveryPlan(copy.journey.receipts[`gear:${i}:Steve`],Array.from({length:36},(_,Slot)=>({Slot,id:'minecraft:stone'})),[]).kind,'full');
 const before=JSON.stringify(copy.journey.receipts);updateConcurrent(copy,['Alex'],scores(1000,1000,1000));assert.equal(JSON.stringify(copy.journey.receipts),before);
});
test('migration preserves active kills/baseline and completed payouts, inactive species start at first observation',()=>{
 const s=initialState();s.step=4;s.players.Alex={level:2};const j=ensureJourney(s);Object.assign(j,{index:1,phase:'hunt',kills:3,last:{Alex:50},present:['Alex'],participants:['Alex']});j.receipts['gear:0:Alex']={index:0,kind:'gear',status:'confirmed'};j.events=[{id:'hunt_0',text:'Completed.'}];j.recovered.ember={player:'Alex'};
 const receipts=JSON.stringify(j.receipts);concurrent(s);assert.equal(JSON.stringify(j.receipts),receipts);assert.equal(j.concurrent[0].complete,true);assert.equal(j.concurrent[1].kills,3);assert.deepEqual(j.concurrent[1].last,{Alex:50});
 updateConcurrent(s,['Alex'],{1:{Alex:52},2:{Alex:999}});assert.deepEqual(j.concurrent.map(q=>q.kills),[10,5,0]);
 for(const q of j.concurrent)q.present=[];updateConcurrent(s,['Alex'],{1:{Alex:55},2:{Alex:1005}});assert.deepEqual(j.concurrent.map(q=>q.kills),[10,5,0]);
 assert.equal(j.receipts['gear:0:Alex'].status,'confirmed');
});
test('all three visible together, maps reveal independently, no premature finale or pre-prep spoiler',()=>{
 const s=make();s.journey.routeSites=hunts.map((_,index)=>({index,x:400+index,y:70,z:20,mapId:index}));updateConcurrent(s,['Alex'],scores());
 const lines=panelRows(s);assert.ok(lines.length<=15);assert.equal(lines.filter(x=>x.includes('/10')).length,3);assert.equal(lines.filter(x=>x==='Each hunt: map + enchanted gear').length,1);
 let text=pages(s,'Alex').join('\n');for(const h of hunts)assert.ok(text.includes(h.title));assert.ok(!text.includes('UNLOCKED DESTINATION'));assert.ok(!text.includes('Place torch'));
 updateConcurrent(s,['Alex'],scores(100,210,300));text=pages(s,'Alex').join('\n');assert.ok(text.includes('UNLOCKED DESTINATION: '+hunts[1].title));assert.ok(!text.includes('UNLOCKED DESTINATION: '+hunts[0].title));assert.ok(!text.includes('Place torch'));
 assert.ok(displayCommands(s).length>0);const p=initialState();p.players.Alex={level:1};concurrent(p);assert.ok(!pages(p,'Alex').join('').includes(hunts[1].title));
});
test('bad concurrent snapshot does not partially credit another species',()=>{
 const s=make();updateConcurrent(s,['Alex'],scores());const before=JSON.stringify(s.journey);assert.throws(()=>updateConcurrent(s,['Alex'],{0:{Alex:105},1:{Alex:1},2:{Alex:300}}));assert.equal(JSON.stringify(s.journey),before);
});
test('fragment objective unlocks on first earned map, persists without inventory and counts unique early discoveries',()=>{const s=make();s.systemMessage={id:'test',text:'A long System message '.repeat(30)};s.journey.recovered.flame={player:'Alex'};updateConcurrent(s,['Alex'],scores());assert.ok(!panelRows(s).some(r=>r.startsWith('Fragments recovered:')));updateConcurrent(s,['Alex'],scores(110,202,303));assert.ok(panelRows(s).includes('Fragments recovered: 1/3'));assert.ok(panelRows(s).includes('Team skeletons: 2/10'));const restored=JSON.parse(JSON.stringify(s));restored.journey.receipts['map:0:Alex'].status='confirmed';collectConcurrent(restored,{Alex:[]},['Alex']);assert.ok(panelRows(restored).includes('Fragments recovered: 1/3'));const shard={id:'minecraft:amethyst_shard',Slot:2,count:64,components:{'minecraft:custom_data':{hh_campaign:'hollow_harvest_opening_v1',hh_fragment:'ember'}}};collectConcurrent(restored,{Alex:[shard,{...shard,Slot:3}],Steve:[shard]},['Alex','Steve']);assert.ok(panelRows(restored).includes('Fragments recovered: 2/3'));restored.journey.recovered.unrelated={};assert.ok(panelRows(restored).includes('Fragments recovered: 2/3'));restored.systemMessage={id:'long',text:'A long System message '.repeat(30)};assert.ok(panelRows(restored).length<=14);assert.ok(panelRows(restored).includes('Each hunt: map + enchanted gear'));assert.ok(panelRows(restored).includes('System message'));assert.ok(panelRows(restored).includes('More in your Chronicle...'));restored.journey.concurrent.forEach(q=>{q.complete=true;q.kills=10;});restored.journey.recovered.wick={};collectConcurrent(restored,{},['Alex']);assert.equal(restored.journey.phase,'finale');assert.ok(!panelRows(restored).some(r=>r.startsWith('Fragments recovered:')));});

test('completed hunts vanish individually; pending rewards survive and fragment objective remains',()=>{
 const s=make();updateConcurrent(s,['Alex'],scores());updateConcurrent(s,['Alex'],scores(110,204,308));
 const before=JSON.stringify(s);let lines=panelRows(s);assert.ok(!lines.some(r=>r.startsWith('Team zombies:')));assert.ok(lines.includes('Team skeletons: 4/10'));assert.ok(lines.includes('Team spiders: 8/10'));assert.ok(lines.includes('Each hunt: map + enchanted gear'));assert.ok(lines.includes('Fragments recovered: 0/3'));assert.equal(JSON.stringify(s),before);
 updateConcurrent(s,['Alex'],scores(110,210,310));const restored=JSON.parse(JSON.stringify(s)),snapshot=JSON.stringify(restored);lines=panelRows(restored);assert.ok(!lines.some(r=>/^Team (zombies|skeletons|spiders):/.test(r)));assert.ok(!lines.some(r=>r.includes('Each hunt:')));assert.ok(lines.includes('Fragments recovered: 0/3'));assert.equal(JSON.stringify(restored),snapshot);
 const full=Array.from({length:36},(_,Slot)=>({Slot,id:'minecraft:stone'}));for(let i=0;i<3;i++){const receipt=restored.journey.receipts[`gear:${i}:Alex`];assert.equal(deliveryPlan(receipt,full,[]).kind,'full');assert.notEqual(deliveryPlan(receipt,[],[]).kind,'full');}
 assert.equal(restored.journey.phase,'hunts');for(const h of hunts)restored.journey.recovered[h.id]={player:'Alex'};collectConcurrent(restored,{},['Alex']);assert.equal(restored.journey.phase,'finale');
});
