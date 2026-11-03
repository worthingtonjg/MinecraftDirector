import {owns} from './journey.mjs';import{slotName}from'./books.mjs';import{passed}from'./encounters.mjs';import{systemChat}from'./system-chat.mjs';
export async function requestFlameActivation(s,names,{execute,observe,save},p,rescued){const o=s.journey.outpost;
 if(o.activation?.status==='confirmed')return true;
 if(o.activation?.status==='attempted'||o.activation?.status==='uncertain')return false;
 for(const name of names){const out=await execute(`scoreboard players add ${name} hh.light 0\nscoreboard players get ${name} hh.light`),m=out.map(x=>x.match(new RegExp(name+' has (-?\\d+) \\[?hh\\.light\\]?$'))).filter(Boolean);if(m.length!==1)throw Error('Lantern trigger unavailable');
 await execute(`scoreboard players enable ${name} hh.light`);if(Number(m[0][1])===0)continue;
 const reset=await execute(`scoreboard players set ${name} hh.light 0`);if(!reset.some(x=>x.includes(' to 0')))throw Error('Lantern request consumption unconfirmed');
 const inv=(await observe())?.[name]??[],item=inv.find(i=>i.id==='minecraft:soul_torch'&&owns(i,name,'flame:'+name)&&Number.isInteger(i.Slot)&&((i.Slot>=0&&i.Slot<36)||i.Slot===-106));
 if(!rescued||!item){await execute(systemChat(name,'[System] The Lantern is locked. Rescue every designated golem and carry your Harvest Flame, then try again.'));continue;}
 const at=`${p.x} ${p.y} ${p.z}`,guard=`execute in minecraft:overworld positioned ${at} if entity @a[name=${name},distance=..4] if block ${at} minecraft:carved_pumpkin`;
 if(!passed(await execute(guard))){await execute(systemChat(name,'[System] Stand within four blocks of the Harvest Lantern on the upper deck.'));continue;}
 const c=item.components['minecraft:custom_data'],count=item.count??1;if(count!==1){await execute(systemChat(name,'[System] Separate one Harvest Flame into its own inventory slot before lighting.'));continue;}
 o.activation={status:'attempted',player:name,slot:item.Slot};save(s);
 const output=await execute(guard+` if data entity ${name} Inventory[{Slot:${item.Slot}b,id:"minecraft:soul_torch",count:1,components:{"minecraft:custom_data":${JSON.stringify(c)}}}] run item replace entity ${name} ${item.Slot===-106?'weapon.offhand':slotName(item.Slot)} with minecraft:air`);
 const after=await observe();if(output.some(x=>/Replaced .*slot/.test(x))&&after?.[name]&&!after[name].some(i=>i.Slot===item.Slot)){o.activation.status='confirmed';save(s);return true;}
 if(output.some(x=>x.includes('Test failed'))&&after?.[name]?.some(i=>i.Slot===item.Slot&&owns(i,name,'flame:'+name))){delete o.activation;save(s);return false;}
 o.activation.status='uncertain';o.activation.reason='Torch consumption unconfirmed; inspect before retry';save(s);return false;
 }return false;
}
