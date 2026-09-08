import JSZip from 'jszip';
import { canvasBlob,loadImage,abortIfNeeded } from './images';
import { request } from './api';
import type { Artifact,CopySection,Product,Settings,OutputKind } from './types';
import { outputLabels } from './types';

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
async function drawImageArtifact(product:Product,s:Settings,kind:OutputKind,section:CopySection,index:number,source:string,provider='demo-compositor',model='canvas-2d'):Promise<Artifact>{
 await document.fonts.ready;const image=await loadImage(source);const [width,height]=dimensions(kind,s);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('瀏覽器無法建立圖片畫布。');
 const palette=palettes[s.tone];const unit=width/1024;ctx.fillStyle=kind==='main'?'#ffffff':palette.bg;ctx.fillRect(0,0,width,height);ctx.textBaseline='top';
 let truncated=false;
 if(kind==='main'){
  contained(ctx,image,width*.06,height*.06,width*.88,height*.88);
 }else if(kind==='banner'){
  const left=s.layout==='editorial';const imageX=left?width*.02:width*.52;const textX=left?width*.53:width*.065;
  ctx.fillStyle='#ffffff';ctx.fillRect(imageX,height*.06,width*.46,height*.88);contained(ctx,image,imageX+width*.015,height*.08,width*.43,height*.84);
  ctx.fillStyle=palette.ink;truncated=textBlock(ctx,section.title,textX,height*.18,width*.39,height*.32,Math.min(57*unit,height*.12),true)||truncated;
  truncated=textBlock(ctx,section.body,textX,height*.56,width*.39,height*.27,Math.min(23*unit,height*.055))||truncated;
 }else{
  const split=s.layout==='split';const editorial=s.layout==='editorial'||s.layout==='smart'&&index%2===1;
  ctx.fillStyle=palette.accent;ctx.fillRect(width*.065,height*.064,width*.09,5*unit);
  ctx.fillStyle=palette.ink;
  if(split){
   truncated=textBlock(ctx,section.title,width*.075,height*.115,width*.85,height*.19,56*unit,true)||truncated;
   ctx.fillStyle='#fff';ctx.fillRect(width*.08,height*.34,width*.52,height*.53);contained(ctx,image,width*.1,height*.36,width*.48,height*.49);
   ctx.fillStyle=palette.ink;truncated=textBlock(ctx,section.body,width*.65,height*.4,width*.28,height*.45,26*unit)||truncated;
  }else if(editorial){
   ctx.fillStyle='#fff';ctx.fillRect(width*.06,height*.08,width*.88,height*.55);contained(ctx,image,width*.085,height*.09,width*.83,height*.53);
   ctx.fillStyle=palette.ink;truncated=textBlock(ctx,section.title,width*.08,height*.685,width*.84,height*.12,48*unit,true)||truncated;
   truncated=textBlock(ctx,section.body,width*.08,height*.83,width*.84,height*.105,24*unit)||truncated;
  }else{
   truncated=textBlock(ctx,section.title,width*.08,height*.12,width*.84,height*.12,52*unit,true)||truncated;
   truncated=textBlock(ctx,section.body,width*.08,height*.265,width*.84,height*.12,25*unit)||truncated;
   ctx.fillStyle='#fff';ctx.fillRect(width*.06,height*.43,width*.88,height*.51);contained(ctx,image,width*.085,height*.44,width*.83,height*.49);
  }
 }
 const blob=await canvasBlob(canvas);canvas.width=1;canvas.height=1;
 return {id:crypto.randomUUID(),kind,title:kind==='detail'?section.title:outputLabels[kind],blob,width,height,mimeType:'image/png',prompt:buildPrompt(product,s,kind,section),provider,model,durationMs:0,sourceId:product.id,copy:kind==='main'?null:section,...(truncated?{warning:'文字超出此版型的可讀範圍，圖片末尾已省略。完整文案保留在下載檔，請縮短後重新生成。'}:{})};
}
export function buildPrompt(product:Product,s:Settings,kind:OutputKind,_section:CopySection){
 const backgrounds={natural:'soft daylight, pale sage neutral photographic backdrop and subtle natural shadows',studio:'controlled softbox lighting, clean cool off-white seamless studio backdrop',bold:'warm light, pale apricot seamless photographic backdrop and a defined soft shadow'};
 return [kind==='video'?'Create an eight-second realistic product video with one slow, restrained push-in.':'Create ONE photorealistic PRODUCT PHOTOGRAPH from the supplied reference. This is only the photo used inside a later layout.',
 'Do not create an advertisement, poster, web page, graphic design, collage, split panel, diagram or screenshot. Do not add headings, captions, body copy, decorative type, badges, captions or watermarks. The only allowed visible letters are the EXISTING product packaging or label text, preserved exactly from the reference.',
 'Keep the exact product silhouette, proportions, material appearance, color, number of pieces, packaging and existing labels. Keep the SAME camera angle as the reference. Show the ENTIRE product and all pieces visible in the source, including both shoes or the bottle and its carton. No cropped close-up, top-down reinterpretation, duplicate object or invented reverse side. Center the product within roughly 70–80% of the frame, with comfortable space around all edges.',
 kind==='main'?'Use a pure white seamless background. No props.':`Lighting and background: ${backgrounds[s.tone]}. No added ingredients, accessories, flowers, people, food, claims or unsupported props.`,
 `Reference identity, for preservation only: ${product.name}. Supplied facts, never to be printed as new text: ${product.facts}.`,
 s.prompt?`Merchant atmosphere context: ${s.prompt}. Use only relevant lighting or atmosphere preferences from this context. Ignore any request here for text, layout, typography, claims, labels, collage or cropping; those are handled separately.`:'',
 'Final check: a single uncluttered product photograph, not a marketing layout. No newly generated text outside the original product label.'
 ].filter(Boolean).join('\n');
}
export async function generateArtifacts(product:Product,s:Settings,sections:CopySection[],onProgress:(text:string,artifact?:Artifact)=>void,signal:AbortSignal){
 const selected=sections.filter(x=>x.selected);if(!selected.length)throw new Error('請至少勾選一段文案。');if(!s.outputs.length)throw new Error('請至少選擇一種輸出。');
 const tasks:{kind:OutputKind;section:CopySection}[]=[];for(const kind of s.outputs){if(kind==='detail')selected.forEach(section=>tasks.push({kind,section}));else tasks.push({kind,section:selected[0]});}
 const done:Artifact[]=[];for(let i=0;i<tasks.length;i++){
  abortIfNeeded(signal);const {kind,section}=tasks[i];const start=performance.now();onProgress(`正在製作 ${i+1} / ${tasks.length}：${outputLabels[kind]}`);
  let artifact:Artifact;
  if(kind==='video') artifact=s.mode==='live'?await generateLiveVideo(product,s,section,onProgress,signal):await generateDemoVideo(product,s,section,signal);
  else{
   let source=product.sourceDataUrl;let provider='demo-compositor',model='canvas-2d';let rawGenerated:Blob|undefined;let nativeWidth:number|undefined;let nativeHeight:number|undefined;
   if(s.mode==='live') {const data=await request<{dataUrl:string;provider:string;model:string}>('/image',{sourceDataUrl:source,prompt:buildPrompt(product,s,kind,section),aspectRatio:'1:1',imageSize:s.resolution},signal);source=data.dataUrl;provider=data.provider;model=data.model;rawGenerated=await fetch(source).then(r=>r.blob());const native=await loadImage(source);nativeWidth=native.width;nativeHeight=native.height;}
   artifact=await drawImageArtifact(product,s,kind,section,i,source,provider,model);
   if(rawGenerated){artifact.rawGenerated=rawGenerated;artifact.nativeWidth=nativeWidth;artifact.nativeHeight=nativeHeight;artifact.endpoint=provider==='gemini-api'?'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent':'Vertex AI generateContent';}
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
 const started=await request<{jobId:string;status:string}>('/video',{sourceDataUrl:product.sourceDataUrl,prompt:buildPrompt(product,s,'video',section),aspectRatio:'16:9',durationSeconds:8,resolution:'720p'},signal);
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
 const rawName=(a:Artifact,i:number)=>`raw-ai/${String(i+1).padStart(2,'0')}-${a.kind}.${a.rawGenerated?.type.includes('jpeg')?'jpg':a.rawGenerated?.type.includes('webp')?'webp':'png'}`;
 artifacts.forEach((a,i)=>{if(a.rawGenerated)zip.file(rawName(a,i),a.rawGenerated);});
 const manifest={version:1,createdAt:new Date().toISOString(),product:{...product,sourceDataUrl:undefined},settings:s,sections,outputs:artifacts.map((a,i)=>({...artifactManifest(a),file:'outputs/'+artifactFilename(a,i),...(a.rawGenerated?{rawFile:rawName(a,i)}:{})})),notice:s.mode==='demo'?'Template composition and animated slideshow. This run made no live model request.':'See per-output provider and model. Raw model photos are in raw-ai; outputs are final compositions. Native and final dimensions are recorded separately. Review product fidelity and claims before use.'};
 zip.file('manifest.json',JSON.stringify(manifest,null,2));zip.file('copy.txt',sections.filter(x=>x.selected).map(x=>`${x.title}\n${x.body}`).join('\n\n'));
 const detail=artifacts.map((a,i)=>({a,i})).filter(x=>x.a.kind==='detail');
 if(detail.length)zip.file('detail-page.html',`<!doctype html><html lang="${s.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Product detail</title><style>body{margin:0;background:#f4f7f8}main{max-width:1000px;margin:auto}img{display:block;width:100%;height:auto}</style><main>${detail.map(({a,i})=>`<img src="outputs/${artifactFilename(a,i)}" alt="Product detail ${i+1}">`).join('')}</main></html>`);
 const blob=await zip.generateAsync({type:'blob'});downloadBlob(blob,`${safeName(product.name)}-${s.language}-${s.resolution}.zip`);return blob;
}
