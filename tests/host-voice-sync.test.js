import test from 'node:test';
import assert from 'node:assert/strict';
import {HostVoiceSync} from '../public/host-voice-sync.js';
function fixture(){let time=0,id=0,level=0;const tasks=new Map(),sent=[],audio={muted:false};const gate=new HostVoiceSync({audio,speak:text=>sent.push(text),now:()=>time,getLevel:()=>level,setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:time+ms});return id;},clearTimer:id=>tasks.delete(id)});return {gate,audio,sent,setLevel:value=>level=value,advance(ms){const end=time+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;tasks.delete(next[0]);next[1].fn();}time=end;}};}
const acknowledge=(f,id,time)=>{f.gate.expectStateAck(id);f.gate.acknowledge({type:'session.thinking.appended',client_event_id:id,start_ms:time,end_ms:time+200});};
test('countdown is always muted, but its seven silent seconds allow the next question immediately',()=>{
 const f=fixture();f.gate.transition('listening');f.gate.observeOutput({delta:'Look at the camera.',start_ms:0,end_ms:200});f.gate.transition('countdown');f.gate.speak('wrong countdown narration');f.advance(7000);assert.equal(f.audio.muted,true);assert.deepEqual(f.sent,[]);
 f.gate.transition('choosing_people');acknowledge(f,'people',7200);f.gate.speak('How many people?');assert.equal(f.audio.muted,false);
 assert.equal(f.gate.observeOutput({delta:'How many people are in the picture?',start_ms:7200,end_ms:7400}),true);f.advance(2000);assert.deepEqual(f.sent,[],'do not repeat a question the host already spoke');
});
test('replay of the live19.2s→20.2s transition keeps correct generation narration audible throughout',()=>{
 const f=fixture();f.gate.transition('choosing_destination');f.gate.observeOutput({delta:'one, two, or three?',start_ms:19000,end_ms:19200});f.advance(1000);
 f.gate.transition('generating',{destinationId:'canarias'});f.gate.speak('Generation cue');acknowledge(f,'generating',20200);assert.equal(f.audio.muted,false,'a quiet transition must not invent new speech activity');
 for(let start=20200;start<39000;start+=200){assert.equal(f.gate.observeOutput({delta:start===20200?'Great choice!':' The Canary Islands have national parks.',start_ms:start,end_ms:start+200}),true);assert.equal(f.audio.muted,false);f.advance(200);}
 assert.deepEqual(f.sent,[],'fresh model speech satisfies the pending phase cue');
});
test('active stale questions are suppressed, while continuous acknowledged current-screen speech is released promptly',()=>{
 const f=fixture();f.gate.transition('choosing_people');f.gate.observeOutput({delta:'How many',start_ms:15000,end_ms:15200});f.setLevel(.1);f.gate.transition('generating',{destinationId:'canarias'});acknowledge(f,'generating',15200);f.gate.speak('Generation cue');
 assert.equal(f.gate.observeOutput({delta:'How many people are in the picture?',start_ms:15200,end_ms:15400}),false);assert.equal(f.audio.muted,true);
 f.advance(200);assert.equal(f.gate.observeOutput({delta:'The Canary Islands are an Atlantic archipelago.',start_ms:15400,end_ms:15600}),true);assert.equal(f.audio.muted,false,'valid speech is not held until all narration ends');
 f.advance(2000);assert.deepEqual(f.sent,[]);
});
test('old phase acknowledgments cannot release speech and a new question replaces a queued old one',()=>{
 const f=fixture();f.gate.transition('choosing_people');f.gate.observeOutput({delta:'How many',start_ms:1000,end_ms:1200});f.gate.expectStateAck('people');f.gate.speak('Old question');f.gate.transition('choosing_destination');f.gate.speak('Which city?');f.gate.acknowledge({type:'session.thinking.appended',client_event_id:'people',start_ms:1200});
 assert.equal(f.gate.observeOutput({delta:'Which city?',start_ms:2000,end_ms:2200}),false);f.advance(1000);assert.equal(f.audio.muted,false);assert.deepEqual(f.sent,['Which city?']);
});
test('fresh audio-timeline utterance after current-state acknowledgment can answer a follow-up without a fixed keyword',()=>{
 const f=fixture();f.gate.transition('choosing_destination');f.gate.observeOutput({delta:'Which city?',start_ms:1000,end_ms:1200});f.setLevel(.1);f.gate.transition('generating',{destinationId:'canarias'});acknowledge(f,'generation',1800);f.gate.speak('Generation cue');
 assert.equal(f.gate.observeOutput({delta:'You could explore volcanic landscapes.',start_ms:1800,end_ms:2000}),true);assert.equal(f.audio.muted,false);f.advance(1000);assert.deepEqual(f.sent,[]);
});
test('cleanup cancels delayed narration from the previous visit',()=>{
 const f=fixture();f.gate.transition('result');f.gate.speak('Your photo is ready');f.gate.reset();f.advance(2000);assert.deepEqual(f.sent,[]);
});
test('a fresh connection can speak its first greeting, and queued cue is sent if the host stays quiet',()=>{
 const f=fixture();f.gate.transition('connecting');f.gate.transition('listening');f.gate.speak('Hello');assert.equal(f.audio.muted,false);f.advance(900);assert.deepEqual(f.sent,['Hello']);
});

test('an explicitly wrong-screen question cannot unmute via a long post-ack gap',()=>{
 const f=fixture();f.gate.transition('choosing_people');f.gate.observeOutput({delta:'How many',start_ms:1000,end_ms:1200});f.setLevel(.1);f.gate.transition('generating',{destinationId:'canarias'});acknowledge(f,'generating',1800);f.gate.speak('Current generation cue');
 assert.equal(f.gate.observeOutput({delta:'How many people are in the picture?',start_ms:2200,end_ms:2400}),false);assert.equal(f.audio.muted,true);
 assert.equal(f.gate.observeOutput({delta:'Your photo is being created.',start_ms:2400,end_ms:2600}),true);assert.equal(f.audio.muted,false);f.advance(1000);assert.deepEqual(f.sent,[]);
});

test('four-person option prompts are current on the people screen and stale during generation',()=>{
 for(const question of ['One, two, three, or four?','Uno, dos, tres, o cuatro?']){
  const f=fixture();f.gate.transition('listening');f.gate.observeOutput({delta:'Your photo',start_ms:1000,end_ms:1200});f.setLevel(.1);
  f.gate.transition('choosing_people');acknowledge(f,'people',1200);
  assert.equal(f.gate.observeOutput({delta:question,start_ms:1200,end_ms:1400}),true,question);
  assert.equal(f.audio.muted,false);
  f.gate.transition('generating',{destinationId:'madrid'});acknowledge(f,'generating',2000);
  assert.equal(f.gate.observeOutput({delta:question,start_ms:2000,end_ms:2200}),false,question);
  assert.equal(f.audio.muted,true);
 }
});
