# 完整素材下載包

所有 E2E 與報告產生作業結束後，在 repo 根目錄執行：

```sh
node scripts/package-outputs.mjs
```

請在 `npm run test:report` **之後**執行。報告產生器會重新建立 `public/report`，若順序反過來，下載包會被移除。這個工具不呼叫模型、不部署，也不讀取環境金鑰。

一般情況會輸出 `public/report/all-outputs.zip`，以及供 HTML 報告讀取的 `public/report/asset-packages.json`。ZIP 保留各案例的路徑與內容：

- `cases/<案例>/outputs`：最終商品圖、詳情圖、Banner、短片。
- `cases/<案例>/source`：來源商品照片。
- `cases/<案例>/raw-ai`、`model-responses`：案例有保存時，包含模型原始回傳圖。
- 每個案例的 `copy.txt`、`manifest.json`、`detail-page.html`、`evidence.json`、`copy-model-response.json`。
- 案例內的額外驗證子流程，例如 `setup-product-b`，保持原資料夾關係。
- `samples`：來源紀錄列出的全部示範圖片與 `sample-provenance.json`，包含為比較而保留的初版。

不重複收錄 UI 操作截圖與每案例的 `bundle.zip`。操作截圖仍可在 HTML 報告查看；案例 ZIP 解壓後的實際檔案已納入總包。`asset-manifest.json` 會逐項說明排除檔案及理由。若宣告的產出或原圖缺漏、圖片為空、來源雜湊不符，工具會失敗，不能把缺漏當成完成。

如果原始檔案加上 ZIP 索引的預估大小超過 90 MiB，工具會依食品、美妝、服裝配件、共用內容分包。單一類別太大時，再切為有編號的分包。此時 `all-outputs.zip` 是**總索引包**，不是全部照片本體；`package-index.json` 會列出必須一併下載的檔案。請把所有分包解壓到同一個資料夾，讓詳情頁相對連結可用。單檔超過限制時會明確失敗，不會略過照片。

每包完成後會重新開啟 ZIP，檢查 CRC、資料檔數量、各檔案位元組長度與 SHA-256。全域 `asset-manifest.json` 記錄資料檔雜湊，`asset-packages.json` 記錄 ZIP 本身的雜湊。這些檢查只驗證檔案完整性，不代表商品事實、文案、影像一致性或模型品質已通過人工驗收。

HTML 報告整合方式：

```js
const packages = await fetch('asset-packages.json').then(r => r.json());
// single：all-outputs.zip 的按鈕可寫「下載完整素材」。
// split：all-outputs.zip 的按鈕寫「下載素材索引」，再列出所有 role === 'category' 分包。
// 每个分包可顯示 file、bytes、imageCount、sha256。
```

來源證據來自實際 `artifacts/e2e/*/evidence.json`；不推算不存在的案例。不論案例成功或失敗，已產生且保留的資料檔都會打包，案例的原始狀態仍留在證據中。打包前後會核對來源大小與修改時間；若測試仍在改寫檔案，必須等測試完成後重跑。

開發驗證可用 `--root <測試資料根目錄>` 與 `--max-zip-mb <不超過90的數值>`，避免碰觸正在產生的正式測試資料。
