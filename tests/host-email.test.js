import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoEmail,validEmail} from '../public/host-email.js';
test('spoken email is a draft only, and confirmation requires a valid address and a finished photo',async()=>{
 let sends=0;const email=new PhotoEmail({deliver:async()=>sends++});
 assert.ok(email.review('alex@example.com').error);assert.equal(await email.confirm(),false);
 email.setImage(new Blob(['approved']));email.review('a l e x at example dot com');assert.equal(await email.confirm(),false);
 email.review('alex@example.com');email.editName('Álex García');assert.equal(sends,0);assert.equal(email.snapshot().status,'review');
 assert.equal(await email.confirm(),true);assert.equal(sends,1);assert.equal(email.draft,'');
 assert.equal(await email.confirm(),false);assert.equal(sends,1);
});
test('double tapping confirmation cannot send twice, reset suppresses a late response',async()=>{
 let resolve,sends=0;const email=new PhotoEmail({deliver:()=>{sends++;return new Promise(r=>resolve=r);}});
 email.setImage(new Blob(['one']));email.review('guest@example.com');email.editName('Guest');
 const first=email.confirm();assert.equal(await email.confirm(),false);assert.equal(sends,1);
 email.reset();resolve();assert.equal(await first,false);assert.equal(email.status,'empty');assert.equal(email.image,null);
});
test('failed delivery preserves the editable draft and supports an explicit retry',async()=>{
 let sends=0;const email=new PhotoEmail({deliver:async({email})=>{sends++;if(sends===1)throw new Error('Temporary');assert.equal(email,'correct@example.com');}});
 email.setImage(new Blob(['approved']));email.review('typo@example.com');email.editName('Guest');assert.equal(await email.confirm(),false);
 assert.equal(email.status,'error');email.edit('correct@example.com');assert.equal(await email.confirm(),true);assert.equal(sends,2);
});
test('a new picture invalidates the old address, and cancelled review clears it',()=>{
 const email=new PhotoEmail({deliver:async()=>{}});email.setImage(new Blob(['one']));email.review('private@example.com');email.cancel();assert.equal(email.draft,'');
 email.review('private@example.com');email.setImage(new Blob(['two']));assert.equal(email.draft,'');assert.equal(email.status,'empty');
});
test('email validation rejects spoken, malformed and header-injection values',()=>{
 for(const value of ['alex@example.com','alex+photo@sub.example.com'])assert.equal(validEmail(value),true);
 for(const value of ['a b@example.com','alex at example.com','a@@example.com','x@example.com\r\nBcc: x@y.com','.x@example.com','x..x@example.com'])assert.equal(validEmail(value),false);
});

test('name required, opt-in defaults off and only a choice grants consent; retries preserve it',async()=>{
 let count=0,payload;const e=new PhotoEmail({deliver:async p=>{payload=p;if(++count===1)throw new Error('temporary');}});
 e.setImage(new Blob(['approved']));e.review('guest@example.com');assert.equal(await e.confirm(),false);
 e.editName('  María  José  ');assert.equal(e.marketingOptIn,false);e.chooseMarketing('true');assert.equal(e.marketingOptIn,false);
 e.chooseMarketing(true);assert.equal(await e.confirm(),false);assert.equal(e.marketingOptIn,true);assert.equal(e.name,'  María  José  ');
 assert.equal(await e.confirm(),true);assert.equal(payload.name,'María José');assert.equal(payload.marketingOptIn,true);assert.ok(payload.consentVersion);
 assert.equal(e.name,'');assert.equal(e.marketingOptIn,false);
 e.setImage(new Blob(['new']));e.review('other@example.com');e.editName('Other');e.chooseMarketing(true);e.edit('different@example.com');assert.equal(e.marketingOptIn,false);
 e.chooseMarketing(true);e.cancel();assert.equal(e.name,'');assert.equal(e.marketingOptIn,false);
});
