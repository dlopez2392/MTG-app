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

  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }

  const windowSize = Math.max(15, Math.floor(width / 12) | 1);
  const half = windowSize >> 1;

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
      const bw = gray[y * width + x] > localMean - 10 ? 255 : 0;

      const idx = (y * width + x) * 4;
      data[idx] = bw;
      data[idx + 1] = bw;
      data[idx + 2] = bw;
    }
  }
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
  if (range < 30) return;

  const scale = 255 / range;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] - min) * scale)));
    }
  }
}

function extractCardNames(ocrText: string): string[] {
  const candidates: string[] = [];
  const lines = ocrText.split("\n").map((l) => l.trim()).filter((l) => l.length >= 3);

  for (const line of lines) {
    let cleaned = line
      .replace(/^[^a-zA-ZÀ-ɏ]+/, "")
      .replace(/[^a-zA-ZÀ-ɏ\s',.\-]+$/, "")
      .replace(/[|\\[\]{}]+/g, "")
      .trim();

    if (cleaned.length < 3 || cleaned.length > 50) continue;
    if (/^(Legendary|Creature|Instant|Sorcery|Enchantment|Artifact|Land|Planeswalker|Tribal|Token)/i.test(cleaned)) continue;
    if (/^\d+\/\d+$/.test(cleaned)) continue;
    if (/^[{(]/.test(cleaned)) continue;
    if (/^(Tap|Untap|Draw|Discard|Destroy|Return|Counter|Target|When|At the|If |You |This )/i.test(cleaned)) continue;

    candidates.push(cleaned);

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

  // ── Step 1: dHash (instant, <50ms) ──
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
        const conf = Math.max(0.5, 1 - bestMatch.distance / 12);
        return {
          card,
          method: "dhash",
          confidence: conf,
          detail: `Visual: ${card.name}`,
        };
      }
    }
  } catch {
    // dHash failed — continue to OCR
  }

  // ── Step 2: Single OCR pass with enhanced preprocessing ──
  try {
    const worker = await getOcrWorker();
    if (worker) {
      const ctx = ocrCanvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        // Crop the card name region — generous area, handles slight offset
        const cropX = vw * 0.06;
        const cropY = vh * 0.03;
        const cropW = vw * 0.88;
        const cropH = vh * 0.18;

        // Smaller canvas for mobile speed (was 900, now 600)
        const outW = 600;
        const outH = Math.round(outW * (cropH / cropW));
        ocrCanvas.width = outW;
        ocrCanvas.height = outH;

        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

        // Enhance contrast then adaptive threshold
        const raw = ctx.getImageData(0, 0, outW, outH);
        enhanceContrast(raw);
        ctx.putImageData(raw, 0, 0);

        const enhanced = ctx.getImageData(0, 0, outW, outH);
        adaptiveThreshold(enhanced);
        ctx.putImageData(enhanced, 0, 0);

        const { data } = await worker.recognize(ocrCanvas);
        const candidates = extractCardNames(data.text);

        // Try each candidate against Scryfall (stop on first match)
        const tried = new Set<string>();
        for (const name of candidates) {
          const key = name.toLowerCase();
          if (tried.has(key)) continue;
          tried.add(key);

          const card = await fetchScryfallCard(name, setCode);
          if (card) {
            return {
              card,
              method: "ocr",
              confidence: 0.8,
              detail: `OCR: ${card.name}`,
            };
          }
        }
      }
    }
  } catch {
    // OCR failed
  }

  return { card: null, method: "none", confidence: 0, detail: "Not recognized — adjust angle or lighting" };
}
