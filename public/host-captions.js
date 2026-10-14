// Lola's captions stay in one reserved footer throughout the photo experience.
const placeholders={
  idle:'Ready for your Spain photo? Tap the camera button to begin.',
  connecting:'Connecting to Lola… You can also use the camera button.',
  listening:'Lola is listening. Say ready or tap the camera button.',
  preparing:'Getting the camera ready. Your countdown will start shortly.',
  countdown:'Look toward the camera. Your countdown is on screen.',
  choosing_people:'Your photo is captured. Choose how many people are in it.',
  choosing_destination:'Where would you like to go? Choose a city above.',
  generating:'Creating your Spain photo. Enter your name and email above.',
  result:'Your Spain photo is ready. Follow the options above.',
  error:'Please follow the options above to continue your photo.'
};

export function captionPages(value,width,measure){
  const valueText=String(value).trim().replace(/\s+/g,' '),lines=[];
  let line='',start=0,end=0;
  const flush=()=>{if(line)lines.push({text:line,start,end});line='';};
  for(const match of valueText.matchAll(/\S+/g)){
    let word=match[0],offset=match.index;
    if(line&&measure(line+' '+word)>width)flush();
    // Avoid overflow even for a single unusually long word.
    while(measure(word)>width&&word.length>1){
      let length=1;
      while(length<word.length&&measure(word.slice(0,length+1))<=width)length++;
      lines.push({text:word.slice(0,length),start:offset,end:offset+length});
      word=word.slice(length);offset+=length;
    }
    if(!line)start=offset;
    line+=(line?' ':'')+word;end=offset+word.length;
  }
  flush();
  const pages=[];
  for(let i=0;i<lines.length;i+=2){const pair=lines.slice(i,i+2);pages.push({text:pair.map(line=>line.text).join('\n'),start:pair[0].start,end:pair.at(-1).end});}
  return pages;
}

export class HostCaptions {
  constructor(box,text,home){
    this.box=box;this.text=text;this.home=home;this.phase=document.body.dataset.phase||'idle';
    this.buffer='';this.lastDelta=0;this.fresh=true;this.timers=[];this.timed=null;
    this.measureContext=document.createElement('canvas').getContext('2d');
    this.resize=new ResizeObserver(()=>this.render());this.resize.observe(box);
    this.clear();
  }
  pages(value){
    const style=getComputedStyle(this.text);
    this.measureContext.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return captionPages(value,Math.max(1,this.text.clientWidth-2),value=>this.measureContext.measureText(value).width);
  }
  clearTimers(){for(const timer of this.timers)clearTimeout(timer);this.timers=[];}
  stopTimed(){this.clearTimers();this.timed=null;}
  clear(){
    this.stopTimed();this.buffer='';this.lastDelta=0;this.fresh=true;
    this.box.hidden=false;document.body.dataset.hasCaptions='false';this.render();
  }
  setPhase(value){if(this.phase!==value){this.phase=value;this.clear();}}
  nextTurn(){this.fresh=true;}
  append(delta){
    if(typeof delta!=='string'||!delta)return;
    this.stopTimed();const now=performance.now();
    if(this.fresh||now-this.lastDelta>4500)this.buffer='';
    this.fresh=false;this.lastDelta=now;this.buffer+=delta;
    if(this.buffer.length>1200){const tail=this.buffer.slice(-1000),space=tail.indexOf(' ');this.buffer=space>=0?tail.slice(space+1):tail;}
    document.body.dataset.hasCaptions='true';this.render();
  }
  startTimed(value,durationSeconds){
    this.stopTimed();this.buffer=String(value).trim().replace(/\s+/g,' ');this.fresh=true;
    this.timed={character:0};document.body.dataset.hasCaptions='true';this.render();
    // Decoded audio duration gives paced pages without another API request.
    for(const page of this.pages(this.buffer).slice(1)){
      this.timers.push(setTimeout(()=>{if(this.timed){this.timed.character=page.start;this.render();}},Math.max(0,durationSeconds)*1000*page.start/this.buffer.length));
    }
  }
  boundary(character){
    if(!this.timed)return;
    this.clearTimers();this.timed.character=Math.max(0,character);this.render();
  }
  render(){
    const pages=this.pages(this.buffer||placeholders[this.phase]||placeholders.idle);
    let page=pages.at(-1);
    if(this.timed)page=pages.find((page,index)=>this.timed.character<(pages[index+1]?.start??Infinity));
    this.text.textContent=page?.text||'';this.text.scrollTop=0;this.box.hidden=false;
  }
  // Kept for callers from the contact flow; captions never move into its dialog.
  placeIn(){if(this.box.parentElement!==this.home)this.home.append(this.box);}
}
