import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import sendEmail from '../api/host-email.js';
// Render the actual provider payload with a local mock; no email is sent.
process.env.RESEND_API_KEY='preview-only';
let message;
globalThis.fetch=async(url,init)=>{
 if(!String(url).startsWith('https://api.resend.com/'))throw new Error('Unexpected network request');
 message=JSON.parse(init.body);
 return Response.json({id:'preview-only'});
};
const photo=await fs.readFile('public/assets/examples/barcelona.webp');
const result={status(code){this.code=code;return this;},json(data){this.data=data;return this;},send(data){throw new Error(String(data));}};
await sendEmail({method:'POST',body:{email:'delivered@resend.dev',imageBase64:photo.toString('base64'),mimeType:'image/webp',filename:'portrait.webp'}},result);
if(result.code!==200||!message)throw new Error('Preview payload failed');
let html=message.html;
for(const a of message.attachments){
 const type=a.filename.endsWith('.png')?'image/png':'image/webp';
 html=html.replaceAll('cid:'+a.content_id,'data:'+type+';base64,'+a.content);
}
await fs.mkdir('artifacts',{recursive:true});
await fs.writeFile('artifacts/photo-email-preview.html',html);
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 for(const [label,width] of [['desktop',720],['mobile',390]]){
  await page.setViewportSize({width,height:900});
  await page.setContent(html);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:'artifacts/photo-email-'+label+'.png',fullPage:true});
 }
}finally{await browser.close();}
