import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoEmail,validEmail} from '../public/host-email.js';
test('spoken email is a draft only, and confirmation requires a valid address and a finished photo',async()=>{
 let sends=0;const email=new PhotoEmail({deliver:async()=>sends++});
 assert.ok(email.review('alex@example.com').error);assert.equal(await email.confirm(),false);
 email.setImage(new Blob(['approved']));email.review('a l e x at example dot com');assert.equal(await email.confirm(),false);
 email.review('alex@example.com');assert.equal(sends,0);assert.equal(email.snapshot().status,'review');
 assert.equal(await email.confirm(),true);assert.equal(sends,1);assert.equal(email.draft,'');
 assert.equal(await email.confirm(),false);assert.equal(sends,1);
});
test('double tapping confirmation cannot send twice, reset suppresses a late response',async()=>{
 let resolve,sends=0;const email=new PhotoEmail({deliver:()=>{sends++;return new Promise(r=>resolve=r);}});
 email.setImage(new Blob(['one']));email.review('guest@example.com');
 const first=email.confirm();assert.equal(await email.confirm(),false);assert.equal(sends,1);
 email.reset();resolve();assert.equal(await first,false);assert.equal(email.status,'empty');assert.equal(email.image,null);
});
test('failed delivery preserves the editable draft and supports an explicit retry',async()=>{
 let sends=0;const email=new PhotoEmail({deliver:async({email})=>{sends++;if(sends===1)throw new Error('Temporary');assert.equal(email,'correct@example.com');}});
 email.setImage(new Blob(['approved']));email.review('typo@example.com');assert.equal(await email.confirm(),false);
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
