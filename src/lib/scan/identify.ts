import { computeDHash, findBestMatch, loadHashIndex } from "./dhash";
import type { ScryfallCard } from "@/types/card";

export interface IdentifyResult {
  card: ScryfallCard | null;
  method: "ocr" | "dhash" | "none";
  confidence: number;
  detail: string;
}

let ocrWorker: import("tesseract.js").Worker | null = null;
let ocrLoading = false;

async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  if (ocrLoading) return null;
  ocrLoading = true;
  try {
    const Tesseract = await import("tesseract.js");
    ocrWorker = await Tesseract.createWorker("eng");
    ocrLoading = false;
    return ocrWorker;
  } catch {
    ocrLoading = false;
    return null;
  }
}

getOcrWorker();

async function fetchScryfallCard(name: string, set?: string): Promise<ScryfallCard | null> {
  try {
    let url = `/api/scryfall/named?fuzzy=${encodeURIComponent(name)}`;
    if (set) url += `&set=${encodeURIComponent(set)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchScryfallById(id: string): Promise<ScryfallCard | null> {
  try {
    const res = await fetch(`/api/scryfall/cards/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function adaptiveThreshold(imageData: ImageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);

  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
  }

  // Compute integral image for fast local mean
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }

  // Adaptive threshold: compare each pixel to local mean in a window
  const windowSize = Math.max(15, Math.floor(width / 16) | 1);
  const half = windowSize >> 1;
  const bias = 8; // below-mean bias to favor text (dark on light)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const y1 = Math.max(0, y - half);
      const y2 = Math.min(height, y + half + 1);
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(width, x + half + 1);

      const area = (y2 - y1) * (x2 - x1);
      const sum =
        integral[y2 * (width + 1) + x2] -
        integral[y1 * (width + 1) + x2] -
        integral[y2 * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];

      const localMean = sum / area;
      const px = gray[y * width + x];
      const bw = px > localMean - bias ? 255 : 0;

      const idx = (y * width + x) * 4;
      data[idx] = bw;
      data[idx + 1] = bw;
      data[idx + 2] = bw;
    }
  }
}

function sharpenImage(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const sd = src.data;
  const dd = dst.data;

  // Unsharp mask kernel: center=5, neighbors=-1
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * w + x) * 4 + c;
        const val =
          5 * sd[i] -
          sd[((y - 1) * w + x) * 4 + c] -
          sd[((y + 1) * w + x) * 4 + c] -
          sd[(y * w + x - 1) * 4 + c] -
          sd[(y * w + x + 1) * 4 + c];
        dd[i] = Math.max(0, Math.min(255, val));
      }
      dd[(y * w + x) * 4 + 3] = 255;
    }
  }

  ctx.putImageData(dst, 0, 0);
}

function enhanceContrast(imageData: ImageData) {
  const d = imageData.data;
  let min = 255, max = 0;

  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const range = max - min;
  if (range < 30) return; // image is too flat to stretch

  const scale = 255 / range;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] - min) * scale)));
    }
  }
}

interface CropRegion {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

// Multiple crop regions for the card name area — handles off-center positioning
const OCR_CROPS: CropRegion[] = [
  // Centered card, name at top
  { xPct: 0.08, yPct: 0.04, wPct: 0.84, hPct: 0.14 },
  // Slightly lower (card shifted up in frame)
  { xPct: 0.08, yPct: 0.12, wPct: 0.84, hPct: 0.14 },
  // Wider generous crop
  { xPct: 0.05, yPct: 0.02, wPct: 0.90, hPct: 0.20 },
];

function extractCardNames(ocrText: string): string[] {
  const candidates: string[] = [];
  const lines = ocrText.split("\n").map((l) => l.trim()).filter((l) => l.length >= 3);

  for (const line of lines) {
    // Clean OCR artifacts
    let cleaned = line
      .replace(/^[^a-zA-ZÀ-ɏ]+/, "")
      .replace(/[^a-zA-ZÀ-ɏ\s',.\-]+$/, "")
      .replace(/[|\\[\]{}]+/g, "")
      .trim();

    if (cleaned.length < 3 || cleaned.length > 50) continue;

    // Skip type lines, rules text, P/T
    if (/^(Legendary|Creature|Instant|Sorcery|Enchantment|Artifact|Land|Planeswalker|Tribal|Token)/i.test(cleaned)) continue;
    if (/^\d+\/\d+$/.test(cleaned)) continue;
    if (/^[{(]/.test(cleaned)) continue;
    if (/^(Tap|Untap|Draw|Discard|Destroy|Return|Counter|Target|When|At the|If |You )/i.test(cleaned)) continue;

    candidates.push(cleaned);

    // Also try with common OCR corrections
    const corrected = cleaned
      .replace(/[0O](?=[a-z])/g, "O")
      .replace(/[1l](?=[a-z])/g, "l")
      .replace(/rn/g, "m");
    if (corrected !== cleaned) candidates.push(corrected);
  }

  return candidates;
}

export async function identifyCard(
  video: HTMLVideoElement,
  hashCanvas: HTMLCanvasElement,
  ocrCanvas: HTMLCanvasElement,
  setCode?: string
): Promise<IdentifyResult> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return { card: null, method: "none", confidence: 0, detail: "No video" };

  // ── Step 1: OCR with multiple crops and enhanced preprocessing ──
  try {
    const worker = await getOcrWorker();
    if (worker) {
      const ctx = ocrCanvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        const allCandidates: string[] = [];

        for (const crop of OCR_CROPS) {
          const cropX = vw * crop.xPct;
          const cropY = vh * crop.yPct;
          const cropW = vw * crop.wPct;
          const cropH = vh * crop.hPct;

          // Upscale to a readable size for Tesseract
          const outW = 900;
          const outH = Math.round(outW * (crop.hPct / crop.wPct));
          ocrCanvas.width = outW;
          ocrCanvas.height = outH;

          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

          // Enhance: contrast stretch → sharpen → adaptive threshold
          const raw = ctx.getImageData(0, 0, outW, outH);
          enhanceContrast(raw);
          ctx.putImageData(raw, 0, 0);

          sharpenImage(ctx, outW, outH);

          const sharpened = ctx.getImageData(0, 0, outW, outH);
          adaptiveThreshold(sharpened);
          ctx.putImageData(sharpened, 0, 0);

          const { data } = await worker.recognize(ocrCanvas);
          const names = extractCardNames(data.text);
          allCandidates.push(...names);

          // Also try inverted (white text on dark background — older card frames)
          const inverted = ctx.getImageData(0, 0, outW, outH);
          for (let i = 0; i < inverted.data.length; i += 4) {
            inverted.data[i] = 255 - inverted.data[i];
            inverted.data[i + 1] = 255 - inverted.data[i + 1];
            inverted.data[i + 2] = 255 - inverted.data[i + 2];
          }
          ctx.putImageData(inverted, 0, 0);

          const inv = await worker.recognize(ocrCanvas);
          allCandidates.push(...extractCardNames(inv.data.text));
        }

        // Deduplicate and try each candidate against Scryfall
        const tried = new Set<string>();
        for (const name of allCandidates) {
          const key = name.toLowerCase();
          if (tried.has(key)) continue;
          tried.add(key);

          const card = await fetchScryfallCard(name, setCode);
          if (card) {
            return {
              card,
              method: "ocr",
              confidence: 0.85,
              detail: `OCR: ${card.name}`,
            };
          }
        }
      }
    }
  } catch {
    // OCR failed — fall through to dHash
  }

  // ── Step 2: dHash (strict threshold only) ──
  try {
    const index = await loadHashIndex();
    const crops = [
      { x: vw * 0.12, y: vh * 0.12, w: vw * 0.76, h: vh * 0.40 },
      { x: vw * 0.15, y: vh * 0.15, w: vw * 0.70, h: vh * 0.35 },
      { x: vw * 0.20, y: vh * 0.18, w: vw * 0.60, h: vh * 0.32 },
    ];

    let bestMatch: { entry: { id: string; n: string }; distance: number } | null = null;

    for (const crop of crops) {
      const hash = computeDHash(hashCanvas, video, crop);
      if (!hash) continue;

      const match = findBestMatch(hash, index, 8);
      if (match && (!bestMatch || match.distance < bestMatch.distance)) {
        bestMatch = match;
      }
    }

    if (bestMatch && bestMatch.distance <= 8) {
      const card = await fetchScryfallById(bestMatch.entry.id);
      if (card) {
        return {
          card,
          method: "dhash",
          confidence: Math.max(0.3, 1 - bestMatch.distance / 12),
          detail: `Visual: ${card.name}`,
        };
      }
    }
  } catch {
    // dHash failed
  }

  return { card: null, method: "none", confidence: 0, detail: "Not recognized — try better lighting or centering" };
}
