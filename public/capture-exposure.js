// Apply once to the camera frame, before JPEG encoding. Retries reuse that JPEG.
export const CAPTURE_BRIGHTNESS=0.85;
export const CAPTURE_FILTER=`brightness(${CAPTURE_BRIGHTNESS})`;
export function drawExposureCorrected(context,source,width,height){
 context.save();
 try{
  context.filter='none';
  context.drawImage(source,0,0,width,height);
  // Pixel processing works even on browsers without CanvasRenderingContext2D.filter.
  // Scale channels equally: no beautification, facial changes or selective skin processing.
  const frame=context.getImageData(0,0,width,height);
  for(let i=0;i<frame.data.length;i+=4){
   frame.data[i]=Math.round(frame.data[i]*CAPTURE_BRIGHTNESS);
   frame.data[i+1]=Math.round(frame.data[i+1]*CAPTURE_BRIGHTNESS);
   frame.data[i+2]=Math.round(frame.data[i+2]*CAPTURE_BRIGHTNESS);
  }
  context.putImageData(frame,0,0);
 }finally{context.restore();}
}
