import test from 'node:test';
import assert from 'node:assert/strict';
import {isReadyReply,ReadinessReply} from '../public/host-readiness.js';
import {PeaceGate} from '../public/host-peace-gate.js';
test('natural readiness phrases are accepted; questions and negations are not',()=>{
 for(const s of ['Ready!','Okay','Yes','I’m ready','We are ready','Okay, take the picture.','take a photo','sí','listo','go ahead'])assert.equal(isReadyReply(s),true,s);
 for(const s of ['not ready','okay wait','yes but not yet','dont take a picture','are you ready','no','my email is ready','okay change destination'])assert.equal(isReadyReply(s),false,s);
});
test('streamed readiness waits for the whole reply and requires armed state',async()=>{
 let armed=true,fired=0;const r=new ReadinessReply({canTrigger:()=>armed,onReady:()=>fired++,delay:20});
 r.append('okay');r.append(' wait');await new Promise(r=>setTimeout(r,40));assert.equal(fired,0);
 r.append('I am ');r.append('ready');await new Promise(r=>setTimeout(r,40));assert.equal(fired,1);
 r.append('yes');armed=false;await new Promise(r=>setTimeout(r,40));assert.equal(fired,1);
 armed=true;r.append('ready');r.reset();await new Promise(r=>setTimeout(r,40));assert.equal(fired,1);
});
test('held peace sign survives slower inference but needs multiple fresh observations',()=>{
 const g=new PeaceGate();assert.equal(g.observe(true,0),false);assert.equal(g.observe(true,1400),true);assert.equal(g.observe(true,2800),false);
 g.reset();assert.equal(g.observe(true,0),false);assert.equal(g.observe(true,3000),false);assert.equal(g.observe(false,3300),false);
});
