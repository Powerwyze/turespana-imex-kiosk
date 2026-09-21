// Apply exact brand artwork after the portrait has passed its identity/outfit check.
// The footer extends the image; it never covers or crops the guests.
export async function brandPortrait(blob, regionName){
  if(typeof regionName!=='string'||!regionName.trim())throw new Error('Choose a region before creating your portrait.');
  const photo=await createImageBitmap(blob);
  try{
    const logo=new Image();logo.src='/assets/spain-sun-fallback.svg';await logo.decode();
    const scale=photo.width/1024,footer=Math.round(152*scale),canvas=document.createElement('canvas');
    canvas.width=photo.width;canvas.height=photo.height+footer;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your portrait could not be prepared.');
    ctx.drawImage(photo,0,0);ctx.fillStyle='#f7f1e5';ctx.fillRect(0,photo.height,canvas.width,footer);
    ctx.fillStyle='#b79a66';ctx.fillRect(0,photo.height,canvas.width,Math.max(1,2*scale));
    ctx.fillStyle='#132235';ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.font=`500 ${52*scale}px Georgia, serif`;
    ctx.fillText(regionName.toLocaleUpperCase('es-ES'),38*scale,photo.height+footer/2,canvas.width-280*scale);
    const logoW=92*scale,logoH=logoW*243/281,center=canvas.width-119*scale;
    ctx.drawImage(logo,center-logoW/2,photo.height+19*scale,logoW,logoH);
    ctx.font=`700 ${20*scale}px Arial, sans-serif`;ctx.textAlign='center';
    ctx.fillText('TURESPAÑA',center,photo.height+126*scale);
    return await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Your branded portrait could not be saved.')),'image/jpeg',.96));
  }finally{photo.close();}
}
