// Opt-in: one real generation, then the same local finishing and branding used by the kiosk.
// No email is sent and no live voice session is opened.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PIPELINE_VERSION,IMAGE_MODEL} from '../lib/portrait-pipeline.js';
const target=process.env.TURESPANA_HOST_PREVIEW_URL;
if(!target)throw new Error('Set TURESPANA_HOST_PREVIEW_URL to the reviewed deployment.');
const input=await fs.readFile(process.env.PORTRAIT_TEST_SOURCE||'tests/fixtures/portrait-face.jpg');
const destination=process.env.PORTRAIT_TEST_DESTINATION||'barcelona';
const outputDirectory=process.env.PORTRAIT_TEST_OUTPUT||'artifacts';
const browser=await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),
  ...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{}),
  args:['--no-sandbox']
});
try{
 const page=await browser.newPage();
 // Import the actual release modules without booting sentry or the microphone.
 await page.route(new URL('/',target).href,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Portrait release verification</title>'}));
 await page.goto(new URL('/',target).href);
 const result=await page.evaluate(async({source,destination})=>{
  const {preloadPortraitRetouch,retouchPortrait}=await import('/portrait-retouch.js');
  const {brandPortrait}=await import('/portrait-branding.js');
  const {destinations}=await import('/turespana-engine.js');
  const preload=preloadPortraitRetouch(),started=performance.now();
  const bytes=Uint8Array.from(atob(source),c=>c.charCodeAt(0)),form=new FormData();
  form.append('image',new Blob([bytes],{type:'image/jpeg'}),'portrait-release-check.jpg');
  form.append('guestCount','1');form.append('destinationId',destination);
  const response=await fetch('/api/host-photo',{method:'POST',body:form,signal:AbortSignal.timeout(95000)});
  if(!response.ok)return{status:response.status,error:await response.text()};
  const raw=await response.blob(),generationMs=performance.now()-started,modelReady=await preload;
  const finishStarted=performance.now(),finished=await retouchPortrait(raw),retouchMs=performance.now()-finishStarted;
  const branded=await brandPortrait(finished,destinations[destination]);
  const image=await createImageBitmap(finished),dimensions={width:image.width,height:image.height};image.close();
  const base64=async blob=>{const bytes=new Uint8Array(await blob.arrayBuffer());let value='';for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value);};
  return{status:response.status,pipeline:response.headers.get('x-portrait-pipeline'),model:response.headers.get('x-image-model'),attempts:Number(response.headers.get('x-portrait-attempts')),serverTiming:response.headers.get('server-timing'),generationMs,retouchMs,totalMs:performance.now()-started,modelReady,retouchApplied:finished!==raw,...dimensions,raw:await base64(raw),finished:await base64(finished),branded:await base64(branded)};
 },{source:input.toString('base64'),destination});
 assert.equal(result.status,200,result.error);
 assert.equal(result.pipeline,PIPELINE_VERSION);assert.equal(result.model,IMAGE_MODEL);assert.equal(result.attempts,1);
 assert.equal(result.width,1024);assert.equal(result.height,1536);
 assert.equal(result.modelReady,true,'The actual face detector must initialize.');
 assert.equal(result.retouchApplied,true,'The release check must exercise the real face-finishing path.');
 await fs.mkdir(outputDirectory,{recursive:true});
 for(const name of ['raw','finished','branded']){await fs.writeFile(outputDirectory+'/portrait-'+name+'.jpg',Buffer.from(result[name],'base64'));delete result[name];}
 await fs.writeFile(outputDirectory+'/portrait-release-report.json',JSON.stringify(result,null,2));
 console.log('Real portrait generation and local finishing:',JSON.stringify(result));
}finally{await browser.close();}

