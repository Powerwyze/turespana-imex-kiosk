import {PeaceGate} from './host-peace-gate.js';
export class PeaceTrigger {
 constructor({video,canTrigger,onTrigger,onUnavailable=()=>{}}){Object.assign(this,{video,canTrigger,onTrigger,onUnavailable});this.gate=new PeaceGate();this.epoch=0;this.worker=null;}
 start(){
  if(this.worker)return;
  const epoch=++this.epoch;this.gate.reset();this.worker=new Worker('/host-peace-worker.js');
  const fail=()=>{if(epoch!==this.epoch)return;this.stop();this.onUnavailable();};
  this.timeout=setTimeout(fail,25000);this.worker.onerror=fail;
  this.worker.onmessage=({data})=>{
   if(epoch!==this.epoch)return;
   if(data.type==='error'){fail();return;}
   if(data.type==='ready'){clearTimeout(this.timeout);this.schedule(epoch);}
   if(data.type==='gesture'){
    this.pending=false;
    if(!this.canTrigger()){this.stop();return;}
    if(performance.now()-this.frameAt<2000&&this.gate.observe(data.victory,performance.now())){this.stop();this.onTrigger();return;}
    this.schedule(epoch);
   }
  };
  this.worker.postMessage({type:'init'});
 }
 schedule(epoch){this.timer=setTimeout(async()=>{
  if(epoch!==this.epoch)return;
  if(!this.canTrigger()){this.stop();return;}
  if(document.hidden||this.video.readyState<2){this.gate.reset();this.schedule(epoch);return;}
  try{
   const bitmap=await createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.max(1,Math.round(640*this.video.videoHeight/this.video.videoWidth))});
   if(epoch!==this.epoch){bitmap.close();return;}
   this.frameAt=performance.now();this.pending=true;this.worker.postMessage({type:'frame',bitmap},[bitmap]);
   clearTimeout(this.timeout);this.timeout=setTimeout(()=>{if(epoch===this.epoch){this.stop();this.onUnavailable();}},6000);
  }catch{if(epoch===this.epoch){this.stop();this.onUnavailable();}}
 },300);}
 stop(){this.epoch++;clearTimeout(this.timer);clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;this.pending=false;this.gate.reset();}
}
