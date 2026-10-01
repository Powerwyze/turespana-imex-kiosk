import {generatePortrait,PortraitError} from '../lib/portrait-pipeline.js';
const SITE_ORIGIN='https://turespana-imex-kiosk.powerwyze-2010.chatgpt.site';
function json(body,status){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
function cors(req){
  const origin=req.headers.get('origin');
  return origin===SITE_ORIGIN?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Expose-Headers':'X-Portrait-Pipeline, X-Image-Model','Access-Control-Max-Age':'600'}:{};
}
export function OPTIONS(req){return new Response(null,{status:req.headers.get('origin')===SITE_ORIGIN?204:403,headers:cors(req)});}
export async function POST(req){
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin&&origin!==SITE_ORIGIN)return json({error:'Please open the kiosk on its official site.'},403);
  let response;
  try{
    let fd;try{fd=await req.formData();}catch{throw new PortraitError('INVALID_UPLOAD','Please take a new photo.',400);}
    if(fd.getAll('destinationId').length!==1)throw new PortraitError('INVALID_DESTINATION','Choose one of the six Spanish destinations.',400);
    const count=fd.get('guestCount')??'1';
    if(fd.getAll('guestCount').length>1||typeof count!=='string'||!/^[123]$/.test(count))throw new PortraitError('INVALID_GUEST_COUNT','Choose 1, 2, or 3 people.',400);
    if(fd.getAll('image').length!==1)throw new PortraitError('INVALID_PHOTO','Please take a new photo.',400);
    const result=await generatePortrait({file:fd.get('image'),destinationId:fd.get('destinationId'),guestCount:Number(count),style:String(fd.get('style')||'').slice(0,600),signal:req.signal});
    response=new Response(result.bytes,{status:200,headers:{'Content-Type':result.mimeType,'Cache-Control':'no-store','X-Portrait-Pipeline':result.pipeline,'X-Image-Model':result.model}});
  }catch(e){
    response=e instanceof PortraitError?json({code:e.code,error:e.message},e.status):json({code:'GENERATION_UNAVAILABLE',error:'The portrait could not be completed. Your original photo is saved for retry.'},503);
  }
  for(const [key,value] of Object.entries(cors(req)))response.headers.set(key,value);
  return response;
}
