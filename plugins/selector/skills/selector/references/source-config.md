# Sources

## Contents

- [User source config (GitHub Gist)](#user-source-config-github-gist)
- [Unified material format](#unified-material-format)
- [Fetch methods by type](#fetch-methods-by-type)

---

## User source config (GitHub Gist)

Users maintain their source list via GitHub Gist, organized by type (RSS, Twitter, YouTube, Bilibili, Xiaohongshu, Website). Only sources marked `enabled=yes` are fetched.

### Setup

1. Create a gist at [gist.github.com](https://gist.github.com) with filename `my-sources.md`
2. Organize sources into sections by type, each with a table: `Name | Enabled | Tags | URL | Notes`
3. Set env var: `export SELECTOR_SOURCES_GIST="<gist-id>"`

### Fetching and caching

```bash
gh gist view "$SELECTOR_SOURCES_GIST" -f my-sources.md
```

- On success, cache to `/tmp/selector-sources-cache.md`
- If gist unavailable, use cached version and warn user
- If no cache, skip user sources and inform user how to set up

---

## Unified material format

All sources normalize into this format:

| Field | Required | Description |
|-------|----------|-------------|
| title | Yes | Headline or video title |
| url | Yes | Original link |
| source | Yes | Source name from the gist |
| summary | No | One-line summary |
| date | No | Published or fetched time |
| type | No | `article` / `video` / `post` / `discussion` |
| tags | No | Carried over from the gist tags column |

---

## Fetch methods by type

For each source type, use the first available method. If none work, skip the source.

### RSS

Most reliable source type. No authentication needed.

```bash
# Use WebFetch to read the feed URL directly
WebFetch <feed-url> "Extract the N most recent items: title, url, date, summary"
```

- Works for all RSS/Atom feeds (blogs, news sites, forums like HN and Product Hunt)
- Set N from the gist `Limit` column, or default to 10
- type = `article`

### Twitter

```bash
# Option 1: WebFetch (public profiles)
WebFetch <profile-url> "Extract the 10 most recent tweets with text and date"

# Option 2: opencli
opencli twitter profile <handle> --limit 10 --format json

# Option 3: WebSearch
WebSearch "<handle> site:x.com recent"
```

- type = `post`
- For search across multiple accounts, batch by tags from the gist

### YouTube

Public channels. No authentication needed.

```bash
# Option 1: yt-dlp (most reliable)
yt-dlp --flat-playlist --playlist-end 5 --print "%(title)s | %(url)s | %(upload_date)s" <channel-url>

# Option 2: WebFetch
WebFetch <channel-url> "Extract the 5 most recent video titles, URLs, and upload dates"
```

- type = `video`

### Bilibili

```bash
# Option 1: opencli user-videos (preferred — fetches from specific accounts)
opencli bilibili user-videos <uid> --limit 5 --format json

# Option 2: opencli search (keyword discovery)
opencli bilibili search "<keyword>" --limit 10 --format json

# Option 3: WebFetch (fallback)
WebFetch <space-url> "Extract the 5 most recent video titles, URLs, and upload dates"
```

- Extract uid from the space URL (e.g., `space.bilibili.com/11515399` → uid `11515399`)
- type = `video`

### Xiaohongshu

```bash
# Option 1: opencli user (preferred — fetches from specific accounts)
opencli xiaohongshu user <user-id> --limit 5 --format json

# Option 2: opencli search (keyword discovery, or fallback when user-id unavailable)
opencli xiaohongshu search "<creator-name-or-keyword>" --limit 5 --format json
```

- XHS blocks unauthenticated access; opencli with browser bridge is the only method
- If gist URL is a note URL (`/search_result/<note-id>`) instead of a user profile URL, fall back to searching by creator name
- If unavailable, skip
- type = `post`

### Website

Generic web pages. No authentication needed.

```bash
WebFetch <url> "Extract the most recent articles or posts: title, url, date, summary"
```

- type = `article`

---

## Fetch workflow

1. Read the gist (or cache/defaults)
2. Group enabled sources by type
3. For each type, use the fetch method above
4. Skip any source whose required tool is unavailable
5. Normalize all results into the unified format
6. Deduplicate by URL and title similarity, record cross-source hits
