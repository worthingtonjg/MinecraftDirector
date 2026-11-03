import {onlineNames} from '../inventory.mjs';
// One trailing newline produces exactly one empty rendered line in Java 26.3.
export function systemChat(player,text,color='gold'){
 onlineNames([player]);
 const spaced=String(text).replace(/[\r\n]+$/,'')+'\n';
 return `tellraw ${player} ${JSON.stringify({text:spaced,color})}`;
}
