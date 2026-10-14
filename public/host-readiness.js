// Wait for a stable utterance so “ready ... not yet” cannot use a partial yes.
export function readinessIntent(value){
 const text=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 if(!text)return 'none';
 if(/\b(no|not|dont|never|wait|stop|cancel|later|hold|espera|espere|todavia|aun|alto|despues)\b/.test(text))return 'hold';
 if(text.length>220)return 'none';
 if(/^(yes|yeah|yep|yup|sure|ok|okay|ready|im ready|i am ready|were ready|we are ready|all ready|lets go|lets do it|lets start|go|do it|cheese|im all set|were all set|go ahead|si|listo|lista|listos|listas|estoy listo|estoy lista|estamos listos|adelante)( please| now| lola| for (the |my |our )?(photo|picture))?$/.test(text))return 'ready';
 if(/^(yes|yeah|yep|okay|ok|sure|si) (please )?(im ready|i am ready|were ready|we are ready|ready|lets do it|lets go|go ahead|you can|estoy listo|estoy lista|estamos listos|take (the|my|our|a) (photo|picture))( please| now)?$/.test(text))return 'ready';
 if(/^(please |lola )?(can you |could you |lets |please )?(take|snap|retake) (a |the |my |our |another )?(photo|picture)( of (me|us))?( please| now)?$/.test(text))return 'ready';
 if(/^(i would like|id like|we would like|wed like|i want|we want) (a |my |our )?(photo|picture)( please)?$/.test(text))return 'ready';
 if(/^(please )?(take (it|the photo|the picture) again|another (photo|picture)|new (photo|picture)|otra foto|repite la foto)( please)?$/.test(text))return 'ready';
 if(/^(please )?(start|start now|start the countdown|start the photo|take it|take it now|retake|retake it|toma la foto|tome la foto|saca la foto|haz la foto)( please| now)?$/.test(text))return 'ready';
 return 'none';
}
export function retakeIntent(value){
 const text=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return readinessIntent(text)!=='hold'&&/\b(retake|another (photo|picture)|new (photo|picture)|take (it|the photo|the picture) again|otra foto|repite la foto)\b/.test(text);
}
export function boothChoice(value,phase){
 const text=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 if(readinessIntent(text)==='hold')return null;
 if(phase==='choosing_people'){
  const match=text.match(/^(?:(?:there (?:are|is)|we are|somos|hay) )?(1|2|3|4|one|two|three|four|uno|una|dos|tres|cuatro|just me|only me|solo yo)(?: (?:people|persons|person|persona|personas|of us))?(?: please| por favor)?$/);
  if(!match)return null;
  const count=({'1':1,'2':2,'3':3,'4':4,one:1,two:2,three:3,four:4,uno:1,una:1,dos:2,tres:3,cuatro:4,'just me':1,'only me':1,'solo yo':1})[match[1]];
  return {name:'set_guest_count',args:{count}};
 }
 if(phase==='choosing_destination'){
  const match=text.match(/^(?:(?:i choose|we choose|i want|we want|lets go to|quiero|queremos|vamos a) )?(canarias|canary islands|islas canarias|barcelona|bilbao|madrid|andalucia|andalusia|seville|sevilla|valencia)(?: please| por favor)?$/);
  if(!match)return null;
  const destinationId=({'canary islands':'canarias','islas canarias':'canarias',andalusia:'andalucia',seville:'andalucia',sevilla:'andalucia'})[match[1]]||match[1];
  return {name:'set_destination',args:{destinationId}};
 }
 return null;
}
export class ReadinessTrigger {
 constructor({canTrigger,onReady,onHold=()=>{},onStable=()=>{},delayMs=1400,setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}){
  Object.assign(this,{canTrigger,onReady,onHold,onStable,delayMs,setTimer,clearTimer});this.serial=0;this.reset();
 }
 reset(){this.clearTimer(this.timer);this.timer=null;this.buffer='';this.intent='none';this.pending=false;this.serial++;for(const resolve of this.waiters||[])resolve();this.waiters=[];}
 append(delta){
  if(typeof delta!=='string'||!delta)return;
  if(!this.pending){this.buffer='';this.serial++;}
  this.pending=true;this.buffer=(this.buffer+delta).slice(-1000);this.intent=readinessIntent(this.buffer);
  this.clearTimer(this.timer);if(this.intent==='hold')this.onHold();
  this.timer=this.setTimer(()=>this.finish(),this.delayMs);
 }
 finish(){
  this.clearTimer(this.timer);this.timer=null;this.pending=false;this.intent=readinessIntent(this.buffer);
  const serial=this.serial;this.onStable(this.buffer,this.intent,serial);
  if(serial===this.serial&&this.intent==='ready'&&this.canTrigger())this.onReady(this.serial);
  for(const resolve of this.waiters)resolve();this.waiters=[];
 }
 async settled(){while(this.pending)await new Promise(resolve=>this.waiters.push(resolve));return this.intent;}
}
