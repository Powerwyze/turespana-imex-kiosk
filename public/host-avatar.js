import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function mountAvatar(face,canvas){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,5/6,.1,30);
  camera.position.set(0,0,6.5);
  scene.add(new THREE.HemisphereLight(0xffedcb,0x422018,1.8));
  for(const [color,intensity,position] of [[0xffb383,3.1,[-3,3,4]],[0xffd12a,2.6,[3,1,3]],[0xe42719,3.5,[0,2,-2]]]){
    const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
  }
  let model;
  try{model=(await new GLTFLoader().loadAsync('/assets/lola-avatar.glb')).scene;}catch(e){renderer.dispose();throw e;}
  scene.add(model);
  const mouths=[],eyes=[];
  model.traverse(node=>{

    if(node.morphTargetDictionary?.jawOpen!==undefined)mouths.push(node);
    if(/^(EyeWhite|Iris|Pupil|Catchlight)_[LR]$/.test(node.name))eyes.push({node,scale:node.scale.clone()});
  });
  if(!mouths.length)throw new Error('Avatar is missing mouth shapes.');
  const observer=new ResizeObserver(()=>{const r=face.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.render(scene,camera);});
  observer.observe(face);
  face.dataset.avatar='ready';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let last=0,jaw=0,round=0;
  return {update({time,level,brightness}){
    if(document.hidden||time-last<1000/30)return;last=time;
    jaw+=(Math.min(1,level*1.35)-jaw)*.6;
    round+=((level>.02?Math.max(0,1-brightness*2):0)-round)*.35;
    for(const mesh of mouths){mesh.morphTargetInfluences[mesh.morphTargetDictionary.jawOpen]=jaw;const r=mesh.morphTargetDictionary.mouthRound;if(r!==undefined)mesh.morphTargetInfluences[r]=round*jaw;}
    const blinkTime=(time%5400)/5400,blink=blinkTime>.94?Math.max(.06,Math.abs(blinkTime-.97)/.03):1;
    for(const {node,scale} of eyes)node.scale.y=scale.y*(reduced.matches?1:blink);
    model.rotation.y=reduced.matches?0:Math.sin(time/3900)*.018;
    model.rotation.z=reduced.matches?0:Math.sin(time/4700)*.015;
    model.position.y=reduced.matches?0:Math.sin(time/2700)*.025;
    renderer.render(scene,camera);
  }};
}
