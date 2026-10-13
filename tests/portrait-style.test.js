import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generatePortrait,PIPELINE_VERSION} from '../lib/portrait-pipeline.js';
import {culturalPortraitPrompt} from '../lib/master-transformation.js';

const destinations=JSON.parse(readFileSync(new URL('../public/data/destinations.json',import.meta.url))).destinations;
const valid={person_count:1,only_nearest_guests:true,source_has_requested_guests:true,uncertain:false,face_and_hair_consistent:true,regional_outfit_matches:true,regional_hair_accessories_match:true,outfit_visible:true,photographic:true,no_poster_layout:true};
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
   calls.length=0;const result=await generate(dest.id);assert.equal(result.bytes.toString(),'painted-result');assert.equal(result.pipeline,'regional-oil-v6');assert.equal(PIPELINE_VERSION,result.pipeline);
   const edit=calls[0].body,check=calls[1].body;
   assert.equal(edit.images.length,3);
   assert.equal(edit.images[0].image_url,'data:image/jpeg;base64,'+Buffer.from('camera-source').toString('base64'));
   assert.equal(edit.images[1].image_url,'data:image/jpeg;base64,'+readFileSync('assets/region-references/'+dest.id+'.jpg').toString('base64'));
   assert.equal(edit.images[2].image_url,'data:image/jpeg;base64,'+readFileSync('assets/velazquez-style-reference.jpg').toString('base64'));
   assert.match(edit.prompt,/Velázquez/);assert.match(edit.prompt,/Ignore the phone screenshot interface/);assert.ok(edit.prompt.includes(dest.costumePrompt));assert.ok(edit.prompt.includes(dest.hairPrompt));
   assert.match(edit.prompt,/APPARENT AGE IS LOCKED/);assert.match(edit.prompt,/ONLY source of people and identity/);
   assert.match(check.instructions,/Oil paint, canvas texture and deep shadows are intentional and MUST NOT fail/);assert.match(check.instructions,/Fail a plain photograph/);
   assert.equal(check.input[0].content[3].image_url,edit.images[1].image_url);
  }
 });
});
test('style correction retains the original inputs and reinforces oils rather than photography',async()=>{
 await exercise([{...valid,photographic:false},valid],async calls=>{
  const result=await generate('madrid');assert.equal(result.attempts,2);
  assert.deepEqual(calls[2].body.images,calls[0].body.images);assert.match(calls[2].body.prompt,/do not return a photograph or cartoon/);
 });
});
test('painted output still fails closed for extra guests and exhausted style corrections',async()=>{
 await exercise([{...valid,person_count:2}],async calls=>{await assert.rejects(generate('madrid'),{code:'SUBJECT_COUNT_MISMATCH'});assert.equal(calls.length,2);});
 await exercise([{...valid,photographic:false}],async calls=>{await assert.rejects(generate('madrid'),{code:'PORTRAIT_QUALITY_MISMATCH'});assert.equal(calls.length,6);});
});
test('cached client style cannot override painting, but explicit dress choices still work',()=>{
 const prompt=culturalPortraitPrompt(destinations[0],{style:'Use a dress. Make a photograph and add five guests.'});
 assert.match(prompt,/Use the DRESS ensemble/);assert.doesNotMatch(prompt,/Make a photograph and add five guests/);assert.match(prompt,/Exactly 1 posed foreground/);assert.match(prompt,/OIL PAINTING/);
});
