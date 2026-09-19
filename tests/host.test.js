import test from 'node:test';
import assert from 'node:assert/strict';
import {BoothEngine,LiveTools} from '../public/host-engine.js';
import {POST} from '../api/host-session.js';
import {liveSessionConfig} from '../lib/host-config.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('a photo needs both an explicit group size and readiness; repeated calls cannot duplicate paid work',async()=>{
  let finish,captures=0,generations=0;
  const engine=new BoothEngine({capture:async()=>{captures++;return 'source';},generate:()=>{generations++;return new Promise(r=>finish=r);}});
  assert.match((await engine.execute('take_photo',{confirmed:true})).error,/how many/);
  assert.ok((await engine.execute('set_guest_count',{count:4})).error);
  await engine.execute('set_guest_count',{count:2});
  assert.ok((await engine.execute('take_photo',{confirmed:false})).error);
  assert.equal((await engine.execute('take_photo',{confirmed:true})).accepted,true);
  await tick();
  assert.ok((await engine.execute('take_photo',{confirmed:true})).error);
  assert.ok((await engine.execute('set_guest_count',{count:1})).error);
  assert.equal(captures,1);assert.equal(generations,1);
  finish('image');await engine.job;
  assert.equal(engine.phase,'result');assert.equal(engine.count,2);
});
test('reset invalidates late results and clears private photo state',async()=>{
  let finish;
  const engine=new BoothEngine({capture:async()=>new Blob(['photo']),generate:()=>new Promise(r=>finish=r)});
  await engine.execute('set_guest_count',{count:1});await engine.execute('take_photo',{confirmed:true});await tick();
  const job=engine.job;engine.reset();finish(new Blob(['late']));await job;
  assert.equal(engine.image,null);assert.equal(engine.source,null);assert.equal(engine.count,null);assert.equal(engine.phase,'listening');
});
test('failed generation retains source for a deliberate retry without recapture',async()=>{
  let captures=0,calls=0;
  const engine=new BoothEngine({capture:async()=>{captures++;return 'photo';},generate:async()=>{if(++calls===1)throw new Error('Guest check failed');return 'approved';}});
  await engine.execute('set_guest_count',{count:3});await engine.execute('take_photo',{confirmed:true});await engine.job;
  assert.equal(engine.phase,'error');assert.equal(engine.source,'photo');assert.equal(calls,1);
  assert.ok((await engine.execute('retry_picture',{confirmed:false})).error);
  await engine.execute('retry_picture',{confirmed:true});await engine.job;
  assert.equal(engine.phase,'result');assert.equal(captures,1);assert.equal(calls,2);
});
test('Live nested function results are deduplicated and continued after empty terminal snapshots',async()=>{
  const sent=[];let executed=0;
  const loop=new LiveTools({send:e=>sent.push(e),execute:async()=>{executed++;return {accepted:true};}});
  const event=e=>loop.receive({type:'response.event',delegation_id:'delegation',event:e});
  await event({type:'response.created',response:{id:'r1'}});
  const item={type:'function_call',call_id:'call1',name:'take_photo',arguments:'{"confirmed":true}'};
  await event({type:'response.output_item.done',response_id:'r1',item});
  await event({type:'response.output_item.done',response_id:'r1',item});
  assert.equal(sent.length,0);
  await event({type:'response.completed',response:{id:'r1',output:[]}});
  await event({type:'response.completed',response:{id:'r1',output:[]}});
  assert.equal(executed,1);assert.equal(sent.length,2);assert.equal(sent[0].item.call_id,'call1');assert.equal(sent[1].type,'response.create');
});
test('closing a session suppresses late tool results',async()=>{
  const sent=[];let finish;
  const loop=new LiveTools({send:e=>sent.push(e),execute:()=>new Promise(r=>finish=r)});
  const event=e=>loop.receive({type:'response.event',delegation_id:'d',event:e});
  await event({type:'response.created',response:{id:'r'}});
  await event({type:'response.output_item.done',response_id:'r',item:{type:'function_call',call_id:'c',name:'take_photo',arguments:'{}'}});
  await tick();const pending=event({type:'response.completed',response:{id:'r',output:[]}});
  loop.clear();finish({ok:true});await pending;assert.deepEqual(sent,[]);
});
test('session endpoint rejects untrusted requests and returns only connection data',async()=>{
  const previous=process.env.OPENAI_API_KEY,oldEnv=process.env.VERCEL_ENV,oldFetch=globalThis.fetch;
  process.env.OPENAI_API_KEY='test-secret';process.env.VERCEL_ENV='preview';
  try {
    const request=(body,origin='https://booth.test')=>new Request('https://booth.test/api/host-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await POST(request({sdp:'v=0\r\nm=audio'},'https://wrong.test'))).status,403);
    assert.equal((await POST(request({sdp:'invalid'}))).status,400);
    let payload;
    globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({session:{id:'live_test',secret:'never-return'},transport:{sdp:'answer'},other:'private'},{status:201});};
    const response=await POST(request({sdp:'v=0\r\nm=audio',session:{model:'attacker'}}));
    assert.equal(response.status,201);assert.deepEqual(await response.json(),{session:{id:'live_test'},transport:{type:'webrtc',sdp:'answer'}});
    assert.equal(payload.session.model,'gpt-live-1');assert.equal(payload.session.store,false);
    globalThis.fetch=async()=>Response.json({error:{code:'model_not_found',message:'private detail'}},{status:404});
    const failed=await POST(request({sdp:'v=0\r\nm=audio'}));
    assert.equal(failed.status,502);assert.equal((await failed.json()).code,'model_not_found');
    globalThis.fetch=async()=>Response.json({error:{code:'credit_balance_exhausted'}},{status:429});
    const billing=await POST(request({sdp:'v=0\r\nm=audio'}));
    assert.equal(billing.status,503);const billingBody=await billing.json();assert.equal(billingBody.code,'VOICE_BILLING_REQUIRED');assert.match(billingBody.error,/event team/);assert.doesNotMatch(billingBody.error,/busy|try again/);
    process.env.VERCEL_ENV='production';process.env.ENABLE_FACE_HOST='false';
    assert.equal((await POST(request({sdp:'v=0\r\nm=audio'}))).status,403);
  }finally{delete process.env.ENABLE_FACE_HOST;globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;if(oldEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnv;}
});
test('the live frontend cannot change server-owned session configuration',()=>{
  const config=liveSessionConfig();assert.equal(config.client.data_channel.allowed_client_events.includes('session.update'),false);
  assert.equal(config.delegation.responses.parallel_tool_calls,false);
});

test('camera preparation is separate from countdown and blocks overlapping work',async()=>{
  let prepared,finish;const phases=[];
  const engine=new BoothEngine({prepare:()=>new Promise(r=>prepared=r),capture:async()=>'photo',generate:()=>new Promise(r=>finish=r),onChange:s=>phases.push(s.phase)});
  await engine.execute('set_guest_count',{count:2});
  await engine.execute('take_photo',{confirmed:true});
  assert.equal(engine.phase,'preparing');
  assert.ok((await engine.execute('take_photo',{confirmed:true})).error);
  assert.ok((await engine.execute('set_guest_count',{count:1})).error);
  assert.equal(phases.includes('countdown'),false);
  prepared();await tick();
  assert.deepEqual(phases,['listening','preparing','countdown','generating']);
  finish('result');await engine.job;
});
test('reset during camera startup never starts a late countdown or capture',async()=>{
  let prepared,captures=0;
  const engine=new BoothEngine({prepare:()=>new Promise(r=>prepared=r),capture:async()=>{captures++;},generate:async()=>{throw Error('must not generate');}});
  await engine.execute('set_guest_count',{count:1});await engine.execute('take_photo',{confirmed:true});
  const pending=engine.job;engine.reset();prepared();await pending;
  assert.equal(captures,0);assert.equal(engine.phase,'listening');
});
