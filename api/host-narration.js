import {openaiFetch} from '../lib/openai-failover.js';
import {generationLine} from '../public/generation-lines.js';
const clips=new Map();
export async function GET(req){
 const destination=new URL(req.url).searchParams.get('destinationId');
 const input=generationLine(destination);
 if(!input)return Response.json({error:'Choose a destination.'},{status:400});
 if(!process.env.OPENAI_API_KEY)return Response.json({error:'Voice is unavailable.'},{status:503});
 try{
  if(!clips.has(destination)){
   const pending=(async()=>{
    const response=await openaiFetch('https://api.openai.com/v1/audio/speech',{
     method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
     body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input,response_format:'mp3',instructions:'You are Lola, a warm, friendly Spain tourism host. Speak naturally and clearly in English, with a lively conversational pace.'})
    });
    if(!response.ok)throw Error('Speech unavailable');
    const bytes=await response.arrayBuffer();if(!bytes.byteLength)throw Error('Empty speech');return bytes;
   })();
   clips.set(destination,pending);pending.catch(()=>{if(clips.get(destination)===pending)clips.delete(destination);});
  }
  const bytes=await clips.get(destination);
  return new Response(bytes.slice(0),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'public, max-age=3600, s-maxage=86400'}});
 }catch{return Response.json({error:'Voice is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
