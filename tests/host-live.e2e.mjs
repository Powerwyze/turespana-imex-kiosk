// Optional paid voice smoke. Image generation and ALL email delivery are stubbed.
// TURESPANA_HOST_PREVIEW_URL explicitly selects the deployment under test.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const url=process.env.TURESPANA_HOST_PREVIEW_URL;
if(!url)throw new Error('The private preview URL is not configured.');
const launch={args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']};
if(process.env.CHROMIUM_EXECUTABLE)launch.executablePath=process.env.CHROMIUM_EXECUTABLE;
if(process.env.PLAYWRIGHT_PROXY)launch.proxy={server:process.env.PLAYWRIGHT_PROXY};
const browser=await chromium.launch(launch);
const context=await browser.newContext({viewport:{width:1080,height:1920},permissions:['microphone','camera'],reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(45000);
let sessionStatus=null,sessionFailure=null,generationCalls=0,emailCalls=0,releaseImage;
await fs.mkdir('artifacts',{recursive:true});
await page.addInitScript(()=>{
 const Native=window.RTCPeerConnection;
 window.__liveEvents=[];window.__liveSent=[];window.__liveChannel=null;window.__connectionStates=[];
 window.__captureTiming={start:null,captured:null};window.__captionUpdates=0;
 window.addEventListener('DOMContentLoaded',()=>{
  new MutationObserver(()=>{if(document.getElementById('hostCaptionText').textContent)window.__captionUpdates++;}).observe(document.getElementById('hostCaptionText'),{childList:true,characterData:true,subtree:true});
  const capture=document.getElementById('capture').getContext('2d'),draw=capture.drawImage.bind(capture);
  capture.drawImage=(...args)=>{window.__captureTiming.captured=performance.now();return draw(...args);};
  new MutationObserver(()=>{
   if(document.body.dataset.phase==='countdown'&&window.__captureTiming.start===null)window.__captureTiming.start=performance.now();
  }).observe(document.body,{attributes:true,attributeFilter:['data-phase']});
 });
 window.RTCPeerConnection=class extends Native{
  constructor(...args){super(...args);this.addEventListener('connectionstatechange',()=>window.__connectionStates.push({connection:this.connectionState,ice:this.iceConnectionState}));}
  addTrack(track,...args){if(track.kind==='audio')track.enabled=false;return super.addTrack(track,...args);}
  createDataChannel(...args){
   const channel=super.createDataChannel(...args);window.__liveChannel=channel;
   const send=channel.send.bind(channel);channel.send=data=>{try{window.__liveSent.push(JSON.parse(data));}catch{}return send(data);};
   channel.addEventListener('message',({data})=>{try{window.__liveEvents.push(JSON.parse(data));}catch{}});
   return channel;
  }
 };
});
page.on('response',async response=>{
 if(new URL(response.url()).pathname==='/api/host-session'){
  sessionStatus=response.status();if(!response.ok())sessionFailure=await response.json().catch(()=>({error:'Non-JSON response'}));
 }
});
await page.route('**/api/host-email',route=>{emailCalls++;return route.fulfill({json:{ok:true}});});
await page.route('**/api/host-greeting',route=>route.fulfill({json:{personPresent:false}}));
const picture=await fs.readFile(path.resolve(import.meta.dirname,'fixtures/sentry-person.jpg'));
await page.route('**/api/host-photo',async route=>{
 generationCalls++;
 assert.match(route.request().postDataBuffer().toString('latin1'),/name="destinationId"\r\n\r\ncanarias/);
 assert.match(route.request().postDataBuffer().toString('latin1'),/name="guestCount"\r\n\r\n2/);
 await new Promise(resolve=>releaseImage=resolve);
 await route.fulfill({status:200,contentType:'image/jpeg',body:picture});
});
const ask=text=>page.evaluate(text=>{
 window.__liveChannel.send(JSON.stringify({type:'response.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}}));
 window.__liveChannel.send(JSON.stringify({type:'response.create'}));
},text);
const waitPhase=phase=>page.waitForFunction(phase=>document.body.dataset.phase===phase,phase);
// A tool updates the UI before LiveTools can submit its result. Wait for the
// backend's follow-up message and terminal event before injecting another turn.
const waitToolTurn=name=>page.waitForFunction(name=>{
 const events=window.__liveEvents;
 const callIndex=events.findLastIndex(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='function_call'&&e.event.item.name===name);
 if(callIndex<0)return false;
 const call=events[callIndex].event.item;
 if(!window.__liveSent.some(e=>e.type==='response.item.create'&&e.item?.type==='function_call_output'&&e.item.call_id===call.call_id))return false;
 const messageIndex=events.findLastIndex(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='message');
 const terminalIndex=events.findLastIndex(e=>e.type==='response.event'&&e.event?.type==='response.completed');
 const createdIndex=events.findLastIndex(e=>e.type==='response.event'&&e.event?.type==='response.created');
 return messageIndex>callIndex&&terminalIndex>messageIndex&&terminalIndex>createdIndex;
},name,{timeout:45000});
try{
 await page.goto(url);await page.locator('[data-touch=voice]').click();
 await page.waitForFunction(()=>['listening','preparing','countdown','error'].includes(document.body.dataset.phase),null,{timeout:65000});
 if(await page.locator('body').getAttribute('data-phase')==='error')throw new Error('Live startup failed: '+JSON.stringify({sessionStatus,sessionFailure,hint:await page.locator('#hint').innerText()}));
 await page.waitForFunction(()=>window.__liveEvents.some(e=>e.type==='session.output_transcript.delta'));
 await waitPhase('countdown');await page.screenshot({path:'artifacts/host-live-countdown.png'});
 await waitPhase('choosing_people');
 assert.equal(generationCalls,0,'Capture precedes count, destination and image work');
 const duration=await page.evaluate(()=>window.__captureTiming.captured-window.__captureTiming.start);
 assert.ok(duration>=6900&&duration<9000,'Seven-second live countdown: '+duration);
 await ask('There are exactly two people in the picture. Please select two people.');
 await waitPhase('choosing_destination');
 await waitToolTurn('set_guest_count');
 await ask('We choose Canarias. Please select Canarias and begin our image.');
 await waitPhase('generating');await page.locator('#emailPanel').waitFor({state:'visible'});
 assert.equal(generationCalls,1);
 await waitToolTurn('set_destination');
 const tourismStart=await page.evaluate(()=>window.__liveEvents.length);
 await ask('While our photo generates, which national parks could we explore in the Canary Islands?');
 // Live may summarize the delegated answer when speaking. Check the factual
 // answer and the spoken topic separately instead of requiring verbatim names.
 await page.waitForFunction(start=>{
  const events=window.__liveEvents.slice(start);
  const answer=events.filter(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='message').flatMap(e=>e.event.item.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join(' ');
  const spoken=events.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join('');
  const namedParks=['Teide','Timanfaya','Garajonay','Taburiente'].filter(name=>new RegExp(name,'i').test(answer));
  return namedParks.length>=2&&/national parks?/i.test(answer)&&/national parks?|Teide|Timanfaya|Garajonay|Taburiente/i.test(spoken)&&/volcan|forest|hiking|island|nature|Canary|Canarias/i.test(spoken);
 },tourismStart,{timeout:45000});
 const tourismReply=await page.evaluate(start=>{
  const events=window.__liveEvents.slice(start);
  return {answer:events.filter(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='message').flatMap(e=>e.event.item.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join(' '),spoken:events.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join('')};
 },tourismStart);
 assert.equal(await page.locator('body').getAttribute('data-phase'),'generating');
 await page.locator('#guestNameInput').fill('Voice Test Guests');await page.locator('#emailInput').fill('voice-smoke@example.invalid');
 assert.equal(emailCalls,0,'Typing contact details does not deliver');
 await page.locator('#emailConfirm').click();assert.equal(emailCalls,0,'Confirmation queues delivery until image ready');
 releaseImage();await waitPhase('result');
 await page.waitForFunction(()=>document.getElementById('emailToast').textContent.includes('accepted'));
 assert.equal(emailCalls,1,'Only stubbed email endpoint is called once');
 const report=await page.evaluate(()=>({
  captionUpdates:window.__captionUpdates,
  countdownDurationMs:window.__captureTiming.captured-window.__captureTiming.start,
  sessionStarted:window.__liveEvents.some(e=>e.type==='session.started'),
  spokenOutput:window.__liveEvents.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join(''),
  tools:window.__liveEvents.filter(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='function_call').map(e=>e.event.item.name),
  errors:window.__liveEvents.filter(e=>e.type==='error').map(e=>e.error)
 }));
 Object.assign(report,{generationCalls,emailCalls,tourismReply,imageGenerationMocked:true,emailDeliveryMocked:true,inputMode:'text through real live data channel; microphone recognition covered separately'});
 assert.ok(report.captionUpdates>5,'Live captions stream through the conversation');assert.deepEqual(report.errors,[],'No Live protocol errors');
 await page.screenshot({path:'artifacts/host-live-result.png'});await fs.writeFile('artifacts/live-report.json',JSON.stringify(report,null,2));
 console.log('Real voice flow passed:',JSON.stringify(report));
}catch(error){
 await page.screenshot({path:'artifacts/host-live-failure.png'}).catch(()=>{});
 console.error('Voice startup status:',JSON.stringify({sessionStatus,sessionFailure}));
 await fs.writeFile('artifacts/live-failure.json',JSON.stringify(await page.evaluate(()=>({events:window.__liveEvents,sent:window.__liveSent,connections:window.__connectionStates,phase:document.body.dataset.phase,hint:document.getElementById('hint')?.textContent})).catch(()=>({})),null,2));
 throw error;
}finally{
 releaseImage?.();
 await page.evaluate(()=>{if(window.__liveChannel?.readyState==='open')window.__liveChannel.send(JSON.stringify({type:'session.close'}));}).catch(()=>{});
 await page.waitForTimeout(1000);await browser.close();
}
