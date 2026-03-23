import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const MAX_ATTEMPTS = 3;
const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";

// --- Argument Parsing ---

function printUsage() {
  console.log(`
Usage: main.mjs [options]

Options:
  --prompt, -p <text>       Prompt text
  --promptfiles <files...>  Read prompt from files (concatenated)
  --image <path>            Output image path (default: image-{timestamp}.png)
  --model, -m <id>          Model ID (default: ${DEFAULT_MODEL})
  --ar <ratio>              Aspect ratio (e.g. 16:9, 1:1, 4:3)
  --quality <preset>        1K | 2K (default) | 4K
  --ref <files...>          Reference images
  --help, -h                Show this help
`);
}

function parseArgs(argv) {
  const args = { quality: "2K" };
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--prompt":
      case "-p":
        args.prompt = argv[++i];
        break;
      case "--promptfiles": {
        args.promptFiles = [];
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.promptFiles.push(argv[++i]);
        }
        break;
      }
      case "--image":
        args.image = argv[++i];
        break;
      case "--model":
      case "-m":
        args.model = argv[++i];
        break;
      case "--ar":
        args.ar = argv[++i];
        break;
      case "--quality":
        args.quality = argv[++i];
        break;
      case "--ref": {
        args.refImages = [];
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.refImages.push(argv[++i]);
        }
        break;
      }
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        console.warn(`Unknown option: ${arg}`);
    }
    i++;
  }

  return args;
}

// --- .env Loading ---

function loadEnvFile() {
  const paths = [
    resolve(process.cwd(), ".image-gen/.env"),
    resolve(process.env.HOME || "~", ".image-gen/.env"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

// --- Prompt Loading ---

function loadPrompt(args) {
  const parts = [];

  if (args.promptFiles?.length) {
    for (const file of args.promptFiles) {
      const content = readFileSync(file, "utf-8");
      const stripped = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
      parts.push(stripped.trim());
    }
  }

  if (args.prompt) {
    parts.push(args.prompt);
  }

  if (parts.length === 0) {
    throw new Error("No prompt provided. Use --prompt or --promptfiles.");
  }

  return parts.join("\n\n");
}

// --- Image Generation ---

function getMimeType(path) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}

async function generateImage(prompt, model, args) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const content = [];

  if (args.refImages?.length) {
    for (const refPath of args.refImages) {
      const data = readFileSync(refPath);
      const b64 = data.toString("base64");
      const mime = getMimeType(refPath);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}` },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  const body = {
    model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    stream: false,
    image_config: {
      image_size: args.quality || "2K",
    },
  };

  if (args.ar) {
    body.image_config.aspect_ratio = args.ar;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error("No message in response");

  if (message.images?.length) {
    const url = message.images[0].image_url?.url;
    if (url) return decodeImageUrl(url);
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "image_url" && part.image_url?.url) {
        return decodeImageUrl(part.image_url.url);
      }
    }
  }

  throw new Error("No image found in response");
}

async function decodeImageUrl(url) {
  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1];
    if (b64) return Uint8Array.from(Buffer.from(b64, "base64"));
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// --- Main ---

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    printUsage();
    process.exit(1);
  }

  const args = parseArgs(rawArgs);

  loadEnvFile();

  const model = args.model || process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL;
  const prompt = loadPrompt(args);

  if (!args.image) {
    args.image = `image-${Date.now()}.png`;
  }

  console.log(`Using openrouter / ${model}`);

  let lastError = null;
  let imageData = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      imageData = await generateImage(prompt, model, {
        ar: args.ar,
        quality: args.quality,
        refImages: args.refImages,
      });
      break;
    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  if (!imageData) throw lastError;

  const outputPath = resolve(process.cwd(), args.image);
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, imageData);
  console.log(`Image saved to ${outputPath} (${imageData.length} bytes)`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
