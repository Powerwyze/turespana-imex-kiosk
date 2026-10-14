// Real contact UI and camera, with remote services intercepted. VisualViewport
// events reproduce a native keyboard without requiring an on-device keyboard.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer(async(req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'public','.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
 try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=process.env.CONTACT_LAYOUT_URL||'http://127.0.0.1:'+server.address().port;
const launch={args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']};
if(process.env.CHROMIUM_EXECUTABLE)launch.executablePath=process.env.CHROMIUM_EXECUTABLE;
else try{await fs.access('/usr/bin/chromium');launch.executablePath='/usr/bin/chromium';}catch{}
if(process.env.CONTACT_LAYOUT_URL&&process.env.HTTPS_PROXY)launch.proxy={server:process.env.HTTPS_PROXY};
const browser=await chromium.launch(launch);
const context=await browser.newContext({viewport:{width:1080,height:1920},permissions:['camera','microphone'],reducedMotion:'reduce'});
await context.addInitScript(()=>{
 let dimensions=null;
 const viewport=new EventTarget();
 Object.defineProperties(viewport,{height:{get:()=>dimensions?.height??innerHeight},width:{get:()=>innerWidth},offsetTop:{get:()=>dimensions?.top??0},offsetLeft:{get:()=>0},scale:{get:()=>1}});
 Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
 window.__keyboardViewport=(height=null,top=0)=>{dimensions=height===null?null:{height,top};viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));};
 window.addEventListener('resize',()=>viewport.dispatchEvent(new Event('resize')));
 window.Worker=class extends EventTarget{postMessage(data){data.bitmap?.close();}terminate(){}};
});
const page=await context.newPage(),errors=[],photos=[],reports=[];page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>{
 const name=new URL(route.request().url()).pathname;
 if(name==='/api/host-photo'){photos.push(route);return;}
 if(name==='/api/host-greeting')return route.fulfill({json:{personPresent:false}});
 if(name==='/api/host-narration')return route.fulfill({status:503,json:{error:'Local speech fallback'}});
 throw Error('Unexpected service request: '+name);
});
async function resize(width,height){await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function keyboard(open){if(await page.locator('#contactKeyboardToggle').getAttribute('aria-expanded')!==String(open))await page.locator('#contactKeyboardToggle').click();}
async function check(label,selector,visibleBottom,visibleTop=0){
 await page.locator(selector).scrollIntoViewIfNeeded();
 const m=await page.evaluate(({selector,visibleBottom,visibleTop})=>{
  const panel=document.querySelector('#emailPanel').getBoundingClientRect(),transcript=document.querySelector('#hostCaptions').getBoundingClientRect(),field=document.querySelector(selector),r=field.getBoundingClientRect(),text=document.querySelector('#hostCaptionText'),style=getComputedStyle(text);
  const center={x:r.left+r.width/2,y:r.top+r.height/2};
  const hit=document.elementFromPoint(center.x,center.y);
  return {panel:{top:panel.top,bottom:panel.bottom},transcript:{top:transcript.top,bottom:transcript.bottom},control:{top:r.top,bottom:r.bottom},hit:hit===field||field.contains(hit),hitElement:hit?.outerHTML?.slice(0,240),center,textHeight:text.getBoundingClientRect().height,lineHeight:parseFloat(style.lineHeight),viewportTop:visibleTop,viewportBottom:visibleBottom??innerHeight};
 },{selector,visibleBottom,visibleTop});
 assert.ok(m.panel.top>=m.transcript.bottom,label+': form stays below transcript');
 assert.ok(m.panel.bottom<=m.viewportBottom-10,label+': form stays above visible screen bottom');
 assert.ok(Math.abs(m.transcript.top-m.viewportTop)<2,label+': transcript follows visible screen top');
 assert.ok(m.control.top>=m.panel.top&&m.control.bottom<=m.panel.bottom,label+': control fully visible inside panel');
 assert.ok(m.control.top>=m.transcript.bottom,label+': control is below transcript');
 assert.ok(m.control.bottom<=m.viewportBottom,label+': control stays above visible screen bottom');
 assert.equal(m.hit,true,label+': control receives taps '+JSON.stringify(m));
 assert.ok(m.textHeight>=m.lineHeight*2-1,label+': two complete caption lines');
 reports.push({label,selector,...m});
}
try{
 await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#camera').videoWidth>0);
 await page.locator('#viewfinderCapture').click();await page.waitForFunction(()=>document.body.dataset.phase==='choosing_people');
 await page.locator('[data-touch=people-2]').click();await page.locator('[data-touch=destination-bilbao]').click();
 await page.locator('#emailPanel').waitFor({state:'visible'});
 for(const [width,height] of [[1080,1920],[1920,1080],[390,844],[844,390]]){
  await resize(width,height);await keyboard(true);
  await page.locator('#guestNameInput').fill('Keyboard Check');
  await check(`${width}x${height} name`,'#guestNameInput');
  await page.locator('#emailInput').fill('keyboard-check@example.invalid');
  await check(`${width}x${height} email`,'#emailInput');
  for(const key of ['q','backspace']){
   const selector=`#emailKeyboard [data-key="${key}"]`;
   await check(`${width}x${height} key ${key}`,selector);await page.locator(selector).click();
  }
  assert.equal(await page.locator('#emailInput').inputValue(),'keyboard-check@example.invalid');
  await check(`${width}x${height} domain`,'#emailDomains button:first-child');
  await check(`${width}x${height} confirmation`,'#emailConfirm');
 }
 for(const [width,height,visibleHeight,top] of [[390,844,430,0],[844,600,330,40],[844,600,220,40]]){
  await resize(width,height);await keyboard(false);
  await page.locator('#emailInput').focus();
  await page.evaluate(({visibleHeight,top})=>window.__keyboardViewport(visibleHeight,top),{visibleHeight,top});
  await page.waitForTimeout(120);
  // Before explicit scrolling, a focused field must remain visible after the
  // keyboard changes the available space.
  const field=await page.locator('#emailInput').boundingBox(),panel=await page.locator('#emailPanel').boundingBox();
  assert.ok(field.y>=panel.y&&field.y+field.height<=panel.y+panel.height,`${width} native keyboard: focused input stays visible ${JSON.stringify({field,panel,state:await page.evaluate(()=>({native:document.body.dataset.nativeInput,active:document.activeElement.id,mode:document.activeElement.inputMode,scroll:document.querySelector("#emailPanel").scrollTop}))})}`);
  await check(`${width} native keyboard`,'#emailInput',visibleHeight+top,top);
  await page.locator('#emailConfirm').focus();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await check(`${width} native confirmation`,'#emailConfirm',visibleHeight+top,top);
  await resize(width,height-20);
  assert.equal(await page.locator('#contactKeyboardToggle').getAttribute('aria-expanded'),'false','Height-only resize preserves native keyboard choice');
  assert.equal(await page.locator('#emailInput').getAttribute('inputmode'),'email');
  await page.evaluate(()=>window.__keyboardViewport());await page.waitForTimeout(80);
 }
 assert.deepEqual(errors,[]);assert.equal(photos.length,1,'One intercepted generation; no delivery');
 const output=path.join(root,'artifacts/contact-layout');await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({origin,reports,errors,emailCalls:0,paidCalls:0},null,2));
 await page.screenshot({path:path.join(output,'contact-keyboard.png')});
 console.log(JSON.stringify({passed:true,checks:reports.length,errors,emailCalls:0,paidCalls:0}));
}catch(error){await page.screenshot({path:'/tmp/contact-layout-failure.png'});throw error;}finally{await browser.close();server.close();}
