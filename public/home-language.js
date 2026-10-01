const copy={
 en:{title:'Discover Spain',tourism:'SPAIN TOURISM BOARD · IMEX LAS VEGAS',choose:'CHOOSE YOUR SPANISH ADVENTURE',note:'Example portraits · Your photo will be unique',transform:'Tap to Transform',talk:'Talk to Lola',adventure:'Your Spanish adventure',help:'Choose a destination or speak with Lola.',enableSentry:'Enable camera sentry',stopSetup:'Stop sentry setup',stopSentry:'Stop camera sentry',preparingSentry:'Preparing camera sentry…',sentryNotice:'Camera sentry on · A snapshot is used for your greeting',stage:'Turespaña voice photo experience',gallery:'Destination example portraits',face:'Tap the Spain logo to start talking to your AI photo host'},
 es:{title:'Descubre España',tourism:'TURISMO DE ESPAÑA · IMEX LAS VEGAS',choose:'ELIGE TU AVENTURA EN ESPAÑA',note:'Retratos de ejemplo · Tu foto será única',transform:'Toca para transformar',talk:'Habla con Lola',adventure:'Tu aventura en España',help:'Elige un destino o habla con Lola.',enableSentry:'Activar cámara',stopSetup:'Cancelar activación',stopSentry:'Desactivar cámara',preparingSentry:'Preparando la cámara…',sentryNotice:'Cámara activada · Se utiliza una foto para saludarte',stage:'Experiencia fotográfica por voz de Turespaña',gallery:'Retratos de ejemplo por destino',face:'Toca el logotipo de España para hablar con tu anfitriona virtual'}
};
const storageKey='turespana-home-language';let language='en';
try{if(localStorage.getItem(storageKey)==='es')language='es';}catch{}
export function homeText(key){return copy[document.body.dataset.phase==='idle'?language:'en'][key];}
export function mountHomeLanguage({onChange=()=>{}}={}){
 const toggle=document.getElementById('homeLanguageToggle');
 function refresh(){
  const home=document.body.dataset.phase==='idle',spanish=language==='es';
  document.documentElement.lang=home?language:'en';toggle.hidden=!home;
  toggle.querySelector('span').textContent=spanish?'English':'Español';toggle.lang=spanish?'en':'es';
  toggle.setAttribute('aria-label',spanish?'Switch the home screen to English':'Cambiar la pantalla de inicio a español');
  document.querySelectorAll('[data-home-text]').forEach(el=>el.textContent=homeText(el.dataset.homeText));
  document.getElementById('stage').setAttribute('aria-label',homeText('stage'));
  document.getElementById('destinationExamples').setAttribute('aria-label',homeText('gallery'));
  document.querySelectorAll('.destination-pick').forEach(card=>{
   const name=card.querySelector('.region-card-name').textContent;
   card.setAttribute('aria-label',home&&spanish?'Crear mi foto en '+name:'Start '+name+' photo transformation');
   card.querySelector('img').alt=home&&spanish?name+': ejemplo de vestimenta regional y lugares emblemáticos':name+' example: couple in regional clothing with local landmarks';
  });
  if(home)document.getElementById('face').setAttribute('aria-label',homeText('face'));
  const sentry=document.getElementById('sentryToggle'),status=sentry.dataset.sentryStatus||'off';
  sentry.textContent=homeText(status==='off'?'enableSentry':status==='starting'?'stopSetup':'stopSentry');
  document.getElementById('sentryNotice').textContent=homeText(status==='starting'?'preparingSentry':'sentryNotice');
 }
 toggle.addEventListener('click',()=>{
  language=language==='en'?'es':'en';try{localStorage.setItem(storageKey,language);}catch{}
  refresh();onChange();
 });
 refresh();return {refresh};
}
