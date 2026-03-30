# Step 9: Short Video Intro (Hook + AI Cover + Voiceover)

Structure: **cover image + hook voiceover (3-8s)** → **main clip with subtitles** → **CTA outro (optional)**.

## a. Script planning

**If `clip-brief.md` exists** (from writer skill): read it, extract hook text, cover description, CTA. Skip to step b.

**Otherwise**, read `references/hook-formulas.md` and:

1. Analyze the transcript — identify core message and emotional tone
2. Pick a hook formula that matches the content type
3. Write hook: 2-4 sentences, 30-80 chars, must sound natural spoken aloud
4. Write cover text: main title (≤10 chars) + optional subtitle
5. Write CTA (optional): one line, platform-appropriate

**Present to user for approval before proceeding:**
```
Hook 配音：[spoken hook text]
封面主標：[big title on cover]
封面副標：[subtitle, optional]
CTA：[outro text, optional]
```

## b. Generate cover image

**With image plugin** (requires `OPENROUTER_API_KEY` and `IMG_SCRIPT`):

```bash
node "$IMG_SCRIPT" --prompt "<COVER_DESCRIPTION>" --ar 9:16 --image cover.png
```

Prompt should include subject, mood, composition, and any text to render on the cover image.

**Fallback** (no image plugin): extract a frame and use drawtext:

```bash
ffmpeg -y -ss <TIMESTAMP> -i "$VIDEO_URL" -frames:v 1 -q:v 2 cover_base.jpg
ffmpeg -y -i cover_base.jpg -vf "\
crop=ih*9/16:ih,scale=1080:1920,\
eq=brightness=-0.35:contrast=1.05,\
drawbox=x=0:y=0:w=iw:h=ih:color=black@0.35:t=fill,\
drawtext=text='主標題':font='Songti TC':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=(h/2)-60,\
drawtext=text='副標題':font='PingFang TC':fontsize=36:fontcolor=0xAAAAAA:x=(w-text_w)/2:y=(h/2)+40\
" cover.png
```

## c. Generate hook voiceover (requires `ELEVENLABS_API_KEY`)

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

List voices: `curl -s "https://api.elevenlabs.io/v1/voices" -H "xi-api-key: $ELEVENLABS_API_KEY" | python3 -c "import sys,json; [print(f'{v[\"voice_id\"]}: {v[\"name\"]}') for v in json.load(sys.stdin)['voices'][:20]]"`

Present voice list to user, cache chosen voice_id for subsequent clips. If `ELEVENLABS_API_KEY` is not set, use silent audio (`anullsrc`) in step d.

## d. Create intro clip

**Critical**: intro must match main clip's fps and sample rate, otherwise concat produces wrong duration.

```bash
FPS=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 main.mp4 | head -1)
SR=$(ffprobe -v quiet -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 main.mp4 | head -1)

# With voiceover
ffmpeg -y -loop 1 -i cover.png -i hook.mp3 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -ar $SR -shortest intro.mp4

# Without voiceover (fallback)
ffmpeg -y -loop 1 -i cover.png -f lavfi -i anullsrc=r=${SR}:cl=stereo \
  -t 3 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -shortest intro.mp4
```

## e. CTA outro (optional)

If user approved a CTA, create an outro clip using the same method as step d — replace `hook.mp3` with `cta.mp3` (TTS) or use `anullsrc` with `drawtext` for text-only CTA. Use `cover.png` as background.

## f. Concat final video

**Must re-encode** — do NOT use `-c copy`. Intro and main have different AAC profiles; `-c copy` causes audio to drop after the first segment.

```bash
echo "file 'intro.mp4'" > concat.txt
echo "file 'main.mp4'" >> concat.txt
# echo "file 'outro.mp4'" >> concat.txt  # if CTA exists
ffmpeg -y -f concat -safe 0 -i concat.txt \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 48000 -movflags +faststart final.mp4
```
