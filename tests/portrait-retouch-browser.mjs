// No paid API: actual local face model/filter, one, three, four faces and an empty scene.
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
    // Use upper central portrait crops so every face has useful detail. Four
    // guests use two rows, matching a group portrait rather than tiny full bodies.
    const cropWidth=before.width*.50,cropHeight=before.height*.52,scale=Math.min(512/cropWidth,768/cropHeight);
    const makeGroup=async count=>{
      const columns=count===4?2:3,rows=Math.ceil(count/columns),canvas=new OffscreenCanvas(columns*512,rows*768),ctx=canvas.getContext('2d');
      ctx.fillStyle='#bbb';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<count;i++)ctx.drawImage(before,(before.width-cropWidth)/2,0,cropWidth,cropHeight,(i%columns)*512+(512-cropWidth*scale)/2,Math.floor(i/columns)*768,cropWidth*scale,cropHeight*scale);
      return {count,columns,blob:await canvas.convertToBlob({type:'image/jpeg',quality:.96})};
    };
    const fixtures=await Promise.all([makeGroup(3),makeGroup(4)]);before.close();
    const worker=new Worker('/portrait-retouch-worker.js');
    const request=data=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Face worker test timed out')),20000);
      worker.onmessage=({data})=>{clearTimeout(timer);resolve(data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Face worker test failed'));};worker.postMessage(data);
    });
    const groups=[];
    try{
      const initialized=await request({type:'init'});if(initialized.type!=='ready')throw new Error('Face worker did not initialize');
      for(const fixture of fixtures){
        const groupStarted=performance.now(),group=await request({type:'retouch',id:fixture.count,blob:fixture.blob});group.duration=performance.now()-groupStarted;
        // Compare against the same JPEG decode/encode without filtering. This
        // catches a fourth face being detected but skipped by a stale slice(0,3).
        const original=await createImageBitmap(fixture.blob),baselineCanvas=new OffscreenCanvas(original.width,original.height),baselineCtx=baselineCanvas.getContext('2d');baselineCtx.drawImage(original,0,0);original.close();
        const baseline=await createImageBitmap(await baselineCanvas.convertToBlob({type:'image/jpeg',quality:.96}));baselineCtx.drawImage(baseline,0,0);baseline.close();
        const processed=await createImageBitmap(group.blob),processedCanvas=new OffscreenCanvas(processed.width,processed.height),processedCtx=processedCanvas.getContext('2d');processedCtx.drawImage(processed,0,0);processed.close();
        const changes=[];
        for(let i=0;i<fixture.count;i++){
          const x=(i%fixture.columns)*512+16,y=Math.floor(i/fixture.columns)*768+16,w=480,h=736,control=baselineCtx.getImageData(x,y,w,h).data,output=processedCtx.getImageData(x,y,w,h).data;
          let pixels=0;for(let p=0;p<control.length;p+=4)if(Math.abs(control[p]-output[p])+Math.abs(control[p+1]-output[p+1])+Math.abs(control[p+2]-output[p+2])>=9)pixels++;
          changes.push(pixels);
        }
        groups.push({count:fixture.count,faces:group.faces,ms:group.duration,changedPixelsPerFace:changes,image:await encoded(group.blob)});
      }
    }finally{worker.terminate();}
    return {ready,loadMs,retouchMs,dimensionsMatch,applied:finished!==original,blankUnchanged:await encoded(blankBlob)===await encoded(empty),groups,finished:await encoded(finished),comparison:await encoded(comparison)};
  },source.toString('base64'));
  assert.equal(result.ready,true);assert.equal(result.applied,true);assert.equal(result.dimensionsMatch,true);assert.equal(result.blankUnchanged,true);assert.ok(result.retouchMs<2500);
  for(const group of result.groups){assert.equal(group.faces,group.count);assert.ok(group.ms<2500);for(const pixels of group.changedPixelsPerFace)assert.ok(pixels>300,'Every detected face must receive actual finishing, not only JPEG recompression.');}
  const output=process.env.PORTRAIT_TEST_OUTPUT||path.join(root,'artifacts');await fs.mkdir(output,{recursive:true});
  for(const key of ['finished','comparison']){await fs.writeFile(output+'/retouch-'+key+'.jpg',Buffer.from(result[key],'base64'));delete result[key];}
  for(const group of result.groups){await fs.writeFile(output+'/retouch-group-'+group.count+'.jpg',Buffer.from(group.image,'base64'));delete group.image;}
  console.log('Local finishing verification:',JSON.stringify(result));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
