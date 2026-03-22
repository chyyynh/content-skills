# content-skills

內容產出工具鏈 — 從選題、撰寫到影片剪輯，一站完成。

## 安裝

```bash
# 加入 marketplace
/plugin marketplace add chyyynh/content-skills

# 安裝 plugin
/plugin install content-skills@content-skills
```

本地測試：

```bash
git clone https://github.com/chyyynh/content-skills.git
claude --plugin-dir ./content-skills/plugins/content-skills
```

## Prerequisites

| 依賴 | 用途 | 安裝 |
|------|------|------|
| [newsence](https://www.npmjs.com/package/newsence) | 文章資料來源（recommender / writer） | `claude mcp add newsence -- npx newsence mcp` |
| yt-dlp | 影片下載（clip-local） | `brew install yt-dlp` |
| ffmpeg | 影片處理（clip-local） | `brew install ffmpeg` |
| GROQ_API_KEY | Whisper 語音轉文字（clip-local，可選） | [console.groq.com](https://console.groq.com) |

## Skills 一覽

```
content-skills/
├── content-recommender   選題推薦
├── content-writer        內容撰寫
└── clip-local            影片剪輯 + 字幕
```

---

### content-recommender — 選題推薦

分析 newsence 來源的近期文章，推薦值得產出的內容主題。

**觸發方式**：「今天寫什麼」「有什麼新聞」「最近什麼話題火」「XXX 要不要跟」

**Pipeline**：

```
確認需求（時間範圍、管道、方向）
    ↓
newsence 拉取候選文章（30-50 篇）
    ↓
篩選（時效性、話題密度、延伸空間）
    ↓
歸類管道（日報 / 短影片 / 長文）
    ↓
輸出推薦（每個附建議角度 + 參考資料 + 時效建議）
```

**輸出格式**：每個推薦是完整的 brief — 包含為什麼值得做、建議角度、可直接用於寫作的參考文章（標註角色：核心素材、對立觀點、數據來源等）。

**追熱點**：問「XXX 要不要跟」會分析報導密度和趨勢階段，給出明確的跟/不跟建議。

---

### content-writer — 內容撰寫

根據主題和參考資料，產出不同管道的內容草稿。

**觸發方式**：「寫日報」「寫腳本」「幫我寫一篇」「開始吧」

**支援管道**：

| 管道 | 平台 | 預設風格 |
|------|------|---------|
| 日報 | 微信公眾號 | 犀利洞察 × 快報 × 客觀 |
| 短影片腳本 | 小紅書 / 抖音 | 輕鬆幽默 × 中度 × 對話體 |
| 長文 | 公眾號 | 溫和專業 × 深度 × 第一人稱 |
| Thread | Twitter/X | 犀利洞察 × 中度 × 第一人稱 |

**Pipeline**：

```
確認素材 + 管道 + 平台
    ↓
newsence 讀取文章全文
    ↓
選擇風格（語氣 × 深度 × 人稱，可自訂）
    ↓
先出大綱，確認方向
    ↓
產出完整草稿 + 發布建議
```

**自訂風格**：建立 `references/custom-style.md` 定義品牌風格，建立後自動生效。

---

### clip-local — 影片剪輯 + 字幕

本地剪輯影片，支援翻譯字幕、CapCut 風格逐詞高亮、自動精華偵測。

**觸發方式**：「幫我剪這個影片」「加中文字幕」「clip the best parts」

**支援來源**：YouTube、X/Twitter，以及 yt-dlp 支援的所有平台。

**Pipeline**：

```
取得影片資訊 + 原始語言
    ↓
下載字幕（或 Whisper 語音轉文字）
    ↓
裁切字幕到指定範圍
    ↓
翻譯字幕
    ↓
產生 ASS 卡拉 OK 字幕（逐詞高亮 + 雙語）
    ↓
截圖檢查是否有內嵌字幕 → 決定是否加黑條
    ↓
ffmpeg 合成最終影片
```

**功能亮點**：

- **逐詞高亮**：CapCut 風格的卡拉 OK 字幕，灰→白逐詞亮起
- **雙語字幕**：原文在上（帶高亮），翻譯在下
- **自動精華**：不指定時間時，自動分析 transcript 推薦 3-5 個精華段落
- **內嵌字幕處理**：自動截圖偵測，用 `drawbox` 黑條蓋住原始字幕避免重疊
- **Whisper fallback**：無字幕時透過 Groq API 語音轉文字（需 `GROQ_API_KEY`）
- **`--bg` flag**：ASS 字幕加不透明背景框，提升可讀性

---

## Skills 組合工作流

### 1. 完整內容產線：選題 → 寫作

```
「今天寫什麼」→ recommender 推薦主題
        ↓
  選定主題（帶參考資料）
        ↓
「開始吧」→ writer 產出草稿
```

recommender 選完題後說「開始吧」會自動銜接 writer，帶上參考資料和建議角度。

### 2. 完整影片產線：選題 → 寫作 → 剪輯

```
recommender 推薦短影片主題
        ↓
writer 產出短影片腳本
        ↓
clip-local 剪輯影片 + 燒字幕
```

例如：recommender 發現一個適合短影片的熱點 → writer 寫腳本確定文案 → clip-local 從原始影片剪出片段、加上翻譯字幕。

### 3. 獨立使用

每個 skill 都可以單獨使用：

- **只要選題**：「今天有什麼值得做的題目」
- **只要寫作**：「幫我把這篇文章改寫成 Twitter Thread」
- **只要剪片**：「幫我剪這個 YouTube 影片 1:20-3:40 加中文字幕」
