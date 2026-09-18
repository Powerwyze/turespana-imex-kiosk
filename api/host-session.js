import { liveSessionConfig } from '../lib/host-config.js';
const reply = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return reply({error:'Please open the photo host on this site.'},403);
  // The test is available on the public Vercel test preview, unless explicitly enabled.
  if (process.env.ENABLE_FACE_HOST === 'false')
    return reply({error:'This photo host is temporarily disabled by the operator.'},403);
  if (!process.env.OPENAI_API_KEY?.trim()) return reply({error:'The voice host is not configured.'},503);
  try {
    const text = await req.text();
    if (text.length > 65536) return reply({error:'Connection request is too large.'},413);
    let body;
    try { body=JSON.parse(text); } catch { return reply({error:'Invalid connection request.'},400); }
    if (typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0') || !body.sdp.includes('m=audio'))
      return reply({error:'A microphone connection offer is required.'},400);
    const upstream = await fetch('https://api.openai.com/v1/live/sessions',{
      method:'POST', headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY.trim()}`,'Content-Type':'application/json'},
      body:JSON.stringify({session:liveSessionConfig(),transport:{type:'webrtc',sdp:body.sdp}}),
      signal:AbortSignal.any([req.signal,AbortSignal.timeout(25000)])
    });
    const data = await upstream.json().catch(()=>({}));
    if (!upstream.ok) {
      console.error('Photo host session failed',{status:upstream.status,code:data.error?.code ?? 'unknown'});
      return reply({error:upstream.status===429?'The voice host is busy. Please try again shortly.':'The voice host could not connect. Please try again.',code:data.error?.code || 'VOICE_UNAVAILABLE'},502);
    }
    if (!data.session?.id || !data.transport?.sdp) return reply({error:'The voice connection was incomplete.'},502);
    return reply({session:{id:data.session.id},transport:{type:'webrtc',sdp:data.transport.sdp}},201);
  } catch {
    return reply({error:'The voice connection timed out. Tap the face to try again.'},504);
  }
}
