// Display only Sunny's outgoing speech, never microphone/email transcription.
export class HostCaptions {
  constructor(box,text,home,anchor){
    this.box=box;this.text=text;this.home=home;this.anchor=anchor;
    this.buffer='';this.lastDelta=0;this.fresh=true;
    this.resize=new ResizeObserver(()=>this.scrollToLatest());
    this.resize.observe(text);
  }
  clear(){
    this.buffer='';this.lastDelta=0;this.fresh=true;
    this.text.textContent='';this.box.hidden=true;
    document.body.dataset.hasCaptions='false';
  }
  nextTurn(){this.fresh=true;}
  append(delta){
    if(typeof delta!=='string'||!delta)return;
    const now=performance.now();
    if(this.fresh||now-this.lastDelta>4500)this.buffer='';
    this.fresh=false;this.lastDelta=now;
    this.buffer+=delta;
    // Keep a bounded window; the visible region scrolls to the latest spoken words.
    if(this.buffer.length>1200){
      const tail=this.buffer.slice(-1000),space=tail.indexOf(' ');
      this.buffer=space>=0?tail.slice(space+1):tail;
    }
    this.text.textContent=this.buffer.trim();
    this.box.hidden=!this.text.textContent;
    document.body.dataset.hasCaptions=String(!this.box.hidden);
    this.scrollToLatest();
  }
  placeIn(panel){
    const target=panel||this.home;
    if(this.box.parentElement!==target){
      if(panel)panel.prepend(this.box);
      else this.home.insertBefore(this.box,this.anchor.parentElement===this.home?this.anchor:null);
      this.scrollToLatest();
    }
  }
  scrollToLatest(){this.text.scrollTop=this.text.scrollHeight;}
}
