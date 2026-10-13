let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {GestureRecognizer,FilesetResolver}=await import('/vendor/vision/vision_bundle.mjs');
   detector=await GestureRecognizer.createFromOptions(await FilesetResolver.forVisionTasks('/vendor/vision/wasm'),{baseOptions:{modelAssetPath:'/assets/gesture-recognizer.task',delegate:'CPU'},runningMode:'IMAGE',numHands:6,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const result=detector.recognize(data.bitmap);
    self.postMessage({type:'gesture',victory:result.gestures.some(hand=>hand.some(g=>g.categoryName==='Victory'&&g.score>=.7))});
   }finally{data.bitmap.close();}
  }
 }catch{self.postMessage({type:'error'});}
};
