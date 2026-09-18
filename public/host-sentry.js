import {PresenceGate} from './host-sentry-gate.js';
export class CameraSentry{
  constructor({video,canGreet,onVisitor,onStatus}){
    this.video=video;this.canGreet=canGreet;this.onVisitor=onVisitor;this.onStatus=onStatus;
    this.gate=new PresenceGate();this.enabled=false;this.epoch=0;this.pending=false;this.inference=false;this.frameId=0;this.lastFrameAt=0;
  }
  async enable(){
    if(this.enabled)return;this.enabled=true;const epoch=++this.epoch;
    this.gate.reset();this.onStatus('starting');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
      if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      this.worker=new Worker('/host-sentry-worker.js');
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Detector took too long to load.')),25000);
        this.worker.onerror=()=>{clearTimeout(timer);reject(new Error('Detector could not load.'));};
        this.worker.onmessage=({data})=>{
          if(epoch!==this.epoch)return;
          if(data.type==='ready'){clearTimeout(timer);resolve();}
          else if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));this.disable(data.message);}
          else if(data.type==='presence'){
            this.inference=false;
            if(performance.now()-this.lastFrameAt>2200)return;
            const trigger=this.gate.observe(data.present,performance.now(),{busy:this.pending||!this.canGreet()});
            if(trigger)this.greet(epoch);
          }
        };
        this.worker.postMessage({type:'init'});
      });
      if(epoch!==this.epoch)return;
      this.worker.onerror=()=>this.disable('Camera sentry paused. Tap Enable sentry to retry.');
      this.onStatus('watching');this.schedule(epoch);
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(epoch===this.epoch)this.disable('Camera disconnected. Tap Enable sentry after reconnecting.');});
    }catch(error){if(epoch===this.epoch)this.disable(error.name==='NotAllowedError'?'Allow camera access to enable sentry.':error.message);}
  }
  schedule(epoch){this.timer=setTimeout(async()=>{
    if(epoch!==this.epoch||!this.enabled)return;
    try{
      if(!document.hidden&&!this.inference&&this.video.readyState>=2){
        this.inference=true;this.lastFrameAt=performance.now();
        const bitmap=await createImageBitmap(this.video,{resizeWidth:320,resizeHeight:Math.max(1,Math.round(320*this.video.videoHeight/this.video.videoWidth))});
        if(epoch!==this.epoch){bitmap.close();return;}
        this.worker.postMessage({type:'frame',frameId:++this.frameId,bitmap},[bitmap]);
      }else if(this.inference&&performance.now()-this.lastFrameAt>6000)throw new Error('Person detection stopped responding.');
    }catch{this.disable('Camera sentry paused. Tap Enable sentry to retry.');return;}
    this.schedule(epoch);
  },350);}
  async greet(epoch){
    if(this.pending||!this.canGreet())return;
    this.pending=true;this.onStatus('greeting');this.controller=new AbortController();
    try{
      // Snapshot the current camera frame now, not the earlier detector frame.
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=Math.round(640*this.video.videoHeight/this.video.videoWidth);
      canvas.getContext('2d').drawImage(this.video,0,0,canvas.width,canvas.height);
      let frame=canvas.toDataURL('image/jpeg',.72);canvas.width=canvas.height=0;
      const response=await fetch('/api/host-greeting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frame}),signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(12000)])});
      frame=null;
      const result=await response.json();
      if(!response.ok)throw new Error('Greeting could not connect.');
      if(epoch!==this.epoch||!this.enabled||!this.canGreet()||!this.gate.isFresh(performance.now()))return;
      if(result.personPresent&&typeof result.greeting==='string')await this.onVisitor(result.greeting);
    }catch(error){
      if(epoch===this.epoch&&error.name!=='AbortError')this.onStatus('watching','Greeting unavailable. Tap the sun to start.');
    }finally{
      if(epoch===this.epoch){this.pending=false;this.controller=null;if(this.enabled)this.onStatus('watching');}
    }
  }
  consume(){this.controller?.abort();this.gate.consume(performance.now());}
  finish({immediate=false}={}){this.controller?.abort();if(immediate)this.gate.reset();else this.gate.consume(performance.now());}
  disable(message=''){
    this.enabled=false;this.epoch++;clearTimeout(this.timer);this.controller?.abort();this.worker?.terminate();this.worker=null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.pending=false;this.inference=false;
    this.onStatus('off',message);
  }
}
