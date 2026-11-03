import {premise} from './story-time.mjs';
import {systemChat} from './system-chat.mjs';
import {advance,initialState,validateState,introduction,claimReward,steps} from './chapter.mjs';
import {planBook,reserveBook,confirmBook} from './books.mjs';
import {recordNarrative,deliverNarrative,remindAfterBook} from './narrative.mjs';
export class ChapterController {
 constructor({load,save,observe,execute,display=async()=>{},deathCheck=async()=>({}),journeyCheck=async()=>{},possessionCheck=async()=>{},timeCheck=async()=>{}}){this.timeCheck=timeCheck;this.state=validateState(load()??initialState());this.save=save;this.observe=observe;this.execute=execute;this.display=display;this.deathCheck=deathCheck;this.journeyCheck=journeyCheck;this.possessionCheck=possessionCheck;this.enabled=false;this.busy=false;this.error=null;this.waiting=true;}
 status(){return {enabled:this.enabled,checking:this.busy,waitingForPlayers:this.waiting,error:this.error,chapter:'The Silent Lantern',step:steps[this.state.step]?.name??'Opening complete',state:this.state};}
 async tick(){
  if(!this.enabled||this.busy)return;this.busy=true;
  try{
   const samples=await this.observe();if(!samples||Object.keys(samples).length===0){this.waiting=true;if(this.state.journey){this.state.journey.present=[];for(const q of this.state.journey.concurrent??[])q.present=[];this.save(this.state);}return;}this.waiting=false;
   recordNarrative(this.state,Object.keys(samples));
   this.state=advance(this.state,samples).state;await this.timeCheck(this.state);recordNarrative(this.state,Object.keys(samples));this.save(this.state);
   const alive=await this.deathCheck(this.state,Object.keys(samples));
   await this.possessionCheck(this.state,samples,alive);
   await this.journeyCheck(this.state,samples,alive);
   await this.display(this.state);
   for(const p of Object.keys(samples)){
    if(alive[p]===false)continue;
    if(!this.state.players[p].introduced||this.state.players[p].curseEdition!==1){this.state.players[p].introduced=true;this.state.players[p].curseEdition=1;this.save(this.state);await this.execute(systemChat(p,'[System] '+premise(this.state)));}
    await deliverNarrative(this.state,[p],alive,{execute:this.execute,save:this.save});
    const bookInventory=(await this.observe())?.[p];if(!bookInventory)continue;
    const plan=planBook(this.state,p,bookInventory);
    if(['issue','update'].includes(plan.kind)){reserveBook(this.state,p,plan);this.save(this.state);await this.execute(plan.command);const after=await this.observe();if(after?.[p])confirmBook(this.state,p,after[p]);this.save(this.state);}
    else if(plan.kind==='current'){confirmBook(this.state,p,bookInventory);this.save(this.state);}
    else if(['wait','blocked'].includes(plan.kind)){this.state.books[p]={...this.state.books[p],notice:plan.reason};this.save(this.state);}
    if(['issue','update','current'].includes(plan.kind))await remindAfterBook(this.state,p,{execute:this.execute,save:this.save});
   }
   // All simultaneous completions are entitled first, then dispatched serially.
   const current=await this.observe();if(!current)return;
   for(const [key,r]of Object.entries(this.state.rewards)){
    const inventory=current[r.player];if(!inventory||alive[r.player]===false||r.status!=='pending')continue;
    const free=inventory.filter(i=>i.Slot>=0&&i.Slot<36).length<36||inventory.some(i=>i.id==='minecraft:bread'&&(i.count??1)<64);
    if(!free)continue;
    const claimed=claimReward(this.state,key);if(!claimed)continue;this.save(this.state);
    const output=await this.execute(`give ${claimed.player} minecraft:bread 1`);
    this.state.rewards[key].status=output.some(l=>l.includes(`Gave 1 [Bread] to ${claimed.player}`))?'confirmed':'uncertain';this.save(this.state);
   }
   this.error=null;
  }catch(e){this.error=e.message;this.enabled=false;}finally{this.busy=false;}
 }
}

