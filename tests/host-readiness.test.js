import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadinessTrigger,readinessIntent,boothChoice,retakeIntent} from '../public/host-readiness.js';
function clock(){let time=0,id=0;const tasks=new Map();return {setTimer:(fn,ms)=>{tasks.set(++id,{fn,at:time+ms});return id;},clearTimer:id=>tasks.delete(id),advance(ms){const end=time+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;tasks.delete(next[0]);next[1].fn();}time=end;}};}
test('initial-photo readiness supports natural English and Spanish without matching incidental ready text',()=>{
 for(const phrase of ['Ready','Yes please','yep','okay','I’m ready','yes I’m ready','okay we are ready','yes please take the photo','take a picture of us please','we are ready','let’s go','Take the picture','Could you take my photo please?','Si','Estoy lista','Toma la foto'])assert.equal(readinessIntent(phrase),'ready',phrase);
 for(const phrase of ['ready not yet','yes, wait','do not take my picture','don’t start','no gracias','espera','not ready'])assert.equal(readinessIntent(phrase),'hold',phrase);
 for(const phrase of ['is the photo ready','ready for what','my email is ready@example.com','two people','Madrid','what should I do'])assert.equal(readinessIntent(phrase),'none',phrase);
});
test('partial positive followed by a negation never captures and cannot escape through a pending model call',async()=>{
 const timers=clock();let captures=0,holds=0;
 const trigger=new ReadinessTrigger({...timers,canTrigger:()=>true,onReady:()=>captures++,onHold:()=>holds++});
 trigger.append('Ready');const pending=trigger.settled();timers.advance(1000);trigger.append(' ... not yet');timers.advance(1399);assert.equal(captures,0);timers.advance(1);
 assert.equal(await pending,'hold');assert.equal(holds,1);assert.equal(captures,0);
 trigger.append('yes please');timers.advance(1400);assert.equal(captures,1);timers.advance(10000);assert.equal(captures,1);
});
test('a phase change invalidates stale words and a readiness response cannot run on another screen',()=>{
 const timers=clock();let allowed=true,captures=0;const trigger=new ReadinessTrigger({...timers,canTrigger:()=>allowed,onReady:()=>captures++});
 trigger.append('ready');trigger.reset();timers.advance(2000);assert.equal(captures,0);
 allowed=false;trigger.append('yes');timers.advance(2000);assert.equal(captures,0);
});
test('spoken count and city shortcuts require the matching screen and an explicit supported answer',()=>{
 for(const phrase of ['two','2 people','there are two people','dos personas','somos dos'])assert.deepEqual(boothChoice(phrase,'choosing_people'),{name:'set_guest_count',args:{count:2}});
 for(const phrase of ['four','maybe two or three','two minutes','yes','no, two'])assert.equal(boothChoice(phrase,'choosing_people'),null);
 for(const phrase of ['Seville','Sevilla por favor','I choose Andalucía'])assert.deepEqual(boothChoice(phrase,'choosing_destination'),{name:'set_destination',args:{destinationId:'andalucia'}});
 assert.equal(boothChoice('Madrid','generating'),null);assert.equal(boothChoice('two','choosing_destination'),null);assert.equal(boothChoice('Cataluña','choosing_destination'),null);
});
test('retakes need an explicit retake request rather than a late generic affirmative',()=>{
 for(const phrase of ['Retake','another photo','Take the photo again','otra foto'])assert.equal(retakeIntent(phrase),true,phrase);
 for(const phrase of ['yes','ready','take my photo','do not retake','not another photo'])assert.equal(retakeIntent(phrase),false,phrase);
});
