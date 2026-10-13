// A deliberate held V sign, not a fleeting hand pose, authorizes one countdown.
export class PeaceGate {
 reset(){this.since=null;this.last=null;this.fired=false;}
 constructor(){this.reset();}
 observe(victory,now){
  if(this.fired)return false;
  if(!victory){this.since=null;this.last=null;return false;}
  if(this.last===null||now-this.last>2500)this.since=now;
  this.last=now;
  if(now-this.since<800)return false;
  this.fired=true;return true;
 }
}
