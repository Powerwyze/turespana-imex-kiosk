import {homeText} from './home-language.js';
export function mountTouchControls({getState,start,voice,action,finish,labels,onReadiness=()=>{}}){
 const panel=document.getElementById('touchControls'),email=document.getElementById('emailOpen');
 let edit=null,last='';
 function render(){
  const s=getState(),busy=['preparing','countdown','generating'].includes(s.phase);
  onReadiness(s.phase==='listening'&&s.active&&!s.hasPhoto&&!edit&&!s.emailOpen);
  panel.hidden=s.emailOpen;
  document.querySelectorAll('.destination-pick').forEach(b=>{b.disabled=s.phase!=='choosing_destination'||s.emailOpen;b.removeAttribute('aria-pressed');});
  if(s.phase==='idle')edit=null;
  const signature=JSON.stringify([s,edit,document.documentElement.lang]);if(signature===last)return;last=signature;
  const title=document.createElement('h2');title.id='touchTitle';
  const hint=document.createElement('p');hint.className='touch-help';
  const row=document.createElement('div');row.className='touch-actions';
  const button=(label,id,fn,secondary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.touch=id;if(secondary)b.className='secondary';b.addEventListener('click',fn);row.append(b);return b;};
  const choose=(name,args)=>{edit=null;action(name,args);};
  if(s.phase==='idle'||(s.phase==='error'&&!s.active)){
   title.textContent=homeText('adventure');hint.textContent=s.phase==='error'?(s.statusMessage||'You can use the buttons or reconnect to your host.'):homeText('help');
   button(homeText('takePicture'),'start',start);button(homeText('talk'),'voice',voice,true);
  }else if(s.phase==='connecting'){
   title.textContent='Connecting to Lola…';button('Cancel','cancel',finish,true);
  }else if(busy){
   title.textContent=s.phase==='generating'?'Creating your photo…':s.phase==='countdown'?'Look at the camera!':'Getting the camera ready…';
   hint.textContent=s.phase==='generating'?'Please wait. You can still talk to Lola if connected.':'Your photo starts after the seven-second countdown.';
   button('Cancel','cancel',finish,true);
  }else if(s.phase==='result'){
   title.textContent=s.emailSent?'Your photo has been sent':'Your photo is ready';
   button('Start over','restart',start,true);button('Finish','finish',finish,true);
  }else if(s.phase==='error'){
   title.textContent='Let’s try again';hint.textContent=s.error||'Choose your next step.';
   if(s.hasPhoto)button('Try again','retry',()=>action('retry_picture',{confirmed:true,style:''}));
   button('Retake photo','retake',()=>action('take_photo',{confirmed:true,style:''}));
   button('Start over','restart',start,true);
  }else if(!s.hasPhoto){
   title.textContent='See yourself in Spain';hint.textContent='Look at the camera. Your photo starts after a seven-second countdown.';
   button('See yourself in Spain','capture',()=>action('take_photo',{confirmed:true,style:''}));
  }else if(!s.guestCount||edit==='people'){
   title.textContent='How many people?';hint.textContent=(labels[s.destinationId]?labels[s.destinationId]+' · ':'')+'How many people are in the picture?';
   for(const count of [1,2,3])button(count+' '+(count===1?'person':'people'),'people-'+count,()=>choose('set_guest_count',{count}));
   button('Retake photo','retake',()=>action('take_photo',{confirmed:true,style:''}),true);
  }else if(!s.destinationId||edit==='destination'){
   title.textContent='Which city would you like?';row.classList.add('destinations');
   for(const [id,label] of Object.entries(labels))button(label,'destination-'+id,()=>choose('set_destination',{destinationId:id}));
   button('Back','back',()=>{edit='people';render();},true);
  }else{
   title.textContent='Ready for your photo?';hint.textContent=s.guestCount+' '+(s.guestCount===1?'person':'people')+' · '+labels[s.destinationId]+' · Say yes, okay, or take the picture — or hold up a peace sign ✌ for a moment. Five-second countdown.';
   button('Take photo','capture',()=>action('take_photo',{confirmed:true,style:''}));
   button('Change place','place',()=>{edit='destination';render();},true);
   button('Change people','people',()=>{edit='people';render();},true);
  }
  // Keep the original email button and its confirmation-only handler alive.
  row.prepend(email);panel.replaceChildren(title,hint,row);
 }
 return {render};
}
