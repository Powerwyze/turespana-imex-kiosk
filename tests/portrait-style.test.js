import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generatePortrait,PIPELINE_VERSION} from '../lib/portrait-pipeline.js';
import {POST} from '../api/host-photo.js';
import {outfitSelectionPrompt} from '../lib/portrait-outfit.js';
const destinations=JSON.parse(readFileSync('public/data/destinations.json')).destinations;
async function exercise(run,{empty=false,status=200}={}){
 const priorFetch=globalThis.fetch,priorKey=process.env.OPENAI_API_KEY,calls=[];
 process.env.OPENAI_API_KEY='test-only-placeholder';
 globalThis.fetch=async(url,init)=>{
  calls.push({url:String(url),body:JSON.parse(init.body)});
  assert.ok(String(url).endsWith('/images/edits'),'No classifier may run after generation');
  return Response.json({data:empty?[]:[{b64_json:Buffer.from('photo-result').toString('base64')}]},{status});
 };
 try{await run(calls);}finally{globalThis.fetch=priorFetch;if(priorKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=priorKey;}
}
const generate=destinationId=>generatePortrait({file:new File(['camera-source'],'guest.jpg',{type:'image/jpeg'}),destinationId});
test('all six regions return the render directly with face identity prioritized',async()=>{
 await exercise(async calls=>{
  for(const dest of destinations){
   calls.length=0;const result=await generate(dest.id);
   assert.equal(result.bytes.toString(),'photo-result');assert.equal(result.pipeline,PIPELINE_VERSION);
   assert.equal(calls.length,1);assert.equal(result.attempts,1);assert.equal(result.timings.verificationMs,0);
   const edit=calls[0].body;
   assert.equal(edit.quality,'medium');assert.equal(edit.size,'1024x1536');assert.equal(edit.images.length,2);
   assert.equal(edit.images[0].image_url,'data:image/jpeg;base64,'+Buffer.from('camera-source').toString('base64'));
   assert.equal(edit.images[1].image_url,'data:image/jpeg;base64,'+readFileSync('assets/region-references/'+dest.id+'.jpg').toString('base64'));
   assert.match(edit.prompt,/iPhone/);assert.doesNotMatch(edit.prompt,/Image 3|Velázquez|SPANISH BAROQUE/);assert.match(edit.prompt,/Facial likeness takes precedence/);
   assert.match(edit.prompt,/best-effort guidance, not acceptance requirements/);
   assert.match(edit.prompt,/Guests do not need to be centered/);assert.match(edit.prompt,/head-to-body scale/);
  }
 });
});
test('API delivers image bytes immediately without a quality rejection gate',async()=>{
 await exercise(async calls=>{
  const form=new FormData();form.append('image',new File(['source'],'guest.jpg',{type:'image/jpeg'}));form.append('destinationId','madrid');
  const response=await POST(new Request('https://kiosk.example/api/host-photo',{method:'POST',body:form}));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.equal(await response.text(),'photo-result');assert.equal(calls.length,1);
  assert.match(response.headers.get('server-timing'),/verification;dur=0/);
 });
});
test('missing output and provider failures remain honest retryable errors',async()=>{
 await exercise(async calls=>{await assert.rejects(generate('madrid'),{code:'EMPTY_IMAGE'});assert.equal(calls.length,1);},{empty:true});
 await exercise(async calls=>{await assert.rejects(generate('madrid'),{code:'GENERATION_FAILED'});assert.equal(calls.length,1);},{status:400});
});
test('outfit policy defaults from source clothing, honors explicit choices, and never turns negation into a dress request',()=>{
 for(const request of ['', 'No dress', "Don't put me in a dress", 'Sin vestido']){
  const rules=outfitSelectionPrompt(request);
  assert.doesNotMatch(rules,/EXPLICIT OUTFIT CHOICE/);
  assert.match(rules,/default to the TROUSER ensemble/);
 }
 assert.match(outfitSelectionPrompt('Use a dress'),/EXPLICIT OUTFIT CHOICE: Use the DRESS ensemble/);
 assert.match(outfitSelectionPrompt('No dress, use trousers'),/default to the TROUSER ensemble/);
 assert.match(outfitSelectionPrompt('Use trousers'),/EXPLICIT OUTFIT CHOICE: Use the TROUSER ensemble/);
 assert.doesNotMatch(outfitSelectionPrompt('Use a dress',2),/EXPLICIT OUTFIT CHOICE/);
});

test('direct pipeline accepts four guests with one render and rejects five before any provider call',async()=>{
 await exercise(async calls=>{
  const source=new File(['camera-source'],'guest.jpg',{type:'image/jpeg'});
  const result=await generatePortrait({file:source,destinationId:'madrid',guestCount:4});
  assert.equal(result.bytes.toString(),'photo-result');assert.equal(calls.length,1);
  assert.match(calls[0].body.prompt,/GUEST GROUP: Exactly 4 posed foreground guests/);
  assert.equal(calls[0].body.n,1);assert.equal(calls[0].body.model,'gpt-image-2.5-flare');assert.equal(calls[0].body.quality,'medium');
  calls.length=0;
  await assert.rejects(generatePortrait({file:source,destinationId:'madrid',guestCount:5}),{code:'INVALID_GUEST_COUNT',status:400});
  assert.equal(calls.length,0);
 });
});
