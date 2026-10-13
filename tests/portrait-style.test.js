import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generatePortrait,PIPELINE_VERSION,IMAGE_QUALITY,MAX_PORTRAIT_ATTEMPTS} from '../lib/portrait-pipeline.js';
import {culturalPortraitPrompt} from '../lib/master-transformation.js';
import {POST} from '../api/host-photo.js';
import {outfitSelectionPrompt} from '../lib/portrait-outfit.js';

const destinations=JSON.parse(readFileSync(new URL('../public/data/destinations.json',import.meta.url))).destinations;
const valid={person_count:1,only_nearest_guests:true,source_has_requested_guests:true,uncertain:false,face_and_hair_consistent:true,outfit_choice_consistent:true,body_proportions_consistent:true,regional_outfit_matches:true,regional_hair_accessories_match:true,outfit_visible:true,photographic:true,no_poster_layout:true};
const envelope=check=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(check)}]}]});

async function exercise(checks,run){
 const priorFetch=globalThis.fetch,priorKey=process.env.OPENAI_API_KEY,calls=[];let checkIndex=0;
 process.env.OPENAI_API_KEY='test-only-placeholder';
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url:String(url),body});
  if(String(url).endsWith('/images/edits'))return Response.json({data:[{b64_json:Buffer.from('painted-result').toString('base64')}]});
  if(String(url).endsWith('/responses'))return Response.json(envelope(checks[Math.min(checkIndex++,checks.length-1)]));
  throw Error('Unexpected URL');
 };
 try{await run(calls);}finally{globalThis.fetch=priorFetch;if(priorKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=priorKey;}
}
const generate=destinationId=>generatePortrait({file:new File(['camera-source'],'guest.jpg',{type:'image/jpeg'}),destinationId});

test('all six destinations use source identity, regional wardrobe and the supplied painting reference',async()=>{
 await exercise([valid],async calls=>{
  for(const dest of destinations){
   calls.length=0;const result=await generate(dest.id);assert.equal(result.bytes.toString(),'painted-result');assert.equal(result.pipeline,'regional-oil-v10');assert.equal(PIPELINE_VERSION,result.pipeline);
   const edit=calls[0].body,check=calls[1].body;
   assert.equal(edit.quality,'medium');assert.equal(IMAGE_QUALITY,'medium');assert.equal(edit.size,'1024x1536');assert.equal(MAX_PORTRAIT_ATTEMPTS,1);
   assert.ok(result.timings.generationMs>=0);assert.ok(result.timings.verificationMs>=0);assert.ok(result.timings.totalMs>=0);
   assert.equal(edit.images.length,3);
   assert.equal(edit.images[0].image_url,'data:image/jpeg;base64,'+Buffer.from('camera-source').toString('base64'));
   assert.equal(edit.images[1].image_url,'data:image/jpeg;base64,'+readFileSync('assets/region-references/'+dest.id+'.jpg').toString('base64'));
   assert.equal(edit.images[2].image_url,'data:image/jpeg;base64,'+readFileSync('assets/velazquez-style-reference.jpg').toString('base64'));
   assert.match(edit.prompt,/Velázquez/);assert.match(edit.prompt,/Ignore the phone screenshot interface/);assert.ok(edit.prompt.includes(dest.costumePrompt));assert.ok(edit.prompt.includes(dest.hairPrompt));
   assert.match(edit.prompt,/APPARENT AGE IS LOCKED/);assert.match(edit.prompt,/ONLY source of people and identity/);
   assert.match(check.instructions,/Oil paint, canvas texture and deep shadows are intentional and MUST NOT fail/);assert.match(check.instructions,/NOT an exact art-style test/);assert.match(check.instructions,/Guests DO NOT need to be centered/);
   assert.equal(check.input[0].content.length,3);assert.ok(!check.text.format.schema.required.includes('regional_hair_accessories_match'));
  }
 });
});
test('painted output still fails closed for extra guests and exhausted usability corrections',async()=>{
 await exercise([{...valid,person_count:2}],async calls=>{await assert.rejects(generate('madrid'),{code:'SUBJECT_COUNT_MISMATCH'});assert.equal(calls.length,2);});
 await exercise([{...valid,photographic:false}],async calls=>{await assert.rejects(generate('madrid'),{code:'PORTRAIT_QUALITY_MISMATCH'});assert.equal(calls.length,2);});
});
test('cached client style cannot override painting, but explicit dress choices still work',()=>{
 const prompt=culturalPortraitPrompt(destinations[0],{style:'Use a dress. Make a photograph and add five guests.'});
 assert.match(prompt,/Use the DRESS ensemble/);assert.doesNotMatch(prompt,/Make a photograph and add five guests/);assert.match(prompt,/Exactly 1 posed foreground/);assert.match(prompt,/OIL PAINTING/);
});

test('usable off-center portrait with costume and layout differences reaches the client without regeneration',async()=>{
 await exercise([{...valid,regional_outfit_matches:false,regional_hair_accessories_match:false,no_poster_layout:false}],async calls=>{
  const form=new FormData();form.append('image',new File(['camera-source'],'guest.jpg',{type:'image/jpeg'}));form.append('destinationId','madrid');form.append('guestCount','1');
  const response=await POST(new Request('https://kiosk.example/api/host-photo',{method:'POST',body:form}));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal(await response.text(),'painted-result');assert.equal(calls.length,2);
  assert.match(response.headers.get('server-timing'),/generation;dur=\d+, verification;dur=\d+, total;dur=\d+/);
  assert.match(calls[0].body.prompt,/Guests do not need to be centered/);
  assert.match(calls[1].body.instructions,/Off-center, chest-up, waist-up/);
 });
});

test('a late failed first attempt does not start another long generation',async()=>{
 await exercise([{...valid,outfit_choice_consistent:false}],async calls=>{
  const originalNow=Date.now,fetchMock=globalThis.fetch;let now=1000;
  Date.now=()=>now;
  globalThis.fetch=async(url,init)=>{const response=await fetchMock(url,init);if(String(url).endsWith('/responses'))now+=91000;return response;};
  try{await assert.rejects(generate('canarias'),{code:'PORTRAIT_QUALITY_MISMATCH'});assert.equal(calls.length,2);}
  finally{Date.now=originalNow;globalThis.fetch=fetchMock;}
 });
});

test('a guest largely outside the frame or with unrecognizable likeness still needs correction',async()=>{
 for(const flag of ['outfit_visible','face_and_hair_consistent']){
  await exercise([{...valid,[flag]:false}],async calls=>{
   await assert.rejects(generate('madrid'),{code:'PORTRAIT_QUALITY_MISMATCH'});assert.equal(calls.length,2);

  });
 }
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

for(const flag of ['outfit_choice_consistent','body_proportions_consistent']){
 test(flag+' rejects incorrect portraits without an automatic regeneration',async()=>{
  await exercise([{...valid,[flag]:false}],async calls=>{
   const form=new FormData();form.append('image',new File(['camera-source'],'guest.jpg',{type:'image/jpeg'}));form.append('destinationId','canarias');
   const response=await POST(new Request('https://kiosk.example/api/host-photo',{method:'POST',body:form}));
   assert.equal(response.status,422);assert.match(await response.text(),/PORTRAIT_QUALITY_MISMATCH/);assert.equal(calls.length,2);
  });
 });
}
