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
const generate=(destinationId,guestCount=1)=>generatePortrait({file:new File(['camera-source'],'guest.jpg',{type:'image/jpeg'}),destinationId,guestCount});
test('all six regions return the render directly with face identity prioritized',async()=>{
 await exercise(async calls=>{
  for(const dest of destinations){
   calls.length=0;const result=await generate(dest.id,2);
   assert.equal(result.bytes.toString(),'photo-result');assert.equal(result.pipeline,PIPELINE_VERSION);
   assert.equal(calls.length,1);assert.equal(result.attempts,1);assert.equal(result.timings.verificationMs,0);
   const edit=calls[0].body;
   assert.equal(edit.quality,'medium');assert.equal(edit.size,'1024x1536');assert.equal(edit.images.length,2);
   assert.equal(edit.images[0].image_url,'data:image/jpeg;base64,'+Buffer.from('camera-source').toString('base64'));
   assert.equal(edit.images[1].image_url,'data:image/jpeg;base64,'+readFileSync('assets/region-references/'+dest.id+'.jpg').toString('base64'));
   assert.match(edit.prompt,/iPhone/);assert.doesNotMatch(edit.prompt,/Image 3|Velázquez|SPANISH BAROQUE/);assert.match(edit.prompt,/Facial likeness takes precedence/);
   assert.match(edit.prompt,/best-effort guidance, not acceptance requirements/);
   assert.match(edit.prompt,/Guests do not need to be centered/);assert.match(edit.prompt,/head-to-body scale/);
   assert.match(edit.prompt,/GUEST GROUP: Exactly 2 posed foreground guests/);
   assert.match(edit.prompt,/For two women, give BOTH guests women's regional outfits; for two men, give BOTH guests men's regional outfits/);
   assert.match(edit.prompt,/Never force one dress and one trouser outfit, alternate outfits by position/);
   assert.doesNotMatch(edit.prompt,/default to the TROUSER ensemble|shirt, T-shirt, jacket, suit, shorts or trousers uses/);
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
test('outfit matching has no male fallback and preserves individual garment requests',()=>{
 assert.doesNotMatch(outfitSelectionPrompt(),/EXPLICIT OUTFIT CHOICE|default to the TROUSER ensemble/);
 for(const request of ['No dress', "Don't put me in a dress", 'Sin vestido','No dress, use trousers']){
  const rules=outfitSelectionPrompt(request);
  assert.match(rules,/EXPLICIT OUTFIT CHOICE: Use the TROUSER ensemble/);
  assert.doesNotMatch(rules,/EXPLICIT OUTFIT CHOICE: Use the DRESS ensemble/);
 }
 assert.match(outfitSelectionPrompt('Use a dress'),/EXPLICIT OUTFIT CHOICE: Use the DRESS ensemble/);
 assert.match(outfitSelectionPrompt('No trousers; use a dress'),/EXPLICIT OUTFIT CHOICE: Use the DRESS ensemble/);
 assert.match(outfitSelectionPrompt('Use trousers'),/EXPLICIT OUTFIT CHOICE: Use the TROUSER ensemble/);
 for(const count of [2,3,4])for(const request of ['Use a dress','Use trousers','No dress'])assert.doesNotMatch(outfitSelectionPrompt(request,count),/EXPLICIT OUTFIT CHOICE/,'Unassigned requests must not dress the entire group');
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
