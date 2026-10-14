// Require a held V sign while tolerating one missed/slow inference.
export class PeaceGate {
 constructor(){this.reset();}
 reset(){this.samples=[];this.fired=false;}
 observe(victory,now){
  if(this.fired)return false;
  this.samples=this.samples.filter(sample=>now-sample.at<=3000);
  this.samples.push({at:now,victory:!!victory});
  const hits=this.samples.filter(sample=>sample.victory);
  if(!victory||hits.length<3||hits.length/this.samples.length<.7)return false;
  if(now-hits[0].at<650||hits.some((hit,index)=>index&&hit.at-hits[index-1].at>1800))return false;
  this.fired=true;return true;
 }
}
