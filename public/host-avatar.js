// Animate the official Spain.info logo without redrawing or distorting its artwork.
// The same local image remains visible if module loading or animation fails.
export async function mountAvatar(face,image){
  await image.decode();
  if(!image.naturalWidth)throw new Error('Spain logo failed to load.');
  face.dataset.avatar='ready';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let last=0,energy=0;
  return {update({time,level}){
    if(document.hidden||time-last<1000/30)return;last=time;
    energy+=(Math.max(0,Math.min(1,level))-energy)*.45;
    face.style.setProperty('--logo-scale',reduced.matches?'1':String(1+energy*.035));
    face.style.setProperty('--logo-glow',String(.12+energy*.4));
  }};
}
