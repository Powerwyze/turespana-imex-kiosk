import test from 'node:test';
import assert from 'node:assert/strict';
import {captionPages,HostCaptions} from '../public/host-captions.js';

const measure=value=>value.length;
test('caption pages contain at most two complete lines without losing spoken words',()=>{
 const phrase='Hello, your bright pink top really stands out! I am your AI photo host. Would you like a Spain portrait?';
 const pages=captionPages(phrase,24,measure);
 assert.ok(pages.length>1);
 assert.equal(pages.map(page=>page.text.replaceAll('\n',' ')).join(' '),phrase);
 for(const page of pages){assert.ok(page.text.split('\n').length<=2);for(const line of page.text.split('\n'))assert.ok(line.length<=24);assert.equal(phrase.slice(page.start,page.end).replaceAll('\n',' '),page.text.replaceAll('\n',' '));}
});
test('an unusually long word stays inside the caption width',()=>{
 const pages=captionPages('abcdefghijklm hello',5,measure);
 assert.equal(pages.map(page=>page.text.replaceAll('\n','')).join('').replaceAll(' ',''),'abcdefghijklmhello');
 for(const page of pages)for(const line of page.text.split('\n'))assert.ok(line.length<=5);
});
function fixture(){
 const previous={document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,getComputedStyle:globalThis.getComputedStyle};
 globalThis.document={body:{dataset:{phase:'idle'}},createElement:()=>({getContext:()=>({measureText:value=>({width:value.length})})})};
 globalThis.ResizeObserver=class{observe(){}};
 globalThis.getComputedStyle=()=>({fontWeight:'500',fontSize:'20px',fontFamily:'Arial'});
 const home={append(node){node.parentElement=this;}},box={parentElement:null,hidden:true},text={clientWidth:26,textContent:'',scrollTop:0};box.parentElement=home;
 const captions=new HostCaptions(box,text,home);
 return {captions,box,text,home,restore(){captions.stopTimed();Object.assign(globalThis,previous);}};
}
test('the footer stays visible and in its original parent across phases and contact entry',()=>{
 const f=fixture();try{
  for(const phase of ['idle','connecting','listening','countdown','choosing_people','choosing_destination','generating','result','error']){
   f.captions.setPhase(phase);assert.equal(f.box.hidden,false);assert.ok(f.text.textContent);assert.ok(f.text.textContent.split('\n').length<=2);
  }
  f.captions.placeIn({prepend(){throw Error('Caption must not move into contact form');}});assert.equal(f.box.parentElement,f.home);
  f.captions.append('An actual spoken line');f.captions.clear();assert.equal(f.box.hidden,false);assert.equal(f.text.scrollTop,0);
 }finally{f.restore();}
});
test('recorded captions begin at the first page, follow boundaries, and cancel on phase changes',async()=>{
 const f=fixture();try{
  const phrase='First words are shown at the beginning. The middle follows. These last words appear at the end.';
  f.captions.startTimed(phrase,1);assert.match(f.text.textContent,/First words/);assert.doesNotMatch(f.text.textContent,/last words/);
  f.captions.boundary(phrase.indexOf('These'));assert.match(f.text.textContent,/last words|These/);assert.equal(f.captions.timers.length,0);
  f.captions.startTimed(phrase,.02);f.captions.setPhase('countdown');const placeholder=f.text.textContent;
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(f.text.textContent,placeholder);assert.equal(f.captions.timed,null);
 }finally{f.restore();}
});
