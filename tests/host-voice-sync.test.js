import test from 'node:test';
import assert from 'node:assert/strict';
import {HostVoiceSync} from '../public/host-voice-sync.js';
function fixture(){let time=0,id=0,level=0;const tasks=new Map(),sent=[],audio={muted:false};const gate=new HostVoiceSync({audio,speak:text=>sent.push(text),now:()=>time,getLevel:()=>level,setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:time+ms});return id;},clearTimer:id=>tasks.delete(id)});return {gate,audio,sent,setLevel:value=>level=value,advance(ms){const end=time+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;tasks.delete(next[0]);next[1].fn();}time=end;}};}
test('countdown stays muted and only the newest screen cue plays after obsolete speech drains',()=>{
 const f=fixture();f.gate.transition('countdown');f.gate.speak('wrong countdown narration');f.advance(7000);assert.equal(f.audio.muted,true);assert.deepEqual(f.sent,[]);
 f.gate.transition('choosing_people');f.gate.speak('How many people?');f.advance(500);assert.equal(f.gate.observeOutput(),false);f.advance(1000);assert.equal(f.audio.muted,true);f.advance(200);assert.equal(f.audio.muted,false);assert.deepEqual(f.sent,['How many people?']);
});
test('a quick new transition discards a pending old question and waits for actual audio to fall quiet',()=>{
 const f=fixture();f.gate.transition('choosing_people');f.gate.speak('Old people question');f.advance(100);f.gate.transition('choosing_destination');f.gate.speak('Which city?');f.setLevel(.1);f.advance(3000);assert.equal(f.audio.muted,true);assert.deepEqual(f.sent,[]);
 f.setLevel(0);f.advance(400);assert.equal(f.audio.muted,false);assert.deepEqual(f.sent,['Which city?']);assert.equal(f.gate.observeOutput(),true);
});
test('cleanup cancels delayed narration from the previous visit',()=>{
 const f=fixture();f.gate.transition('result');f.gate.speak('Your photo is ready');f.gate.reset();f.advance(2000);assert.deepEqual(f.sent,[]);
});

test('a fresh voice connection can speak its first greeting without suppressing it',()=>{const f=fixture();f.gate.transition('connecting');f.gate.transition('listening');f.gate.speak('Hello');assert.equal(f.audio.muted,false);assert.deepEqual(f.sent,['Hello']);});
