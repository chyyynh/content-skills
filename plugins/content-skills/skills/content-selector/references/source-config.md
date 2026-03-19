# 資料來源：newsence

內容資料庫透過 [newsence](https://www.npmjs.com/package/newsence) 存取。newsence 提供 CLI 和 MCP 兩種方式。

## MCP 模式（推薦）

如果 newsence 已註冊為 MCP server，直接使用 MCP tools：

| Tool | 用途 | 需登入 |
|------|------|--------|
| `search_articles` | 按關鍵字搜尋文章 | 否 |
| `get_recent_articles` | 取得過去 N 小時的文章 | 否 |
| `get_article` | 讀取單篇文章全文 | 否 |
| `save_url` | 提交 URL 抓取 | 是 |
| `list_collections` | 列出收藏夾 | 是 |
| `add_to_collection` | 加入收藏 | 是 |

註冊方式：
```bash
claude mcp add newsence -- npx newsence mcp
```

## CLI 模式（備用）

如果 MCP 不可用，透過 bash 呼叫 CLI：

```bash
# 搜尋文章
newsence search "AI agent" --limit 20 --json

# 最近 N 小時的文章
newsence recent --hours 24 --limit 20 --json

# 按來源過濾
newsence search "創業" --source "36kr,TechCrunch" --json

# 讀取全文
newsence read <article-id> --json
```

加 `--json` 可以拿到結構化資料，方便程式處理。

## 文章資料結構

每篇文章包含以下欄位：

| 欄位 | 說明 |
|------|------|
| id | 唯一識別碼 |
| title | 英文標題 |
| title_cn | 中文標題（如有） |
| summary | 英文摘要 |
| summary_cn | 中文摘要（如有） |
| published_date | 發布時間 |
| source | 來源名稱 |
| url | 原始連結 |

預設語言為 `zh-TW`，會自動使用中文標題和摘要。如需英文原文，加 `--lang en`。

## 選題流程中的使用方式

1. **獲取候選內容**：用 `get_recent_articles` 拉取過去 24-48 小時的文章
2. **主題搜尋**：用 `search_articles` 針對特定關鍵字深挖
3. **閱讀全文**：對候選文章用 `get_article` 讀取完整內容
4. **收藏標記**：選定的文章用 `add_to_collection` 標記
