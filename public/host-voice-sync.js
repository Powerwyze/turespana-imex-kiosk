// gpt-live sessions do not expose a documented cancellation event in this app's
// protocol. Drain obsolete WebRTC speech silently, then request the newest cue.
export class HostVoiceSync {
 constructor({audio,speak,getLevel=()=>0,now=()=>performance.now(),setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}){
  Object.assign(this,{audio,sendSpeech:speak,getLevel,now,setTimer,clearTimer});this.reset();
 }
 reset(){this.clearTimer(this.timer);this.timer=null;this.phase=null;this.pending=null;this.draining=false;this.audio.muted=false;this.lastOutput=this.now();this.lastSound=this.now();}
 transition(phase){
  if(phase===this.phase)return;
  const previous=this.phase;
  this.clearTimer(this.timer);this.phase=phase;this.pending=null;this.draining=true;this.audio.muted=true;this.lastOutput=this.now();this.lastSound=this.now();
  if(phase==='listening'&&[null,'idle','connecting'].includes(previous)){this.draining=false;this.audio.muted=false;return;}
  if(!this.blocked())this.poll();
 }
 blocked(){return ['preparing','countdown','idle','connecting'].includes(this.phase);}
 observeOutput(){this.lastOutput=this.now();return !this.draining&&!this.blocked();}
 speak(content){if(this.blocked())return;if(this.draining)this.pending=content;else this.sendSpeech(content);}
 poll(){
  this.timer=this.setTimer(()=>{
   if(!this.draining||this.blocked())return;
   if(this.getLevel()>.018)this.lastSound=this.now();
   if(this.now()-this.lastOutput>=1200&&this.now()-this.lastSound>=350){
    this.draining=false;this.audio.muted=false;const latest=this.pending;this.pending=null;if(latest)this.sendSpeech(latest);
   }else this.poll();
  },100);
 }
}
