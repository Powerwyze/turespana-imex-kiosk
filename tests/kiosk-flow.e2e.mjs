// No paid services: only the remote voice transport, gesture inference, image API
// and email API are stubbed. Camera, countdown, application state, retouching,
// branding, captions, forms and touch controls run in a real browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(import.meta.dirname,'..');
const artifacts=path.join(root,'artifacts/kiosk-flow');
await fs.mkdir(artifacts,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm','.woff2':'font/woff2','.task':'application/octet-stream','.tflite':'application/octet-stream'};
const server=http.createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'public','.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
 try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=process.env.KIOSK_FLOW_URL||'http://127.0.0.1:'+server.address().port;
const launch={args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']};
if(process.env.CHROMIUM_EXECUTABLE)launch.executablePath=process.env.CHROMIUM_EXECUTABLE;
else try{await fs.access('/usr/bin/chromium');launch.executablePath='/usr/bin/chromium';}catch{}
const browser=await chromium.launch(launch);
const context=await browser.newContext({viewport:{width:1080,height:1920},permissions:['camera','microphone'],reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(15000);
const pageErrors=[],apiCalls=[],jobs=[],mail=[];
page.on('pageerror',e=>pageErrors.push(e.stack||e.message));
await context.addInitScript(()=>{
 window.__events=[];window.__sent=[];window.__peace=false;window.__peaceFail=sessionStorage.getItem('testPeaceFail')==='true';window.__peaceStarts=0;sessionStorage.removeItem('testPeaceFail');
 window.__captures=[];window.__ticks=[];window.__phases=[];
 class FakeChannel extends EventTarget{
  readyState='open';
  send(raw){const e=JSON.parse(raw);window.__sent.push(e);if(e.type==='session.instructions.append')queueMicrotask(()=>this.emit({type:'session.instructions.appended',client_event_id:e.event_id}));if(e.type==='session.close')queueMicrotask(()=>this.emit({type:'session.closed'}));}
  emit(e){window.__events.push(e);this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(e)}));}
  close(){this.readyState='closed';}
 }
 window.RTCPeerConnection=class extends EventTarget{
  iceGatheringState='complete';connectionState='connected';localDescription={sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111'};
  addTrack(){}
  createDataChannel(){return window.__channel=new FakeChannel();}
  async createOffer(){return {type:'offer',sdp:this.localDescription.sdp};}
  async setLocalDescription(){}
  async setRemoteDescription(){queueMicrotask(()=>window.__channel.emit({type:'session.started',session:{id:'test_session'}}));}
  close(){}
 };
 const NativeWorker=window.Worker;
 window.Worker=class extends EventTarget{
  constructor(url,options){super();this.url=String(url);if(!/host-(peace|sentry)-worker\.js/.test(this.url))return new NativeWorker(url,options);if(this.url.includes('peace'))window.__peaceStarts++;}
  postMessage(data){
   data.bitmap?.close();
   setTimeout(()=>{
    if(this.stopped)return;
    let message;
    if(data.type==='init'){
     if(this.url.includes('peace')&&window.__peaceFail){window.__peaceFail=false;message={type:'error',message:'simulated transient detector failure'};}
     else message={type:'ready'};
    }else if(data.type==='frame')message=this.url.includes('peace')?{type:'gesture',victory:window.__peace}:{type:'presence',present:false};
    if(message){const event=new MessageEvent('message',{data:message});this.onmessage?.(event);this.dispatchEvent(event);}
   },20);
  }
  terminate(){this.stopped=true;}
 };
 window.addEventListener('DOMContentLoaded',()=>{
  const capture=document.querySelector('#capture').getContext('2d'),draw=capture.drawImage.bind(capture);
  capture.drawImage=(...args)=>{window.__captures.push(performance.now());return draw(...args);};
  let lastTick='',lastPhase='';
  new MutationObserver(()=>{
   const phase=document.body.dataset.phase;
   if(phase!==lastPhase){window.__phases.push({phase,at:performance.now()});lastPhase=phase;}
   if(phase!=='countdown')lastTick='';
   const tick=document.querySelector('#countdown').textContent;
   if(phase==='countdown'&&tick&&tick!==lastTick){window.__ticks.push({tick:Number(tick),at:performance.now()});lastTick=tick;}
  }).observe(document.body,{attributes:true,childList:true,characterData:true,subtree:true});
 });
});
const fixture=await fs.readFile(path.join(root,'tests/fixtures/sentry-person.jpg'));
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==origin){await route.abort();return;}
 if(!url.pathname.startsWith('/api/')){await route.continue();return;}
 apiCalls.push(url.pathname);
 if(url.pathname==='/api/host-session')return route.fulfill({status:201,json:{session:{id:'test_session'},transport:{sdp:'test answer'}}});
 if(url.pathname==='/api/host-email'){mail.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});}
 if(url.pathname==='/api/host-narration')return route.fulfill({status:503,json:{error:'Use browser speech fallback'}});
 if(url.pathname==='/api/host-greeting')return route.fulfill({json:{personPresent:false}});
 if(url.pathname==='/api/host-photo'){
  const body=route.request().postDataBuffer().toString('latin1');
  let done;const pending=new Promise(resolve=>done=resolve);
  const job={body,release:done};jobs.push(job);await pending;
  try{await route.fulfill(job.fail?{status:503,json:{error:'simulated image provider failure'}}:{status:200,contentType:'image/jpeg',body:fixture});}catch{}
  return;
 }
 throw Error('Unexpected API request: '+url.pathname);
});
const phase=()=>page.locator('body').getAttribute('data-phase');
const waitPhase=value=>page.waitForFunction(value=>document.body.dataset.phase===value,value);
const emit=event=>page.evaluate(event=>window.__channel.emit(event),event);
const input=delta=>emit({type:'session.input_transcript.delta',delta});
const say=delta=>emit({type:'session.output_transcript.delta',delta});
async function tool(name,args){
 await page.evaluate(({name,args})=>{
  const id=crypto.randomUUID(),call_id=crypto.randomUUID();
  const emit=event=>window.__channel.emit({type:'response.event',delegation_id:'test_delegation',event});
  emit({type:'response.created',response:{id}});
  emit({type:'response.output_item.done',response_id:id,item:{type:'function_call',call_id,name,arguments:JSON.stringify(args)}});
  emit({type:'response.completed',response:{id,output:[]}});
 },{name,args});
}
async function waitJob(number){await page.waitForFunction(()=>true);for(let i=0;i<100&&jobs.length<number;i++)await new Promise(r=>setTimeout(r,100));assert.equal(jobs.length,number);return jobs.at(-1);}
async function reset(){
 await page.evaluate(()=>{window.__peace=false;});
 if(await page.locator('#end').isVisible())await page.locator('#end').click();
 else if(await page.locator('[data-touch=cancel]').isVisible())await page.locator('[data-touch=cancel]').click();
 else if(await page.locator('[data-touch=finish]').isVisible())await page.locator('[data-touch=finish]').click();
 else await page.reload();
 await waitPhase('idle');
}
async function assertTranscript(label,controls=[]){
 const metrics=await page.evaluate(selectors=>{
  const box=document.querySelector('#hostCaptions'),text=document.querySelector('#hostCaptionText'),r=box.getBoundingClientRect(),t=text.getBoundingClientRect(),style=getComputedStyle(text);
  return {visible:!box.hidden&&getComputedStyle(box).display!=='none',top:r.top,bottom:r.bottom,viewportTop:window.visualViewport?.offsetTop||0,viewportBottom:(window.visualViewport?.offsetTop||0)+(window.visualViewport?.height||innerHeight),textHeight:t.height,lineHeight:parseFloat(style.lineHeight),textTop:t.top,textBottom:t.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,controls:selectors.map(selector=>{const e=document.querySelector(selector);if(!e||!e.getClientRects().length)return {selector,missing:true};const b=e.getBoundingClientRect();return {selector,top:b.top,bottom:b.bottom,left:b.left,right:b.right,covered:b.top<r.bottom-1};})};
 },controls);
 assert.equal(metrics.visible,true,label+': transcript is permanent');
 assert.ok(Math.abs(metrics.top-metrics.viewportTop)<2,label+': transcript is at visible viewport top');
 assert.ok(metrics.textHeight>=metrics.lineHeight*2-1,label+': two full lines fit');
 assert.ok(metrics.textTop>=metrics.top&&metrics.textBottom<=metrics.bottom,label+': both lines remain inside box');
 assert.equal(metrics.overflow,false,label+': no horizontal overflow');
 for(const c of metrics.controls){assert.ok(!c.missing,label+': '+c.selector+' exists');assert.ok(!c.covered,label+': '+c.selector+' is below transcript');assert.ok(c.bottom<=metrics.viewportBottom+1,label+': '+c.selector+' stays above visible viewport bottom');}
 return metrics;
}
const report={layouts:[],checks:[]};
try{
 await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#camera').videoWidth>0);
 for(const [name,width,height] of [['kiosk',1080,1920],['phone',390,844],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  await page.waitForFunction(()=>document.querySelector('#homeExample img')?.naturalWidth>0);
  const home=await page.evaluate(()=>{
   const example=document.querySelector('#homeExample'),image=example.querySelector('img'),voice=document.querySelector('[data-touch=voice]');
   const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
   return {parent:example.parentElement.id,imagePath:new URL(image.src).pathname,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,example:rect(example),image:rect(image),voice:rect(voice),viewfinder:rect(document.querySelector('#viewfinder')),stage:rect(document.querySelector('#stage'))};
  });
  assert.equal(home.parent,'stage',name+': example has its own screen section');
  assert.equal(home.imagePath,'/assets/examples/bilbao-before-after.jpg',name+': supplied before-and-after example is displayed');
  assert.deepEqual([home.naturalWidth,home.naturalHeight],[1280,956],name+': original example loads in full');
  assert.ok(home.voice.width>=44&&home.voice.height>=44,name+': Talk to Lola remains a usable touch target');
  assert.ok(home.voice.bottom<=home.viewfinder.top+1,name+': Talk to Lola sits above the camera: '+JSON.stringify({voice:home.voice,viewfinder:home.viewfinder}));
  await page.locator('[data-touch=voice]').click({trial:true});
  await page.locator('#viewfinderCapture').click({trial:true});
  assert.equal(await page.locator('#homeExample').isVisible(),true,name+': example is visible on the homepage');
  if(name==='kiosk'){
   assert.ok(home.example.width>=width*.95,'Kiosk example fills the width of the lower screen');
   assert.ok(home.example.height>=height*.25,'Kiosk example uses a substantial bottom section');
   assert.ok(Math.abs(home.example.bottom-home.stage.bottom)<=20,'Kiosk example reaches the bottom of the screen');
   assert.ok(home.example.top>=home.viewfinder.bottom-1,'Kiosk example does not cover the camera');
  }
  report.layouts.push({name,phase:'idle',home,...await assertTranscript(name+' idle',['[data-touch=voice]','#viewfinderCapture'])});
  await page.screenshot({path:path.join(artifacts,name+'-idle.png')});
 }
 await page.setViewportSize({width:1080,height:1920});
 await page.locator('[data-touch=voice]').click();await waitPhase('listening');
 assert.equal(await page.locator('#homeExample').isVisible(),false,'Homepage example is hidden while talking to Lola');
 await input('Ready');await page.waitForTimeout(300);await input(' — not yet.');await page.waitForTimeout(1750);
 assert.equal(await phase(),'listening','Split negative utterance must not capture');
 assert.equal(await page.evaluate(()=>window.__captures.length),0);
 await input('No, wait.');await page.waitForTimeout(1700);assert.equal(await phase(),'listening');
 await input('Could we make a photo please?');await tool('take_photo',{confirmed:true});await waitPhase('countdown');await input('Wait, not yet.');await waitPhase('listening');
 await page.waitForFunction(()=>{const video=document.querySelector('#camera');return video.videoWidth>0&&video.readyState>=2&&video.srcObject?.getVideoTracks().some(track=>track.readyState==='live');});
 assert.equal(await page.evaluate(()=>window.__captures.length),0,'Cancelling countdown does not save a photo');
 await page.evaluate(()=>{window.__ticks=[];});
 await input('Ready.');await waitPhase('countdown');
 assert.equal(await page.locator('#homeExample').isVisible(),false,'Homepage example is hidden during capture');
 // AI delegation and repeated transcripts cannot race the local readiness action.
 await tool('take_photo',{confirmed:true});await input('Okay, take my picture.');
 await assertTranscript('countdown');
 await waitPhase('choosing_people');
 assert.equal(await page.locator('#homeExample').isVisible(),false,'Homepage example is hidden during people selection');
 const timing=await page.evaluate(()=>({captures:window.__captures,ticks:window.__ticks,phases:window.__phases}));
 assert.equal(timing.captures.length,1,'Ready plus duplicate AI call captures exactly once');
 assert.deepEqual(timing.ticks.map(t=>t.tick),[7,6,5,4,3,2,1]);
 const duration=timing.captures[0]-timing.ticks[0].at;
 assert.ok(duration>=6900&&duration<8500,'Seven-second countdown: '+duration);
 assert.equal(jobs.length,0,'Photo capture does not generate before count and city');
 for(const n of [1,2,3,4])assert.equal(await page.locator('[data-touch=people-'+n+']').isVisible(),true);
 await tool('set_guest_count',{count:5});assert.equal(await phase(),'choosing_people','Invalid group count does not advance');
 for(const [name,width,height] of [['kiosk',1080,1920],['phone',390,844],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  const sizes=await page.locator('.touch-actions.people [data-touch^=people-]').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};}));
  assert.equal(sizes.length,4);
  assert.ok(sizes.every((b,i)=>b.height>=80&&b.width>width*.75&&Math.abs(b.x-sizes[0].x)<1&&(i===0||b.y>=sizes[i-1].y+sizes[i-1].height+9)),name+': four large stacked buttons');
  if(name==='kiosk')assert.ok(sizes.every(b=>b.height>=200), 'Kiosk group buttons use the available screen height');
  for(const count of [1,2,3,4]){await page.locator('[data-touch=people-'+count+']').click({trial:true});await assertTranscript(name+' people '+count,['[data-touch=people-'+count+']']);}
  await page.screenshot({path:path.join(artifacts,name+'-people.png')});
 }
 await page.setViewportSize({width:1080,height:1920});
 await input('Two people.');await waitPhase('choosing_destination');
 await tool('set_guest_count',{count:2});assert.equal(await phase(),'choosing_destination','Duplicate count acknowledgement cannot reset the flow');
 assert.equal(await page.locator('.destination-card').count(),6);
 for(const [name,width,height] of [['kiosk',1080,1920],['phone',390,844],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  // Trial clicks prove every card can scroll into a reachable hit target without
  // changing the selected city or assuming all six fit on a short phone screen.
  for(const card of await page.locator('.destination-card').all())await card.click({trial:true});
  await page.locator('[data-touch=back]').scrollIntoViewIfNeeded();
  report.layouts.push({name,phase:'cities',...await assertTranscript(name+' cities',['[data-touch=back]'])});
  const cards=await page.locator('.destination-card').evaluateAll(elements=>elements.map(e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,width:b.width,height:b.height};}));
  assert.ok(cards.every(c=>c.width>50&&c.height>60),name+': image cards remain usable');
  await page.screenshot({path:path.join(artifacts,name+'-cities.png')});
 }
 await page.setViewportSize({width:1080,height:1920});
 await page.locator('[data-touch=back]').click();
 assert.equal(await page.locator('#touchControls.people-picker').count(),1,'Back restores the large people column');
 assert.equal(await page.locator('.touch-actions.people [data-touch^=people-]').count(),4);
 await page.locator('[data-touch=people-2]').click();await page.locator('.destination-card').first().waitFor({state:'visible'});
 assert.equal(await page.locator('#touchControls.people-picker').count(),0,'City selection restores its image-card layout');
 await input('Madrid.');const firstJob=await waitJob(1);await tool('set_destination',{destinationId:'madrid'});
 assert.match(firstJob.body,/name="guestCount"\r\n\r\n2/);assert.match(firstJob.body,/name="destinationId"\r\n\r\nmadrid/);
 await page.locator('#emailPanel').waitFor({state:'visible'});
 assert.equal(await page.locator('#homeExample').isVisible(),false,'Homepage example is hidden during contact entry');
 await page.waitForFunction(()=>!document.querySelector('#voice').muted);
 await say('Madrid is home to the Prado Museum. Enter your name and email while your Spain photo is created.');
 assert.match(await page.locator('#hostCaptionText').textContent(),/Spain/,'Current narration is shown in the top transcript');
 for(const [name,width,height] of [['kiosk',1080,1920],['phone',390,844],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  report.layouts.push({name,phase:'contact',...await assertTranscript(name+' contact',['#emailPanel'])});
  await page.locator('#emailConfirm').scrollIntoViewIfNeeded();
  await assertTranscript(name+' contact confirm',['#emailConfirm']);
  await page.screenshot({path:path.join(artifacts,name+'-contact.png')});
 }
 await page.setViewportSize({width:1080,height:1920});
 const legends=await page.locator('#emailKeyboard [data-key]').evaluateAll(es=>es.filter(e=>/^[a-záéíóúñ]$/i.test(e.dataset.key)).map(e=>({text:e.textContent,transform:getComputedStyle(e).textTransform})));
 assert.ok(legends.every(l=>l.text===l.text.toUpperCase()||l.transform==='uppercase'),'All keyboard letter legends are uppercase');
 await page.locator('#guestNameInput').fill('Test Guest');await page.locator('#emailInput').fill('kiosk-test@example.invalid');
 assert.equal(await page.locator('#marketingOptIn').isChecked(),false,'Marketing remains optional');
 assert.equal(mail.length,0,'Contact entry alone never sends email');
 await page.locator('#emailConfirm').click();assert.equal(mail.length,0,'Confirmed details wait for image');
 firstJob.release();await waitPhase('result');await page.waitForFunction(()=>document.querySelector('#emailToast').textContent.includes('accepted'));
 assert.equal(await page.locator('#homeExample').isVisible(),false,'Homepage example is hidden behind the generated result');
 assert.equal(mail.length,1);assert.equal(mail[0].email,'kiosk-test@example.invalid');assert.equal(mail[0].name,'Test Guest');assert.equal(mail[0].marketingOptIn,false);assert.ok(mail[0].imageBase64.length>100);
 assert.equal(await page.locator('#picture').isVisible(),true);await assertTranscript('result',['[data-touch=finish]']);
 await page.screenshot({path:path.join(artifacts,'result.png')});
 report.checks.push('ready/negation/duplicates','cancel countdown preserves live camera','seven-second capture','spoken count/city order','responsive captions/cards/contact','uppercase keyboard','confirmation-only stubbed email');
 await reset();
 // A detector failure must re-arm on the homepage without requiring a voice session.
 await page.evaluate(()=>{sessionStorage.setItem('testPeaceFail','true');});await page.reload();await page.waitForFunction(()=>document.querySelector('#camera').videoWidth>0);
 await page.waitForFunction(()=>window.__peaceStarts>=1);await page.evaluate(()=>{window.__peace=true;});await waitPhase('countdown');await waitPhase('choosing_people');
 assert.equal(await page.evaluate(()=>window.__captures.length),1,'Homepage peace sign captures once');
 assert.ok(await page.evaluate(()=>window.__peaceStarts>=2),'A failed gesture detector is automatically restarted');
 await page.evaluate(()=>{window.__peace=false;});
 await page.locator('[data-touch=people-1]').click();await page.locator('[data-touch=destination-bilbao]').click();const failedJob=await waitJob(2);
 await page.locator('#guestNameInput').fill('Retry Guest');await page.locator('#emailInput').fill('retry@example.invalid');
 failedJob.fail=true;failedJob.release();await waitPhase('error');
 assert.equal(await page.locator('[data-touch=retry]').isVisible(),true,'Provider errors retain a retry action');
 await page.locator('[data-touch=retry]').click();const staleJob=await waitJob(3);
 assert.equal(await page.locator('#guestNameInput').inputValue(),'Retry Guest');assert.equal(await page.locator('#emailInput').inputValue(),'retry@example.invalid','Retry retains contact draft');
 assert.equal(await page.evaluate(()=>window.__captures.length),1,'Retry reuses original capture');
 // Clear the visit while a request is pending; its late response cannot reveal or send.
 await page.keyboard.press('Escape');
 if(await phase()!=='idle')await reset();
 staleJob.release();await page.waitForTimeout(600);
 assert.equal(await phase(),'idle');assert.equal(await page.locator('#picture').isVisible(),false);assert.equal(await page.locator('#emailInput').inputValue(),'');assert.equal(mail.length,1);
 report.checks.push('homepage peace capture','provider failure retry','late result discarded after reset');
 // Group of three through touch, with an image that finishes before confirmation.
 await page.locator('#viewfinderCapture').click();await waitPhase('choosing_people');await page.locator('[data-touch=people-4]').click();await page.locator('[data-touch=destination-valencia]').click();const fourthGroup=await waitJob(4);
 assert.match(fourthGroup.body,/name="guestCount"\r\n\r\n4/);fourthGroup.release();await page.waitForFunction(()=>document.querySelector('#emailTitle').textContent.includes('ready'));
 assert.equal(await phase(),'generating','Completed image still waits for guest contact confirmation');assert.equal(mail.length,1);
 await page.locator('#guestNameInput').fill('Three Guests');await page.locator('#emailInput').fill('three@example.invalid');await page.locator('#emailConfirm').click();await waitPhase('result');
 await page.waitForFunction(()=>document.querySelector('#emailToast').textContent.includes('accepted'));assert.equal(mail.length,2);
 report.checks.push('three-person touch flow','finished image waits for confirmation');
 assert.deepEqual(pageErrors,[],'No uncaught browser errors');
 report.apiCalls=apiCalls;report.generationCalls=jobs.length;report.emails=mail.length;report.paidCalls=0;report.countdownDurationMs=duration;
 await fs.writeFile(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({ok:true,...report},null,2));
}catch(error){
 await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});
 console.error('Browser failure',JSON.stringify({phase:await phase().catch(()=>null),pageErrors,apiCalls,events:await page.evaluate(()=>window.__events?.slice(-10)).catch(()=>[])}));
 throw error;
}finally{
 for(const job of jobs)job.release();
 await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
}
