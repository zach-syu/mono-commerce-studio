import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
const root=path.resolve('artifacts/layout-v2');
const names={food:'MORI 焙茶',beauty:'SORA 日常精華',fashion:'PLAIN 日常休閒鞋'};
async function select(page:Page,label:string,value:string){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();}
test.beforeEach(async({page})=>{
 const health=await page.request.get('http://127.0.0.1:8799/api/health');expect((await health.json()).paidCallsDisabled).toBe(true);
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname)||['data:','blob:'].includes(url.protocol))await route.continue();else await route.abort('blockedbyclient');});
});
test('sample-loading-gate 範例照片載入完成前不能前往下一步',async({page})=>{
 await page.goto('/');
 const image=await fs.readFile(path.resolve('public/samples/beauty.png'));
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/samples/beauty.png',async route=>{
  if(route.request().resourceType()!=='fetch')return route.continue();
  await gate;await route.fulfill({status:200,contentType:'image/png',body:image});
 });
 try{
  await page.getByRole('button',{name:'使用 SORA 日常精華 範例',exact:true}).click();
  await expect(page.getByRole('button',{name:'下一步：規劃文案',exact:true})).toBeDisabled();
 }finally{release();}
 await expect(page.getByLabel('商品名稱',{exact:true})).toHaveValue('SORA 日常精華');
 await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();
 await expect(page.getByRole('button',{name:'免費規劃套圖',exact:true})).toBeVisible();
});
test('photo-reuse-contract 以模擬回應核對場景共用，不呼叫模型',async({page})=>{
 const requests:string[]=[];const image=await fs.readFile(path.resolve('public/samples/beauty-scene.png'));
 await page.route('**/api/image',route=>{requests.push(route.request().postDataJSON().prompt);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({dataUrl:'data:image/png;base64,'+image.toString('base64'),provider:'test-fixture',model:'fixture-only'})});});
 await setup(page,'beauty','English');await page.getByRole('button',{name:'模型與連線',exact:true}).click();await select(page,'生成模式','Google 模型 · 真實生成');await page.getByRole('button',{name:'完成設定',exact:true}).click();
 await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await page.getByRole('checkbox',{name:'Banner',exact:true}).check();await page.getByRole('checkbox',{name:'同意本次付費生成',exact:true}).check();await page.getByRole('button',{name:'開始 AI 生成（付費）',exact:true}).click();await expect(page.getByRole('heading',{name:'素材已完成',exact:true})).toBeVisible();
 expect(requests).toHaveLength(2);expect(requests[0]).not.toBe(requests[1]);
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載全部素材',exact:true}).click();const file=await event;const downloaded=await file.path();const zip=await JSZip.loadAsync(await fs.readFile(downloaded!));const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
 expect(manifest.outputs).toHaveLength(7);expect(manifest.outputs.find((o:any)=>o.kind==='main').provider).toBe('source-compositor');expect(manifest.outputs.find((o:any)=>o.kind==='banner').reusedPhoto).toBe(true);
 const raw=manifest.outputs.filter((o:any)=>o.photoOrigin==='generated');expect(raw).toHaveLength(3);
 await fs.mkdir(root,{recursive:true});await fs.writeFile(path.join(root,'mocked-reuse-contract.json'),JSON.stringify({status:'passed',mockedImageRequests:requests.length,realModelRequests:0,finalCompositions:7,bannerReusesHero:true}));
});
async function setup(page:Page,category:keyof typeof names,language:string){await page.goto('/');await page.getByRole('button',{name:`使用 ${names[category]} 範例`,exact:true}).click();await expect(page.getByLabel('商品名稱',{exact:true})).toHaveValue(names[category]);await select(page,'輸出語言',language);await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByRole('button',{name:'免費規劃套圖',exact:true}).click();await expect(page.getByLabel('標題 5',{exact:true})).toBeVisible();}
for(const [category,language] of [['food','繁體中文'],['beauty','English'],['fashion','日本語']] as const){
 test(`${category}-five-roles 免費套圖分工與輸出`,async({page})=>{
  const dir=path.join(root,category);await fs.mkdir(dir,{recursive:true});const apiCalls:string[]=[];const errors:string[]=[];page.on('request',r=>{if(/\/(copy|image|video)(\?|$)/.test(r.url()))apiCalls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await setup(page,category,language);
  await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await page.getByRole('checkbox',{name:'Banner',exact:true}).check();
  await expect(page.locator('.storyboard-frames figure')).toHaveCount(7);await expect.poll(()=>page.locator('.storyboard-frames img').evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.locator('.storyboard-preview').screenshot({path:path.join(dir,'storyboard.png')});
  await page.getByRole('button',{name:'開始生成',exact:true}).click();await expect(page.getByRole('heading',{name:'素材已完成',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(dir,'results.png'),fullPage:true});
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'下載全部素材',exact:true}).click();const download=await downloadEvent;await download.saveAs(path.join(dir,'bundle.zip'));
  const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,'bundle.zip')));for(const [file,item] of Object.entries(zip.files)){if(item.dir)continue;expect(file).not.toContain('..');await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});await fs.writeFile(path.join(dir,file),await item.async('nodebuffer'));}
  const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));const detail=manifest.outputs.filter((o:any)=>o.kind==='detail');
  expect(manifest.settings.language).toBe({'繁體中文':'zh-TW',English:'en','日本語':'ja'}[language]);
  expect(detail).toHaveLength(5);expect(new Set(detail.map((o:any)=>o.template)).size).toBe(5);expect(new Set(detail.map((o:any)=>o.visualRole)).size).toBe(5);
  expect(detail.find((o:any)=>o.visualRole==='detail').photoOrigin).toBe('original-crop');expect(detail.find((o:any)=>o.visualRole==='lifestyle').photoOrigin).toBe('prepared-scene');
  const hashes=[];for(const o of manifest.outputs){const bytes=await zip.file(o.file)!.async('nodebuffer');expect(bytes.readUInt32BE(16)).toBe(o.width);expect(bytes.readUInt32BE(20)).toBe(o.height);expect(o.provider).toBe('demo-compositor');hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));}
  expect(new Set(hashes).size).toBe(7);expect(apiCalls).toEqual([]);expect(errors).toEqual([]);
  await fs.writeFile(path.join(dir,'evidence.json'),JSON.stringify({category,language,status:'passed',modelCalls:apiCalls.length,outputs:manifest.outputs,source:manifest.product,errors,checks:['Five distinct roles and templates','Original crops preserve source evidence','Prepared scene is explicitly labelled','Every PNG dimension validated','Zero copy/image/video requests']},null,2));
 });
}
test('paid-calls-blocked 未同意費用時不能送出',async({page,request})=>{
 const calls:string[]=[];page.on('request',r=>{if(/\/(copy|image|video)(\?|$)/.test(r.url()))calls.push(r.url());});
 await setup(page,'beauty','繁體中文');await page.getByRole('button',{name:'模型與連線',exact:true}).click();await select(page,'生成模式','Google 模型 · 真實生成');await page.getByRole('button',{name:'完成設定',exact:true}).click();
 await expect(page.getByRole('button',{name:'AI 規劃文案（付費）',exact:true})).toBeDisabled();await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await expect(page.getByRole('button',{name:'開始 AI 生成（付費）',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'免費預覽並下載',exact:true}).click();await expect(page.getByRole('heading',{name:'素材已完成',exact:true})).toBeVisible();expect(calls).toEqual([]);
 const response=await request.post('http://127.0.0.1:8799/api/copy',{headers:{'x-workspace-token':'d'.repeat(64)},data:{product:'No-cost guard test',mode:'live',allowPaid:true}});expect(response.status()).toBe(403);expect((await response.json()).error.code).toBe('PAID_CALLS_DISABLED');
 await fs.writeFile(path.join(root,'no-paid-calls.json'),JSON.stringify({status:'passed',browserModelRequests:0,testServerLiveDisabled:true,serverResponse:'PAID_CALLS_DISABLED'}));
});
test('uploaded-photo-context 上傳照片不替換成其他商品',async({page})=>{
 await page.goto('/');await page.getByLabel('上傳商品照片',{exact:true}).setInputFiles(path.resolve('public/samples/beauty.png'));await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByRole('button',{name:'免費規劃套圖',exact:true}).click();await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();
 await expect(page.locator('.storyboard-frames').getByText('原圖情境示意',{exact:true})).toBeVisible();await expect(page.locator('.storyboard-frames').getByText('既有範例場景',{exact:true})).toHaveCount(0);
});
test('mobile-storyboard 手機可檢查套圖預覽',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page,'food','繁體中文');await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await expect(page.locator('.storyboard-frames figure')).toHaveCount(6);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await fs.mkdir(root,{recursive:true});await page.screenshot({path:path.join(root,'mobile.png'),fullPage:true});
});
