import { computeDHash, findBestMatch, loadHashIndex } from "./dhash";
import type { ScryfallCard } from "@/types/card";

export interface IdentifyResult {
  card: ScryfallCard | null;
  method: "dhash" | "ocr" | "none";
  confidence: number;
  detail: string;
}

let ocrWorker: import("tesseract.js").Worker | null = null;
let ocrLoading = false;

async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  if (ocrLoading) return null;
  ocrLoading = true;
  const Tesseract = await import("tesseract.js");
  ocrWorker = await Tesseract.createWorker("eng");
  ocrLoading = false;
  return ocrWorker;
}

// Pre-load OCR worker in background
getOcrWorker();

async function fetchScryfallCard(name: string, set?: string): Promise<ScryfallCard | null> {
  try {
    let url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
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
    const res = await fetch(`https://api.scryfall.com/cards/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractCardName(ocrText: string): string | null {
  const lines = ocrText.split("\n").map((l) => l.trim()).filter((l) => l.length >= 3);

  for (const line of lines) {
    // Clean OCR artifacts from edges
    const cleaned = line
      .replace(/^[^a-zA-ZÀ-ɏ]+/, "")
      .replace(/[^a-zA-ZÀ-ɏ\s',.\-]+$/, "")
      .trim();

    // Skip lines that are too short or look like rules text / type lines
    if (cleaned.length < 3) continue;
    if (/^(Legendary|Creature|Instant|Sorcery|Enchantment|Artifact|Land|Planeswalker|Tribal)/i.test(cleaned)) continue;
    if (/^\d+\/\d+$/.test(cleaned)) continue;
    if (/^[{(]/.test(cleaned)) continue;

    // Likely a card name — first substantial line
    if (cleaned.length >= 3 && cleaned.length <= 50) {
      return cleaned;
    }
  }

  return null;
}

export async function identifyCard(
  video: HTMLVideoElement,
  hashCanvas: HTMLCanvasElement,
  ocrCanvas: HTMLCanvasElement
): Promise<IdentifyResult> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return { card: null, method: "none", confidence: 0, detail: "No video" };

  // ── Step 1: OCR (primary — reads the card name directly) ──
  try {
    const worker = await getOcrWorker();
    if (worker) {
      const ctx = ocrCanvas.getContext("2d");
      if (ctx) {
        // Crop the upper-center of the frame where the card name sits
        // Use a generous region so it works even if the card isn't perfectly centered
        const cropX = vw * 0.10;
        const cropY = vh * 0.05;
        const cropW = vw * 0.80;
        const cropH = vh * 0.20;

        // Upscale for better OCR accuracy
        ocrCanvas.width = 800;
        ocrCanvas.height = 200;

        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 800, 200);

        // High contrast grayscale for readability
        const imageData = ctx.getImageData(0, 0, 800, 200);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          const bw = gray > 128 ? 255 : 0;
          d[i] = bw;
          d[i + 1] = bw;
          d[i + 2] = bw;
        }
        ctx.putImageData(imageData, 0, 0);

        const { data } = await worker.recognize(ocrCanvas);
        const cardName = extractCardName(data.text);

        if (cardName) {
          const card = await fetchScryfallCard(cardName);
          if (card) {
            return {
              card,
              method: "ocr",
              confidence: 0.8,
              detail: `Found: ${card.name}`,
            };
          }
        }
      }
    }
  } catch {
    // OCR failed — try dHash
  }

  // ── Step 2: dHash (secondary — very strict threshold only) ──
  try {
    const index = await loadHashIndex();
    // Try multiple crop regions to increase chance of matching
    const crops = [
      { x: vw * 0.15, y: vh * 0.15, w: vw * 0.70, h: vh * 0.35 },
      { x: vw * 0.20, y: vh * 0.20, w: vw * 0.60, h: vh * 0.30 },
    ];

    for (const crop of crops) {
      const hash = computeDHash(hashCanvas, video, crop);
      if (!hash) continue;

      // Very strict threshold — only accept near-perfect matches
      const match = findBestMatch(hash, index, 5);
      if (match) {
        const card = await fetchScryfallById(match.entry.id);
        if (card) {
          return {
            card,
            method: "dhash",
            confidence: Math.max(0, 1 - match.distance / 10),
            detail: `Found: ${card.name}`,
          };
        }
      }
    }
  } catch {
    // dHash failed
  }

  return { card: null, method: "none", confidence: 0, detail: "Not recognized" };
}
