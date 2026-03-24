---
name: image
description: >
  AI 圖片生成（OpenRouter）。
  支援文字生成圖片、參考圖片編輯、寬高比。
  當用戶要求生成、創建、畫圖片時觸發。
  當其他 skill（如 writer）需要生成封面圖時也可調用。
argument-hint: "[--prompt 'text'] [--image output.png]"
---

# Image Generation

透過 OpenRouter 生成圖片，支援多種底層模型。

## Script Directory

1. `{baseDir}` = 這個 SKILL.md 所在的目錄
2. Script path = `{baseDir}/scripts/main.mjs`
3. 執行方式：`node {baseDir}/scripts/main.mjs [options]`

## Usage

```bash
# 基本用法
node {baseDir}/scripts/main.mjs --prompt "A cat" --image cat.png

# 指定寬高比
node {baseDir}/scripts/main.mjs --prompt "A landscape" --image out.png --ar 16:9

# 4K 畫質
node {baseDir}/scripts/main.mjs --prompt "A cat" --image out.png --quality 4K

# 從 prompt 檔案讀取
node {baseDir}/scripts/main.mjs --promptfiles system.md content.md --image out.png

# 帶參考圖片
node {baseDir}/scripts/main.mjs --prompt "Make blue" --image out.png --ref source.png
```

## Options

| Option | Description |
|--------|-------------|
| `--prompt <text>`, `-p` | Prompt 文字 |
| `--promptfiles <files...>` | 從檔案讀取 prompt（合併多個檔案） |
| `--image <path>` | 輸出圖片路徑（預設 `image-{timestamp}.png`） |
| `--model <id>`, `-m` | Model ID |
| `--ar <ratio>` | 寬高比（`1:1`, `16:9`, `9:16`, `4:3`, `3:2` 等） |
| `--quality <size>` | 解析度：`1K` / `2K`（預設）/ `4K` |
| `--ref <files...>` | 參考圖片 |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key（必填） |
| `OPENROUTER_IMAGE_MODEL` | 覆寫預設 model |

## Model

預設 `google/gemini-3.1-flash-image-preview`，可透過 `--model` 切換 OpenRouter 上任何支援圖片生成的模型。

## Prompt 撰寫指南

用自然語言描述畫面，不要用關鍵字堆疊。

**公式**：[用途/情境] + [主體與細節] + [場景/環境] + [光線/氛圍] + [風格/媒材] + [構圖/鏡頭]

**要**：
- 完整句子：「A cinematic wide shot of...」而非「car, neon, city, 8k」
- 具體描述：「elderly woman in vintage tweed suit」而非「old woman」
- 指定材質：「brushed steel」「soft velvet」「matte ceramic」
- 指定光線：「golden hour side-lighting」「soft diffused overcast」「harsh top-down fluorescent」
- 指定鏡頭：「85mm shallow DOF」「wide-angle low angle」「overhead flat lay」
- 指定風格：「editorial photography」「Studio Ghibli watercolor」「retro risograph print」

**不要**：
- 關鍵字列表（「cat, cute, 4k, HDR, masterpiece」）
- 模糊描述（「a nice picture」）
- 無意義的品質詞（「best quality, ultra detailed」— 模型不需要這些）

**範例**：
- 「A warm editorial photograph of a steaming bowl of ramen on a dark wooden counter, with soft window light creating gentle shadows, shot from 45 degrees with shallow depth of field」
- 「An isometric pixel art illustration of a cozy rooftop garden in a cyberpunk city at dusk, with warm string lights contrasting against neon signs in the background」

## Error Handling

- 缺少 API key → 報錯並提示設定方式
- 生成失敗 → 自動重試最多 3 次
