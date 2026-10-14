import test from 'node:test';
import assert from 'node:assert/strict';
import {PortraitRetoucher} from '../public/portrait-retouch.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class FakeWorker{
  messages=[];terminated=false;
  postMessage(data){this.messages.push(data);}
  terminate(){this.terminated=true;}
  emit(data){this.onmessage?.({data});}
}
test('finishing preloads once, associates replies with each photo, and returns the processed bytes',async()=>{
  const worker=new FakeWorker(),service=new PortraitRetoucher({workerFactory:()=>worker});
  const loading=service.preload();assert.equal(service.preload(),loading);worker.emit({type:'ready'});assert.equal(await loading,true);
  const a=new Blob(['a']),b=new Blob(['b']),output=new Blob(['smoothed']);
  const pendingA=service.retouch(a),pendingB=service.retouch(b);await delay(0);
  const jobs=worker.messages.filter(m=>m.type==='retouch');assert.equal(jobs.length,2);
  worker.emit({type:'finished',id:jobs[1].id,blob:output});worker.emit({type:'finished',id:jobs[0].id,blob:a});
  assert.equal(await pendingA,a);assert.equal(await pendingB,output);service.close();
});
test('a missing model or hung filter is bounded and always retains the generated photo',async()=>{
  for(const ready of [false,true]){
    const worker=new FakeWorker(),service=new PortraitRetoucher({workerFactory:()=>worker,timeoutMs:15});
    const loading=service.preload();if(ready){worker.emit({type:'ready'});await loading;}
    const original=new Blob(['photo']);assert.equal(await service.retouch(original),original);assert.equal(worker.terminated,true);
  }
});
test('worker errors and invalid results fall back to the original photograph',async()=>{
  const worker=new FakeWorker(),service=new PortraitRetoucher({workerFactory:()=>worker});
  service.preload();worker.emit({type:'ready'});const original=new Blob(['photo']),pending=service.retouch(original);await delay(0);
  worker.emit({type:'finished',id:worker.messages.at(-1).id,blob:new Blob([])});assert.equal(await pending,original);
  const next=service.retouch(original);worker.onerror();assert.equal(await next,original);
});
test('reset cancellation rejects promptly and a late result cannot update a subsequent photo',async()=>{
  const workers=[],service=new PortraitRetoucher({workerFactory:()=>{const w=new FakeWorker();workers.push(w);return w;}});
  service.preload();workers[0].emit({type:'ready'});
  const controller=new AbortController(),original=new Blob(['old']),pending=service.retouch(original,{signal:controller.signal});await delay(0);
  const oldId=workers[0].messages.at(-1).id;controller.abort();await assert.rejects(pending,{name:'AbortError'});
  service.close();service.preload();workers[1].emit({type:'ready'});
  const newer=new Blob(['new']),next=service.retouch(newer);await delay(0);
  workers[0].emit({type:'finished',id:oldId,blob:new Blob(['stale'])});
  workers[1].emit({type:'finished',id:workers[1].messages.at(-1).id,blob:newer});assert.equal(await next,newer);service.close();
});
test('unavailable Worker still delivers the generated photo',async()=>{
  const service=new PortraitRetoucher({workerFactory:()=>{throw Error('Unavailable');}}),photo=new Blob(['photo']);
  assert.equal(await service.retouch(photo),photo);service.close();
});
