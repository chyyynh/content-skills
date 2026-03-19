# content-skills

內容產出工具鏈：從選題到撰寫，powered by [newsence](https://www.npmjs.com/package/newsence)。

## 安裝

```bash
# 1. 加入 marketplace
/plugin marketplace add chyyynh/content-skills

# 2. 安裝 plugin
/plugin install content-skills@content-skills
```

本地測試：

```bash
git clone https://github.com/chyyynh/content-skills.git
claude --plugin-dir ./content-skills/plugins/content-skills
```

## Prerequisites

需要先設定 newsence 作為資料來源：

```bash
# 註冊為 Claude Code MCP server（推薦）
claude mcp add newsence -- npx newsence mcp
```

## Skills

### content-selector

用 newsence 抓取最新文章，分析熱度，推薦適合日報、短影片、長文的選題。

觸發方式：提到「選題」「熱點」「今天寫什麼」「有什麼新聞」等內容規劃相關的話題。

### content-writer

拿 newsence 的文章素材，根據不同管道撰寫內容草稿：

- 微信公眾號日報
- 小紅書/抖音短影片腳本
- 公眾號長文
- Twitter Thread

觸發方式：說「寫日報」「寫腳本」「寫長文」，或在 content-selector 選完題後說「開始吧」。
