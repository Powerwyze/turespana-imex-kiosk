// Text and original brand artwork are composed after the portrait passes its checks.
// Separate top and bottom bands keep all branding away from faces, hair and clothing.
export const CAMPAIGN_PHRASE='Spain at IMEX America - 13-15 October 2026';
export const AI_DISCLOSURE='AI generated photo';
export const PORTRAIT_LOGO='/assets/spain-info-logo.png';
export async function brandPortrait(blob, regionName){
  if(typeof regionName!=='string'||!regionName.trim())throw new Error('Choose a region before creating your portrait.');
  const photo=await createImageBitmap(blob);
  try{
    const logo=new Image();logo.src=PORTRAIT_LOGO;await logo.decode();
    const scale=photo.width/1024,header=Math.round(116*scale),footer=Math.round(188*scale),canvas=document.createElement('canvas');
    canvas.width=photo.width;canvas.height=header+photo.height+footer;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your portrait could not be prepared.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(photo,0,header);
    ctx.fillStyle='#132235';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`500 ${64*scale}px Georgia, serif`;
    ctx.fillText(regionName.toLocaleUpperCase('es-ES'),canvas.width/2,header/2,canvas.width-76*scale);
    const bottom=header+photo.height,logoBox=164*scale,pad=20*scale;
    // Preserve the official supplied asset's proportions and lettering. Never redraw it.
    const ratio=Math.min(logoBox/logo.naturalWidth,logoBox/logo.naturalHeight);
    const logoW=logo.naturalWidth*ratio,logoH=logo.naturalHeight*ratio;
    ctx.drawImage(logo,canvas.width-pad-logoBox+(logoBox-logoW)/2,bottom+(footer-logoH)/2,logoW,logoH);
    const textLeft=38*scale,textWidth=canvas.width-logoBox-3*pad-textLeft;
    let font=34*scale;ctx.font=`600 ${font}px Georgia, serif`;
    while(ctx.measureText(CAMPAIGN_PHRASE).width>textWidth&&font>22*scale){font-=scale;ctx.font=`600 ${font}px Georgia, serif`;}
    ctx.textAlign='left';ctx.fillText(CAMPAIGN_PHRASE,textLeft,bottom+74*scale,textWidth);
    ctx.fillStyle='#465364';ctx.font=`500 ${26*scale}px Arial, sans-serif`;
    ctx.fillText(AI_DISCLOSURE,textLeft,bottom+121*scale,textWidth);
    return await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Your branded portrait could not be saved.')),'image/jpeg',.96));
  }finally{photo.close();}
}
