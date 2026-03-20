# content-skills

內容產出工具鏈：從選題到撰寫，powered by [newsence](https://www.npmjs.com/package/newsence)。

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

需要設定 [newsence](https://www.npmjs.com/package/newsence) 作為資料來源：

```bash
claude mcp add newsence -- npx newsence mcp
```

## Skills

### content-recommender — 內容推薦

分析近期文章，推薦值得做的內容主題。每個推薦包含：

- 建議角度和切入點
- 參考資料（來源文章及其角色：核心素材、對立觀點、數據來源等）
- 適合的管道（日報 / 短影片 / 長文）和時效建議

也支援追熱點判斷 — 問「XXX 要不要跟」就會分析報導密度和趨勢階段，給出跟/不跟建議。

### content-writer — 內容撰寫

根據推薦的主題和參考資料，產出不同管道的內容草稿：

- 日報（微信公眾號）
- 短影片腳本（小紅書 / 抖音）
- 長文（公眾號 / Twitter Thread）

內建風格系統（語氣 × 深度 × 人稱），每個管道有預設組合，也可以自訂。

## 工作流程

```
「今天寫什麼」 → content-recommender 分析 + 推薦
                         ↓
              選定主題（帶參考資料）
                         ↓
「開始寫」   → content-writer 產出草稿
```

兩個 skill 可以獨立使用，也可以串接。recommender 選完題後說「開始吧」會自動銜接到 writer。

## 自訂配置

安裝後可選：

- `content-writer/references/custom-style.md` — 定義品牌風格（建立後自動生效）
