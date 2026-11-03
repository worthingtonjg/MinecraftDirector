// One in-flight save; the next interval begins only after acknowledgement.
export class PeriodicSaver {
 constructor(save,{delay=120000,schedule=setTimeout,cancel=clearTimeout,now=Date.now}={}){this.save=save;this.delay=delay;this.schedule=schedule;this.cancel=cancel;this.now=now;this.active=false;this.timer=null;this.status={active:false,intervalMs:delay,inFlight:false,lastSuccess:null,error:null};}
 start(){if(this.active)return;this.active=true;this.status.active=true;this.run();}
 stop(){this.active=false;this.status.active=false;if(this.timer!==null)this.cancel(this.timer);this.timer=null;}
 async run(){if(!this.active||this.status.inFlight)return;this.status.inFlight=true;try{await this.save();this.status.lastSuccess=this.now();this.status.error=null;}catch(e){this.status.error=e.message;this.stop();}finally{this.status.inFlight=false;}if(this.active)this.timer=this.schedule(()=>this.run(),this.delay);}
}
