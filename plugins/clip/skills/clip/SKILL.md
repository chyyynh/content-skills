---
name: clip
description: Clips a YouTube video locally using yt-dlp and ffmpeg. Supports auto-highlight detection, translation, and CapCut-style karaoke subtitle burning. Triggers when the user wants local video clipping, highlight extraction, or subtitle generation. Optional GROQ_API_KEY env var enables Whisper transcription fallback when YouTube has no subtitles.
argument-hint: "[youtube-url-or-id] [start] [end] [output]"
---

# Video Clip (Local)

Requires `yt-dlp`, `ffmpeg`, and `python3`. Check with `command -v`.

## Finding plugin scripts

The ASS karaoke generator is bundled with this plugin. Locate it once at the start (this only searches for the plugin's own bundled file):

```bash
ASS_SCRIPT=$(find ~/.claude/plugins -path '*/clip/*/scripts/ass-karaoke.py' 2>/dev/null | head -1)
```

## Auto-highlight mode

When the user does NOT specify start/end times (e.g., "幫我剪這個影片的精華" or "clip the best parts"):

1. Download the full transcript (step 1–2 below)
2. Produce a scannable transcript for highlight detection:
   - If the video has chapter markers (`yt-dlp --print chapters --no-playlist --no-warnings "<URL>"`), use those as the starting structure
   - Otherwise, use `--dump-segments` on the full VTT to get deduplicated text, then scan in ~5-minute chunks rather than reading every line
3. Identify 3–5 highlight segments. For each, note:
   - Start and end timestamps
   - A short description of why it's interesting (key insight, funny moment, dramatic turn, etc.)
4. Present the highlights to the user as numbered options and ask which ones to clip
5. Clip only the segments the user picks, then continue with the normal pipeline (translate, subtitle, etc.)

## Pipeline

### 1. Get video info and original language

```bash
yt-dlp --print title --print duration_string --print language \
  --no-playlist --no-warnings --force-ipv4 "<URL>"
```

The third line is the original language code (e.g., `en`, `en-US`, `ja`, `zh-Hant`). Use the base code (before `-`) for subtitle download.

### 2. Download original language subtitles

```bash
yt-dlp --write-auto-sub --sub-lang "<LANG>*" --sub-format vtt --skip-download \
  --no-playlist --no-warnings --force-ipv4 \
  --extractor-args 'youtube:player-client=default,mweb' \
  -o "subs" "<URL>"
```

Replace `<LANG>` with the base language code from step 1 (e.g., `en`, `ja`). The `*` wildcard matches variants like `en-orig`. Do NOT use YouTube's auto-translated subs — they are low quality. All translation is done by you.

### 3. Trim VTT to clip range

When clipping a portion (e.g., 10–130s), filter the VTT to only include cues whose timestamps fall within the range. **Keep the original absolute timestamps — do NOT adjust them.** The `--offset` flag in `ass-karaoke.py` handles the time shift.

When filtering, strip any extra metadata from timestamp lines (e.g., `align:start position:0%`) — keep only `HH:MM:SS.mmm --> HH:MM:SS.mmm`. The ASS parser regex expects clean timestamp lines.

### 4. Extract clean segments for translation

YouTube auto-subs use rolling captions — each raw cue is a sentence fragment with massive overlap. **Do NOT translate raw cues directly.** Instead, use `--dump-segments` to get deduplicated, clean text:

```bash
python3 "$ASS_SCRIPT" clip.vtt --dump-segments --offset <START_SECONDS> > segments.json
```

This outputs a JSON array of deduplicated segments:
```json
[
  {"index": 0, "start": 120.5, "end": 123.8, "text": "And yet the number of radiologists grew."},
  {"index": 1, "start": 123.8, "end": 126.2, "text": "And so the question is why?"},
  ...
]
```

Typical reduction: 119 raw cues → ~59 clean segments for a 2.5-minute clip.

### 5. Translate segments

Read `segments.json`, translate each segment's `text` field, and write a `translations.json`:

```json
{"0": "然而放射科医生的数量反而增加了。", "1": "那问题是：为什么？", ...}
```

Write and execute a Python script like:
```python
import json

with open("segments.json") as f:
    segments = json.load(f)

translations = {
    "0": "translated segment 0",
    "1": "translated segment 1",
    # ... one entry per segment index
}

with open("translations.json", "w") as f:
    json.dump(translations, f, ensure_ascii=False, indent=2)
```

Generate this script with the `translations` dict filled in, then execute it.

Key points:
- Translate **complete segments**, not raw cue fragments
- The index keys must match segment indices from `segments.json`
- Review: after writing, print 3–5 sample lines (`original → translation`) for the user to sanity-check before burning

### 6. Generate ASS subtitles

**Bilingual mode** (original karaoke + translation below):
```bash
python3 "$ASS_SCRIPT" clip.vtt -o subs.ass --translations translations.json --offset <START_SECONDS>
```

**Translation-only mode** (only translated text, no original):
```bash
python3 "$ASS_SCRIPT" clip.vtt -o subs.ass --translations translations.json --offset <START_SECONDS> --translation-only
```

Options:
- First arg = **original language** VTT (used for timing; in bilingual mode, also for karaoke display)
- `--translations` = translations JSON file (index-keyed, matches `--dump-segments` output)
- `--translation` `-t` = legacy: translated VTT file (still supported but `--translations` is preferred)
- `--offset` = clip start time in seconds (adjusts timestamps relative to clip start)
- `--bg` = add opaque background box behind subtitle text (useful with `drawbox`)
- `--translation-only` = hide original karaoke line, show only translation (larger font, centered)
- `--dump-segments` = output deduplicated segments as JSON to stdout and exit

### 7. Check for burned-in subtitles

Before clipping, extract a frame during the speech portion to check if the video already has hardcoded subtitles:

```bash
ffmpeg -y -ss <MID_SPEECH_TIME> -i "$VIDEO_URL" -frames:v 1 -q:v 2 frame_check.jpg
```

Visually inspect the frame. If burned-in subtitles are present at the bottom (common on X/Twitter videos), use `drawbox` in step 8 to cover them with a full-width black strip before overlaying the ASS subs.

### 8. Resolve stream URLs and clip

Get both video + audio URLs in **one call**:

```bash
URLS=$(yt-dlp --get-url -f 'bv[height<=720]+ba/b[height<=720]' \
  --no-playlist --no-warnings --force-ipv4 \
  --extractor-args 'youtube:player-client=default,mweb' "<URL>")
VIDEO_URL=$(echo "$URLS" | head -1)
AUDIO_URL=$(echo "$URLS" | tail -1)
```

Then clip with ffmpeg:

- With subtitles (no burned-in subs): `-vf "ass=subs.ass" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart`
- With subtitles (has burned-in subs): `-vf "drawbox=x=0:y=ih-160:w=iw:h=160:color=black:t=fill,ass=subs.ass"` + same encoding flags. Adjust `160` if the original subs sit higher or lower.
- Without subtitles: `-c copy -avoid_negative_ts make_zero`
- Input seeking: `-ss <START>` before each `-i`
- Separate streams: `-map 0:v:0 -map 1:a:0`

### Whisper fallback (no YouTube subs)

If yt-dlp finds no auto-subs and user has `GROQ_API_KEY` set:

1. Download audio: `yt-dlp -f ba -x --audio-format mp3 --postprocessor-args 'ffmpeg:-ac 1 -ar 16000 -b:a 64k'`
2. Transcribe: `POST https://api.groq.com/openai/v1/audio/transcriptions` with `model=whisper-large-v3`, `response_format=verbose_json`
3. Convert segments to VTT

If `GROQ_API_KEY` is not set, inform the user that no subtitles are available and ask how to proceed (clip without subs, or set the key).

## Common issues

- YouTube throttling: export cookies to a file and use `--cookies cookies.txt`
- Missing CJK fonts for ASS: `brew install font-noto-sans-cjk-tc` (macOS)
- Groq 25MB audio limit: split audio for videos >50min
- Stream URLs expire ~6h: re-resolve if clip fails
- Subtitle burning re-encodes video (~1–3 min for 60s clip)
