import type {Product,Settings,CopySection} from './types';
import type {Palette} from './artwork';
import type {ModuleType} from '../../shared/visual-planning';

type Put=(value:string,x:number,y:number,width:number,height:number,size:number,color?:string,bold?:boolean)=>void;
type Contain=(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number)=>void;
interface Input {ctx:CanvasRenderingContext2D;p:Palette;w:number;h:number;put:Put;contain:Contain;original:HTMLImageElement;product:Product;settings:Settings;section:CopySection;moduleType:ModuleType;}
function box(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,r=14){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function line(c:CanvasRenderingContext2D,x:number,y:number,xx:number,yy:number,color:string,width=3){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
function arrow(c:CanvasRenderingContext2D,x:number,y:number,xx:number,yy:number,color:string){line(c,x,y,xx,yy,color,3);const a=Math.atan2(yy-y,xx-x);c.fillStyle=color;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-16*Math.cos(a-.45),yy-16*Math.sin(a-.45));c.lineTo(xx-16*Math.cos(a+.45),yy-16*Math.sin(a+.45));c.closePath();c.fill();}
function icon(c:CanvasRenderingContext2D,kind:string,x:number,y:number,size:number,color:string){
 c.save();c.translate(x,y);c.scale(size/100,size/100);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=3;c.lineCap='round';c.lineJoin='round';
 const stroke=(draw:()=>void)=>{c.beginPath();draw();c.stroke();};
 if(kind==='leaf'){stroke(()=>{c.moveTo(18,81);c.bezierCurveTo(3,22,54,9,83,12);c.bezierCurveTo(89,66,48,91,18,81);c.moveTo(18,81);c.lineTo(67,31);c.moveTo(40,58);c.lineTo(40,35);c.moveTo(40,58);c.lineTo(63,58);});}
 else if(kind==='flower'){for(let i=0;i<7;i++){c.save();c.translate(50,48);c.rotate(i*Math.PI*2/7);stroke(()=>c.ellipse(0,-21,9,18,0,0,Math.PI*2));c.restore();}stroke(()=>c.arc(50,48,10,0,Math.PI*2));}
 else if(kind==='molecule'){for(const [a,b] of [[[22,30],[55,50]],[[55,50],[75,23]],[[55,50],[70,83]],[[22,30],[15,69]]] as number[][][])line(c,a[0],a[1],b[0],b[1],color,3);for(const [xx,yy] of [[22,30],[55,50],[75,23],[70,83],[15,69]])stroke(()=>c.arc(xx,yy,9,0,Math.PI*2));}
 else if(kind==='corn'){stroke(()=>{c.ellipse(52,43,18,31,.2,0,Math.PI*2);c.moveTo(31,45);c.quadraticCurveTo(15,50,50,91);c.quadraticCurveTo(86,59,77,40);});for(let yy=25;yy<65;yy+=12)line(c,39,yy,65,yy,color,2);line(c,50,13,52,72,color,2);}
 else if(kind==='pot'){stroke(()=>{c.roundRect(18,43,64,38,8);c.moveTo(12,42);c.lineTo(88,42);c.moveTo(30,18);c.bezierCurveTo(21,28,37,28,30,37);c.moveTo(51,9);c.bezierCurveTo(42,20,59,23,51,35);c.moveTo(71,16);c.bezierCurveTo(62,26,79,26,71,37);});line(c,7,50,18,50,color);line(c,82,50,93,50,color);}
 else if(kind==='plate'){stroke(()=>{c.ellipse(54,56,31,23,0,0,Math.PI*2);c.ellipse(54,56,21,14,0,0,Math.PI*2);c.moveTo(13,16);c.lineTo(13,84);c.moveTo(7,16);c.lineTo(7,36);c.lineTo(19,36);c.lineTo(19,16);});}
 else if(kind==='water'){stroke(()=>{c.moveTo(25,20);c.lineTo(76,20);c.lineTo(67,86);c.lineTo(34,86);c.closePath();c.moveTo(29,45);c.bezierCurveTo(44,34,54,55,72,43);});}
 else if(kind==='ruler'){stroke(()=>c.roundRect(10,35,80,29,3));for(let xx=20;xx<=80;xx+=10)line(c,xx,35,xx,xx%20===0?54:47,color,2);}
 else if(kind==='bag'){stroke(()=>{c.roundRect(23,26,54,63,13);c.moveTo(38,26);c.quadraticCurveTo(35,7,63,14);c.lineTo(64,26);c.roundRect(32,59,36,22,5);c.moveTo(27,44);c.lineTo(73,44);});}
 else if(kind==='shirt'){stroke(()=>{c.moveTo(36,17);c.quadraticCurveTo(50,35,65,17);c.lineTo(87,32);c.lineTo(76,50);c.lineTo(70,47);c.lineTo(70,87);c.lineTo(30,87);c.lineTo(30,47);c.lineTo(24,50);c.lineTo(12,32);c.closePath();});}
 else if(kind==='laptop'){stroke(()=>{c.roundRect(18,18,64,49,5);c.moveTo(18,67);c.lineTo(8,80);c.lineTo(93,80);c.lineTo(82,67);c.moveTo(43,75);c.lineTo(58,75);});}
 else if(kind==='filter'){stroke(()=>c.roundRect(19,14,62,74,5));for(let xx=29;xx<78;xx+=10)line(c,xx,20,xx,81,color,2);}
 else if(kind==='control'){stroke(()=>{c.arc(50,50,34,0,Math.PI*2);c.moveTo(50,27);c.lineTo(50,52);c.moveTo(37,34);c.arc(50,51,20,-2.3,5.45);});}
 else if(kind==='snow'){for(let a=0;a<6;a++){c.save();c.translate(50,50);c.rotate(a*Math.PI/3);line(c,0,0,0,-37,color);line(c,0,-24,-9,-31,color);line(c,0,-24,9,-31,color);c.restore();}}
 else{stroke(()=>{c.roundRect(23,12,55,76,4);c.moveTo(34,29);c.lineTo(67,29);c.moveTo(34,43);c.lineTo(67,43);c.moveTo(34,57);c.lineTo(67,57);c.moveTo(34,71);c.lineTo(56,71);});}
 c.restore();
}
const words:Record<string,Record<string,string>>={
 'zh-TW':{schema:'功能／資訊示意',facts:'依已提供資料編排',missing:'請補充商品資料',input:'偵測',process:'過濾',output:'循環',source:'原圖作為商品識別',measure:'尺寸標示位置示意',fit:'實際規格與適用性，請依商品資訊確認',step1:'先看商品標示',step2:'依用途使用',step3:'使用後妥善保存',food1:'確認保存方式',food2:'依包裝指示烹調',food3:'盛盤享用',bag1:'確認物品尺寸',bag2:'安排收納',bag3:'調整背負',fashion1:'確認尺寸',fashion2:'檢查穿著比例',fashion3:'依洗標保養',dimension:'尺寸／容量',detail:'參考原圖的實際細節'},
 en:{schema:'SCHEMATIC GUIDE',facts:'Based on supplied information',missing:'Product details required',input:'SENSE',process:'FILTER',output:'CIRCULATE',source:'Original product reference',measure:'Dimension guide',fit:'Check the actual specifications and suitability',step1:'Check the product label',step2:'Follow its directions',step3:'Store and care for it',food1:'Check storage guidance',food2:'Follow package cooking steps',food3:'Serve and enjoy',bag1:'Check the fit',bag2:'Organize your carry',bag3:'Adjust the straps',fashion1:'Check the size',fashion2:'Consider the fit',fashion3:'Follow the care label',dimension:'SIZE / CAPACITY',detail:'Actual details from the reference'},
 ja:{schema:'機能・情報の概念図',facts:'提供された情報に基づく構成',missing:'商品情報を追加してください',input:'検知',process:'ろ過',output:'循環',source:'元の商品写真',measure:'寸法の表示位置',fit:'実際の仕様と適合をご確認ください',step1:'商品表示を確認',step2:'説明に沿って使用',step3:'適切に保管',food1:'保存方法を確認',food2:'包装の調理説明に従う',food3:'盛り付けて楽しむ',bag1:'サイズを確認',bag2:'持ち物を整理',bag3:'ストラップを調整',fashion1:'サイズを確認',fashion2:'着用バランスを確認',fashion3:'洗濯表示に従う',dimension:'寸法・容量',detail:'参考写真に写る実際の細部'},
 ko:{schema:'기능・정보 개념도',facts:'제공된 정보를 바탕으로 구성',missing:'제품 정보를 추가하세요',input:'감지',process:'필터',output:'순환',source:'원본 제품 사진',measure:'치수 표시 위치',fit:'실제 제품 사양을 확인하세요',step1:'제품 표시 확인',step2:'안내에 따라 사용',step3:'올바르게 보관',food1:'보관 방법 확인',food2:'포장 조리법 따르기',food3:'담아서 즐기기',bag1:'크기 확인',bag2:'소지품 정리',bag3:'끈 조절',fashion1:'사이즈 확인',fashion2:'착용 비율 확인',fashion3:'세탁 표시 따르기',dimension:'크기・용량',detail:'원본 사진의 실제 디테일'}
};
function infoItems(section:CopySection,missing:string){const points=(section.evidencePoints?.length?section.evidencePoints:section.body.split(/[\n。；]+/)).filter(Boolean);return points.length?points:[missing];}
export function drawInfographic(v:Input):boolean{
 const {ctx:c,p,w,h,put,contain,original,product,settings:s,section,moduleType:type}=v;
 if(!['ingredients','mechanism','steps','size','contents','comparison','care'].includes(type))return false;
 const l=words[s.language]||words['zh-TW'];const m=68,items=infoItems(section,l.missing);
 box(c,0,0,w,h,p.paper,0);box(c,0,0,w,h*.20,p.dark,0);put(l.schema,m,h*.042,w*.8,50,19,'#ffffff',true);put(section.title,m,h*.095,w*.86,h*.10,54,'#ffffff',true);
 if(type==='mechanism'){
  box(c,80,h*.23,864,h*.49,p.bg,24);contain(c,original,300,h*.235,425,h*.47);
  c.save();c.strokeStyle=p.accent;c.lineWidth=5;c.setLineDash([16,12]);for(const k of [0,1]){c.beginPath();c.ellipse(512,h*(.47+k*.07),355,95,0,Math.PI*.10,Math.PI*1.85);c.stroke();}c.restore();
  arrow(c,135,h*.53,291,h*.50,p.accent);arrow(c,730,h*.40,894,h*.36,p.accent);
  const labels=!section.customDiagramText&&product.category==='electronics'&&/清淨|purif|AC4221/i.test(product.name)?[l.input,l.process,l.output]:items.slice(0,3);
  ['control','filter','water'].forEach((kind,i)=>{const x=m+i*304;box(c,x,h*.75,276,h*.14,p.bg,14);icon(c,kind,x+16,h*.767,74,p.accent);put(labels[i]||l.facts,x+103,h*.789,157,h*.065,27,p.ink,true);if(i<2)arrow(c,x+278,h*.818,x+300,h*.818,p.accent);});
  put(items.slice(0,3).join(' · '),m,h*.918,w*.86,h*.048,20,p.muted);
 }else if(type==='ingredients'){
  const raw=(section.evidencePoints||[]).join(' ');const known=[['プロバイオティクス','molecule'],['プレバイオティクス','molecule'],['ポストバイオティクス','molecule'],['probiotics','molecule'],['prebiotics','molecule'],['postbiotics','molecule'],['益生菌','molecule'],['益生質','molecule'],['後生元','molecule'],['雪絨花','flower'],['B5','molecule'],['膳食纖維','leaf'],['高麗菜','leaf'],['韭菜','leaf'],['玉米','corn'],['edelweiss','flower'],['fiber','leaf'],['cabbage','leaf'],['chive','leaf'],['corn','corn'],['エーデルワイス','flower'],['食物繊維','leaf'],['キャベツ','leaf'],['ニラ','leaf'],['コーン','corn']].filter(([name])=>raw.toLowerCase().includes(name.toLowerCase())).slice(0,3);
  const components=known.length?known:items.slice(0,3).map((x,i)=>[x,['leaf','molecule','flower'][i]]);
  components.forEach(([name,kind],i)=>{const x=m+i*(w-2*m)/components.length;const width=(w-2*m)/components.length-16;box(c,x,h*.25,width,h*.31,p.bg,25);icon(c,kind,x+width*.23,h*.28,width*.54,p.accent);put(name,x+18,h*.45,width-36,h*.09,31,p.ink,true);});
  box(c,m,h*.61,w-2*m,h*.29,p.soft,18);contain(c,original,m+20,h*.615,340,h*.27);put(section.body,m+400,h*.65,420,h*.19,28,p.ink);put(l.facts,m,h*.934,w*.86,35,18,p.muted);
 }else if(type==='steps'||type==='care'){
  let names=[l.step1,l.step2,l.step3],icons=['label','control','bag'];
  if(product.category==='food'){names=[l.food1,l.food2,l.food3];icons=['snow','pot','plate'];}
  if(product.category==='bag'){names=[l.bag1,l.bag2,l.bag3];icons=['ruler','bag','label'];}
  if(product.category==='fashion'){names=[l.fashion1,l.fashion2,l.fashion3];icons=['ruler','shirt','label'];}
  if(product.category==='supplement')icons=['label','water','bag'];
  if(section.customDiagramText&&items.length>=2)names=items.slice(0,3);
  contain(c,original,70,h*.29,345,h*.47);put(l.source,72,h*.78,340,55,19,p.muted);
  names.forEach((name,i)=>{const y=h*.245+i*h*.215;box(c,464,y,492,h*.183,p.bg,18);put('0'+(i+1),482,y+24,60,50,27,p.accent,true);icon(c,icons[i],548,y+34,100,p.accent);put(name,678,y+38,246,h*.10,30,p.ink,true);if(i<2)arrow(c,709,y+h*.186,709,y+h*.207,p.accent);});
  put(section.customDiagramText?l.fit:section.body||l.fit,m,h*.91,w*.86,h*.065,20,p.muted);
 }else if(type==='size'){
  box(c,m,h*.24,w-2*m,h*.46,p.bg,18);contain(c,original,260,h*.25,460,h*.43);
  arrow(c,189,h*.29,189,h*.66,p.accent);arrow(c,189,h*.66,189,h*.29,p.accent);line(c,174,h*.29,230,h*.29,p.accent);line(c,174,h*.66,230,h*.66,p.accent);
  arrow(c,300,h*.70,718,h*.70,p.accent);arrow(c,718,h*.70,300,h*.70,p.accent);
  put(l.measure,280,h*.72,520,45,22,p.accent,true);
  const size=items.filter(x=>/\d|尺寸|size|サイズ|크기/i.test(x));put((size.length?size:items).slice(0,3).join('\n'),m,h*.81,w*.86,h*.12,27,p.ink);put(l.fit,m,h*.957,w*.86,35,18,p.muted);
 }else if(type==='contents'){
  contain(c,original,m,h*.255,455,h*.55);const iconKinds=product.category==='bag'?['laptop','bag','ruler']:product.category==='food'?['leaf','leaf','corn']:['label','label','label'];
  let values=items;
  if(product.category==='bag'&&!section.customDiagramText)values=[items.find(x=>/筆電|laptop|PC/i.test(x)),items.find(x=>/容量|capacity/i.test(x)),items.find(x=>/尺寸|dimensions|サイズ/i.test(x))].map(x=>x||l.missing);
  if(product.category==='food'&&!section.customDiagramText){const raw=items.join(' ');const flavors=['高麗菜','韭菜','玉米','cabbage','chive','corn','キャベツ','ニラ','コーン'].filter(x=>raw.toLowerCase().includes(x));if(flavors.length)values=flavors.slice(0,3);}
  iconKinds.forEach((kind,i)=>{const y=h*.25+i*h*.205;box(c,574,y,382,h*.18,p.bg,15);icon(c,kind,596,y+27,90,p.accent);put(values[i]||l.facts,717,y+22,218,h*.142,25,p.ink);line(c,526,y+h*.09,570,y+h*.09,p.accent,2);});
  put(section.body,m,h*.88,w*.86,h*.09,24,p.muted);
 }else{
  contain(c,original,705,h*.24,250,h*.26);put(l.facts,m,h*.28,590,h*.08,30,p.accent,true);
  items.slice(0,5).forEach((item,i)=>{const y=h*.53+i*h*.076;box(c,m,y,w-2*m,h*.073,i%2?p.paper:p.bg,0);put(String(i+1).padStart(2,'0'),m+20,y+18,70,40,24,p.accent,true);put(item,m+108,y+14,w-2*m-132,h*.059,24,p.ink);});
  put(l.fit,m,h*.943,w*.86,38,18,p.muted);
 }
 return true;
}
