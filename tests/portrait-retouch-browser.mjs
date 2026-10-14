// No paid API: actual local face model/filter, one face, three faces and an empty scene.
// Defaults to a temporary local static server; PORTRAIT_RETOUCH_TEST_URL overrides it.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(import.meta.dirname,'..'),publicRoot=path.join(root,'public');
const source=await fs.readFile(process.env.PORTRAIT_TEST_SOURCE||path.join(root,'tests/fixtures/portrait-face.jpg'));
let target=process.env.PORTRAIT_RETOUCH_TEST_URL,server,browser;
try{
  if(!target){
    const types={'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.task':'application/octet-stream'};
    server=http.createServer(async(req,res)=>{
      try{
        const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(publicRoot,'.'+pathname);
        if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
        const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(bytes);
      }catch{res.writeHead(404).end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));target='http://127.0.0.1:'+server.address().port;
  }
  const options={args:['--no-sandbox','--enable-unsafe-swiftshader']};
  if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)options.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  else try{await fs.access('/usr/bin/chromium');options.executablePath='/usr/bin/chromium';}catch{}
  browser=await chromium.launch(options);const page=await browser.newPage();
  await page.route(new URL('/',target).href,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local portrait finishing verification</title>'}));
  await page.goto(new URL('/',target).href);
  const result=await page.evaluate(async source=>{
    const {preloadPortraitRetouch,retouchPortrait}=await import('/portrait-retouch.js');
    const started=performance.now(),ready=await preloadPortraitRetouch(),loadMs=performance.now()-started;
    const original=new Blob([Uint8Array.from(atob(source),c=>c.charCodeAt(0))],{type:'image/jpeg'}),finishStarted=performance.now();
    const finished=await retouchPortrait(original),retouchMs=performance.now()-finishStarted;
    const before=await createImageBitmap(original),after=await createImageBitmap(finished);
    const canvas=new OffscreenCanvas(before.width*2,before.height),ctx=canvas.getContext('2d');ctx.drawImage(before,0,0);ctx.drawImage(after,before.width,0);
    const comparison=await canvas.convertToBlob({type:'image/jpeg',quality:.96});
    const dimensionsMatch=before.width===after.width&&before.height===after.height;after.close();
    const blank=new OffscreenCanvas(640,640);blank.getContext('2d').fillRect(0,0,640,640);
    const blankBlob=await blank.convertToBlob(),empty=await retouchPortrait(blankBlob);
    const encoded=async blob=>{let text='';for(const byte of new Uint8Array(await blob.arrayBuffer()))text+=String.fromCharCode(byte);return btoa(text);};
    const triple=new OffscreenCanvas(1536,768),tripleContext=triple.getContext('2d');tripleContext.fillStyle='#bbb';tripleContext.fillRect(0,0,1536,768);
    // Use the upper central portrait crop so all three faces have useful detail,
    // matching the generated booth portraits rather than three tiny full bodies.
    const cropWidth=before.width*.50,cropHeight=before.height*.52,scale=Math.min(512/cropWidth,768/cropHeight);
    for(let i=0;i<3;i++)tripleContext.drawImage(before,(before.width-cropWidth)/2,0,cropWidth,cropHeight,i*512+(512-cropWidth*scale)/2,0,cropWidth*scale,cropHeight*scale);
    before.close();const groupSource=await triple.convertToBlob({type:'image/jpeg',quality:.96}),worker=new Worker('/portrait-retouch-worker.js');
    const request=data=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Face worker test timed out')),20000);
      worker.onmessage=({data})=>{clearTimeout(timer);resolve(data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Face worker test failed'));};worker.postMessage(data);
    });
    let group;
    try{
      const initialized=await request({type:'init'});if(initialized.type!=='ready')throw new Error('Face worker did not initialize');
      const groupStarted=performance.now();group=await request({type:'retouch',id:3,blob:groupSource});group.duration=performance.now()-groupStarted;
    }finally{worker.terminate();}
    return {ready,loadMs,retouchMs,dimensionsMatch,applied:finished!==original,blankUnchanged:await encoded(blankBlob)===await encoded(empty),groupFaces:group.faces,groupMs:group.duration,finished:await encoded(finished),comparison:await encoded(comparison),group:await encoded(group.blob)};
  },source.toString('base64'));
  assert.equal(result.ready,true);assert.equal(result.applied,true);assert.equal(result.dimensionsMatch,true);assert.equal(result.blankUnchanged,true);assert.ok(result.retouchMs<2500);assert.equal(result.groupFaces,3);assert.ok(result.groupMs<2500);
  const output=process.env.PORTRAIT_TEST_OUTPUT||path.join(root,'artifacts');await fs.mkdir(output,{recursive:true});
  for(const key of ['finished','comparison','group']){await fs.writeFile(output+'/retouch-'+key+'.jpg',Buffer.from(result[key],'base64'));delete result[key];}
  console.log('Local finishing verification:',JSON.stringify(result));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
