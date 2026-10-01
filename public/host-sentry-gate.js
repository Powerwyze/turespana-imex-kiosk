// Presence-only gate: no identity, face matching, or person history.
export class PresenceGate{
  constructor({dwellMs=350,clearMs=4000,cooldownMs=30000}={}){this.dwellMs=dwellMs;this.clearMs=clearMs;this.cooldownMs=cooldownMs;this.reset();}
  reset(){this.firstSeen=null;this.emptySince=null;this.lastSeen=-Infinity;this.nextAllowed=0;this.armed=true;}
  observe(present,now,{busy=false}={}){
    if(present){this.lastSeen=now;this.emptySince=null;if(this.firstSeen===null)this.firstSeen=now;}
    else{this.firstSeen=null;if(this.emptySince===null)this.emptySince=now;if(now-this.emptySince>=this.clearMs)this.armed=true;}
    // An idle kiosk may welcome the same occupied scene again after 30 seconds.
    if(!busy&&now>=this.nextAllowed)this.armed=true;
    if(present&&!busy&&this.armed&&now>=this.nextAllowed&&now-this.firstSeen>=this.dwellMs){this.armed=false;this.nextAllowed=now+this.cooldownMs;return true;}
    return false;
  }
  isFresh(now){return now-this.lastSeen<2200;}
  consume(now,cooldownMs=this.cooldownMs){this.armed=false;this.nextAllowed=Math.max(this.nextAllowed,now+cooldownMs);this.firstSeen=null;this.emptySince=null;}
}
