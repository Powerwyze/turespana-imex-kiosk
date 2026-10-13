const QUOTA=new Set(['credit_balance_exhausted','insufficient_quota','billing_hard_limit_reached']);
export async function openaiFetch(url,options,fetchImpl=fetch){
 const response=await fetchImpl(url,options);
 if(response.ok)return response;
 const backup=process.env.OPENAI_BACKUP?.trim();
 const headers=new Headers(options.headers);
 if(!backup||headers.get('authorization')===`Bearer ${backup}`||options.signal?.aborted)return response;
 const data=await response.clone().json().catch(()=>null);
 if(!QUOTA.has(data?.error?.code))return response;
 headers.set('Authorization',`Bearer ${backup}`);
 return fetchImpl(url,{...options,headers});
}
