const unavailable='The voice host is temporarily unavailable. Tap the logo to try again.';
export async function connectVoice(sdp,{signal,fetcher=fetch}={}) {
  let response;
  try {response=await fetcher('/api/host-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp}),signal});}
  catch(error){if(signal?.aborted||['AbortError','TimeoutError'].includes(error.name))throw new Error('The voice connection timed out. Tap the logo to try again.');throw new Error('The voice connection was interrupted. Check your connection and tap the logo to try again.');}
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    const message=typeof result?.error==='string'&&result.error.length<240?result.error:unavailable;
    const error=new Error(message);error.code=result?.code;throw error;
  }
  if(typeof result?.session?.id!=='string'||typeof result?.transport?.sdp!=='string'||!result.transport.sdp.trim())throw new Error('The voice connection was incomplete. Tap the logo to try again.');
  return result;
}
