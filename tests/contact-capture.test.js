import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {CONSENT_VERSION,CONSENT_TEXT,TERMS_URL,PRIVACY_URL} from '../public/contact-policy.js';
import {validateContact} from '../lib/contact-store.js';
import sendPhoto from '../api/host-email.js';
const policy=fs.readFileSync(new URL('../public/contact-policy.js',import.meta.url),'utf8').replaceAll('export ','');
const worker=fs.readFileSync(new URL('../sites/worker.mjs',import.meta.url),'utf8').replace('__ASSET_MAP__','{}').replace('__CONTACT_POLICY__',policy);
const {default:app}=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
const contact={name:'María García',email:'guest@example.com',destinationId:'valencia',marketingOptIn:false,consentVersion:CONSENT_VERSION,portraitHash:'a'.repeat(64)};
const origin='https://kiosk.example';
const request=b=>new Request(origin+'/api/kiosk-contact',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(b)});
function database(){
 const db=new DatabaseSync(':memory:');
 const dir=new URL('../sites/drizzle/',import.meta.url);
 for(const n of fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync(new URL(n,dir),'utf8'));
 const binding={
  prepare(sql){
   return {bind(...args){
    return {
     async run(){db.prepare(sql).run(...args);return {success:true};},
     async first(){return db.prepare(sql).get(...args)||null;}
    };
   }};
  }
 };
 return {db,env:{DB:binding}};
}
test('private durable contact storage records explicit consent evidence and deduplicates retries',async()=>{
 const {db,env}=database();
 try{
  const first=await app.fetch(request(contact),env);assert.equal(first.status,200);
  const saved=await first.json();assert.equal(saved.stored,true);
  const duplicate=await (await app.fetch(request(contact),env)).json();assert.equal(duplicate.id,saved.id);
  assert.equal(db.prepare('SELECT count(*) n FROM kiosk_contacts').get().n,1);
  let row=db.prepare('SELECT * FROM kiosk_contacts').get();assert.equal(row.name,'María García');assert.equal(row.marketing_opt_in,0);assert.equal(row.consent_at,null);
  const positive={...contact,marketingOptIn:true};
  const accepted=await (await app.fetch(request(positive),env)).json();await app.fetch(request(positive),env);
  row=db.prepare('SELECT * FROM kiosk_contacts WHERE id = ?').get(accepted.id);
  assert.equal(row.marketing_opt_in,1);assert.equal(row.consent_text,CONSENT_TEXT);assert.equal(row.consent_version,CONSENT_VERSION);assert.equal(row.terms_url,TERMS_URL);assert.equal(row.privacy_url,PRIVACY_URL);assert.ok(Date.parse(row.consent_at));assert.equal(row.client,'Turespaña');
  assert.equal(db.prepare('SELECT count(*) n FROM kiosk_contacts').get().n,2);
  assert.equal((await app.fetch(new Request(origin+'/api/kiosk-contact'),env)).status,405,'No public contact read route');
  assert.equal((await app.fetch(new Request(origin+'/api/kiosk-contact',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify(contact)}),env)).status,403);
 }finally{db.close();}
});
test('malformed or old consent never grants permission; missing choice stays false',async()=>{
 const {db,env}=database();
 try{
  for(const value of ['true',1,null,{},[]]){const b={...contact,marketingOptIn:value};assert.equal(validateContact(b),null);assert.equal((await app.fetch(request(b),env)).status,400);}
  assert.equal((await app.fetch(request({...contact,marketingOptIn:true,consentVersion:'old'}),env)).status,400);
  assert.equal((await app.fetch(request({...contact,name:' '}),env)).status,400);
  const b={...contact};delete b.marketingOptIn;assert.equal((await app.fetch(request(b),env)).status,200);assert.equal(db.prepare('SELECT marketing_opt_in FROM kiosk_contacts').get().marketing_opt_in,0);
  assert.equal((await app.fetch(request(contact),{})).status,503);
 }finally{db.close();}
});
test('photo delivery requires a confirmed name and successful durable save, never logs or sends on save failure',async()=>{
 const fetchOriginal=globalThis.fetch,key=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='test-only';let sends=0,storage=0;let storageFails=true;
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes('/api/kiosk-contact')){storage++;const b=JSON.parse(init.body);assert.equal(b.name,contact.name);assert.equal(b.marketingOptIn,false);assert.equal(b.imageBase64,undefined);return Response.json({stored:!storageFails},{status:storageFails?503:200});}
  sends++;return Response.json({id:'mock-email'});
 };
 const res=()=>({status(code){this.code=code;return this;},json(data){this.data=data;return this;},send(data){this.data=data;return this;}});
 try{
  const body={...contact,imageBase64:Buffer.from('test-photo').toString('base64')};
  let r=res();await sendPhoto({method:'POST',body:{...body,name:''}},r);assert.equal(r.code,400);assert.equal(storage,0);
  r=res();await sendPhoto({method:'POST',body},r);assert.equal(r.code,503);assert.equal(sends,0);
  storageFails=false;r=res();await sendPhoto({method:'POST',body},r);assert.equal(r.code,200);assert.equal(r.data.stored,true);assert.equal(sends,1);
 }finally{globalThis.fetch=fetchOriginal;if(key===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=key;}
});

test('Sites saves contact before email proxy and refuses to forward when persistence fails',async()=>{
 const original=globalThis.fetch;let forwarded=0;globalThis.fetch=async()=>{forwarded++;return Response.json({ok:true});};
 const {db,env}=database();
 const req=()=>new Request(origin+'/api/host-email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({...contact,imageBase64:Buffer.from('photo').toString('base64')})});
 try{
  assert.equal((await app.fetch(req(),{})).status,503);assert.equal(forwarded,0);
  assert.equal((await app.fetch(req(),env)).status,200);assert.equal(forwarded,1);
  assert.equal(db.prepare('SELECT count(*) n FROM kiosk_contacts').get().n,1);
 }finally{globalThis.fetch=original;db.close();}
});
