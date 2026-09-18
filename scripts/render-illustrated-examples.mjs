import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const target=process.env.TURESPANA_HOST_PREVIEW_URL;if(!target)throw new Error('Missing preview URL');
const ids=(process.env.EXAMPLE_DESTINATIONS||'canarias,barcelona,bilbao').split(',');
const allowed=["canarias","barcelona","bilbao","madrid","andalucia","valencia"];if(ids.some(id=>!allowed.includes(id)))throw new Error('Invalid example destination');
const sourceIds={canarias:'galicia',barcelona:'cataluna',bilbao:'pais-vasco'};
const browser=await chromium.launch();await fs.mkdir('artifacts/illustrated-examples',{recursive:true});
try{
  async function render(id){
    const page=await browser.newPage();
    try{
      await page.goto(target);
      const input=await fs.readFile('assets/destination-examples-source/'+(sourceIds[id]||id)+'.png');
      const result=await page.evaluate(async({base64,id})=>{
        const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const form=new FormData();
        form.append('image',new Blob([bytes],{type:'image/png'}),'fictional-example.png');form.append('guestCount','1');form.append('destinationId',id);form.append('style','');
        const response=await fetch('/api/host-photo',{method:'POST',body:form,signal:AbortSignal.timeout(190000)});
        if(!response.ok)return {status:response.status,error:await response.text()};
        const output=new Uint8Array(await response.arrayBuffer());let binary='';for(const b of output)binary+=String.fromCharCode(b);return {status:200,base64:btoa(binary)};
      },{base64:input.toString('base64'),id});
      if(result.status!==200)throw new Error(id+': '+result.status+' '+result.error);
      await fs.writeFile('artifacts/illustrated-examples/'+id+'.jpg',Buffer.from(result.base64,'base64'));console.log('Rendered illustrated example:',id);
    }finally{await page.close();}
  }
  for(let i=0;i<ids.length;i+=2)await Promise.all(ids.slice(i,i+2).map(render));
}finally{await browser.close();}
