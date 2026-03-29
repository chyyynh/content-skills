---
name: writer
description: >
  根據 newsence 文章素材，撰寫不同管道的內容草稿：微信公眾號日報、小紅書/抖音短影片腳本、公眾號長文、Twitter Thread。
  當用戶說「寫日報」「寫腳本」「寫長文」「幫我寫一篇」「開始寫」時觸發。
  用戶在 selector 選完題後說「開始吧」「就這幾個」也應觸發。
  任何涉及內容撰寫、草稿生成、文案產出的請求都應使用此 skill，即使用戶沒有明確指定格式或平台。
  如果用戶給了一篇文章或話題並暗示要產出內容（「這個可以寫」「幫我發一下」），也應觸發。
---

# Content Writer

拿 newsence 的文章素材，寫出不同管道的內容。

## 前置條件

需要 newsence 來讀取文章全文。確認方式同 selector — 檢查 MCP tools 或 CLI 是否可用。如果不可用，引導用戶參考 selector 的 `references/source-config.md` 設定。

## 流程

### 1. 確認任務

搞清楚三件事：
- **素材**：用戶指定的文章（可能帶 newsence article id），或剛從 selector 選出來的
- **格式**：日報 / 短影片腳本 / 長文（公眾號或 Twitter Thread）
- **平台**：微信公眾號 / 小紅書 / 抖音 / Twitter/X

如果從 selector 銜接過來，這些資訊應該都已經有了，直接開始。

### 2. 讀取素材全文

對每篇要用的文章，用 `get_article` 拿到完整內容。如果用戶給的是 URL 而不是 article id，用 `save_url` 先存進去再讀取。

### 3. 選風格，讀格式指南

風格由三個維度組合：語氣 × 深度 × 人稱。每個格式有預設組合：

| 格式 | 預設風格 | 原因 |
|------|---------|------|
| 日報 | 犀利洞察 × 快報 × 客觀 | 讀者要快、要有態度 |
| 短影片 | 輕鬆幽默 × 中度 × 對話體 | 要親近感，太嚴肅會被滑走 |
| 長文（公眾號） | 溫和專業 × 深度 × 第一人稱 | 讀者願意花時間，要有溫度 |
| 長文（Twitter） | 犀利洞察 × 中度 × 第一人稱 | 快節奏，每則都要有料 |

用戶可以覆蓋預設。風格維度的完整定義和範例在 `references/style-guide.md`。如果 `references/custom-style.md` 存在，優先用裡面的品牌風格。

然後讀取對應的格式指南（只讀需要的那個）：
- 日報 → `references/format-daily.md`
- 短影片 → `references/format-short-video.md`
- 長文 → `references/format-long-article.md`

格式指南裡有完整的結構模板、範例、和常見陷阱，照著寫。

### 4. 寫草稿

**先出大綱**：列出每個段落/區塊的核心訊息（一句話概括），讓用戶確認方向和結構。大綱要具體到能看出文章走向，不是泛泛的「第一段：引言」。

例如日報大綱：
```
1. 開場：用 [頭條話題] 帶出今天的基調
2. 頭條：[公司名] [事件]，點評角度是 [XXX]
3. 第 2-7 條：[每條一句話摘要]
4. 收尾：用 [某條新聞] 的延伸問題引導互動
```

確認後寫完整草稿。草稿完成後附上：
- 需要人工調整的地方（圖片位置、數據核實、排版細節）
- 發布建議（最佳時段、hashtag、互動引導語）
- **短影片格式限定**：末尾附上「Clip 執行摘要」（格式見 `format-short-video.md` 末尾），包含 hook 配音文字、封面描述、剪輯段落、CTA。clip skill 會直接讀取這個摘要來生成影片。寫完後將摘要存為 `clip-brief.md`。

---

## 參考文件

- `references/style-guide.md` — 風格維度定義和範例
- `references/format-daily.md` — 日報模板
- `references/format-short-video.md` — 短影片腳本模板
- `references/format-long-article.md` — 長文/Thread 模板
- `references/custom-style.md` — 自訂品牌風格（可選，建立後自動生效）
