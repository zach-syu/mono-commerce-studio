import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../supabase/functions/_shared/handler.ts';
import { MemoryStore } from '../supabase/functions/_shared/memory-store.ts';
import { MODELS, ownerFromToken } from '../supabase/functions/_shared/types.ts';
import { parseImage } from '../supabase/functions/_shared/validation.ts';
import { createFileStore } from '../server/file-store.ts';
import { createSupabaseStore } from '../supabase/functions/_shared/supabase-store.ts';

const token='a'.repeat(64),other='b'.repeat(64),code='test-access-code-at-least-16';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9GQAAAAASUVORK5CYII=';
const env={MONO_LIVE_ACCESS_CODE:code,VERTEX_API_KEY:'must-never-leak',VERTEX_ACCESS_TOKEN:'server-token',GOOGLE_CLOUD_PROJECT:'test-project'};
const operation=`projects/test-project/locations/us-central1/publishers/google/models/${MODELS.video}/operations/abc`;
function req(path:string,body?:unknown, options:{token?:string;code?:string;method?:string;origin?:string}={}) {
  if(body&&typeof body==='object'&&!Array.isArray(body)&&(path==='/image'||path==='/video'||(body as Record<string,unknown>).mode==='live'))body={allowPaid:true,...body};
  return new Request(`http://localhost/api${path}`,{method:options.method || (body===undefined?'GET':'POST'),headers:{'content-type':'application/json','x-workspace-token':options.token??token,...(options.code?{'x-mono-access-code':options.code}:{}),...(options.origin?{origin:options.origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
function setup(fetcher?:typeof fetch,config=env){const store=new MemoryStore();return{store,handler:createHandler({env:config,store,fetcher})};}
async function json(response:Response){return {status:response.status,...await response.json()};}
describe('portable backend contracts',()=>{
  it('blocks paid requests in a no-cost environment even when keys and consent exist',async()=>{
    const fetcher=vi.fn();const {handler}=setup(fetcher as typeof fetch,{...env,MONO_DISABLE_LIVE:'1'} as typeof env);
    const result=await json(await handler(req('/copy',{product:'Tea',mode:'live',allowPaid:true},{code})));
    expect(result.status).toBe(403);expect(result.error.code).toBe('PAID_CALLS_DISABLED');expect(fetcher).not.toHaveBeenCalled();
  });
  it('requires explicit billing confirmation before using a valid model access code',async()=>{
    const fetcher=vi.fn();const {handler}=setup(fetcher as typeof fetch);
    const result=await json(await handler(req('/copy',{product:'Tea',mode:'live',allowPaid:false},{code})));
    expect(result.status).toBe(400);expect(result.error.code).toBe('PAID_CONFIRMATION_REQUIRED');expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds shared writes even when callers rotate workspace tokens',async()=>{
    const store=new MemoryStore();const handler=createHandler({env:{MONO_DAILY_REQUEST_LIMIT:'2'},store});
    expect((await handler(req('/copy',{product:'Tea'},{token}))).status).toBe(200);
    expect((await handler(req('/copy',{product:'Tea'},{token:other}))).status).toBe(200);
    const secondIsolate=createHandler({env:{MONO_DAILY_REQUEST_LIMIT:'2'},store});
    const denied=await json(await secondIsolate(req('/copy',{product:'Tea'},{token:'c'.repeat(64)})));
    expect(denied.status).toBe(429);expect(denied.error.code).toBe('DAILY_BUDGET_EXCEEDED');expect(store.records.size).toBe(2);
  });
  it('bounds total stored bytes independently of owner rotation',async()=>{
    const store=new MemoryStore();const handler=createHandler({env:{MONO_DAILY_ASSET_BYTES:'100'},store});
    expect((await handler(req('/assets',{dataUrl:png}))).status).toBe(201);
    expect((await handler(req('/assets',{dataUrl:png},{token:other}))).status).toBe(429);expect(store.assets.size).toBe(1);
  });
  it('validates product metadata before uploading and rolls back failed product writes',async()=>{
    const {handler,store}=setup();
    expect((await handler(req('/products',{name:'Tea',sourceDataUrl:png,metadata:[]}))).status).toBe(400);expect(store.assets.size).toBe(0);
    expect((await handler(req('/products',{name:'Tea',sourceDataUrl:png,id:'invalid'}))).status).toBe(400);expect(store.assets.size).toBe(0);
    const original=store.put.bind(store);store.put=async(kind,row)=>{if(kind==='products')throw new Error('DB unavailable');return original(kind,row);};
    expect((await handler(req('/products',{name:'Tea',sourceDataUrl:png}))).status).toBe(500);expect(store.assets.size).toBe(0);
  });
  it('retains a shared local budget across store instances',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'mono-budget-'));try{const a=createFileStore(directory);expect(await a.consumeBudget('requests:2026-09-08',1,1)).toBe(true);expect(await createFileStore(directory).consumeBudget('requests:2026-09-08',1,1)).toBe(false);}finally{await rm(directory,{recursive:true,force:true});}
  });
  it('retains long merchant facts including the final caution when saving and planning',async()=>{
    const fact='商品說明。'.repeat(490)+'注意：含酒精與過敏原。';
    const {handler,store}=setup();
    const saved=await json(await handler(req('/products',{name:'Long facts',description:fact,facts:[fact]})));
    expect(saved.status).toBe(201);expect(saved.product.description).toBe(fact);expect(saved.product.facts[0]).toBe(fact);
    const copy=await json(await handler(req('/copy',{product:{name:'Long facts',description:fact,facts:[fact]},language:'zh-TW',mode:'demo'})));
    expect(copy.status).toBe(200);expect(copy.sections[4].body).toContain('注意：含酒精與過敏原。');
    const owner=await ownerFromToken(token);const jobs=await store.list('jobs',owner);expect((jobs[0].payload.product as {facts:string[]}).facts[0]).toBe(fact);
  });
  it('reports readiness without exposing credentials or claiming provider verification',async()=>{
    const {handler}=setup();const response=await handler(req('/health',undefined,{token:''}));const text=await response.text();expect(text).not.toContain('must-never-leak');expect(text).not.toContain('server-token');expect(JSON.parse(text).providers.image).toBe('vertex-ready');expect(JSON.parse(text).models.copy).toBe('gemini-3.7-flash');
  });
  it('requires a 256-bit workspace capability',async()=>{const {handler}=setup();expect((await handler(req('/products',undefined,{token:'short'}))).status).toBe(401);});
  it('denies unrelated browser origins but handles allowed preflight',async()=>{
    const {handler}=setup();expect((await handler(req('/health',undefined,{origin:'https://evil.example'}))).status).toBe(403);
    const response=await handler(req('/copy',undefined,{method:'OPTIONS',origin:'http://localhost:5173',token:''}));expect(response.status).toBe(204);expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
  it('supports deployed Supabase function route prefixes',async()=>{const {handler}=setup();expect((await handler(new Request('https://test.supabase.co/functions/v1/mono-api/health'))).status).toBe(200);});
  it.each(['zh-TW','en','ja','ko'])('persists honest localized demo copy: %s',async(language)=>{
    const fetcher=vi.fn();const {handler,store}=setup(fetcher as typeof fetch);const result=await json(await handler(req('/copy',{product:{name:'Tea',category:'food',description:'',facts:[]},language,platform:'Shopee',prompt:'',mode:'demo'})));
    expect(result.status).toBe(200);expect(result.provider).toBe('demo');expect(result.model).toBe('local-storyboard-v2');expect(result.sections).toHaveLength(5);expect(result.sections.every((s:{selected:boolean})=>s.selected)).toBe(true);expect(fetcher).not.toHaveBeenCalled();expect(store.records.size).toBe(1);
    if(language==='ja')expect(result.sections[0].title).toMatch(/[ぁ-んァ-ン]/);if(language==='en')expect(result.sections[0].title).toContain('everyday');
  });
  it('rejects unsupported language and client ownership injection',async()=>{
    const {handler}=setup();expect((await handler(req('/copy',{product:'Tea',language:'xx'}))).status).toBe(400);expect((await handler(req('/products',{name:'Tea',owner:'forged'}))).status).toBe(400);
  });
  it('keeps foreign-language demo bodies localized without pretending to translate arbitrary facts',async()=>{
    const {handler}=setup();const unknown=await json(await handler(req('/copy',{product:{name:'Example',facts:['中文自訂商品事實']},language:'en'})));expect(unknown.sections[4].body).not.toContain('中文');expect(unknown.sections[4].body).toContain('label');
    const known=await json(await handler(req('/copy',{product:{name:'Tea',facts:['示範包裝。茶葉商品。實際成分、重量與產地待商家補充。']},language:'ja'})));expect(known.sections[4].body).toContain('販売者');expect(known.sections[4].body).not.toContain('待商家');
    const history=await json(await handler(req('/jobs')));expect(history.jobs.some((j:any)=>j.product?.facts.includes('中文自訂商品事實'))).toBe(true);
  });
  it('rejects empty product names and malformed JSON',async()=>{
    const {handler}=setup();expect((await handler(req('/products',{name:' '}))).status).toBe(400);
    const bad=new Request('http://localhost/api/copy',{method:'POST',headers:{'content-type':'application/json','x-workspace-token':token},body:'{'});expect((await handler(bad)).status).toBe(400);
  });
  it('isolates products and source images between capabilities',async()=>{
    const {handler}=setup();const saved=await json(await handler(req('/products',{name:'Tea',category:'food',sourceDataUrl:png})));expect(saved.status).toBe(201);
    const mine=await json(await handler(req('/products')));const theirs=await json(await handler(req('/products',undefined,{token:other})));expect(mine.products).toHaveLength(1);expect(theirs.products).toEqual([]);
    expect((await handler(req(`/assets?id=${saved.product.sourceAssetId}`,undefined,{token:other}))).status).toBe(404);
    const source=await json(await handler(req(`/assets?id=${saved.product.sourceAssetId}`)));expect(source.dataUrl).toBe(png);
    expect((await handler(req('/products',{name:'Stolen',sourceAssetId:saved.product.sourceAssetId},{token:other}))).status).toBe(404);
  });
  it('rejects spoofed image MIME, remote URLs, unsupported sizes, and zero images',async()=>{
    const {handler}=setup();for(const sourceDataUrl of ['https://example.com/image.png',png.replace('image/png','image/jpeg'),'data:image/svg+xml;base64,PHN2Zz4=',''])expect((await handler(req('/image',{sourceDataUrl,prompt:'test'}))).status).toBeGreaterThanOrEqual(400);
    expect((await handler(req('/image',{sourceDataUrl:png,prompt:'test',imageSize:'8K'},{code}))).status).toBe(400);
    expect(()=>parseImage(`data:image/png;base64,${'A'.repeat(10_000_000)}`)).toThrow('7 MB');
  });
  it('gates paid calls and never silently falls back',async()=>{
    const fetcher=vi.fn();const {handler}=setup(fetcher as typeof fetch);const noCode=await json(await handler(req('/copy',{product:'Tea',mode:'live'})));expect(noCode.status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
    const unconfigured=createHandler({env:{MONO_LIVE_ACCESS_CODE:code},store:new MemoryStore(),fetcher:fetcher as typeof fetch});const missing=await json(await unconfigured(req('/image',{sourceDataUrl:png,prompt:'Create an image'},{code})));expect(missing.status).toBe(503);expect(missing.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
  it('sends the exact Gemini 3.7 schema with image context and rejects broken copy output',async()=>{
    let body:any;let url='';const fetcher=vi.fn(async(input:any,init:any)=>{url=String(input);body=JSON.parse(init.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({sections:[{id:'hero',title:'Hello',body:'Copy'}]})}]},finishReason:'STOP'}]}));});
    const {handler}=setup(fetcher as typeof fetch);const result=await json(await handler(req('/copy',{product:'Tea',mode:'live',sourceDataUrl:png},{code})));expect(result.status).toBe(200);expect(result.provider).toBe('vertex');expect(url).toContain('/gemini-3.7-flash:generateContent');expect(body.generationConfig.responseMimeType).toBe('application/json');expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('LOW');expect(body.generationConfig).not.toHaveProperty('temperature');expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/png');
    fetcher.mockImplementation(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'broken-json'}]}}]})));const bad=await json(await handler(req('/copy',{product:'Tea',mode:'live'},{code})));expect(bad.error.code).toBe('COPY_SCHEMA_MISMATCH');
  });
  it('persists actual image output and parses interleaved text/image parts',async()=>{
    let requestBody:any;const fetcher=vi.fn(async(_url:any,init:any)=>{requestBody=JSON.parse(init.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Here is the image'},{inlineData:{mimeType:'image/png',data:png.split(',')[1]}}]},finishReason:'STOP'}]}));});const {handler,store}=setup(fetcher as typeof fetch);
    const result=await json(await handler(req('/image',{sourceDataUrl:png,prompt:'Preserve package',aspectRatio:'21:9',imageSize:'4K'},{code})));expect(result.status).toBe(200);expect(result.dataUrl).toBe(png);expect(result.model).toBe('gemini-3.1-flash-image');expect(requestBody.generationConfig).toEqual({responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:'21:9',imageSize:'4K'}});expect(store.assets.size).toBe(1);
  });
  it('does not claim success for image-only-text or safety responses',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Cannot make image'}]}}]})));const {handler}=setup(fetcher as typeof fetch);const result=await json(await handler(req('/image',{sourceDataUrl:png,prompt:'Test'},{code})));expect(result.status).toBe(422);expect(result.error.code).toBe('PROVIDER_NO_IMAGE');const jobs=await json(await handler(req('/jobs')));expect(jobs.jobs[0].status).toBe('failed');
    fetcher.mockImplementation(async()=>new Response(JSON.stringify({promptFeedback:{blockReason:'SAFETY'}})));const blocked=await json(await handler(req('/image',{sourceDataUrl:png,prompt:'Test'},{code})));expect(blocked.error.code).toBe('PROVIDER_BLOCKED');
  });
  it('sanitizes provider error bodies and preserves quota classification',async()=>{
    const {handler}=setup(vi.fn(async()=>new Response('secret api key must-never-leak',{status:429})) as typeof fetch);const result=await json(await handler(req('/image',{sourceDataUrl:png,prompt:'Test'},{code})));expect(result.status).toBe(429);expect(result.error.code).toBe('PROVIDER_QUOTA');expect(result.error.retryable).toBe(true);expect(JSON.stringify(result)).not.toContain('must-never-leak');
  });
  it('tracks Veo long-running pending and completed states with downloadable private MP4',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({name:operation}))).mockResolvedValueOnce(new Response(JSON.stringify({done:false}))).mockResolvedValueOnce(new Response(JSON.stringify({done:true,response:{videos:[{mimeType:'video/mp4',bytesBase64Encoded:btoa('mp4-fixture')}],raiMediaFilteredCount:0}})));
    const {handler}=setup(fetcher as typeof fetch);const start=await json(await handler(req('/video',{sourceDataUrl:png,prompt:'Product video'},{code})));expect(start.status).toBe('pending');expect(start.jobId).toBeTruthy();
    const pending=await json(await handler(req(`/video?jobId=${start.jobId}`,undefined,{code})));expect(pending.status).toBe('pending');expect(pending.operationName).toBeUndefined();
    const completed=await json(await handler(req(`/video?jobId=${start.jobId}`,undefined,{code})));expect(completed.status).toBe('completed');expect(completed.assetId).toBeTruthy();
    const asset=await json(await handler(req(`/assets?id=${completed.assetId}`)));expect(asset.mimeType).toBe('video/mp4');
    const pollBody=JSON.parse(fetcher.mock.calls[1][1].body);expect(pollBody).toEqual({operationName:operation});
  });
  it('retains failed Veo jobs and scopes polling to their owner',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({name:operation}))).mockResolvedValueOnce(new Response(JSON.stringify({done:true,error:{message:'private details'}})));const {handler}=setup(fetcher as typeof fetch);const start=await json(await handler(req('/video',{sourceDataUrl:png,prompt:'Test'},{code})));
    expect((await handler(req(`/video?jobId=${start.jobId}`,undefined,{token:other,code}))).status).toBe(404);const failed=await json(await handler(req(`/video?jobId=${start.jobId}`,undefined,{code})));expect(failed.status).toBe('failed');expect(failed.error.code).toBe('VIDEO_PROVIDER_FAILED');expect(JSON.stringify(failed)).not.toContain('private details');
  });
  it('cancels local Veo tracking without pretending provider cancellation',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({name:operation})));const {handler}=setup(fetcher as typeof fetch);const start=await json(await handler(req('/video',{sourceDataUrl:png,prompt:'Test'},{code})));const cancelled=await json(await handler(req(`/video?jobId=${start.jobId}`,undefined,{method:'DELETE'})));expect(cancelled.status).toBe('cancelled');expect(cancelled.cancellationNote).toContain('計費');await handler(req(`/video?jobId=${start.jobId}`));expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('requires real project auth for Veo instead of reusing an unrelated Gemini key',async()=>{
    const {handler}=setup(undefined,{MONO_LIVE_ACCESS_CODE:code,VERTEX_API_KEY:'express'} as typeof env);const result=await json(await handler(req('/video',{sourceDataUrl:png,prompt:'Test'},{code})));expect(result.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
  it('rejects fabricated provider claims in client-created jobs',async()=>{
    const {handler}=setup();const response=await handler(req('/jobs',{provider:'vertex',type:'banner',settings:{},outputs:[]}));expect(response.status).toBe(400);
  });
  it('uses Gemini Developer only after explicit selection and keeps credential types separate',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({sections:[{title:'Hello',body:'World'}]})}]}}]})));
    const handler=createHandler({env:{...env,MONO_GOOGLE_PROVIDER:'gemini-api',GEMINI_API_KEY:'developer-only-key'},store:new MemoryStore(),fetcher:fetcher as typeof fetch});
    const result=await json(await handler(req('/copy',{product:'Tea',mode:'live'},{code})));expect(result.provider).toBe('gemini-api');expect((fetcher.mock.calls[0] as any)[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent');
    const init=(fetcher.mock.calls[0] as any)[1];expect(init.headers['x-goog-api-key']).toBe('developer-only-key');expect(init.headers.Authorization).toBeUndefined();const body=JSON.parse(init.body);expect(body.generationConfig.responseJsonSchema.type).toBe('object');expect(body.generationConfig.responseSchema).toBeUndefined();
    const status=await json(await handler(req('/health')));expect(status.googleProvider).toBe('gemini-api');expect(status.providers.copy).toBe('gemini-api-ready');
    const defaultHandler=createHandler({env:{GEMINI_API_KEY:'developer-only-key',MONO_LIVE_ACCESS_CODE:code},store:new MemoryStore(),fetcher:fetcher as typeof fetch});const defaultHealth=await json(await defaultHandler(req('/health')));expect(defaultHealth.providers.copy).toBe('demo');
  });
  it('keeps Nano Banana 2 image contract and provider provenance on Developer API',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:png.split(',')[1]}}]}}]})));
    const handler=createHandler({env:{MONO_GOOGLE_PROVIDER:'gemini-api',GEMINI_API_KEY:'developer-key',MONO_GEMINI_API_KEY:'namespaced-key',MONO_LIVE_ACCESS_CODE:code},store:new MemoryStore(),fetcher:fetcher as typeof fetch});const image=await json(await handler(req('/image',{sourceDataUrl:png,prompt:'Test',imageSize:'2K'},{code})));expect(image.provider).toBe('gemini-api');expect(image.model).toBe('gemini-3.1-flash-image');expect((fetcher.mock.calls[0] as any)[0]).toContain('generativelanguage.googleapis.com');expect((fetcher.mock.calls[0] as any)[1].headers['x-goog-api-key']).toBe('namespaced-key');const jobs=await json(await handler(req('/jobs')));expect(jobs.jobs[0].provider).toBe('gemini-api');
    const video=await json(await handler(req('/video',{sourceDataUrl:png,prompt:'Test'},{code})));expect(video.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
  it('rejects stale status transitions so cancellation cannot overwrite completed jobs',async()=>{
    const store=new MemoryStore();const row={id:crypto.randomUUID(),owner:await ownerFromToken(token),payload:{status:'pending'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await store.put('jobs',row);
    expect(await store.replaceStatus('jobs',{...row,payload:{status:'completed'}},'pending')).toBe(true);
    expect(await store.replaceStatus('jobs',{...row,payload:{status:'cancelled'}},'pending')).toBe(false);expect((await store.get('jobs',row.owner,row.id))?.payload.status).toBe('completed');
  });
  it('uses one owner-scoped SQL update with a status condition for Supabase transitions',async()=>{
    const calls:any[]=[];const chain:any={update:(v:any)=>{calls.push(['update',v]);return chain;},eq:(...v:any[])=>{calls.push(['eq',...v]);return chain;},select:async()=>({data:[{id:'id'}],error:null})};const store=createSupabaseStore({from:(table:string)=>{calls.push(['from',table]);return chain;}});
    const row={id:crypto.randomUUID(),owner:await ownerFromToken(token),payload:{status:'cancelled'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};expect(await store.replaceStatus('jobs',row,'pending')).toBe(true);expect(calls).toContainEqual(['eq','owner_hash',row.owner]);expect(calls).toContainEqual(['eq','payload->>status','pending']);
  });
  it('retains local records across a fresh server store instance',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'mono-store-'));try{const store=createFileStore(directory);const owner=await ownerFromToken(token);const row={id:crypto.randomUUID(),owner,payload:{name:'persisted'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await store.put('products',row);expect((await createFileStore(directory).get('products',owner,row.id))?.payload.name).toBe('persisted');expect(await createFileStore(directory).list('products',await ownerFromToken(other))).toEqual([]);}finally{await rm(directory,{recursive:true,force:true});}
  });
});
