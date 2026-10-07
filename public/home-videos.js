// Decorative, silent image-generation playlist. Only the active and next clip are loaded.
export function mountHomeVideos(){
 const backdrop=document.getElementById('homeVideos'),videos=[...backdrop.querySelectorAll('video')],button=document.getElementById('homeVideoToggle');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let enabled=!reduced.matches&&!navigator.connection?.saveData,clips=[],active=0,index=0,started=false,loading=false,failures=0,epoch=0;
 const home=()=>document.body.dataset.phase==='generating';
 const mayPlay=()=>enabled&&home()&&!document.hidden&&clips.length>0;
 function label(){
  const es=document.documentElement.lang==='es',text=enabled?(es?'Pausar vídeos de fondo':'Pause background videos'):(es?'Reproducir vídeos de fondo':'Play background videos');
  button.hidden=!home()||!clips.length;button.title=text;button.setAttribute('aria-label',text);
  button.firstElementChild.textContent=enabled?'Ⅱ':'▶';
 }
 function prepare(video,clipIndex){
  const src=clips[clipIndex].src;
  if(video.getAttribute('src')!==src){video.src=src;video.preload='auto';video.load();}
  video.muted=true;video.defaultMuted=true;
 }
 function preloadNext(){
  if(mayPlay()&&clips.length>1)prepare(videos[1-active],(index+1)%clips.length);
 }
 async function play(next=false){
  if(!mayPlay()||loading)return;
  const token=++epoch;loading=true;
  const target=next?1-active:active,targetIndex=next?(index+1)%clips.length:index,v=videos[target];
  prepare(v,targetIndex);
  try{
   await v.play();
   if(token!==epoch){if(!mayPlay())v.pause();return;}
   if(!mayPlay()){v.pause();return;}
   if(next){videos[active].classList.remove('visible');videos[active].pause();active=target;index=targetIndex;}
   started=true;failures=0;v.classList.add('visible');backdrop.dataset.ready='true';
   preloadNext();
  }catch(error){
   if(token!==epoch||!mayPlay())return;
   // Autoplay rejection is recoverable with the visible play control.
   if(error.name==='NotAllowedError'){enabled=false;label();}
   else{loading=false;skip();}
  }finally{if(token===epoch)loading=false;}
 }
 function skip(){
  if(!mayPlay())return;
  if(++failures>=clips.length){enabled=false;backdrop.dataset.ready='false';videos.forEach(v=>v.pause());label();return;}
  index=(index+1)%clips.length;started=false;void play();
 }
 function sync(){
  label();
  if(!mayPlay()){epoch++;loading=false;videos.forEach(v=>v.pause());return;}
  void play(started&&videos[active].ended);
 }
 videos.forEach((video,i)=>{
  video.addEventListener('ended',()=>{if(i===active&&mayPlay())void play(true);});
  video.addEventListener('error',()=>{if(i===active&&!loading&&mayPlay())skip();});
 });
 button.addEventListener('click',()=>{enabled=!enabled;failures=0;sync();});
 reduced.addEventListener('change',()=>{enabled=!reduced.matches&&!navigator.connection?.saveData;sync();});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{epoch++;loading=false;videos.forEach(v=>v.pause());});
 window.addEventListener('pageshow',sync);
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-phase']});
 new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 fetch('/assets/spain-videos/manifest.json').then(r=>{if(!r.ok)throw Error('Video playlist unavailable');return r.json();}).then(data=>{
  clips=data.clips.filter(c=>/^\/assets\/spain-videos\/spain-\d{2}\.mp4$/.test(c.src));sync();
 }).catch(()=>{button.hidden=true;});
 return {refresh:sync};
}
