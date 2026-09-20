import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const allowed=["/assets/examples/regional-clothing.jpg","/assets/spain-background.png", "/assets/examples/andalucia.webp", "/assets/examples/madrid.webp", "/assets/examples/barcelona.webp", "/assets/examples/bilbao.webp", "/assets/examples/canarias.webp", "/assets/examples/valencia.webp"].concat(['/host.html','/host.css','/host.js','/host-engine.js','/host-connection.js','/host-touch.js','/turespana-engine.js','/host-countdown.js','/host-idle.js','/host-captions.js','/host-email.js','/host-avatar.js','/host-sentry.js','/host-sentry-gate.js','/host-sentry-worker.js','/assets/person-detector.tflite','/tests/fixtures/sentry-person.jpg','/email-shortcuts.js','/assets/spain-sun.glb','/assets/spain-sun-fallback.svg','/assets/flow-event-background.jpg','/assets/fonts/fraunces.woff2','/assets/fonts/borel.woff2']);
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!allowed.includes(pathname)&&!/^\/vendor\/(three|vision)\/[a-zA-Z0-9/_.-]+\.(js|mjs|wasm)$/.test(pathname)){res.writeHead(404);res.end();return;}
  const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.mjs':'text/javascript','.wasm':'application/wasm','.tflite':'application/octet-stream','.woff2':'font/woff2'}[path.extname(pathname)];
  res.writeHead(200,{'Content-Type':type});res.end(await fs.readFile(path.join(root,pathname.startsWith('/tests/')?pathname:'public'+pathname)));
});
await new Promise(r=>server.listen(4181,'127.0.0.1',r));
await fs.mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1080,height:1920},permissions:['camera','microphone']});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
// Generate a genuine browser SDP artifact for an independent server configuration smoke check.
await page.goto('http://127.0.0.1:4181/host.html');
await page.waitForFunction(()=>document.querySelector('#face').dataset.avatar==='ready',null,{timeout:20000});
assert.equal(await page.locator('#avatar').evaluate(e=>e.tagName),'CANVAS');
assert.equal(await page.locator('#avatarFallback').getAttribute('src'),'/assets/spain-sun-fallback.svg');
assert.equal(await page.locator('#avatarFallback').evaluate(e=>getComputedStyle(e).visibility),'hidden');
assert.equal(await page.locator('#face img[src$="spain-info-logo.png"]').count(),0,'No words or white logo card remain');



const sdp=await page.evaluate(async()=>{
  const pc=new RTCPeerConnection();const mic=await navigator.mediaDevices.getUserMedia({audio:true});mic.getTracks().forEach(t=>pc.addTrack(t,mic));pc.createDataChannel('oai-events');
  await pc.setLocalDescription(await pc.createOffer());
  for(let i=0;i<100&&pc.iceGatheringState!=='complete';i++)await new Promise(r=>setTimeout(r,50));
  const sdp=pc.localDescription.sdp;pc.close();mic.getTracks().forEach(t=>t.stop());return sdp;
});
await fs.writeFile('artifacts/offer.json',JSON.stringify({sdp}));
// Fake only the remote voice service; browser capture, generation state and rendering are real.
await page.addInitScript(()=>{
  class FakeChannel extends EventTarget{
    readyState='open';
    send(raw){const e=JSON.parse(raw);window.__sent.push(e);if(e.type==='session.instructions.append')queueMicrotask(()=>this.emit({type:'session.instructions.appended',client_event_id:e.event_id}));if(e.type==='session.close')queueMicrotask(()=>this.emit({type:'session.closed'}));}
    emit(e){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(e)}));}
    close(){this.readyState='closed';}
  }
  window.__sent=[];window.__toolIndex=0;window.__videoRequests=0;window.__cameraDelay=1200;
  const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{
    if(constraints.video){window.__videoRequests++;await new Promise(r=>setTimeout(r,window.__cameraDelay));}
    return getMedia(constraints);
  };
  window.addEventListener('DOMContentLoaded',()=>{
    window.__countdownTiming={ticks:[],preparing:null,captured:null,generating:null};
    const capture=document.getElementById('capture').getContext('2d'),draw=capture.drawImage.bind(capture);
    capture.drawImage=(...args)=>{window.__countdownTiming.captured=performance.now();return draw(...args);};
    new MutationObserver(()=>{
      const timing=window.__countdownTiming,phase=document.body.dataset.phase;
      if(phase==='preparing'&&timing.preparing===null)timing.preparing=performance.now();
      if(phase==='countdown'){
        const n=Number(document.getElementById('countdown').textContent);
        if(n&&timing.ticks.at(-1)?.n!==n)timing.ticks.push({n,at:performance.now()});
      }
      if(phase==='generating'&&timing.generating===null)timing.generating=performance.now();
    }).observe(document.body,{attributes:true,childList:true,characterData:true,subtree:true});
  });
  window.RTCPeerConnection=class extends EventTarget {
    iceGatheringState='complete';connectionState='connected';localDescription={sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111'};
    addTrack(){}
    createDataChannel(){window.__channel=new FakeChannel();return window.__channel;}
    async createOffer(){return {type:'offer',sdp:this.localDescription.sdp};}
    async setLocalDescription(){}
    async setRemoteDescription(){queueMicrotask(()=>window.__channel.emit({type:'session.started',session:{id:'live_synthetic'}}));}
    close(){}
  };
});
let generations=0,release,fail=false,emails=0,lastEmail=null,emailFail=false,holdEmail=false,releaseEmail;
await page.route('**/api/host-email',async route=>{emails++;lastEmail=route.request().postDataJSON().email;if(holdEmail)await new Promise(r=>releaseEmail=r);else await new Promise(r=>setTimeout(r,350));await route.fulfill({status:emailFail?502:200,contentType:'application/json',body:JSON.stringify({ok:!emailFail})});});
const image=await fs.readFile(path.join(root,'tests/fixtures/sentry-person.jpg'));
await page.route('**/api/host-session',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({session:{id:'live_synthetic'},transport:{sdp:'synthetic answer'}})}));
await page.route('**/api/host-photo',async route=>{
  generations++;
  const body=route.request().postDataBuffer().toString('latin1');assert.match(body,/name="guestCount"\r\n\r\n2/);
  await new Promise(r=>release=r);
  await route.fulfill(fail?{status:422,contentType:'application/json',body:'{"code":"SUBJECT_COUNT_MISMATCH"}'}:{status:200,contentType:'image/jpeg',body:image});
});
const tool=async(name,args,duplicate=false)=>{
  if(name==='set_guest_count')await tool('set_destination',{destinationId:'madrid'});
  await page.evaluate(({name,args,duplicate})=>{
    const id='response'+(++window.__toolIndex),call_id='call'+window.__toolIndex;
    const emit=event=>window.__channel.emit({type:'response.event',delegation_id:'delegation',event});
    emit({type:'response.created',response:{id}});
    const e={type:'response.output_item.done',response_id:id,item:{type:'function_call',name,arguments:JSON.stringify(args),call_id}};
    emit(e);if(duplicate)emit(e);emit({type:'response.completed',response:{id,output:[]}});
  },{name,args,duplicate});
};
try{
  await page.reload();await page.waitForFunction(()=>document.querySelector('#face').dataset.avatar==='ready',null,{timeout:20000});await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/host-idle-portrait.png'});
  for(const [name,width,height] of [['kiosk',1080,1920],['phone',390,844],['compact',390,667],['desktop',1280,720],['landscape',844,390]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(900);
    await page.screenshot({path:'artifacts/host-idle-'+name+'.png'});
    console.log('Idle layout',name,await page.evaluate(()=>Object.fromEntries(['destinationExamples','face','intro','touchControls'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{top:r.top,bottom:r.bottom,left:r.left,right:r.right}]}))));
    assert.ok(await page.locator('#destinationExamples').evaluate(e=>{const r=e.getBoundingClientRect(),f=document.querySelector('#face').getBoundingClientRect(),h=document.querySelector('#intro').getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=h.bottom-1&&(r.right<=f.left||r.bottom<=f.top);}), 'Idle examples clear the heading and avatar on '+name);
    await page.screenshot({path:'artifacts/host-idle-'+name+'.png'});
  }
  await page.setViewportSize({width:1080,height:1920});await page.waitForTimeout(900);
  await page.locator('#face').click();await page.waitForFunction(()=>document.body.dataset.phase==='listening');
  // Captions are actual outgoing deltas, safely rendered above Lola at kiosk and phone sizes.
  const say=async delta=>page.evaluate(delta=>window.__channel.emit({type:'session.output_transcript.delta',delta}),delta);
  const captionBounds=async()=>page.evaluate(()=>{
    const caption=document.querySelector('#hostCaptions').getBoundingClientRect(),sun=document.querySelector('#face').getBoundingClientRect();
    return {above:caption.bottom<=sun.top+1,onScreen:caption.top>=74&&caption.left>=0&&caption.right<=innerWidth,width:caption.width,captionBottom:caption.bottom,sunTop:sun.top};
  });
  assert.equal(await page.locator('#hostCaptions').isVisible(),false);
  await say("Hey, I'm Lola! ");await say("Looking good! How many people are joining your photo?");
  assert.equal(await page.locator('#hostCaptionText').textContent(),"Hey, I'm Lola! Looking good! How many people are joining your photo?");
  for(const [label,viewport] of [
    ['portrait',{width:1080,height:1920}],
    ['mobile',{width:390,height:844}],
    ['small-mobile',{width:390,height:667}],
    ['landscape',{width:844,height:390}]
  ]){
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>{const c=document.querySelector('#hostCaptions').getBoundingClientRect(),s=document.querySelector('#face').getBoundingClientRect();return c.bottom<=s.top+1&&c.top>=74;},null,{timeout:10000});
    assert.equal(await page.locator('#destinationExamples img').count(),6);
    assert.ok(await page.locator('#destinationExamples').evaluate(e=>{const r=e.getBoundingClientRect(),c=document.querySelector('#hostCaptions').getBoundingClientRect();return r.right<=c.left||r.bottom+4<=c.top;}),'Examples must not overlap live captions in '+label);
    assert.ok(await page.locator('#destinationExamples').evaluate(e=>[...e.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)),'All six example images must load');
    const bounds=await captionBounds();assert.ok(bounds.above&&bounds.onScreen,'Captions must sit above Lola and inside '+label+': '+JSON.stringify(bounds));
    await page.screenshot({path:'artifacts/host-captions-'+label+'.png'});
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);
  await page.evaluate(()=>window.__channel.emit({type:'session.input_transcript.delta',delta:'private-email@example.com'}));
  await say('Thanks! <img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#hostCaptionText').textContent(),'Thanks! <img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#hostCaptionText img').count(),0,'Transcript text is never interpreted as HTML.');
  await say(' A relaxed night with other IMEX visitors.'.repeat(80)+' Enjoy the event!');
  assert.ok((await page.locator('#hostCaptionText').textContent()).length<=1200);
  assert.equal(await page.locator('#hostCaptionText').evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop<2),true,'Keep the newest spoken words visible.');
  assert.equal((await page.locator('#hostCaptionText').textContent()).includes('private-email'),false,'Never display guest microphone/email transcription.');
  assert.ok((await captionBounds()).above&&(await captionBounds()).onScreen);
  await page.setViewportSize({width:1080,height:1920});await page.waitForTimeout(1000);

  await tool('take_photo',{confirmed:true,style:''});await page.waitForTimeout(100);assert.equal(generations,0);
  await tool('set_guest_count',{count:2});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__videoRequests),1,'Camera warms before readiness.');
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  await tool('take_photo',{confirmed:true,style:''},true);
  await page.waitForFunction(()=>document.body.dataset.phase==='preparing');
  assert.equal(await page.locator('#countdown').isVisible(),false);
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.__sent.some(e=>e.content?.includes('countdown has started now'))),false);
  await page.waitForFunction(()=>document.body.dataset.phase==='countdown');
  assert.equal(await page.locator('#picture').isVisible(),false);
  assert.equal(await page.locator('#hostCaptions').isVisible(),false,'Countdown clears speech captions.');
  assert.equal(await page.locator('#camera').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.__videoRequests),1,'Warmup and capture share one camera request.');
  assert.ok(await page.locator('#viewfinder').evaluate(e=>{const r=e.getBoundingClientRect();return r.left<=24&&r.top<=24&&r.width<=innerWidth*.3&&r.bottom<innerHeight*.3;}));
  assert.equal(await page.locator('#camera').evaluate(e=>getComputedStyle(e).objectFit),'contain');
  await page.screenshot({path:'artifacts/host-countdown-portrait.png'});
  await page.waitForFunction(()=>document.body.dataset.phase==='generating',{},{timeout:10000});
  const timing=await page.evaluate(()=>window.__countdownTiming);
  assert.deepEqual(timing.ticks.map(t=>t.n),[5,4,3,2,1]);
  const duration=timing.captured-timing.ticks[0].at;
  await fs.writeFile('artifacts/countdown-report.json',JSON.stringify({...timing,duration},null,2));
  assert.ok(duration>=4850&&duration<5800,'Countdown must last five seconds, measured '+duration);
  assert.ok(timing.ticks[0].at-timing.preparing>=500,'Delayed camera must not consume countdown time.');
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  assert.equal(await page.locator('#camera').evaluate(e=>e.srcObject===null),true);
  await fs.writeFile('artifacts/countdown-report.json',JSON.stringify({...timing,duration},null,2));
  await say('While your portrait develops, enjoy the Spain tourism experience with other IMEX visitors!');
  await page.screenshot({path:'artifacts/host-generating-portrait.png'});assert.equal(generations,1);
  await tool('take_photo',{confirmed:true,style:''});await page.waitForTimeout(100);assert.equal(generations,1);
  release();await page.waitForFunction(()=>document.body.dataset.phase==='result');
  // Result area is separate from large actions/captions at kiosk and mobile sizes.
  for(const [label,width,height] of [['kiosk',1080,1920],['phone',390,844],['compact',390,667]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    const layout=await page.evaluate(()=>{
      const p=document.querySelector('#picture').getBoundingClientRect(),c=document.querySelector('#touchControls').getBoundingClientRect();
      return {clear:p.bottom<=c.top+1,onScreen:p.top>=70&&c.bottom<=innerHeight,pictureHeight:p.height};
    });
    assert.ok(layout.clear&&layout.onScreen&&layout.pictureHeight>250,'Unobscured result at '+label+': '+JSON.stringify(layout));
    await page.screenshot({path:'artifacts/host-result-'+label+'.png'});
  }
  await page.setViewportSize({width:1080,height:1920});

  assert.equal(await page.locator('#picture').isVisible(),true);
  await say('Your portrait is ready! Would you like me to email it? Spell your address aloud, including at and dot.');
  await page.waitForTimeout(1000);assert.ok((await captionBounds()).above&&(await captionBounds()).onScreen);await page.screenshot({path:'artifacts/host-result-portrait.png'});
  assert.ok(await page.locator('#face').evaluate(e=>e.getBoundingClientRect().width<innerWidth*.25));
  assert.ok(await page.evaluate(()=>window.__sent.some(e=>e.type==='session.commentary.append'&&e.content.includes('Madrid'))));
  // A spoken address opens review; no voice tool can send it.
  await tool('show_email_confirmation',{email:'alex@exampl.com'});
  await page.locator('#emailPanel').waitFor({state:'visible'});
  await page.evaluate(()=>window.__channel.emit({type:'session.input_transcript.delta',delta:'alex at example dot com'}));
  await say('Check the address on screen. Use the keyboard to fix anything, then tap Confirm & email photo.');
  assert.equal(await page.locator('#emailPanel #hostCaptions').isVisible(),true,'Keep host captions readable inside email review.');
  assert.equal(emails,0);
  await page.locator('#emailInput').fill('alex');await page.locator('#emailDomains button').filter({hasText:'@gmail.com'}).click();
  assert.equal(await page.locator('#emailInput').inputValue(),'alex@gmail.com');
  // Correct a character using the kiosk keyboard, preserving the insertion point.
  await page.locator('#emailInput').evaluate(e=>e.setSelectionRange(4,4));
  await page.locator('[data-key="+"]').click();await page.locator('[data-key="p"]').click();
  assert.equal(await page.locator('#emailInput').inputValue(),'alex+p@gmail.com');
  await page.screenshot({path:'artifacts/host-email-portrait.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
  await page.screenshot({path:'artifacts/host-email-mobile.png'});
  assert.ok(await page.locator('#emailConfirm').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));
  await page.setViewportSize({width:1080,height:1920});
  emailFail=true;await page.locator('#emailConfirm').click();
  await page.waitForFunction(()=>document.querySelector('#emailStatus').textContent.includes('could not confirm'));
  assert.equal(emails,1);assert.equal(await page.locator('#emailInput').inputValue(),'alex+p@gmail.com');
  emailFail=false;await page.locator('#emailConfirm').dblclick();
  await page.locator('#emailToast').waitFor({state:'visible'});
  assert.equal(emails,2);assert.equal(lastEmail,'alex+p@gmail.com');
  assert.equal(await page.locator('#emailInput').inputValue(),'');
  await tool('send_email',{email:'unconfirmed@example.com'});await page.waitForTimeout(100);assert.equal(emails,2);
  // Fail one explicit revision: never reveal rejected bytes or automatically regenerate.
  fail=true;release=null;await tool('retry_picture',{confirmed:true,style:'More colorful'});
  await page.waitForTimeout(150);assert.equal(generations,2);release();
  await page.waitForFunction(()=>document.body.dataset.phase==='error');
  assert.equal(await page.locator('#picture').isVisible(),false);
  await page.waitForTimeout(300);assert.equal(generations,2);
  fail=false;release=null;await tool('retry_picture',{confirmed:true,style:''});await page.waitForTimeout(150);assert.equal(generations,3);release();
  await page.waitForFunction(()=>document.body.dataset.phase==='result');
  // A reset during work suppresses the old result and stops the camera.
  release=null;await tool('retry_picture',{confirmed:true,style:''});await page.waitForTimeout(150);
  await tool('reset_booth',{confirmed:true});release();await page.waitForTimeout(300);
  assert.equal(await page.locator('#picture').isVisible(),false);
  // A warm camera starts immediately; the mobile preview stays small and disappears on cancellation.
  await page.evaluate(()=>window.__cameraDelay=0);
  await tool('set_guest_count',{count:2});
  await page.waitForFunction(()=>document.getElementById('camera').readyState>=2);
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  await page.setViewportSize({width:390,height:844});
  const before=await page.evaluate(()=>performance.now());
  await tool('take_photo',{confirmed:true,style:''});
  await page.waitForFunction(()=>document.body.dataset.phase==='countdown');
  assert.ok((await page.evaluate(()=>performance.now()))-before<1000,'Ready camera must start countdown without another startup.');
  assert.ok(await page.locator('#viewfinder').evaluate(e=>{const r=e.getBoundingClientRect();return r.left<=24&&r.top<=24&&r.width<innerWidth*.4&&r.bottom<innerHeight*.3;}));
  assert.equal(await page.locator('#sentryToggle').isVisible(),false);
  await page.screenshot({path:'artifacts/host-countdown-mobile.png'});
  const beforeCancel=generations;
  await tool('reset_booth',{confirmed:true});await page.waitForTimeout(150);
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  assert.equal(await page.locator('#camera').evaluate(e=>e.srcObject===null),true);
  assert.equal(generations,beforeCancel);
  // End while a fresh camera request is pending: a late stream must be stopped.
  await page.evaluate(()=>window.__cameraDelay=1200);
  await tool('set_guest_count',{count:2});await tool('take_photo',{confirmed:true,style:''});
  await page.waitForFunction(()=>document.body.dataset.phase==='preparing');
  await page.locator('#end').click();await page.waitForFunction(()=>document.body.dataset.phase==='idle');
  await page.waitForTimeout(1500);
  assert.equal(generations,beforeCancel);
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  assert.equal(await page.locator('#hostCaptionText').textContent(),'');
  await say('Late speech from the previous guest.');
  assert.equal(await page.locator('#hostCaptions').isVisible(),false);
  // Still exercise the explicit voice end tool on a new session.
  await page.locator('#face').click();await page.waitForFunction(()=>document.body.dataset.phase==='listening');
  assert.equal(await page.locator('#hostCaptionText').textContent(),'','New guest starts with no old captions.');
  await tool('end_visit',{confirmed:true});await page.waitForFunction(()=>document.body.dataset.phase==='idle');
  assert.equal(await page.locator('#camera').evaluate(e=>e.srcObject===null),true);
  assert.equal(await page.locator('#emailInput').inputValue(),'');assert.equal(await page.locator('#emailPanel').isVisible(),false);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/host-idle-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#face').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true);
  // Exercise real detection in a worker using the official MediaPipe example image.
  const modelPage=await context.newPage();await modelPage.goto('http://127.0.0.1:4181/host.html');
  const detections=await modelPage.evaluate(async()=>{
    const worker=new Worker('/host-sentry-worker.js');
    const receive=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Detector timeout')),30000);worker.onmessage=({data})=>{clearTimeout(timer);data.type==='error'?reject(new Error(data.message)):resolve(data);};worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message));};});
    try{
      let received=receive();worker.postMessage({type:'init'});await received;
      const bitmap=await createImageBitmap(await (await fetch('/tests/fixtures/sentry-person.jpg')).blob());
      received=receive();worker.postMessage({type:'frame',frameId:1,bitmap},[bitmap]);const person=(await received).present;
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;canvas.getContext('2d').fillRect(0,0,320,320);
      const blank=await createImageBitmap(canvas);received=receive();worker.postMessage({type:'frame',frameId:2,bitmap:blank},[blank]);const empty=(await received).present;
      return {person,empty};
    }finally{worker.terminate();}
  });
  assert.deepEqual(detections,{person:true,empty:false});await modelPage.close();
  // Simulate arrivals to test auto-start, stale-frame suppression and walk-away cleanup.
  let greetings=0,releaseGreeting,greetingReady=0;
  const waitForGreeting=async expected=>{
    const deadline=Date.now()+5000;
    while(greetingReady<expected&&Date.now()<deadline)await page.waitForTimeout(25);
    assert.equal(greetingReady,expected,'Wait for the current snapshot request before releasing its response.');
  };
  await page.route('**/api/host-greeting',async route=>{
    greetings++;const body=route.request().postDataJSON();assert.match(body.frame,/^data:image\/jpeg;base64,/);
    await new Promise(r=>{releaseGreeting=r;greetingReady=greetings;});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({personPresent:true,greeting:"Hey, you're looking great in that blue jacket! I'm your AI photo host. Would you like a Spain photo?"})});
  });
  await page.evaluate(()=>{
    window.__presence=false;window.__clockAdvance=0;
    const nativeNow=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>nativeNow()+window.__clockAdvance});
    // Advance inactivity deadlines without waiting minutes in this synthetic flow.
    const nativeTimer=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window),timers=new Map();
    window.setTimeout=(fn,ms=0,...args)=>{
      const id=nativeTimer(()=>{timers.delete(id);fn(...args);},ms);
      timers.set(id,{fn,args,ms,at:performance.now()+ms});return id;
    };
    window.clearTimeout=id=>{timers.delete(id);nativeClear(id);};
    window.__advanceTime=ms=>{
      window.__clockAdvance+=ms;
      const due=[...timers].filter(([,t])=>t.at<=performance.now()&&t.ms!==350).sort((a,b)=>a[1].at-b[1].at);
      for(const [id,t] of due){if(!timers.has(id))continue;window.clearTimeout(id);t.fn(...t.args);}
    };
    window.Worker=class{
      postMessage(data){
        if(data.type==='init')queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));
        else {data.bitmap.close();queueMicrotask(()=>this.onmessage?.({data:{type:'presence',present:window.__presence,frameId:data.frameId}}));}
      }
      terminate(){this.onmessage=null;}
    };
  });
  await page.locator('#sentryToggle').click();
  await page.waitForFunction(()=>document.querySelector('#sentryNotice').textContent.includes('snapshot'));
  await page.waitForTimeout(800);assert.equal(greetings,0);
  await page.evaluate(()=>window.__presence=true);
  await page.waitForFunction(()=>document.querySelector('#headline').textContent==='Hello there.');
  await waitForGreeting(1);assert.equal(greetings,1);
  await page.evaluate(()=>window.__presence=false);await page.waitForTimeout(2800);releaseGreeting();
  await page.waitForTimeout(300);assert.equal(await page.locator('body').getAttribute('data-phase'),'idle');
  await page.waitForTimeout(1700);await page.evaluate(()=>{window.__presence=true;window.__advanceTime(60000);});
  await page.waitForFunction(()=>document.querySelector('#headline').textContent==='Hello there.');await page.waitForTimeout(100);
  await waitForGreeting(2);assert.equal(greetings,2);releaseGreeting();
  await page.waitForFunction(()=>document.body.dataset.phase==='listening');
  assert.ok(await page.evaluate(()=>window.__sent.some(e=>e.type==='session.instructions.append'&&e.content.includes('blue jacket'))));
  const generationCount=generations;
  await page.evaluate(()=>window.__advanceTime(20000));
  await page.evaluate(()=>window.__channel.emit({type:'session.output_transcript.delta',delta:'I am your host.'}));
  await tool('get_booth_status',{});
  assert.equal(await page.locator('body').getAttribute('data-phase'),'listening');
  const beforeIdleClose=await page.evaluate(()=>window.__sent.length);
  await page.evaluate(()=>window.__advanceTime(11000));
  await page.waitForFunction(()=>document.body.dataset.phase==='idle',null,{timeout:5000});
  assert.deepEqual(await page.evaluate(from=>window.__sent.slice(from).map(e=>e.type),beforeIdleClose),['session.close'],'Closing must not inject another status update into the ending session.');
  assert.equal(generations,generationCount);
  // Presence stays true: no empty-scene requirement remains after inactivity.
  await page.waitForFunction(()=>document.querySelector('#headline').textContent==='Hello there.');
  await waitForGreeting(3);assert.equal(greetings,3);releaseGreeting();
  await page.waitForFunction(()=>document.body.dataset.phase==='listening');
  await page.evaluate(()=>{window.__advanceTime(20000);window.__channel.emit({type:'session.input_transcript.delta',delta:'Hello, I want a photo.'});});
  await page.evaluate(()=>window.__advanceTime(20000));
  assert.equal(await page.locator('body').getAttribute('data-phase'),'listening','Visitor speech resets the idle window.');
  await page.locator('#face').click();
  await page.evaluate(()=>window.__advanceTime(20000));
  assert.equal(await page.locator('body').getAttribute('data-phase'),'listening','Visitor touch resets the idle window.');
  // Background work must survive silence longer than 30 seconds.
  release=null;await tool('set_guest_count',{count:2});await tool('take_photo',{confirmed:true,style:''});
  await page.waitForFunction(()=>document.body.dataset.phase==='generating',null,{timeout:15000});
  await page.evaluate(()=>window.__advanceTime(40000));await page.waitForTimeout(200);
  assert.equal(await page.locator('body').getAttribute('data-phase'),'generating');assert.equal(greetings,3);
  release();await page.waitForFunction(()=>document.body.dataset.phase==='result');
  await tool('show_email_confirmation',{email:'guest@example.com'});
  holdEmail=true;await page.locator('#emailConfirm').click();
  await page.waitForFunction(()=>document.querySelector('#emailConfirm').textContent.includes('Sending'));
  await page.waitForTimeout(100);
  await page.evaluate(()=>window.__advanceTime(40000));
  assert.equal(await page.locator('#emailPanel').isVisible(),true);assert.equal(greetings,3);
  releaseEmail();await page.locator('#emailToast').waitFor({state:'visible'});
  await page.evaluate(()=>{window.__presence=false;window.__advanceTime(20000);});
  assert.equal(await page.locator('body').getAttribute('data-phase'),'result','Completed work grants a fresh reply window.');
  await page.evaluate(()=>window.__advanceTime(11000));
  await page.waitForFunction(()=>document.body.dataset.phase==='idle');
  assert.equal(await page.locator('#picture').isVisible(),false);
  assert.equal(await page.locator('#emailInput').inputValue(),'');
  await page.waitForTimeout(800);assert.equal(greetings,3,'No greeting request for an empty scene.');
  await page.evaluate(()=>window.__presence=true);
  await page.waitForFunction(()=>document.querySelector('#headline').textContent==='Hello there.');
  await waitForGreeting(4);assert.equal(greetings,4);releaseGreeting();await page.waitForFunction(()=>document.body.dataset.phase==='listening');
  await page.locator('#sentryToggle').click();await page.waitForFunction(()=>document.body.dataset.phase==='idle');
  await page.evaluate(()=>window.__advanceTime(60000));await page.waitForTimeout(500);
  assert.equal(greetings,4,'Manually disabled sentry must stay off.');
  assert.equal(await page.locator('#sentryCamera').evaluate(e=>e.srcObject===null),true);
  assert.equal(await page.locator('#sentryToggle').getAttribute('aria-pressed'),'false');
  await fs.writeFile('artifacts/sentry-idle-report.json',JSON.stringify({idleWindowMs:30000,occupiedSceneRearmed:true,speechAndTouchExtend:true,assistantAndStatusDoNotExtend:true,generationProtected:true,emailSendProtected:true,emptySceneNoRequest:true,manualStopStaysOff:true,greetings},null,2));
  assert.deepEqual(errors,[]);
  // The touch path must work without opening a paid voice session.
  await page.setViewportSize({width:390,height:844});
  const voiceBefore=await page.evaluate(()=>window.__sent.length);
  await page.locator('[data-touch=start]').click();
  await page.locator('[data-touch=people-2]').click();
  await page.locator('[data-touch=destination-madrid]').click();
  await page.locator('[data-touch=capture]').waitFor({state:'visible'});
  assert.ok(await page.locator('[data-touch=capture]').evaluate(e=>e.getBoundingClientRect().height>=56));
  await page.screenshot({path:'artifacts/host-touch-ready-mobile.png'});
  const beforeTouch=generations;release=null;fail=false;
  await page.locator('[data-touch=capture]').click();
  await page.waitForFunction(()=>document.body.dataset.phase==='generating',null,{timeout:15000});
  await new Promise((resolve,reject)=>{const deadline=Date.now()+5000;const poll=()=>generations===beforeTouch+1?resolve():Date.now()>deadline?reject(new Error('Touch capture did not submit an image request')):setTimeout(poll,20);poll();});
  assert.equal(generations,beforeTouch+1);
  assert.equal(await page.locator('[data-touch=capture]').count(),0,'No duplicate capture button during generation');
  release();await page.waitForFunction(()=>document.body.dataset.phase==='result');
  await page.locator('#emailOpen').click();
  assert.equal(await page.locator('#emailPanel').isVisible(),true);
  assert.equal(await page.locator('#touchControls').isVisible(),false,'Only email confirmation controls remain in the dialog');
  await page.locator('#emailCancel').click();
  await page.locator('[data-touch=finish]').click();
  await page.waitForFunction(()=>document.body.dataset.phase==='idle');
  assert.equal(await page.locator('#picture').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.__sent.length),voiceBefore,'Touch photos do not need a voice session');
  assert.deepEqual(errors,[]);
  console.log('Face host browser checks passed: portrait/mobile, readiness, camera warmup/cancellation, five-second countdown, top-left viewfinder, duplicate calls, image reveal, guard rejection, explicit retry, reset, cleanup.');
}finally{await browser.close();server.close();}
