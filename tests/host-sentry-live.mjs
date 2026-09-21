// Opt-in cloud test: real frame-context vision and real voice; no visitor photo generation.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.TURESPANA_HOST_PREVIEW_URL;if(!url)throw new Error('Preview URL is required.');
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1080,height:1920},permissions:['microphone','camera']});
const page=await context.newPage();let greeting=null,visionCalls=0,sessionCalls=0;
await page.addInitScript(()=>{
  const Native=window.RTCPeerConnection;window.__events=[];window.__sent=[];window.__channel=null;window.__startedAt=null;window.__idleAt=null;
  window.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(document.body.dataset.phase==='idle'&&window.__startedAt!==null&&window.__idleAt===null)window.__idleAt=performance.now();}).observe(document.body,{attributes:true,attributeFilter:['data-phase']}));
  window.RTCPeerConnection=class extends Native{
    addTrack(track,...args){if(track.kind==='audio')track.enabled=false;return super.addTrack(track,...args);}
    createDataChannel(...args){const channel=super.createDataChannel(...args);window.__channel=channel;const send=channel.send.bind(channel);channel.send=raw=>{const e=JSON.parse(raw);window.__sent.push({type:e.type,event_id:e.event_id});return send(raw);};channel.addEventListener('message',({data})=>{try{const e=JSON.parse(data);window.__events.push(e);if(e.type==='session.started'&&window.__startedAt===null)window.__startedAt=performance.now();}catch{}});return channel;}
  };
  // Presence timing is deterministic; the separate browser test executes the actual detector.
  window.Worker=class{
    postMessage(data){if(data.type==='init')queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));else{data.bitmap.close();queueMicrotask(()=>this.onmessage?.({data:{type:'presence',present:true,frameId:data.frameId}}));}}
    terminate(){this.onmessage=null;}
  };
});
const frame='data:image/jpeg;base64,'+(await fs.readFile('tests/fixtures/sentry-person.jpg')).toString('base64');
await page.route('**/api/host-greeting',async route=>{
  visionCalls++;
  const response=await route.fetch({postData:JSON.stringify({frame})});greeting=await response.json();
  assert.equal(response.status(),200);assert.equal(greeting.personPresent,true);assert.ok(greeting.greeting.length>10);
  await route.fulfill({response});
});
page.on('response',r=>{if(new URL(r.url()).pathname==='/api/host-session')sessionCalls++;});
try{
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#face').dataset.avatar==='ready');
  await page.locator('#sentryToggle').click();
  await page.waitForFunction(()=>document.body.dataset.phase==='listening',null,{timeout:70000});
  await page.waitForFunction(()=>window.__events.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join('').length>65,null,{timeout:30000});
  assert.equal(visionCalls,1);assert.equal(sessionCalls,1);
  // Keep person presence true and never interact. The actual voice connection
  // must close after 30 seconds and the kiosk must greet again without a tap.
  await page.waitForFunction(()=>window.__events.filter(e=>e.type==='session.started').length===2,null,{timeout:75000});
  assert.equal(visionCalls,2);assert.equal(sessionCalls,2);
  const inactiveMs=await page.evaluate(()=>window.__idleAt-window.__startedAt);
  assert.ok(inactiveMs>=29500&&inactiveMs<35000,'Sentry must rearm after 30 seconds: '+inactiveMs);
  const report=await page.evaluate(()=>({inactivityMs:window.__idleAt-window.__startedAt,rearmedWithoutTap:true,spokenOutput:window.__events.filter(e=>e.type==='session.output_transcript.delta').map(e=>e.delta).join(''),errors:window.__events.filter(e=>e.type==='error').map(e=>e.error),errorContext:window.__events.filter(e=>e.type==='error').map(e=>({code:e.error?.code,clientEvent:window.__sent.find(s=>s.event_id===e.error?.client_event_id)?.type})),avatar:document.querySelector('#face').dataset.avatar,sentryOn:document.querySelector('#sentryToggle').getAttribute('aria-pressed')}));
  await fs.writeFile('artifacts/sentry-live-report.json',JSON.stringify({...report,greeting:greeting.greeting,visionCalls,sessionCalls},null,2));
  assert.deepEqual(report.errors,[]);assert.equal(report.sentryOn,'true');
  await page.screenshot({path:'artifacts/sentry-live-greeting.png'});
  await fs.writeFile('artifacts/sentry-live-report.json',JSON.stringify({...report,greeting:greeting.greeting,visionCalls,sessionCalls},null,2));
  console.log('Live sentry passed:',JSON.stringify({...report,greeting:greeting.greeting,visionCalls,sessionCalls}));
}finally{
  await page.evaluate(()=>{if(window.__channel?.readyState==='open')window.__channel.send(JSON.stringify({type:'session.close'}));}).catch(()=>{});
  await page.waitForTimeout(1000);await browser.close();
}
