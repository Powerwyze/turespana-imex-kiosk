import {mountHomeLanguage,homeText} from './home-language.js';
import {brandPortrait} from './portrait-branding.js';
import {mountTouchControls} from './host-touch.js';
import {connectVoice} from './host-connection.js';
import {LiveTools} from './host-engine.js';
import {TurespanaEngine, destinations} from './turespana-engine.js';
import {PhotoEmail,validEmail} from './host-email.js';
import {CameraSentry} from './host-sentry.js';
import {runCountdown} from './host-countdown.js';
import {GuestIdle} from './host-idle.js';
import {HostCaptions} from './host-captions.js';
let avatar=null;
import('./host-avatar.js').then(m=>m.mountAvatar(document.getElementById('face'),document.getElementById('avatar'))).then(a=>avatar=a).catch(()=>{document.getElementById('face').dataset.avatar='fallback';});
const $=id=>document.getElementById(id);
const face=$('face'),camera=$('camera'),audio=$('voice'),picture=$('picture');
const captions=new HostCaptions($('hostCaptions'),$('hostCaptionText'),$('stage'),face);
let cameraPreparation=null,cameraEpoch=0,touchMode=false,touchUI=null;
const homeLanguage=mountHomeLanguage({onChange:()=>touchUI?.render()});
let peer,events,mic,cameraStream,context,analyser,sourceNode,ready=false,connecting=false,ending=false;
let sessionEpoch=0,startTimer,closeTimer,maxTimer,pictureUrl=null,requestController=null,level=0,lastPhase='',eventTimer,eventIndex=0,lastVoiceAt=0,guestInterrupted=false,sentryAudioContext=null,sentrySetup=0,sentryEnabling=false,rearmImmediately=false;
const wait=(ms,signal)=>new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Cancelled','AbortError'));
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
});
function text(title,hint=''){ $('headline').textContent=title;$('hint').textContent=hint; }
function phase(value){queueMicrotask(()=>touchUI?.render());if(document.body.dataset.phase!==value)captions.clear();document.body.dataset.phase=value;placeHomeLogo();homeLanguage.refresh();$('sentryToggle').disabled=!sentry.enabled&&!['idle','error'].includes(value);}
function placeHomeLogo(){
  const slot=$('homeLogoSlot');
  if(document.body.dataset.phase==='idle'){
    if(face.parentElement!==slot)slot.append(face);
  }else if(face.parentElement!==$('stage')){
    $('stage').insertBefore(face,$('message'));
  }
}
placeHomeLogo();
function send(event){if(!ready||events?.readyState!=='open'||(ending&&event.type!=='session.close'))return;events.send(JSON.stringify({event_id:crypto.randomUUID(),...event}));}
function note(content,speak=false){send({type:speak?'session.commentary.append':'session.thinking.append',delegation_id:null,content});}
const sentry=new CameraSentry({
  video:$('sentryCamera'),
  canGreet:()=>!touchMode&&!ready&&!connecting&&!ending&&!document.hidden,
  onVisitor:greeting=>begin({sentryGreeting:greeting}),
  onStatus:(status,message='')=>{
    $('sentryToggle').dataset.sentryStatus=status;homeLanguage.refresh();
    $('sentryToggle').setAttribute('aria-pressed',String(status!=='off'));
    $('sentryNotice').hidden=status==='off';
    $('sentryNotice').textContent=homeText(status==='starting'?'preparingSentry':'sentryNotice');
    if(!ready&&!connecting){
      if(status==='watching')text('Looking good starts here.',message||'Walk into view to meet your AI photo host.');
      else if(status==='greeting')text('Hello there.','Your host is getting ready to say hello.');
      else if(message)text('Tap the logo to begin.',message);
    }
  }
});
const guestIdle=new GuestIdle({onIdle:()=>end({idle:true})});
function stopSentry(){
  sentrySetup++;sentryEnabling=false;sentry.disable();sentryAudioContext?.close().catch(()=>{});sentryAudioContext=null;
}
$('sentryToggle').addEventListener('click',async()=>{
  if(sentry.enabled||sentryEnabling){stopSentry();if(ready||connecting)end();else text('Your Spanish story starts here.','Tap the logo to begin · AI photo host');return;}
  if(ready||connecting)return;
  const setup=++sentrySetup;sentryEnabling=true;
  $('sentryToggle').textContent='Stop sentry setup';
  try{
    // Unlock sound once during the operator gesture; guests need no tap.
    sentryAudioContext?.close().catch(()=>{});sentryAudioContext=new AudioContext();await sentryAudioContext.resume();
    const silent=sentryAudioContext.createMediaStreamDestination();audio.srcObject=silent.stream;
    await audio.play().catch(()=>{});silent.stream.getTracks().forEach(t=>t.stop());audio.srcObject=null;
    const permission=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    permission.getTracks().forEach(t=>t.stop());
    if(setup!==sentrySetup)return;
    await sentry.enable();
  }catch(error){
    if(setup===sentrySetup){stopSentry();$('sentryToggle').textContent=homeText('enableSentry');text('Camera sentry needs permission.',error.name==='NotAllowedError'?'Allow microphone and camera access, then enable sentry again.':'Tap Enable camera sentry to try again.');}
  }finally{if(setup===sentrySetup)sentryEnabling=false;}
});
function stopEventTalk(){clearInterval(eventTimer);eventTimer=null;}
function startEventTalk(){
  stopEventTalk();eventIndex=0;guestInterrupted=false;
  note('The photo is generating for '+destinations[engine.destination]+'. Share two concise sentences specifically about this destination from your verified facts. Invite a tourism question and listen; answer their follow-up questions while generation continues. Do not ask for email yet.',true);
  eventTimer=setInterval(()=>{
    if(!ready||engine.phase!=='generating'){stopEventTalk();return;}
    if(guestInterrupted||Date.now()-lastVoiceAt<18000||eventIndex>=2)return;
    const topic=['art and culture in '+destinations[engine.destination],'food or outdoor highlights in '+destinations[engine.destination]][eventIndex++];
    note('The image is still generating. Briefly talk about '+topic+' using only your supplied event facts. Do not invent destination facts. Leave room for questions. Do not repeat yourself or promise timing.',true);
  },30000);
}
const photoEmail=new PhotoEmail({
  deliver:async({email,image,signal})=>{
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Image could not be prepared.'));reader.readAsDataURL(image);
    });
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const response=await fetch('/api/host-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,imageBase64:base64,mimeType:image.type,destinationId:engine.destination,filename:'turespana-portrait.jpg'}),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok)throw new Error('Delivery was not confirmed.');
  },
  onChange:state=>{
    syncIdle();queueMicrotask(()=>touchUI?.render());
    const open=['review','sending','error'].includes(state.status);
    $('emailPanel').hidden=!open;document.body.dataset.emailOpen=String(open);
    captions.placeIn(open?$('emailPanel'):null);
    const sending=state.status==='sending';
    $('emailInput').disabled=sending;
    $('emailCancel').disabled=sending;
    document.querySelectorAll('#emailKeyboard button,#emailDomains button').forEach(b=>b.disabled=sending);
    $('emailConfirm').disabled=sending||!validEmail($('emailInput').value);
    $('emailConfirm').textContent=sending?'Sending your photo…':'Confirm & email photo';
    $('emailStatus').textContent=state.error||(sending?'Sending to the address you confirmed.':'');
    $('emailToast').hidden=state.status!=='sent';
    if(state.status==='sent')$('emailInput').value='';
    $('emailOpen').hidden=!open&&state.status!=='sent'?$('picture').hidden:true;
  }
});
function reviewEmail(value){
  const result=photoEmail.review(value);
  if(result.shown){$('emailInput').value=photoEmail.draft;$('emailConfirm').disabled=!validEmail(photoEmail.draft);$('emailInput').focus({preventScroll:true});}
  return result;
}
function clearEmail(){photoEmail.reset();$('emailInput').value='';$('emailOpen').hidden=true;$('emailToast').hidden=true;}
function hideCountdown(){$('countdown').hidden=true;$('viewfinder').hidden=true;}
function stopCamera(){cameraEpoch++;cameraPreparation=null;cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;camera.srcObject=null;hideCountdown();}
function hidePicture(){picture.hidden=true;picture.removeAttribute('src');if(pictureUrl)URL.revokeObjectURL(pictureUrl);pictureUrl=null;}
function touch(){guestIdle.touch();}
function syncIdle(){
  if((!ready&&!touchMode)||ending)return;
  guestIdle.setBusy(['preparing','countdown','generating'].includes(engine.phase)||photoEmail.status==='sending');
}
async function ensureCamera(signal){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(!cameraPreparation){
    const epoch=cameraEpoch;
    cameraPreparation=(async()=>{
      const next=sentry.enabled&&sentry.stream?.getVideoTracks().some(t=>t.readyState==='live')?sentry.stream.clone():await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1920},height:{ideal:1080}},audio:false});
      if(epoch!==cameraEpoch||signal.aborted){next.getTracks().forEach(t=>t.stop());throw new DOMException('Cancelled','AbortError');}
      cameraStream=next;camera.srcObject=next;await camera.play();
      for(let i=0;i<80&&(!camera.videoWidth||!camera.videoHeight||camera.readyState<2);i++){
        if(epoch!==cameraEpoch)throw new DOMException('Cancelled','AbortError');
        await wait(100,signal);
      }
      if(epoch!==cameraEpoch)throw new DOMException('Cancelled','AbortError');
      if(!camera.videoWidth||!camera.videoHeight||camera.readyState<2)throw new Error('The camera is not ready. Check its connection, then ask me to try again.');
    })().catch(error=>{
      if(epoch===cameraEpoch)stopCamera();
      if(error.name==='NotAllowedError')throw new Error('Please allow camera access in your browser, then ask me to take the photo again.');
      throw error;
    });
  }
  await cameraPreparation;
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(!cameraStream?.getVideoTracks().some(t=>t.readyState==='live')){
    stopCamera();throw new Error('The camera disconnected. Check its connection, then ask me to try again.');
  }
}
function beep(final=false){
  if(!context||context.state!=='running')return;
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.frequency.value=final?880:520;gain.gain.setValueAtTime(.045,context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);
  oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.13);
}
const engine=new TurespanaEngine({
  prepare:ensureCamera,
  capture:async(signal)=>{
    const captureEpoch=cameraEpoch;
    try{
      $('viewfinder').hidden=false;
      await runCountdown({signal,onTick:n=>{
        $('countdown').textContent=String(n);$('countdown').hidden=false;beep();
      }});
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      beep(true);
      const canvas=$('capture');canvas.width=camera.videoWidth;canvas.height=camera.videoHeight;
      canvas.getContext('2d').drawImage(camera,0,0);
      hideCountdown();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96));
      canvas.width=canvas.height=0;
      if(!blob)throw new Error('The camera could not capture that photo. Ask me to try again.');
      return blob;
    }catch(e){
      if(e.name==='NotAllowedError')throw new Error('Please allow camera access in your browser, then ask me to take the photo again.');
      throw e;
    }finally{if(captureEpoch===cameraEpoch)stopCamera();}
  },
  generate:async({source,count,style,signal})=>{
    const form=new FormData();form.append('image',source,'guest-photo.jpg');form.append('guestCount',String(count));form.append('style',style);form.append('destinationId',engine.destination);
    const res=await fetch(location.origin==='https://turespana-imex-kiosk.powerwyze-2010.chatgpt.site'?'https://turespana-imex-kiosk.vercel.app/api/host-photo':'/api/host-photo',{method:'POST',body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(185000)])});
    if(!res.ok){
      const problem=await res.json().catch(()=>({}));
      if(problem.code==='PORTRAIT_QUALITY_MISMATCH')throw new Error('That portrait did not meet the outfit, likeness or framing check. Your original photo is saved. Please retry or retake.');
      if(problem.code==='SUBJECT_COUNT_MISMATCH')throw new Error('That image did not match your group. Tell me the number of people and ask me to try again.');
      if(problem.code==='SUBJECT_CHECK_UNAVAILABLE')throw new Error('The image could not be checked. Your original photo is here if you want to retry.');
      throw new Error(res.status===429?'The image service is busy. Ask me to try again shortly.':'The picture could not be created. Ask me to try again.');
    }
    const blob=await res.blob();
    if(!blob.size||!blob.type.startsWith('image/'))throw new Error('No picture was returned. Ask me to try again.');
    // Decode before reporting success or revealing the image.
    return await brandPortrait(blob,destinations[engine.destination]);
  },
  onChange:(state,image)=>{
    syncIdle();
    if(state.phase!=='generating')stopEventTalk();
    photoEmail.setImage(state.phase==='result'?image:null);
    if(state.phase!=='result'){$('emailInput').value='';$('emailOpen').hidden=true;}
    hidePicture();
    phase(state.phase);
    if(state.phase==='result'&&image){pictureUrl=URL.createObjectURL(image);picture.src=pictureUrl;picture.hidden=false;$('emailOpen').hidden=photoEmail.status==='sent'||!$('emailPanel').hidden;}
    if(state.phase==='preparing')text('Getting the camera ready.','Your countdown starts as soon as the camera is ready.');
    else if(state.phase==='countdown')text('Look toward the camera.','Check your framing in the top-left preview.');
    else if(state.phase==='generating')text('A little Spanish magic.','Your host is still here. Feel free to talk.');
    else if(state.phase==='error')text('Let’s try that again.',state.error);
    else if(state.phase==='listening')text('I’m listening.',state.guestCount?state.guestCount+' '+(state.guestCount===1?'person':'people')+' · '+(state.destinationLabel||'Choose your destination')+' · Say when you’re ready.':'Tell me how many people are in your photo.');
    // Warm the camera while the host asks for readiness, keeping it out of view.
    if(ready&&state.phase==='listening'&&state.guestCount&&requestController)ensureCamera(requestController.signal).catch(()=>{});
    if(ready){
      note('Booth state: '+JSON.stringify(state));
      if(state.phase!==lastPhase){
        if(state.phase==='result')note('The generated photo has passed the guest check, decoded successfully, and is now displayed. Stop the event explanation. Tell the visitor the photo is ready, then ask them to spell their email aloud, including at and dot, if they would like it emailed. Wait for the spelling before showing the confirmation keyboard.',true);
        if(state.phase==='error')note('The photo workflow failed: '+state.error+' Do not retry unless the visitor asks.',true);
        if(state.phase==='countdown')send({type:'session.instructions.append',delegation_id:null,content:'The camera is ready and the visible five-second countdown has started now. Stay quiet until the app reports generating. Do not say or count any numbers; the app plays synchronized countdown sounds.'});
        if(state.phase==='generating')startEventTalk();
      }
    }
    lastPhase=state.phase;
  }
});
const toolLoop=new LiveTools({send,execute:async(name,args)=>{
  if(ending||!ready)return {error:'The conversation has ended.'};
  if(name==='reset_booth'&&args.confirmed===true){stopCamera();$('countdown').hidden=true;}
  if(name==='end_visit'){if(args.confirmed!==true)return {error:'End only after the visitor declines or asks to end.'};const epoch=sessionEpoch;setTimeout(()=>{if(epoch===sessionEpoch)end();},1200);return {accepted:true,message:'The visit is ending. No more booth actions are needed.'};}
  if(name==='get_booth_status')return {...engine.snapshot(),email:photoEmail.snapshot()};
  if(name==='show_email_confirmation')return reviewEmail(typeof args.email==='string'?args.email:'');
  if(photoEmail.status==='sending'&&['take_photo','retry_picture','set_destination','set_guest_count','reset_booth'].includes(name))return {error:'Wait for the current email delivery before changing the photo.'};
  if(name==='reset_booth'&&args.confirmed===true)clearEmail();
  return engine.execute(name,args);
}});
function cleanup(message='Tap the logo to begin · AI photo host'){
  touchMode=false;sessionEpoch++;ready=false;connecting=false;ending=false;captions.clear();
  guestIdle.stop();stopEventTalk();clearEmail();sentry.finish({immediate:rearmImmediately});rearmImmediately=false;
  requestController?.abort();requestController=null;
  clearTimeout(startTimer);clearTimeout(closeTimer);clearTimeout(maxTimer);
  const oldEvents=events;events=null;oldEvents?.close();
  const oldPeer=peer;peer=null;oldPeer?.close();
  mic?.getTracks().forEach(t=>t.stop());mic=null;stopCamera();
  audio.pause();audio.srcObject=null;sourceNode?.disconnect();sourceNode=null;analyser=null;
  if(context!==sentryAudioContext)context?.close().catch(()=>{});context=null;
  toolLoop.clear();engine.reset();hidePicture();$('countdown').hidden=true;
  $('end').hidden=true;$('audioResume').hidden=true;
  face.setAttribute('aria-label','Start talking to your AI photo host');
  phase('idle');text(sentry.enabled?'Looking good starts here.':'Your Spanish story starts here.',sentry.enabled?'Camera sentry is on · Walk into view to begin.':message);
}
function end({idle=false}={}){
  if(ending)return;
  ending=true;rearmImmediately=idle&&sentry.enabled;guestIdle.stop();captions.clear();
  engine.reset();stopCamera();$('countdown').hidden=true;
  if(ready&&events?.readyState==='open'){
    send({type:'session.close'});text('See you on your next adventure.','Ending the conversation…');
    closeTimer=setTimeout(()=>cleanup(),3000);
  }else cleanup();
}
async function ice(connection,signal){
  if(connection.iceGatheringState==='complete')return;
  for(let i=0;i<100;i++){await wait(100,signal);if(connection.iceGatheringState==='complete')return;}
  throw new Error('The voice connection could not reach the network. Tap the logo to retry.');
}
async function begin({sentryGreeting=null}={}){
  if(connecting||ready||ending)return;
  sentry.consume();
  connecting=true;const epoch=++sessionEpoch;captions.clear();
  phase('connecting');text('Hello, adventurer.',sentryGreeting?'Your AI photo host is joining you.':'Allow your microphone to meet your host.');
  try{
    context=sentryAudioContext||new AudioContext();await context.resume();
    requestController=new AbortController();
    const connection=new RTCPeerConnection();peer=connection;
    connection.addEventListener('track',event=>{
      if(epoch!==sessionEpoch)return;
      const output=new MediaStream([event.track]);audio.srcObject=output;
      sourceNode=context.createMediaStreamSource(output);analyser=context.createAnalyser();analyser.fftSize=256;sourceNode.connect(analyser);
      audio.play().catch(()=>{$('audioResume').hidden=false;});
    });
    const microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    if(epoch!==sessionEpoch){microphone.getTracks().forEach(t=>t.stop());return;}
    mic=microphone;
    mic.getAudioTracks().forEach(track=>connection.addTrack(track,mic));
    const channel=connection.createDataChannel('oai-events');events=channel;
    channel.addEventListener('message',({data})=>{
      if(epoch!==sessionEpoch)return;
      let event;try{event=JSON.parse(data);}catch{return;}
      if(event.type==='session.started'){
        ready=true;connecting=false;clearTimeout(startTimer);
        if(sentryGreeting&&(!sentry.enabled||!sentry.gate.isFresh(performance.now()))){send({type:'session.close'});cleanup();return;}
        guestInterrupted=false;
        $('end').hidden=false;face.setAttribute('aria-label','Your AI photo host is listening');
        phase('listening');text('I’m listening.',sentryGreeting?'Say hello, or ask for your photo.':'Tell me how many people are in your photo.');guestIdle.start(sentry.enabled?30000:150000);syncIdle();
        maxTimer=setTimeout(end,600000);
        const greeting=crypto.randomUUID();
        const listener=({data})=>{
          let ack;try{ack=JSON.parse(data);}catch{return;}
          if(ack.type==='session.instructions.appended'&&ack.client_event_id===greeting){
            channel.removeEventListener('message',listener);
            note(sentryGreeting?'A nearby visitor was detected by camera sentry. Deliver the frame-based welcome now, then listen. Do not take a photo yet.':'A new visitor has tapped the Spain logo and is ready to meet the AI photo host. Greet them now and ask how many people are posing.',true);
          }
        };
        channel.addEventListener('message',listener);
        send({type:'session.instructions.append',event_id:greeting,delegation_id:null,content:sentryGreeting?'Speak first in English. Use this greeting based on the latest camera frame: '+JSON.stringify(sentryGreeting)+' Then listen. If they want a photo, ask how many people are posing and get explicit readiness before capture. Do not claim to see a live video feed.':'Speak first in English: welcome the visitor, identify yourself as an AI photo host, and ask whether one, two, or three people are posing. Then listen.'});
        note('Initial booth state: '+JSON.stringify(engine.snapshot()));
      } else if(event.type==='session.closed'){cleanup();}
      else if(event.type==='session.input_transcript.delta'){if(typeof event.delta==='string'&&event.delta.trim()){touch();guestInterrupted=true;lastVoiceAt=Date.now();captions.nextTurn();}}
      else if(event.type==='session.output_transcript.delta'){
        lastVoiceAt=Date.now();
        if(ready&&!ending&&!['idle','connecting','countdown'].includes(document.body.dataset.phase))captions.append(event.delta);
      }
      else if(event.type==='error'){
        text('Your host needs a moment.','The connection had a problem. End and tap the logo to reconnect.');
      } else {
        toolLoop.receive(event).catch(()=>text('Let’s try that again.','Please repeat your request.'));
      }
    });
    channel.addEventListener('close',()=>{if(epoch===sessionEpoch&&!ending)cleanup('Connection ended. Tap the logo to reconnect.');});
    connection.addEventListener('connectionstatechange',()=>{
      if(epoch===sessionEpoch&&connection.connectionState==='failed')cleanup('Connection lost. Tap the logo to reconnect.');
    });
    await connection.setLocalDescription(await connection.createOffer());await ice(connection,requestController.signal);
    const result=await connectVoice(connection.localDescription.sdp,{signal:AbortSignal.any([requestController.signal,AbortSignal.timeout(30000)])});
    if(epoch!==sessionEpoch)return;
    await connection.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
    if(!ready)startTimer=setTimeout(()=>{if(epoch===sessionEpoch&&!ready)cleanup('The host did not connect. Tap the logo to retry.');},20000);
  }catch(error){
    if(epoch!==sessionEpoch)return;
    const message=error.name==='NotAllowedError'?'Please allow microphone access, then tap the logo again.':error.message;
    if(error.code==='VOICE_BILLING_REQUIRED')stopSentry();
    cleanup(message);phase('error');text(error.code==='VOICE_BILLING_REQUIRED'?'Your host is unavailable.':'Let’s get connected.',message);
  }
}
face.addEventListener('click',()=>{if(!ready)begin();else if(audio.paused)audio.play().catch(()=>{$('audioResume').hidden=false;});});
$('end').addEventListener('click',end);
$('audioResume').addEventListener('click',()=>{audio.play().then(()=>{$('audioResume').hidden=true;}).catch(()=>{});});
$('emailOpen').addEventListener('click',()=>{
  touch();
  note('The visitor tapped Email my photo. Ask them to spell their email aloud, including at and dot. The keyboard is available if they prefer to type.',true);
  // Touch is a deliberate manual-entry fallback; normal voice flow opens after spelling.
  reviewEmail('');
});
$('emailCancel').addEventListener('click',()=>{photoEmail.cancel();$('emailInput').value='';$('emailOpen').hidden=false;note('The visitor skipped email. Do not ask for their email again unless they request it.');$('emailOpen').focus();});
$('emailInput').addEventListener('input',()=>{photoEmail.edit($('emailInput').value);touch();});
$('emailPanel').addEventListener('pointerdown',touch);
$('emailPanel').addEventListener('keydown',touch);
$('emailConfirm').addEventListener('click',async()=>{
  touch();photoEmail.edit($('emailInput').value);
  const sent=await photoEmail.confirm();
  if(sent&&ready){note('Email service accepted the photo for delivery to the address the guest confirmed on screen. Thank them; suggest checking inbox or spam. Do not promise arrival.',true);face.focus();}
});
for(const row of ['1234567890','qwertyuiop','asdfghjkl','zxcvbnm','@._-+']){
  const element=document.createElement('div');element.className='key-row';
  const keys=[...row];if(row==='@._-+')keys.push('left','right','backspace');
  for(const key of keys){
    const button=document.createElement('button');button.type='button';button.dataset.key=key;
    button.textContent=({left:'←',right:'→',backspace:'⌫'})[key]||key;
    button.setAttribute('aria-label',({left:'Move cursor left',right:'Move cursor right',backspace:'Delete previous character'})[key]||('Type '+key));
    button.addEventListener('pointerdown',e=>e.preventDefault());
    button.addEventListener('click',()=>{
      const input=$('emailInput');if(input.disabled)return;
      let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
      if(key==='left'||key==='right'){const next=Math.max(0,Math.min(input.value.length,start+(key==='left'?-1:1)));input.setSelectionRange(next,next);}
      else {
        if(key==='backspace'&&start===end)start=Math.max(0,start-1);
        const replacement=key==='backspace'?'':key;
        input.setRangeText(replacement,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      input.focus({preventScroll:true});touch();
    });
    element.append(button);
  }
  $('emailKeyboard').append(element);
}
window.BarceloEmailShortcuts.mount($('emailDomains'),$('emailInput'),$('emailStatus'));
document.addEventListener('pointerdown',touch);
document.addEventListener('keydown',touch);
document.addEventListener('keydown',e=>{
  if(!$('emailPanel').hidden){
    if(e.key==='Escape'){e.preventDefault();if(photoEmail.status!=='sending')$('emailCancel').click();}
    if(e.key==='Tab'){
      const enabled=[...$('emailPanel').querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      const first=enabled[0],last=enabled.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  }else if(e.key==='Escape')end();
});
window.addEventListener('pagehide',()=>{stopSentry();send({type:'session.close'});cleanup();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSentry();end();}});
function startTouchPhoto(){
 stopSentry();send({type:'session.close'});cleanup();touchMode=true;
 phase('listening');text('Choose your group size.','Use the large buttons below.');guestIdle.start(150000);syncIdle();
}
async function touchAction(name,args){
 if(photoEmail.status==='sending'||['preparing','countdown','generating'].includes(engine.phase))return;
 touch();const result=await engine.execute(name,args);
 if(result.error&&!result.accepted)text('Check your selection.',result.error);
 if(ready)note('The visitor explicitly tapped a booth button: '+name+'. Current state: '+JSON.stringify(engine.snapshot())+'. Do not repeat the same action.');
 touchUI?.render();
}
touchUI=mountTouchControls({getState:()=>({...engine.snapshot(),phase:document.body.dataset.phase,active:ready||touchMode,statusMessage:$('hint').textContent,emailOpen:!$('emailPanel').hidden,emailSent:photoEmail.status==='sent'}),start:startTouchPhoto,voice:()=>begin(),action:touchAction,finish:()=>end(),labels:destinations});
for(const button of document.querySelectorAll('.destination-pick'))button.addEventListener('click',()=>{
 if(!ready&&!touchMode)startTouchPhoto();
 touchAction('set_destination',{destinationId:button.dataset.destination});
});
touchUI.render();

const samples=new Uint8Array(256),frequencies=new Uint8Array(128);
function animate(t){
  // Keep rendering time available for the live viewfinder and precise capture.
  if(engine.phase==='countdown'){requestAnimationFrame(animate);return;}
  let amplitude=0;
  if(analyser&&!audio.paused){
    analyser.getByteTimeDomainData(samples);
    amplitude=Math.sqrt(samples.reduce((sum,v)=>sum+Math.pow((v-128)/128,2),0)/samples.length);
  }
  level=level*.55+Math.min(1,amplitude*8)*.45;
  let brightness=0;
  if(analyser&&level>.025){analyser.getByteFrequencyData(frequencies);const total=frequencies.reduce((a,b)=>a+b,0)||1;brightness=frequencies.slice(8,45).reduce((a,b)=>a+b,0)/total;}
  avatar?.update({time:t,level:level<.025?0:level,brightness});
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
