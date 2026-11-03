export const chunks=[{x:0,z:-32},{x:16,z:-32},{x:0,z:-16},{x:16,z:-16}];
export class SpawnTickets {
 constructor({execute,load,save}){this.execute=execute;this.save=save;this.owned=load()??[];if(!Array.isArray(this.owned)||this.owned.some(s=>!chunks.some(c=>c.x===s.x&&c.z===s.z)))throw Error('Invalid temporary ticket ledger');}
 async load(){const results=[];for(const c of chunks){
  const output=await this.execute(`execute in minecraft:overworld run forceload query ${c.x} ${c.z}`);
  if(output.some(l=>/not marked for force loading/.test(l))){
   // Record the absent-before-add ticket first so an interrupted add is recoverable.
   if(!this.owned.some(s=>s.x===c.x&&s.z===c.z)){this.owned.push(c);this.save(this.owned);}
   const added=await this.execute(`execute in minecraft:overworld run forceload add ${c.x} ${c.z}`);results.push({...c,added});
  }else if(output.some(l=>/marked for force loading/.test(l)))results.push({...c,preexisting:true,output});
  else throw Error('Unexpected forceload query response: '+JSON.stringify(output));
 }return results;}
 async release(){const results=[];for(const c of [...this.owned]){
  const output=await this.execute(`execute in minecraft:overworld run forceload remove ${c.x} ${c.z}`);
  const verify=await this.execute(`execute in minecraft:overworld run forceload query ${c.x} ${c.z}`);
  if(!verify.some(l=>/not marked for force loading/.test(l)))throw Error('Temporary ticket release unconfirmed: '+JSON.stringify(verify));
  this.owned=this.owned.filter(s=>s.x!==c.x||s.z!==c.z);this.save(this.owned);results.push({...c,output,verify});
 }return results;}
}
