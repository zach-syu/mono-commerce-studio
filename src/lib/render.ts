import JSZip from 'jszip';
import { canvasBlob,loadImage,abortIfNeeded } from './images';
import { request } from './api';
import type { Artifact,CopySection,Product,Settings,OutputKind } from './types';
import { outputLabels } from './types';
import {composeArtwork} from './artwork';
import {buildStoryboard,buildPhotoPrompt,plannedPhotoCalls,sceneAssetFor} from './storyboard';
import type {ShotPlan} from './storyboard';
import {preparedBenchmarkScene} from './benchmark-assets';

const palettes={natural:{bg:'#eef2e7',ink:'#2c493d',accent:'#a9b99b'},studio:{bg:'#edf1f4',ink:'#243644',accent:'#a7becd'},bold:{bg:'#ffead1',ink:'#683c2d',accent:'#eab279'}};
export function dimensions(kind:OutputKind,s:Settings):[number,number]{const edge=s.resolution==='4K'?4096:s.resolution==='2K'?2048:1024;if(kind==='banner')return [edge,Math.round(edge/(s.bannerRatio==='21:9'?21/9:16/9))];if(kind==='detail')return [Math.round(edge*.75),edge];return [edge,edge];}
function contained(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){const scale=Math.min(w/img.width,h/img.height);const iw=img.width*scale,ih=img.height*scale;ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
function linesFor(ctx:CanvasRenderingContext2D,text:string,width:number){
 const lines:string[]=[];let line='';
 // Word segmentation keeps English words together while CJK can wrap naturally.
 const segments=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter(undefined,{granularity:'word'}).segment(text),x=>x.segment):Array.from(text);
 for(const segment of segments){if(segment==='\n'){lines.push(line.trimEnd());line='';continue;}if(ctx.measureText(line+segment).width>width&&line.trim()){lines.push(line.trimEnd());line='';}if(ctx.measureText(segment).width>width){for(const char of segment){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}}else line+=segment;}if(line.trim())lines.push(line.trimEnd());return lines;
}
function textBlock(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,maxHeight:number,size:number,bold=false){
 const minimum=Math.ceil(size*.8);let fontSize=Math.ceil(size);let lines:string[]=[];while(true){ctx.font=`${bold?'700':'400'} ${fontSize}px "Noto Sans TC", "Hiragino Sans", sans-serif`;lines=linesFor(ctx,text,width);if(lines.length*fontSize*1.5<=maxHeight||fontSize<=minimum)break;fontSize-=1;}
 const maxLines=Math.max(1,Math.floor(maxHeight/(fontSize*1.5)));let truncated=lines.length>maxLines;
 lines.slice(0,maxLines).forEach((line,i)=>{if(truncated&&i===maxLines-1){while(ctx.measureText(line+'…').width>width)line=line.slice(0,-1);line+='…';}ctx.fillText(line,x,y+i*fontSize*1.5);});return truncated;
}
export function buildPrompt(product:Product,s:Settings,kind:OutputKind,section:CopySection){
 if(kind==='video')return `Create an eight-second restrained product reveal. Preserve the supplied product, label and packaging. No added claims or overlay text. Product: ${product.name}.`;
 const shot=buildStoryboard(product,{...s,outputs:[kind]},[{...section,selected:true}])[0];
 return shot?buildPhotoPrompt(product,s,shot):'';
}
export async function renderPlanPreview(product:Product,s:Settings,shot:ShotPlan){
 let source=product.sourceDataUrl;let origin:Artifact['photoOrigin']=shot.role==='detail'?'original-crop':shot.role==='lifestyle'?'context-preview':'original';
 const benchmarkScene=preparedBenchmarkScene(product,shot);const prepared=benchmarkScene?.source||(shot.role==='lifestyle'&&!shot.sceneVariant?sceneAssetFor(product):undefined);
 if(prepared){source=prepared;origin='prepared-scene';shot.focalX=benchmarkScene?.focalX;}
 const result=await composeArtwork(product,s,shot,source,origin,420);return {...result,photoOrigin:origin,photoProvider:benchmarkScene?.provider};
}
export async function generateArtifacts(product:Product,s:Settings,sections:CopySection[],onProgress:(text:string,artifact?:Artifact)=>void,signal:AbortSignal,options:{allowPaid?:boolean}={}){
 const selected=sections.filter(x=>x.selected);if(!selected.length)throw new Error('請至少勾選一段文案。');if(!s.outputs.length)throw new Error('請至少選擇一種輸出。');
 if(selected.length>16)throw new Error('最多選取 16 張詳情圖，請先調整勾選內容。');
 const tasks=buildStoryboard(product,s,sections);
 if(s.mode==='live'&&(plannedPhotoCalls(tasks,s)>0||s.outputs.includes('video'))&&!options.allowPaid)throw new Error('請先確認本次付費生成，或改用免費預覽。');
 const photos=new Map<string,{source:string;provider:string;model:string;raw:Blob;width:number;height:number}>();const done:Artifact[]=[];
 for(let i=0;i<tasks.length;i++){
  abortIfNeeded(signal);const shot=tasks[i];const {kind,section}=shot;const start=performance.now();onProgress(`正在製作 ${i+1} / ${tasks.length}：${shot.purpose}`);
  let artifact:Artifact;
  if(kind==='video')artifact=s.mode==='live'?await generateLiveVideo(product,s,section,onProgress,signal):await generateDemoVideo(product,s,section,signal);
  else{
   let source=product.sourceDataUrl;let origin:Artifact['photoOrigin']=shot.role==='detail'?'original-crop':shot.role==='lifestyle'?'context-preview':'original';let provider=s.mode==='demo'?'demo-compositor':'source-compositor',model='canvas-2d-v3';let raw:Blob|undefined,nativeWidth:number|undefined,nativeHeight:number|undefined,reused=false;let photoAsset:string|undefined;let photoProvider:string|undefined;
   if(s.mode==='live'&&shot.needsNewPhoto&&shot.photoKey){
    let photo=photos.get(shot.photoKey);reused=!!photo;
    if(!photo){const data=await request<{dataUrl:string;provider:string;model:string}>('/image',{sourceDataUrl:product.sourceDataUrl,prompt:buildPhotoPrompt(product,s,shot),aspectRatio:shot.photoAspectRatio,imageSize:s.resolution,allowPaid:true},signal);const blob=await fetch(data.dataUrl).then(r=>r.blob());const image=await loadImage(data.dataUrl);photo={source:data.dataUrl,provider:data.provider,model:data.model,raw:blob,width:image.width,height:image.height};photos.set(shot.photoKey,photo);}
    ({source,provider,model}=photo);raw=photo.raw;nativeWidth=photo.width;nativeHeight=photo.height;origin='generated';
   }else if(shot.role==='lifestyle'){const benchmark=preparedBenchmarkScene(product,shot);const prepared=benchmark?.source||(!shot.sceneVariant?sceneAssetFor(product):undefined);if(prepared){source=prepared;origin='prepared-scene';photoAsset=prepared;photoProvider=benchmark?.provider||'existing-sample';shot.focalX=benchmark?.focalX;const native=await loadImage(prepared);nativeWidth=native.width;nativeHeight=native.height;}}
   const result=await composeArtwork(product,s,shot,source,origin);
   const sourceNote=origin==='context-preview'?'尚未提供新情境照片；此張是原圖構圖示意，不能算作情境照片品質驗收通過。':origin==='prepared-scene'?photoProvider==='conversation-imagegen'?'使用本輪對話生圖的已保存樣張；這次 App 組版沒有呼叫 Google。':'使用既有的範例場景素材，本次沒有呼叫模型。':undefined;
   artifact={id:crypto.randomUUID(),kind,title:kind==='detail'?section.title:outputLabels[kind],blob:result.blob,width:result.width,height:result.height,mimeType:'image/png',prompt:shot.needsNewPhoto?buildPhotoPrompt(product,s,shot):shot.visualGoal,provider,model,durationMs:0,sourceId:product.id,copy:kind==='main'?null:section,visualRole:kind==='banner'?'banner':shot.role,template:shot.template,photoOrigin:origin,photoAsset,photoProvider,nativeWidth,nativeHeight,moduleType:shot.moduleType,sceneVariant:shot.sceneVariant,reusedPhoto:reused,compositionVersion:'storyboard-v3',sourceNote,...(result.warning?{warning:result.warning}:{})};
   if(raw){artifact.rawGenerated=raw;artifact.nativeWidth=nativeWidth;artifact.nativeHeight=nativeHeight;artifact.endpoint=provider==='gemini-api'?'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent':'Vertex AI generateContent';}
  }
  abortIfNeeded(signal);artifact.durationMs=Math.round(performance.now()-start);done.push(artifact);onProgress(`已完成 ${done.length} / ${tasks.length}`,artifact);
 }
 return done;
}
async function generateDemoVideo(product:Product,s:Settings,section:CopySection,signal:AbortSignal):Promise<Artifact>{
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('此瀏覽器不支援示範影片匯出。請使用最新版 Chrome。');
 const image=await loadImage(product.sourceDataUrl);const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('無法建立影片畫布。');
 const candidates=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'];const mimeType=candidates.find(t=>MediaRecorder.isTypeSupported(t));if(!mimeType)throw new Error('此瀏覽器沒有可用的影片編碼器。');
 const stream=canvas.captureStream(24);const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:3500000});const parts:Blob[]=[];const started=performance.now();const palette=palettes[s.tone];
 return new Promise((resolve,reject)=>{
  let timer:ReturnType<typeof setTimeout>;let settled=false;let textTruncated=false;
  const cleanup=()=>{clearTimeout(timer);stream.getTracks().forEach(t=>t.stop());signal.removeEventListener('abort',cancel);};
  const cancel=()=>{if(settled)return;settled=true;if(recorder.state==='recording')recorder.stop();cleanup();reject(new DOMException('已停止製作短片','AbortError'));};
  signal.addEventListener('abort',cancel,{once:true});
  recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
  recorder.onerror=()=>{if(settled)return;settled=true;cleanup();reject(new Error('影片編碼失敗。請重試。'));};
  recorder.onstop=()=>{if(settled)return;settled=true;cleanup();const blob=new Blob(parts,{type:mimeType.split(';')[0]});if(!blob.size){reject(new Error('影片內容為空。請重新製作。'));return;}resolve({id:crypto.randomUUID(),kind:'video',title:'商品動態短片 · 8 秒',blob,width:1280,height:720,mimeType:blob.type,prompt:buildPrompt(product,s,'video',section),provider:'demo-slideshow',model:'browser-mediarecorder',durationMs:8000,sourceId:product.id,copy:section,warning:'示範短片：使用原商品圖製作 8 秒動態排版，無配音。不是 Veo 生成。'+(textTruncated?' 文字超出可讀範圍，畫面已省略部分內容；全文保留於下載包，請縮短後重做。':'')});};
  const frame=()=>{if(settled)return;const t=Math.min((performance.now()-started)/8000,1);ctx.fillStyle=palette.bg;ctx.fillRect(0,0,1280,720);ctx.textBaseline='top';ctx.fillStyle=palette.ink;textTruncated=textBlock(ctx,section.title,76,180,470,210,52,true)||textTruncated;textTruncated=textBlock(ctx,section.body,76,420,470,180,26)||textTruncated;const zoom=1+t*.08;ctx.save();ctx.translate(925,360);ctx.scale(zoom,zoom);contained(ctx,image,-280,-300,560,600);ctx.restore();ctx.fillStyle=palette.accent;ctx.fillRect(76,138,80,5);if(t<1)timer=setTimeout(frame,1000/24);else if(recorder.state==='recording')recorder.stop();};
  frame();recorder.start(250);
 });
}
async function generateLiveVideo(product:Product,s:Settings,section:CopySection,onProgress:(text:string)=>void,signal:AbortSignal):Promise<Artifact>{
 const started=await request<{jobId:string;status:string}>('/video',{sourceDataUrl:product.sourceDataUrl,prompt:buildPrompt(product,s,'video',section),aspectRatio:'16:9',durationSeconds:8,resolution:'720p',allowPaid:true},signal);
 for(let i=0;i<60;i++){
  abortIfNeeded(signal);await new Promise<void>((resolve,reject)=>{const cancel=()=>{clearTimeout(timer);reject(new DOMException('已停止等待影片','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},15000);signal.addEventListener('abort',cancel,{once:true});});
  const state=await request<{status:string;assetId?:string;error?:{code:string;message:string};model?:string}>('/video?jobId='+encodeURIComponent(started.jobId),undefined,signal);onProgress(`Veo 3.1 正在製作影片，已等待 ${(i+1)*15} 秒`);
  if(state.status==='failed'||state.status==='cancelled')throw new Error(state.error?.message||'影片生成未完成。請在模型設定中檢查服務狀態。');
  if(state.status==='completed'&&state.assetId){const media=await request<{dataUrl:string}>('/assets?id='+encodeURIComponent(state.assetId),undefined,signal);const response=await fetch(media.dataUrl,{signal});if(!response.ok)throw new Error('影片已生成，但下載失敗。請重試。');const blob=await response.blob();return {id:started.jobId,kind:'video',title:'Veo 3.1 商品短片',blob,width:1280,height:720,mimeType:blob.type||'video/mp4',prompt:buildPrompt(product,s,'video',section),provider:'vertex',model:state.model||'veo-3.1-generate-001',durationMs:0,sourceId:product.id,copy:section};}
 }
 throw new Error('影片仍在處理。工作編號：'+started.jobId+'。稍後可使用後端工作狀態查詢。');
}
function safeName(value:string){return value.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)||'product';}
export function artifactFilename(a:Artifact,index=0){return `${String(index+1).padStart(2,'0')}-${a.kind}-${a.width}x${a.height}.${a.mimeType.includes('webm')?'webm':a.mimeType.includes('video')?'mp4':'png'}`;}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function artifactManifest(a:Artifact){const {blob,previewUrl,rawGenerated,...metadata}=a;return {...metadata,bytes:blob.size,...(rawGenerated?{rawGenerated:{bytes:rawGenerated.size,mimeType:rawGenerated.type,width:a.nativeWidth,height:a.nativeHeight}}:{})};}
export async function downloadBundle(product:Product,s:Settings,sections:CopySection[],artifacts:Artifact[]){
 if(!artifacts.length)throw new Error('還沒有可下載的素材。');const zip=new JSZip();
 const original=await fetch(product.sourceDataUrl).then(r=>r.blob());zip.file('source/original.'+(original.type.includes('jpeg')?'jpg':original.type.includes('webp')?'webp':'png'),original);
 artifacts.forEach((a,i)=>zip.file('outputs/'+artifactFilename(a,i),a.blob));
 const sceneSources=[...new Set(artifacts.map(a=>a.photoAsset).filter((x):x is string=>!!x))];
 for(const [i,url] of sceneSources.entries()){const response=await fetch(url);if(!response.ok)throw new Error('場景原檔下載失敗，請重試。');zip.file(`scene-sources/${String(i+1).padStart(2,'0')}-${url.split('/').slice(-2).join('-')}`,await response.blob());}
 const rawName=(a:Artifact,i:number)=>`raw-ai/${String(i+1).padStart(2,'0')}-${a.kind}.${a.rawGenerated?.type.includes('jpeg')?'jpg':a.rawGenerated?.type.includes('webp')?'webp':'png'}`;
 artifacts.forEach((a,i)=>{if(a.rawGenerated)zip.file(rawName(a,i),a.rawGenerated);});
 const manifest={version:1,createdAt:new Date().toISOString(),product:{...product,sourceDataUrl:undefined},settings:s,sections,outputs:artifacts.map((a,i)=>({...artifactManifest(a),file:'outputs/'+artifactFilename(a,i),...(a.rawGenerated?{rawFile:rawName(a,i)}:{})})),notice:s.mode==='demo'?'Free purpose-driven composition. Original photos, original-photo crops, and explicitly labelled prepared scene fixtures. This run made no live model request.':'See per-output provider and model. Raw model photos are in raw-ai; outputs are final compositions. Native and final dimensions are recorded separately. Review product fidelity and claims before use.'};
 zip.file('manifest.json',JSON.stringify(manifest,null,2));zip.file('copy.txt',sections.filter(x=>x.selected).map(x=>`${x.title}\n${x.body}`).join('\n\n'));
 const detail=artifacts.map((a,i)=>({a,i})).filter(x=>x.a.kind==='detail');
 if(detail.length)zip.file('detail-page.html',`<!doctype html><html lang="${s.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Product detail</title><style>body{margin:0;background:#f4f7f8}main{max-width:1000px;margin:auto}img{display:block;width:100%;height:auto}</style><main>${detail.map(({a,i})=>`<img src="outputs/${artifactFilename(a,i)}" alt="Product detail ${i+1}">`).join('')}</main></html>`);
 const blob=await zip.generateAsync({type:'blob'});downloadBlob(blob,`${safeName(product.name)}-${s.language}-${s.resolution}.zip`);return blob;
}
