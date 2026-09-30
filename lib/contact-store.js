import {createHash} from 'node:crypto';
import {validName,normalizeName,CONSENT_VERSION} from '../public/contact-policy.js';
import {validEmail} from '../public/host-email.js';
export const CONTACT_ENDPOINT='https://turespana-imex-kiosk.powerwyze-2010.chatgpt.site/api/kiosk-contact';
export function validateContact(body={}){
 if(!validName(body.name)||!validEmail(body.email))return null;
 if(body.marketingOptIn!==undefined&&typeof body.marketingOptIn!=='boolean')return null;
 const marketingOptIn=body.marketingOptIn===true;
 if(marketingOptIn&&body.consentVersion!==CONSENT_VERSION)return null;
 const destinationId=String(body.destinationId||'');
 if(!['canarias','barcelona','bilbao','madrid','andalucia','valencia'].includes(destinationId))return null;
 return {name:normalizeName(body.name),email:body.email.trim(),destinationId,marketingOptIn,consentVersion:CONSENT_VERSION};
}
export async function storeContact(contact,bytes){
 const portraitHash=createHash('sha256').update(bytes).digest('hex');
 const response=await fetch(CONTACT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://turespana-imex-kiosk.vercel.app'},body:JSON.stringify({...contact,portraitHash}),signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.stored!==true)throw new Error('Contact storage unavailable');
 return result;
}
