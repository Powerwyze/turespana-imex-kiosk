import {BoothEngine} from './host-engine.js';
export const destinations=Object.freeze({andalucia:'Andalucía',madrid:'Madrid',cataluna:'Cataluña','pais-vasco':'País Vasco',galicia:'Galicia',valencia:'Valencia'});
export class TurespanaEngine extends BoothEngine {
  constructor(options){super(options);this.destination=null;}
  snapshot(){return {...super.snapshot(),destinationId:this.destination||null,destinationLabel:destinations[this.destination]||null};}
  reset(){this.destination=null;return super.reset();}
  async execute(name,args={}){
    if(name==='set_destination'){
      if(['preparing','countdown','generating'].includes(this.phase))return {error:'Wait for the current photo before changing destination.'};
      if(!Object.hasOwn(destinations,args.destinationId))return {error:'Ask the visitor to choose one of the six Spanish destinations.'};
      if(this.phase==='result')return {error:'Ask to start over before changing the destination of a finished photo.'};
      this.destination=args.destinationId;this.onChange(this.snapshot(),this.image);return this.snapshot();
    }
    if(['take_photo','retry_picture'].includes(name)&&!this.destination)return {error:'First ask which Spanish destination the visitor wants, then record it.'};
    return super.execute(name,args);
  }
}
