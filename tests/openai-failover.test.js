import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openaiFetch} from '../lib/openai-failover.js';
test('backup retries only confirmed quota and preserves payload and deadline',async()=>{
 process.env.OPENAI_BACKUP='test-backup';
 const signal=AbortSignal.timeout(5000),body=new FormData();body.append('test','payload');
 let calls=0;const result=await openaiFetch('https://api.openai.com/test',{method:'POST',headers:{Authorization:'Bearer test-primary'},body,signal},async(u,o)=>{calls++;assert.equal(o.body,body);assert.equal(o.signal,signal);if(calls===1)return Response.json({error:{code:'credit_balance_exhausted'}},{status:429});assert.equal(o.headers.get('Authorization'),'Bearer test-backup');return new Response('ok');});
 assert.equal(calls,2);assert.equal(await result.text(),'ok');
 for(const code of ['rate_limit_exceeded','invalid_api_key','model_not_found']){calls=0;await openaiFetch('https://api.openai.com/test',{headers:{}},async()=>{calls++;return Response.json({error:{code}},{status:429});});assert.equal(calls,1);}
 calls=0;await assert.rejects(openaiFetch('https://api.openai.com/test',{headers:{}},async()=>{calls++;throw new Error('network');}));assert.equal(calls,1);delete process.env.OPENAI_BACKUP;
});
