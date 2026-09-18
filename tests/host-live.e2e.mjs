// Optional paid smoke test, executed only by explicit workflow_dispatch.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.TURESPANA_HOST_PREVIEW_URL;
if(!url)throw new Error('The private preview URL is not configured.');
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1080,height:1920},permissions:['microphone','camera']});
const page=await context.newPage();
let sessionStatus=null,sessionFailure=null,generationCalls=0;
await fs.mkdir('artifacts',{recursive:true});
await page.addInitScript(()=>{
  const Native=window.RTCPeerConnection;
  window.__liveEvents=[];window.__liveSent=[];window.__liveChannel=null;
  window.__captureTiming={start:null,captured:null,end:null};window.__captionUpdates=0;
  window.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(()=>{if(document.getElementById('hostCaptionText').textContent)window.__captionUpdates++;}).observe(document.getElementById('hostCaptionText'),{childList:true,characterData:true,subtree:true});
    const capture=document.getElementById('capture').getContext('2d'),draw=capture.drawImage.bind(capture);
    capture.drawImage=(...args)=>{window.__captureTiming.captured=performance.now();return draw(...args);};
    new MutationObserver(()=>{
    const phase=document.body.dataset.phase,timing=window.__captureTiming;
    if(phase==='countdown'&&timing.start===null)timing.start=performance.now();
    if(phase==='generating'&&timing.end===null)timing.end=performance.now();
  }).observe(document.body,{attributes:true,attributeFilter:['data-phase']});
  });
  window.RTCPeerConnection=class extends Native{
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
    sessionStatus=response.status();
    if(!response.ok())sessionFailure=await response.json().catch(()=>({error:'Non-JSON response'}));
  }
});
await page.route('**/api/host-email',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
const picture=await fs.readFile('tests/fixtures/sentry-person.jpg');
await page.route('**/api/host-photo',async route=>{
  generationCalls++;
  assert.match(route.request().postDataBuffer().toString('latin1'),/name="guestCount"\r\n\r\n2/);
  await new Promise(r=>setTimeout(r,45000));
  await route.fulfill({status:200,contentType:'image/jpeg',body:picture});
});
const ask=async text=>page.evaluate(text=>{
  window.__liveChannel.send(JSON.stringify({type:'response.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}}));
  window.__liveChannel.send(JSON.stringify({type:'response.create'}));
},text);
try{
  await page.goto(url);await page.locator('#face').click();
  await page.waitForFunction(()=>['listening','error'].includes(document.body.dataset.phase),null,{timeout:65000});
  if(await page.locator('body').getAttribute('data-phase')==='error'){
    console.log('Live startup response:',JSON.stringify({sessionStatus,sessionFailure}));
    throw new Error('Live startup failed: '+await page.locator('#hint').innerText());
  }
  await page.waitForFunction(()=>window.__liveEvents.some(e=>e.type==='session.output_transcript.delta'),null,{timeout:45000});
  await page.waitForFunction(()=>document.getElementById('hostCaptionText').textContent.length>45,null,{timeout:30000});
  const firstCaption=await page.locator('#hostCaptionText').textContent();
  assert.ok(await page.evaluate(text=>window.__liveEvents.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join('').includes(text),firstCaption),'Visible captions must match real GPT Live speech.');
  assert.equal(await page.locator('#hostCaptions').isVisible(),true);
  await page.screenshot({path:'artifacts/host-live-captions.png'});
  await ask('We choose Madrid as our destination. There are exactly two people in our photo. Please record that. We are not ready to take it yet.');
  await page.waitForFunction(()=>document.querySelector('#hint').textContent.startsWith('2 people'),null,{timeout:45000});
  assert.equal(generationCalls,0);
  // A visible selection changes before its function result is sent. Wait until the
  // backend has acknowledged the result with a final message before the next turn.
  await page.waitForFunction(()=>{
    const events=window.__liveEvents;
    const countCall=events.find(e=>e.type==='response.event'&&e.event?.item?.name==='set_guest_count')?.event.item.call_id;
    if(!countCall||!window.__liveSent.some(e=>e.type==='response.item.create'&&e.item?.call_id===countCall))return false;
    const lastMessage=events.findLast(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='message');
    const terminal=events.findLast(e=>e.type==='response.event'&&e.event?.type==='response.completed');
    return !!lastMessage&&!!terminal&&events.indexOf(terminal)>events.indexOf(lastMessage);
  },null,{timeout:45000});
  await ask('Yes, the two of us are ready now. Take our photo and generate the standard Madrid tourism poster.');
  await page.waitForFunction(()=>document.body.dataset.phase==='countdown',null,{timeout:45000});
  assert.equal(await page.locator('#viewfinder').isVisible(),true);
  await page.screenshot({path:'artifacts/host-live-countdown.png'});
  await page.waitForFunction(()=>document.body.dataset.phase==='generating',null,{timeout:15000});
  await page.waitForTimeout(5000);
  await ask('While the photo is generating, which two art museums could I explore in Madrid?');
  await page.waitForFunction(()=>/Prado|Reina Sofía|Thyssen/i.test(window.__liveEvents.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join('')),null,{timeout:30000});
  assert.equal(await page.locator('body').getAttribute('data-phase'),'generating','Tourism questions are answered while generation continues');
  await page.screenshot({path:'artifacts/host-live-tourism.png'});
  await page.waitForFunction(()=>document.body.dataset.phase==='result',null,{timeout:65000});
  assert.equal(await page.locator('#viewfinder').isVisible(),false);
  const duration=await page.evaluate(()=>window.__captureTiming.captured-window.__captureTiming.start);
  assert.ok(duration>=4850&&duration<5800,'Live countdown duration: '+duration);
  assert.equal(generationCalls,1);
  await page.waitForFunction(()=>{
    const events=window.__liveEvents;
    const call=events.findLast(e=>e.type==='response.event'&&e.event?.item?.name==='take_photo')?.event.item.call_id;
    const callEvent=events.findLast(e=>e.type==='response.event'&&e.event?.item?.call_id===call);
    const final=events.findLast(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='message');
    const terminal=events.findLast(e=>e.type==='response.event'&&e.event?.type==='response.completed');
    return !!call&&window.__liveSent.some(e=>e.item?.call_id===call)&&events.indexOf(final)>events.indexOf(callEvent)&&events.indexOf(terminal)>events.indexOf(final);
  },null,{timeout:45000});
  // Official Resend test recipient: exercises provider delivery without emailing a person.
  await ask('Please email my photo. I will spell the full address: d e l i v e r e d, plus, f l o w h o s t, at, r e s e n d, dot, d e v. That is my complete email spelling. Show it for me to check.');
  await page.locator('#emailPanel').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('#emailInput').inputValue(),'delivered+flowhost@resend.dev');
  const mailResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/host-email');
  await page.locator('#emailConfirm').click();
  const delivered=await mailResponse;
  assert.equal(delivered.status(),200,'Email confirmation must invoke the delivery endpoint');
  await page.locator('#emailToast').waitFor({state:'visible',timeout:35000});
  const report=await page.evaluate(()=>({
    captionUpdates:window.__captionUpdates,
    countdownDurationMs:window.__captureTiming.captured-window.__captureTiming.start,
    emailConfirmationMocked:!document.getElementById('emailToast').hidden,
    avatar:document.getElementById('face').dataset.avatar,
    sessionStarted:window.__liveEvents.some(e=>e.type==='session.started'),
    spokenOutput:window.__liveEvents.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join(''),
    tools:window.__liveEvents.filter(e=>e.type==='response.event'&&e.event?.type==='response.output_item.done'&&e.event.item?.type==='function_call').map(e=>e.event.item.name),
    errors:window.__liveEvents.filter(e=>e.type==='error').map(e=>e.error)
  }));
  await page.screenshot({path:'artifacts/host-live-result.png'});
  assert.match(report.spokenOutput,/Spain|Madrid|Spanish|Turespaña/i,'Generation chatter must discuss the Spain destination.');
  assert.doesNotMatch(report.spokenOutput,/rooftop pool|Technogym|coworking|leasing|fitness classes/i,'Do not pitch apartment amenities to residents.');
  console.log('Real GPT Live smoke:',JSON.stringify(report));
  assert.ok(report.captionUpdates>5,'Live captions must stream throughout the conversation.');
  assert.deepEqual(report.errors,[],'No Live protocol errors are allowed.');
  await fs.writeFile('artifacts/live-report.json',JSON.stringify(report,null,2));
}finally{
  // Always release the billable voice session, including on a failed assertion.
  await page.evaluate(()=>{if(window.__liveChannel?.readyState==='open')window.__liveChannel.send(JSON.stringify({type:'session.close'}));}).catch(()=>{});
  await page.waitForTimeout(1500);await browser.close();
}
