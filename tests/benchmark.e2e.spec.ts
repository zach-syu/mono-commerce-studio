import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import {benchmarkProducts} from '../shared/benchmark-products';
const root=path.resolve('artifacts/benchmark-v3');
test.beforeEach(async({page})=>{
 const health=await page.request.get('http://127.0.0.1:8796/api/health');expect((await health.json()).paidCallsDisabled).toBe(true);
 await page.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)||['data:','blob:'].includes(url.protocol)?route.continue():route.abort('blockedbyclient');});
});
async function choose(page:Page,label:string,value:string){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();}
async function upload(page:Page,id:string,language='繁體中文'){
 const item=benchmarkProducts.find(b=>b.id===id)!;await page.goto('/');await page.getByLabel('上傳商品照片',{exact:true}).setInputFiles(path.resolve('public'+item.file));
 await expect(page.getByLabel('商品名稱',{exact:true})).toHaveValue(item.name);await choose(page,'輸出語言',language);await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();return item;
}
async function download(page:Page,directory:string){
 await fs.mkdir(directory,{recursive:true});const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載全部素材',exact:true}).click();const file=await event;await file.saveAs(path.join(directory,'bundle.zip'));
 const zip=await JSZip.loadAsync(await fs.readFile(path.join(directory,'bundle.zip')));
 for(const [file,item] of Object.entries(zip.files)){if(item.dir)continue;expect(file).not.toContain('..');await fs.mkdir(path.dirname(path.join(directory,file)),{recursive:true});await fs.writeFile(path.join(directory,file),await item.async('nodebuffer'));}
 return {zip,manifest:JSON.parse(await zip.file('manifest.json')!.async('string'))};
}
for(const item of benchmarkProducts){
 const language=item.id==='ts6'||item.id==='philips'?'English':item.id==='jsmix'||item.id==='supplement'?'日本語':'繁體中文';
 test(`${item.id} 白底輸入到豐富詳情頁、Banner 與完整下載`,async({page})=>{
  const calls:string[]=[];const errors:string[]=[];page.on('request',r=>{if(/\/(copy|image|video)(\?|$)/.test(r.url()))calls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));const directory=path.join(root,item.id);
  await upload(page,item.id,language);await expect(page.getByLabel('詳情圖張數',{exact:true})).toHaveValue('8');await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await expect(page.getByLabel('標題 8',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'查看這次的整理依據',exact:true}).click();await expect(page.locator('.metadata:visible')).toContainText('詳情圖張數：8');const plannerPrompt=await page.locator('.metadata:visible').innerText();
  await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await page.getByRole('checkbox',{name:'Banner',exact:true}).check();
  await expect(page.locator('.storyboard-frames figure')).toHaveCount(10);await expect.poll(()=>page.locator('.storyboard-frames img').evaluateAll(xs=>xs.every(x=>(x as HTMLImageElement).complete&&(x as HTMLImageElement).naturalWidth>0))).toBe(true);
  await fs.mkdir(directory,{recursive:true});await page.locator('.storyboard-preview').screenshot({path:path.join(directory,'storyboard.png')});await page.getByRole('button',{name:'開始生成',exact:true}).click();await expect(page.getByRole('heading',{name:'素材已完成',exact:true})).toBeVisible();
  const {zip,manifest}=await download(page,directory);const detail=manifest.outputs.filter((o:any)=>o.kind==='detail');const scenes=detail.filter((o:any)=>o.moduleType==='lifestyle');
  expect(detail).toHaveLength(8);expect(manifest.outputs).toHaveLength(10);expect(new Set(detail.map((o:any)=>o.moduleType)).size).toBeGreaterThanOrEqual(6);
  expect(scenes).toHaveLength(2);expect(scenes.every((o:any)=>o.photoOrigin==='prepared-scene'&&o.photoProvider==='conversation-imagegen')).toBe(true);expect(new Set(scenes.map((o:any)=>o.photoAsset)).size).toBe(2);
  expect(detail.some((o:any)=>['ingredients','mechanism','steps','size','contents'].includes(o.moduleType))).toBe(true);
  const original=await fs.readFile(path.resolve('public'+item.file));const entry=Object.keys(zip.files).find(name=>name.startsWith('source/')&&!zip.files[name].dir)!;const retained=await zip.file(entry)!.async('nodebuffer');expect(crypto.createHash('sha256').update(retained).digest('hex')).toBe(crypto.createHash('sha256').update(original).digest('hex'));
  const hashes=[];for(const output of manifest.outputs){const bytes=await zip.file(output.file)!.async('nodebuffer');expect(bytes.readUInt32BE(16)).toBe(output.width);expect(bytes.readUInt32BE(20)).toBe(output.height);hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));}
  expect(new Set(hashes).size).toBe(10);expect(calls).toEqual([]);expect(errors).toEqual([]);await page.screenshot({path:path.join(directory,'results.png'),fullPage:true});
  await fs.writeFile(path.join(directory,'evidence.json'),JSON.stringify({id:item.id,name:item.name,status:'passed',language,plannerPrompt,inputNote:item.inputNote,sourceUrl:item.pageUrl,outputs:manifest.outputs,modelApiRequests:calls.length,visualCoverage:{moduleTypes:new Set(detail.map((o:any)=>o.moduleType)).size,distinctScenes:2,diagrams:true},reviewStatus:'Structure and delivery verified. Product fidelity requires visual review.',checks:['One real reference image uploaded and recognized by SHA-256','Eight detail modules plus main image and Banner','Two distinct saved conversation-imagegen scenes','Native informational diagrams','Exact source bytes and output dimensions retained','No Google or other paid API request from the App']},null,2));
 });
}
test('count-controls 張數可調、縮減不刪文案、手機可操作',async({page})=>{
 await upload(page,'philips');await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await page.getByLabel('標題 1',{exact:true}).fill('保留使用者寫的標題');
 await page.getByLabel('詳情圖張數',{exact:true}).fill('3');await page.getByRole('button',{name:'套用張數',exact:true}).click();await expect(page.getByRole('checkbox',{name:/^選取文案/}).filter({visible:true})).toHaveCount(8);expect(await page.getByRole('checkbox',{name:/^選取文案/}).evaluateAll(xs=>xs.filter(x=>(x as HTMLInputElement).checked).length)).toBe(3);await expect(page.getByLabel('標題 1',{exact:true})).toHaveValue('保留使用者寫的標題');
 await page.getByLabel('詳情圖張數',{exact:true}).fill('12');await page.getByRole('button',{name:'套用張數',exact:true}).click();await expect(page.getByLabel('標題 12',{exact:true})).toBeVisible();expect(await page.getByRole('checkbox',{name:/^選取文案/}).evaluateAll(xs=>xs.filter(x=>(x as HTMLInputElement).checked).length)).toBe(12);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await fs.mkdir(root,{recursive:true});await page.screenshot({path:path.join(root,'mobile-count.png')});
});
test('count-boundaries 1 與 16 張可規劃，無效數值不能送出',async({page})=>{
 await upload(page,'philips');for(const count of [1,16]){await page.getByLabel('詳情圖張數',{exact:true}).fill(String(count));await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await expect(page.getByLabel('標題 '+count,{exact:true})).toBeVisible();await expect(page.getByRole('checkbox',{name:/^選取文案/})).toHaveCount(count);}
 for(const invalid of ['0','17','1.5']){await page.getByLabel('詳情圖張數',{exact:true}).fill(invalid);await expect(page.getByRole('button',{name:'依商品資料整理（免費）',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'下一步：視覺設定',exact:true})).toBeDisabled();}
});
test('diagram-copy-edit 修改文案會進入圖解與下載內容',async({page})=>{
 await upload(page,'philips');await page.getByLabel('詳情圖張數',{exact:true}).fill('1');await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await choose(page,'用途 1','功能示意');
 const changed='測試用編輯：第一階段\n測試用編輯：第二階段\n測試用編輯：第三階段';await page.getByLabel('文案 1',{exact:true}).fill(changed);
 await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await page.getByRole('checkbox',{name:'商品主圖',exact:true}).uncheck();await page.getByRole('button',{name:'開始生成',exact:true}).click();await expect(page.getByRole('heading',{name:'素材已完成',exact:true})).toBeVisible();
 const {manifest}=await download(page,path.join(root,'diagram-edit'));expect(manifest.outputs).toHaveLength(1);expect(manifest.outputs[0].copy.body).toBe(changed);expect(manifest.outputs[0].copy.evidencePoints).toEqual(changed.split('\n'));
});
