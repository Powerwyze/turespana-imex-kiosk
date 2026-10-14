import test from 'node:test';
import assert from 'node:assert/strict';
import {mountContactViewport} from '../public/contact-viewport.js';

function fixture({native=true,viewport=true}={}){
 const properties=new Map(),frames=new Map();let next=1;
 const view=new EventTarget();view.innerHeight=844;
 view.requestAnimationFrame=callback=>{const id=next++;frames.set(id,callback);return id;};
 view.cancelAnimationFrame=id=>frames.delete(id);
 if(viewport){view.visualViewport=new EventTarget();Object.assign(view.visualViewport,{height:430,offsetTop:40});}
 const field={inputMode:native?'email':'none',getBoundingClientRect:()=>({top:190,bottom:242})};
 const panel={hidden:false,scrollTop:0,clientTop:1,getBoundingClientRect:()=>({top:12,bottom:206})};
 const doc=new EventTarget();doc.documentElement={style:{setProperty:(name,value)=>properties.set(name,value)}};doc.body={dataset:{}};doc.activeElement=field;
 const controller=mountContactViewport({panel,inputs:[field],view,doc});
 const flush=()=>{const pending=[...frames.values()];frames.clear();for(const callback of pending)callback();};
 return {view,doc,panel,field,properties,controller,flush};
}
test('native keyboard viewport height and pan offset update the shared layout dimensions',()=>{
 const f=fixture();f.flush();
 assert.equal(f.properties.get('--viewport-height'),'430px');assert.equal(f.properties.get('--viewport-top'),'40px');assert.equal(f.doc.body.dataset.nativeInput,'true');
 f.view.visualViewport.height=220;f.view.visualViewport.offsetTop=60;f.view.visualViewport.dispatchEvent(new Event('resize'));f.view.visualViewport.dispatchEvent(new Event('scroll'));f.flush();
 assert.equal(f.properties.get('--viewport-height'),'220px');assert.equal(f.properties.get('--viewport-top'),'60px');f.controller.destroy();
});
test('native input remains in the scrollable form while custom keyboard focus keeps its scroll position',()=>{
 const native=fixture();native.flush();assert.equal(native.panel.scrollTop,45);native.controller.destroy();
 const custom=fixture({native:false});custom.flush();assert.equal(custom.panel.scrollTop,0);assert.equal(custom.doc.body.dataset.nativeInput,'false');custom.controller.destroy();
});
test('blur clears compact native editing and browsers without visualViewport use window height',()=>{
 const f=fixture({viewport:false});f.flush();assert.equal(f.properties.get('--viewport-height'),'844px');assert.equal(f.properties.get('--viewport-top'),'0px');
 f.doc.activeElement=f.doc.body;f.doc.dispatchEvent(new Event('focusout'));f.flush();assert.equal(f.doc.body.dataset.nativeInput,'false');
 f.controller.destroy();f.view.innerHeight=600;f.view.dispatchEvent(new Event('resize'));f.flush();assert.equal(f.properties.get('--viewport-height'),'844px');
});
test('confirmation focus keeps the form expanded until the native keyboard closes',()=>{
 const f=fixture();f.view.visualViewport.height=220;f.flush();assert.equal(f.doc.body.dataset.nativeInput,'true');
 f.panel.scrollTop=0;f.doc.activeElement={id:'emailConfirm'};f.doc.dispatchEvent(new Event('focusout'));f.flush();
 assert.equal(f.doc.body.dataset.nativeInput,'true');assert.equal(f.panel.scrollTop,0,'Only an active native text field requests scrolling');
 f.view.visualViewport.height=f.view.innerHeight;f.view.visualViewport.dispatchEvent(new Event('resize'));f.flush();
 assert.equal(f.doc.body.dataset.nativeInput,'false');f.controller.destroy();
});
