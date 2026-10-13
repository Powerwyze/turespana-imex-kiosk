import {generationLine} from './generation-lines.js';
export class GenerationSpeech{
 constructor({getContext,fetchImpl=(...args)=>globalThis.fetch(...args),onText=()=>{},onBlocked=()=>{},synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance}){
  Object.assign(this,{getContext,fetchImpl,onText,onBlocked,synth,Utterance});this.cache=new Map();this.epoch=0;this.source=null;this.active=null;
 }
 unlock(){const context=this.getContext();return context?.resume().catch(()=>{});}
 prefetch(destination){
  if(!generationLine(destination))return Promise.resolve(null);
  if(!this.cache.has(destination)){
   const promise=this.fetchImpl('/api/host-narration?destinationId='+encodeURIComponent(destination))
    .then(response=>{if(!response.ok)throw Error('Voice unavailable');return response.arrayBuffer();})
    .catch(()=>{this.cache.delete(destination);return null;});
   this.cache.set(destination,promise);
  }
  return this.cache.get(destination);
 }
 async start(destination){
  this.stop();const epoch=this.epoch;this.active=destination;
  const line=generationLine(destination);if(!line)return;
  let timer;
  const bytes=await Promise.race([this.prefetch(destination),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1500);})]);
  clearTimeout(timer);
  if(epoch!==this.epoch)return;
  const context=this.getContext();
  if(context?.state!=='running'){this.onBlocked();return;}
  try{
   if(!bytes)throw Error('Voice unavailable');
   const buffer=await context.decodeAudioData(bytes.slice(0));
   if(epoch!==this.epoch)return;
   const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
   this.source=source;this.onText(line);source.start();
   source.onended=()=>{source.disconnect();if(this.source===source)this.source=null;};
  }catch{
   if(epoch!==this.epoch)return;
   if(this.synth&&this.Utterance){const utterance=new this.Utterance(line);utterance.lang='en-US';utterance.rate=1.05;this.onText(line);this.synth.speak(utterance);}
   else this.onBlocked();
  }
 }
 stop(){this.epoch++;this.active=null;if(this.source){try{this.source.stop();this.source.disconnect();}catch{}this.source=null;}this.synth?.cancel();}
}
