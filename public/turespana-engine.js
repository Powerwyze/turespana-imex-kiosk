import {BoothEngine} from './host-engine.js';
export const destinations=Object.freeze({"canarias":"Canarias","barcelona":"Barcelona","bilbao":"Bilbao","madrid":"Madrid","andalucia":"Andalucía","valencia":"Valencia"});
export class TurespanaEngine extends BoothEngine {
  constructor(options){super(options);this.destination=null;this.style='';}
  snapshot(){return {...super.snapshot(),destinationId:this.destination||null,destinationLabel:destinations[this.destination]||null};}
  reset(){this.destination=null;this.style='';return super.reset();}
  async execute(name,args={}){
    if(['preparing','countdown','generating'].includes(this.phase))return super.execute(name,args);
    if(name==='take_photo'){
      if(args.confirmed!==true)return {error:'Ask the visitor before starting the photo countdown.'};
      const version=++this.version;this.controller?.abort();this.controller=new AbortController();
      const signal=this.controller.signal;
      this.source=null;this.count=null;this.destination=null;this.image=null;this.attempts=0;this.error='';
      this.style=typeof args.style==='string'?args.style.trim().slice(0,600):'';
      this.change('preparing');
      this.job=(async()=>{
        try{
          await this.prepare(signal);if(version!==this.version)return;
          this.change('countdown');
          const source=await this.capture(signal);if(version!==this.version)return;
          this.source=source;this.change('choosing_people');
        }catch(error){if(version===this.version)this.change('error',{error:error.message||'The photo could not be captured.'});}
        finally{if(version===this.version)this.controller=null;}
      })();
      return {accepted:true,...this.snapshot(),message:'Five-second countdown started. After capture, ask how many people are in the photo.'};
    }
    if(name==='set_guest_count'){
      if(!this.source)return {error:'Take the photo first, then ask how many people are in it.'};
      if(!['choosing_people','choosing_destination','error'].includes(this.phase))return {error:'Start over before changing a finished photo.'};
      if(![1,2,3,4].includes(args.count))return {error:'Choose one, two, three, or four people.'};
      this.count=args.count;this.destination=null;this.change('choosing_destination');return this.snapshot();
    }
    if(name==='set_destination'){
      if(!this.source||!this.count)return {error:'Take the photo and record one, two, three, or four people before choosing a city.'};
      if(!['choosing_destination','error'].includes(this.phase))return {error:'Wait for the current photo or start over.'};
      if(!Object.hasOwn(destinations,args.destinationId))return {error:'Choose one of the six destinations shown on screen.'};
      this.destination=args.destinationId;
      return super.execute('retry_picture',{confirmed:true,style:this.style});
    }
    if(name==='retry_picture'&&(!this.destination||!this.count))return {error:'Choose the number of people and a city before generating.'};
    return super.execute(name,args);
  }
}
