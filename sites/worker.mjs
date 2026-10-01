const embedded = __ASSET_MAP__;
__CONTACT_POLICY__
const BACKEND='https://turespana-imex-kiosk.vercel.app';
const apiPaths=new Set(['/api/host-session','/api/host-photo','/api/host-email','/api/host-greeting','/api/banana','/api/send-photo','/api/lead']);
const aliases={'/':'/index.html','/host':'/host.html','/classic':'/classic.html'};
export default {async fetch(request,env={}){
 const url=new URL(request.url),path=aliases[url.pathname]||url.pathname;
 if(path==='/api/kiosk-contact')return saveKioskContact(request,env,url);
 const asset=embedded[path];
 if(asset){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 }
 const isApi=apiPaths.has(path);
 const isStatic=path.startsWith('/vendor/')||path.startsWith('/assets/');
 if(!isApi&&!isStatic)return new Response('Not found',{status:404});
 if(isStatic&&!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(isApi){
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  if(request.headers.get('origin')!==url.origin)return new Response('Please open the kiosk on this site.',{status:403});
 }
 // Forward only protocol headers. Never send Sites authentication cookies or tokens.
 const headers=new Headers();
 for(const name of ['content-type','accept','range','if-none-match','idempotency-key']){const value=request.headers.get(name);if(value)headers.set(name,value);}
 if(isApi)headers.set('Origin',BACKEND);
 const target=new URL(BACKEND);target.pathname=path;target.search=url.search;
 try{
  // The small voice handshake must have a complete, replay-free body rather than a streaming upload.
  let body=isApi?(path==='/api/host-session'?await request.text():request.body):undefined;
  if(isApi&&['/api/host-email','/api/send-photo'].includes(path)){
   if(Number(request.headers.get('content-length')||0)>12000000)return Response.json({error:'Photo is too large'},{status:413});
   body=await request.text();
   if(body.length>12000000)return Response.json({error:'Photo is too large'},{status:413});
   let details;try{details=JSON.parse(body);}catch{return Response.json({error:'Invalid contact details'},{status:400});}
   if(typeof details.imageBase64!=='string')return Response.json({error:'Photo required'},{status:400});
   let bytes;try{bytes=Uint8Array.from(atob(details.imageBase64.replace(/^data:[^;]+;base64,/,'')),c=>c.charCodeAt(0));}catch{return Response.json({error:'Invalid photo'},{status:400});}
   if(!bytes.length||bytes.length>8*1024*1024)return Response.json({error:'Invalid photo size'},{status:400});
   const portraitHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   const saved=await saveKioskContact(new Request(url.origin+'/api/kiosk-contact',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({name:details.name,email:details.email,destinationId:details.destinationId,marketingOptIn:details.marketingOptIn,consentVersion:details.consentVersion,portraitHash})}),env,url);
   if(!saved.ok)return saved;
  }
  if(path==='/api/host-session'&&body.length>65536)return Response.json({error:'Connection request is too large.'},{status:413});
  const upstream=await fetch(target,{method:request.method,headers,body,redirect:'manual',duplex:'half'});
  // Re-encode JSON with fresh headers: never forward an upstream gateway page or stale encoding/length.
  if(isApi&&(path==='/api/host-session'||!upstream.ok)){
   const payload=await upstream.json().catch(()=>null);
   if(payload&&typeof payload==='object')return Response.json(payload,{status:upstream.status,headers:{'Cache-Control':'no-store'}});
   return Response.json({error:path==='/api/host-session'?'The voice host is temporarily unavailable. Tap the logo to try again.':'The photo service is temporarily unavailable. Please try again.'},{status:upstream.ok?502:upstream.status,headers:{'Cache-Control':'no-store'}});
  }
  const result=new Headers(upstream.headers);result.delete('set-cookie');result.delete('access-control-allow-origin');
  if(isApi)result.set('Cache-Control','no-store');
  return new Response(upstream.body,{status:upstream.status,headers:result});
 }catch{return Response.json({error:'The photo service is temporarily unavailable. Please try again.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}};

async function saveKioskContact(request,env,url){
 const headers={'Cache-Control':'no-store'};
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(![url.origin,BACKEND].includes(request.headers.get('origin')))return reply({error:'Please use the kiosk.'},403);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return reply({error:'JSON required'},415);
 if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'Request too large'},413);
 // Bound the stream as well as the header. No images or arbitrary metadata belong in this table.
 let raw='',size=0;
 const reader=request.body?.getReader(),decoder=new TextDecoder();
 if(!reader)return reply({error:'Contact details required'},400);
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply({error:'Request too large'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch{return reply({error:'Invalid request'},400);}
 let b;try{b=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 if(!b||!validName(b.name)||typeof b.email!=='string'||b.email.length>254||!/^\S+@[^\s@]+\.[a-zA-Z]{2,}$/.test(b.email)||/[<>\r\n]/.test(b.email))return reply({error:'Enter your name and a valid email.'},400);
 if(b.marketingOptIn!==undefined&&typeof b.marketingOptIn!=='boolean')return reply({error:'Invalid marketing choice'},400);
 const optIn=b.marketingOptIn===true;
 if(optIn&&b.consentVersion!==CONSENT_VERSION)return reply({error:'Review the current marketing wording'},400);
 if(!['canarias','barcelona','bilbao','madrid','andalucia','valencia'].includes(b.destinationId)||!/^[a-f0-9]{64}$/.test(b.portraitHash))return reply({error:'Invalid photo reference'},400);
 if(!env.DB)return reply({stored:false,error:'Contact storage unavailable'},503);
 const name=normalizeName(b.name),email=b.email.trim();
 const canonical=JSON.stringify([name,email,b.destinationId,optIn,CONSENT_VERSION,b.portraitHash]);
 const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical))),v=>v.toString(16).padStart(2,'0')).join('');
 const now=new Date().toISOString();
 try{
  const result=await env.DB.prepare('INSERT OR IGNORE INTO kiosk_contacts (id,name,email,destination_id,marketing_opt_in,consent_at,consent_version,consent_text,terms_url,privacy_url,created_at,client,event,source,portrait_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(id,name,email,b.destinationId,optIn?1:0,optIn?now:null,CONSENT_VERSION,CONSENT_TEXT,TERMS_URL,PRIVACY_URL,now,'Turespaña','IMEX Las Vegas 2026','turespana-imex-kiosk',b.portraitHash).run();
  if(result.success===false)throw new Error('Write rejected');
  const saved=await env.DB.prepare('SELECT id FROM kiosk_contacts WHERE id = ?').bind(id).first();
  if(!saved)throw new Error('Write not confirmed');
  return reply({ok:true,stored:true,id,marketingOptIn:optIn});
 }catch{return reply({stored:false,error:'Your details could not be saved. Please try again.'},503);}
}
