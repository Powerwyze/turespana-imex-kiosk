// Mobile keyboards can shrink only the visual viewport, leaving 100dvh unchanged.
export function mountContactViewport({panel,inputs,view=window,doc=document}){
 const viewport=view.visualViewport;
 let frame=null;
 function update(){
  frame=null;
  const height=viewport?.height||view.innerHeight;
  const top=Math.max(0,viewport?.offsetTop||0);
  doc.documentElement.style.setProperty('--viewport-height',height+'px');
  doc.documentElement.style.setProperty('--viewport-top',top+'px');
  const active=doc.activeElement;
  const nativeEditing=!panel.hidden&&inputs.includes(active)&&active.inputMode!=='none';
  doc.body.dataset.nativeInput=String(nativeEditing);
  if(!nativeEditing)return;
  // Scroll the form, not the page or footer. Custom key presses keep their place.
  const bounds=panel.getBoundingClientRect(),field=active.getBoundingClientRect();
  const visibleTop=bounds.top+panel.clientTop+8;
  const visibleBottom=bounds.bottom-panel.clientTop-8;
  if(field.top<visibleTop)panel.scrollTop-=visibleTop-field.top;
  else if(field.bottom>visibleBottom)panel.scrollTop+=field.bottom-visibleBottom;
 }
 function refresh(){if(frame===null)frame=view.requestAnimationFrame(update);}
 view.addEventListener('resize',refresh);
 viewport?.addEventListener('resize',refresh);
 viewport?.addEventListener('scroll',refresh);
 doc.addEventListener('focusin',refresh);
 doc.addEventListener('focusout',refresh);
 refresh();
 return {refresh,destroy(){
  if(frame!==null)view.cancelAnimationFrame(frame);
  view.removeEventListener('resize',refresh);
  viewport?.removeEventListener('resize',refresh);
  viewport?.removeEventListener('scroll',refresh);
  doc.removeEventListener('focusin',refresh);
  doc.removeEventListener('focusout',refresh);
 }};
}
