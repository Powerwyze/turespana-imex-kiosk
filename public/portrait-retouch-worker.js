// Classic worker is required by the existing MediaPipe WASM loader.
let detector,finishPhoto,queue=Promise.resolve();
self.onmessage=({data})=>{
  queue=queue.then(async()=>{
    if(data.type==='init'){
      try{
        const [{FaceLandmarker,FilesetResolver},filter]=await Promise.all([
          import('/vendor/vision/vision_bundle.mjs'),import('/portrait-retouch-filter.js')
        ]);
        finishPhoto=filter.finishPortrait;
        detector=await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/vendor/vision/wasm'),{
          baseOptions:{modelAssetPath:'/assets/face-landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:4,
          minFaceDetectionConfidence:.35,minFacePresenceConfidence:.35,minTrackingConfidence:.35,
          outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
        });
        self.postMessage({type:'ready'});
      }catch{self.postMessage({type:'failed'});}
    }else if(data.type==='retouch'){
      let bitmap;
      try{
        bitmap=await createImageBitmap(data.blob);
        const result=detector.detect(bitmap);
        const blob=result.faceLandmarks.length?await finishPhoto(bitmap,result.faceLandmarks):data.blob;
        self.postMessage({type:'finished',id:data.id,blob,faces:result.faceLandmarks.length});
      }catch{self.postMessage({type:'finished',id:data.id,blob:data.blob});}
      finally{bitmap?.close();}
    }
  }).catch(()=>self.postMessage({type:'failed'}));
};
