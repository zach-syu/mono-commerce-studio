import { ApiError, MODELS, dataUrl, ownerFromToken } from './types.ts';
import type { Env, Payload, Store, StoredRecord } from './types.ts';
import { ASPECT_RATIOS, LANGUAGES, choice, exactKeys, object, parseImage, readJson, safeJson, str, uuid } from './validation.ts';
import { demoCopy } from './demo.ts';
import type { ProductBrief } from './demo.ts';
import { generateCopy, generateImage, googleProvider, pollVideo, providerConfig, startVideo } from './providers.ts';

export type HandlerOptions = { env: Env; store: Store; fetcher?: typeof fetch; now?: () => number };
export function createHandler({ env, store, fetcher = fetch, now = Date.now }: HandlerOptions) {
  const configured = providerConfig(env);
  const selectedGoogleProvider=googleProvider(env);
  const allowed = new Set((env.MONO_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
  ['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173','https://mono-commerce-studio-ashy.vercel.app'].forEach(v => allowed.add(v));
  const rates = new Map<string, { time: number; count: number }>();
  // Locks avoid duplicate polling and cancellation races within one runtime. Persistence still owns each record.
  const locks = new Set<string>();
  const iso = () => new Date(now()).toISOString();
  function positiveLimit(value:string|undefined,fallback:number){const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:fallback;}
  const dailyRequestLimit=positiveLimit(env.MONO_DAILY_REQUEST_LIMIT,500);
  const dailyAssetBytes=positiveLimit(env.MONO_DAILY_ASSET_BYTES,100*1024*1024);
  async function budget(kind:'requests'|'asset-bytes',amount:number,limit:number){if(!await store.consumeBudget(`${kind}:${iso().slice(0,10)}`,amount,limit))throw new ApiError(429,'DAILY_BUDGET_EXCEEDED',kind==='requests'?'今日示範工作室的寫入額度已用完。請明天再試，或請管理者調整額度。':'今日工作室的圖片儲存額度已用完。請明天再試，或請管理者調整額度。');}
  const record = (owner: string, payload: Payload): StoredRecord => ({ id: crypto.randomUUID(), owner, payload, createdAt: iso(), updatedAt: iso() });
  function live(request: Request) {
    const expected = env.MONO_LIVE_ACCESS_CODE;
    if (!expected || expected.length < 16) throw new ApiError(503, 'LIVE_DISABLED', '管理者尚未啟用真實模型呼叫。');
    const actual = request.headers.get('x-mono-access-code') || '';
    let differs = expected.length ^ actual.length;
    for (let i = 0; i < expected.length; i++) differs |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0);
    if (differs !== 0) throw new ApiError(403, 'LIVE_ACCESS_DENIED', '請輸入管理者提供的模型存取碼。');
  }
  function rate(owner: string) {
    const time = now(); let entry = rates.get(owner);
    if (!entry || time - entry.time > 60_000) { entry = {time, count: 0}; rates.set(owner, entry); }
    if (++entry.count > 90) throw new ApiError(429, 'RATE_LIMITED', '操作太頻繁，請稍後再試。', true);
    if (rates.size > 5000) for (const [key,v] of rates) if (time - v.time > 60_000) rates.delete(key);
  }
  async function publicRow(row: StoredRecord) {
    const { operationName: _operation, ...payload } = row.payload;
    return { id: row.id, ...payload, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }
  async function asset(owner: string, bytes: Uint8Array, mimeType: string) {
    await budget('asset-bytes',bytes.length,dailyAssetBytes);
    const id = crypto.randomUUID(); await store.assetPut(owner, id, bytes, mimeType); return id;
  }
  function decodeOutput(base64: string, max = 50 * 1024 * 1024) {
    if (base64.length > max * 1.4) throw new ApiError(502, 'PROVIDER_OUTPUT_TOO_LARGE', '模型輸出超過保存上限。');
    try { return Uint8Array.from(atob(base64), v => v.charCodeAt(0)); }
    catch { throw new ApiError(502, 'PROVIDER_INVALID_MEDIA', '模型媒體內容無法解碼。'); }
  }
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get('origin');
    const headers: Record<string,string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-request-id': requestId, 'vary': 'Origin' };
    if (origin && allowed.has(origin)) Object.assign(headers, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,x-workspace-token,x-mono-access-code,apikey,authorization', 'access-control-max-age': '600' });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers});
    try {
      if (origin && !allowed.has(origin)) throw new ApiError(403, 'ORIGIN_DENIED', '此網站來源尚未獲得 API 存取權限。');
      if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
      const url = new URL(request.url);
      const route = url.pathname.replace(/^\/functions\/v1\/mono-api/, '').replace(/^\/mono-api/, '').replace(/^\/api/, '').replace(/\/$/, '') || '/';
      if (route === '/health' && request.method === 'GET') return json({ ok: true, mode: configured.copy && env.MONO_LIVE_ACCESS_CODE ? 'hybrid' : 'demo', persistence: store.kind, googleProvider:selectedGoogleProvider, providers: { copy: configured.copy ? `${selectedGoogleProvider}-ready` : 'demo', image: configured.image ? `${selectedGoogleProvider}-ready` : 'not-configured', video: configured.video ? 'vertex-ready' : 'not-configured' }, models: MODELS, liveAccessRequired: true, videoNote: 'Veo 3.0 已退役，本專案明確使用 Veo 3.1。' });
      const token = request.headers.get('x-workspace-token') || '';
      if (!/^[0-9a-f]{64}$/.test(token)) throw new ApiError(401, 'WORKSPACE_REQUIRED', '缺少有效的私人工作區識別碼。');
      const owner = await ownerFromToken(token); rate(owner);
      if(request.method==='POST'||request.method==='DELETE')await budget('requests',1,dailyRequestLimit);
      if (route === '/copy' && request.method === 'POST') {
        const input = await readJson(request); exactKeys(input, ['product','language','platform','prompt','mode','sourceDataUrl']);
        const sourceImage = input.sourceDataUrl === undefined ? undefined : parseImage(input.sourceDataUrl);
        const source = typeof input.product === 'string' ? {name:input.product} : object(input.product,'product');
        exactKeys(source,['name','category','description','facts']);
        const facts = source.facts === undefined ? [] : source.facts;
        if (!Array.isArray(facts) || facts.length > 20) throw new ApiError(400,'INVALID_INPUT','商品事實最多 20 項。');
        const product: ProductBrief = { name: str(source.name,'product.name',150), category: str(source.category,'category',100,'general'), description: str(source.description,'description',3000,''), facts: facts.map(v => str(v,'fact',3000)) };
        const language = choice(input.language,LANGUAGES,'language','zh-TW');
        const platform = str(input.platform,'platform',80,'Shopee');
        const prompt = str(input.prompt,'prompt',4000,'');
        const mode = choice(input.mode,['demo','live'],'mode','demo');
        const started = now();
        if (mode === 'live') live(request);
        const provider=mode==='live'?selectedGoogleProvider:'demo';const model=mode==='live'?MODELS.copy:'localized-template-v1';
        const row=record(owner,{type:'copy',status:'pending',provider,model,product,language,platform,prompt});await store.put('jobs',row);
        try{
          const sections = mode === 'live' ? await generateCopy(env,product,language,platform,prompt,fetcher,sourceImage) : demoCopy(product,language);
          const response = { sections, provider, model, durationMs: now()-started, language, warnings: mode === 'demo' ? ['此為可編輯的模擬文案，未呼叫 AI 模型。僅內建示範商品提供已撰寫的多語事實；其他原始事實保留於工作紀錄。'] : [] };
          row.payload={...row.payload,status:'completed',...response};row.updatedAt=iso();await store.put('jobs',row);
          return json({...response,jobId:row.id});
        }catch(error){row.payload={...row.payload,status:'failed',error:{code:error instanceof ApiError?error.code:'UNKNOWN',message:error instanceof ApiError?error.message:'文案生成失敗。'}};row.updatedAt=iso();await store.put('jobs',row);throw error;}
      }
      if (route === '/image' && request.method === 'POST') {
        const input = await readJson(request); exactKeys(input,['sourceDataUrl','prompt','aspectRatio','imageSize']);
        const source = parseImage(input.sourceDataUrl);
        const prompt = str(input.prompt,'prompt',8000);
        const aspectRatio = choice(input.aspectRatio,ASPECT_RATIOS,'aspectRatio','1:1');
        const imageSize = choice(input.imageSize,['1K','2K','4K'],'imageSize','1K'); live(request);
        const row = record(owner,{type:'image',status:'pending',provider:selectedGoogleProvider,model:MODELS.image,prompt,aspectRatio,imageSize}); await store.put('jobs',row);
        const started = now();
        try {
          const result = await generateImage(env,{...source,prompt,aspectRatio,imageSize},fetcher);
          const bytes = decodeOutput(result.base64); const assetId = await asset(owner,bytes,result.mimeType);
          row.payload = {...row.payload,status:'completed',assetId,durationMs:now()-started}; row.updatedAt=iso(); await store.put('jobs',row);
          return json({dataUrl:dataUrl(bytes,result.mimeType),assetId,jobId:row.id,provider:selectedGoogleProvider,model:MODELS.image,durationMs:now()-started,requestedAspectRatio:aspectRatio,requestedImageSize:imageSize});
        } catch (error) { row.payload={...row.payload,status:'failed',error:{code:error instanceof ApiError?error.code:'UNKNOWN',message:error instanceof ApiError?error.message:'生成未完成。'}};row.updatedAt=iso();await store.put('jobs',row);throw error; }
      }
      if (route === '/video' && request.method === 'POST') {
        const input = await readJson(request); exactKeys(input,['sourceDataUrl','prompt','aspectRatio','resolution','durationSeconds']);
        const source = parseImage(input.sourceDataUrl,true); const prompt = str(input.prompt,'prompt',8000);
        const aspectRatio = choice(input.aspectRatio,['16:9','9:16'],'aspectRatio','16:9');
        const resolution = choice(input.resolution,['720p','1080p'],'resolution','720p');
        const durationSeconds = input.durationSeconds === undefined ? 8 : Number(input.durationSeconds);
        if (![4,6,8].includes(durationSeconds)) throw new ApiError(400,'INVALID_INPUT','影片長度僅支援 4、6、8 秒。');
        live(request);
        const row = record(owner,{type:'video',status:'starting',provider:'vertex',model:MODELS.video,prompt,aspectRatio,resolution,durationSeconds}); await store.put('jobs',row);
        try {
          const operationName = await startVideo(env,{...source,prompt,aspectRatio,resolution,durationSeconds},fetcher);
          row.payload={...row.payload,status:'pending',operationName}; row.updatedAt=iso(); const accepted=await store.replaceStatus('jobs',row,'starting');
          if(!accepted){const current=await store.get('jobs',owner,row.id);return json({jobId:row.id,...(current?await publicRow(current):{status:'cancelled'})},202);}
          return json({jobId:row.id,status:'pending',provider:'vertex',model:MODELS.video,pollAfterMs:15000},202);
        } catch (error) { row.payload={...row.payload,status:'failed',error:{code:error instanceof ApiError?error.code:'UNKNOWN',message:error instanceof ApiError?error.message:'影片啟動失敗。'}};row.updatedAt=iso();await store.replaceStatus('jobs',row,'starting');throw error; }
      }
      if (route === '/video' && ['GET','DELETE'].includes(request.method)) {
        const id = uuid(url.searchParams.get('jobId'),'jobId');
        const row = await store.get('jobs',owner,id);
        if (!row || row.payload.type !== 'video') throw new ApiError(404,'NOT_FOUND','找不到影片工作。');
        if (request.method === 'DELETE') {
          if (['pending','starting'].includes(String(row.payload.status))) { const previousStatus=String(row.payload.status);row.payload={...row.payload,status:'cancelled',cancellationNote:'已停止本工作區的輪詢；供應商可能仍會完成任務並計費。'};row.updatedAt=iso();const changed=await store.replaceStatus('jobs',row,previousStatus);if(!changed){const current=await store.get('jobs',owner,id);if(current)return json({jobId:id,...await publicRow(current)});} }
          return json({jobId:id,...await publicRow(row)});
        }
        if (row.payload.status === 'pending') {
          live(request);
          const key=`${owner}/${id}`;
          if (locks.has(key)) return json({jobId:id,status:'pending',pollAfterMs:15000});
          locks.add(key);
          try {
            const result = await pollVideo(env,String(row.payload.operationName),fetcher);
            const latest = await store.get('jobs',owner,id);
            if (latest?.payload.status === 'cancelled') return json({jobId:id,...await publicRow(latest)});
            if (result.status === 'completed' && result.base64) {
              const bytes=decodeOutput(result.base64);const assetId=await asset(owner,bytes,'video/mp4');
              row.payload={...row.payload,status:'completed',assetId,durationMs:now()-new Date(row.createdAt).getTime()};
            } else if(result.status==='failed') row.payload={...row.payload,status:'failed',error:result.error};
            row.updatedAt=iso();const changed=await store.replaceStatus('jobs',row,'pending');
            if(!changed){const current=await store.get('jobs',owner,id);if(current)return json({jobId:id,...await publicRow(current)});}
          } finally {locks.delete(key);}
        }
        return json({jobId:id,...await publicRow(row),pollAfterMs:row.payload.status==='pending'?15000:undefined});
      }
      if (route === '/assets' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['dataUrl']);const image=parseImage(input.dataUrl);
        const id=await asset(owner,image.bytes,image.mimeType);return json({id,mimeType:image.mimeType,bytes:image.bytes.length},201);
      }
      if (route === '/assets' && request.method === 'GET') {
        const id=uuid(url.searchParams.get('id'));const result=await store.assetGet(owner,id);
        if(!result)throw new ApiError(404,'NOT_FOUND','找不到素材。');
        if(url.searchParams.get('format')==='raw')return new Response(result.bytes as unknown as BodyInit,{headers:{...headers,'content-type':result.mimeType,'content-disposition':'attachment'}});
        return json({id,dataUrl:dataUrl(result.bytes,result.mimeType),mimeType:result.mimeType});
      }
      if (route === '/products' && request.method === 'GET') return json({products:await Promise.all((await store.list('products',owner)).map(publicRow))});
      if (route === '/products' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['id','name','category','description','facts','sourceDataUrl','sourceAssetId','metadata']);
        const name=str(input.name,'name',150);const category=str(input.category,'category',100,'general');const description=str(input.description,'description',3000,'');
        const facts=input.facts===undefined?[]:input.facts;if(!Array.isArray(facts)||facts.length>20)throw new ApiError(400,'INVALID_INPUT','商品事實最多 20 項。');
        const checkedFacts=facts.map(v=>str(v,'fact',3000));const metadata=input.metadata?safeJson(input.metadata):{};const suppliedId=input.id?uuid(input.id):undefined;
        const sourceImage=input.sourceDataUrl?parseImage(input.sourceDataUrl):undefined;
        let sourceAssetId=input.sourceAssetId?uuid(input.sourceAssetId,'sourceAssetId'):undefined;
        if(sourceAssetId && !await store.assetGet(owner,sourceAssetId))throw new ApiError(404,'NOT_FOUND','找不到商品來源素材。');
        const old=suppliedId?await store.get('products',owner,suppliedId):null;
        const row=old || record(owner,{});if(suppliedId)row.id=suppliedId;
        let uploaded:string|undefined;
        try{if(sourceImage){uploaded=await asset(owner,sourceImage.bytes,sourceImage.mimeType);sourceAssetId=uploaded;}
        row.payload={name,category,description,facts:checkedFacts,...(sourceAssetId?{sourceAssetId}:{}),metadata};row.updatedAt=iso();await store.put('products',row);
        }catch(error){if(uploaded)try{await store.assetDelete(owner,uploaded);}catch{throw new ApiError(503,'UPLOAD_CLEANUP_REQUIRED','商品未儲存，圖片清理也未完成。請記下 requestId，交由管理者處理。');}throw error;}
        return json({product:await publicRow(row)},old?200:201);
      }
      if (route === '/jobs' && request.method === 'GET') return json({jobs:await Promise.all((await store.list('jobs',owner)).map(publicRow))});
      if (route === '/jobs' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['type','productId','provider','model','settings','outputs','durationMs']);
        const type=choice(input.type,['composition','banner','detail','listing','video-demo'],'type','composition');
        const provider=choice(input.provider,['demo','canvas','openai'],'provider','canvas');
        if(provider==='openai')throw new ApiError(400,'UNVERIFIED_PROVIDER','目前此端點只接受模擬或 Canvas 組版。真實供應商結果由後端建立。');
        const outputs=input.outputs===undefined?[]:input.outputs;if(!Array.isArray(outputs)||outputs.length>30)throw new ApiError(400,'INVALID_INPUT','輸出最多 30 項。');
        const checked=[];for(const item of outputs){const out=safeJson(item,5000);exactKeys(out,['id','assetId','name','width','height','language','format']);if(out.assetId&&!await store.assetGet(owner,uuid(out.assetId,'assetId')))throw new ApiError(404,'NOT_FOUND','找不到輸出素材。');checked.push(out);}
        if(input.productId&&!await store.get('products',owner,uuid(input.productId,'productId')))throw new ApiError(404,'NOT_FOUND','找不到商品。');
        const durationMs=input.durationMs===undefined?0:Number(input.durationMs);if(!Number.isFinite(durationMs)||durationMs<0||durationMs>86400000)throw new ApiError(400,'INVALID_INPUT','durationMs 格式不正確。');
        const row=record(owner,{type,status:'completed',productId:input.productId,provider,model:str(input.model,'model',100,'canvas-compositor-v1'),settings:input.settings?safeJson(input.settings):{},outputs:checked,durationMs});await store.put('jobs',row);return json({job:await publicRow(row)},201);
      }
      throw new ApiError(404,'NOT_FOUND','找不到此 API 路徑。');
    } catch(error) {
      const safe = error instanceof ApiError ? error : new ApiError(500,'INTERNAL_ERROR','服務暫時無法完成操作。',true);
      return json({error:{code:safe.code,message:safe.message,retryable:safe.retryable},requestId},safe.status);
    }
  };
}
