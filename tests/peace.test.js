import test from 'node:test';
import assert from 'node:assert/strict';
import {PeaceGate} from '../public/host-peace-gate.js';
import {PeaceTrigger} from '../public/host-peace.js';
import {liveSessionConfig} from '../lib/host-config.js';
test('a held peace sign tolerates a missed inference but still needs multiple detections',()=>{
 const gate=new PeaceGate();assert.equal(gate.observe(true,0),false);assert.equal(gate.observe(false,300),false);assert.equal(gate.observe(true,600),false);assert.equal(gate.observe(true,1000),true);assert.equal(gate.observe(true,1400),false);
 gate.reset();assert.equal(gate.observe(true,2000),false);assert.equal(gate.observe(false,2300),false);assert.equal(gate.observe(false,2600),false);assert.equal(gate.observe(true,2900),false);
});
test('slower positive detections can trigger without joining unrelated gestures across long gaps',()=>{
 const gate=new PeaceGate();assert.equal(gate.observe(true,0),false);assert.equal(gate.observe(true,1000),false);assert.equal(gate.observe(true,2000),true);
 gate.reset();assert.equal(gate.observe(true,0),false);assert.equal(gate.observe(true,2000),false);assert.equal(gate.observe(true,4000),false);
});
test('worker failures get two bounded delayed retries and stop cancels a pending recovery',()=>{
 let time=0,id=0,starts=0,unavailable=0;const tasks=new Map(),workers=[];
 const setTimer=(fn,ms)=>{tasks.set(++id,{fn,at:time+ms});return id;},clearTimer=id=>tasks.delete(id);
 const advance=ms=>{const end=time+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;tasks.delete(next[0]);next[1].fn();}time=end;};
 class Worker {constructor(){starts++;workers.push(this);}postMessage(){}terminate(){this.terminated=true;}}
 const trigger=new PeaceTrigger({video:{},canTrigger:()=>true,onTrigger:()=>assert.fail('no gesture detected'),onUnavailable:()=>unavailable++,WorkerClass:Worker,setTimer,clearTimer});
 trigger.start();workers.at(-1).onerror();assert.equal(starts,1);advance(3999);assert.equal(starts,1);advance(1);assert.equal(starts,2);
 workers.at(-1).onerror();advance(8000);assert.equal(starts,3);workers.at(-1).onerror();advance(100000);trigger.start();assert.equal(starts,3);assert.equal(unavailable,3);
 trigger.stop();trigger.start();workers.at(-1).onerror();trigger.stop();advance(100000);assert.equal(starts,4);
});
test('voice instructions consistently describe photo-first capture and contact collection during generation',()=>{
 const c=liveSessionConfig();assert.match(c.instructions,/yes, yep, okay/);assert.match(c.instructions,/unrelated question is not readiness/);assert.match(c.delegation.responses.instructions,/do not insist on the word ready/);
 assert.doesNotMatch(c.instructions,/Do not ask for email until the finished image is displayed/);
 assert.match(c.instructions,/During generation, the visible form collects/);
});
