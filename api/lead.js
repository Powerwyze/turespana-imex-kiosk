import {validateContact,storeContact} from '../lib/contact-store.js';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
 const contact=validateContact(req.body);
 if(!contact||typeof req.body?.imageBase64!=='string')return res.status(400).json({ok:false,error:'Invalid contact details'});
 const bytes=Buffer.from(req.body.imageBase64.replace(/^data:[^;]+;base64,/,''),'base64');
 if(!bytes.length||bytes.length>8*1024*1024)return res.status(400).json({ok:false,error:'Invalid photo'});
 try{const saved=await storeContact(contact,bytes);return res.status(200).json({ok:true,stored:true,photoId:null,publicUrl:null,id:saved.id});}
 catch{return res.status(503).json({ok:false,stored:false,error:'Details could not be saved. Please try again.'});}
}
