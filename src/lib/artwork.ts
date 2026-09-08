import {canvasBlob,loadImage} from './images';
import type {CopySection,Product,Settings,Artifact} from './types';
import type {ShotPlan} from './storyboard';
import {drawInfographic} from './infographics';

export interface Palette {paper:string;bg:string;soft:string;ink:string;muted:string;accent:string;dark:string}
const toneColors={natural:'#567454',studio:'#577787',bold:'#b65a36'};
const mix=(a:string,b:string,amount:number)=>{const parse=(v:string)=>[1,3,5].map(n=>parseInt(v.slice(n,n+2),16));const aa=parse(a),bb=parse(b);return '#'+aa.map((v,i)=>Math.round(v*(1-amount)+bb[i]*amount).toString(16).padStart(2,'0')).join('');};
export function artworkDimensions(plan:ShotPlan,s:Settings):[number,number]{const edge=s.resolution==='4K'?4096:s.resolution==='2K'?2048:1024;return plan.kind==='banner'?[edge,Math.round(edge/(s.bannerRatio==='21:9'?21/9:16/9))]:plan.kind==='detail'?[Math.round(edge*.75),edge]:[edge,edge];}
async function palette(product:Product,s:Settings):Promise<Palette>{
 let accent=toneColors[s.tone];
 if(s.layout==='smart'){
  const source=await loadImage(product.sourceDataUrl);const small=document.createElement('canvas');small.width=48;small.height=48;const ctx=small.getContext('2d')!;ctx.drawImage(source,0,0,48,48);
  const pixels=ctx.getImageData(0,0,48,48).data;const bins=new Map<string,{count:number,r:number,g:number,b:number}>();
  for(let i=0;i<pixels.length;i+=4){const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];const hi=Math.max(r,g,b),lo=Math.min(r,g,b);if(hi-lo<32||hi<55||lo>218||pixels[i+3]<200)continue;const key=[r,g,b].map(v=>Math.floor(v/32)).join(',');const entry=bins.get(key)||{count:0,r:0,g:0,b:0};entry.count++;entry.r+=r;entry.g+=g;entry.b+=b;bins.set(key,entry);}
  const dominant=[...bins.values()].sort((a,b)=>b.count-a.count)[0];if(dominant&&dominant.count>=4)accent='#'+[dominant.r,dominant.g,dominant.b].map(v=>Math.round(v/dominant.count).toString(16).padStart(2,'0')).join('');
  const referenceAccents:Record<string,string>={philips:'#0878bb',ts6:'#b86799',jsmix:'#247db5',magforce:'#71613e',supplement:'#344c9d',zhuji:'#a4272d',shoes:'#658069'};
  if(product.sourceOrigin==='benchmark'&&product.benchmarkId&&referenceAccents[product.benchmarkId])accent=referenceAccents[product.benchmarkId];
  small.width=1;small.height=1;
 }
 return {paper:'#ffffff',bg:mix(accent,'#ffffff',.94),soft:mix(accent,'#ffffff',.83),ink:mix(accent,'#131a20',.78),muted:'#56616b',accent:mix(accent,'#25303a',.18),dark:mix(accent,'#142029',.38)};
}
export function wrapText(ctx:CanvasRenderingContext2D,text:string,width:number){
 const segments=Array.from(new Intl.Segmenter(undefined,{granularity:'word'}).segment(text),s=>s.segment);const lines:string[]=[];let line='';
 for(const part of segments){if(part.includes('\n')){if(line.trim())lines.push(line.trim());line='';continue;}if(ctx.measureText(line+part).width>width&&line.trim()){lines.push(line.trim());line='';}if(ctx.measureText(part).width>width){for(const char of part){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}}else line+=part;}if(line.trim())lines.push(line.trim());return lines;
}
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,w:number,h:number,size:number,color:string,weight=400){
 let font=Math.ceil(size);let lines:string[]=[];const min=Math.ceil(size*.86);while(true){ctx.font=`${weight} ${font}px "Noto Sans TC", "Hiragino Sans", sans-serif`;lines=wrapText(ctx,value,w);if(lines.length*font*1.42<=h||font<=min)break;font--;}
 const max=Math.max(1,Math.floor(h/(font*1.42)));const clipped=lines.length>max;ctx.fillStyle=color;ctx.textBaseline='top';
 lines.slice(0,max).forEach((line,i)=>{if(clipped&&i===max-1){while(line&&ctx.measureText(line+'…').width>w)line=line.slice(0,-1);line+='…';}ctx.fillText(line,x,y+i*font*1.42);});return clipped;
}
function contain(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){const scale=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);}
function crop(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number,focus:'upper'|'center'|'lower',zoom=1.8){const ratio=w/h;let sw=img.width/zoom,sh=sw/ratio;if(sh>img.height/zoom){sh=img.height/zoom;sw=sh*ratio;}const sx=(img.width-sw)*.5;const sy=(img.height-sh)*(focus==='upper'?.14:focus==='lower'?.84:.52);ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
function panel(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,radius=0){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();}
function rule(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,color:string){ctx.fillStyle=color;ctx.fillRect(x,y,w,1.5);}
const labels={
 'zh-TW':{hero:'商品主視覺',benefits:'商品重點',detail:'原圖細節',lifestyle:'日常情境',specs:'商品資訊',crop:'原圖局部放大',context:'情境排版示意',name:'商品',category:'類型',provided:'已提供資訊',missing:'未提供',check:'規格以實際商品標示為準',food:'食品',beauty:'美妝保健',fashion:'服裝配件'},
 en:{hero:'THE COLLECTION',benefits:'AT A GLANCE',detail:'A CLOSER LOOK',lifestyle:'IN YOUR EVERYDAY',specs:'PRODUCT NOTES',crop:'Cropped from the original photo',context:'Concept layout',name:'Product',category:'Category',provided:'Provided details',missing:'Not provided',check:'Check the actual product label for specifications',food:'Food',beauty:'Beauty & wellness',fashion:'Apparel & accessories'},
 ja:{hero:'商品コレクション',benefits:'商品のポイント',detail:'細部を見る',lifestyle:'日常のシーン',specs:'商品情報',crop:'元の写真の一部を拡大',context:'シーン構成のイメージ',name:'商品',category:'カテゴリー',provided:'提供された情報',missing:'未入力',check:'仕様は実際の商品表示をご確認ください',food:'食品',beauty:'美容・健康',fashion:'衣料品・アクセサリー'},
 ko:{hero:'제품 컬렉션',benefits:'제품 포인트',detail:'디테일 보기',lifestyle:'일상 속 장면',specs:'제품 정보',crop:'원본 사진의 일부 확대',context:'장면 구성 예시',name:'제품',category:'카테고리',provided:'제공된 정보',missing:'미제공',check:'규격은 실제 제품 표시를 확인하세요',food:'식품',beauty:'뷰티・건강',fashion:'의류・액세서리'}
};
function displayName(product:Product,language:Settings['language']){if(language==='zh-TW')return product.name;const names:Record<string,string>={'MORI 焙茶':'MORI Roasted Tea','SORA 日常精華':'SORA Daily Serum','PLAIN 日常休閒鞋':'PLAIN Everyday Sneakers'};return names[product.name]||product.name;}
function points(body:string){const sentences=body.split(/\n+|(?<=[。！？.!?])\s*/u).filter(s=>s.trim()).map(s=>s.trim());if(sentences.length<=3)return sentences.length?sentences:[body];return [sentences[0],sentences[1],sentences.slice(2).join(' ')];}
function specs(product:Product,s:Settings,section:CopySection){
 const l=labels[s.language];const extra:Record<string,Record<string,string>>={'zh-TW':{bag:'背包',electronics:'3C 與家電',supplement:'保健食品'},en:{bag:'Bags',electronics:'Electronics & appliances',supplement:'Supplements'},ja:{bag:'バッグ',electronics:'電子機器・家電',supplement:'サプリメント'},ko:{bag:'가방',electronics:'전자기기・가전',supplement:'건강보조식품'}};const category=product.category in l?l[product.category as 'food'|'beauty'|'fashion']:extra[s.language][product.category];const result:[string,string][]=[[l.name,displayName(product,s.language)],[l.category,category]];
 // Preserve supplied facts only. Unknown fields stay unknown; never extract a measurement from the picture.
 const provided=s.language==='zh-TW'?product.facts:section.body;
 for(const piece of provided.split(/[\n；;。]+/).filter(Boolean).slice(0,6)){const pair=piece.split(/[:：]/);result.push(pair.length>1?[pair.shift()!.trim(),pair.join(':').trim()]:[l.provided,piece.trim()]);}
 if(result.length===2)result.push([l.provided,l.missing]);return result.slice(0,7);
}
function contextBackdrop(ctx:CanvasRenderingContext2D,w:number,h:number,p:Palette,category:Product['category']){
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,p.paper);g.addColorStop(1,p.soft);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 if(category==='beauty'){ctx.strokeStyle=p.soft;ctx.lineWidth=2;for(let y=0;y<h*.75;y+=h*.14){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.beginPath();ctx.roundRect(w*.44,h*.04,w*.47,h*.56,w*.23);ctx.stroke();}
 else if(category==='food'){ctx.fillStyle=p.soft;ctx.beginPath();ctx.ellipse(w*.78,h*.24,w*.45,h*.45,-.3,0,Math.PI*2);ctx.fill();}
 else{ctx.fillStyle=p.soft;ctx.beginPath();ctx.moveTo(w*.1,0);ctx.lineTo(w*.65,0);ctx.lineTo(w*.95,h*.75);ctx.lineTo(w*.4,h*.75);ctx.fill();}
 panel(ctx,0,h*.68,w,h*.13,mix(p.accent,'#ffffff',.72));rule(ctx,0,h*.68,w,mix(p.accent,'#ffffff',.52));
}

export async function composeArtwork(product:Product,s:Settings,shot:ShotPlan,source:string,photoOrigin:Artifact['photoOrigin'],previewEdge?:number){
 await document.fonts.ready;const [image,p]=await Promise.all([loadImage(source),palette(product,s)]);const original=source===product.sourceDataUrl?image:await loadImage(product.sourceDataUrl);let [width,height]=artworkDimensions(shot,s);
 if(previewEdge){const ratio=previewEdge/Math.max(width,height);width=Math.round(width*ratio);height=Math.round(height*ratio);}
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('無法建立圖片畫布。');
 const u=width/1024;ctx.scale(u,u);const w=1024,h=height/u,m=68;const l=labels[s.language];let clipped=false;const put=(value:string,x:number,y:number,bw:number,bh:number,size:number,color=p.ink,bold=false)=>{clipped=text(ctx,value,x,y,bw,bh,size,color,bold?700:400)||clipped;};
 panel(ctx,0,0,w,h,p.bg);const title=shot.section.title;const body=shot.section.body;
 if(shot.kind==='detail'&&shot.moduleType&&drawInfographic({ctx,p,w,h,put,contain,original,product,settings:s,section:shot.section,moduleType:shot.moduleType})){
  // Native diagrams keep all copy editable and preserve the source photograph.
 }else if(shot.role==='packshot'){
  panel(ctx,0,0,w,h,p.paper);contain(ctx,original,w*.045,h*.045,w*.91,h*.91);
 }else if(shot.kind==='banner'){
  const reverse=s.layout==='editorial';const photoX=reverse?0:w*.47;const copyX=reverse?w*.56:m;const photoW=w*.53;
  panel(ctx,photoX,0,photoW,h,p.soft);ctx.fillStyle=p.accent;ctx.beginPath();ctx.arc(photoX+photoW*.6,h*.48,h*.58,0,Math.PI*2);ctx.globalAlpha=.1;ctx.fill();ctx.globalAlpha=1;
  contain(ctx,image,photoX,h*.03,photoW,h*.94);put(l.hero,copyX,h*.10,w*.34,h*.09,Math.min(19,h*.045),p.accent,true);
  put(title,copyX,h*.25,w*.40,h*.40,Math.min(50,h*.12),p.ink,true);put(body,copyX,h*.70,w*.37,h*.23,Math.min(25,h*.057),p.muted);
  rule(ctx,copyX,h*.91,w*.08,p.accent);
 }else if(shot.role==='hero'){
  panel(ctx,0,0,w*.028,h,p.accent);put(l.hero,m,h*.055,w*.82,h*.06,22,p.accent,true);
  put(title,m,h*.13,w*.83,h*.18,76,p.ink,true);put(body,m,h*.325,w*.74,h*.115,30,p.muted);
  panel(ctx,w*.055,h*.49,w*.89,h*.46,p.soft,20);ctx.save();ctx.globalAlpha=.13;ctx.fillStyle=p.accent;ctx.beginPath();ctx.ellipse(w*.56,h*.91,w*.38,h*.045,0,0,Math.PI*2);ctx.fill();ctx.restore();
  contain(ctx,image,w*.075,h*.43,w*.87,h*.51);rule(ctx,m,h*.96,w*.10,p.accent);
 }else if(shot.role==='benefits'){
  const items=points(body);const top=items.length===1?h*.66:items.length===2?h*.58:h*.49;const photoSize=items.length===1?440:380;const px=w-photoSize-m,py=Math.max(85,top*.52-photoSize*.35);
  panel(ctx,0,0,w,top,p.dark);put(l.benefits,m,h*.045,w*.85,h*.055,22,'#ffffff',true);put(title,m,top*.24,w*.43,top*.43,61,'#ffffff',true);
  panel(ctx,px,py,photoSize,photoSize,p.paper,12);contain(ctx,original,px,py,photoSize,photoSize);put(displayName(product,s.language),m,top*.84,w*.44,top*.11,23,'#ffffff');
  const gap=16;const start=top+38;const available=h-start-m;const rowH=(available-gap*(items.length-1))/items.length;
  items.forEach((item,i)=>{const y=start+i*(rowH+gap);panel(ctx,m,y,w-2*m,rowH,p.paper,10);panel(ctx,m,y,7,rowH,p.accent,3);put(item,m+30,y+Math.max(17,rowH*.19),w-2*m-60,rowH*.70,items.length===1?36:30,p.ink,items.length===1);});
 }else if(shot.moduleType==='material'){
  panel(ctx,0,0,w,h,p.dark);put(l.detail,m,h*.046,w*.86,h*.05,22,'#ffffff',true);put(title,m,h*.115,w*.86,h*.15,64,'#ffffff',true);
  crop(ctx,original,m,h*.32,w-2*m,h*.39,'center',1.3);put(l.crop,m,h*.73,w*.85,h*.045,19,'#ffffff');
  panel(ctx,m,h*.80,w-2*m,h*.15,p.paper,12);put(body,m+26,h*.823,w-2*m-52,h*.105,27,p.ink);
 }else if(shot.role==='detail'){
  panel(ctx,0,0,w,h,p.paper);put(l.detail,m,h*.045,w*.85,h*.05,22,p.accent,true);put(title,m,h*.11,w*.84,h*.15,60,p.ink,true);
  const y=h*.31,photoH=h*.46;const focus=shot.section.detailFocus||'center';
  crop(ctx,original,m,y,w*.52,photoH,focus,1.65);crop(ctx,original,w*.62,y,w*.315,photoH*.48,focus==='upper'?'center':'upper',2.4);crop(ctx,original,w*.62,y+photoH*.52,w*.315,photoH*.48,focus==='lower'?'center':'lower',2.2);
  put(l.crop,m,h*.79,w*.86,h*.045,19,p.accent);put(body,m,h*.855,w*.86,h*.105,30,p.muted);
 }else if(shot.role==='lifestyle'){
  if((photoOrigin==='prepared-scene'||photoOrigin==='generated')&&image.width/image.height>1.05){
   panel(ctx,0,0,w,h,p.paper);panel(ctx,0,0,w,h*.16,p.dark);put(l.lifestyle,m,h*.032,w*.86,h*.033,20,'#ffffff',true);put(title,m,h*.078,w*.86,h*.072,43,'#ffffff',true);
   const photoH=w*image.height/image.width;ctx.drawImage(image,0,h*.16,w,photoH);const bottom=h*.16+photoH;
   contain(ctx,original,m,bottom+25,240,h-bottom-60);put(body,350,bottom+45,w-418,h-bottom-70,29,p.ink);put(l.name,m,h*.955,w*.3,35,17,p.muted);
  }else{
  if(photoOrigin==='prepared-scene'||photoOrigin==='generated'){
   const scale=Math.max(w/image.width,h/image.height);const iw=image.width*scale,ih=image.height*scale;ctx.drawImage(image,-(iw-w)*(shot.focalX??.5),-(ih-h)*.5,iw,ih);
   const shade=ctx.createLinearGradient(0,h*.50,0,h);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(8,17,24,.87)');ctx.fillStyle=shade;ctx.fillRect(0,h*.5,w,h*.5);
  }else{contextBackdrop(ctx,w,h,p,product.category);contain(ctx,original,w*.085,h*.07,w*.83,h*.67);put(l.context,m,h*.045,w*.8,h*.05,18,p.muted);}
  if(photoOrigin!=='prepared-scene'&&photoOrigin!=='generated')panel(ctx,0,h*.735,w,h*.265,p.dark);put(l.lifestyle,m,h*.755,w*.85,h*.04,20,'#ffffff',true);put(title,m,h*.80,w*.86,h*.105,49,'#ffffff',true);put(body,m,h*.92,w*.86,h*.065,25,'#ffffff');
  }
 }else{
  panel(ctx,0,0,w,h,p.paper);put(l.specs,m,h*.052,w*.5,h*.06,22,p.accent,true);put(title,m,h*.126,w*.52,h*.19,58,p.ink,true);contain(ctx,original,w*.64,h*.05,w*.29,h*.26);
  const rows=specs(product,s,shot.section);const start=h*.37;const tableH=h*.47;const rowH=tableH/rows.length;
  rows.forEach(([name,value],i)=>{const y=start+i*rowH;if(i%2===0)panel(ctx,m,y,w-2*m,rowH,p.bg);rule(ctx,m,y,w-2*m,p.soft);put(name,m+20,y+rowH*.2,w*.21,rowH*.66,25,p.muted);put(value,w*.33,y+rowH*.18,w*.58,rowH*.7,27,p.ink,i===0);});rule(ctx,m,start+tableH,w-2*m,p.soft);put(l.check,m,h*.89,w*.85,h*.07,22,p.muted);
 }
 const blob=await canvasBlob(canvas);canvas.width=1;canvas.height=1;
 return {blob,width,height,warning:clipped?'文字超出此模組的可讀範圍，部分內容已省略。完整文案保留在下載檔，請縮短後重新預覽。':undefined};
}
