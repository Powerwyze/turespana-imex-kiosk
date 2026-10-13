import test from 'node:test';
import assert from 'node:assert/strict';
import {runCountdown,countdownWait} from '../public/host-countdown.js';

test('countdown has one seven-second deadline despite late timer callbacks',async()=>{
  let clock=0;const ticks=[];
  await runCountdown({now:()=>clock,onTick:n=>ticks.push([n,clock]),sleep:async ms=>{clock+=ms+180;}});
  assert.deepEqual(ticks,[[7,0],[6,1180],[5,2180],[4,3180],[3,4180],[2,5180],[1,6180]]);
  assert.equal(clock,7180); // Only the last callback lateness, not seven accumulated delays.
});
test('a busy browser skips stale numbers instead of extending the pose',async()=>{
  let clock=0,first=true;const ticks=[];
  await runCountdown({now:()=>clock,onTick:n=>ticks.push([n,clock]),sleep:async ms=>{clock+=ms+(first?2400:0);first=false;}});
  assert.deepEqual(ticks,[[7,0],[4,3400],[3,4000],[2,5000],[1,6000]]);
  assert.equal(clock,7000);
});
test('cancellation interrupts the countdown and never emits another number',async()=>{
  const controller=new AbortController();let ticks=0;
  await assert.rejects(runCountdown({signal:controller.signal,onTick:()=>{ticks++;controller.abort();}}),{name:'AbortError'});
  assert.equal(ticks,1);
  const waiting=new AbortController(),pending=countdownWait(10000,waiting.signal);
  waiting.abort();await assert.rejects(pending,{name:'AbortError'});
});

