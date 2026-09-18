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
