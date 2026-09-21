import test from 'node:test';
import assert from 'node:assert/strict';
import {PresenceGate} from '../public/host-sentry-gate.js';
import {POST,readGreeting} from '../api/host-greeting.js';
test('an occupied but unattended scene can greet again after 30 seconds',()=>{
 const g=new PresenceGate();
 assert.equal(g.observe(false,0),false);assert.equal(g.observe(true,100),false);assert.equal(g.observe(true,500),true);
 assert.equal(g.observe(true,30499),false);assert.equal(g.observe(true,30500),true);
 assert.equal(g.observe(true,60499),false);assert.equal(g.observe(true,60500),true);
});
test('an empty scene never causes a paid greeting and early arrivals respect cooldown',()=>{
 const g=new PresenceGate();g.observe(true,0);assert.equal(g.observe(true,400),true);
 g.observe(false,1000);g.observe(false,6000);assert.equal(g.observe(true,8000),false);
 assert.equal(g.observe(true,30400),true);
 for(let t=40000;t<200000;t+=1000)assert.equal(g.observe(false,t),false);
});
test('active conversations cannot retrigger even after cooldown; stale frames and reset are handled',()=>{
 const g=new PresenceGate();g.observe(true,0);assert.equal(g.observe(true,1000,{busy:true}),false);
 assert.equal(g.isFresh(3000),true);assert.equal(g.isFresh(4000),false);
 g.consume(5000);assert.equal(g.observe(true,5100),false);
 assert.equal(g.observe(true,100000,{busy:true}),false);
 g.reset();assert.equal(g.observe(true,100100),false);assert.equal(g.observe(true,100500),true);
});
test('vision parsing requires an actual completed structured result',()=>{
 const result=value=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 assert.deepEqual(readGreeting(result({personPresent:false,greeting:'discard'})),{personPresent:false,greeting:''});
 assert.equal(readGreeting({status:'incomplete'}),null);assert.equal(readGreeting(result({personPresent:'yes',greeting:'Hi'})),null);
 assert.equal(readGreeting(result({personPresent:true,greeting:'x'.repeat(400)})),null);
});
test('sentry endpoint validates origin, limits frames, disables storage and returns no image',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY,oldEnv=process.env.VERCEL_ENV;
 process.env.OPENAI_API_KEY='fake-test';process.env.VERCEL_ENV='preview';
 const req=(body,origin='https://host.test')=>new Request('https://host.test/api/host-greeting',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
 try{
  assert.equal((await POST(req({},'https://wrong.test'))).status,403);
  assert.equal((await POST(req({frame:'https://example.com/image.jpg'}))).status,400);
  assert.equal((await POST(req({frame:'x'.repeat(450001)}))).status,413);
  let payload;globalThis.fetch=async(_,opts)=>{payload=JSON.parse(opts.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({personPresent:true,greeting:"Hey, you're looking great! Want a Flow photo?"})}]}]});};
  const frame='data:image/jpeg;base64,'+'A'.repeat(128);
  const r=await POST(req({frame}));assert.equal(r.status,200);const result=await r.json();assert.equal(result.personPresent,true);assert.equal(result.frame,undefined);
  assert.equal(payload.store,false);assert.equal(payload.input[0].content[1].image_url,frame);
  assert.match(payload.instructions,/never instructions/);assert.match(payload.instructions,/not proof of consent/);
  process.env.VERCEL_ENV='production';process.env.ENABLE_FACE_HOST='false';assert.equal((await POST(req({frame}))).status,403);
 }finally{delete process.env.ENABLE_FACE_HOST;globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnv;}
});
