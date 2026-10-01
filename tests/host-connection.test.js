import test from 'node:test';
import assert from 'node:assert/strict';
import {connectVoice} from '../public/host-connection.js';
for(const [status,body] of [[502,'error code: 502'],[503,'<html>Unavailable</html>'],[504,''],[200,'not json']])test(`voice handshake handles non-JSON ${status}`,async()=>{let calls=0;await assert.rejects(connectVoice('offer',{fetcher:async()=>{calls++;return new Response(body,{status});}}),/voice (host is temporarily unavailable|connection was incomplete)/);assert.equal(calls,1,'No automatic session retry');});
test('valid handshake retains session and SDP',async()=>{const value={session:{id:'session'},transport:{sdp:'answer'}};assert.deepEqual(await connectVoice('offer',{fetcher:async()=>Response.json(value,{status:201})}),value);});
test('structured backend error is readable',async()=>{await assert.rejects(connectVoice('offer',{fetcher:async()=>Response.json({error:'The voice host is busy. Please try again shortly.'},{status:502})}),/voice host is busy/);});
test('missing SDP is rejected before WebRTC setup',async()=>{await assert.rejects(connectVoice('offer',{fetcher:async()=>Response.json({session:{id:'s'}})}),/incomplete/);});
test('network failure has a guest-facing recovery instruction',async()=>{await assert.rejects(connectVoice('offer',{fetcher:async()=>{throw new TypeError('Failed to fetch')}}),/Check your connection and tap the logo/);});

test('billing failure retains its operator-action code',async()=>{await assert.rejects(connectVoice('offer',{fetcher:async()=>Response.json({error:'Please ask the event team for help.',code:'VOICE_BILLING_REQUIRED'},{status:503})}),{code:'VOICE_BILLING_REQUIRED'});});
