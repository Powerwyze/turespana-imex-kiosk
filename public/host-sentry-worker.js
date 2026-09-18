// Classic worker supports the MediaPipe WASM loader's importScripts call.
let detector;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {ObjectDetector,FilesetResolver}=await import('/vendor/vision/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
      detector=await ObjectDetector.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/person-detector.tflite',delegate:'CPU'},runningMode:'IMAGE',scoreThreshold:.62,categoryAllowlist:['person'],maxResults:3});
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      if(!detector){data.bitmap.close();return;}
      try{
        const area=data.bitmap.width*data.bitmap.height;
        const result=detector.detect(data.bitmap);
        const present=result.detections.some(d=>d.categories.some(c=>c.categoryName==='person'&&c.score>=.62)&&d.boundingBox.width*d.boundingBox.height/area>=.035);
        self.postMessage({type:'presence',present,frameId:data.frameId});
      }finally{data.bitmap.close();}
    }
  }catch{self.postMessage({type:'error',message:'Person detection is unavailable. You can still tap the sun to start.'});}
};
