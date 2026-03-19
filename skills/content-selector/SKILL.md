---
name: content-selector
description: >
  用 newsence 抓取最新文章，分析熱度，推薦適合日報、短影片、長文的選題。
  當用戶提到「選題」「熱點」「今天寫什麼」「有什麼新聞」「最近什麼話題火」時觸發。
  即使用戶只是說「今天發什麼」「有什麼新的」，只要跟內容產出相關都應觸發。
  也適用於用戶問「XXX 要不要跟」「這個話題值不值得做」等判斷性問題。
  任何涉及內容規劃、選題方向、熱點追蹤、話題篩選的場景都應使用此 skill。
---

# Content Selector

用 newsence 抓新聞，選出值得做的題目。

## 前置條件

這個 skill 依賴 newsence 來取得文章資料。開始前先確認 newsence 是否可用：

1. **MCP 模式（推薦）**：檢查是否有 newsence 的 MCP tools（`get_recent_articles`、`search_articles` 等）。如果沒有，引導用戶註冊：
   ```bash
   claude mcp add newsence -- npx newsence mcp
   ```
2. **CLI 模式（備用）**：如果 MCP 不可用，確認 `newsence` CLI 可以執行。

如果兩者都不可用，告訴用戶需要先設定 newsence，參考 `references/source-config.md`。

## 流程

### 1. 確認需求

從對話上下文推斷，必要時快速確認：
- 時間範圍（預設過去 24 小時）
- 目標管道：日報 / 短影片 / 長文 / 全部（預設全部）
- 特別想關注或避開的方向

如果用戶意圖明確（例如「今天日報寫什麼」），直接開始抓文章，不用反問。

### 2. 抓文章

用 newsence 拉取候選文章。MCP 和 CLI 的對應方式見 `references/source-config.md`。

- **基本拉取**：`get_recent_articles`，hours 設為用戶指定的時間範圍，limit 30-50
- **有特定方向時**：額外用 `search_articles` 帶關鍵字補充
- **需要看全文判斷時**：用 `get_article` 讀取單篇

### 3. 評分篩選

對每篇文章在三個維度打分（1-10）：

- **時效性**：剛發生的 > 已經討論幾天的（時效過了補不回來）
- **話題潛力**：有爭議、有故事、能延伸的分數更高
- **受眾匹配**：跟商業/創業相關、讀者會在意的加分

### 4. 分配管道並推薦

根據 `references/channel-criteria.md` 的標準，將高分文章分配到適合的管道。一個話題可以同時分配多個管道，但角度要不同。

每個管道推薦 2-3 個題目，每個推薦包含：
- 來源文章和 newsence article id
- 熱度評分和選擇理由（一句話）
- 2-3 個建議切入角度
- 時效提醒（什麼時候該發）

推薦完成後，主動建議最優先應該做的 1-2 個題目，說明理由。用戶選定後，引導到 content-writer skill，帶上選定文章的 article id。

---

## 追熱點

用戶問「XXX 要不要跟」時，用 `search_articles` 搜相關文章，看有多少來源在報導、討論量如何，再給出明確的跟/不跟建議和理由。

---

## 參考文件

- `references/channel-criteria.md` — 各管道的篩選標準和三管道聯動策略
- `references/source-config.md` — newsence 的設定和使用方式
