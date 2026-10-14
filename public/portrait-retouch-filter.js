// Face geometry is never warped. Only feathered skin pixels are blended.
const OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const EYES=[[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]];
const BROWS=[[70,63,105,66,107,55,65,52,53,46],[336,296,334,293,300,276,283,282,295,285]];
const LIPS=[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185];
const NOSE=[168,193,122,196,3,51,45,220,115,48,64,98,97,2,326,327,294,278,344,440,275,281,248,419,351,417];
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function polygon(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
function mean(points){return {x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length};}
function expanded(points,scale){const c=mean(points);return points.map(p=>({x:c.x+(p.x-c.x)*scale,y:c.y+(p.y-c.y)*scale}));}
function sampleLight(data,width,height,x,y,radius){
  let sum=0,count=0;
  for(let py=Math.max(0,Math.round(y-radius));py<Math.min(height,y+radius);py++)for(let px=Math.max(0,Math.round(x-radius));px<Math.min(width,x+radius);px++){
    const i=(py*width+px)*4;sum+=luminance(data[i],data[i+1],data[i+2]);count++;
  }
  return count?sum/count:0;
}
// Preserve small, isolated dark beauty marks instead of smearing them into skin.
export function beautyMarkMask(original,soft,mask,width,height,faceWidth){
  const flags=new Uint8Array(width*height),protect=new Uint8Array(flags.length),queue=[];
  for(let n=0;n<flags.length;n++){
    const i=n*4;
    if(mask[i+3]>200&&luminance(soft[i],soft[i+1],soft[i+2])-luminance(original[i],original[i+1],original[i+2])>34)flags[n]=1;
  }
  const minArea=Math.max(4,Math.round(faceWidth*faceWidth*.000065)),maxArea=faceWidth*faceWidth*.00045;
  for(let n=0;n<flags.length;n++){
    if(!flags[n])continue;
    flags[n]=0;queue.length=0;queue.push(n);let minX=width,minY=height,maxX=0,maxY=0;
    for(let pos=0;pos<queue.length;pos++){
      const cell=queue[pos],x=cell%width,y=Math.floor(cell/width);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const next of [x>0?cell-1:-1,x<width-1?cell+1:-1,y>0?cell-width:-1,y<height-1?cell+width:-1])if(next>=0&&flags[next]){flags[next]=0;queue.push(next);}
    }
    const aspect=(maxX-minX+1)/(maxY-minY+1);
    if(queue.length<minArea||queue.length>maxArea||aspect<.55||aspect>1.85)continue;
    const pad=Math.max(1,Math.round(faceWidth*.004));
    for(const cell of queue){const x=cell%width,y=Math.floor(cell/width);for(let py=Math.max(0,y-pad);py<=Math.min(height-1,y+pad);py++)for(let px=Math.max(0,x-pad);px<=Math.min(width-1,x+pad);px++)protect[py*width+px]=1;}
  }
  return protect;
}
export function finishFace(ctx,landmarks,width,height){
  if(landmarks.length<468)return false;
  const all=landmarks.map(p=>({x:p.x*width,y:p.y*height}));
  // The face mesh ends below the hairline, leaving upper-forehead lines untreated.
  // Extend only the central forehead; dark hair pixels are excluded below.
  const meshHeight=all[152].y-all[10].y,forehead=all[10].x,meshWidth=Math.abs(all[454].x-all[234].x);
  const oval=OVAL.map(i=>({x:all[i].x,y:all[i].y-([10,338,297,332,284,109,67,103,54].includes(i)?meshHeight*.12*Math.max(0,1-Math.abs(all[i].x-forehead)/(meshWidth*.5)):0)}));
  const x0=clamp(Math.floor(Math.min(...oval.map(p=>p.x)))-8,0,width-1),y0=clamp(Math.floor(Math.min(...oval.map(p=>p.y)))-8,0,height-1);
  const w=clamp(Math.ceil(Math.max(...oval.map(p=>p.x)))+8-x0,1,width-x0),h=clamp(Math.ceil(Math.max(...oval.map(p=>p.y)))+8-y0,1,height-y0);
  if(w<45||h<55)return false;
  const points=all.map(p=>({x:p.x-x0,y:p.y-y0})),skin=new OffscreenCanvas(w,h),maskCtx=skin.getContext('2d',{willReadFrequently:true});
  maskCtx.fillStyle='#fff';polygon(maskCtx,expanded(oval.map(p=>({x:p.x-x0,y:p.y-y0})),.965));
  maskCtx.globalCompositeOperation='destination-out';
  // Stop above the jaw/beard; retain facial hair and natural mouth expression.
  const lowerY=points[2].y+h*.025;
  maskCtx.fillRect(0,lowerY,w,h);
  for(const feature of [...EYES,...BROWS,LIPS,NOSE]){
    const scale=BROWS.includes(feature)?1.16:EYES.includes(feature)?1.07:1.13;
    polygon(maskCtx,expanded(feature.map(i=>points[i]),scale));
    maskCtx.lineWidth=Math.max(1,w*(BROWS.includes(feature)?.025:EYES.includes(feature)?.015:.012));maskCtx.strokeStyle='#fff';maskCtx.stroke();
  }
  const feathered=new OffscreenCanvas(w,h),featherCtx=feathered.getContext('2d',{willReadFrequently:true});
  featherCtx.filter=`blur(${Math.max(1,w*.006)}px)`;featherCtx.drawImage(skin,0,0);
  const mask=featherCtx.getImageData(0,0,w,h).data;
  const crop=new OffscreenCanvas(w,h),cropCtx=crop.getContext('2d',{willReadFrequently:true});
  cropCtx.drawImage(ctx.canvas,x0,y0,w,h,0,0,w,h);
  const original=cropCtx.getImageData(0,0,w,h),blurred=new OffscreenCanvas(w,h),blurCtx=blurred.getContext('2d',{willReadFrequently:true});
  blurCtx.filter=`blur(${Math.max(2,w*.012)}px)`;
  // Extend crop edges so blur never introduces a transparent/dark fringe.
  blurCtx.drawImage(crop,-w,0);blurCtx.drawImage(crop,w,0);blurCtx.drawImage(crop,0,-h);blurCtx.drawImage(crop,0,h);blurCtx.drawImage(crop,0,0);
  const soft=blurCtx.getImageData(0,0,w,h).data,src=original.data;
  // Broad forehead lines need a wider, feathered finish than fine under-eye skin.
  const broad=new OffscreenCanvas(w,h),broadCtx=broad.getContext('2d',{willReadFrequently:true});
  broadCtx.filter=`blur(${Math.max(3,w*.040)}px)`;
  for(const dx of [-w,0,w])for(const dy of [-h,0,h])broadCtx.drawImage(crop,dx,dy);
  const broadSkin=broadCtx.getImageData(0,0,w,h).data;
  const browLine=Math.min(...BROWS.map(row=>mean(row.map(i=>points[i])).y));
  const marks=beautyMarkMask(src,soft,mask,w,h,w);
  const eyes=EYES.map((indices,index)=>{
    const p=indices.map(i=>points[i]),center=mean(p),eyeWidth=Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x));
    return {x:center.x,y:Math.max(...p.map(v=>v.y))+h*.035,rx:eyeWidth*.83,ry:h*.075,
      target:sampleLight(soft,w,h,center.x+(index===0?-1:1)*w*.03,center.y+h*.19,w*.045)};
  });
  const eyeLevel=Math.min(...eyes.map(eye=>eye.y-h*.035)),skinLight=eyes.reduce((sum,eye)=>sum+eye.target,0)/eyes.length;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const n=y*w+x,i=n*4;if(marks[n]||mask[i+3]<2)continue;
    if(y<all[10].y-y0+meshHeight*.025&&luminance(src[i],src[i+1],src[i+2])<skinLight*.40)continue;
    let strength=y<eyeLevel?.80:.48;
    let lift=0;const light=luminance(soft[i],soft[i+1],soft[i+2]);
    for(const eye of eyes){const radius=((x-eye.x)/eye.rx)**2+((y-eye.y)/eye.ry)**2;if(radius<1){strength=Math.max(strength,.48+.40*(1-radius));lift=Math.max(lift,Math.min(20,Math.max(0,eye.target-light-2)*.70)*(1-radius)**1.2);}}
    const foreheadAmount=clamp((browLine-y-h*.035)/(h*.075),0,1);
    strength=Math.max(strength,foreheadAmount*.96);
    const alpha=mask[i+3]/255*strength;
    for(let channel=0;channel<3;channel++)src[i+channel]=clamp(src[i+channel]*(1-alpha)+(soft[i+channel]*(1-foreheadAmount)+broadSkin[i+channel]*foreheadAmount+lift)*alpha,0,255);
  }
  ctx.putImageData(original,x0,y0);return true;
}
export async function finishPortrait(bitmap,faces){
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);
  for(const face of faces.slice(0,3))finishFace(ctx,face,canvas.width,canvas.height);
  return canvas.convertToBlob({type:'image/jpeg',quality:.96});
}
