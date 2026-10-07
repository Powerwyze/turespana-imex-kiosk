import {normalizeName,validName,CONSENT_VERSION} from './contact-policy.js';
export {validName} from './contact-policy.js';
export function normalizeEmail(value){return String(value??'').trim();}
export function validEmail(value){
 const email=normalizeEmail(value);
 return email.length<=254 && /^[a-zA-Z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(email)
 && !email.startsWith('.') && !email.includes('..') && !email.includes('.@');
}
export class PhotoEmail{
 constructor({deliver,onChange=()=>{}}){this.deliver=deliver;this.onChange=onChange;this.epoch=0;this.reset();}
 snapshot(){return {status:this.status,queued:this.queued,hasDraft:!!this.draft,hasName:validName(this.name),marketingOptIn:this.marketingOptIn,error:this.error};}
 emit(){this.onChange(this.snapshot());}
 reset(){this.epoch++;this.controller?.abort();this.controller=null;this.collecting=false;this.queued=false;this.image=null;this.draft='';this.name='';this.marketingOptIn=false;this.status='empty';this.error='';this.emit();}
 beginGeneration(){this.reset();this.collecting=true;this.status='review';this.emit();}
 setImage(image){
  if(image===this.image)return;
  if(this.collecting&&image){const queued=this.queued;this.collecting=false;this.image=image;this.queued=false;this.emit();if(queued)void this.confirm();return;}
  this.reset();this.image=image;
 }
 review(value=''){
  if(!this.image&&!this.collecting)return {error:'Wait for the finished photo before asking for contact details.'};
  if(this.status==='sending')return {error:'Email delivery is already in progress.'};
  if(this.status==='sent')return {error:'This photo has already been emailed.'};
  const next=normalizeEmail(value).slice(0,254);
  if(next!==this.draft)this.marketingOptIn=false;
  this.queued=false;this.draft=next;this.status='review';this.error='';this.emit();
  return {shown:true,valid:validEmail(this.draft),message:'Ask the guest to enter their name, check their email, optionally choose marketing messages, and tap Confirm & email photo. Only the guest can tick the checkbox. Nothing has been sent.'};
 }
 edit(value){if(!['review','error'].includes(this.status))return;const next=normalizeEmail(value).slice(0,254);if(next!==this.draft)this.marketingOptIn=false;this.queued=false;this.draft=next;this.error='';this.status='review';this.emit();}
 editName(value){if(!['review','error'].includes(this.status))return;this.queued=false;this.name=String(value??'').slice(0,120);this.error='';this.status='review';this.emit();}
 chooseMarketing(value){if(!['review','error'].includes(this.status))return;this.queued=false;this.marketingOptIn=value===true;this.emit();}
 cancel(){if(this.status==='sending')return;this.queued=false;this.collecting=false;this.draft='';this.name='';this.marketingOptIn=false;this.status='empty';this.error='';this.emit();}
 async confirm(){
  if(!['review','error'].includes(this.status)||!validEmail(this.draft)||!validName(this.name))return false;
  if(!this.image){if(this.collecting){this.queued=true;this.emit();}return false;}
  const epoch=this.epoch,payload={email:this.draft,name:normalizeName(this.name),marketingOptIn:this.marketingOptIn,consentVersion:CONSENT_VERSION,image:this.image};
  this.status='sending';this.error='';this.controller=new AbortController();this.emit();
  try{
   await this.deliver({...payload,signal:this.controller.signal});
   if(epoch!==this.epoch)return false;
   this.status='sent';this.draft='';this.name='';this.marketingOptIn=false;this.error='';this.emit();return true;
  }catch{
   if(epoch!==this.epoch)return false;
   this.status='error';this.error='We could not confirm delivery. Your details are still here. Tap to try again.';this.emit();return false;
  }finally{if(epoch===this.epoch)this.controller=null;}
 }
}
