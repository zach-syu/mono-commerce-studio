# 品類視覺企劃與參考頁驗收 v3

## 問題來源

前版的規劃入口是一次結構化文案請求，固定五個角色。出圖只為主視覺和單一情境建立照片，其他角色使用原圖。單靠改 Prompt 的形容詞，無法讓既有 renderer 自動畫出流程、尺寸或成分圖解。

本版把可執行的圖種、張數、場景與圖解都納入企劃合約。

- 規劃規則與 Google schema：[shared/visual-planning.ts](../shared/visual-planning.ts)
- 模型請求與回應驗證：[providers.ts](../supabase/functions/_shared/providers.ts)
- 分鏡與照片請求：[storyboard.ts](../src/lib/storyboard.ts)
- 原生圖解：[infographics.ts](../src/lib/infographics.ts)
- 使用者可調張數：[PlanCount.tsx](../src/components/PlanCount.tsx)

App 的「查看規劃 Agent 的 Prompt」會呈現規劃規則。免費模式由本機規則建立規劃；Google 模式才會呼叫模型。不可把兩者混稱為同一種模型實測。

## 來源與輸入

| 案例 | 指定參考頁 | 本次輸入 |
|---|---|---|
| 美妝 | [TS6 淨毛舒緩套組](https://www.ts6.com.tw/products/1002320) | 官方兩支乳霜與刮板白底原圖 |
| 食品 | [朱記水餃五件組](https://www.zhuji.com.tw/products/set2022008) | 從官方圖裁出的三款包裝；不是完全純白，細節解析度有限 |
| 衣服 | [JSMIX T62JT10154](https://www.jsmix.com.tw/products/%E5%8D%B0%E8%8A%B1%E7%9F%ADt-t62jt10154) | 從官方資訊圖裁出的黑色正面平拍，保留原圖像素 |
| 背包 | [MAGFORCE #0562](https://www.magforce.com.tw/zh-TW/products/0562) | 官方黑色商品白底原圖 |
| 3C／家電 | [PHILIPS AC4221](https://www.philips-da.com.tw/products/ac4221) | 官方獨立白底原圖 |
| 保健食品 | [TS6 有益菌 PLUS+](https://www.ts6.com.tw/products/probiotics-at0001a00203103) | 補充同品牌保健品案例；官方盒裝與隨身包白底原圖 |
| 鞋類 | [Bilibili 圖種與流程標準](https://www.bilibili.com/video/BV1XMbN6VEAf/) | 專案既有虛構鞋類白底圖；不冒充影片商品 |

商品介紹圖片用於觀察格式與資料來源。新的情境照片只使用上表商品輸入圖作視覺參考，沒有拿整張品牌詳情圖直接充當生成成果。

原站素材仍屬原權利人。它們作為使用者指定的研究／驗收參考，不納入 repo 的 MIT 程式碼授權。

## 合約與數量

`detailCount` 是 1–16 的整數，預設 8。主圖與 Banner 另計，各為 1 張；畫面會顯示實際合計數量。

每張規劃包含：`moduleType`、`role`、`title`、`body`、`visualGoal`、`sceneVariant`、`evidencePoints`。

8 張以上至少涵蓋 6 種圖種、2 種不同情境、原圖特寫與資訊圖解。Google request 的陣列長度會與指定張數一致；後端再檢查回傳數量、角色一致性與分布，拒絕重複商品照冒充完整套圖。

縮減張數會取消勾選多出的卡片，保留使用者文字。增加張數會補足缺少的圖種與第二情境。規格模組放在選中規劃的結尾。

## 各類圖種的驗收方向

| 品類 | 照片型畫面 | 資訊型畫面 |
|---|---|---|
| 美妝 | 浴室保養、旅行／日常整理、包裝特寫 | 成分分組、使用步驟、套組規格 |
| 食品 | 上桌分享、廚房料理、包裝局部 | 食材／口味、組合內容、料理流程、保存 |
| 衣服／鞋 | 城市穿搭、假日情境、可見印花與外觀特寫 | 材質資訊、尺寸標示、保養 |
| 背包 | 通勤攜帶、戶外情境、織帶與扣具特寫 | 收納概念、尺寸與容量、使用配置 |
| 3C／家電 | 客廳、夜間臥室、面板與格柵特寫 | 功能流程、操作步驟、規格 |
| 保健食品 | 早餐補充、工作／外出、包裝特寫 | 已提供成分、標示閱讀、保存與規格 |

圖解由 Canvas 實際繪製，文字可編輯。原圖特寫保留來源細節，不虛構未拍到的背面、內部構造或真正的材料微觀證據。缺少尺寸或成分時，不填入臆測數字。

## 本輪模型與費用界線

- 不使用使用者的 Gemini／Google API Key 做測試。
- 實際情境樣張使用對話內建 `image_gen` 工具製作，不使用外部 API Key。
- App 的免費驗收使用已保存的情境樣張，並明確記錄 `photoProvider: conversation-imagegen`。
- Google provider 合約以注入回應驗證，不冒稱為 Google 圖片品質實測。
- 測試後端固定 `MONO_DISABLE_LIVE=1`；瀏覽器封鎖外部網域。
- 畫面、ZIP、原始情境檔與生成規劃保留各自來源。未有新情境素材時會標示缺項，不算情境照片品質通過。

## 驗收證據

功能測試與視覺判斷分開記錄。輸出張數、原始圖片雜湊、圖片像素、ZIP 內容、圖種分布與不同場景來源有程式檢查。照片是否保留所有商品小字、實際材質與真實使用尺度，仍須逐張視覺檢查，不能由檔案存在推導為通過。

`playwright.benchmark.config.ts` 包含真實原圖上傳、指定品牌、英文／日文、兩種情境、資訊圖解、Banner、調整張數、保留編輯、無效數值與手機操作。

## 後續改善方向

1. 食品與衣服補入更高解析度的獨立白底原檔，提升原圖特寫品質。
2. 需要呈現商品背面、內袋或結構時，加入對應實拍作證據；不讓模型猜測。
3. 補齊未提供的尺寸與規格欄位，再做正式商品頁審核。
4. 使用者另行同意付費後，才以 Google provider 實測同一份規劃，比較圖像一致性與原生尺寸。
