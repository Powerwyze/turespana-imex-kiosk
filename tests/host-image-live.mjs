const privateTestImageB64=process.env.APP_TEST_IMAGE_B64||[1,2,3,4,5].map(i=>process.env['APP_TEST_IMAGE_'+i]||'').join('');
// One opt-in real image request using the repository's approved reference as a synthetic one-person source.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const target=process.env.TURESPANA_HOST_PREVIEW_URL;
if(!target)throw new Error('Preview access is not configured.');
const browser=await chromium.launch();
try{
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto(target);
  const origin=new URL(page.url()).origin;
  const input=privateTestImageB64?Buffer.from(privateTestImageB64,'base64'):await fs.readFile('tests/fixtures/sentry-person.jpg');
  // Exercise Chromium's same-origin fetch path, exactly as the kiosk does.
  const result=await page.evaluate(async source=>{
    const data=Uint8Array.from(atob(source),c=>c.charCodeAt(0));
    const bitmap=await createImageBitmap(new Blob([data],{type:'image/jpeg'}));
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const {drawExposureCorrected}=await import('/capture-exposure.js');drawExposureCorrected(canvas.getContext('2d'),bitmap,canvas.width,canvas.height);bitmap.close();
    const corrected=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96));
    const form=new FormData();form.append('image',corrected,'approved-reference-test.jpg');form.append('guestCount','1');form.append('destinationId','barcelona');form.append('style','');
    const response=await fetch(location.origin==='https://turespana-imex-kiosk.powerwyze-2010.chatgpt.site'?'https://turespana-imex-kiosk.vercel.app/api/host-photo':'/api/host-photo',{method:'POST',body:form,signal:AbortSignal.timeout(295000)});
    if(!response.ok)return {status:response.status,error:await response.text()};
    const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    return {status:response.status,fallback:response.headers.get('x-portrait-fallback'),type:response.headers.get('content-type'),pipeline:response.headers.get('x-portrait-pipeline'),attempts:Number(response.headers.get('x-portrait-attempts')),model:response.headers.get('x-image-model'),base64:btoa(binary)};
  },input.toString('base64'));
  if(result.status!==200){console.log('Image smoke failed:',JSON.stringify(result));throw new Error('Image generation or guest verification did not succeed.');}
  assert.match(result.type,/^image\//);assert.ok(result.attempts>=1&&result.attempts<=3);
  assert.equal(result.pipeline,'regional-photo-v5');assert.equal(result.model,'gpt-image-2.5-flare');
  const bytes=Buffer.from(result.base64,'base64');assert.ok(bytes.length>1000);
  await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/live-generated-test.jpg',bytes);
  const dimensions=await page.evaluate(async base64=>{
    const image=new Image();image.src='data:image/jpeg;base64,'+base64;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};
  },bytes.toString('base64'));
  await fs.writeFile('artifacts/live-image-report.json',JSON.stringify({status:result.status,pipeline:result.pipeline,model:result.model,attempts:result.attempts,fallback:result.fallback,...dimensions},null,2));console.log('Real image generation and independent guest check passed:',JSON.stringify({attempts:result.attempts,fallback:result.fallback,...dimensions}));
}finally{await browser.close();}
