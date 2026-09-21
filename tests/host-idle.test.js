import test from 'node:test';
import assert from 'node:assert/strict';
import {GuestIdle} from '../public/host-idle.js';
function clock(){
  let now=0,id=0;const pending=new Map();
  return {now:()=>now,setTimer:(fn,ms)=>{pending.set(++id,{fn,at:now+ms});return id;},clearTimer:id=>pending.delete(id),
    advance(ms){const until=now+ms;for(;;){const next=[...pending].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;pending.delete(next[0]);next[1].fn();}now=until;}
  };
}
test('an unattended visit times out at 30 seconds, once',()=>{
  const time=clock();let ended=0;const idle=new GuestIdle({...time,onIdle:()=>ended++});
  idle.start();time.advance(29999);assert.equal(ended,0);time.advance(1);assert.equal(ended,1);
  time.advance(60000);assert.equal(ended,1);
});
test('visitor interaction grants another 30 seconds',()=>{
  const time=clock();let ended=0;const idle=new GuestIdle({...time,onIdle:()=>ended++});
  idle.start();time.advance(20000);idle.touch();time.advance(20000);assert.equal(ended,0);
  time.advance(10000);assert.equal(ended,1);
});
test('photo and email work may finish before the fresh reply window starts',()=>{
  const time=clock();let ended=0;const idle=new GuestIdle({...time,onIdle:()=>ended++});
  idle.start();time.advance(25000);idle.setBusy(true);time.advance(90000);assert.equal(ended,0);
  idle.touch();time.advance(40000);assert.equal(ended,0);
  idle.setBusy(false);time.advance(29999);assert.equal(ended,0);time.advance(1);assert.equal(ended,1);
});
test('non-busy background updates do not extend an inactive visit',()=>{
  const time=clock();let ended=0;const idle=new GuestIdle({...time,onIdle:()=>ended++});
  idle.start();for(let i=0;i<5;i++){time.advance(5000);idle.setBusy(false);}
  time.advance(5000);assert.equal(ended,1);
});
test('closing or disabling a visit clears its timer; manual mode keeps its timeout',()=>{
  const time=clock();let ended=0;const idle=new GuestIdle({...time,onIdle:()=>ended++});
  idle.start();time.advance(20000);idle.stop();time.advance(50000);assert.equal(ended,0);
  idle.start(150000);time.advance(30000);assert.equal(ended,0);time.advance(120000);assert.equal(ended,1);
});
