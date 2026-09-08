export const MAX_IMAGE_BYTES=7*1024*1024;
export async function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('圖片無法讀取。請換一張有效的 PNG、JPEG 或 WebP。'));img.src=src;});}
export async function readProductFile(file:File){
 if(file.size>MAX_IMAGE_BYTES) throw new Error('圖片超過 7 MB。請先縮小圖片，再重新上傳。');
 if(file.size===0) throw new Error('這是空白檔案。請選擇有效圖片。');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!png&&!jpg&&!webp) throw new Error('不支援這個檔案。請上傳 PNG、JPEG 或 WebP 圖片。');
 const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('無法讀取檔案。請重新選擇。'));reader.readAsDataURL(new Blob([file],{type:png?'image/png':jpg?'image/jpeg':'image/webp'}));});
 const img=await loadImage(dataUrl);
 if(img.width>8192||img.height>8192||img.width*img.height>32000000) throw new Error('圖片像素過大。請縮小至每邊 8192 px 以下、總像素 3200 萬以下。');
 return {dataUrl,width:img.naturalWidth,height:img.naturalHeight};
}
export function canvasBlob(canvas:HTMLCanvasElement,type='image/png'):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('匯出圖片失敗。請降低解析度後重試。')),type));}
export function abortIfNeeded(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('已停止產生素材','AbortError');}
