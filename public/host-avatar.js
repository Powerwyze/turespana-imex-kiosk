import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function mountAvatar(face,canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,5/6,.1,30);camera.position.set(0,0,7);
 scene.add(new THREE.HemisphereLight(0xffffff,0x584533,2));
 for(const [intensity,position] of [[3,[-3,4,5]],[1.5,[3,1,4]],[1,[0,-3,2]]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...position);scene.add(light);}
 let model;try{model=(await new GLTFLoader().loadAsync('/assets/spain-sun.glb')).scene;}catch(error){renderer.dispose();throw error;}scene.add(model);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const pose=()=>{model.rotation.y=reduced.matches?0:-.14;model.rotation.x=reduced.matches?0:.07;};pose();
 const observer=new ResizeObserver(()=>{const r=face.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.render(scene,camera);});observer.observe(face);face.dataset.avatar='ready';
 let last=0,energy=0;
 return {update({time,level}){
  if(document.hidden||time-last<1000/30)return;last=time;energy+=(Math.max(0,Math.min(1,level))-energy)*.45;
  const scale=reduced.matches?1:1+energy*.04;model.scale.setScalar(scale);
  model.rotation.y=reduced.matches?0:-.14+Math.sin(time/3500)*.07;model.rotation.x=reduced.matches?0:.07+Math.sin(time/4700)*.025;
  face.style.setProperty('--logo-scale',String(scale));face.style.setProperty('--logo-glow',String(.12+energy*.35));renderer.render(scene,camera);
 }};
}
