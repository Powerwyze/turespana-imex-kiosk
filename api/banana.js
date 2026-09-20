import formidable from 'formidable';
import {readFile,unlink} from 'node:fs/promises';
import {POST} from './host-photo.js';
// The classic and voice kiosks share the same validated transformation pipeline.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.statusCode=405;return res.end('Method not allowed');}
  let files;
  try{
    const [fields,uploads]=await formidable({multiples:false,maxFileSize:8*1024*1024}).parse(req);
    files=uploads;
    const one=k=>Array.isArray(fields[k])?fields[k][0]:fields[k];
    const image=Array.isArray(files.image)?files.image[0]:files.image;
    if(!image?.filepath){res.statusCode=400;return res.end('Missing image upload');}
    const form=new FormData();
    form.append('image',new Blob([await readFile(image.filepath)],{type:image.mimetype||'image/jpeg'}),'guest.jpg');
    form.append('destinationId',one('destinationId')||one('destination')||'');
    form.append('guestCount',one('guestCount')||'1');
    form.append('style',one('style')||'');
    const result=await POST(new Request('https://turespana-imex-kiosk.vercel.app/api/host-photo',{method:'POST',body:form}));
    res.statusCode=result.status;
    for(const [k,v] of result.headers)res.setHeader(k,v);
    return res.end(Buffer.from(await result.arrayBuffer()));
  }catch{
    res.statusCode=400;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:'Please take a new photo.'}));
  }finally{
    for(const file of Object.values(files||{}).flat())if(file?.filepath)await unlink(file.filepath).catch(()=>{});
  }
}
export const config={api:{bodyParser:false}};
