const embedded = __ASSET_MAP__;
const BACKEND='https://turespana-imex-kiosk.vercel.app';
const apiPaths=new Set(['/api/host-session','/api/host-photo','/api/host-email','/api/host-greeting','/api/banana','/api/send-photo','/api/lead']);
const aliases={'/':'/index.html','/host':'/host.html','/classic':'/classic.html'};
export default {async fetch(request){
 const url=new URL(request.url),path=aliases[url.pathname]||url.pathname;
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
  const body=isApi?(path==='/api/host-session'?await request.text():request.body):undefined;
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
