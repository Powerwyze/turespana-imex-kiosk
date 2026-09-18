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
  const input=await fs.readFile('tests/fixtures/sentry-person.jpg');
  const response=await context.request.post(origin+'/api/host-photo',{
    multipart:{image:{name:'approved-reference-test.jpg',mimeType:'image/jpeg',buffer:input},guestCount:'1',style:'',destinationId:'valencia'},
    timeout:190000
  });
  if(!response.ok()){
    const data=await response.json().catch(()=>({}));
    console.log('Image smoke failed:',JSON.stringify({status:response.status(),code:data.code,error:data.error}));
    throw new Error('Image generation or guest verification did not succeed.');
  }
  assert.match(response.headers()['content-type'],/^image\//);
  const bytes=await response.body();assert.ok(bytes.length>1000);
  await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/live-generated-test.jpg',bytes);
  const dimensions=await page.evaluate(async base64=>{
    const image=new Image();image.src='data:image/jpeg;base64,'+base64;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};
  },bytes.toString('base64'));
  console.log('Real image generation and independent guest check passed:',JSON.stringify(dimensions));
}finally{await browser.close();}
