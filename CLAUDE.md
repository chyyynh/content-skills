# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Claude Code plugin marketplace providing four skills for content production. The skills work independently or as a pipeline: selector (topic recommendation) → writer (draft content) → clip (short video) → image (cover art).

## Architecture

```
plugins/
├── selector/   # Multi-source topic recommendation via GitHub Gist config
├── writer/     # Content drafting (daily brief, short video script, long-form, thread)
├── clip/       # YouTube → 9:16 short video with karaoke subtitles + hook intro
└── image/      # OpenRouter image generation wrapper
```

Each plugin follows the same structure:
- `.claude-plugin/plugin.json` — name, description, version
- `skills/<name>/SKILL.md` — main skill definition (frontmatter + workflow)
- `skills/<name>/references/` — supporting docs loaded on-demand (progressive disclosure)
- `skills/<name>/scripts/` — executable code (Python, Node.js)

### Skill handoff

- writer outputs `clip-brief.md` → clip reads it for hook script, cover description, segments
- selector passes content type + materials + channel → writer uses these to pick format guide
- clip and writer call image skill for cover generation

## Key files

| File | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Marketplace definition (4 plugins) |
| `plugins/selector/skills/selector/references/source-config.md` | Fetcher types, per-tool commands, and fetch workflow |
| `plugins/selector/skills/selector/references/channel-criteria.md` | Daily brief / short video / long-form selection criteria |
| `plugins/writer/skills/writer/references/style-guide.md` | 3-axis style system: tone × depth × voice |
| `plugins/clip/skills/clip/scripts/ass-karaoke.py` | ASS subtitle generator with per-word karaoke highlighting |
| `plugins/image/skills/image/scripts/main.mjs` | OpenRouter image generation CLI |
| `plugins/writer/skills/writer/references/material-tools.md` | opencli operate patterns for material deep-dive (screenshots, extraction, subtitles) |

## Conventions

- SKILL.md files are written in English; output follows user's language
- Descriptions use third person ("Analyzes..." not "I analyze...")
- SKILL.md body stays under 500 lines; detailed content goes in `references/`
- References are one level deep from SKILL.md (no nested references)
- Reference files over 100 lines include a table of contents
- Version bumps: edit `plugin.json` version, then commit

## Versioning

Each plugin has its own version in `.claude-plugin/plugin.json`. Bump the version whenever changing SKILL.md or references. Always bump the patch version (e.g., 1.1.1 → 1.1.2).

## Testing locally

```bash
git clone https://github.com/chyyynh/content-skills.git
claude --plugin-dir ./content-skills
```

## External tools

| Tool | Install | Used by | Purpose |
|------|---------|---------|---------|
| newsence | MCP server | selector, writer | Article indexing and full-text retrieval |
| opencli | `pnpm i -g @jackwener/opencli` + [Browser Bridge](https://github.com/jackwener/opencli/releases) | selector, writer | Twitter timeline, Bilibili/XHS search, browser automation (screenshots, DOM extraction) |
| yt-dlp | `brew install yt-dlp` | selector, clip | YouTube listing and video download |
| ffmpeg | `brew install ffmpeg` | clip | Video processing |

Run `opencli doctor` to verify Browser Bridge connectivity. XHS commands require Chrome login to xiaohongshu.com.

## Environment variables

| Variable | Used by | Required |
|----------|---------|----------|
| `SELECTOR_SOURCES_GIST` | selector | No — prompts setup if unset |
| `OPENROUTER_API_KEY` | image, clip (cover) | Yes for image generation |
| `ELEVENLABS_API_KEY` | clip (hook voiceover) | Optional |
| `GROQ_API_KEY` | clip (Whisper fallback) | Optional |

## Selector source config

Users maintain their source list as a GitHub Gist (`my-sources.md`), organized by type (RSS, Twitter, YouTube, Bilibili, XHS, Website). Each source has a `Fetcher` column (`newsence` / `opencli` / `ytdlp` / `websearch`) that determines which tool fetches it. The selector fetches this via `gh gist view "$SELECTOR_SOURCES_GIST"` and caches to `/tmp/selector-sources-cache.md`. See `source-config.md` for fetcher types and exact commands.
