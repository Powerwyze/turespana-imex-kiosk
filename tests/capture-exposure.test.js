import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CAPTURE_BRIGHTNESS,CAPTURE_FILTER,drawExposureCorrected} from '../public/capture-exposure.js';
test('capture darkens actual RGB pixels once without changing alpha or image dimensions',()=>{
 const data=new Uint8ClampedArray([255,200,100,255,20,40,60,128]);let drawn=false,restored=false,put=false;
 const ctx={save(){},restore(){restored=true;},drawImage(source,x,y,w,h){assert.equal(source,'camera');assert.deepEqual([x,y,w,h],[0,0,2,1]);drawn=true;},getImageData(x,y,w,h){assert.ok(drawn);assert.deepEqual([x,y,w,h],[0,0,2,1]);return {data};},putImageData(frame,x,y){assert.equal(frame.data,data);assert.deepEqual([x,y],[0,0]);put=true;}};
 drawExposureCorrected(ctx,'camera',2,1);
 assert.deepEqual([...data],[217,170,85,255,17,34,51,128]);assert.ok(put&&restored);assert.equal(CAPTURE_BRIGHTNESS,.85);assert.equal(CAPTURE_FILTER,'brightness(0.85)');
});
