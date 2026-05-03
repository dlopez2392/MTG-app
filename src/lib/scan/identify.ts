import { computeDHash, findBestMatch, loadHashIndex } from "./dhash";
import type { ScryfallCard } from "@/types/card";

export interface IdentifyResult {
  card: ScryfallCard | null;
  method: "dhash" | "ocr" | "none";
  confidence: number;
  detail: string;
}

let ocrWorker: import("tesseract.js").Worker | null = null;

async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  const Tesseract = await import("tesseract.js");
  ocrWorker = await Tesseract.createWorker("eng");
  return ocrWorker;
}

function estimateArtCrop(video: HTMLVideoElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Card fills roughly the inner 70% of the frame
  const cardX = vw * 0.15;
  const cardY = vh * 0.10;
  const cardW = vw * 0.70;
  const cardH = vh * 0.80;

  // Art region is roughly 15%-55% of card height, 10%-90% of card width
  return {
    x: cardX + cardW * 0.05,
    y: cardY + cardH * 0.13,
    w: cardW * 0.90,
    h: cardH * 0.40,
  };
}

function estimateNameCrop(video: HTMLVideoElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const cardX = vw * 0.15;
  const cardY = vh * 0.10;
  const cardW = vw * 0.70;
  const cardH = vh * 0.80;

  // Name is at the very top of the card, roughly 3%-11% height
  return {
    x: cardX + cardW * 0.05,
    y: cardY + cardH * 0.03,
    w: cardW * 0.70,
    h: cardH * 0.08,
  };
}

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

export async function identifyCard(
  video: HTMLVideoElement,
  hashCanvas: HTMLCanvasElement,
  ocrCanvas: HTMLCanvasElement
): Promise<IdentifyResult> {
  // ── Step 1: dHash matching ──
  const index = await loadHashIndex();
  const artCrop = estimateArtCrop(video);
  const hash = computeDHash(hashCanvas, video, artCrop);

  if (hash) {
    const match = findBestMatch(hash, index);
    if (match) {
      const confidence = Math.max(0, 1 - match.distance / 20);
      const card = await fetchScryfallById(match.entry.id);
      if (card) {
        return {
          card,
          method: "dhash",
          confidence,
          detail: `${match.entry.n} (d=${match.distance})`,
        };
      }
      // ID might be stale — try by name + set
      const fallbackCard = await fetchScryfallCard(match.entry.n, match.entry.s);
      if (fallbackCard) {
        return {
          card: fallbackCard,
          method: "dhash",
          confidence,
          detail: `${match.entry.n} (d=${match.distance}, name fallback)`,
        };
      }
    }
  }

  // ── Step 2: OCR fallback ──
  try {
    const nameCrop = estimateNameCrop(video);
    const ctx = ocrCanvas.getContext("2d");
    if (ctx) {
      const cropW = Math.round(nameCrop.w);
      const cropH = Math.round(nameCrop.h);
      ocrCanvas.width = cropW * 2;
      ocrCanvas.height = cropH * 2;

      ctx.drawImage(
        video,
        nameCrop.x, nameCrop.y, nameCrop.w, nameCrop.h,
        0, 0, ocrCanvas.width, ocrCanvas.height
      );

      // Increase contrast for better OCR
      ctx.filter = "contrast(1.5) grayscale(1)";
      ctx.drawImage(ocrCanvas, 0, 0);
      ctx.filter = "none";

      const worker = await getOcrWorker();
      const { data } = await worker.recognize(ocrCanvas);

      const rawText = data.text.trim();
      // Clean OCR artifacts: take the first line, remove non-letter chars from edges
      const cardName = rawText
        .split("\n")[0]
        .replace(/^[^a-zA-Z]+/, "")
        .replace(/[^a-zA-Z\s',\-]+$/, "")
        .trim();

      if (cardName.length >= 3) {
        const card = await fetchScryfallCard(cardName);
        if (card) {
          return {
            card,
            method: "ocr",
            confidence: 0.7,
            detail: `OCR: "${cardName}"`,
          };
        }
      }
    }
  } catch {
    // OCR failed — fall through
  }

  return { card: null, method: "none", confidence: 0, detail: "Not recognized" };
}
