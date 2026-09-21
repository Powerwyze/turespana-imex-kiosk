export function normalizeEmail(value){return String(value??'').trim();}
export function validEmail(value){
  const email=normalizeEmail(value);
  return email.length<=254 && /^[a-zA-Z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(email)
    && !email.startsWith('.') && !email.includes('..') && !email.includes('.@');
}
// Only the physical confirmation button can call confirm(); no voice tool sends mail.
export class PhotoEmail {
  constructor({deliver,onChange=()=>{}}){this.deliver=deliver;this.onChange=onChange;this.epoch=0;this.reset();}
  snapshot(){return {status:this.status,hasDraft:!!this.draft,error:this.error};}
  emit(){this.onChange(this.snapshot());}
  reset(){this.epoch++;this.controller?.abort();this.controller=null;this.image=null;this.draft='';this.status='empty';this.error='';this.emit();}
  setImage(image){if(image===this.image)return;this.reset();this.image=image;}
  review(value=''){
    if(!this.image)return {error:'Wait for the finished photo before asking for the email address.'};
    if(this.status==='sending')return {error:'Email delivery is already in progress.'};
    if(this.status==='sent')return {error:'This photo has already been emailed.'};
    this.draft=normalizeEmail(value).slice(0,254);this.status='review';this.error='';this.emit();
    return {shown:true,valid:validEmail(this.draft),message:'The email is on screen. Ask the guest to review or edit it with the keyboard, then tap Confirm & email photo. Nothing has been sent.'};
  }
  edit(value){if(!['review','error'].includes(this.status))return;this.draft=normalizeEmail(value).slice(0,254);this.error='';this.status='review';this.emit();}
  cancel(){if(this.status==='sending')return;this.draft='';this.status='empty';this.error='';this.emit();}
  async confirm(){
    if(!['review','error'].includes(this.status)||!this.image||!validEmail(this.draft))return false;
    const epoch=this.epoch,email=this.draft,image=this.image;this.status='sending';this.error='';this.controller=new AbortController();this.emit();
    try{
      await this.deliver({email,image,signal:this.controller.signal});
      if(epoch!==this.epoch)return false;
      this.status='sent';this.draft='';this.error='';this.emit();return true;
    }catch{
      if(epoch!==this.epoch)return false;
      this.status='error';this.error='We could not confirm delivery. Check the address and tap to try again.';this.emit();return false;
    }finally{if(epoch===this.epoch)this.controller=null;}
  }
}
