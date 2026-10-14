// Local finishing is best effort. A successful generated photo is never discarded.
export const PORTRAIT_RETOUCH_VERSION='face-skin-v1';
export class PortraitRetoucher {
  constructor({workerFactory=()=>new Worker('/portrait-retouch-worker.js'),timeoutMs=2500,loadTimeoutMs=20000}={}){
    this.workerFactory=workerFactory;this.timeoutMs=timeoutMs;this.loadTimeoutMs=loadTimeoutMs;
    this.jobs=new Map();this.nextId=0;this.epoch=0;
  }
  preload(){
    if(this.loading)return this.loading;
    const epoch=++this.epoch;
    this.loading=new Promise(resolve=>{
      this.loaded=resolve;
      try{
        const worker=this.workerFactory();this.worker=worker;
        this.loadTimer=setTimeout(()=>this.close(),this.loadTimeoutMs);
        worker.onerror=()=>{if(epoch===this.epoch)this.close();};
        worker.onmessage=({data})=>{
          if(epoch!==this.epoch)return;
          if(data.type==='ready'){clearTimeout(this.loadTimer);this.loaded?.(true);this.loaded=null;}
          else if(data.type==='failed')this.close();
          else if(data.type==='finished'){
            const job=this.jobs.get(data.id);
            if(job)job.finish(data.blob instanceof Blob&&data.blob.size?data.blob:job.original);
          }
        };
        worker.postMessage({type:'init'});
      }catch{resolve(false);queueMicrotask(()=>this.close());}
    });
    return this.loading;
  }
  async retouch(original,{signal}={}){
    if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
    const id=++this.nextId;
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(blob,error)=>{
        if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);this.jobs.delete(id);
        if(error)reject(error);else resolve(blob);
      };
      const abort=()=>finish(null,signal.reason||new DOMException('Cancelled','AbortError'));
      const timer=setTimeout(()=>this.close(),this.timeoutMs);
      this.jobs.set(id,{original,finish});signal?.addEventListener('abort',abort,{once:true});
      this.preload().then(ready=>{
        if(settled)return;
        if(!ready){finish(original);return;}
        try{this.worker.postMessage({type:'retouch',id,blob:original});}catch{finish(original);}
      });
    });
  }
  close(){
    ++this.epoch;clearTimeout(this.loadTimer);this.worker?.terminate();this.worker=null;
    this.loaded?.(false);this.loaded=null;this.loading=null;
    for(const job of [...this.jobs.values()])job.finish(job.original);
  }
}
const retoucher=new PortraitRetoucher();
export const preloadPortraitRetouch=()=>retoucher.preload();
export const retouchPortrait=(blob,options)=>retoucher.retouch(blob,options);
