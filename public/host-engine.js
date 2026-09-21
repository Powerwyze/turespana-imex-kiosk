export class BoothEngine {
  constructor({prepare=async()=>{},capture,generate,onChange=()=>{}}) {
    this.prepare=prepare;this.capture=capture;this.generate=generate;this.onChange=onChange;
    this.version=0;this.source=null;this.controller=null;this.count=null;this.attempts=0;
    this.phase='listening';this.error='';this.image=null;
  }
  snapshot(){return {phase:this.phase,guestCount:this.count,hasPhoto:!!this.source,hasResult:!!this.image,attempts:this.attempts,error:this.error};}
  change(phase,extra={}){this.phase=phase;Object.assign(this,extra);this.onChange(this.snapshot(),this.image);}
  reset(){this.version++;this.controller?.abort();this.controller=null;this.source=null;this.count=null;this.attempts=0;this.image=null;this.error='';this.change('listening');return this.snapshot();}
  async execute(name,args={}) {
    if (name==='get_booth_status') return this.snapshot();
    if (name==='reset_booth') {if(args.confirmed!==true)return {error:'Ask the visitor before clearing their picture.'};return this.reset();}
    if (['preparing','countdown','generating'].includes(this.phase)) return {...this.snapshot(),error:'A photo is already in progress. Do not start another.'};
    if (name==='set_guest_count') {
      if (![1,2,3].includes(args.count)) return {error:'Ask for exactly one, two, or three foreground guests.'};
      this.count=args.count;this.onChange(this.snapshot(),this.image);return this.snapshot();
    }
    if (name!=='take_photo' && name!=='retry_picture')return {error:'Unknown booth action.'};
    if(args.confirmed!==true)return {error:'Ask whether the visitor is ready before taking or regenerating a photo.'};
    if (!this.count) return {error:'First ask how many people are posing, then record their answer.'};
    if(this.attempts>=4)return {error:'Four attempts have been used. Ask to start over before another photo.'};
    if(name==='retry_picture' && !this.source)return {error:'No source photo is available. Ask the visitor to take a photo.'};
    const version=++this.version;
    this.controller=new AbortController();
    const signal=this.controller.signal;
    const style=typeof args.style==='string'?args.style.trim().slice(0,600):'';
    this.error='';this.image=null;
    this.change(name==='take_photo'?'preparing':'generating');
    this.job=(async()=>{
      try {
        if(name==='take_photo'){
          await this.prepare(signal);
          if(version!==this.version)return;
          this.change('countdown');
          const source=await this.capture(signal);
          if(version!==this.version)return;
          this.source=source;
        }
        this.attempts++;
        this.change('generating');
        const image=await this.generate({source:this.source,count:this.count,style,signal});
        if(version!==this.version)return;
        this.image=image;this.change('result');
      } catch(error) {
        if(version!==this.version)return;
        this.change('error',{error:error.name==='AbortError'?'That picture took too long. Ask me to try again.':error.message || 'The picture could not be created.'});
      } finally {if(version===this.version)this.controller=null;}
    })();
    return {accepted:true,...this.snapshot(),message:'Work started. Wait for the application completion event before announcing a result.'};
  }
}

// Preserve each nested response's call list even when its terminal output is empty.
export class LiveTools {
  constructor({send,execute}){this.send=send;this.execute=execute;this.responses=new Map();this.current=new Map();this.calls=new Map();}
  clear(){this.responses.clear();this.current.clear();this.calls.clear();}
  async receive(envelope){
    if(envelope.type!=='response.event')return;
    const e=envelope.event;
    if(!e)return;
    const delegation=envelope.delegation_id;
    if(e.type==='response.created'){
      this.current.set(delegation,e.response.id);
      this.responses.set(e.response.id,{calls:[],continued:false});
      return;
    }
    const id=e.response_id || e.response?.id || this.current.get(delegation);
    const record=this.responses.get(id);
    if(!record)return;
    if(e.type==='response.output_item.done' && e.item?.type==='function_call'){
      const item=e.item;
      if(!this.calls.has(item.call_id)){
        // Start execution once; the response's terminal event controls continuation.
        const promise=Promise.resolve().then(()=>{
          let args;try{args=JSON.parse(item.arguments);}catch{return {error:'Invalid tool arguments.'};}
          return this.execute(item.name,args);
        }).catch(()=>({error:'The booth action failed. Check status before retrying.'}));
        this.calls.set(item.call_id,promise);
      }
      if(!record.calls.includes(item.call_id))record.calls.push(item.call_id);
    }
    if(e.type==='response.completed' && record.calls.length && !record.continued){
      record.continued=true;
      const results=await Promise.all(record.calls.map(async call_id=>({call_id,output:await this.calls.get(call_id)})));
      if(!this.responses.has(id))return; // Session was closed while a tool was pending.
      for(const r of results)this.send({type:'response.item.create',item:{type:'function_call_output',call_id:r.call_id,output:JSON.stringify(r.output)}});
      this.send({type:'response.create'});
      this.responses.delete(id);
    }
    if(['response.failed','response.incomplete','response.cancelled'].includes(e.type))this.responses.delete(id);
  }
}
