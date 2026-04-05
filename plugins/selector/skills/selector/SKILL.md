---
name: selector
description: >
  Analyzes recent content from user-configured sources to recommend topics worth producing.
  Provides suggested angles and reference materials for daily briefs, short videos, and long-form articles.
  Triggers when user mentions topic selection, recommendations, content planning, trend tracking,
  or asks whether a topic is worth covering.
argument-hint: "[time-range] [channel]"
---

# Content Recommender

Analyzes recent materials from multiple sources, recommends topics worth producing, with reference materials ready for writing.

**Output language**: Always respond in the user's language.

## Prerequisites

Check in order:

0. **Source config**: Check `$SELECTOR_SOURCES_GIST` env var. If set, run `gh gist view "$SELECTOR_SOURCES_GIST" -f my-sources.md` to fetch the user's source table and cache to `/tmp/selector-sources-cache.md`. If not set, suggest the user set up a gist (see `references/source-config.md` for format).
1. **Tool availability**: Verify each tool:
   - `newsence`: check newsence MCP tools are available
   - `opencli`: run `opencli doctor` to verify Browser Bridge connectivity
   - `yt-dlp`: check `command -v yt-dlp`
   - Skip sources whose tool is unavailable without blocking.

## Workflow

### 1. Confirm requirements

Infer from conversation context; only ask if ambiguous:
- **Content profile**: What domains, audience, and directions is the user targeting? (e.g., "AI x Finance for retail investors"). This drives all filtering decisions downstream.
- Time range (default: past 24 hours)
- Target channel: daily brief / short video / long-form / all (default: all)
- Directions to focus on or avoid

When intent is clear (e.g., "what should the daily brief cover today") and the user's profile is already known from context, start immediately.

### 2. Fetch materials

Read the user's source table (gist / cache). Execute **all steps below** — newsence does not cover Bilibili, Xiaohongshu, or Website, so Steps 3–4 must always run. See `references/source-config.md` for detailed per-source commands.

**Batch A** (run in parallel):

1. **newsence** — bulk fetch indexed RSS, Twitter, YouTube:
   ```
   mcp__newsence__get_recent_articles  hours=24
   ```

2. **Twitter** — timeline for accounts not indexed by newsence:
   ```
   opencli twitter timeline --type following --limit 50 --format json
   ```

**Batch B** (run in parallel, after Batch A):

3. **Bilibili** — account fetch + keyword discovery:

   a. **Account fetch** (run in parallel): extract UID from each gist Bilibili space URL (`space.bilibili.com/<uid>`), fetch recent videos:
   ```
   opencli bilibili user-videos <uid> --limit 5 --format json
   ```

   b. **Keyword discovery**: 1–2 searches derived from gist tags and content profile for content outside tracked accounts:
   ```
   opencli bilibili search "<keyword>" --limit 10 --format json
   ```

4. **Xiaohongshu** — account fetch + keyword discovery. Requires Chrome login — skip only if browser bridge unavailable.

   a. **Account fetch** (run in parallel): for each gist XHS creator, fetch recent notes:
   ```
   opencli xiaohongshu user <user-id> --limit 5 --format json
   ```
   If gist URL is a user profile (`/user/profile/<id>`), extract the id directly. If it is a note URL (`/search_result/<note-id>`), search by creator name instead:
   ```
   opencli xiaohongshu search "<creator-name>" --limit 5 --format json
   ```

   b. **Keyword discovery**: 1–2 searches derived from gist tags and content profile:
   ```
   opencli xiaohongshu search "<keyword>" --limit 10 --format json
   ```

5. **YouTube** — channels not returned by newsence in Step 1:
   ```
   yt-dlp --flat-playlist --playlist-end 5 --print "%(title)s | %(url)s | %(upload_date)s" <channel-url>/videos
   ```

6. **Website** — sources in the Website section of the gist:
   ```
   WebFetch <url> "Extract recent articles: title, url, date, summary"
   ```

**Merge and deduplicate**: group by URL and title similarity. Cross-type hits (e.g., English article + Chinese community post) are stronger density signals.

### 3. Analyze and categorize

Two-pass analysis:

**Content profile**: Use the user's stated interests, domains, and directions from the conversation (or from Step 1 confirmation) to determine filtering priorities. If the user hasn't specified, ask what domains and audience they're targeting before filtering.

**Filter** candidates by:
- **Domain relevance** — matches the user's stated interests and focus areas
- **Timeliness** — recent events first; older topics need a fresh angle
- **Topic density** — multiple sources reporting = high market attention (cross-type hits are stronger: news + community discussion > multiple articles from one source)
- **Depth potential** — controversy, story arcs, or connection to larger trends

**Categorize**: Apply `references/channel-criteria.md` standards to determine suitable channels. One topic can map to multiple channels with different angles.

### 4. Output recommendations

Two sections + expandable detailed briefs.

#### Section 1: Daily brief

Curated highlights, **not limited to core domains**. Goal: let readers catch up on the day's most important events in 3 minutes. Pick 5 items per `channel-criteria.md` daily brief standards.

```
## Daily Brief

| # | Topic | One-liner | Freshness | Materials |
|---|-------|-----------|-----------|-----------|
| 1 | ...   | ...       | Today     | 2 articles (TechCrunch, HN) |
| 2 | ...   | ...       | Today     | 1 article + 3 tweets |
```

Materials column should show source types and names, e.g., `1 article + 2 tweets + 1 repo` — this reveals cross-type density at a glance.

#### Section 2: Topic pool

**Only topics matching the user's stated domains.** Tag each with recommended channel and content type.

```
## Topic Pool

| # | Topic | Value / Hook | Channel | Type | Freshness | Materials |
|---|-------|-------------|---------|------|-----------|-----------|
| 6 | ...   | ...         | Short video | Tool review | Today | 1 repo (1.8k⭐/day) + 2 tweets |
| 7 | ...   | ...         | Long-form   | Opinion piece | 3 days | 1 tweet thread (9.9M views) |
| 8 | ...   | ...         | Both        | Podcast recap | 2 days | 1 podcast + 3 tweets |
| 9 | ...   | ...         | Long-form   | News analysis | 2 days | 2 articles + 1 video |
```

**Type** indicates the content angle, which guides the writer skill on structure:
- `News analysis` — breaking news or event coverage
- `Tool review` — trending repo, new product, or tool comparison
- `Opinion piece` — thought leader take, contrarian view, trend commentary
- `Podcast recap` — key insights from a podcast/interview
- `Trend report` — pattern across multiple signals (e.g., "3 agent harnesses trending at once")
- `Tutorial` — how-to inspired by a new tool or technique

Notes:
- Numbering is globally sequential across both sections for easy reference ("1 and 7")
- Value/Hook column: write a hook for short videos, core insight for long-form
- After each section, one sentence highlighting the top-priority topic with reasoning
- A topic may appear in both sections if angles differ

#### Detailed brief (on demand)

When the user selects topics (e.g., "let's write 1 and 5"), expand the full brief:

```
### #1 [Topic direction]
**Type**: Tool review

**Suggested angles**:
- Angle A: ...
- Angle B: ...

**Reference materials**:
- [Title](url) — core material, provides [what]
- [Title](url) — supplementary perspective, useful for [what]
- @handle tweet (url) — key quote or data point
- repo: owner/name (url) — ⭐ count, description
```

Reference materials are the most important output — every recommendation must include source materials for writing, annotated with their role: primary source, opposing view, data source, background context. Materials can be articles, tweets, repos, videos, or podcast episodes. These are provided in the expanded brief so the user enters writing with all materials ready.

If the user says "start writing" without selecting, expand the top-priority topic.

### 5. Hand off to writer

After topic selection, guide to the writer skill with:
- Content type (news analysis, tool review, podcast recap, etc.)
- Reference materials (articles, tweets, repos, videos — with urls)
- Recommended channel and angle
- Any additional direction from the user

---

## Hot topic evaluation

When the user asks "should we cover XXX":

1. Search across enabled sources for related materials
2. Analyze: how many sources reporting, what aspects are discussed, trending up or cooling down
3. Give a clear cover/skip recommendation — if worth covering, include suitable channel, angle, and reference materials

---

## Reference files

- `references/channel-criteria.md` — Channel-specific selection criteria and cross-channel coordination
- `references/source-config.md` — Source configuration (Gist setup, template) + per-source command reference
