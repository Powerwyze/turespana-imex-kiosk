// Only explicit short readiness replies, after count/destination selection.
export function isReadyReply(text){
 const s=String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
 return /^(?:(?:yes|yeah|yep|okay|ok|sure|ready|im ready|i am ready|were ready|we are ready|go ahead|lets go|si|vale|listo|lista|listos|listas|estoy listo|estoy lista|estamos listos|estamos listas)(?: (?:yes|okay|ok|ready|please|go ahead|take (?:the |a |my |our )?(?:photo|picture)))?|(?:please )?take (?:the |a |my |our )?(?:photo|picture)(?: please)?|toma la foto|haz la foto)$/.test(s);
}
export class ReadinessReply {
 constructor({canTrigger,onReady,delay=1000}){Object.assign(this,{canTrigger,onReady,delay});this.reset();}
 reset(){clearTimeout(this.timer);this.buffer='';this.timer=null;}
 append(delta){
  if(!this.canTrigger()){this.reset();return;}
  if(typeof delta!=='string'||!delta)return;
  clearTimeout(this.timer);this.buffer=(this.buffer+delta).slice(-500);
  this.timer=setTimeout(()=>{const text=this.buffer;this.reset();if(this.canTrigger()&&isReadyReply(text))this.onReady();},this.delay);
 }
}
