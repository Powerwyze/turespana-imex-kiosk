import test from 'node:test';
import assert from 'node:assert/strict';
import {GenerationSpeech} from '../public/generation-speech.js';
import {generationLine} from '../public/generation-lines.js';
import {TurespanaEngine} from '../public/turespana-engine.js';
import {GET} from '../api/host-narration.js';

function fixture(fetchImpl=async()=>new Response(new Uint8Array([1,2,3]))){
 const played=[],stopped=[],text=[];let blocked=0;
 const context={state:'running',destination:{},resume:async()=>{},decodeAudioData:async()=>({}),createBufferSource:()=>({connect(){},disconnect(){},start(){played.push(true);},stop(){stopped.push(true);}})};
 const speech=new GenerationSpeech({getContext:()=>context,fetchImpl,onText:value=>text.push(value),onBlocked:()=>blocked++,synth:null});
 return {speech,played,stopped,text,context,blocked:()=>blocked};
}
test('destination audio is prefetched once and starts without a live voice connection',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return new Response(new Uint8Array([1]));});
 await f.speech.prefetch('madrid');await f.speech.start('madrid');assert.equal(calls,1);assert.equal(f.played.length,1);assert.match(f.text[0],/Lola/);
 f.speech.stop();assert.equal(f.stopped.length,1);
});
test('leaving generation prevents pending narration from starting',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>finish=resolve));
 const started=f.speech.start('barcelona');f.speech.stop();finish(new Response(new Uint8Array([1])));await started;assert.equal(f.played.length,0);
});
test('autoplay restriction exposes a resume action rather than failing the portrait',async()=>{
 const f=fixture();f.context.state='suspended';await f.speech.start('bilbao');assert.equal(f.blocked(),1);assert.equal(f.played.length,0);
});
test('touch capture triggers narration during generation without delaying the image request',async()=>{
 const f=fixture();let narration,release,generated=false;
 const engine=new TurespanaEngine({capture:async()=>new Blob(['source']),generate:()=>{generated=true;return new Promise(resolve=>release=resolve);},onChange:state=>{
  if(state.phase==='generating')narration=f.speech.start(state.destinationId);else f.speech.stop();
 }});
 await engine.execute('take_photo',{confirmed:true});await engine.job;await engine.execute('set_guest_count',{count:1});await f.speech.prefetch('canarias');await engine.execute('set_destination',{destinationId:'canarias'});
 await new Promise(resolve=>setImmediate(resolve));await narration;assert.equal(generated,true);assert.equal(f.played.length,1);assert.equal(engine.phase,'generating');
 release(new Blob(['portrait']));await engine.job;assert.equal(f.stopped.length,1);
});
test('fixed destination clips reject arbitrary text and reuse server audio across requests',async()=>{
 const priorFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.match(String(url),/audio\/speech$/);const body=JSON.parse(init.body);assert.equal(body.voice,'marin');assert.equal(body.input,generationLine('valencia'));return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}});};
 try{
  assert.equal((await GET(new Request('https://kiosk.test/api/host-narration?destinationId=bad'))).status,400);assert.equal(calls,0);
  const request=()=>new Request('https://kiosk.test/api/host-narration?destinationId=valencia');
  const [a,b]=await Promise.all([GET(request()),GET(request())]);assert.equal(calls,1);assert.equal(a.status,200);assert.equal(b.headers.get('content-type'),'audio/mpeg');assert.match(a.headers.get('cache-control'),/s-maxage/);
 }finally{globalThis.fetch=priorFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
