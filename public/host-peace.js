import {PeaceGate} from './host-peace-gate.js';
export class PeaceTrigger {
 constructor({video,canTrigger,onTrigger,onUnavailable=()=>{},onStatus=()=>{},WorkerClass=globalThis.Worker,setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}){
  Object.assign(this,{video,canTrigger,onTrigger,onUnavailable,onStatus,WorkerClass,setTimer,clearTimer});this.gate=new PeaceGate();this.epoch=0;this.worker=null;this.active=false;this.failures=0;
 }
 start(){if(this.active)return;this.active=true;this.failures=0;this.launch();}
 launch(){
  if(!this.active||!this.canTrigger()){this.stop();return;}
  const epoch=++this.epoch;this.gate.reset();this.onStatus('loading');
  const fail=()=>this.fail(epoch);
  try{
   this.worker=new this.WorkerClass('/host-peace-worker.js');
   this.timeout=this.setTimer(fail,25000);this.worker.onerror=fail;
   this.worker.onmessage=({data})=>{
    if(epoch!==this.epoch)return;
    if(data.type==='error'){fail();return;}
    if(data.type==='ready'){this.clearTimer(this.timeout);this.onStatus('ready');this.schedule(epoch);}
    if(data.type==='gesture'){
     this.clearTimer(this.timeout);
     if(!this.canTrigger()){this.stop();return;}
     if(performance.now()-this.frameAt<4000&&this.gate.observe(data.victory,performance.now())){this.stop();this.onTrigger();return;}
     this.schedule(epoch);
    }
   };
   this.worker.postMessage({type:'init'});
  }catch{fail();}
 }
 fail(epoch){
  if(epoch!==this.epoch||!this.active)return;
  this.release();this.failures++;this.onUnavailable();
  // Two delayed recoveries per armed visit; never loop on unsupported browsers.
  if(this.failures<=2&&this.canTrigger()){
   this.onStatus('retrying');this.retry=this.setTimer(()=>{this.retry=null;this.launch();},this.failures*4000);
  }else this.onStatus('unavailable');
 }
 schedule(epoch){this.timer=this.setTimer(async()=>{
  if(epoch!==this.epoch)return;
  if(!this.canTrigger()){this.stop();return;}
  if(document.hidden||this.video.readyState<2){this.gate.reset();this.schedule(epoch);return;}
  try{
   const bitmap=await createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.max(1,Math.round(640*this.video.videoHeight/this.video.videoWidth))});
   if(epoch!==this.epoch){bitmap.close();return;}
   this.frameAt=performance.now();this.worker.postMessage({type:'frame',bitmap},[bitmap]);
   this.timeout=this.setTimer(()=>this.fail(epoch),6000);
  }catch{this.fail(epoch);}
 },300);}
 release(){this.epoch++;this.clearTimer(this.timer);this.clearTimer(this.timeout);this.worker?.terminate();this.worker=null;this.gate.reset();}
 stop(){this.active=false;this.clearTimer(this.retry);this.retry=null;this.release();this.onStatus('off');}
}
