import {readFile} from 'node:fs/promises';
import {culturalPortraitPrompt} from './master-transformation.js';
import {checkPortrait} from './subject-check.js';

export const PIPELINE_VERSION='regional-photo-v5';
export const IMAGE_MODEL='gpt-image-2.5-flare';
const destinations=JSON.parse(await readFile(new URL('../public/data/destinations.json',import.meta.url),'utf8')).destinations;
const references=new Map();
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
  const deadline=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(280000)]);
  const started=Date.now();let correction='';
  for(let attempt=1;attempt<=3;attempt++){
  if(deadline.aborted)throw new PortraitError('GENERATION_UNAVAILABLE','The portrait took too long. Your original photo is retained.',503);
  let response;
  try{
    response=await fetch('https://api.openai.com/v1/images/edits',{
      method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:deadline,
      body:JSON.stringify({
        model:IMAGE_MODEL,
        images:[{image_url:sourceUrl},{image_url:referenceUrl}],
        prompt:culturalPortraitPrompt(dest,{guestCount,style})+correction,
        size:'1024x1536',quality:'xhigh',output_format:'jpeg',n:1
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
  const outputB64=data?.data?.[0]?.b64_json;
  if(typeof outputB64!=='string'||!outputB64)throw new PortraitError('EMPTY_IMAGE','No image was returned. Your original photo is saved for retry.');
  let verdict;
  try{
    verdict=await checkPortrait({apiKey,sourceUrl,outputUrl:'data:image/jpeg;base64,'+outputB64,referenceUrl,guestCount,destination:dest.label,hairRequirements:dest.hairPrompt,signal:deadline});
  }catch{
    throw new PortraitError('SUBJECT_CHECK_UNAVAILABLE','The portrait could not be checked. Your original photo is saved for retry.',503);
  }
  if(!verdict.subjects)throw new PortraitError('SUBJECT_COUNT_MISMATCH','The portrait did not match your group. Confirm the number of people and try again.',422);
  if(!verdict.quality){
    if(verdict.retryable&&attempt<3&&!deadline.aborted&&Date.now()-started<220000){
      const instructions={face_and_hair_consistent:'Preserve the original guest facial structure, hair color, natural hairline, skin tone, age range and distinguishing characteristics. Use the same subtle editorial finish specified above without reconstructing facial features or copying the reference person.',photographic:'Use realistic skin texture, real fabric, believable anatomy and balanced bright daylight with crisp facial detail.',regional_outfit_matches:'Reproduce the complete regional outfit with its distinguishing fabrics, patterns, layers and accessories.',regional_hair_accessories_match:'Include the destination-specific coiffure and required accessories for the chosen ensemble, without hiding the face.',outfit_visible:'Pull the camera back so EVERY guest is framed below the knees with hands, waist and the outfit visible.',no_poster_layout:'Return one edge-to-edge photograph with no lettering, frame, collage or blank margins.'};
      correction='\nAUTOMATIC OUTFIT/FRAMING CORRECTION: Make a fresh edit using the ORIGINAL guest photo and the same regional reference. Preserve the original guests and all identity rules. '+verdict.failedChecks.map(flag=>instructions[flag]).join(' ');
      console.info('Portrait quality correction',{attempt,failedChecks:verdict.failedChecks,pipeline:PIPELINE_VERSION});
      continue;
    }
    throw new PortraitError('PORTRAIT_QUALITY_MISMATCH','The portrait could not meet the required check within the available attempts. Your original photo is saved. Please retake or explicitly retry.',422);
  }
  return {bytes:Buffer.from(outputB64,'base64'),mimeType:'image/jpeg',model:IMAGE_MODEL,pipeline:PIPELINE_VERSION,attempts:attempt};
  }
}
