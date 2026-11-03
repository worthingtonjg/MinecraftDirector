// Shared campaign message: durable state, no timers, chat or reward side effects.
export function rememberMessage(state,id,text){
 if(state.systemMessage?.id===id)return;
 state.systemMessage={id,text:String(text)};
}
export function wrapMessage(text,width=30,maxLines=7){
 const words=String(text).replace(/\s+/g,' ').trim().split(' '),lines=[];
 let line='';
 for(let word of words){
  if(line&&line.length+1+word.length>width){lines.push(line);line='';}
  while(word.length>width){if(line){lines.push(line);line='';}lines.push(word.slice(0,width));word=word.slice(width);}
  if(word)line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 if(lines.length>maxLines)return [...lines.slice(0,maxLines-1),'More in your Chronicle...'];
 return lines;
}
