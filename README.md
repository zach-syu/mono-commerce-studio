# Mono Commerce Studio

從一張商品照片，完成可編輯文案、商品主圖、詳情頁、Banner 與短片。

[開啟個人部署](https://mono-commerce-studio-ashy.vercel.app) · [七類商品對標報告](https://mono-commerce-studio-ashy.vercel.app/report/benchmark-v3/index.html) · [前版對照](https://mono-commerce-studio-ashy.vercel.app/report/layout-v2/index.html)

預設提供免費規劃與瀏覽器組版。v3 支援 1–16 張詳情圖、13 種圖種與六大品類，並以美妝、食品、衣服、背包、家電、保健食品和鞋類做七組對標。14 張情境樣張由對話內建 image_gen 工具製作；App 驗收沒有呼叫使用者的 Google API。Google 圖像品質本輪未實測。

介面採用 [CYBERBIZ Pitaya UI](https://www.npmjs.com/package/@cyberbiz-corp/pitaya-ui)。前端可部署到 Vercel，後端提供 Supabase Edge Functions、Postgres 與私有 Storage。本機與 Supabase 使用同一份 API handler。

## 快速啟動

需要 Node.js 22.12 以上，建議 Node.js 24。先安裝套件：

```sh
npm ci
```

開兩個終端機，分別執行：

```sh
npm run dev:api
```

```sh
npm run dev
```

開啟 `http://127.0.0.1:5173`。未設定金鑰時預設是示範模式，可實際上傳、編輯、組圖、產生 8 秒 WebM、保存商品列表及下載 ZIP。示範模式不會呼叫付費模型。

## 操作流程

1. 上傳不超過 7 MB 的 PNG／JPEG／WebP，或選食品、美妝、休閒鞋範例。
2. 設定 Shopee、Amazon、Momo、PChome 或其他渠道，以及繁中、英文、日文或韓文。
3. 設定「詳情圖張數」，按「免費規劃套圖」。每張可改圖種、標題、內文與畫面方向。已有文案時按「套用張數」，縮減只取消勾選，保留已編輯內容。
4. 選擇調性、版型、輸出類型、1K／2K／4K，查看免費套圖預覽。Banner 可選 16:9 或 21:9。
5. 逐張預覽。下載 ZIP，或保存在商品列表。來源照片與商品資料也可同步至 Supabase。

ZIP 內有 `source/` 原圖、`outputs/` 最終素材、`copy.txt` 完整文案、`manifest.json` 生成紀錄，以及可直接開啟的 `detail-page.html`。真實生圖另外保留 `raw-ai/` 模型原始圖片，不只保留最終排版。

免費模式使用原圖、局部裁切與本機圖解。指定品牌的已保存情境樣張會明確標示；也可上傳完全相同的對標原圖，由 SHA-256 比對識別。其他上傳圖片不會被換成不同商品。沒有場景素材時會標示缺項，不能當成真實情境品質通過。免費輸出留在瀏覽器，需同步時可手動按「同步商品到 Supabase」。詳見 [v3 規劃與驗收說明](docs/BENCHMARK-V3.md)。

## 真實模型

| 用途 | 模型 ID | 呼叫方式 |
|---|---|---|
| 文案 | `gemini-3.7-flash` | Vertex `generateContent`，結構化 JSON |
| Nano Banana 2 | `gemini-3.1-flash-image` | Vertex `generateContent`，圖片＋文字 parts |
| 影片 | `veo-3.1-generate-001` | 標準 Vertex 非同步生成與輪詢 |

Veo 3.0 已在官方生命周期表列為退役，因此介面明確標示 Veo 3.1。影片需要標準 Vertex 專案與存取憑證，不能只憑一把 Gemini Developer API Key 保證可用。

把 `.env.example` 複製為 `.env.mono.local`，只填需要的伺服器設定：

```dotenv
MONO_GOOGLE_PROVIDER=vertex
VERTEX_API_KEY=your_vertex_express_key
MONO_LIVE_ACCESS_CODE=your_random_access_code_at_least_16_characters
```

標準 Vertex 可改用 `GOOGLE_CLOUD_PROJECT` 與 `VERTEX_ACCESS_TOKEN`。Access token 會過期；持續營運應接正式的 workload identity／自動更新憑證。

若金鑰來自 Google AI Studio，需**明確**啟用替代連線：

```dotenv
MONO_GOOGLE_PROVIDER=gemini-api
MONO_GEMINI_API_KEY=your_gemini_developer_key
MONO_LIVE_ACCESS_CODE=your_random_access_code_at_least_16_characters
```

重啟後端，在 App「模型與連線」選真實模型，填入工作室連線代碼。此代碼不是 Google API Key。Google 金鑰只存在後端。每次付費文案／生成前都需勾選同意；不想付費時可選「免費規劃」或「免費預覽並下載」。供應商失敗時會顯示錯誤，**不會偷偷改用示範結果**。

完整 request／response、支援比例與官方來源見 [MODEL-CONTRACTS.md](docs/MODEL-CONTRACTS.md)。

## 測試與全部產出

```sh
npm run build
npm test
npm run test:e2e
npm run test:preview
npm run test:benchmark
npm run test:benchmark-report
npm run test:layout-report
```

E2E 使用真實瀏覽器與本機 HTTP API。已安裝 Chrome 時可直接使用；其他環境執行 `npx playwright install chromium`。自動化測試使用獨立瀏覽器資料，不讀取日常 Chrome profile。

預設 E2E 後端強制 `MONO_DISABLE_LIVE=1`，即使本機設定了金鑰也會在呼叫前拒絕。新版套圖測試另封鎖所有外部請求。`tests/live.e2e.spec.ts` 的付費案例預設跳過，只有明確授權並設定 `E2E_ALLOW_PAID=1` 才能執行；本輪未啟用。

- [HTML 測試報告](public/report/index.html)：逐案截圖、原圖與成品對照、尺寸、下載檔、失敗發現與建議。
- [套圖 v2 修正對照](public/report/layout-v2/index.html)：三類商品、21 張免費圖片、五種用途、來源標示與防止誤付費測試。
- [七類商品對標報告](public/report/benchmark-v3/index.html)：70 張成品、14 張新情境、官方參考頁、完整 Prompt、張數與編輯測試。ZIP 另外保留 scene-sources 原始場景。
- `artifacts/e2e/`：當次測試的完整證據與 ZIP；由測試重建。
- `public/report/`：可部署、可離線查看的報告副本與全部附件。
- [AI 範例來源紀錄](docs/sample-provenance.json)：7 次開發期圖片生成的完整 prompts、參考關係、尺寸與檔案雜湊。

測試區分示範流程、API 合約測試、真實模型 UI E2E 與 Supabase 整合。詳細通過數與實際執行時間以最新報告為準。合約測試包含注入的供應商回應，不能當作真實模型證據。

## Supabase 部署

先在正確帳號建立或選擇專案。執行專案 migration 會建立獨立 `mono_products`、`mono_jobs` 及 `mono-assets`，不使用其他 App 的表。

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set --project-ref YOUR_PROJECT_REF --env-file .env.mono.local
supabase functions deploy mono-api --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

`verify_jwt=false` 是因為 handler 實作獨立的私人工作區驗證：每個瀏覽器持有隨機 256-bit token，後端取 hash 作資料擁有者。付費模型另需伺服器設定的存取代碼。資料表啟用 RLS 並撤销公開資料 API 權限；bucket 為私有。

這是可攜的單人工作室驗證版。清除瀏覽器資料會失去工作區 token，無法自動恢復原工作區。已加入 Supabase 原子共用額度：每天最多 500 次寫入請求、100 MiB 新增素材處理量，以 UTC 日期重設。更換工作區識別碼不會重置此共用額度。管理者可用 MONO_DAILY_REQUEST_LIMIT 與 MONO_DAILY_ASSET_BYTES 調整。正式多人服務仍應加入帳號登入、恢復、組織權限與個別使用者額度。

## Vercel 部署

在**正確個人團隊**匯入此 repo，Framework 選 Vite。設定公開環境變數：

```dotenv
VITE_API_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/mono-api
VITE_POSTHOG_KEY=your_public_project_ingestion_token
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

把實際前端 origin 加入 Supabase `MONO_ALLOWED_ORIGINS`。`.vercelignore` 會排除模型設定、本機資料、測試 trace 與後端原始碼，只上傳前端建置需要的檔案。Google 金鑰不要放進 Vercel 前端環境。

## PostHog

只追蹤 `mono_` 前綴的明確流程事件，例如載入商品、文案完成、生成完成與下載。屬性限類型、語言、平台、模式、張數、解析度與耗時。不要傳商品名稱、文案、圖片、Prompt 或工作室代碼。未設定公開 project token 時不發送事件。

實作不啟用自動擷取或 session replay，並使用短暫匿名識別碼。流程不會因分析服務故障而中斷。[PostHog Capture API](https://posthog.com/docs/api/capture)

## 專案結構

```text
src/                         前端、Pitaya 元件、瀏覽器組版與下載
shared/                      前後端共用的免費文案規劃
public/benchmarks/v3/         指定商品原圖、已保存 AI 場景、工具紀錄與來源參考
server/                      本機 API 與檔案持久化
supabase/functions/_shared/  兩個環境共用的 schema、provider 與處理邏輯
supabase/functions/mono-api/ Supabase 部署入口
supabase/migrations/         獨立資料表、RLS 與 Storage
tests/                       API 與端到端測試
public/samples/              原始 AI 範例與情境圖
public/report/               驗收報告與所有附件
docs/                       影片研究、API 合約與來源紀錄
```

## 已知範圍

- 1K／2K／4K 是最終組版的最長邊 1024／2048／4096 px。真實模型的原生尺寸另外記錄，放大不能補出不存在的細節。
- 商品主圖、詳情與 Banner 使用不同構圖。這些是起始設定，不表示平台已核准上架。
- 模型仍可能改變產品標籤、形狀或添加不實道具。請逐張確認，不能僅憑檔案生成成功就判定產品一致。
- 長文字會在可讀字級下截斷並提示；完整原文仍在 ZIP。請縮短後重做。
- 示範影片是瀏覽器原圖動態排版，沒有配音。真實 Veo 接口與錯誤處理已實作，憑證可用性與實測狀態見報告。
- 原始碼採 MIT；第三方套件保留各自授權。沒有專屬平台鎖定，本機可獨立執行。

## 資安檢查狀態

重要模型金鑰與 Supabase service-role 金鑰只在後端使用。前端 PostHog project token 是公開事件寫入憑證，不是管理 token。已修正共用額度與上傳失敗清理問題，並以測試驗證。這不是正式資安認證。依賴稽核仍有 5 筆中度 package entries，主要来自 Pitaya 的相依套件；目前沒有證明其弱點能經本 App 的元件路徑利用，正式上線前需進一步處理。

原始檢查見 [修正前掃描報告](docs/SECURITY-SCAN-BEFORE-FIX.md)，目前修正狀態見 E2E 報告。
