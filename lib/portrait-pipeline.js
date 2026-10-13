import {openaiFetch} from './openai-failover.js';
import {readFile} from 'node:fs/promises';
import {culturalPortraitPrompt} from './master-transformation.js';

export const PIPELINE_VERSION='regional-oil-v11';
export const IMAGE_QUALITY='medium';
export const MAX_PORTRAIT_ATTEMPTS=1;
export const IMAGE_MODEL='gpt-image-2.5-flare';
const destinations=JSON.parse(await readFile(new URL('../public/data/destinations.json',import.meta.url),'utf8')).destinations;
const references=new Map();
const styleReference=await readFile(new URL('../assets/velazquez-style-reference.jpg',import.meta.url));
const styleReferenceUrl='data:image/jpeg;base64,'+styleReference.toString('base64');
export class PortraitError extends Error {
  constructor(code,message,status=502){super(message);this.code=code;this.status=status;}
}
export async function regionReference(id){
  const dest=destinations.find(d=>d.id===id);
  if(!dest)throw new PortraitError('INVALID_DESTINATION','Choose one of the six Spanish destinations.',400);
  if(!references.has(id))references.set(id,await readFile(new URL('../assets/region-references/'+id+'.jpg',import.meta.url)));
  return {dest,referenceUrl:'data:image/jpeg;base64,'+references.get(id).toString('base64')};
}
export async function generatePortrait({file,destinationId,guestCount=1,style='',signal}){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)throw new PortraitError('NOT_CONFIGURED','The photo service is not configured.',503);
  const {dest,referenceUrl}=await regionReference(destinationId);
  if(![1,2,3].includes(guestCount))throw new PortraitError('INVALID_GUEST_COUNT','Choose 1, 2, or 3 people.',400);
  if(!file || typeof file.arrayBuffer!=='function' || !file.size || !['image/jpeg','image/png','image/webp'].includes(file.type))
    throw new PortraitError('INVALID_PHOTO','Please take a new photo.',400);
  if(file.size>8*1024*1024)throw new PortraitError('IMAGE_TOO_LARGE','Image is too large.',413);
  const sourceUrl='data:'+file.type+';base64,'+Buffer.from(await file.arrayBuffer()).toString('base64');
  const deadline=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(90000)]);
  const started=Date.now();
  const prompt=culturalPortraitPrompt(dest,{guestCount,style});
  const timings={generationMs:0,verificationMs:0};
  for(let attempt=1;attempt<=MAX_PORTRAIT_ATTEMPTS;attempt++){
  if(deadline.aborted)throw new PortraitError('GENERATION_UNAVAILABLE','The portrait took too long. Your original photo is retained.',503);
  let response;
  const generationStarted=Date.now();
  try{
    response=await openaiFetch('https://api.openai.com/v1/images/edits',{
      method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:deadline,
      body:JSON.stringify({
        model:IMAGE_MODEL,
        images:[{image_url:sourceUrl},{image_url:referenceUrl},{image_url:styleReferenceUrl}],
        prompt,
        size:'1024x1536',quality:IMAGE_QUALITY,output_format:'jpeg',n:1
      })
    });
  }catch(e){
    throw new PortraitError('GENERATION_UNAVAILABLE',e?.name==='TimeoutError'?'This portrait took too long. Your original photo is saved for retry.':'The photo service could not be reached. Please try again.',503);
  }
  if(!response.ok){
    // Do not expose provider messages or automatically spend on a different model.
    console.warn('Portrait provider rejected request',{status:response.status,pipeline:PIPELINE_VERSION});
    throw new PortraitError('GENERATION_FAILED','Image generation failed. Please try again.',response.status===429?429:502);
  }
  const data=await response.json().catch(()=>null);
  const generationMs=Date.now()-generationStarted;
  timings.generationMs+=generationMs;
  const outputB64=data?.data?.[0]?.b64_json;
  if(typeof outputB64!=='string'||!outputB64)throw new PortraitError('EMPTY_IMAGE','No image was returned. Your original photo is saved for retry.');
  // Deliver the completed render directly; aesthetic checks must never discard it.
  console.info('Portrait render timing',{attempt,generationMs,totalMs:Date.now()-started,quality:IMAGE_QUALITY,pipeline:PIPELINE_VERSION});
  return {bytes:Buffer.from(outputB64,'base64'),mimeType:'image/jpeg',model:IMAGE_MODEL,pipeline:PIPELINE_VERSION,attempts:attempt,timings:{...timings,totalMs:Date.now()-started}};
  }
}
