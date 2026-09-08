import { test as base, expect, type Page, type Response } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

type Category = 'food' | 'beauty' | 'fashion';
type RecordValue = Record<string, any>;
type LiveEvidence = {
  id: string; title: string; directory: string; startedAt: string; mode: string;
  runType: 'live-ui' | 'remote-demo-ui'; category?: Category; language?: string; kind: string;
  checks: string[]; screenshots: string[]; warnings: string[]; api: RecordValue[];
  downloads: string[]; outputs: RecordValue[]; rawGeneratedAssets: RecordValue[];
  consoleErrors: string[]; pending: Promise<void>[]; manifest?: RecordValue; source?: RecordValue;
  copyResult?: RecordValue; error?: string; status?: string; elapsedMs?: number;
  deployment?: string; credential: string; capture: (name: string) => Promise<void>;
};
const names = { food: 'MORI 焙茶', beauty: 'SORA 日常精華', fashion: 'PLAIN 日常休閒鞋' };
const scrub = (text: string, secret: string) => secret ? text.replaceAll(secret, '[REDACTED]') : text;
const pngSize = (data: Buffer) => ({ width: data.readUInt32BE(16), height: data.readUInt32BE(20) });
const endpoint = (response: Response, route: string) => new URL(response.url()).pathname.endsWith('/' + route) && response.request().method() === 'POST';
async function choose(page: Page, name: string | RegExp, value: string, option: string | RegExp) {
  const control = page.getByRole('combobox', { name, exact: typeof name === 'string' });
  if (await control.evaluate((node) => node.tagName === 'SELECT')) await control.selectOption(value);
  else { await control.click(); await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click(); }
}

const test = base.extend<{ evidence: LiveEvidence }>({
  evidence: async ({ page }, use, info) => {
    const start = Date.now();
    const id = info.title.split(' ')[0];
    const directory = path.resolve('artifacts/e2e', id);
    // Preserve previous live attempts and outputs; repeating a paid call must not erase its evidence.
    try {
      await fs.access(directory);
      const previous = path.resolve('artifacts/live-attempts', `${id}-${new Date().toISOString().replaceAll(':', '-')}`);
      await fs.mkdir(path.dirname(previous), { recursive: true }); await fs.rename(directory, previous);
    } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    await fs.mkdir(directory, { recursive: true });
    const e: LiveEvidence = {
      id, title: info.title, directory, startedAt: new Date().toISOString(),
      mode: 'real Gemini API via local HTTP backend', runType: 'live-ui', kind: 'detail',
      checks: [], screenshots: [], warnings: [], api: [], downloads: [], outputs: [], rawGeneratedAssets: [],
      consoleErrors: [], pending: [], credential: '',
      capture: async (name) => {
        // No screenshot while the credential settings dialog is open.
        if (await page.locator('dialog[open]').count()) throw new Error('Evidence capture blocked while a dialog is open.');
        await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true }); e.screenshots.push(`${name}.png`);
      },
    };
    page.on('pageerror', (error) => e.consoleErrors.push(scrub(error.message, e.credential)));
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (!['copy', 'image', 'products', 'jobs', 'health'].some((route) => url.pathname.endsWith('/' + route))) return;
      const record: RecordValue = { path: url.pathname, method: response.request().method(), status: response.status() };
      e.api.push(record);
      const pending = (async () => {
        try {
          if (response.request().method() === 'OPTIONS' || response.status() === 204) return;
          const data = await response.json();
          record.provider = data.provider; record.model = data.model; record.durationMs = data.durationMs;
          if (endpoint(response, 'copy') && response.ok()) {
            e.copyResult = { sections: data.sections, provider: data.provider, model: data.model, durationMs: data.durationMs, language: data.language };
            await fs.writeFile(path.join(directory, 'copy-model-response.json'), JSON.stringify(e.copyResult, null, 2));
          }
          if (endpoint(response, 'image') && response.ok() && typeof data.dataUrl === 'string') {
            const match = data.dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
            if (!match) throw new Error('Model image data URL is malformed.');
            const buffer = Buffer.from(match[2], 'base64');
            const file = `model-responses/${String(e.rawGeneratedAssets.length + 1).padStart(2, '0')}-model-image.${match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg'}`;
            await fs.mkdir(path.join(directory, 'model-responses'), { recursive: true });
            await fs.writeFile(path.join(directory, file), buffer);
            const dimensions = match[1] === 'image/png' ? pngSize(buffer) : await page.evaluate((source) => new Promise<{width: number; height: number}>((resolve, reject) => { const img = new Image(); img.onload = () => resolve({width: img.naturalWidth, height: img.naturalHeight}); img.onerror = () => reject(new Error('Model image decode failed.')); img.src = source; }), data.dataUrl);
            const request = response.request().postDataJSON();
            e.rawGeneratedAssets.push({ file, ...dimensions, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), mimeType: match[1], provider: data.provider, model: data.model, durationMs: data.durationMs, prompt: request.prompt, requestedAspectRatio: request.aspectRatio, requestedImageSize: request.imageSize, assetId: data.assetId, jobId: data.jobId });
          }
        } catch (error) {
          e.warnings.push(scrub(error instanceof Error ? error.message : 'Response evidence capture failed.', e.credential));
        }
      })();
      e.pending.push(pending);
    });
    await use(e);
    await Promise.allSettled(e.pending);
    if (info.status !== 'passed' && !e.outputs.length) {
      // Keep any finished files even when a later image or assertion fails.
      try {
        const download = page.getByRole('button', { name: '下載全部素材', exact: true });
        if (await download.count() && await download.isEnabled()) {
          await downloadAll(page, e, undefined, e.runType === 'live-ui');
          e.warnings.push('本案例未通過，但已保留當時可下載的部分成品；不可視為整套生成成功。');
        }
      } catch { e.warnings.push('未完成案例的成品包無法擷取；已回傳的原始模型圖片仍保留於本案。'); }
    }
    e.elapsedMs = Date.now() - start; e.status = info.status; e.error = scrub(info.errors.map((error) => error.message || '').join('\n'), e.credential);
    if (info.status !== 'passed') await e.capture('failure').catch(() => undefined);
    const { capture, credential, pending, directory: _directory, ...record } = e;
    await fs.writeFile(path.join(directory, 'evidence.json'), JSON.stringify(record, null, 2));
    await info.attach('live-evidence-without-credentials', { path: path.join(directory, 'evidence.json'), contentType: 'application/json' });
  },
});

async function selectLiveMode(page: Page, e: LiveEvidence) {
  e.credential = (await fs.readFile(path.resolve(process.env.E2E_ACCESS_CODE_FILE || '.local-data/workspace-access-code.txt'), 'utf8')).trim();
  if (!e.credential) throw new Error('The private workspace access-code file is empty.');
  await page.getByRole('button', { name: '模型與連線', exact: true }).click();
  await choose(page, '生成模式', 'live', /Google.*真實生成/);
  const input = page.getByLabel(/^工作室連線代碼/);
  await expect(input).toBeVisible();
  try { await input.fill(e.credential); }
  catch { throw new Error('Could not fill the private workspace access code; details withheld.'); }
  await page.getByRole('button', { name: '完成設定', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

async function startProduct(page: Page, e: LiveEvidence, category: Category, language: string, live = true, baseURL?: string) {
  e.category = category; e.language = language;
  await page.goto(baseURL || '/');
  await expect(page.getByRole('button', { name: '下一步：規劃文案', exact: true })).toBeVisible();
  if (live) await selectLiveMode(page, e);
  await page.getByRole('button', { name: `使用 ${names[category]} 範例`, exact: true }).click();
  await expect(page.getByRole('textbox', { name: '商品名稱', exact: true })).toHaveValue(names[category]);
  await choose(page, '輸出語言', language, language === 'ja' ? '日本語' : 'English');
  await choose(page, /^分發平台/, 'Amazon', 'Amazon');
  await e.capture('01-source');
  await page.getByRole('button', { name: '下一步：規劃文案', exact: true }).click();
  let result:any;
  if(live){
    await page.getByRole('checkbox',{name:'同意本次付費文案',exact:true}).check();
    const promised=page.waitForResponse(response=>endpoint(response,'copy'),{timeout:180_000});
    await page.getByRole('button',{name:'AI 規劃文案（付費）',exact:true}).click();
    const response=await promised;expect(response.status()).toBe(200);result=await response.json();expect(result.provider).toBe('gemini-api');expect(result.model).toBe('gemini-3.7-flash');
  }else{await page.getByRole('button',{name:'依商品資料整理（免費）',exact:true}).click();result={provider:'demo'};}
  await expect(page.getByLabel('標題 1',{exact:true})).not.toHaveValue('');
  await e.capture('02-copy');e.checks.push(live?'明確確認付費後，從 App 操作 Gemini 文案規劃並核對 HTTP 回應。':'從 App 本機建立免費套圖規劃，不呼叫模型 API。');

  return result;
}

async function downloadAll(page: Page, e: LiveEvidence, expectedCount: number | undefined, live = true) {
  const promised = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: '下載全部素材', exact: true }).click();
  const download = await promised; await download.saveAs(path.join(e.directory, 'bundle.zip'));
  const zip = await JSZip.loadAsync(await fs.readFile(path.join(e.directory, 'bundle.zip')));
  for (const [file, item] of Object.entries(zip.files)) {
    if (item.dir) continue;
    if (path.isAbsolute(file) || file.includes('..')) throw new Error('Unsafe ZIP entry.');
    await fs.mkdir(path.dirname(path.join(e.directory, file)), { recursive: true }); await fs.writeFile(path.join(e.directory, file), await item.async('nodebuffer'));
  }
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')); e.manifest = manifest;
  e.downloads.push('bundle.zip', 'manifest.json', 'copy.txt');
  if (zip.file('detail-page.html')) e.downloads.push('detail-page.html');
  const sourceFile = Object.keys(zip.files).find((name) => /^source\/original\./.test(name))!;
  const source = await zip.file(sourceFile)!.async('nodebuffer');
  e.source = { file: sourceFile, ...pngSize(source), bytes: source.length, sha256: crypto.createHash('sha256').update(source).digest('hex') };
  const original = await fs.readFile(path.resolve(`public/samples/${e.category}.png`));
  for (const output of manifest.outputs) {
    const bytes = await zip.file(output.file)!.async('nodebuffer');
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const size = pngSize(bytes);
    e.outputs.push({ ...output, actualWidth: size.width, actualHeight: size.height, actualBytes: bytes.length });
  }
  await Promise.allSettled(e.pending);
  expect(manifest.settings.mode).toBe(live ? 'live' : 'demo');
  if (expectedCount !== undefined) expect(manifest.outputs).toHaveLength(expectedCount);
  expect(e.source.sha256).toBe(crypto.createHash('sha256').update(original).digest('hex'));
  for (const output of e.outputs) {
    expect({ width: output.actualWidth, height: output.actualHeight }).toEqual({ width: output.width, height: output.height });
    expect(output.actualBytes).toBe(output.bytes); expect(output.provider).toBe(live ? 'gemini-api' : 'demo-compositor');
    if (live) expect(output.model).toBe('gemini-3.1-flash-image');
  }
  if (live) {
    if (expectedCount !== undefined) expect(e.rawGeneratedAssets).toHaveLength(expectedCount);
    for (let index = 0; index < manifest.outputs.length; index++) {
      const output = manifest.outputs[index];
      expect(output.rawFile).toMatch(/^raw-ai\//);
      const raw = await zip.file(output.rawFile)!.async('nodebuffer');
      expect(crypto.createHash('sha256').update(raw).digest('hex')).toBe(e.rawGeneratedAssets[index].sha256);
      expect(output.nativeWidth).toBe(e.rawGeneratedAssets[index].width);
      expect(output.nativeHeight).toBe(e.rawGeneratedAssets[index].height);
      expect(output.rawGenerated.bytes).toBe(raw.length);
    }
    e.checks.push('App 原生 ZIP 的 raw-ai 原圖雜湊與截取的模型 HTTP 回應相同；模型原生尺寸與最終組版尺寸分開記錄。');
  }
  e.checks.push(`下載與解壓 ${manifest.outputs.length} 張最終 PNG，核對像素、檔案大小與原圖雜湊。${live ? '每張另保存模型原始回傳圖與實際模型 ID。' : ''}`);
}

const paidTest = process.env.E2E_ALLOW_PAID === '1' ? test : test.skip;
for (const spec of [
  { id: 'live-food-en-banner', category: 'food', language: 'en', kind: 'banner', count: 1 },
  { id: 'live-beauty-en-detail', category: 'beauty', language: 'en', kind: 'detail', count: 2 },
  { id: 'live-fashion-ja-detail', category: 'fashion', language: 'ja', kind: 'detail', count: 2 },
] as const) {
  paidTest(`${spec.id} 真實 Gemini UI：${names[spec.category]} ${spec.language} ${spec.kind}`, async ({ page, evidence: e }) => {
    e.kind = spec.kind;
    try {
      const result = await startProduct(page, e, spec.category, spec.language);
      expect(result.sections.length).toBeGreaterThanOrEqual(spec.count);
      const boxes = await page.getByRole('checkbox', { name: /^選取文案 / }).all();
      for (let i = 0; i < boxes.length; i++) await boxes[i].setChecked(spec.kind==='banner'?i===0:['hero','lifestyle'].includes(result.sections[i].role));
      await page.getByRole('button', { name: '下一步：視覺設定', exact: true }).click();
      const labels = { main: '商品主圖', detail: '商品詳情圖', banner: 'Banner', video: '帶貨短片' };
      for (const [kind, label] of Object.entries(labels)) await page.getByRole('checkbox', { name: new RegExp('^' + label) }).setChecked(kind === spec.kind);
      await page.getByRole('button', { name: spec.category === 'beauty' ? '清透棚拍' : '自然留白', exact: true }).click();
      await page.getByRole('button', { name: '1K', exact: true }).click();
      await e.capture('03-settings');
      await page.getByRole('checkbox',{name:'同意本次付費生成',exact:true}).check();
      await page.getByRole('button', { name: '開始 AI 生成（付費）', exact: true }).click();
      await expect(page.getByRole('heading', { name: '素材已完成', exact: true })).toBeVisible({ timeout: 240_000 });
      await e.capture('04-results');
      await downloadAll(page, e, spec.count);
      expect(e.consoleErrors).toEqual([]);
      expect(e.api.filter((request) => request.path.endsWith('/image') && request.method === 'POST' && request.status === 200)).toHaveLength(spec.count);
      e.checks.push('真實模型成功後沒有自動降級為示範結果；文案與圖片供應商、模型均由 HTTP 回應核對。');
    } catch (error) { throw new Error(scrub(error instanceof Error ? error.message : String(error), e.credential)); }
  });
}

// The remote URL is supplied only after the user's personal Vercel deployment is verified.
const remoteUrl = process.env.E2E_REMOTE_BASE_URL;
if (remoteUrl) {
  test('remote-personal-supabase-ui 個人 Vercel → Supabase → 圖片下載與同步', async ({ page, evidence: e }) => {
    const remote = new URL(remoteUrl);
    expect(remote.protocol).toBe('https:');
    expect(remote.hostname).toBe(process.env.E2E_EXPECTED_REMOTE_HOST);
    e.runType = 'remote-demo-ui'; e.mode = 'personal Vercel frontend + actual Supabase backend, demo composition'; e.deployment = remote.origin; e.kind = 'remote';
    await startProduct(page, e, 'food', 'en', false, remote.origin);
    await page.getByRole('button', { name: '下一步：視覺設定', exact: true }).click();
    for (const label of ['商品詳情圖', 'Banner', '帶貨短片']) await page.getByRole('checkbox', { name: new RegExp('^' + label) }).uncheck();
    await page.getByRole('checkbox', { name: /^商品主圖/ }).check();
    await page.getByRole('button', { name: '開始生成', exact: true }).click();
    await expect(page.getByRole('heading', { name: '素材已完成', exact: true })).toBeVisible({ timeout: 30_000 });
    await e.capture('03-remote-results'); await downloadAll(page, e, 1, false);
    const synchronized = page.waitForResponse((response) => endpoint(response, 'products'), { timeout: 60_000 });
    await page.getByRole('button', { name: '同步商品到 Supabase', exact: true }).click();
    const result = await synchronized;
    expect(result.status()).toBe(201); expect(new URL(result.url()).hostname).toMatch(/\.supabase\.co$/);
    await expect(page.getByRole('status').filter({ hasText: '商品資料與來源照片已同步到 Supabase' })).toBeVisible();
    await e.capture('04-remote-synced');
    const body = await result.json();
    await fs.writeFile(path.join(e.directory, 'remote-sync-response.json'), JSON.stringify({ status: result.status(), productId: body.product?.id || body.id, storage: 'Supabase', origin: new URL(result.url()).origin }, null, 2));
    e.checks.push('從使用者個人 Vercel 部署完成實際 UI 操作、Supabase 文案回應、PNG ZIP 下載與商品／來源照片同步（201）。');
    e.checks.push('遠端本案例為示範組版，沒有在 Supabase 宣稱真實 Gemini 呼叫成功。');
  });
}
