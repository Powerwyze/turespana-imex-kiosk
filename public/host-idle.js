// Visitor inactivity only. Automated speech and status updates do not call touch().
export class GuestIdle{
  constructor({onIdle,now=()=>performance.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
    this.onIdle=onIdle;this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.active=false;this.busy=false;this.timer=null;this.deadline=0;this.timeoutMs=30000;
  }
  start(timeoutMs=30000){this.stop();this.active=true;this.timeoutMs=timeoutMs;this.touch();}
  touch(){if(!this.active)return;this.deadline=this.now()+this.timeoutMs;this.schedule();}
  setBusy(busy){
    if(this.busy===busy)return;
    this.busy=busy;
    // Give the visitor a full reply window after their photo or email finishes.
    if(!busy)this.touch();else this.schedule();
  }
  schedule(){
    this.clearTimer(this.timer);this.timer=null;
    if(!this.active||this.busy)return;
    this.timer=this.setTimer(()=>{
      this.timer=null;
      if(!this.active||this.busy)return;
      if(this.now()<this.deadline){this.schedule();return;}
      this.active=false;this.onIdle();
    },Math.max(0,this.deadline-this.now()));
  }
  stop(){this.clearTimer(this.timer);this.timer=null;this.active=false;this.busy=false;}
}
