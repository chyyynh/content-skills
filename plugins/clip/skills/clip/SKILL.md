---
name: clip
description: Clips a YouTube video locally using yt-dlp and ffmpeg. Supports 9:16 short video format with AI cover image and ElevenLabs hook voiceover, auto-highlight detection, translation, and CapCut-style karaoke subtitle burning. Triggers when the user wants local video clipping, highlight extraction, short video creation, or subtitle generation. Optional env vars: GROQ_API_KEY (Whisper fallback), ELEVENLABS_API_KEY (hook voiceover), OPENROUTER_API_KEY (AI cover image).
argument-hint: "[youtube-url-or-id] [start] [end] [output]"
---

# Video Clip (Local)

Requires `yt-dlp`, `ffmpeg`, and `python3`. Check with `command -v`.

## Finding plugin scripts

The ASS karaoke generator is bundled with this plugin. The AI cover image generator is in the image plugin. Locate both once at the start:

```bash
ASS_SCRIPT=$(find ~/.claude/plugins -path '*/clip/*/scripts/ass-karaoke.py' 2>/dev/null | head -1)
IMG_SCRIPT=$(find ~/.claude/plugins -path '*/image/*/scripts/main.mjs' 2>/dev/null | head -1)
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

Note: `ass-karaoke.py` automatically handles VTT metadata (e.g., `align:start position:0%`) and YouTube speaker markers (`>>`). No manual stripping needed.

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

#### 9:16 短影片格式

For vertical short video, append crop + scale to the end of the `-vf` chain:

- **Center crop** (talking head, default): append `,crop=ih*9/16:ih,scale=1080:1920`
  - With subs: `-vf "ass=subs.ass,crop=ih*9/16:ih,scale=1080:1920"`
  - With burned-in subs: `-vf "drawbox=...,ass=subs.ass,crop=ih*9/16:ih,scale=1080:1920"`
  - Without subs: `-vf "crop=ih*9/16:ih,scale=1080:1920"` (cannot use `-c copy`)
- **Blur background** (preserve full frame, wider shots — recommended): use `-filter_complex` instead of `-vf`, and **replace** the normal `-map` flags with `-map "[v]" -map 1:a:0` only. Do NOT keep the original `-map 0:v:0 -map 1:a:0` — that would create duplicate streams.
  - Single-pass example (with subs):
    ```bash
    ffmpeg -y -ss <START> -i "$VIDEO_URL" -ss <START> -i "$AUDIO_URL" -t <DURATION> \
      -filter_complex "[0:v]ass=subs.ass,split=2[fg][bg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25[bgb];[fg]scale=1080:-2[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2[v]" \
      -map "[v]" -map 1:a:0 \
      -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart main.mp4
    ```
  - Without subs: remove `ass=subs.ass,` from the filter chain
  - Two-pass alternative: clip normally (16:9) → `temp.mp4`, then convert:
    ```bash
    ffmpeg -y -i temp.mp4 -filter_complex "[0:v]split=2[fg][bg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25[bgb];[fg]scale=1080:-2[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2[v]" \
      -map "[v]" -map 0:a -c:v libx264 -preset fast -crf 23 -c:a copy main.mp4
    ```

Default to blur background for short video (preserves full frame). Use center crop only when the user asks or the content is a centered talking head.

### 9. Short video intro (Hook + AI Cover + Voiceover)

Generate a hook intro before the main clip. Structure: **cover image + hook voiceover (3–5s)** → **main clip with subtitles** → **CTA outro (optional)**.

#### a. Script planning

**If `clip-brief.md` exists in the working directory**（from writer skill）: read it and extract hook text, cover description, CTA text. Skip to step b.

**Otherwise**, plan the script based on the clip content. Read `references/hook-formulas.md` for the full formula library. The process:

1. **Analyze content**: Based on the transcript/segments, identify the core message and emotional tone
2. **Pick hook formula**: Match content type to the best hook formula:

   | 內容類型 | 推薦 Hook |
   |---------|----------|
   | 突發新聞/產品發布 | FOMO（"_____ 你聽說了嗎？"）、緊急（"在你 _____ 之前"） |
   | 爭議性觀點 | 顛覆（"你以為的 _____ 全錯了"） |
   | 工具評測/教學 | 緊急、錯誤（"X 個常見錯誤"） |
   | 數據報告/趨勢 | 數據（"只有 X% 的人知道"） |
   | 科普解釋 | 直球（"X 分鐘搞懂 _____"） |

3. **Write hook**: Fill in the template, keep it **under 30 characters** and colloquial — it will be spoken aloud via TTS. Test by reading it out loud: if it sounds unnatural, rewrite.
4. **Write cover text**: Main title (≤10 chars) + optional subtitle
5. **Write CTA** (optional): One line for the outro, platform-appropriate
6. **Present to user**: Show the hook, cover text, and CTA for approval before proceeding

**Output** (confirm with user):
```
Hook 配音：[spoken hook text]
封面主標：[big title on cover]
封面副標：[subtitle, optional]
CTA：[outro text, optional]
```

#### b. Generate cover image

**With image plugin** (requires `OPENROUTER_API_KEY` and `IMG_SCRIPT`):

```bash
node "$IMG_SCRIPT" --prompt "<COVER_DESCRIPTION>" --ar 9:16 --image cover.png
```

The prompt should describe a visually striking image related to the clip topic. Good cover prompts include subject, mood, and composition — e.g., "A dramatic close-up portrait of a tech executive speaking on stage, dark background with blue stage lighting, cinematic film grain, bold white Chinese title text overlaid in the center".

**Fallback** (no image plugin): extract a frame and use drawtext:

```bash
ffmpeg -y -ss <GOOD_TIMESTAMP> -i "$VIDEO_URL" -frames:v 1 -q:v 2 cover_base.jpg
ffmpeg -y -i cover_base.jpg -vf "\
crop=ih*9/16:ih,scale=1080:1920,\
eq=brightness=-0.35:contrast=1.05,\
drawbox=x=0:y=0:w=iw:h=ih:color=black@0.35:t=fill,\
drawtext=text='主標題':font='Songti TC':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=(h/2)-60,\
drawtext=text='副標題':font='PingFang TC':fontsize=36:fontcolor=0xAAAAAA:x=(w-text_w)/2:y=(h/2)+40\
" cover.png
```

#### c. Generate hook voiceover (requires `ELEVENLABS_API_KEY`)

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/<VOICE_ID>?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "<HOOK_TEXT>",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "speed": 1.05}
  }' \
  --output hook.mp3
```

To list available voices and pick one:
```bash
curl -s "https://api.elevenlabs.io/v1/voices" -H "xi-api-key: $ELEVENLABS_API_KEY" | \
  python3 -c "import sys,json; [print(f'{v[\"voice_id\"]}: {v[\"name\"]}') for v in json.load(sys.stdin)['voices'][:20]]"
```

Present the voice list to the user and let them pick. Cache the chosen voice_id for subsequent clips.

If `ELEVENLABS_API_KEY` is not set, skip voiceover and use silent audio in step d.

#### d. Create intro clip

**Critical: the intro clip must match the main clip's fps and audio sample rate**, otherwise `concat` will produce wrong duration.

```bash
FPS=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 main.mp4 | head -1)
SR=$(ffprobe -v quiet -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 main.mp4 | head -1)
```

With voiceover:
```bash
ffmpeg -y -loop 1 -i cover.png -i hook.mp3 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -ar $SR -shortest intro.mp4
```

Without voiceover (fallback):
```bash
ffmpeg -y -loop 1 -i cover.png -f lavfi -i anullsrc=r=${SR}:cl=stereo \
  -t 3 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -shortest intro.mp4
```

#### e. CTA outro (optional)

If the user approved a CTA in step a, create an outro clip. Two options:

**With TTS CTA** (has `ELEVENLABS_API_KEY`): generate CTA voiceover the same way as step c, then:
```bash
# Use the last frame of main.mp4 as outro background, or use cover.png
ffmpeg -y -loop 1 -i cover.png -i cta.mp3 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -ar $SR -shortest outro.mp4
```

**Text-only CTA** (no TTS): 3-second silent outro with CTA text burned on:
```bash
ffmpeg -y -loop 1 -i cover.png -f lavfi -i anullsrc=r=${SR}:cl=stereo \
  -t 3 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,\
drawtext=text='<CTA_TEXT>':font='PingFang TC':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h/2)" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -shortest outro.mp4
```

#### f. Concat final video

**Must re-encode** — do NOT use `-c copy`. Intro and main will have different AAC encoder profiles; `-c copy` concat causes audio to drop after the first segment switches.

```bash
# With outro
echo "file 'intro.mp4'" > concat.txt
echo "file 'main.mp4'" >> concat.txt
echo "file 'outro.mp4'" >> concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 48000 -movflags +faststart final.mp4

# Without outro
echo "file 'intro.mp4'" > concat.txt
echo "file 'main.mp4'" >> concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 48000 -movflags +faststart final.mp4
```

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
- **CJK drawtext tofu**: use `font='PingFang TC'` (family name), NOT `fontfile=/path/to/Font.ttc` — TTC font collections render CJK as boxes
- **Concat duration wrong**: cover clip and main clip must have identical fps and audio sample rate. Always `ffprobe` the main clip first and match when creating the cover clip
