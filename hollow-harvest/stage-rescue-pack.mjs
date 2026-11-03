import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import{rescuePack}from'./rescue.mjs';
// Explicit identity selection is required; never silently choose a subset of the observed three.
const selected=process.argv.slice(2);const candidates=JSON.parse(readFileSync('rescue-candidates.local.json'));
if(!selected.length)throw Error('Select authorized UUIDs before staging rescue pack');
const records=selected.map(uuid=>{const r=candidates.find(x=>x.uuid===uuid);if(!r)throw Error('Unknown captive UUID');return {uuid:r.uuid,bounds:r.bounds};});
const files=rescuePack(records);for(const [f,data]of Object.entries(files)){const path='outpost-rescue-stage/'+f;mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});writeFileSync(path,data);}
const plan=JSON.parse(readFileSync('outpost-plan.local.json'));plan.finale.rescues=records;writeFileSync('outpost-plan.local.json',JSON.stringify(plan,null,2));console.log(JSON.stringify({selected:records.length,stagedOnly:true}));
