import test from 'node:test';import assert from 'node:assert/strict';
import {TurespanaEngine} from '../public/turespana-engine.js';
import {liveSessionConfig} from '../lib/host-config.js';
test('destination is explicit, guarded during capture, and cleared for the next guest',async()=>{
 let release,calls=0;const e=new TurespanaEngine({prepare:()=>new Promise(r=>release=r),capture:async()=>'',generate:async()=>{calls++;return 'image';}});
 await e.execute('set_guest_count',{count:1});assert.match((await e.execute('take_photo',{confirmed:true})).error,/destination/);assert.equal(calls,0);
 assert.ok((await e.execute('set_destination',{destinationId:'unknown'})).error);
 for(const destinationId of ['andalucia','madrid','cataluna','pais-vasco','galicia','valencia'])assert.equal((await e.execute('set_destination',{destinationId})).destinationId,destinationId);
 await e.execute('take_photo',{confirmed:true});assert.ok((await e.execute('set_destination',{destinationId:'madrid'})).error);release();await e.job;
 assert.ok((await e.execute('set_destination',{destinationId:'madrid'})).error);e.reset();assert.equal(e.snapshot().destinationId,null);assert.equal(e.source,null);
});
test('host offers six Spanish destinations and only touch-confirmed email',()=>{
 const c=liveSessionConfig();assert.ok(c.delegation.responses.tools.find(t=>t.name==='set_destination'));assert.match(c.instructions,/Sol/);assert.match(c.instructions,/English or Spanish/);assert.doesNotMatch(c.instructions,/Damn Good|Fort Lauderdale/);assert.equal(c.delegation.responses.tools.some(t=>t.name==='send_email'),false);
});

import nodemailer from 'nodemailer';import sendPhoto from '../api/host-email.js';
test('existing SMTP provider sends transactional attachment once for exact retries',async()=>{
 const original=nodemailer.createTransport,env={...process.env};let calls=0,payload;
 delete process.env.RESEND_API_KEY;process.env.WYZER_GMAIL_USER='sender@example.test';process.env.WYZER_APP_PASSWORD='test-only';
 nodemailer.createTransport=()=>({sendMail:async message=>{calls++;payload=message;return {accepted:message.to,messageId:'test-id'};}});
 const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;}});
 try{
  const req={method:'POST',body:{email:'test@example.test',imageBase64:Buffer.from('smtp-fixture').toString('base64'),mimeType:'image/jpeg'}};
  const a=response(),b=response();await Promise.all([sendPhoto(req,a),sendPhoto(req,b)]);assert.equal(a.code,200);assert.equal(b.code,200);assert.equal(calls,1);
  assert.match(payload.subject,/Spain/);assert.doesNotMatch(payload.html,/newsletter|subscribed|Damn Good|Flow/);assert.equal(payload.attachments[0].content.toString(),'smtp-fixture');
 }finally{nodemailer.createTransport=original;for(const key of ['RESEND_API_KEY','WYZER_GMAIL_USER','WYZER_APP_PASSWORD']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
