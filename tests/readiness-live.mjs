import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({permissions:['camera','microphone']});
await page.addInitScript(()=>{
 const Native=RTCPeerConnection;window.__events=[];
 window.RTCPeerConnection=class extends Native{
  addTrack(track,...args){if(track.kind==='audio')track.enabled=false;return super.addTrack(track,...args);}
  createDataChannel(...args){const c=super.createDataChannel(...args);window.__channel=c;c.addEventListener('message',({data})=>{try{window.__events.push(JSON.parse(data));}catch{}});return c;}
 };
});
let photoCalls=0;await page.route('**/api/host-photo',r=>{photoCalls++;return r.abort();});
const ask=text=>page.evaluate(text=>{window.__channel.send(JSON.stringify({type:'response.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}}));window.__channel.send(JSON.stringify({type:'response.create'}));},text);
try{
 await page.goto('https://turespana-imex-kiosk.vercel.app/');await page.locator('#face').click();
 await page.waitForFunction(()=>document.body.dataset.phase==='listening',null,{timeout:45000});
 await page.waitForFunction(()=>window.__events.some(e=>e.type==='session.output_transcript.delta'),null,{timeout:30000});
 await ask('One person. I choose Canarias. Record those choices, but do not take the picture yet. Ask if I am ready.');
 await page.locator('[data-touch="capture"]').waitFor({state:'visible',timeout:45000});
 await page.waitForTimeout(4000);assert.equal(await page.locator('#countdown').isVisible(),false,'Not yet must not capture');
 await ask('Okay, take the picture.');
 await page.waitForFunction(()=>document.body.dataset.phase==='countdown',null,{timeout:45000});
 assert.equal(await page.locator('#viewfinder').isVisible(),true);
 await page.locator('#end').click();
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/readiness-live.json',JSON.stringify({liveSession:true,inputMode:'text through live data channel',phrase:'Okay, take the picture.',countdownStarted:true,negationDidNotCapture:true,photoCalls},null,2));
 console.log('Real live-session readiness accepted Okay, take the picture; negation did not capture. No image generated.');
}finally{
 await page.evaluate(()=>{if(window.__channel?.readyState==='open')window.__channel.send(JSON.stringify({type:'session.close'}));}).catch(()=>{});
 await browser.close();
}
