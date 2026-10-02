# 模型與後端合約

規格查核日期：2026-09-08。官方文件已查證；真實模型帳號權限、帳單與輸出品質必須由 live smoke test 另外驗證。通過 mock contract test 不代表 Google live 測試通過。

## 模型

| 用途 | 實作 model ID | 狀態 |
| --- | --- | --- |
| 文案 | `gemini-3.7-flash` | GA，2026-08-13 發布 |
| Nano Banana 2 | `gemini-3.1-flash-image` | GA，2026-05-28 發布 |
| 影片 | `veo-3.1-generate-001` | 使用者提到 Veo 3；3.0 已退役，明確顯示 3.1 |

官方 lifecycle 將 `veo-3.0-generate-001` 與 `veo-3.0-fast-generate-001` 列為 2026-06-30 退役。部分操作指南仍列舊 ID，本專案依 lifecycle 實作，不自動切換到其他供應商。

來源：[Gemini 3.7](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-7-flash)、[Nano Banana 2](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image)、[模型生命周期](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions)。

## 伺服器設定

所有 secret 只放 `.env.local` 或 Supabase Edge Function secrets。不可使用 `VITE_` 前綴，不可提交 GitHub。

| 變數 | 用途 |
| --- | --- |
| `MONO_GOOGLE_PROVIDER` | `vertex`（預設）或明確選擇 `gemini-api`；不會因錯誤自動切换 |
| `MONO_GEMINI_API_KEY` | Gemini Developer API 的隔離 secret，僅選 gemini-api 時使用，優先於 `GEMINI_API_KEY` |
| `GEMINI_API_KEY` | 本機已有的 Developer key 備援名稱；不會當 Vertex key 使用 |
| `VERTEX_API_KEY` | 明確來源為 Vertex Express 的 API key，供文案與生圖 |
| `VERTEX_ACCESS_TOKEN` | 標準 Vertex OAuth access token，短效，需定期更新 |
| `GOOGLE_CLOUD_PROJECT` | 搭配 access token 使用的 Cloud 專案 ID |
| `MONO_LIVE_ACCESS_CODE` | 至少 16 字元，保護付費模型端點的獨立存取碼 |
| `MONO_ALLOWED_ORIGINS` | 逗號分隔的完整來源，例如 `https://your-project.vercel.app` |
| `MONO_API_PORT` | 本機 API 連接埠，預設 8787 |
| `MONO_DATA_DIR` | 本機私人資料夾，預設 `.local-data` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase runtime 自動提供，只在 Edge Function 內使用 |

在預設 `vertex` 模式，若 token 與專案同時存在，優先使用標準 Vertex；否則文案／圖片可走 Express。沒有明確設定的 provider 會回 503。AI Studio key 不等於 Vertex Express key；在 `vertex` 模式完全不讀 Developer key。

若明確設定 `MONO_GOOGLE_PROVIDER=gemini-api`，文案與圖片改由 Gemini Developer API，維持相同模型 ID。只讀 `MONO_GEMINI_API_KEY`（優先）或 `GEMINI_API_KEY`，不使用 Vertex 憑證。health 的 `googleProvider` 與所有 jobs 的 `provider` 會顯示 `gemini-api`，不假稱 Vertex。Veo 不受這個選項影響，仍只走已驗證的 Vertex 合約。既有 Cloud project 的通用 secret 不需要被覆寫。

Node 啟動依序讀 `.env`、`.env.local`、`.env.mono.local`，現有 process environment 仍遵循 Node 的優先順序。

Veo 僅支援已確認的標準 Vertex OAuth 路徑。本版未實作 service account token 自動換發；正式上線需加 ADC／Workload Identity 或受控 token 換發。不要把短效 token 說成永久可用 API key。

來源：[官方驗證方式](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start?authuser=2&usertype=apikey)、[Express API](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/express-mode/api-reference)。

## 明確選擇 Gemini Developer API

Endpoint：`POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`。Header：`x-goog-api-key`。Google Developer 官方文件已分別確認 contents/inlineData、thinkingConfig、圖片 imageConfig 與回應 parts 結構。本版文案用 `responseMimeType:'application/json'` 加 `responseJsonSchema`（標準 JSON Schema、小寫 type），不將 Vertex 的 responseSchema 型別直接當作 Developer 的合約。圖片仍用 `responseModalities:['TEXT','IMAGE']` 與官方 REST reference 列出的 `imageConfig:{aspectRatio,imageSize}`。

Developer 的圖片比例清單未列 `9:21`，所以此模式拒絕 9:21 並提示 9:16；其他前端常用比例相同。只有 countTokens 成功代表 key／該端點有回應，仍需真正 generateContent 驗證生成權限與品質。

來源：[Developer 文字生成](https://ai.google.dev/gemini-api/docs/generate-content/text-generation)、[Developer 結構化輸出](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)、[Developer 生圖](https://ai.google.dev/gemini-api/docs/generate-content/image-generation)、[REST GenerationConfig / ImageConfig](https://ai.google.dev/api/generate-content)。

## Gemini HTTP

Express：`POST https://aiplatform.googleapis.com/v1/publishers/google/models/{MODEL}:generateContent`，伺服器以 `x-goog-api-key` 傳 key。

標準：`POST https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/publishers/google/models/{MODEL}:generateContent`，使用 `Authorization: Bearer {ACCESS_TOKEN}`。

共用內容欄位是 `contents: [{role:'user',parts:[{text:'...'}, {inlineData:{mimeType:'image/png',data:'BASE64'}}]}]`。

文案設定為 `generationConfig.thinkingConfig.thinkingLevel: 'LOW'`、`responseMimeType: 'application/json'` 與 `responseSchema`。3.7 的 thinking level 僅接受 LOW、MEDIUM、HIGH。不要传 MINIMAL，也不傳 temperature、topP、topK、candidateCount、frequencyPenalty、presencePenalty。回應在 `candidates[0].content.parts[].text`，仍需驗證 sections 結構與長度。

圖片設定為 `generationConfig: { responseModalities:['TEXT','IMAGE'], imageConfig:{aspectRatio:'16:9',imageSize:'2K'} }`。圖片模型不支援文案 JSON schema。回應遍歷 parts，排除 thought 圖片，再取 `inlineData.data` 與 `inlineData.mimeType`。只有文字或被安全規則阻擋時回錯誤。

UI 開放 1K／2K／4K；K 是模型輸出級別，前端須解碼並記錄實際寬高。模型頁也列 512，但本版沒有提供。比例支援 1:1、3:2、2:3、3:4、1:4、4:1、4:3、4:5、5:4、1:8、8:1、9:16、16:9、21:9、9:21。輸入 single inline image 限 7 MB。本版接受 PNG／JPEG／WebP 並檢查檔頭，HEIC／HEIF 須前端先轉檔。

來源：[3.7 開發指南](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-7-flash)、[結構化輸出](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output)、[圖片生成](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-generation)。

## Veo HTTP 與工作狀態

`POST https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/veo-3.1-generate-001:predictLongRunning`

```json
{
  "instances": [{"prompt":"Product reveal", "image":{"bytesBase64Encoded":"BASE64","mimeType":"image/png"}}],
  "parameters": {"sampleCount":1,"durationSeconds":8,"aspectRatio":"16:9","resolution":"720p","generateAudio":true,"resizeMode":"pad"}
}
```

來源 PNG／JPEG；影片 4／6／8 秒、16:9／9:16、720p／1080p。本版省略 `storageUri`，要求回傳影片 bytes，再存入 Supabase 私有素材。首個回應 `{name: 'projects/.../operations/...'}` 只表示開始，不能當完成。

之後呼叫同 model 路徑的 `:fetchPredictOperation`，body 為 `{operationName:'完整 name'}`。前端建議每 15 秒查詢。`done` 尚未為 true 則 pending；`error` 或無輸出則 failed；成功保存 `response.videos[0].bytesBase64Encoded`、`mimeType`。工作 id、provider、model、時長與失敗原因均有紀錄。

取消是本 App 停止追蹤：狀態改 `cancelled`，不再輪詢。官方供應商取消未驗證，因此不能聲稱停止生成或免計費。Supabase 寫入狀態時使用同一個原子 UPDATE，以 owner、id、原狀態三個條件限制；取消不會覆蓋已完成，較晚的輪詢不會復活已取消工作。本 runtime 額外有輪詢鎖。多 isolates 同時讀到 pending 時仍可能重複輪詢／建立未被引用的素材，正式營運可加耐久佇列與素材清理。

來源：[图片轉影片](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-an-image)、[影片輪詢](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-text)、[影片參數](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/Shared.Types/VideoGenerationModelParams)。

## App API

本機 base URL `/api`，遠端 base URL `https://PROJECT.supabase.co/functions/v1/mono-api`。`GET /health` 可公開讀取，僅顯示 readiness。其他端點要求 `x-workspace-token`：前端產生 32 個隨機 bytes，編碼成 64 位小寫 hex。伺服器以 SHA-256 得到 owner，拒絕由 request 指定 owner。這是持有憑證即有權的私人工作區，不是使用者登入；清除瀏覽器儲存會失去工作區存取能力。

| 路徑 | 請求／回應 |
| --- | --- |
| GET `/health` | `{mode,providers,models,persistence,liveAccessRequired}` |
| POST `/copy` | `{product:{name,category?,description?,facts?:string[]},language,platform?,prompt?,mode?,sourceDataUrl?,detailCount?,allowPaid?}` → `{sections,provider,model,jobId,durationMs,warnings}` |
| POST `/image` | `{sourceDataUrl,prompt,aspectRatio?,imageSize?}` → `{dataUrl,assetId,jobId,provider,model,durationMs}` |
| POST `/video` | `{sourceDataUrl,prompt,aspectRatio?,resolution?,durationSeconds?}` → HTTP 202 `{jobId,status:'pending',pollAfterMs}` |
| GET `/video?jobId=UUID` | `{jobId,status,assetId?,error?,pollAfterMs?}` |
| DELETE `/video?jobId=UUID` | 更新工作區取消狀態；供應商可能继续計費 |
| POST `/assets` | `{dataUrl}` → `{id,mimeType,bytes}` |
| GET `/assets?id=UUID` | `{id,dataUrl,mimeType}`；加 `format=raw` 取檔案 bytes |
| POST `/products` | `{id?,name,category?,description?,facts?:string[],sourceDataUrl?,sourceAssetId?,metadata?:{}}` → `{product}` |
| GET `/products` | `{products:[]}`，每次最多最近 100 筆 |
| POST `/jobs` | `{type,provider:'canvas'|'demo',model?,productId?,settings?,outputs?,durationMs?}` → `{job}` |
| GET `/jobs` | `{jobs:[]}`，每次最多最近 100 筆 |

`language`：zh-TW／en／ja／ko。`/jobs.type`：composition／banner／detail／listing／video-demo；outputs 最多 30 項，欄位只有 id、assetId、name、width、height、language、format。圖片先存 assets。供應商的真實 job 僅由伺服器建立，前端不可自行宣稱 Vertex 成果。

live copy／image／video 啟動與進行中輪詢還要求 `x-mono-access-code`。所有錯誤格式為 `{error:{code,message,retryable},requestId}`，不轉傳含 secret 的原始供應商錯誤。JSON 上限 10 MB。CORS 為明確 allowlist，不使用萬用字元；不帶 Origin 的可信腳本仍須 workspace/live 憑證。每 runtime 每工作區每分鐘最多 90 次，這不是分散式防濫用方案。

## 持久化與部署邊界

本機 server 使用與 Edge Function 相同的 handler，資料在 `.local-data`。本版 cloud 使用 `mono_products`、`mono_jobs`、`mono-assets` 三個獨立物件。兩張資料表開啟 RLS，撤銷 public／anon／authenticated 權限，只授權 service_role。素材 bucket 私有；restrictive policy 只拒絕 anon／authenticated 存取 mono-assets，其他 bucket 照原政策運作。

`verify_jwt=false` 僅針對 mono-api，因為此函式自行驗證 capability。它不修改現有 Supabase Auth 設定。service_role 永不回前端。部署 migration 後必須用 service／anon 兩種身份驗證隔離，不能只看 migration SQL 就宣稱遠端安全驗證通過。

來源：[Edge Functions 驗證](https://supabase.com/docs/guides/functions/auth)、[Storage 存取控制](https://supabase.com/docs/guides/storage/security/access-control)、[server secrets](https://supabase.com/docs/guides/functions/secrets)、[Supabase changelog](https://supabase.com/changelog)。本次相關變更是 Node 20 支援終止與新資料表不再自動公開；使用 Node 22+，且 migration 明確設定角色權限。

## 驗證

`npm test -- tests/backend.test.ts` 執行 provider mock contract 與安全邊界測試。`npx tsc --project server/tsconfig.json` 檢查本機與 shared backend。Deno／Supabase 雲端部署與 Google 真實呼叫另列為整合驗證；前端 E2E 報告須獨立標出實際模式。

## v3 視覺企劃合約

`detailCount` 為 1–16 的整數；有傳入時，request schema 的 minItems 與 maxItems 都等於該值，回應也必須有相同張數。每段另含 moduleType、sceneVariant、evidencePoints 與 visualGoal。後端檢查角色與圖種一致，8 張以上需有多種圖種、兩個不同情境與圖解。未達條件回 COPY_PLAN_INCOMPLETE，不會再花費請求自動補圖。

這些 schema 欄位已對照 [Gemini 結構化輸出](https://ai.google.dev/gemini-api/docs/structured-output) 與 [Vertex 結構化輸出](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output) 的支援子集。單元測試使用注入回應；本輪沒有用 Google API 做實際生成。
