// Keep countdown silent. For other transitions, suppress only obsolete speech:
// live acknowledgments and transcript timestamps identify current-screen output.
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function staleForPhase(phase,text){
 const line=normalize(text);
 if(phase!=='choosing_people'&&/how many (people|persons)|cuantas personas|one,? two,? or three/.test(line))return true;
 if(phase!=='choosing_destination'&&/which (city|destination)|choose (a|your|the) (city|destination)|que ciudad|cual.*destino/.test(line))return true;
 if(!['listening','preparing','countdown'].includes(phase)&&/look (at|toward) the camera|start.*countdown|mira.*camara/.test(line))return true;
 return false;
}
function matchesPhase(phase,text,destination){
 const line=normalize(text);if(staleForPhase(phase,line))return false;
 if(phase==='choosing_people')return /how many|people.*picture|cuantas personas|una,? dos,? o tres/.test(line);
 if(phase==='choosing_destination')return /which (city|destination)|choose.*(city|destination)|city of your choice|que ciudad|cual.*destino/.test(line);
 if(phase==='generating'){
  const places={canarias:/canary islands|islas canarias|canarias|teide|national parks/,barcelona:/barcelona|gaudi|sagrada/,bilbao:/bilbao|guggenheim/,madrid:/madrid|retiro|prado/,andalucia:/andalucia|andalusia|seville|sevilla|alhambra/,valencia:/valencia|paella|albufera/};
  return /great choice|photo.*(creat|generat)|image.*(creat|generat)|portrait.*(creat|generat)|while (we|you) wait|name and email|nombre.*correo/.test(line)||!!places[destination]?.test(line);
 }
 if(phase==='result')return /photo.*(ready|finished)|image.*(ready|finished)|portrait.*(ready|finished)|sent|inbox|foto.*lista|enviad/.test(line);
 if(phase==='error')return /try again|could not|couldn.t|retry|problem|intenta|no se pudo/.test(line);
 if(phase==='listening')return /lola|photo host|ready|take your time|taking your picture|look.*camera|listo|lista|foto/.test(line);
 return false;
}
export class HostVoiceSync {
 constructor({audio,speak,getLevel=()=>0,now=()=>performance.now(),setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}){
  Object.assign(this,{audio,sendSpeech:speak,getLevel,now,setTimer,clearTimer});this.reset();
 }
 reset(){
  this.clearTimer(this.timer);this.timer=null;this.phase=null;this.pending=null;this.draining=false;this.audio.muted=false;
  this.lastOutput=-Infinity;this.lastSound=-Infinity;this.lastEnd=null;this.currentAck=null;this.expectedAcks=new Set();this.sentence='';this.captionDelta='';
 }
 transition(phase,{destinationId=null}={}){
  this.destinationId=destinationId;if(phase===this.phase)return;
  const previous=this.phase;this.clearTimer(this.timer);this.timer=null;this.phase=phase;this.pending=null;this.currentAck=null;this.expectedAcks.clear();this.sentence='';
  if(this.getLevel()>.018)this.lastSound=this.now();
  // Do not invent new activity: the seven silent countdown seconds must count.
  this.draining=this.blocked()||(this.now()-this.lastOutput<900||this.now()-this.lastSound<350);
  if(phase==='listening'&&[null,'idle','connecting'].includes(previous))this.draining=false;
  this.audio.muted=this.draining;
  if(this.draining&&!this.blocked())this.poll();
 }
 blocked(){return ['preparing','countdown','idle','connecting'].includes(this.phase);}
 expectStateAck(eventId){if(eventId)this.expectedAcks.add(eventId);}
 acknowledge(event){
  if(!['session.thinking.appended','session.instructions.appended'].includes(event.type)||!this.expectedAcks.has(event.client_event_id))return;
  this.expectedAcks.delete(event.client_event_id);
  const point=Number.isFinite(event.start_ms)?event.start_ms:event.end_ms;
  if(Number.isFinite(point))this.currentAck=this.currentAck===null?point:Math.min(this.currentAck,point);
 }
 observeOutput(event={}){
  const {delta='',start_ms:start,end_ms:end}=event;
  const gap=Number.isFinite(start)&&Number.isFinite(this.lastEnd)?start-this.lastEnd:0;
  this.lastOutput=this.now();if(this.getLevel()>.018)this.lastSound=this.now();
  if(Number.isFinite(end))this.lastEnd=end;
  this.sentence=(this.sentence+delta).slice(-600);this.captionDelta=delta;
  if(this.blocked()){if(/[.!?]\s*$/.test(delta))this.sentence='';return false;}
  const acknowledged=this.currentAck!==null&&Number.isFinite(start)&&start>=this.currentAck;
  const relevant=matchesPhase(this.phase,this.sentence,this.destinationId);
  // A new utterance after the current state's provider acknowledgment is fresh.
  // Continuous output also becomes audible as soon as it describes this screen.
  if(this.draining&&acknowledged&&((gap>=600&&!staleForPhase(this.phase,this.sentence))||relevant)){
   this.draining=false;this.audio.muted=false;this.captionDelta=this.sentence;this.pending=null;
  }else if(!this.draining&&(acknowledged||relevant))this.pending=null;
  if(/[.!?]\s*$/.test(delta))this.sentence='';
  return !this.draining;
 }
 speak(content){
  if(this.blocked())return;
  // The state update/tool result may already prompt the right speech. Give it a
  // short opportunity to do so instead of requesting the same question twice.
  this.pending=content;this.cueAt=this.now()+900;this.poll();
 }
 poll(){
  if(this.timer||this.blocked())return;
  this.timer=this.setTimer(()=>{
   this.timer=null;if(this.blocked())return;
   if(this.getLevel()>.018)this.lastSound=this.now();
   if(this.draining&&this.now()-this.lastOutput>=900&&this.now()-this.lastSound>=350){this.draining=false;this.audio.muted=false;}
   if(!this.draining&&this.pending&&this.now()>=this.cueAt){const latest=this.pending;this.pending=null;this.sendSpeech(latest);}
   if(this.draining||this.pending)this.poll();
  },100);
 }
}
