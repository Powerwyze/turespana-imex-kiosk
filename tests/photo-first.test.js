import test from 'node:test';
import assert from 'node:assert/strict';
import {TurespanaEngine} from '../public/turespana-engine.js';
import {runCountdown} from '../public/host-countdown.js';
const fixture=()=>{let calls=[];const engine=new TurespanaEngine({capture:async()=>new Blob(['camera']),generate:async args=>{calls.push(args);return new Blob(['result']);}});return {engine,calls};};
test('capture first, then people, then city starts exactly one generation',async()=>{
 const {engine,calls}=fixture();assert.ok((await engine.execute('set_destination',{destinationId:'madrid'})).error);
 assert.ok((await engine.execute('set_guest_count',{count:2})).error);
 await engine.execute('take_photo',{confirmed:true});await engine.job;
 assert.equal(engine.phase,'choosing_people');assert.equal(calls.length,0);
 assert.ok((await engine.execute('set_guest_count',{count:4})).error);
 await engine.execute('set_guest_count',{count:3});assert.equal(engine.phase,'choosing_destination');assert.equal(calls.length,0);
 const source=engine.source;await engine.execute('set_destination',{destinationId:'madrid'});await engine.job;
 assert.equal(calls.length,1);assert.equal(calls[0].source,source);assert.equal(calls[0].count,3);assert.equal(engine.phase,'result');
 await engine.execute('take_photo',{confirmed:true});await engine.job;assert.equal(engine.phase,'choosing_people');assert.equal(engine.count,null);assert.equal(engine.destination,null);
});
test('reset during capture discards the late photo',async()=>{
 let release;const engine=new TurespanaEngine({capture:()=>new Promise(r=>release=r),generate:()=>assert.fail('must not generate')});
 await engine.execute('take_photo',{confirmed:true});const job=engine.job;engine.reset();release(new Blob(['late']));await job;assert.equal(engine.source,null);assert.equal(engine.phase,'listening');
});
test('countdown lasts seven seconds with seven synchronized ticks',async()=>{
 let now=0;const ticks=[];await runCountdown({now:()=>now,sleep:async ms=>{now+=ms;},onTick:n=>ticks.push(n)});assert.equal(now,7000);assert.deepEqual(ticks,[7,6,5,4,3,2,1]);
});
test('double city taps cannot duplicate generation and retry uses saved source',async()=>{
 const {engine,calls}=fixture();await engine.execute('take_photo',{confirmed:true});await engine.job;await engine.execute('set_guest_count',{count:1});
 await Promise.all([engine.execute('set_destination',{destinationId:'bilbao'}),engine.execute('set_destination',{destinationId:'madrid'})]);await engine.job;assert.equal(calls.length,1);assert.equal(engine.destination,'bilbao');
 await engine.execute('retry_picture',{confirmed:true});await engine.job;assert.equal(calls.length,2);assert.equal(calls[0].source,calls[1].source);
});
