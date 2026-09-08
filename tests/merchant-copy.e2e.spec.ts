import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
const root=path.resolve('artifacts/merchant-copy');
const name='TS6護一生淨白植感慕斯';
const facts='■包裝容量：180g\n■產品成份：TS-2L®益菌精華、維生素C磷酸鎂鹽(MAP)、山花精(Gigawhite)、蘆薈萃取、茶樹精油、玫瑰草精油。\n■適用對象：私密肌膚的日常防護與清潔保養';
const source=path.resolve('public/report/merchant-copy/source.png');
test.beforeEach(async({page})=>{
 await fs.mkdir(root,{recursive:true});
 await page.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol)?route.continue():route.abort('blockedbyclient');});
 const health=await page.request.get('http://127.0.0.1:8797/api/health');expect((await health.json()).paidCallsDisabled).toBe(true);
});
async function choose(page:Page,label:string,value:string){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();}
async function upload(page:Page,language='繁體中文',productName=name,productFacts=facts){
 await page.goto('/');await page.getByLabel('上傳商品照片',{exact:true}).setInputFiles(source);
 await expect(page.getByLabel('商品名稱',{exact:true})).toHaveValue('source'); // No fixture lookup or prefilled facts.
 await page.getByLabel('商品名稱',{exact:true}).fill(productName);await choose(page,'商品類型','美妝保養');await page.getByLabel('已確認的商品資訊',{exact:true}).fill(productFacts);await choose(page,'輸出語言',language);
}
test('actual-upload: 英文目標保留中文資料，明示待翻譯，原文確認後可下載',async({page})=>{
 const apiCalls:string[]=[];page.on('request',r=>{if(/\/(copy|image|video)(\?|$)/.test(r.url()))apiCalls.push(r.url());});
 await upload(page,'English');await page.screenshot({path:path.join(root,'01-actual-input.png'),fullPage:true});
 await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByLabel('詳情圖張數',{exact:true}).fill('5');await expect(page.getByLabel('這次的製作方向（Prompt）',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await expect(page.getByLabel('標題 1',{exact:true})).toHaveValue(name);await expect(page.getByLabel('文案 1',{exact:true})).toHaveValue(/180g/);
 await expect(page.locator('.copy-card').nth(1).getByText('成分與食材',{exact:true})).toBeVisible();await expect(page.getByLabel('文案 2',{exact:true})).toHaveValue(/MAP/);await expect(page.getByLabel('文案 2',{exact:true})).not.toHaveValue(/180g/);
 await expect(page.getByTestId('copy-source-notice')).toContainText('免費功能沒有完成翻譯');await expect(page.getByRole('button',{name:'下一步：視覺設定',exact:true})).toBeDisabled();await page.screenshot({path:path.join(root,'02-source-retained.png'),fullPage:true});
 await page.getByRole('button',{name:'查看這次的整理依據',exact:true}).click();await expect(page.locator('.metadata:visible')).toContainText('沒有呼叫 AI');await expect(page.locator('.metadata:visible')).toContainText('180g');
 await page.getByRole('button',{name:'改用原文：繁體中文',exact:true}).click();await expect(page.getByLabel('文案 2',{exact:true})).toHaveValue(/玫瑰草精油/);
 await page.getByRole('button',{name:'下一步：視覺設定',exact:true}).click();await page.getByRole('checkbox',{name:'Banner',exact:true}).check();
 await expect(page.locator('.storyboard-frames figure')).toHaveCount(7);await expect.poll(()=>page.locator('.storyboard-frames img').evaluateAll(xs=>xs.every(x=>(x as HTMLImageElement).complete&&(x as HTMLImageElement).naturalWidth>0))).toBe(true);await page.locator('.storyboard-preview').screenshot({path:path.join(root,'03-storyboard.png')});
 await page.getByRole('button',{name:'開始生成',exact:true}).click();await expect(page.getByRole('heading',{name:'素材已完成',exact:true})).toBeVisible();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載全部素材',exact:true}).click();await (await event).saveAs(path.join(root,'bundle.zip'));
 const zip=await JSZip.loadAsync(await fs.readFile(path.join(root,'bundle.zip')));const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
 expect(manifest.product.sourceOrigin).toBe('uploaded');expect(manifest.product.benchmarkId).toBeUndefined();expect(manifest.settings.language).toBe('zh-TW');expect(manifest.outputs).toHaveLength(7);
 const text=await zip.file('copy.txt')!.async('string');for(const term of ['180g','MAP','Gigawhite','玫瑰草精油','私密肌膚'])expect(text).toContain(term);expect(text).not.toMatch(/A little more|今天，留一點好|99\.9/);
 const sourceEntry=Object.keys(zip.files).find(p=>p.startsWith('source/')&&!zip.files[p].dir)!;expect(crypto.createHash('sha256').update(await zip.file(sourceEntry)!.async('nodebuffer')).digest('hex')).toBe(crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex'));
 for(const [file,item] of Object.entries(zip.files)){if(item.dir)continue;expect(file).not.toContain('..');await fs.mkdir(path.dirname(path.join(root,'output',file)),{recursive:true});await fs.writeFile(path.join(root,'output',file),await item.async('nodebuffer'));}
 expect(apiCalls).toEqual([]);await fs.writeFile(path.join(root,'actual-evidence.json'),JSON.stringify({name,facts,sourceOrigin:manifest.product.sourceOrigin,sourceSha256:crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex'),outputs:manifest.outputs,sections:manifest.sections,modelApiCalls:apiCalls.length,translationExplicitlyResolved:true},null,2));
});
test('changed-facts: 一般商品換容量後，主視覺與規格會更新',async({page})=>{
 await upload(page);await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await expect(page.getByLabel('文案 1',{exact:true})).toHaveValue(/180g/);
 await page.getByRole('button',{name:'返回商品設定',exact:true}).click();await page.getByLabel('已確認的商品資訊',{exact:true}).fill(facts.replace('180g','250g'));await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();
 await expect(page.getByLabel('文案 1',{exact:true})).toHaveValue(/250g/);await expect(page.getByLabel('文案 8',{exact:true})).not.toHaveValue(/180g/);await page.screenshot({path:path.join(root,'04-changed-facts.png'),fullPage:true});
});
test('unseen-english: 英文商品資料直接整理，無翻譯假象或樣本替換',async({page})=>{
 await upload(page,'English','Unlisted Mousse 240','Volume: 240 ml\nIngredients: aloe extract, glycerin\nUse: daily cleansing');await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();
 await expect(page.getByLabel('標題 1',{exact:true})).toHaveValue('Unlisted Mousse 240');await expect(page.getByLabel('文案 1',{exact:true})).toHaveValue(/240 ml/);await expect(page.getByLabel('文案 3',{exact:true})).toHaveValue(/glycerin/);await expect(page.getByRole('button',{name:'下一步：視覺設定',exact:true})).toBeEnabled();await page.screenshot({path:path.join(root,'05-unseen-english.png'),fullPage:true});
});
test('japanese-target: 未翻譯資料在手機也有可操作的原文選項',async({page})=>{
 await upload(page,'日本語');await page.getByRole('button',{name:'下一步：規劃文案',exact:true}).click();await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'改用原文：繁體中文',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByTestId('copy-source-notice').screenshot({path:path.join(root,'06-mobile-language.png')});
});
