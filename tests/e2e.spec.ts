import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

type Category = 'food' | 'beauty' | 'fashion';
type Language = 'zh-TW' | 'en' | 'ja' | 'ko';
type OutputKind = 'main' | 'detail' | 'banner' | 'video';
type Evidence = {
  id: string; title: string; directory: string; category?: Category; language?: Language;
  kind: string; mode: string; checks: string[]; screenshots: string[]; warnings: string[];
  api: { path: string; method: string; status: number; provider?: string; model?: string }[];
  downloads: string[]; manifest?: Record<string, any>; outputs?: Record<string, any>[];
  supportingRuns?: { label: string; folder: string; manifest: Record<string, any>; source: Record<string, any>; outputs: Record<string, any>[] }[];
  consoleErrors: string[]; startedAt: string; elapsedMs?: number; status?: string; error?: string;
  source?: { file: string; bytes: number; sha256: string; width: number; height: number };
  capture: (name: string) => Promise<void>;
};

const names: Record<Category, string> = { food: 'MORI 焙茶', beauty: 'SORA 日常精華', fashion: 'PLAIN 日常休閒鞋' };
const outputLabels: Record<OutputKind, string> = { main: '商品主圖', detail: '商品詳情圖', banner: 'Banner', video: '帶貨短片' };
const root = path.resolve('artifacts/e2e');
const slug = (s: string) => s.split(' ')[0].replace(/[^a-z0-9_-]/gi, '-');
const languages = { 'zh-TW': '繁體中文', en: 'English', ja: '日本語', ko: '한국어' };

async function choose(page: Page, name: string, value: string, option: string) {
  const control = page.getByRole('combobox', { name, exact: true });
  if (await control.evaluate((node) => node.tagName === 'SELECT')) await control.selectOption(value);
  else { await control.click(); await page.getByRole('option', { name: option, exact: true }).click(); }
}

const test = base.extend<{ evidence: Evidence }>({
  evidence: async ({ page }, use, testInfo) => {
    const started = Date.now();
    const directory = path.join(root, slug(testInfo.title));
    await fs.rm(directory, { recursive: true, force: true });
    await fs.mkdir(directory, { recursive: true });
    const e: Evidence = {
      id: slug(testInfo.title), title: testInfo.title, directory,
      kind: 'edge', mode: 'free local composition; paid providers disabled', checks: [], screenshots: [], warnings: [],
      api: [], downloads: [], consoleErrors: [], startedAt: new Date().toISOString(),
      capture: async (name) => {
        const file = `${name}.png`;
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({ path: path.join(directory, file), fullPage: true });
        e.screenshots.push(file);
      },
    };
    await page.route(/https:\/\/(?:generativelanguage\.googleapis\.com|[^/]*aiplatform\.googleapis\.com)/,route=>route.abort('blockedbyclient'));
    page.on('pageerror', (error) => e.consoleErrors.push(error.message));
    page.on('response', async (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/')) return;
      const entry: Evidence['api'][number] = { path: url.pathname, method: response.request().method(), status: response.status() };
      e.api.push(entry);
      try { const body = await response.json(); entry.provider = body.provider; entry.model = body.model; } catch { /* Non-JSON failures remain recorded by status. */ }
    });
    const safety=await page.request.get('http://127.0.0.1:8787/api/health');
    expect((await safety.json()).paidCallsDisabled).toBe(true);
    await use(e);
    e.elapsedMs = Date.now() - started;
    e.status = testInfo.status;
    e.error = testInfo.errors.map((x) => x.message || '').join('\n');
    if (testInfo.status !== 'passed') {
      await e.capture('failure').catch(() => undefined);
    }
    const serializable = { ...e, capture: undefined, directory: undefined };
    await fs.writeFile(path.join(directory, 'evidence.json'), JSON.stringify(serializable, null, 2));
    await testInfo.attach('case-evidence', { path: path.join(directory, 'evidence.json'), contentType: 'application/json' });
  },
});

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '下一步：規劃文案', exact: true })).toBeVisible();
}

async function product(page: Page, e: Evidence, category: Category, language: Language = 'en') {
  e.category = category; e.language = language;
  await open(page);
  await page.getByRole('button', { name: `使用 ${names[category]} 範例`, exact: true }).click();
  await expect(page.getByLabel('商品名稱', { exact: true })).toHaveValue(names[category]);
  await choose(page, '輸出語言', language, languages[language]);
  await e.capture('01-source');
  await page.getByRole('button', { name: '下一步：規劃文案', exact: true }).click();
}

async function plan(page: Page, e: Evidence) {
  // Keep the original regression matrix at five frames; v3 tests exercise the new default and count range.
  await page.getByLabel('詳情圖張數',{exact:true}).fill('5');
  await page.getByRole('button', { name: '依商品資料整理（免費）', exact: true }).click();
  await expect(page.getByLabel('標題 1', { exact: true })).not.toHaveValue('');
  await expect(page.getByLabel('標題 5', { exact: true })).toBeVisible();
  e.checks.push('本機建立 5 種套圖用途與可編輯文案，不呼叫模型 API。');
  await e.capture('02-copy');
}

async function visual(page: Page, kinds: OutputKind[], options: { layout?: string; tone?: string; resolution?: string; bannerRatio?: string } = {}) {
  await page.getByRole('button', { name: '下一步：視覺設定', exact: true }).click();
  for (const kind of Object.keys(outputLabels) as OutputKind[]) {
    await page.getByRole('checkbox', { name: new RegExp('^' + outputLabels[kind]) }).setChecked(kinds.includes(kind));
  }
  if (options.layout) await page.getByRole('button', { name: options.layout, exact: true }).click();
  if (options.tone) await page.getByRole('button', { name: options.tone, exact: true }).click();
  if (options.resolution) await page.getByRole('button', { name: options.resolution, exact: true }).click();
  if (options.bannerRatio) await choose(page, 'Banner 比例', options.bannerRatio, options.bannerRatio === '21:9' ? '21:9 · 寬版官網橫幅' : '16:9 · 活動橫幅');
}

async function generate(page: Page, e: Evidence) {
  await e.capture('03-settings');
  await page.getByRole('button', { name: '開始生成', exact: true }).click();
  await expect(page.getByText('素材已完成', { exact: true })).toBeVisible({ timeout: 60_000 });
  await e.capture('04-results');
  expect(e.consoleErrors).toEqual([]);
  e.checks.push('生成完成，瀏覽器無未處理 JavaScript 錯誤。');
}

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function bundle(page: Page, e: Evidence, expectedKinds: OutputKind[]) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載全部素材', exact: true }).click();
  const download = await event;
  await download.saveAs(path.join(e.directory, 'bundle.zip'));
  const bytes = await fs.readFile(path.join(e.directory, 'bundle.zip'));
  const zip = await JSZip.loadAsync(bytes);
  for (const [name, item] of Object.entries(zip.files)) {
    if (item.dir) continue;
    if (name.includes('..') || path.isAbsolute(name)) throw new Error(`Unsafe ZIP path: ${name}`);
    const target = path.join(e.directory, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await item.async('nodebuffer'));
  }
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
  e.manifest = manifest; e.downloads.push('bundle.zip', 'manifest.json', 'copy.txt');
  e.outputs = [];
  expect(manifest.settings.mode).toBe('demo');
  expect(manifest.notice).toContain('no live model request');
  expect([...new Set(manifest.outputs.map((o: any) => o.kind))].sort()).toEqual([...expectedKinds].sort());
  const originalFile = Object.keys(zip.files).find((name) => /^source\/original\./.test(name))!;
  const original = await zip.file(originalFile)!.async('nodebuffer');
  e.source = { file: originalFile, bytes: original.length, sha256: crypto.createHash('sha256').update(original).digest('hex'), ...pngDimensions(original) };
  if (e.category && manifest.product.sourceOrigin === 'ai-sample') {
    const sample = await fs.readFile(path.resolve(`public/samples/${e.category}.png`));
    expect(e.source.sha256).toBe(crypto.createHash('sha256').update(sample).digest('hex'));
    e.checks.push('下載原圖與上傳範例的 SHA-256 相同；原始商品證據保留。');
  }
  for (const item of manifest.outputs) {
    const output = await zip.file(item.file)!.async('nodebuffer');
    expect(output.length).toBeGreaterThan(1000);
    expect(output.length).toBe(item.bytes);
    let actual: { width: number; height: number };
    if (item.mimeType.startsWith('image/')) actual = pngDimensions(output);
    else {
      const player = page.locator('video').first();
      await expect.poll(async () => player.evaluate((node: HTMLVideoElement) => node.videoWidth)).toBe(item.width);
      actual = await player.evaluate((node: HTMLVideoElement) => ({ width: node.videoWidth, height: node.videoHeight }));
    }
    expect(actual.width).toBe(item.width); expect(actual.height).toBe(item.height);
    expect(item.sourceId).toBe(manifest.product.id);
    expect(item.provider).toMatch(/^demo-(compositor|slideshow)$/);
    e.outputs.push({ ...item, actualWidth: actual.width, actualHeight: actual.height, actualBytes: output.length });
    if (item.warning) e.warnings.push(item.warning);
  }
  if (expectedKinds.includes('detail')) {
    expect(zip.file('detail-page.html')).not.toBeNull();
    e.downloads.push('detail-page.html');
    const html = await zip.file('detail-page.html')!.async('string');
    expect((html.match(/<img /g) || []).length).toBe(manifest.outputs.filter((x: any) => x.kind === 'detail').length);
  }
  e.checks.push(`實際下載並解壓 ${manifest.outputs.length} 份素材，逐檔核對大小、PNG 像素與來源關聯。`);
  return manifest;
}

for (const category of ['food', 'beauty', 'fashion'] as Category[]) {
  for (const language of ['en', 'ja'] as Language[]) {
    test(`${category}-${language}-detail ${names[category]} ${language === 'en' ? '英文' : '日文'} 商品詳情完整流程`, async ({ page, evidence: e }) => {
      e.kind = 'detail';
      await product(page, e, category, language); await plan(page, e);
      const editedTitle = language === 'en' ? `${category.toUpperCase()} — an everyday choice` : `${category === 'food' ? 'お茶' : category === 'beauty' ? 'スキンケア' : 'シューズ'}のある毎日`;
      await page.getByLabel('標題 1', { exact: true }).fill(editedTitle);
      await page.getByLabel('文案 1', { exact: true }).fill(language === 'en' ? 'A considered choice, with room for your own routine.' : '自分らしい毎日に、お気に入りの一品を。');
      await visual(page, ['main', 'detail'], { layout: category === 'food' ? '智慧匹配' : category === 'beauty' ? '主體置中' : '圖文分欄', tone: category === 'beauty' ? '清透棚拍' : '自然留白' });
      await generate(page, e); const manifest = await bundle(page, e, ['main', 'detail']);
      expect(manifest.settings.language).toBe(language);
      expect(manifest.outputs.find((x: any) => x.kind === 'detail').copy.title).toBe(editedTitle);
      expect(manifest.outputs.filter((x: any) => x.kind === 'detail')).toHaveLength(manifest.sections.filter((x: any) => x.selected).length);
      expect(manifest.outputs.filter((x: any) => x.kind === 'detail').every((x: any) => x.width === 768 && x.height === 1024)).toBe(true);
      const copy = manifest.sections.map((x: any) => `${x.title} ${x.body}`).join(' ');
      if (language === 'en') expect(copy).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
      if (language === 'ja') { expect(copy).toMatch(/[\u3040-\u30ff]/); expect(copy).not.toContain('實際'); expect(copy).not.toContain('待商家'); }
      e.checks.push('已編輯文案出現在下載檔；每個已勾選段落各有一張 768 × 1024 詳情圖；輸出語言符合設定。');
    });
  }
}

test('food-banner-21-9 食品 21:9 Banner 與暖調構圖', async ({ page, evidence: e }) => {
  e.kind = 'banner'; await product(page, e, 'food', 'zh-TW'); await plan(page, e);
  await visual(page, ['banner'], { layout: '雜誌構圖', tone: '暖調撞色', bannerRatio: '21:9', resolution: '2K' });
  await generate(page, e); const m = await bundle(page, e, ['banner']);
  expect(m.outputs[0]).toMatchObject({ width: 2048, height: 878 });
  expect(m.settings).toMatchObject({ bannerRatio: '21:9', tone: 'bold', layout: 'editorial' });
  e.checks.push('寬幅 Banner 實際 2048 × 878 px，設定、色調與構圖可追溯。');
});

test('beauty-banner-4k 美妝 4K Banner 的實際像素', async ({ page, evidence: e }) => {
  e.kind = 'banner'; await product(page, e, 'beauty', 'en'); await plan(page, e);
  await visual(page, ['banner'], { layout: '圖文分欄', tone: '清透棚拍', bannerRatio: '16:9', resolution: '4K' });
  await generate(page, e); const m = await bundle(page, e, ['banner']);
  expect(m.outputs[0]).toMatchObject({ width: 4096, height: 2304 });
  e.checks.push('從 PNG 標頭獨立讀到 4096 × 2304 px；這證明輸出尺寸，不代表模型原生 4K 細節。');
});

test('fashion-ko-main 服裝配件韓文主圖與示範短片', async ({ page, evidence: e }) => {
  e.kind = 'video'; await product(page, e, 'fashion', 'ko'); await plan(page, e);
  await visual(page, ['main', 'video']); await generate(page, e);
  const m = await bundle(page, e, ['main', 'video']);
  const video = m.outputs.find((x: any) => x.kind === 'video');
  expect(video.provider).toBe('demo-slideshow'); expect(video.warning).toContain('不是 Veo');
  const player = page.locator('video').first();
  await expect(player).toBeVisible();
  const media = await player.evaluate((node: HTMLVideoElement) => ({ width: node.videoWidth, height: node.videoHeight, duration: node.duration, ready: node.readyState }));
  expect(media.width).toBe(1280); expect(media.height).toBe(720); expect(media.ready).toBeGreaterThan(0);
  e.checks.push('示範短片可載入為 1280 × 720 影片；明確標示原圖動畫、無配音、不是 Veo。');
});

test('product-library 商品列表儲存、重載、搜尋與重新開啟', async ({ page, evidence: e }) => {
  e.kind = 'library'; await product(page, e, 'food', 'en'); await plan(page, e); await visual(page, ['main']); await generate(page, e);
  await page.getByRole('button', { name: '儲存到商品列表', exact: true }).click();
  await page.getByRole('button', { name: /^商品列表/ }).click();
  await expect(page.getByText(names.food, { exact: true }).first()).toBeVisible();
  await e.capture('05-library');
  await page.reload();
  await page.getByRole('button', { name: /^商品列表/ }).click();
  await expect(page.getByText(names.food, { exact: true }).first()).toBeVisible();
  await page.getByLabel('搜尋商品', { exact: true }).fill('不存在的商品');
  await expect(page.getByText('沒有符合條件的商品', { exact: true })).toBeVisible();
  await page.getByLabel('搜尋商品', { exact: true }).fill('MORI');
  await page.getByRole('button', { name: '繼續編輯 ' + names.food, exact: true }).click();
  await bundle(page, e, ['main']); await e.capture('06-restored');
  e.checks.push('商品專案可保存、頁面重載後可搜尋並重新開啟，素材 Blob 仍可下載。此項是本機 IndexedDB，非遠端 Supabase 持久化。');
});

test('upload-valid 真實 PNG 上傳、編輯、產出與原圖保留', async ({ page, evidence: e }) => {
  e.category = 'food'; e.language = 'en'; e.kind = 'upload'; await open(page);
  await page.getByLabel('上傳商品照片', { exact: true }).setInputFiles(path.resolve('public/samples/food.png'));
  await page.getByLabel('商品名稱', { exact: true }).fill('Uploaded tea sample');
  await choose(page, '輸出語言', 'en', 'English');
  await e.capture('01-upload'); await page.getByRole('button', { name: '下一步：規劃文案', exact: true }).click();
  await plan(page, e); await visual(page, ['main']); await generate(page, e); const m = await bundle(page, e, ['main']);
  expect(m.product.sourceOrigin).toBe('uploaded');
  const original = await fs.readFile(path.resolve('public/samples/food.png'));
  expect(e.source!.sha256).toBe(crypto.createHash('sha256').update(original).digest('hex'));
  e.checks.push('使用真實檔案選擇器路徑；下載保留上傳原檔，不只測範例按鈕。');
});

const uploadErrors = [
  { id: 'empty', title: '空檔案', file: { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) }, expected: '這是空白檔案' },
  { id: 'unsupported', title: '不支援的 SVG', file: { name: 'image.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') }, expected: '不支援這個檔案' },
  { id: 'spoofed', title: '偽裝副檔名', file: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('This is not a PNG file.') }, expected: '不支援這個檔案' },
  { id: 'corrupt', title: '損壞 PNG', file: { name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]) }, expected: '圖片無法讀取' },
  { id: 'oversize', title: '超過 7 MB', file: { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(7 * 1024 * 1024 + 1, 1) }, expected: '圖片超過 7 MB' },
];
for (const entry of uploadErrors) {
  test(`upload-${entry.id} 上傳 ${entry.title} 顯示原因且可恢復`, async ({ page, evidence: e }) => {
    e.kind = 'validation'; await open(page);
    await page.getByLabel('上傳商品照片', { exact: true }).setInputFiles(entry.file);
    await expect(page.getByRole('alert')).toContainText(entry.expected);
    await e.capture('01-rejected');
    await page.getByRole('button', { name: `使用 ${names.food} 範例`, exact: true }).click();
    await page.getByRole('button', { name: '下一步：規劃文案', exact: true }).click();
    await expect(page.getByRole('button', { name: '依商品資料整理（免費）', exact: true })).toBeVisible();
    e.checks.push(`已阻擋${entry.title}且顯示具體原因；換用有效商品圖可繼續。`);
    await e.capture('02-recovered');
  });
}

test('source-required 未上傳圖片不能前往規劃', async ({ page, evidence: e }) => {
  e.kind = 'validation'; await open(page);
  await page.getByRole('button', { name: '下一步：規劃文案', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('請先上傳一張商品照片');
  await expect(page.getByRole('button', { name: '下一步：規劃文案', exact: true })).toBeVisible();
  await e.capture('01-required'); e.checks.push('缺少商品圖片時流程停留在資料步驟並說明原因。');
});

test('zero-copy 不勾選文案時阻擋出圖', async ({ page, evidence: e }) => {
  e.kind = 'validation'; await product(page, e, 'food'); await plan(page, e);
  for (const checkbox of await page.getByRole('checkbox', { name: /^選取文案 / }).all()) await checkbox.uncheck();
  await page.getByRole('button', { name: '下一步：視覺設定', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('至少'); await e.capture('03-no-selection');
  e.checks.push('全部取消勾選後無法進入生成設定，不會產生空素材包。');
});

test('selection-one 只輸出勾選的文案且保留修改', async ({ page, evidence: e }) => {
  e.kind = 'detail'; await product(page, e, 'beauty'); await plan(page, e);
  await page.getByLabel('標題 1', { exact: true }).fill('A carefully edited title');
  const selections = await page.getByRole('checkbox', { name: /^選取文案 / }).all();
  for (const checkbox of selections.slice(1)) await checkbox.uncheck();
  await visual(page, ['detail']); await generate(page, e); const m = await bundle(page, e, ['detail']);
  expect(m.outputs).toHaveLength(1); expect(m.outputs[0].copy.title).toBe('A carefully edited title');
  const copy = await fs.readFile(path.join(e.directory, 'copy.txt'), 'utf8');
  expect(copy).toContain('A carefully edited title'); expect(copy).not.toContain(m.sections[1].title);
  e.checks.push('只勾選第 1 段時只輸出 1 張詳情圖；完整文案檔不混入未勾選段落。');
});

test('long-copy 長文案可見截斷提醒且下載保留全文', async ({ page, evidence: e }) => {
  e.kind = 'detail'; await product(page, e, 'fashion'); await plan(page, e);
  const longText = 'W'.repeat(1200);
  await page.getByLabel('文案 1', { exact: true }).fill(longText);
  const selections = await page.getByRole('checkbox', { name: /^選取文案 / }).all();
  for (const checkbox of selections.slice(1)) await checkbox.uncheck();
  await visual(page, ['detail'], { layout: '圖文分欄' }); await generate(page, e);
  const m = await bundle(page, e, ['detail']);
  await expect(page.getByText('文字超出此模組', { exact: false }).first()).toBeVisible();
  expect(m.outputs[0].warning).toContain('文字超出');
  expect(m.outputs[0].copy.body).toBe(longText); expect(await fs.readFile(path.join(e.directory, 'copy.txt'), 'utf8')).toContain(longText);
  e.checks.push('超長文字未靜默遺失：畫面說明省略，下載 JSON 與文字檔保留全部內容。');
});

test('cancel-and-retry 取消短片生成後可重新生成', async ({ page, evidence: e }) => {
  e.kind = 'recovery'; await product(page, e, 'fashion'); await plan(page, e);
  const longVideoCopy = 'W'.repeat(1200);
  await page.getByLabel('文案 1', { exact: true }).fill(longVideoCopy);
  await visual(page, ['video']);
  await page.getByRole('button', { name: '開始生成', exact: true }).click();
  await page.getByRole('button', { name: '停止等待', exact: true }).click();
  await expect(page.getByText(/已停止|已取消/).first()).toBeVisible(); await e.capture('03-cancelled');
  await page.getByRole('button', { name: '修改設定', exact: true }).click();
  await page.getByRole('button', { name: '開始生成', exact: true }).click();
  await expect(page.getByText('素材已完成', { exact: true })).toBeVisible({ timeout: 30_000 });
  const manifest = await bundle(page, e, ['video']); await e.capture('04-retried');
  expect(manifest.outputs[0].warning).toContain('文字超出可讀範圍');
  expect(manifest.outputs[0].copy.body).toBe(longVideoCopy);
  e.checks.push('在實際 MediaRecorder 工作進行時取消，再次產出有效短片。');
  e.checks.push('短片包含 1200 字長文案時顯示省略提醒，完整文字仍保留在下載包。');
});

test('injected-copy-failure 明確注入錯誤後可改用免費規劃', async ({ page, evidence: e }) => {
  e.kind = 'recovery'; e.mode = 'mocked API failure, explicit free local recovery; no paid provider request';
  await product(page, e, 'food');
  await page.getByRole('button',{name:'模型與連線',exact:true}).click();
  await choose(page,'生成模式','live','Google 模型 · 真實生成');
  await page.getByRole('button',{name:'完成設定',exact:true}).click();
  await page.route('**/api/copy', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'E2E 注入：模型服務暫時無法使用，請重試。' } }) }), { times: 1 });
  await page.getByRole('checkbox',{name:'同意本次付費文案',exact:true}).check();
  await page.getByRole('button',{name:'AI 規劃文案（付費）',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('E2E 注入'); await e.capture('02-injected-error');
  await page.getByRole('button',{name:'改用免費規劃',exact:true}).click();
  await expect(page.getByLabel('標題 5',{exact:true})).toBeVisible();
  await visual(page, ['main']); await generate(page, e); await bundle(page, e, ['main']);
  e.checks.push('503 完全由測試攔截回應；沒有送到 Google。使用者明確改用免費規劃後完成下載。');
});

test('mobile-flow 手機尺寸可完成商品圖生成與下載', async ({ page, evidence: e }) => {
  e.kind = 'responsive'; await page.setViewportSize({ width: 390, height: 844 });
  await product(page, e, 'food', 'zh-TW'); await plan(page, e); await visual(page, ['main']); await generate(page, e); await bundle(page, e, ['main']);
  const bounds = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
  e.checks.push('390 px 手機寬度完成整段操作與下載，頁面沒有水平溢出。');
});

test('cross-product-isolation 生成中禁止切換商品，下載來源仍屬於原商品', async ({ page, evidence: e }) => {
  e.kind = 'recovery';
  const setup: Evidence = { ...e, directory: path.join(e.directory, 'setup-product-b'), checks: [], screenshots: [], downloads: [], warnings: [], capture: async name => {
    const file = `setup-product-b/${name}.png`; await page.screenshot({ path: path.join(e.directory, file), fullPage: true }); e.screenshots.push(file);
  } };
  await fs.mkdir(setup.directory, { recursive: true });
  await product(page, setup, 'beauty', 'en'); await plan(page, setup); await visual(page, ['main']); await generate(page, setup);
  const saved = await bundle(page, setup, ['main']);
  await page.getByRole('button', { name: '儲存到商品列表', exact: true }).click();
  await page.getByRole('button', { name: /^商品列表/ }).click();
  await expect(page.getByRole('button', { name: '繼續編輯 ' + names.beauty, exact: true })).toBeVisible();
  e.supportingRuns = [{ label: '先建立並儲存商品 B，讓跨商品切換成為真實可發生的情境。', folder: 'setup-product-b', manifest: saved, source: setup.source!, outputs: setup.outputs! }];
  await page.getByRole('button', { name: '新建商品', exact: true }).first().click();
  // Start product A without reloading: B remains available in the same local library.
  e.category = 'food'; e.language = 'en';
  await page.getByRole('button', { name: `使用 ${names.food} 範例`, exact: true }).click();
  await expect(page.getByLabel('商品名稱', { exact: true })).toHaveValue(names.food);
  await choose(page, '輸出語言', 'en', 'English'); await e.capture('01-source-a');
  await page.getByRole('button', { name: '下一步：規劃文案', exact: true }).click();
  await plan(page, e); await visual(page, ['video']);
  await page.getByRole('button', { name: '開始生成', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止等待', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^商品列表/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: '新建商品', exact: true })).toBeDisabled();
  await e.capture('03-switch-blocked');
  await expect(page.getByRole('heading', { name: '素材已完成', exact: true })).toBeVisible({ timeout: 30_000 });
  const m = await bundle(page, e, ['video']);
  expect(m.product.name).toBe(names.food); expect(m.product.id).not.toBe(saved.product.id);
  expect(m.outputs.every((output: any) => output.sourceId === m.product.id)).toBe(true);
  await e.capture('04-source-a-results');
  e.checks.push('商品 B 事先在同一瀏覽器的商品列表可開啟；商品 A 的短片工作進行中，列表與新建入口均停用。');
  e.checks.push('完成後下載 manifest、原圖雜湊及全部素材 sourceId 仍屬於商品 A，沒有混入商品 B。');
});
