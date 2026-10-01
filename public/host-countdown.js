const cancelled=()=>new DOMException('Cancelled','AbortError');
export function countdownWait(ms,signal){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(cancelled());
    const abort=()=>{clearTimeout(timer);reject(cancelled());};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
  });
}
// Every tick targets the same deadline, so a late browser timer cannot add
// another second to the pose or play a burst of outdated countdown numbers.
export async function runCountdown({signal,onTick,now=()=>performance.now(),sleep=countdownWait}){
  const deadline=now()+5000;
  let previous=0;
  for(;;){
    if(signal?.aborted)throw cancelled();
    const remaining=deadline-now();
    if(remaining<=0)return;
    const seconds=Math.ceil(remaining/1000);
    if(seconds!==previous){previous=seconds;onTick(seconds);}
    await sleep(remaining-(seconds-1)*1000,signal);
  }
}
